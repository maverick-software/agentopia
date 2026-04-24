import type { RuntimeContext, ToolCallLike, ToolResultLike } from './types.ts';

export interface RuntimeHookResult {
  block?: boolean;
  reason?: string;
  params?: Record<string, any>;
}

export interface RuntimeHooks {
  beforePromptBuild?: (context: RuntimeContext, messages: any[]) => Promise<void> | void;
  beforeToolCall?: (context: RuntimeContext, tool: ToolCallLike) => Promise<RuntimeHookResult | void> | RuntimeHookResult | void;
  afterToolCall?: (context: RuntimeContext, tool: ToolCallLike, result: ToolResultLike) => Promise<void> | void;
  agentEnd?: (context: RuntimeContext, metadata: Record<string, any>) => Promise<void> | void;
}

export async function runBeforePromptBuild(
  hooks: RuntimeHooks | undefined,
  context: RuntimeContext,
  messages: any[]
): Promise<void> {
  await hooks?.beforePromptBuild?.(context, messages);
}

export async function runBeforeToolCall(
  hooks: RuntimeHooks | undefined,
  context: RuntimeContext,
  tool: ToolCallLike
): Promise<RuntimeHookResult> {
  const result = await hooks?.beforeToolCall?.(context, tool);
  return result || {};
}

export async function runAfterToolCall(
  hooks: RuntimeHooks | undefined,
  context: RuntimeContext,
  tool: ToolCallLike,
  result: ToolResultLike
): Promise<void> {
  await hooks?.afterToolCall?.(context, tool, result);
}
