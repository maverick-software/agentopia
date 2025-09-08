import type { AdvancedChatMessage } from '../types/message.types.ts';
import type { ProcessingContext, ProcessingMetrics } from './types.ts';
import { FunctionCallingManager, type OpenAIToolCall } from '../function_calling/manager.ts';
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
  /** Normalize tool definitions and drop malformed ones */
  private normalizeTools(tools: any[]): Array<{ name: string; description?: string; parameters: any }> {
    const normalized: Array<{ name: string; description?: string; parameters: any }> = [];
    for (const t of tools || []) {
      const name = t?.name;
      const params = t?.parameters;
      if (typeof name === 'string' && params && typeof params === 'object') {
        normalized.push({ name, description: t?.description || '', parameters: params });
      } else {
        try { console.log('[DEBUG] Dropping malformed tool before OpenAI:', JSON.stringify(t)); } catch {}
      }
    }
    return normalized;
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
      const { data: agent } = await this.supabase
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
      // Memory handling guidance (episodic + semantic + conclusions/concepts)
      preamble.push(`=== MEMORY HANDLING INSTRUCTIONS ===\n` +
        `You have access to a CONTEXT WINDOW with EPISODIC and SEMANTIC MEMORY sections injected as assistant messages.\n\n` +
        `Use these rules to apply memory to the current user request:\n` +
        `1) EPISODIC MEMORY (events/examples):\n` +
        `   - Purpose: continuity, personalization, and recent task alignment.\n` +
        `   - Prioritize recency and direct relevance to the current query.\n` +
        `   - Do NOT restate full content; summarize only what is minimally necessary.\n` +
        `2) SEMANTIC MEMORY (facts/entities/conclusions/concepts):\n` +
        `   - Purpose: factual grounding and domain knowledge.\n` +
        `   - Prefer higher-confidence, multi-source items; prefer well-supported conclusions/concepts derived from 3–6 connected nodes/edges.\n` +
        `   - If conflicts exist, resolve by (a) higher confidence, (b) greater evidence, (c) more recent; if unresolved, note uncertainty briefly.\n` +
        `3) SAFETY & PRIVACY:\n` +
        `   - Never leak raw sensitive content. Summarize and reference sources (e.g., [source: message 2025-08-12]).\n` +
        `4) BREVITY & RELEVANCE:\n` +
        `   - Extract only memory that materially improves the answer. Be concise and avoid repetition.\n` +
        `=== END MEMORY HANDLING INSTRUCTIONS ===\n`);
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

    // CRITICAL INTEGRATION: Add reasoning context if available
    const reasoningContext = (message as any).context?.reasoning;
    if (reasoningContext && reasoningContext.enabled && reasoningContext.steps?.length > 0) {
      console.log(`[TextMessageHandler] Integrating reasoning chain with ${reasoningContext.steps.length} steps (style: ${reasoningContext.style})`);
      
      let reasoningPrompt = `=== ADVANCED REASONING ANALYSIS ===\n`;
      reasoningPrompt += `The user's query has been analyzed using ${reasoningContext.style?.toUpperCase() || 'ANALYTICAL'} reasoning.\n`;
      reasoningPrompt += `Analysis Confidence: ${(reasoningContext.score * 100).toFixed(1)}% (threshold: ${(reasoningContext.threshold * 100).toFixed(0)}%)\n\n`;
      
      reasoningPrompt += `REASONING CHAIN (${reasoningContext.steps.length} steps):\n`;
      reasoningContext.steps.forEach((step: any, index: number) => {
        const stepNum = index + 1;
        const state = step.state?.toUpperCase() || 'ANALYSIS';
        const confidence = step.confidence ? ` [${(step.confidence * 100).toFixed(0)}% confidence]` : '';
        
        if (step.question) {
          reasoningPrompt += `${stepNum}. [${state}] Question: ${step.question}${confidence}\n`;
        }
        if (step.hypothesis) {
          reasoningPrompt += `${stepNum}. [${state}] Analysis: ${step.hypothesis}${confidence}\n`;
        }
        if (step.description && !step.hypothesis && !step.question) {
          reasoningPrompt += `${stepNum}. [${state}] ${step.description}${confidence}\n`;
        }
        
        // Include memory insights if available
        if (step.memory_insights?.length > 0) {
          reasoningPrompt += `   → Memory Context: ${step.memory_insights.join(', ')}\n`;
        }
        
        // Include episodic/semantic memory counts
        if (step.episodic_count > 0 || step.semantic_count > 0) {
          reasoningPrompt += `   → Memories Referenced: ${step.episodic_count} episodic, ${step.semantic_count} semantic\n`;
        }
      });
      
      // Add reasoning conclusion
      const finalStep = reasoningContext.steps[reasoningContext.steps.length - 1];
      if (finalStep && (finalStep.state === 'conclude' || finalStep.type === 'decision')) {
        reasoningPrompt += `\nREASONING CONCLUSION:\n`;
        reasoningPrompt += `${finalStep.hypothesis || finalStep.description}\n`;
        if (finalStep.confidence) {
          reasoningPrompt += `Final Confidence: ${(finalStep.confidence * 100).toFixed(0)}%\n`;
        }
      }
      
      reasoningPrompt += `\nINSTRUCTIONS FOR RESPONSE:\n`;
      reasoningPrompt += `• Build upon the reasoning analysis above\n`;
      reasoningPrompt += `• Incorporate the insights and conclusions reached\n`;
      reasoningPrompt += `• Address any uncertainties identified in the analysis\n`;
      reasoningPrompt += `• Maintain appropriate confidence level based on the reasoning\n`;
      reasoningPrompt += `• Reference the reasoning process when it adds value to your response\n`;
      reasoningPrompt += `=== END REASONING ANALYSIS ===`;
      
      // Add as assistant message for immediate processing (ephemeral - not stored)
      msgs.push({ role: 'assistant', content: reasoningPrompt });
      
      console.log(`[TextMessageHandler] Added ephemeral reasoning context (${reasoningPrompt.length} chars) as assistant message - will not be stored`);
    } else if (reasoningContext) {
      console.log(`[TextMessageHandler] Reasoning context available but disabled or no steps (enabled: ${reasoningContext.enabled}, steps: ${reasoningContext.steps?.length || 0})`);
    } else {
      console.log(`[TextMessageHandler] No reasoning context available`);
    }

    // RAOR: Discover available tools (Gmail, Web Search, SendGrid in future)
    const authToken = (context as any)?.request_options?.auth?.token || '';
    console.log(`[FunctionCalling] Auth token available: ${!!authToken}`);
    const fcm = new FunctionCallingManager(this.supabase as any, authToken);
    const availableTools = (context.agent_id && context.user_id)
      ? await fcm.getAvailableTools(context.agent_id, context.user_id)
      : [];

    // Nudge awareness: briefly declare available tools and guidelines in a system message
    if (availableTools.length > 0) {
      const toolNames = availableTools.map(t => t.name).join(', ');
      const guidance = `Available tools for this agent: ${toolNames}.\nGuidelines: Use the appropriate tool based on the user's request. Each tool has a specific prefix (gmail_, smtp_, sendgrid_, mailgun_, web_search) indicating its provider. Use tools only when needed; otherwise answer directly.`;
      msgs.push({ role: 'system', content: guidance });
    }

    // First reasoning/act step (LLMRouter when enabled)
    // Guard for environments without Deno types
    const useRouter = (typeof (globalThis as any).Deno !== 'undefined')
      ? ((((globalThis as any).Deno.env.get('USE_LLM_ROUTER') || '').toLowerCase() === 'true'))
      : false;
    let completion: any;
    let router: any = null;
    let effectiveModel = 'gpt-4';
    if (useRouter && context.agent_id) {
      try {
        const mod = await import('../../shared/llm/router.ts');
        const LLMRouter = (mod as any).LLMRouter;
        router = LLMRouter ? new LLMRouter() : null;
      } catch (_) {
        router = null;
      }
      if (!router) {
        // Fallback to OpenAI if router unavailable
        effectiveModel = 'gpt-4';
        
        // Debug: Log tools array before sending to OpenAI
        const normalized = this.normalizeTools(availableTools);
        console.log('[DEBUG] Router fallback - Available tools before OpenAI (normalized):', JSON.stringify(normalized, null, 2));
        const formattedTools = normalized.map((fn) => ({ type: 'function', function: fn }));
        console.log('[DEBUG] Router fallback - Formatted tools for OpenAI:', JSON.stringify(formattedTools, null, 2));
        
        try {
          completion = await this.openai.chat.completions.create({
            model: 'gpt-4', messages: msgs, temperature: 0.7, max_tokens: 1200,
            tools: formattedTools, tool_choice: 'auto'
          });
        } catch (toolError: any) {
          // Handle tool validation errors gracefully
          if (toolError?.error?.param?.includes('tools') || toolError?.message?.includes('tools')) {
            console.warn('[TextMessageHandler] Router fallback tool validation failed, falling back to no-tools mode:', toolError.message);
            
            // Retry without tools
            completion = await this.openai.chat.completions.create({
              model: 'gpt-4', messages: msgs, temperature: 0.7, max_tokens: 1200
              // No tools parameter - graceful degradation
            });
            
            // Add a note about limited capabilities
            if (completion.choices?.[0]?.message?.content) {
              completion.choices[0].message.content += '\n\n*Note: Some advanced features are temporarily unavailable due to a technical issue.*';
            }
          } else {
            // Re-throw non-tool errors
            throw toolError;
          }
        }
      } else {
        const resolved = await router.resolveAgent(context.agent_id).catch(() => null);
        effectiveModel = resolved?.prefs?.model || effectiveModel;
        // Convert OpenAI format tools to LLMTool format for router
        const llmTools = availableTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }));
        const resp = await router.chat(context.agent_id, msgs as any, { tools: llmTools, temperature: 0.7, maxTokens: 1200 });
        const respToolCalls = (resp.toolCalls || []) as Array<{ id: string; name: string; arguments: string }>;
        completion = {
          choices: [{ message: { content: resp.text, tool_calls: respToolCalls.map((tc) => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } })) } }],
          usage: resp.usage ? { prompt_tokens: resp.usage.prompt, completion_tokens: resp.usage.completion, total_tokens: resp.usage.total } : undefined,
        };
      }
    } else {
      effectiveModel = 'gpt-4';
      
      // Debug: Log tools array before sending to OpenAI
      const normalized = this.normalizeTools(availableTools);
      console.log('[DEBUG] Available tools before OpenAI (normalized):', JSON.stringify(normalized, null, 2));
      const formattedTools = normalized.map((fn) => ({ type: 'function', function: fn }));
      console.log('[DEBUG] Formatted tools for OpenAI:', JSON.stringify(formattedTools, null, 2));
      
      try {
        completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: msgs,
          temperature: 0.7,
          max_tokens: 1200,
          tools: formattedTools,
          tool_choice: 'auto',
        });
      } catch (toolError: any) {
        // Handle tool validation errors gracefully
        if (toolError?.error?.param?.includes('tools') || toolError?.message?.includes('tools')) {
          console.warn('[TextMessageHandler] Tool validation failed, falling back to no-tools mode:', toolError.message);
          
          // Retry without tools
          completion = await this.openai.chat.completions.create({
            model: 'gpt-4',
            messages: msgs,
            temperature: 0.7,
            max_tokens: 1200,
            // No tools parameter - graceful degradation
          });
          
          // Add a note about limited capabilities
          if (completion.choices?.[0]?.message?.content) {
            completion.choices[0].message.content += '\n\n*Note: Some advanced features are temporarily unavailable due to a technical issue.*';
          }
        } else {
          // Re-throw non-tool errors
          throw toolError;
        }
      }
    }

    // Handle tool calls (Act → Observe → Reflect)
    const toolCalls = (completion.choices?.[0]?.message?.tool_calls || []) as OpenAIToolCall[];
    const toolDetails: any[] = [];
    const discoveredToolsForMetrics = availableTools.map(t => ({ name: t.name }));
    if (toolCalls.length > 0) {
      // Per OpenAI protocol, include the assistant message containing tool_calls before tool messages
      const typedToolCalls: Array<{ id: string; function: { name: string; arguments: string } }> = toolCalls as any;
      msgs.push({
        role: 'assistant',
        content: '',
        tool_calls: typedToolCalls.map((tc) => ({ id: tc.id, type: 'function', function: { name: tc.function.name, arguments: tc.function.arguments } })),
      } as any);
      for (const tc of typedToolCalls) {
        const started = Date.now();
        try {
          const args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
          const result = await fcm.executeFunction(context.agent_id || '', context.user_id || '', tc.function.name, args);
          
          // Check if this is an MCP tool that returned a clarifying question
          const isMCPQuestion = !result.success && 
            result.error && 
            (result.error.toLowerCase().includes('question:') || 
             result.error.toLowerCase().includes('what') ||
             result.error.toLowerCase().includes('please provide') ||
             result.error.toLowerCase().includes('missing'));
          
          toolDetails.push({
            name: tc.function.name,
            execution_time_ms: Date.now() - started,
            success: !!result.success,
            input_params: args,
            output_result: result.data || null,
            error: result.success ? undefined : result.error,
            requires_retry: isMCPQuestion
          });
          
          // Append tool observation
          msgs.push({
            role: 'tool',
            content: await fcm.formatResult(tc.function.name, result),
            tool_call_id: tc.id,
          } as any);
        } catch (err: any) {
          toolDetails.push({
            name: tc.function?.name,
            execution_time_ms: Date.now() - started,
            success: false,
            input_params: {},
            output_result: null,
            error: err?.message || 'Tool execution error',
          });
          msgs.push({
            role: 'tool',
            content: `Tool ${tc.function?.name} failed: ${err?.message || 'Unknown error'}`,
            tool_call_id: tc.id,
          } as any);
        }
      }
      // Check if any tools need retry (MCP interactive pattern)
      const toolsNeedingRetry = toolDetails.filter(td => td.requires_retry);
      let retryAttempts = 0;
      const MAX_RETRY_ATTEMPTS = 3;
      
      while (toolsNeedingRetry.length > 0 && retryAttempts < MAX_RETRY_ATTEMPTS) {
        retryAttempts++;
        console.log(`[TextMessageHandler] Retrying ${toolsNeedingRetry.length} MCP tools (attempt ${retryAttempts}/${MAX_RETRY_ATTEMPTS})`);
        
        // Add a system message to guide the retry
        msgs.push({
          role: 'system',
          content: `The previous tool call(s) need additional information. Please retry with the missing parameters based on the error messages. For document creation, include a 'text' or 'content' parameter with the document body.`
        } as any);
        
        // Get the model to retry with additional parameters
        let retryCompletion;
        if (router && useRouter && context.agent_id) {
          // Convert OpenAI format tools to LLMTool format for router
          const norm = this.normalizeTools(availableTools);
          const llmToolsRetry = norm.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }));
          const retryResp = await router.chat(context.agent_id, msgs as any, { 
            tools: llmToolsRetry, 
            tool_choice: 'auto',
            temperature: 0.7, 
            maxTokens: 1200 
          });
          retryCompletion = {
            choices: [{ message: retryResp }],
            usage: retryResp.usage ? { prompt_tokens: retryResp.usage.prompt, completion_tokens: retryResp.usage.completion, total_tokens: retryResp.usage.total } : undefined,
          };
        } else {
          retryCompletion = await this.openai.chat.completions.create({
            model: 'gpt-4',
            messages: msgs,
            temperature: 0.7,
            max_tokens: 1200,
            tools: this.normalizeTools(availableTools).map((fn) => ({ type: 'function', function: fn })),
            tool_choice: 'auto',
          });
        }
        
        // Process retry tool calls
        const retryToolCalls = (retryCompletion.choices?.[0]?.message?.tool_calls || []) as OpenAIToolCall[];
        
        if (retryToolCalls.length > 0) {
          // Clear the tools needing retry list
          toolsNeedingRetry.length = 0;
          
          // Add assistant message with retry tool calls
          msgs.push({
            role: 'assistant',
            content: '',
            tool_calls: retryToolCalls.map((tc: any) => ({ 
              id: tc.id, 
              type: 'function', 
              function: { name: tc.function.name, arguments: tc.function.arguments } 
            })),
          } as any);
          
          // Execute retry tool calls
          for (const tc of retryToolCalls) {
            const started = Date.now();
            try {
              const args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
              const result = await fcm.executeFunction(context.agent_id || '', context.user_id || '', tc.function.name, args);
              
              // Check if this still needs retry
              const stillNeedsRetry = !result.success && 
                result.error && 
                (result.error.toLowerCase().includes('question:') || 
                 result.error.toLowerCase().includes('what') ||
                 result.error.toLowerCase().includes('please provide') ||
                 result.error.toLowerCase().includes('missing'));
              
              if (stillNeedsRetry && retryAttempts < MAX_RETRY_ATTEMPTS) {
                toolsNeedingRetry.push({ name: tc.function.name, requires_retry: true });
              }
              
              toolDetails.push({
                name: tc.function.name,
                execution_time_ms: Date.now() - started,
                success: !!result.success,
                input_params: args,
                output_result: result.data || null,
                error: result.success ? undefined : result.error,
                retry_attempt: retryAttempts
              });
              
              msgs.push({
                role: 'tool',
                content: await fcm.formatResult(tc.function.name, result),
                tool_call_id: tc.id,
              } as any);
            } catch (err: any) {
              toolDetails.push({
                name: tc.function?.name,
                execution_time_ms: Date.now() - started,
                success: false,
                input_params: {},
                output_result: null,
                error: err?.message || 'Tool execution error',
                retry_attempt: retryAttempts
              });
              msgs.push({
                role: 'tool',
                content: `Tool ${tc.function?.name} failed: ${err?.message || 'Unknown error'}`,
                tool_call_id: tc.id,
              } as any);
            }
          }
        } else {
          // No retry tool calls generated, stop retrying
          break;
        }
      }
      
      // Reflect: ask model to produce final answer
      if (router && useRouter && context.agent_id) {
        const resp2 = await router.chat(context.agent_id, msgs as any, { temperature: 0.5, maxTokens: 1200 });
        completion = {
          choices: [{ message: { content: resp2.text } }],
          usage: resp2.usage ? { prompt_tokens: resp2.usage.prompt, completion_tokens: resp2.usage.completion, total_tokens: resp2.usage.total } : undefined,
        };
      } else {
        completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: msgs,
          temperature: 0.5,
          max_tokens: 1200,
        });
      }
    }

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
      metadata: { 
        model: effectiveModel, 
        tokens: { prompt: promptTokens, completion: completionTokens, total: tokensTotal }, 
        source: 'api' 
      },
      // Keep original context without reasoning (reasoning is ephemeral for this response only)
      context: {
        ...((message as any).context || {})
      }
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

    // BATCH GUARANTEE (gated): Every message gets enqueued for graph storage
    // ONLY if the agent's centralized graph is enabled.
    const convId = context.conversation_id || (message as any).conversation_id;
    console.log(`[TextMessageHandler] Starting graph ingestion check...`);
    console.log(`[TextMessageHandler] Conversation ID from context: ${context.conversation_id}`);
    console.log(`[TextMessageHandler] Conversation ID from message: ${(message as any).conversation_id}`);
    console.log(`[TextMessageHandler] Final conversation_id: ${convId}`);
    console.log(`[TextMessageHandler] Has memoryManager: ${!!this.memoryManager}`);
    
    try {
      if (convId && this.memoryManager) {
        console.log(`[TextMessageHandler] Processing conversation ${convId} for graph ingestion`);
        // Gate on agent setting
        let graphEnabled = false;
        try {
          const { data: a } = await (this.supabase as any)
            .from('agents')
            .select('metadata')
            .eq('id', context.agent_id)
            .maybeSingle();
          graphEnabled = ((a?.metadata?.settings || {}).use_account_graph === true);
          console.log(`[TextMessageHandler] Agent ${context.agent_id} graph enabled: ${graphEnabled}`);
        } catch (err) {
          console.error('[TextMessageHandler] Error checking agent settings:', err);
        }
        if (!graphEnabled) {
          console.log('[TextMessageHandler] Graph not enabled, skipping ingestion');
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
              model_used: effectiveModel,
              memory_searches: 0,
              tool_executions: toolDetails.length,
              tool_details: toolDetails,
              discovered_tools: discoveredToolsForMetrics,
              tool_requested: toolCalls.length > 0,
            },
          } as any;
        }
        // Always ingest the current exchange for immediate graph updates
        console.log(`[TextMessageHandler] Triggering ingestion for current message exchange`);
        if (true) { // Always ingest every message
          // Just ingest the current user message and assistant response
          const batchConvo: AdvancedChatMessage[] = [
            message,     // User message
            processed,   // Assistant response
          ] as any;

          await this.memoryManager.createFromConversation(batchConvo, true);
        }
      }
    } catch (ingestionError) {
      console.error('[TextMessageHandler] Graph ingestion error:', ingestionError);
      // best-effort: do not fail the response on batch ingestion errors
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
        model_used: effectiveModel,
        memory_searches: 0,
        tool_executions: toolDetails.length,
        tool_details: toolDetails,
        discovered_tools: discoveredToolsForMetrics,
        tool_requested: toolCalls.length > 0,
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


