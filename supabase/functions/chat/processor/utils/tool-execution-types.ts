/**
 * Tool Execution Types and Interfaces
 * Core types for tool execution system
 */

export interface ToolExecutionResult {
  toolDetails: ToolDetail[];
  msgs: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: any[] }>;
  tokensUsed: { prompt: number; completion: number; total: number };
}

export interface ToolDetail {
  name: string;
  execution_time_ms: number;
  success: boolean;
  input_params: Record<string, any>;
  output_result: any;
  error?: string;
  requires_retry?: boolean;
  retry_attempt?: number;
  retry_error?: string;
  retry_method?: string;
}

export interface ToolExecutionContext {
  agent_id?: string;
  user_id?: string;
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ExecutionEnvironment {
  openai: any;
  router: any;
  useRouter: boolean;
  normalizeToolsFn: (tools: any[]) => any[];
  availableTools: any[];
}
