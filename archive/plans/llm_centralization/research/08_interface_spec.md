# Interface Spec — Centralized LLM Layer

Core message/types
```ts
export type LLMRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LLMMessage {
  role: LLMRole;
  content: string;
  tool_call_id?: string;
}

export interface LLMTool {
  name: string;
  description: string;
  parameters: any; // JSON Schema
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

export interface LLMUsage { prompt: number; completion: number; total: number }

export interface LLMChatOptions {
  tools?: LLMTool[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  model?: string; // override
}

export interface LLMChatResponse {
  text?: string;
  toolCalls?: LLMToolCall[];
  usage?: LLMUsage;
}
```

Provider adapter
```ts
export interface LLMProvider {
  chat(messages: LLMMessage[], options: LLMChatOptions): Promise<LLMChatResponse>;
  stream?(messages: LLMMessage[], options: LLMChatOptions): ReadableStream<Uint8Array>;
  embed(inputs: string[], modelHint?: string): Promise<number[][]>;
  countTokens?(messages: LLMMessage[], model?: string): Promise<number>;
  modelInfo(model: string): { maxContext: number; supportsTools: boolean; };
}
```

Router
```ts
export interface AgentLLMPreferences {
  provider: string; // 'openai' | 'anthropic' | 'google' | 'mistral' | 'groq' | 'openrouter'
  model: string;
  params?: Record<string, any>;
  embedding_model?: string;
}

export interface LLMRouterConfig { defaultProvider: string; defaultModel: string; }

export interface LLMRouter {
  resolveAgent(agentId: string): Promise<{ provider: LLMProvider; prefs: AgentLLMPreferences }>;
  chat(agentId: string, messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMChatResponse>;
  stream?(agentId: string, messages: LLMMessage[], options?: LLMChatOptions): ReadableStream<Uint8Array>;
  embed(agentId: string, inputs: string[], modelHint?: string): Promise<number[][]>;
}
```

Token budgeting
```ts
export interface TokenBudgetManager {
  estimate(messages: LLMMessage[], model: string): Promise<number>;
  fit(messages: LLMMessage[], model: string, desiredOutputTokens: number): Promise<{
    messages: LLMMessage[];
    plannedOutputTokens: number;
    overflowSummaries?: string[];
  }>;
}
```

Tool adapter
```ts
export interface ToolAdapter {
  toProviderTools(tools: LLMTool[], providerName: string): any[]; // provider-specific
  fromProviderToolCalls(raw: any, providerName: string): LLMToolCall[];
}
```

Prompt builder
```ts
export interface PromptBuilder {
  buildSystem(agentIdentity: { name: string; description?: string; personality?: string }, instructions?: string): string;
  buildMessages(system: string, userText: string, history: LLMMessage[], guidance?: string): LLMMessage[];
}
```

Notes
- All adapters must be pure and side‑effect free.
- Errors normalized to a common shape with provider + request_id for observability.
