/**
 * Tool Execution Types and Interfaces
 * Core types for tool execution system
 */

export interface ToolExecutionResult {
  toolDetails: ToolDetail[];
  msgs: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: any[] }>;
  tokensUsed: { prompt: number; completion: number; total: number };
  requiresLLMRetry?: boolean; // MCP protocol: signals that LLM should make new tool calls
  retryGuidanceAdded?: boolean; // Indicates MCP retry guidance was added to conversation
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
  requires_user_input?: boolean;
  user_input_request?: any;
  runtime?: {
    had_potential_side_effects?: boolean;
    replay_safe?: boolean;
    risk_level?: 'low' | 'medium' | 'high' | 'critical';
    approval_id?: string;
  };
}

export interface ToolExecutionContext {
  agent_id?: string;
  user_id?: string;
  conversation_id?: string;
  session_id?: string;
  workspace_id?: string;
  originalUserMessage?: string; // User's original request for parameter inference
  availableTools?: any[]; // Available tools for looking up descriptions
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
