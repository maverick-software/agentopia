export type ExecutionContract = 'default' | 'strict-agentic';

export type RetryMode =
  | 'planning_only'
  | 'reasoning_only'
  | 'empty_response'
  | 'incomplete_tool_use';

export type LivenessState = 'working' | 'paused' | 'blocked' | 'abandoned';

export type RuntimeStream =
  | 'lifecycle'
  | 'assistant'
  | 'tool'
  | 'plan'
  | 'approval'
  | 'checkpoint'
  | 'memory'
  | 'compaction';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'timeout' | 'cancelled';

export interface RuntimeContext {
  requestId: string;
  agentId?: string;
  userId?: string;
  conversationId?: string;
  sessionId?: string;
  workspaceId?: string;
  modelId?: string;
  provider?: string;
  options?: Record<string, any>;
}

export interface RetryBudgets {
  planningOnly: number;
  reasoningOnly: number;
  emptyResponse: number;
  incompleteToolUse: number;
}

export interface RetryCounters {
  planningOnly: number;
  reasoningOnly: number;
  emptyResponse: number;
  incompleteToolUse: number;
}

export interface ToolCallLike {
  id?: string;
  name?: string;
  function?: {
    name?: string;
    arguments?: string | Record<string, any>;
  };
  arguments?: Record<string, any>;
}

export interface ToolResultLike {
  name: string;
  success: boolean;
  input_params?: Record<string, any>;
  output_result?: any;
  error?: string;
  requires_retry?: boolean;
}

export interface ReplayMetadata {
  hadPotentialSideEffects: boolean;
  replaySafe: boolean;
  mutatingTools: string[];
  messageSent: boolean;
  cronChanged: boolean;
  details?: Record<string, any>;
}

export interface AttemptSnapshot {
  assistantText?: string;
  toolCalls?: ToolCallLike[];
  toolResults?: ToolResultLike[];
  stopReason?: string;
  aborted?: boolean;
  timedOut?: boolean;
  approvalPending?: boolean;
  delegated?: boolean;
  lastToolErrored?: boolean;
  replayMetadata?: ReplayMetadata;
}

export interface IncompleteTurnClassification {
  complete: boolean;
  retryable: boolean;
  mode?: RetryMode;
  reason: string;
  steeringInstruction?: string;
  terminalMessage?: string;
}

export interface RuntimeEvent {
  stream: RuntimeStream;
  eventType: string;
  payload: Record<string, any>;
}

export interface PlanStepStatus {
  step: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface UpdatePlanArgs {
  explanation?: string;
  plan: PlanStepStatus[];
}
