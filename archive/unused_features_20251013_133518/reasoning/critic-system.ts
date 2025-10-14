import { ReasoningStep, ReasoningStyle } from './types.ts';

/**
 * CriticSystem - Adversarial evaluation system for reasoning conclusions
 * 
 * This system acts as a devil's advocate, challenging assumptions,
 * identifying weaknesses, and forcing reconsideration when necessary.
 * It ensures robust reasoning by preventing premature conclusions
 * and highlighting conflicting perspectives.
 */
export class CriticSystem {
  private maxReconsiderationCycles = 3;
  private reconsiderationThreshold = 0.4; // If critique severity > 0.4, trigger reconsideration
  
  /**
   * Critique a reasoning conclusion with adversarial analysis
   */
  async critiqueConclusion(
    conclusion: string,
    steps: ReasoningStep[],
    style: ReasoningStyle,
    confidence: number
  ): Promise<CritiqueResult> {
    console.log(`[CriticSystem] Evaluating conclusion with confidence ${confidence.toFixed(3)}`);
    
    const critiques: Critique[] = [];
    
    // 1. Challenge logical consistency
    const logicalCritiques = await this.challengeLogicalConsistency(conclusion, steps);
    critiques.push(...logicalCritiques);
    
    // 2. Identify missing perspectives
    const perspectiveCritiques = await this.identifyMissingPerspectives(conclusion, steps, style);
    critiques.push(...perspectiveCritiques);
    
    // 3. Question assumptions
    const assumptionCritiques = await this.questionAssumptions(conclusion, steps);
    critiques.push(...assumptionCritiques);
    
    // 4. Find contradictions
    const contradictionCritiques = await this.findContradictions(conclusion, steps);
    critiques.push(...contradictionCritiques);
    
    // 5. Evaluate evidence quality
    const evidenceCritiques = await this.evaluateEvidenceQuality(steps, style);
    critiques.push(...evidenceCritiques);
    
    // 6. Check for cognitive biases
    const biasCritiques = await this.checkCognitiveBiases(conclusion, steps);
    critiques.push(...biasCritiques);
    
    // Calculate overall critique severity
    const severity = this.calculateCritiqueSeverity(critiques);
    const requiresReconsideration = severity > this.reconsiderationThreshold;
    
    // Generate alternative perspectives if confidence is low
    const alternatives = confidence < 0.7 
      ? await this.generateAlternativePerspectives(conclusion, steps, critiques)
      : [];
    
    return {
      critiques,
      severity,
      requiresReconsideration,
      alternativePerspectives: alternatives,
      recommendedQuestions: this.generateChallengingQuestions(critiques, style),
      confidenceAdjustment: -severity * 0.3 // Reduce confidence based on critique severity
    };
  }
  
  /**
   * Challenge logical consistency in the reasoning chain
   */
  private async challengeLogicalConsistency(
    conclusion: string,
    steps: ReasoningStep[]
  ): Promise<Critique[]> {
    const critiques: Critique[] = [];
    
    // Check if conclusion follows from premises
    const premises = steps.filter(s => s.state === 'analyze' || s.state === 'hypothesize')
      .map(s => s.hypothesis || s.question);
    
    if (premises.length > 0) {
      const followsLogically = this.assessLogicalFlow(premises, conclusion);
      if (!followsLogically) {
        critiques.push({
          type: 'logical_inconsistency',
          severity: 0.7,
          description: 'The conclusion does not necessarily follow from the stated premises',
          suggestion: 'Re-examine the logical connection between observations and conclusion'
        });
      }
    }
    
    // Check for circular reasoning
    const hasCircularReasoning = this.detectCircularReasoning(steps);
    if (hasCircularReasoning) {
      critiques.push({
        type: 'circular_reasoning',
        severity: 0.8,
        description: 'The reasoning appears to be circular, using the conclusion to support itself',
        suggestion: 'Establish independent support for the conclusion'
      });
    }
    
    // Check for non-sequiturs
    const nonSequiturs = this.findNonSequiturs(steps);
    nonSequiturs.forEach(ns => {
      critiques.push({
        type: 'non_sequitur',
        severity: 0.6,
        description: `Step ${ns.step} does not logically follow from previous reasoning`,
        suggestion: 'Strengthen the logical connection between reasoning steps'
      });
    });
    
    return critiques;
  }
  
