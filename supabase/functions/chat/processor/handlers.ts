import type { AdvancedChatMessage } from '../types/message.types.ts';
import type { ProcessingContext, ProcessingMetrics } from './MessageProcessor.ts';
import { MemoryManager } from '../core/memory/memory_manager.ts';

export interface MessageHandler {
  canHandle(message: AdvancedChatMessage): boolean;
  handle(message: AdvancedChatMessage, context: ProcessingContext): Promise<{
    message: AdvancedChatMessage;
    context: ProcessingContext;
    metrics: ProcessingMetrics;
  }>;
}

export class TextMessageHandler implements MessageHandler {
  constructor(private openai: any, private supabase: any, private memoryManager?: MemoryManager | null) {}
  canHandle(message: AdvancedChatMessage): boolean {
    return (message as any).content?.type === 'text';
  }
  
  private ensureProperMarkdownFormatting(text: string): string {
    // Split text into lines
    let lines = text.split('\n');
    let formattedLines: string[] = [];
    let inCodeBlock = false;
    let previousWasList = false;
    let previousWasHeader = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Check if we're entering/exiting a code block
      if (trimmed.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        // Add spacing around code blocks
        if (i > 0 && formattedLines[formattedLines.length - 1] !== '') {
          formattedLines.push('');
        }
        formattedLines.push(line);
        if (!inCodeBlock && i < lines.length - 1) {
          formattedLines.push('');
        }
        previousWasList = false;
        previousWasHeader = false;
        continue;
      }
      
      // Don't format inside code blocks
      if (inCodeBlock) {
        formattedLines.push(line);
        continue;
      }
      
      // Check if this is a header
      const isHeader = /^#{1,6}\s/.test(trimmed);
      
      // Check if this is a list item
      const isList = /^[-*+]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed);
      
      // Add spacing before headers
      if (isHeader) {
        if (i > 0 && formattedLines[formattedLines.length - 1] !== '') {
          formattedLines.push('');
        }
        formattedLines.push(line);
        // Add space after header
        if (i < lines.length - 1 && lines[i + 1].trim() !== '') {
          formattedLines.push('');
        }
        previousWasHeader = true;
        previousWasList = false;
        continue;
      }
      
      // Handle list items
      if (isList) {
        // Add space before list if previous wasn't a list
        if (!previousWasList && i > 0 && formattedLines[formattedLines.length - 1] !== '') {
          formattedLines.push('');
        }
        formattedLines.push(line);
        previousWasList = true;
        previousWasHeader = false;
        continue;
      }
      
