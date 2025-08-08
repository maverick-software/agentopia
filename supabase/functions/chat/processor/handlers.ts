import type { AdvancedChatMessage } from '../types/message.types.ts';
import type { ProcessingContext, ProcessingMetrics } from './MessageProcessor.ts';

export interface MessageHandler {
  canHandle(message: AdvancedChatMessage): boolean;
  handle(message: AdvancedChatMessage, context: ProcessingContext): Promise<{
    message: AdvancedChatMessage;
    context: ProcessingContext;
    metrics: ProcessingMetrics;
  }>;
}

export class TextMessageHandler implements MessageHandler {
  constructor(private openai: any, private supabase: any) {}
  canHandle(message: AdvancedChatMessage): boolean {
    return (message as any).content?.type === 'text';
  }
  async handle(message: AdvancedChatMessage, context: ProcessingContext) {
    const startTime = Date.now();
    const msgs: Array<{ role: 'system'|'user'|'assistant'|'tool'; content: string }> = [];
    if (context.agent_id) {
      const { data: agent } = await this.supabase
        .from('agents')
        .select('instructions, assistant_instructions, identity, personality, name')
        .eq('id', context.agent_id)
        .single();
      const preamble: string[] = [];
      if (agent?.name) preamble.push(`Your name is "${agent.name}".`);
      if (agent?.identity) preamble.push(`Identity: ${agent.identity}`);
      if (agent?.personality) preamble.push(`Personality: ${agent.personality}. Maintain this persona consistently.`);
      if (agent?.instructions) preamble.push(`System Instructions: ${agent.instructions}`);
      // Output formatting guidance
      preamble.push(
        'When responding to the user, format the final answer using Markdown. Use concise paragraphs, numbered or bulleted lists for steps, tables when helpful, and bold for key facts. Avoid meta commentary.'
      );
      if (preamble.length) msgs.push({ role: 'system', content: preamble.join('\n') });
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
    const text = completion.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
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