  /**
   * Identify missing perspectives that could challenge the conclusion
   */
  private async identifyMissingPerspectives(
    conclusion: string,
    steps: ReasoningStep[],
    style: ReasoningStyle
  ): Promise<Critique[]> {
    const critiques: Critique[] = [];
    
    // Style-specific perspective checks
    switch (style) {
      case 'inductive':
        if (!steps.some(s => s.observation?.exceptions)) {
          critiques.push({
            type: 'missing_counterexamples',
            severity: 0.5,
            description: 'No counterexamples or exceptions were considered',
            suggestion: 'Actively seek cases that might contradict the general rule'
          });
        }
        break;
        
      case 'deductive':
        if (!steps.some(s => s.state === 'observe' && s.observation?.validation)) {
          critiques.push({
            type: 'unvalidated_premises',
            severity: 0.6,
            description: 'Premises were not empirically validated',
            suggestion: 'Verify that all premises hold true in the given context'
          });
        }
        break;
        
      case 'abductive':
        const alternativeCount = steps.filter(s => s.hypothesis?.includes('alternative')).length;
        if (alternativeCount < 2) {
          critiques.push({
            type: 'insufficient_alternatives',
            severity: 0.5,
            description: 'Too few alternative explanations were considered',
            suggestion: 'Generate and evaluate more competing hypotheses'
          });
        }
        break;
    }
    
    // Check for opposing viewpoints
    const hasOpposingViews = steps.some(s => 
      s.hypothesis?.toLowerCase().includes('however') ||
      s.hypothesis?.toLowerCase().includes('alternatively') ||
      s.hypothesis?.toLowerCase().includes('contrary')
    );
    
    if (!hasOpposingViews) {
      critiques.push({
        type: 'no_opposing_views',
        severity: 0.4,
        description: 'No opposing viewpoints were explicitly considered',
        suggestion: 'Consider what critics of this position might argue'
      });
    }
    
    return critiques;
  }
  
  /**
   * Question underlying assumptions
   */
  private async questionAssumptions(
    conclusion: string,
    steps: ReasoningStep[]
  ): Promise<Critique[]> {
    const critiques: Critique[] = [];
    
    // Identify implicit assumptions
    const assumptions = this.extractImplicitAssumptions(steps);
    
    if (assumptions.length > 0) {
      assumptions.forEach(assumption => {
        critiques.push({
          type: 'unexamined_assumption',
          severity: 0.4,
          description: `Implicit assumption: "${assumption}" - This may not always hold true`,
          suggestion: 'Explicitly state and validate key assumptions'
        });
      });
    }
    
    // Check for hasty generalizations
    const hasGeneralization = conclusion.toLowerCase().includes('all') || 
                            conclusion.toLowerCase().includes('always') ||
                            conclusion.toLowerCase().includes('never');
    
    if (hasGeneralization) {
      const sampleSize = steps.filter(s => s.state === 'observe').length;
      if (sampleSize < 3) {
        critiques.push({
          type: 'hasty_generalization',
          severity: 0.6,
          description: 'Strong generalization based on limited observations',
          suggestion: 'Qualify the conclusion or gather more evidence'
        });
      }
    }
    
    return critiques;
  }
  
  /**
   * Find contradictions in the reasoning chain
   */
  private async findContradictions(
    conclusion: string,
    steps: ReasoningStep[]
  ): Promise<Critique[]> {
    const critiques: Critique[] = [];
    
    // Compare hypotheses across steps for contradictions
    for (let i = 0; i < steps.length - 1; i++) {
      for (let j = i + 1; j < steps.length; j++) {
        if (steps[i].hypothesis && steps[j].hypothesis) {
          const contradiction = this.detectContradiction(
            steps[i].hypothesis!,
            steps[j].hypothesis!
          );
          
          if (contradiction) {
            critiques.push({
              type: 'internal_contradiction',
              severity: 0.7,
              description: `Steps ${i+1} and ${j+1} contain contradictory statements`,
              suggestion: 'Resolve the contradiction or acknowledge the complexity'
            });
          }
        }
      }
    }
    
    // Check if conclusion contradicts any step
    steps.forEach((step, index) => {
      if (step.hypothesis) {
        const contradictsConclusion = this.detectContradiction(step.hypothesis, conclusion);
        if (contradictsConclusion) {
          critiques.push({
            type: 'conclusion_contradiction',
            severity: 0.8,
            description: `Conclusion contradicts reasoning in step ${index+1}`,
            suggestion: 'Align conclusion with reasoning chain or explain the discrepancy'
          });
        }
      }
    });
    
    return critiques;
  }
  
