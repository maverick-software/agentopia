import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { resolveExecutionContract, getRetryBudgets } from './execution-contract.ts';
import { classifyIncompleteTurn } from './incomplete-turn.ts';
import { buildReplayMetadata } from './replay-safety.ts';
import { validateUpdatePlanArgs } from './update-plan-tool.ts';

Deno.test('strict execution contract resolves from options', () => {
  const contract = resolveExecutionContract({
    requestId: 'req',
    options: { agent_runtime: { enabled: true } },
  });
  assertEquals(contract, 'strict-agentic');
  assertEquals(getRetryBudgets(contract).planningOnly, 2);
});

Deno.test('planning-only text is retryable when budget remains', () => {
  const result = classifyIncompleteTurn(
    { assistantText: 'Here is the plan:\n1. Search\n2. Update\nI will start next.' },
    { planningOnly: 0, reasoningOnly: 0, emptyResponse: 0, incompleteToolUse: 0 },
    { planningOnly: 1, reasoningOnly: 1, emptyResponse: 1, incompleteToolUse: 1 }
  );
  assertEquals(result.retryable, true);
  assertEquals(result.mode, 'planning_only');
});

Deno.test('empty response becomes terminal when budget is exhausted', () => {
  const result = classifyIncompleteTurn(
    { assistantText: '' },
    { planningOnly: 0, reasoningOnly: 0, emptyResponse: 1, incompleteToolUse: 0 },
    { planningOnly: 1, reasoningOnly: 1, emptyResponse: 1, incompleteToolUse: 1 }
  );
  assertEquals(result.retryable, false);
  assertEquals(result.mode, 'empty_response');
});

Deno.test('side-effecting tool results are not replay safe', () => {
  const replay = buildReplayMetadata([
    { name: 'smtp_send_email', success: true, input_params: {}, output_result: {} },
  ]);
  assertEquals(replay.hadPotentialSideEffects, true);
  assertEquals(replay.replaySafe, false);
});

Deno.test('update_plan rejects more than one in-progress step', () => {
  let message = '';
  try {
    validateUpdatePlanArgs({
      plan: [
        { step: 'One', status: 'in_progress' },
        { step: 'Two', status: 'in_progress' },
      ],
    });
  } catch (error: any) {
    message = error.message;
  }
  assertEquals(message, 'Only one plan step may be in_progress.');
});
