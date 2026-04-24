import type { RuntimeContext, RuntimeEvent } from './types.ts';

export class AgentRuntimeEventBus {
  constructor(private supabase: any, private context: RuntimeContext, private runStateId?: string) {}

  withRunState(runStateId?: string): AgentRuntimeEventBus {
    return new AgentRuntimeEventBus(this.supabase, this.context, runStateId || this.runStateId);
  }

  async emit(event: RuntimeEvent): Promise<void> {
    if (!this.context.userId || !this.context.agentId || !this.context.conversationId || !this.context.sessionId) {
      return;
    }

    const row = {
      run_state_id: this.runStateId,
      user_id: this.context.userId,
      agent_id: this.context.agentId,
      conversation_id: this.context.conversationId,
      session_id: this.context.sessionId,
      stream: event.stream,
      event_type: event.eventType,
      payload: event.payload,
    };

    const { error } = await this.supabase.from('agent_run_events').insert(row);
    if (error) {
      console.warn('[AgentRuntimeEventBus] Failed to emit event:', error);
    }
  }

  static toSse(event: RuntimeEvent): string {
    return `event: ${event.stream}\ndata: ${JSON.stringify({
      type: event.eventType,
      payload: event.payload,
    })}\n\n`;
  }
}