  /**
   * Evaluate the quality and strength of evidence
   */
  private async evaluateEvidenceQuality(
    steps: ReasoningStep[],
    style: ReasoningStyle
  ): Promise<Critique[]> {
    const critiques: Critique[] = [];
    
    // Count evidence-based steps
    const evidenceSteps = steps.filter(s => 
      s.state === 'observe' || 
      s.state === 'test' ||
      s.observation
    );
    
    const totalSteps = steps.length;
    const evidenceRatio = evidenceSteps.length / totalSteps;
    
    if (evidenceRatio < 0.3) {
      critiques.push({
        type: 'insufficient_evidence',
        severity: 0.6,
        description: 'Reasoning relies heavily on speculation rather than evidence',
        suggestion: 'Gather more empirical evidence to support conclusions'
      });
    }
    
    // Check for anecdotal evidence
    const hasAnecdotal = steps.some(s => 
      s.hypothesis?.toLowerCase().includes('example') ||
      s.hypothesis?.toLowerCase().includes('instance') ||
      s.hypothesis?.toLowerCase().includes('case')
    );
    
    if (hasAnecdotal && style === 'inductive') {
      critiques.push({
        type: 'anecdotal_evidence',
        severity: 0.4,
        description: 'Reasoning may be overly reliant on anecdotal evidence',
        suggestion: 'Seek statistical or systematic evidence'
      });
    }
    
    // Check for missing data acknowledgment
    const acknowledgesMissingData = steps.some(s =>
      s.hypothesis?.toLowerCase().includes('unknown') ||
      s.hypothesis?.toLowerCase().includes('unclear') ||
      s.hypothesis?.toLowerCase().includes('insufficient')
    );
    
    if (!acknowledgesMissingData && evidenceRatio < 0.5) {
      critiques.push({
        type: 'overconfidence',
        severity: 0.5,
        description: 'Conclusion seems overconfident given limited evidence',
        suggestion: 'Acknowledge limitations and unknowns in the analysis'
      });
    }
    
    return critiques;
  }
  
  /**
   * Check for cognitive biases in reasoning
   */
  private async checkCognitiveBiases(
    conclusion: string,
    steps: ReasoningStep[]
  ): Promise<Critique[]> {
    const critiques: Critique[] = [];
    
    // Confirmation bias - only looking for supporting evidence
    const supportingSteps = steps.filter(s => 
      s.hypothesis?.toLowerCase().includes('support') ||
      s.hypothesis?.toLowerCase().includes('confirm') ||
      s.hypothesis?.toLowerCase().includes('consistent')
    );
    
    const contradictingSteps = steps.filter(s =>
      s.hypothesis?.toLowerCase().includes('contradict') ||
      s.hypothesis?.toLowerCase().includes('oppose') ||
      s.hypothesis?.toLowerCase().includes('against')
    );
    
    if (supportingSteps.length > 3 * contradictingSteps.length) {
      critiques.push({
        type: 'confirmation_bias',
        severity: 0.5,
        description: 'Reasoning appears to favor confirming evidence over disconfirming',
        suggestion: 'Actively seek evidence that could disprove the hypothesis'
      });
    }
    
    // Anchoring bias - over-reliance on first information
    if (steps.length > 3) {
      const firstHypothesis = steps[0].hypothesis || '';
      const conclusionSimilarity = this.calculateSimilarity(firstHypothesis, conclusion);
      
      if (conclusionSimilarity > 0.8) {
        critiques.push({
          type: 'anchoring_bias',
          severity: 0.4,
          description: 'Conclusion closely mirrors initial hypothesis without evolution',
          suggestion: 'Consider how new information should modify initial assumptions'
        });
      }
    }
    
    // Availability heuristic - overweighting recent/memorable examples
    const recentBias = steps.filter((s, i) => 
      i > steps.length - 3 && s.confidence > 0.7
    ).length;
    
    if (recentBias === 3) {
      critiques.push({
        type: 'recency_bias',
        severity: 0.3,
        description: 'Final conclusion may be overly influenced by recent steps',
        suggestion: 'Re-evaluate earlier evidence with equal weight'
      });
    }
    
    return critiques;
  }
  
