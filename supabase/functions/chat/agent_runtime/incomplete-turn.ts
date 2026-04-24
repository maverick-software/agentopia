import { getBlockedText, getSteeringInstruction } from './retry-steering.ts';
import type {
  AttemptSnapshot,
  IncompleteTurnClassification,
  RetryBudgets,
  RetryCounters,
  RetryMode,
} from './types.ts';

const PROMISE_PATTERNS = [
  /\bi(?:'ll| will)\b/i,
  /\blet me\b/i,
  /\bi(?:'m| am) going to\b/i,
  /\bi can\b.*\bthen\b/i,
  /\bnext[, ]+i\b/i,
];

const PLAN_PATTERNS = [
  /\bplan\b/i,
  /\bsteps?\b/i,
  /\bapproach\b/i,
  /\bstrategy\b/i,
  /^\s*(?:\d+\.|-|\*)\s+/m,
];

const COMPLETION_PATTERNS = [
  /\bdone\b/i,
  /\bcompleted?\b/i,
  /\bfinished\b/i,
  /\bverified\b/i,
  /\bcreated\b/i,
  /\bupdated\b/i,
  /\bhere(?:'s| is)\b/i,
];

export function classifyIncompleteTurn(
  attempt: AttemptSnapshot,
  counters: RetryCounters,
  budgets: RetryBudgets
): IncompleteTurnClassification {
  const mode = detectMode(attempt);
  if (!mode) {
    return { complete: true, retryable: false, reason: 'Attempt produced a complete user-visible result.' };
  }

  const guarded = guardAgainstRetry(attempt);
  if (guarded) return guarded;

  const canRetry = hasBudget(mode, counters, budgets);
  if (!canRetry) {
    return {
      complete: false,
      retryable: false,
      mode,
      reason: `Retry budget exhausted for ${mode}.`,
      terminalMessage: getBlockedText(),
    };
  }

  return {
    complete: false,
    retryable: true,
    mode,
    reason: `Detected ${mode} incomplete turn.`,
    steeringInstruction: getSteeringInstruction(mode),
  };
}

function guardAgainstRetry(attempt: AttemptSnapshot): IncompleteTurnClassification | null {
  if (attempt.aborted) return completeBlocked('Run was aborted.');
  if (attempt.timedOut) return completeBlocked('Run timed out.');
  if (attempt.approvalPending) return completeBlocked('Tool approval is pending.');
  if (attempt.delegated) return completeBlocked('Work was delegated to another runner.');
  if (attempt.lastToolErrored) return completeBlocked('Last tool errored; defer to tool recovery path.');

  if (attempt.replayMetadata?.hadPotentialSideEffects) {
    return {
      complete: false,
      retryable: false,
      reason: 'Replay is unsafe because side effects may already have happened.',
      terminalMessage: 'Agent could not safely retry automatically. Some tool actions may have already been executed; please verify before retrying.',
    };
  }

  return null;
}

function completeBlocked(reason: string): IncompleteTurnClassification {
  return { complete: true, retryable: false, reason };
}

function detectMode(attempt: AttemptSnapshot): RetryMode | null {
  const text = (attempt.assistantText || '').trim();
  const toolCalls = attempt.toolCalls || [];
  const toolResults = attempt.toolResults || [];

  if (!text && toolCalls.length === 0 && toolResults.length === 0 && !attempt.stopReason) {
    return 'empty_response';
  }

  if (attempt.stopReason === 'tool_calls' && !text) {
    return 'incomplete_tool_use';
  }

  if (text && toolCalls.length === 0 && toolResults.length === 0 && looksPlanningOnly(text)) {
    return 'planning_only';
  }

  if (!text && (attempt.stopReason === 'reasoning' || attempt.stopReason === 'length')) {
    return 'reasoning_only';
  }

  return null;
}

function looksPlanningOnly(text: string): boolean {
  const hasPromise = PROMISE_PATTERNS.some((pattern) => pattern.test(text));
  const hasPlanShape = PLAN_PATTERNS.filter((pattern) => pattern.test(text)).length >= 2;
  const hasCompletion = COMPLETION_PATTERNS.some((pattern) => pattern.test(text));
  return (hasPromise || hasPlanShape) && !hasCompletion;
}

function hasBudget(mode: RetryMode, counters: RetryCounters, budgets: RetryBudgets): boolean {
  switch (mode) {
    case 'planning_only':
      return counters.planningOnly < budgets.planningOnly;
    case 'reasoning_only':
      return counters.reasoningOnly < budgets.reasoningOnly;
    case 'empty_response':
      return counters.emptyResponse < budgets.emptyResponse;
    case 'incomplete_tool_use':
      return counters.incompleteToolUse < budgets.incompleteToolUse;
  }
}
