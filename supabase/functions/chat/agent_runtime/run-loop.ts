import { buildExecutionContractPrompt, getRetryBudgets, resolveExecutionContract } from './execution-contract.ts';
import { classifyIncompleteTurn } from './incomplete-turn.ts';
import { resolveLivenessState } from './liveness.ts';
import { buildReplayMetadata } from './replay-safety.ts';
import type {
  AttemptSnapshot,
  RetryCounters,
  RetryMode,
  RuntimeContext,
  ToolResultLike,
} from './types.ts';

export interface RuntimeState {
  contract: ReturnType<typeof resolveExecutionContract>;
  counters: RetryCounters;
  runStateId?: string;
}

export interface RuntimeAttemptResult {
  shouldRetry: boolean;
  steeringInstruction?: string;
  terminalMessage?: string;
  liveness: ReturnType<typeof resolveLivenessState>;
  mode?: RetryMode;
  reason: string;
}

export function createRuntimeState(context: RuntimeContext): RuntimeState {
  return {
    contract: resolveExecutionContract(context),
    counters: {
      planningOnly: 0,
      reasoningOnly: 0,
      emptyResponse: 0,
      incompleteToolUse: 0,
    },
  };
}

export function appendExecutionContract(messages: any[], state: RuntimeState): void {
  messages.push({
    role: 'system',
    content: buildExecutionContractPrompt(state.contract),
  });
}

export function evaluateAttempt(
  context: RuntimeContext,
  state: RuntimeState,
  attempt: AttemptSnapshot
): RuntimeAttemptResult {
  const replayMetadata = attempt.replayMetadata || buildReplayMetadata(attempt.toolResults as ToolResultLike[]);
  const classification = classifyIncompleteTurn(
    { ...attempt, replayMetadata },
    state.counters,
    getRetryBudgets(state.contract)
  );
  const liveness = resolveLivenessState({ ...attempt, replayMetadata }, classification);

  if (classification.retryable && classification.mode) {
    incrementCounter(state.counters, classification.mode);
  }

  return {
    shouldRetry: classification.retryable,
    steeringInstruction: classification.steeringInstruction,
    terminalMessage: classification.terminalMessage,
    liveness,
    mode: classification.mode,
    reason: classification.reason,
  };
}

export async function upsertRunState(
  supabase: any,
  context: RuntimeContext,
  state: RuntimeState
): Promise<string | undefined> {
  if (!context.userId || !context.agentId || !context.conversationId || !context.sessionId) return undefined;

  const { data, error } = await supabase
    .from('agent_run_states')
    .upsert({
      user_id: context.userId,
      agent_id: context.agentId,
      conversation_id: context.conversationId,
      session_id: context.sessionId,
      workspace_id: context.workspaceId,
      execution_contract: state.contract,
      retry_budgets: getRetryBudgets(state.contract),
      last_activity_at: new Date().toISOString(),
    }, { onConflict: 'session_id' })
    .select('id')
    .single();

  if (error) {
    console.warn('[AgentRuntime] Failed to upsert run state:', error);
    return undefined;
  }

  state.runStateId = data?.id;
  return state.runStateId;
}

export async function recordAttempt(
  supabase: any,
  context: RuntimeContext,
  state: RuntimeState,
  attemptNumber: number,
  attempt: AttemptSnapshot,
  evaluation: RuntimeAttemptResult
): Promise<void> {
  if (!state.runStateId || !context.userId || !context.agentId || !context.conversationId || !context.sessionId) return;

  const replayMetadata = attempt.replayMetadata || buildReplayMetadata(attempt.toolResults as ToolResultLike[]);
  const { data, error } = await supabase
    .from('agent_run_attempts')
    .insert({
      run_state_id: state.runStateId,
      attempt_number: attemptNumber,
      retry_mode: evaluation.mode,
      steering_instruction: evaluation.steeringInstruction,
      assistant_text: attempt.assistantText,
      stop_reason: attempt.stopReason,
      tool_calls: attempt.toolCalls || [],
      tool_results: attempt.toolResults || [],
      replay_metadata: replayMetadata,
      classification: {
        shouldRetry: evaluation.shouldRetry,
        reason: evaluation.reason,
        liveness: evaluation.liveness,
      },
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[AgentRuntime] Failed to record attempt:', error);
    return;
  }

  await supabase.from('agent_replay_metadata').insert({
    run_state_id: state.runStateId,
    attempt_id: data?.id,
    user_id: context.userId,
    agent_id: context.agentId,
    conversation_id: context.conversationId,
    session_id: context.sessionId,
    had_potential_side_effects: replayMetadata.hadPotentialSideEffects,
    replay_safe: replayMetadata.replaySafe,
    mutating_tools: replayMetadata.mutatingTools,
    message_sent: replayMetadata.messageSent,
    cron_changed: replayMetadata.cronChanged,
    details: replayMetadata.details || {},
  }).then(({ error: replayError }: any) => {
    if (replayError) console.warn('[AgentRuntime] Failed to record replay metadata:', replayError);
  });
}

function incrementCounter(counters: RetryCounters, mode: RetryMode): void {
  if (mode === 'planning_only') counters.planningOnly += 1;
  if (mode === 'reasoning_only') counters.reasoningOnly += 1;
  if (mode === 'empty_response') counters.emptyResponse += 1;
  if (mode === 'incomplete_tool_use') counters.incompleteToolUse += 1;
}