  /**
   * Generate alternative perspectives when confidence is low
   */
  private async generateAlternativePerspectives(
    conclusion: string,
    steps: ReasoningStep[],
    critiques: Critique[]
  ): Promise<AlternativePerspective[]> {
    const alternatives: AlternativePerspective[] = [];
    
    // Generate opposite conclusion
    alternatives.push({
      perspective: `Contrary view: The opposite of "${conclusion}" may be true`,
      reasoning: 'Consider that the evidence could be interpreted differently',
      confidence: 0.3,
      supportingPoints: this.extractContrarySupportingPoints(steps)
    });
    
    // Generate moderate/nuanced view
    alternatives.push({
      perspective: 'Nuanced view: The truth likely lies between extremes',
      reasoning: 'Both supporting and contradicting evidence have merit',
      confidence: 0.5,
      supportingPoints: [
        'Some evidence supports the conclusion',
        'Other factors suggest limitations',
        'Context-dependent validity is likely'
      ]
    });
    
    // Generate alternative based on main critique
    const mainCritique = critiques.sort((a, b) => b.severity - a.severity)[0];
    if (mainCritique) {
      alternatives.push({
        perspective: `Alternative based on ${mainCritique.type}`,
        reasoning: mainCritique.suggestion,
        confidence: 0.4,
        supportingPoints: [mainCritique.description]
      });
    }
    
    return alternatives;
  }
  
  /**
   * Generate challenging questions to deepen reasoning
   */
  private generateChallengingQuestions(
    critiques: Critique[],
    style: ReasoningStyle
  ): string[] {
    const questions: string[] = [];
    
    // Universal challenging questions
    questions.push('What evidence would need to exist to prove this conclusion wrong?');
    questions.push('What are we assuming to be true that might not be?');
    questions.push('How would someone who disagrees most strongly argue against this?');
    
    // Style-specific challenging questions
    switch (style) {
      case 'inductive':
        questions.push('What patterns might we be seeing that aren\'t actually there (pareidolia)?');
        questions.push('How many counterexamples would it take to invalidate this generalization?');
        questions.push('Are we conflating correlation with causation?');
        break;
        
      case 'deductive':
        questions.push('Are all our premises necessarily true, or just probably true?');
        questions.push('What hidden premises are we not explicitly stating?');
        questions.push('Does our logic hold in all possible worlds, or just this specific context?');
        break;
        
      case 'abductive':
        questions.push('What is the simplest explanation we haven\'t considered (Occam\'s Razor)?');
        questions.push('What if multiple explanations are simultaneously true?');
        questions.push('How can we test which explanation has the most predictive power?');
        break;
    }
    
    // Critique-based questions
    critiques.forEach(critique => {
      if (critique.severity > 0.5) {
        questions.push(this.generateQuestionFromCritique(critique));
      }
    });
    
    return questions.slice(0, 5); // Return top 5 most challenging questions
  }
  
  /**
   * Calculate overall severity of critiques
   */
  private calculateCritiqueSeverity(critiques: Critique[]): number {
    if (critiques.length === 0) return 0;
    
    // Weighted average with emphasis on most severe critiques
    const severities = critiques.map(c => c.severity).sort((a, b) => b - a);
    let weightedSum = 0;
    let weightSum = 0;
    
    severities.forEach((severity, index) => {
      const weight = 1 / (index + 1); // Higher weight for more severe critiques
      weightedSum += severity * weight;
      weightSum += weight;
    });
    
    return weightSum > 0 ? weightedSum / weightSum : 0;
  }
  
  // Helper methods
  
  private assessLogicalFlow(premises: string[], conclusion: string): boolean {
    // Simplified logical assessment - in production would use NLP
    const premiseKeywords = premises.join(' ').toLowerCase().split(/\s+/);
    const conclusionKeywords = conclusion.toLowerCase().split(/\s+/);
    
    const overlap = conclusionKeywords.filter(word => 
      premiseKeywords.includes(word) && word.length > 3
    ).length;
    
    return overlap >= Math.min(3, conclusionKeywords.length * 0.2);
  }
  
  private detectCircularReasoning(steps: ReasoningStep[]): boolean {
    // Check if conclusion appears in earlier reasoning
    const conclusion = steps.find(s => s.state === 'conclude')?.conclusion;
    if (!conclusion) return false;
    
    const earlierSteps = steps.filter(s => s.state !== 'conclude');
    return earlierSteps.some(step => 
      step.hypothesis?.toLowerCase().includes(conclusion.toLowerCase().substring(0, 30))
    );
  }
  
