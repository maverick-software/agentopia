import { STRICT_AGENTIC_BLOCKED_TEXT } from './execution-contract.ts';
import type { RetryMode } from './types.ts';

export const RETRY_STEERING: Record<RetryMode, string> = {
  planning_only:
    'The previous assistant turn only described the plan. Do not restate the plan. Act now: take the first concrete tool action you can. If a real blocker prevents action, reply with the exact blocker in one sentence.',
  reasoning_only:
    'The previous assistant turn recorded reasoning but did not produce a user-visible answer. Continue from that partial turn and produce the visible answer now. Do not restate the reasoning or restart from scratch.',
  empty_response:
    'The previous attempt did not produce a user-visible answer. Continue from the current state and produce the visible answer now. Do not restart from scratch.',
  incomplete_tool_use:
    'The previous attempt stopped during tool use without a user-visible final answer. Continue from the current state and produce the visible answer now. Do not rerun side-effecting actions unless explicitly required and safe.',
};

export function getSteeringInstruction(mode: RetryMode): string {
  return RETRY_STEERING[mode];
}

export function getBlockedText(): string {
  return STRICT_AGENTIC_BLOCKED_TEXT;
}
