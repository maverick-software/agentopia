import type { ExecutionContract, RetryBudgets, RuntimeContext } from './types.ts';

export const STRICT_AGENTIC_BLOCKED_TEXT =
  'Agent stopped after repeated incomplete turns without taking a concrete action. No concrete tool action or verified deliverable advanced the task.';

const DEFAULT_BUDGETS: RetryBudgets = {
  planningOnly: 1,
  reasoningOnly: 2,
  emptyResponse: 1,
  incompleteToolUse: 1,
};

const STRICT_BUDGETS: RetryBudgets = {
  planningOnly: 2,
  reasoningOnly: 2,
  emptyResponse: 1,
  incompleteToolUse: 1,
};

export function resolveExecutionContract(context: RuntimeContext): ExecutionContract {
  const configured = context.options?.agent_runtime?.execution_contract;
  if (configured === 'default' || configured === 'strict-agentic') {
    return configured;
  }

  const enabled = context.options?.agent_runtime?.enabled === true ||
    context.options?.agent_runtime?.strict_agentic === true;
  if (enabled) return 'strict-agentic';

  const model = String(context.modelId || '').toLowerCase();
  const provider = String(context.provider || '').toLowerCase();
  const strictModel = model.includes('gpt-5') || model.includes('codex');
  const strictProvider = !provider || ['openai', 'openai-codex', 'mock-openai'].includes(provider);
  return strictModel && strictProvider ? 'strict-agentic' : 'default';
}

export function getRetryBudgets(contract: ExecutionContract): RetryBudgets {
  return contract === 'strict-agentic' ? { ...STRICT_BUDGETS } : { ...DEFAULT_BUDGETS };
}

export function buildExecutionContractPrompt(contract: ExecutionContract): string {
  const strictLine = contract === 'strict-agentic'
    ? 'You are running under strict-agentic mode: plan-only, reasoning-only, and empty turns will be retried or surfaced as explicit blocked states.'
    : 'You are running under default agentic mode: complete the user-visible task when possible and name blockers explicitly.';

  return [
    '## Execution Contract',
    strictLine,
    'You are an execution-oriented operator, not just a responder: own tasks until they are done, verified, or concretely blocked.',
    'Do not confuse a plan, hypothesis, or partial fix with completion.',
    'A task is complete only when the requested deliverable exists, the result is verified when appropriate, unresolved blockers are named explicitly if any remain, and the user receives a clear final status.',
    'For multi-step work, continue until the task is complete and verified, you are concretely blocked, or the user redirects/stops you.',
    'Do not stop at the first plausible answer if more work is obviously required.',
    '',
    '## Verification',
    'When tools are used, ground the final answer in the tool results. If a tool failed, say what failed and what is needed next.',
    '',
    '## Blockers',
    'If blocked, state the exact blocker in one concise sentence and do not pretend the task completed.',
  ].join('\n');
}
