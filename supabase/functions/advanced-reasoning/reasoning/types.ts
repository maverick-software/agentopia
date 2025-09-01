// Core reasoning types for the MCP advanced reasoning system

export type ReasoningState = 'analyze' | 'hypothesize' | 'test' | 'observe' | 'update' | 'conclude';

export type ReasoningStyle = 'inductive' | 'deductive' | 'abductive' | 'analogical' | 'causal' | 'probabilistic';

export interface ReasoningStep {
  step: number;
  style: ReasoningStyle;
  state: ReasoningState;
  question: string;
  hypothesis?: string;
  action?: any;
  observation?: any;
  conclusion?: string;
  confidence: number;
  time_ms: number;
  memories_used?: MemoryContext;
  memory_insights?: string[];
}

export interface MemoryContext {
  episodic: Array<{
    id: string;
    content: any;
    relevance_score?: number;
    created_at: string;
    importance?: number;
  }>;
  semantic: Array<{
    id?: string;
    content: any;
    relevance_score?: number;
    source?: string;
  }>;
}

export interface ReasoningDecision {
  score: number;
  reason: string;
}

export interface ComplexityAnalysis {
  score: number;
  factors: {
    length: number;
    questionWords: number;
    contextDensity: number;
    reasoningKeywords: number;
  };
  recommendedStyle: ReasoningStyle;
  reasoning: string;
}

export interface ReasoningResult {
  success: boolean;
  reasoning_type: ReasoningStyle;
  confidence: number;
  conclusion: string;
  steps: ReasoningStep[];
  insights: string[];
  processing_time_ms: number;
  tokens_used: number;
}

export interface InductiveReasoningInput {
  observations: string[];
  context?: string;
  confidenceThreshold?: number;
}

export interface DeductiveReasoningInput {
  premises: string[];
  rules?: string[];
  context?: string;
}

export interface AbductiveReasoningInput {
  observations: string[];
  anomalies?: string[];
  context?: string;
}

export interface ReasoningEngine {
  reason(input: any): Promise<ReasoningResult>;
}

// Configuration interfaces
export interface ReasoningConfig {
  enabled: boolean;
  threshold: number;
  max_iterations: number;
  confidence_threshold: number;
  preferred_styles: ReasoningStyle[];
  timeout_ms: number;
  safety_switch_enabled: boolean;
}

export interface AgentReasoningSettings {
  reasoning_config: ReasoningConfig;
}

// Database interfaces
export interface ReasoningSessionRecord {
  id: string;
  agent_id: string;
  user_id: string;
  conversation_id?: string;
  query: string;
  reasoning_type: ReasoningStyle;
  iterations: number;
  max_iterations: number;
  initial_confidence: number;
  final_confidence?: number;
  confidence_threshold: number;
  conclusion?: string;
  insights: any[];
  memory_connections: any;
  started_at: string;
  completed_at?: string;
  forced_stop: boolean;
  stop_reason?: 'confidence_reached' | 'max_iterations' | 'forced_stop' | 'error' | 'timeout';
  total_tokens_used: number;
  total_processing_time_ms: number;
  created_at: string;
  updated_at: string;
}

export interface ReasoningStepRecord {
  id: string;
  session_id: string;
  step_number: number;
  reasoning_state: ReasoningState;
  question: string;
  hypothesis?: string;
  action?: any;
  observation?: any;
  conclusion?: string;
  confidence: number;
  processing_time_ms: number;
  tokens_used: number;
  memories_used: any;
  memory_insights: string[];
  episodic_count: number;
  semantic_count: number;
  facts_considered: string[];
  tools_available: string[];
  created_at: string;
}

// Tool integration types
export interface MCPReasoningTool {
  name: string;
  description: string;
  parameters: any;
  execute: (params: any) => Promise<any>;
}

export interface ReasoningToolContext {
  sessionId: string;
  agentId: string;
  userId: string;
  supabase: any;
  memoryManager?: any;
}

// Error types
export class ReasoningError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ReasoningError';
  }
}

export class ReasoningTimeoutError extends ReasoningError {
  constructor(timeoutMs: number) {
    super(`Reasoning timed out after ${timeoutMs}ms`, 'REASONING_TIMEOUT');
  }
}

export class ReasoningValidationError extends ReasoningError {
  constructor(message: string, details?: any) {
    super(message, 'REASONING_VALIDATION', details);
  }
}

// Utility types
export type StopReason = 'confidence_reached' | 'max_iterations' | 'forced_stop' | 'error' | 'timeout' | 'natural_conclusion';

export interface ReasoningMetrics {
  total_sessions: number;
  avg_iterations: number;
  avg_confidence: number;
  success_rate: number;
  avg_processing_time: number;
  style_distribution: Record<ReasoningStyle, number>;
  stop_reason_distribution: Record<StopReason, number>;
}

// Export utility functions
export function isValidReasoningStyle(style: string): style is ReasoningStyle {
  return ['inductive', 'deductive', 'abductive', 'analogical', 'causal', 'probabilistic'].includes(style);
}

export function isValidReasoningState(state: string): state is ReasoningState {
  return ['analyze', 'hypothesize', 'test', 'observe', 'update', 'conclude'].includes(state);
}

export function createReasoningStep(
  step: number,
  style: ReasoningStyle,
  state: ReasoningState,
  question: string,
  confidence: number = 0.5
): ReasoningStep {
  return {
    step,
    style,
    state,
    question,
    confidence,
    time_ms: 0
  };
}

export function calculateConfidenceChange(steps: ReasoningStep[]): number {
  if (steps.length < 2) return 0;
  return steps[steps.length - 1].confidence - steps[0].confidence;
}

export function extractReasoningPattern(steps: ReasoningStep[]): string {
  return steps.map(s => s.state).join(' → ');
}
