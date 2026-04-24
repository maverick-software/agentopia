import type { LivenessState, RuntimeContext } from './types.ts';

export interface CompactionAssessment {
  shouldCompact: boolean;
  livenessOnFailure: LivenessState;
  reason?: string;
}

export function assessCompactionNeed(
  context: RuntimeContext,
  messages: any[],
  approximateTokenLimit = 80000
): CompactionAssessment {
  const approximateChars = messages.reduce((sum, msg) => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '');
    return sum + content.length;
  }, 0);
  const approximateTokens = Math.ceil(approximateChars / 4);

  return {
    shouldCompact: approximateTokens > approximateTokenLimit,
    livenessOnFailure: 'paused',
    reason: approximateTokens > approximateTokenLimit
      ? `Approximate token count ${approximateTokens} exceeds ${approximateTokenLimit}.`
      : undefined,
  };
}
