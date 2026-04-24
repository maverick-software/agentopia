import type { AttemptSnapshot, IncompleteTurnClassification, LivenessState } from './types.ts';

export function resolveLivenessState(
  attempt: AttemptSnapshot,
  classification: IncompleteTurnClassification
): LivenessState {
  if (attempt.timedOut || attempt.aborted) return 'blocked';
  if (classification.complete) return 'working';
  if (classification.terminalMessage) return 'abandoned';
  if (attempt.stopReason === 'compaction' || attempt.stopReason === 'context_limit') {
    return 'paused';
  }
  return classification.retryable ? 'working' : 'blocked';
}

export function livenessLabel(state: LivenessState): string {
  switch (state) {
    case 'working':
      return 'Working';
    case 'paused':
      return 'Paused';
    case 'blocked':
      return 'Blocked';
    case 'abandoned':
      return 'Abandoned';
  }
}
