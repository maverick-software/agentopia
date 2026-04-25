export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  required_scopes: string[];
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface MCPToolExecutionContext {
  agentId: string;
  userId: string;
  tool: string;
  parameters: Record<string, any>;
}