      // Handle regular paragraphs
      if (trimmed !== '') {
        // Add space after list ends
        if (previousWasList && formattedLines[formattedLines.length - 1] !== '') {
          formattedLines.push('');
        }
        
        // Add space between paragraphs
        if (i > 0 && !previousWasHeader && !previousWasList) {
          const prevLine = formattedLines[formattedLines.length - 1];
          if (prevLine !== '' && prevLine.trim() !== '') {
            formattedLines.push('');
          }
        }
        
        formattedLines.push(line);
        previousWasList = false;
        previousWasHeader = false;
      } else {
        // Preserve empty lines but don't add duplicates
        if (formattedLines[formattedLines.length - 1] !== '') {
          formattedLines.push('');
        }
        previousWasList = false;
        previousWasHeader = false;
      }
    }
    
    // Clean up any trailing empty lines
    while (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] === '') {
      formattedLines.pop();
    }
    
    return formattedLines.join('\n');
  }
  async handle(message: AdvancedChatMessage, context: ProcessingContext) {
    const startTime = Date.now();
    const msgs: Array<{ role: 'system'|'user'|'assistant'|'tool'; content: string }> = [];
    
    if (context.agent_id) {
      const { data: agent, error } = await this.supabase
        .from('agents')
        .select('system_instructions, assistant_instructions, description, personality, name')
        .eq('id', context.agent_id)
        .single();
      
      const preamble: string[] = [];
      
      // CRITICAL: Agent Identity - Must be first and explicit
      preamble.push(`=== AGENT IDENTITY ===`);
      preamble.push(`Your name is "${agent?.name || 'Assistant'}".`);
      preamble.push(`You MUST always identify yourself by this name when asked.`);
      
      if (agent?.description) {
        preamble.push(`Your description/role: ${agent.description}`);
      }
      
      if (agent?.personality) {
        preamble.push(`Your personality traits: ${agent.personality}`);
        preamble.push(`You MUST maintain these personality characteristics consistently in all interactions.`);
      }
      
      preamble.push(`When asked "What is your name?" or "Who are you?", you MUST respond with: "My name is ${agent?.name || 'Assistant'}"`);
      preamble.push(`=== END AGENT IDENTITY ===\n`);
      
      // System instructions come after identity
      if (agent?.system_instructions) {
        preamble.push(`=== SYSTEM INSTRUCTIONS ===`);
        preamble.push(agent.system_instructions);
        preamble.push(`=== END SYSTEM INSTRUCTIONS ===\n`);
      }
      // Output formatting guidance - EXPLICIT MARKDOWN FORMATTING RULES
      preamble.push(
        `CRITICAL FORMATTING INSTRUCTIONS - You MUST format your responses using proper Markdown:

1. **Paragraphs**: Add a blank line between EVERY paragraph for proper spacing.

2. **Lists**: 
   - Use bullet points (- or *) for unordered lists
   - Use numbers (1. 2. 3.) for ordered lists
   - Add a blank line before and after lists
   - Each list item should be on its own line

3. **Emphasis**:
   - Use **bold** for important terms or key points
   - Use *italics* for subtle emphasis or examples
   - Use \`inline code\` for technical terms, commands, or values

4. **Headers**:
   - Use ## for main section headers
   - Use ### for subsection headers
   - Always add a blank line before and after headers

5. **Code Blocks**:
   \`\`\`language
   // Use triple backticks for code blocks
   // Specify the language for syntax highlighting
   \`\`\`

6. **Line Breaks**:
   - ALWAYS add blank lines between different sections
   - ALWAYS add blank lines between paragraphs
   - ALWAYS add blank lines around lists, headers, and code blocks

7. **Structure**:
   - Start with a brief introduction if needed
   - Organize content into logical sections
   - Use headers to separate major topics
   - End with a summary or conclusion if appropriate

EXAMPLE of proper formatting:

## Main Topic

This is the first paragraph with some **important information**.

This is the second paragraph, separated by a blank line. It includes \`technical terms\` in inline code.

### Subsection

Here's a list of items:

- First item with **bold emphasis**
- Second item with *italic text*
- Third item with more details

Another paragraph after the list, properly spaced.

Remember: ALWAYS use blank lines between elements for readability!`
      );
      if (preamble.length) msgs.push({ role: 'system', content: preamble.join('\n') });

      // CONTEXT WINDOW INJECTION (episodic/semantic context) - as assistant message
      const ctxWin = (message as any)?.context?.context_window;
      const sections = Array.isArray(ctxWin?.sections) ? ctxWin.sections : [];
      if (sections.length > 0) {
        const toLabel = (s: any): string => {
          if (s?.source === 'episodic_memory') return 'EPISODIC MEMORY';
          if (s?.source === 'semantic_memory') return 'SEMANTIC MEMORY';
          return s?.title || 'Context';
        };

        const top = sections
          .slice(0, 4)
          .map((s: any) => `${toLabel(s)}:\n${String(s.content || '').slice(0, 2000)}`);
        const ctxBlock = [
          '=== CONTEXT WINDOW ===',
          ...top,
          '=== END CONTEXT WINDOW ===\n',
        ].join('\n\n');
        msgs.push({ role: 'assistant', content: ctxBlock });
      }
      if (agent?.assistant_instructions) msgs.push({ role: 'assistant', content: agent.assistant_instructions });
    }
    // ADD CONVERSATION HISTORY FROM CONTEXT!
    const recentMessages = (message as any)?.context?.recent_messages || [];
    for (const msg of recentMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        msgs.push({ 
          role: msg.role as 'user' | 'assistant', 
          content: String(msg.content || '')
        });
      }
    }
    
    // Current message
    msgs.push({ role: 'user', content: (message as any).content?.text || '' });
    
    const completion = await this.openai.chat.completions.create({ model: 'gpt-4', messages: msgs, temperature: 0.7, max_tokens: 2000 });
    let text = completion.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
    
    // Post-process the response to ensure proper Markdown formatting
    // This handles cases where the LLM doesn't follow formatting instructions perfectly
    text = this.ensureProperMarkdownFormatting(text);
    const tokensTotal = completion.usage?.total_tokens || 0;
    const promptTokens = completion.usage?.prompt_tokens || 0;
    const completionTokens = completion.usage?.completion_tokens || 0;
    const processed: AdvancedChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      role: 'assistant',
      content: { type: 'text', text },
      timestamp: new Date().toISOString(),
      metadata: { model: 'gpt-4', tokens: { prompt: promptTokens, completion: completionTokens, total: tokensTotal }, source: 'api' },
    } as any;

    // FEEDBACK LOOP: Persist memories (episodic always; semantic if Pinecone configured)
    try {
      const memOpts = (context.request_options as any)?.memory ?? { enabled: true };
      if (memOpts.enabled && this.memoryManager) {
        const convo: AdvancedChatMessage[] = [message, processed];
        if (this.memoryManager.semanticManager) {
          await this.memoryManager.createFromConversation(convo, true);
        } else {
          await this.memoryManager.episodicManager.createFromConversation(convo, true);
        }
      }
    } catch (_) {
      // best-effort; do not fail response on memory persistence issues
    }
    return {
      message: processed,
      context,
      metrics: {
        start_time: startTime,
        end_time: Date.now(),
        stages: {},
        tokens_used: tokensTotal,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        model_used: 'gpt-4',
        memory_searches: 0,
        tool_executions: 0,
      },
    } as any;
  }
}