  private findNonSequiturs(steps: ReasoningStep[]): Array<{step: number}> {
    const nonSequiturs: Array<{step: number}> = [];
    
    for (let i = 1; i < steps.length; i++) {
      const prevStep = steps[i-1];
      const currStep = steps[i];
      
      if (!this.stepsAreConnected(prevStep, currStep)) {
        nonSequiturs.push({ step: i + 1 });
      }
    }
    
    return nonSequiturs;
  }
  
  private stepsAreConnected(prev: ReasoningStep, curr: ReasoningStep): boolean {
    // Check if current step references previous step's content
    const prevContent = (prev.hypothesis || prev.question || '').toLowerCase();
    const currContent = (curr.hypothesis || curr.question || '').toLowerCase();
    
    const prevWords = prevContent.split(/\s+/).filter(w => w.length > 4);
    const currWords = currContent.split(/\s+/);
    
    return prevWords.some(word => currWords.includes(word));
  }
  
  private extractImplicitAssumptions(steps: ReasoningStep[]): string[] {
    const assumptions: string[] = [];
    
    steps.forEach(step => {
      const text = step.hypothesis || step.question || '';
      
      // Look for assumption indicators
      if (text.includes('must') || text.includes('certainly')) {
        assumptions.push('Certainty where probability might be more appropriate');
      }
      
      if (text.includes('all') || text.includes('every')) {
        assumptions.push('Universal application may not be justified');
      }
      
      if (text.includes('because')) {
        assumptions.push('Causal relationship may be correlation');
      }
    });
    
    return [...new Set(assumptions)]; // Remove duplicates
  }
  
  private detectContradiction(text1: string, text2: string): boolean {
    // Simplified contradiction detection
    const negatives = ['not', 'no', 'never', 'neither', 'none', 'cannot'];
    
    const hasNegative1 = negatives.some(neg => text1.toLowerCase().includes(neg));
    const hasNegative2 = negatives.some(neg => text2.toLowerCase().includes(neg));
    
    // If one has negative and other doesn't, check for same subject
    if (hasNegative1 !== hasNegative2) {
      const words1 = text1.toLowerCase().split(/\s+/);
      const words2 = text2.toLowerCase().split(/\s+/);
      
      const commonWords = words1.filter(w => words2.includes(w) && w.length > 4);
      return commonWords.length >= 2;
    }
    
    return false;
  }
  
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    const commonWords = words1.filter(w => words2.includes(w));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return totalWords > 0 ? commonWords.length / totalWords : 0;
  }
  
  private extractContrarySupportingPoints(steps: ReasoningStep[]): string[] {
    const points: string[] = [];
    
    steps.forEach(step => {
      if (step.observation?.exceptions) {
        points.push('Exceptions were noted in observations');
      }
      
      if (step.confidence < 0.5) {
        points.push(`Low confidence in ${step.state} phase suggests uncertainty`);
      }
      
      if (step.hypothesis?.includes('however') || step.hypothesis?.includes('but')) {
        points.push('Contradictory evidence was acknowledged');
      }
    });
    
    return points.length > 0 ? points : ['Limited evidence for contrary position'];
  }
  
  private generateQuestionFromCritique(critique: Critique): string {
    const questionMap: Record<string, string> = {
      logical_inconsistency: 'How can we strengthen the logical connection between premises and conclusion?',
      circular_reasoning: 'What independent evidence supports this conclusion?',
      missing_counterexamples: 'What cases might contradict this generalization?',
      insufficient_alternatives: 'What other explanations haven\'t we considered?',
      confirmation_bias: 'What evidence might disprove our hypothesis?',
      hasty_generalization: 'Do we have enough data to make this broad claim?',
      internal_contradiction: 'How do we resolve the contradictions in our reasoning?',
      insufficient_evidence: 'What additional evidence would make this conclusion more robust?'
    };
    
    return questionMap[critique.type] || 'How can we address this critique?';
  }
}

// Type definitions

export interface Critique {
  type: string;
  severity: number; // 0-1, higher is more severe
  description: string;
  suggestion: string;
}

export interface CritiqueResult {
  critiques: Critique[];
  severity: number;
  requiresReconsideration: boolean;
  alternativePerspectives: AlternativePerspective[];
  recommendedQuestions: string[];
  confidenceAdjustment: number;
}

export interface AlternativePerspective {
  perspective: string;
  reasoning: string;
  confidence: number;
  supportingPoints: string[];
}

export interface ReconsiderationResult {
  originalConclusion: string;
  revisedConclusion: string;
  changesMade: string[];
  finalConfidence: number;
  conflictingViews: AlternativePerspective[];
}
