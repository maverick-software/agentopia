import { ReasoningDecision } from './types.ts';

export class ReasoningScorer {
  static score(text: string, contextDensity: number = 0): ReasoningDecision {
    const lenScore = Math.min(1, text.length / 200); // More generous length scoring
    const questionBonus = /\?|why|how|explain|compare|derive|prove|deductive|reasoning|think|analyze/i.test(text) ? 0.3 : 0; // Higher bonus for reasoning keywords
    const densityBonus = Math.min(0.3, Math.max(0, contextDensity));
    const reasoningBonus = /deductive|inductive|abductive|reasoning|logic|chain.*thought|step.*step/i.test(text) ? 0.4 : 0; // Explicit reasoning request bonus
    const score = Math.max(0, Math.min(1, lenScore + questionBonus + densityBonus + reasoningBonus));
    return { score, reason: `len=${lenScore.toFixed(2)} q=${questionBonus.toFixed(2)} d=${densityBonus.toFixed(2)} r=${reasoningBonus.toFixed(2)}` };
  }
}