export class StructuredMessageHandler implements MessageHandler {
  canHandle(message: AdvancedChatMessage): boolean { return (message as any).content?.type === 'structured'; }
  async handle(message: AdvancedChatMessage, context: ProcessingContext) {
    return {
      message: { ...message, role: 'assistant' } as any,
      context,
      metrics: { start_time: Date.now(), end_time: Date.now(), stages: {}, tokens_used: 0, memory_searches: 0, tool_executions: 0 },
    } as any;
  }
}

export class ToolCallHandler implements MessageHandler {
  canHandle(message: AdvancedChatMessage): boolean { return (message as any).tools?.length > 0; }
  async handle(message: AdvancedChatMessage, context: ProcessingContext) {
    const start = Date.now();
    const toolCalls = ((message as any).tools || []) as any[];
    const details: any[] = [];
    for (const t of toolCalls) {
      const execStart = Date.now();
      try {
        // Placeholder: real execution is routed elsewhere; here we just simulate success
        details.push({
          name: t.function?.name || t.id || 'tool',
          execution_time_ms: 1 + (Date.now() - execStart),
          success: true,
          input_params: t.function?.arguments || {},
          output_result: { executed: true },
        });
      } catch (err: any) {
        details.push({
          name: t.function?.name || t.id || 'tool',
          execution_time_ms: Date.now() - execStart,
          success: false,
          input_params: t.function?.arguments || {},
          output_result: null,
          error: err?.message || 'Unknown error',
        });
      }
    }
    return {
      message: { ...message, role: 'assistant' } as any,
      context,
      metrics: {
        start_time: start,
        end_time: Date.now(),
        stages: {},
        tokens_used: 0,
        memory_searches: 0,
        tool_executions: toolCalls.length,
        tool_details: details,
      },
    } as any;
  }
}


