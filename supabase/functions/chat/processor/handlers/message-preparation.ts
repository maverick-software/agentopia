/**
 * Message Preparation - Prepares messages array with system prompts, context, and history
 */

import type { AdvancedChatMessage } from '../../types/message.types.ts';
import type { ProcessingContext } from '../types.ts';
import { PromptBuilder } from '../utils/prompt-builder.ts';
import { WorkingMemoryManager } from '../../core/context/working_memory_manager.ts';

export interface PreparedMessages {
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: any[] }>;
  recentMessages: Array<{ role: string; content: string }>;
  summaryInfo: any | null;
}

export class MessagePreparation {
  private promptBuilder: PromptBuilder;

  constructor(private supabase: any) {
    this.promptBuilder = new PromptBuilder(supabase);
  }

  /**
   * Prepare messages array with system prompt, context window, working memory, and history
   */
  async prepare(message: AdvancedChatMessage, context: ProcessingContext): Promise<PreparedMessages> {
    const msgs: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: any[] }> = [];
    let recentMessages: Array<{ role: string; content: string }> = [];
    let summaryInfo: any = null;

    // Add agent system prompt
    if (context.agent_id) {
      const { data: agent } = await this.supabase
        .from('agents')
        .select('system_instructions, assistant_instructions, description, personality, name')
        .eq('id', context.agent_id)
        .single();

      // Build comprehensive system prompt using PromptBuilder
      let systemPrompt = this.promptBuilder.buildSystemPromptString(agent);

      // Append system_prompt_override from sessionContext (for temporary chats)
      const sessionContext = (message as any)?.context?.sessionContext || (context as any)?.sessionContext;
      if (sessionContext?.system_prompt_override) {
        console.log('[MessagePreparation] Appending system_prompt_override from sessionContext');
        systemPrompt = systemPrompt
          ? `${systemPrompt}\n\n=== TEMPORARY CHAT INSTRUCTIONS ===\n${sessionContext.system_prompt_override}\n=== END TEMPORARY CHAT INSTRUCTIONS ===`
          : sessionContext.system_prompt_override;
      }

      // Add chat_intent context if present
      if (sessionContext?.chat_intent) {
        console.log('[MessagePreparation] Adding chat_intent context from sessionContext');
        const intentContext = `\n\n=== CHAT PURPOSE ===\nThis temporary chat session has a specific purpose: ${sessionContext.chat_intent}\nFocus your responses on gathering information related to this purpose.\n=== END CHAT PURPOSE ===`;
        systemPrompt = systemPrompt ? `${systemPrompt}${intentContext}` : intentContext;
      }

      if (systemPrompt) {
        msgs.push({ role: 'system', content: systemPrompt });
      }

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

    // WORKING MEMORY INTEGRATION: Use summaries instead of raw message history
    const conversationId = context.conversation_id || (message as any).conversation_id;

    if (conversationId && context.agent_id) {
      try {
        const workingMemory = new WorkingMemoryManager(this.supabase as any);
        const memoryContext = await workingMemory.getWorkingContext(
          conversationId,
          context.agent_id,
          false // Don't include chunks yet - just summary board
        );

        if (memoryContext && memoryContext.summary) {
          // Format working memory as assistant message for better LLM comprehension
          const workingMemoryBlock = workingMemory.formatContextForLLM(memoryContext);
          msgs.push({ role: 'assistant', content: workingMemoryBlock });

          console.log(`[MessagePreparation] ✅ Added working memory context (${memoryContext.facts.length} facts, ${memoryContext.metadata.message_count} messages summarized)`);
          console.log(`[MessagePreparation] 📊 Token savings: ~${memoryContext.metadata.message_count * 100} tokens saved vs raw history`);

          // Store summary info for metrics
          summaryInfo = {
            summary: memoryContext.summary,
            facts_count: memoryContext.facts.length,
            action_items_count: memoryContext.action_items.length,
            pending_questions_count: memoryContext.pending_questions.length,
            message_count: memoryContext.metadata.message_count,
            last_updated: memoryContext.metadata.last_updated,
          };

          // HYBRID APPROACH: Always include last 5 messages for immediate context
          // This ensures the LLM has both the strategic summary AND tactical recent context
          const { data: recentMessagesData } = await this.supabase
            .from('messages')
            .select('role, content')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(5);

          if (recentMessagesData && recentMessagesData.length > 0) {
            // Reverse to chronological order
            recentMessages = recentMessagesData.reverse();

            // Add to messages array
            for (const msg of recentMessages) {
              msgs.push({
                role: msg.role as 'system' | 'user' | 'assistant' | 'tool',
                content: msg.content || '',
              });
            }

            console.log(`[MessagePreparation] ✅ Added ${recentMessages.length} recent messages for immediate context`);
          }
        }
      } catch (wmError: any) {
        console.error('[MessagePreparation] ⚠️ Working Memory error (non-critical):', wmError.message);
        // Fallback to traditional message loading on error
        const { data: fallbackMessages } = await this.supabase
          .from('messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (fallbackMessages && fallbackMessages.length > 0) {
          recentMessages = fallbackMessages.reverse();
          for (const msg of recentMessages) {
            msgs.push({
              role: msg.role as 'system' | 'user' | 'assistant' | 'tool',
              content: msg.content || '',
            });
          }
          console.log(`[MessagePreparation] ✅ Loaded ${fallbackMessages.length} messages (fallback mode)`);
        }
      }
    }

    // Add current user message
    const userText = (message as any).content?.text || (message as any).content || '';
    msgs.push({ role: 'user', content: userText });

    return {
      messages: msgs,
      recentMessages,
      summaryInfo,
    };
  }
}

