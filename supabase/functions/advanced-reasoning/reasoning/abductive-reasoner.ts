import { ReasoningEngine, ReasoningResult, AbductiveReasoningInput, ReasoningStep } from './types.ts';

/**
 * AbductiveReasoner - Inference to the best explanation for observed phenomena
 * 
 * Abductive reasoning involves:
 * 1. Identifying surprising or anomalous observations
 * 2. Generating multiple possible explanations
 * 3. Evaluating explanations for plausibility and fit
 * 4. Selecting the best explanation
 * 5. Testing the explanation against additional evidence
 */
export class AbductiveReasoner implements ReasoningEngine {
  
  async reason(input: AbductiveReasoningInput): Promise<ReasoningResult> {
    const startTime = Date.now();
    const steps: ReasoningStep[] = [];
    let confidence = 0.4; // Abductive reasoning starts with lower confidence
    let tokensUsed = 0;

    try {
      console.log(`[AbductiveReasoner] Starting with ${input.observations.length} observations`);

      // Step 1: Analyze observations for anomalies and surprises
      const anomalyAnalysis = await this.analyzeAnomalies(input.observations, input.anomalies, input.context);
      steps.push({
        step: 1,
        style: 'abductive',
        state: 'analyze',
        question: 'What observations are most surprising or need explanation?',
        hypothesis: anomalyAnalysis.surprisingElements.join('; '),
        confidence: anomalyAnalysis.confidence,
        time_ms: 140
      });
      confidence = anomalyAnalysis.confidence;
      tokensUsed += 70;

      // Step 2: Generate possible explanations
      const explanations = await this.generateExplanations(anomalyAnalysis, input.observations, input.context);
      steps.push({
        step: 2,
        style: 'abductive',
        state: 'hypothesize',
        question: 'What are the most plausible explanations for these observations?',
        hypothesis: `Generated ${explanations.candidates.length} explanations: ${explanations.candidates.slice(0, 3).map(e => e.explanation).join('; ')}`,
        confidence: explanations.confidence,
        time_ms: 180
      });
      confidence = Math.min(0.8, confidence + 0.1);
      tokensUsed += 90;

      // Step 3: Evaluate and rank explanations
      const evaluation = await this.evaluateExplanations(explanations.candidates, input.observations);
      steps.push({
        step: 3,
        style: 'abductive',
        state: 'test',
        question: 'Which explanation best fits all the evidence?',
        hypothesis: `Best explanation: ${evaluation.bestExplanation.explanation}`,
        observation: evaluation,
        confidence: evaluation.confidence,
        time_ms: 160
      });
      confidence = evaluation.confidence;
      tokensUsed += 80;

      // Step 4: Test best explanation against evidence
      const evidenceTest = await this.testAgainstEvidence(evaluation.bestExplanation, input.observations);
      steps.push({
        step: 4,
        style: 'abductive',
        state: 'observe',
        question: 'Does this explanation account for all observations?',
        hypothesis: `Testing explanation: ${evaluation.bestExplanation.explanation}`,
        observation: evidenceTest,
        confidence: evidenceTest.confidence,
        time_ms: 150
      });
      confidence = evidenceTest.confidence;
      tokensUsed += 75;

      // Step 5: Refine explanation if needed
      let finalExplanation = evaluation.bestExplanation;
      if (evidenceTest.unexplainedObservations.length > 0) {
        const refinement = await this.refineExplanation(evaluation.bestExplanation, evidenceTest.unexplainedObservations);
        steps.push({
          step: 5,
          style: 'abductive',
          state: 'update',
          question: 'How should we revise the explanation to fit all evidence?',
          hypothesis: refinement.refinedExplanation.explanation,
          confidence: refinement.confidence,
          time_ms: 170
        });
        finalExplanation = refinement.refinedExplanation;
        confidence = refinement.confidence;
        tokensUsed += 85;
      }

      // Step 6: State best current explanation
      const conclusion = await this.stateConclusion(finalExplanation, confidence, input.observations.length);
      steps.push({
        step: steps.length + 1,
        style: 'abductive',
        state: 'conclude',
        question: 'What is the best current explanation?',
        conclusion: conclusion.statement,
        confidence: conclusion.confidence,
        time_ms: 120
      });
      tokensUsed += 60;

      const insights = this.extractInsights(steps, input.observations, explanations.candidates.length);
      const processingTime = Date.now() - startTime;

      console.log(`[AbductiveReasoner] Completed in ${processingTime}ms with confidence ${conclusion.confidence.toFixed(3)}`);

      return {
        success: true,
        reasoning_type: 'abductive',
        confidence: conclusion.confidence,
        conclusion: conclusion.statement,
        steps,
        insights,
        processing_time_ms: processingTime,
        tokens_used: tokensUsed
      };

    } catch (error) {
      console.error('[AbductiveReasoner] Error:', error);
      return {
        success: false,
        reasoning_type: 'abductive',
        confidence: 0.1,
        conclusion: `Abductive reasoning failed: ${error.message}`,
        steps,
        insights: ['Explanation-seeking process encountered an error'],
        processing_time_ms: Date.now() - startTime,
        tokens_used: tokensUsed
      };
    }
  }

  /**
   * Analyze observations for anomalies and surprising elements
   */
  private async analyzeAnomalies(observations: string[], anomalies: string[] = [], context?: string): Promise<{
    surprisingElements: string[];
    anomalyTypes: string[];
    confidence: number;
  }> {
    console.log(`[AbductiveReasoner] Analyzing ${observations.length} observations for anomalies`);

    const surprisingElements: string[] = [];
    const anomalyTypes: string[] = [];

    // Include explicitly provided anomalies
    surprisingElements.push(...anomalies);

    // Detect implicit anomalies in observations
    const implicitAnomalies = this.detectImplicitAnomalies(observations);
    surprisingElements.push(...implicitAnomalies.elements);
    anomalyTypes.push(...implicitAnomalies.types);

    // Look for unexpected patterns or contradictions
    const contradictions = this.findContradictions(observations);
    if (contradictions.length > 0) {
      surprisingElements.push(...contradictions);
      anomalyTypes.push('contradiction');
    }

    // Look for missing expected elements
    const missingElements = this.identifyMissingElements(observations, context);
    if (missingElements.length > 0) {
      surprisingElements.push(...missingElements);
      anomalyTypes.push('absence');
    }

    // Ensure we have something to explain
    if (surprisingElements.length === 0) {
      surprisingElements.push('Observations require explanation');
      anomalyTypes.push('general');
    }

    const confidence = Math.min(0.7, 0.3 + (surprisingElements.length * 0.1));

    return {
      surprisingElements,
      anomalyTypes,
      confidence
    };
  }

  /**
   * Generate multiple possible explanations
   */
  private async generateExplanations(anomalyAnalysis: any, observations: string[], context?: string): Promise<{
    candidates: Array<{explanation: string; plausibility: number; scope: string}>;
    confidence: number;
  }> {
    console.log(`[AbductiveReasoner] Generating explanations for ${anomalyAnalysis.surprisingElements.length} anomalies`);

    const candidates: Array<{explanation: string; plausibility: number; scope: string}> = [];

    // Generate explanations for each type of anomaly
    for (const anomalyType of anomalyAnalysis.anomalyTypes) {
      const typeExplanations = this.generateExplanationsForType(anomalyType, observations, context);
      candidates.push(...typeExplanations);
    }

    // Generate general explanations
    const generalExplanations = this.generateGeneralExplanations(observations, context);
    candidates.push(...generalExplanations);

    // Generate causal explanations
    const causalExplanations = this.generateCausalExplanations(observations);
    candidates.push(...causalExplanations);

    // Sort by plausibility
    candidates.sort((a, b) => b.plausibility - a.plausibility);

    // Keep top explanations
    const topCandidates = candidates.slice(0, 5);

    const confidence = Math.min(0.8, 0.4 + (topCandidates.length * 0.08));

    return {
      candidates: topCandidates,
      confidence
    };
  }

  /**
   * Evaluate and rank explanations
   */
  private async evaluateExplanations(candidates: any[], observations: string[]): Promise<{
    bestExplanation: any;
    rankings: Array<{explanation: any; score: number}>;
    confidence: number;
  }> {
    console.log(`[AbductiveReasoner] Evaluating ${candidates.length} explanation candidates`);

    const rankings: Array<{explanation: any; score: number}> = [];

    for (const candidate of candidates) {
      const score = this.scoreExplanation(candidate, observations);
      rankings.push({ explanation: candidate, score });
    }

    // Sort by score
    rankings.sort((a, b) => b.score - a.score);

    const bestExplanation = rankings[0]?.explanation || candidates[0];
    const confidence = Math.min(0.85, rankings[0]?.score || 0.5);

    return {
      bestExplanation,
      rankings,
      confidence
    };
  }

  /**
   * Test explanation against all evidence
   */
  private async testAgainstEvidence(explanation: any, observations: string[]): Promise<{
    explainedObservations: string[];
    unexplainedObservations: string[];
    confidence: number;
  }> {
    console.log(`[AbductiveReasoner] Testing explanation against ${observations.length} observations`);

    const explainedObservations: string[] = [];
    const unexplainedObservations: string[] = [];

    // Simple test - in full implementation would use sophisticated matching
    observations.forEach(obs => {
      if (this.explanationCoversObservation(explanation, obs)) {
        explainedObservations.push(obs);
      } else {
        unexplainedObservations.push(obs);
      }
    });

    const coverageRatio = explainedObservations.length / observations.length;
    const confidence = Math.min(0.9, coverageRatio * 0.8 + 0.1);

    return {
      explainedObservations,
      unexplainedObservations,
      confidence
    };
  }

  /**
   * Refine explanation to account for unexplained observations
   */
  private async refineExplanation(originalExplanation: any, unexplainedObservations: string[]): Promise<{
    refinedExplanation: any;
    confidence: number;
  }> {
    console.log(`[AbductiveReasoner] Refining explanation to account for ${unexplainedObservations.length} unexplained observations`);

    const refinedExplanation = {
      ...originalExplanation,
      explanation: `${originalExplanation.explanation} (with additional factors accounting for ${unexplainedObservations.length} complex observations)`,
      scope: 'comprehensive'
    };

    const confidence = Math.max(0.5, originalExplanation.plausibility - (unexplainedObservations.length * 0.1));

    return { refinedExplanation, confidence };
  }

  /**
   * State final conclusion with best explanation
   */
  private async stateConclusion(explanation: any, confidence: number, observationCount: number): Promise<{
    statement: string;
    confidence: number;
  }> {
    const confidenceLevel = confidence > 0.7 ? 'reasonable' : confidence > 0.5 ? 'tentative' : 'speculative';
    
    const statement = `Through abductive reasoning analyzing ${observationCount} observations, the best explanation appears to be: ${explanation.explanation}. Confidence level: ${confidenceLevel} (${(confidence * 100).toFixed(0)}%)`;

    return { statement, confidence };
  }

  /**
   * Extract insights from abductive reasoning process
   */
  private extractInsights(steps: ReasoningStep[], observations: string[], candidateCount: number): string[] {
    const insights: string[] = [];

    insights.push(`Analyzed ${observations.length} observations and generated ${candidateCount} explanation candidates`);
    
    const finalConfidence = steps[steps.length - 1]?.confidence || 0;
    insights.push(`Best explanation confidence: ${(finalConfidence * 100).toFixed(0)}%`);

    const hasRefinement = steps.some(step => step.state === 'update');
    if (hasRefinement) {
      insights.push('Explanation refined to account for additional observations');
    }

    const evaluationSteps = steps.filter(step => step.state === 'test').length;
    insights.push(`Performed ${evaluationSteps} explanation evaluation(s)`);

    return insights;
  }

  /**
   * Detect implicit anomalies in observations
   */
  private detectImplicitAnomalies(observations: string[]): {elements: string[]; types: string[]} {
    const elements: string[] = [];
    const types: string[] = [];

    // Look for frequency anomalies
    const wordFreq = this.analyzeWordFrequency(observations);
    const unusualWords = Object.entries(wordFreq)
      .filter(([word, freq]) => freq === 1 && word.length > 5)
      .map(([word]) => word)
      .slice(0, 2);

    if (unusualWords.length > 0) {
      elements.push(`Unusual terms: ${unusualWords.join(', ')}`);
      types.push('frequency');
    }

    // Look for structural anomalies
    const lengths = observations.map(obs => obs.length);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    const outliers = observations.filter(obs => Math.abs(obs.length - avgLength) > avgLength * 0.5);

    if (outliers.length > 0) {
      elements.push(`Structural outliers: ${outliers.length} observations`);
      types.push('structural');
    }

    return { elements, types };
  }

  /**
   * Find contradictions in observations
   */
  private findContradictions(observations: string[]): string[] {
    const contradictions: string[] = [];

    // Simple contradiction detection
    const positiveStatements = observations.filter(obs => !obs.toLowerCase().includes('not') && !obs.toLowerCase().includes('no'));
    const negativeStatements = observations.filter(obs => obs.toLowerCase().includes('not') || obs.toLowerCase().includes('no'));

    if (positiveStatements.length > 0 && negativeStatements.length > 0) {
      contradictions.push('Conflicting positive and negative statements detected');
    }

    return contradictions;
  }

  /**
   * Identify missing expected elements
   */
  private identifyMissingElements(observations: string[], context?: string): string[] {
    const missing: string[] = [];

    // This is simplified - full implementation would use domain knowledge
    if (context) {
      const contextWords = context.toLowerCase().split(/\s+/);
      const observationText = observations.join(' ').toLowerCase();
      
      const expectedWords = contextWords.filter(word => 
        word.length > 4 && 
        !observationText.includes(word) &&
        !['the', 'and', 'or', 'but', 'with', 'from', 'that', 'this'].includes(word)
      );

      if (expectedWords.length > 0) {
        missing.push(`Expected but missing: ${expectedWords.slice(0, 2).join(', ')}`);
      }
    }

    return missing;
  }

  /**
   * Generate explanations for specific anomaly types
   */
  private generateExplanationsForType(anomalyType: string, observations: string[], context?: string): any[] {
    const explanations: any[] = [];

    switch (anomalyType) {
      case 'contradiction':
        explanations.push({
          explanation: 'Different perspectives or contexts may account for apparent contradictions',
          plausibility: 0.7,
          scope: 'contextual'
        });
        break;
      
      case 'frequency':
        explanations.push({
          explanation: 'Unusual terms may indicate specialized domain or unique circumstances',
          plausibility: 0.6,
          scope: 'domain-specific'
        });
        break;
      
      case 'structural':
        explanations.push({
          explanation: 'Structural variations may reflect different information sources or formats',
          plausibility: 0.65,
          scope: 'methodological'
        });
        break;
      
      case 'absence':
        explanations.push({
          explanation: 'Missing elements may indicate incomplete information or different focus areas',
          plausibility: 0.55,
          scope: 'informational'
        });
        break;
    }

    return explanations;
  }

  /**
   * Generate general explanations
   */
  private generateGeneralExplanations(observations: string[], context?: string): any[] {
    return [
      {
        explanation: 'Multiple underlying factors may be influencing the observed phenomena',
        plausibility: 0.6,
        scope: 'multifactorial'
      },
      {
        explanation: 'Systematic process or methodology may account for observed patterns',
        plausibility: 0.65,
        scope: 'systematic'
      },
      {
        explanation: 'External environmental or contextual factors may be primary drivers',
        plausibility: 0.55,
        scope: 'environmental'
      }
    ];
  }

  /**
   * Generate causal explanations
   */
  private generateCausalExplanations(observations: string[]): any[] {
    return [
      {
        explanation: 'Sequential cause-effect relationships may explain the observed sequence',
        plausibility: 0.7,
        scope: 'causal'
      },
      {
        explanation: 'Common underlying cause may be producing multiple observed effects',
        plausibility: 0.65,
        scope: 'common-cause'
      }
    ];
  }

  /**
   * Score explanation quality
   */
  private scoreExplanation(explanation: any, observations: string[]): number {
    let score = explanation.plausibility || 0.5;

    // Bonus for comprehensive scope
    if (explanation.scope === 'comprehensive') score += 0.1;
    
    // Bonus for specific explanations
    if (explanation.explanation.length > 50) score += 0.05;
    
    // Penalty for vague explanations
    if (explanation.explanation.includes('may') || explanation.explanation.includes('might')) {
      score -= 0.05;
    }

    return Math.min(0.95, Math.max(0.1, score));
  }

  /**
   * Check if explanation covers observation
   */
  private explanationCoversObservation(explanation: any, observation: string): boolean {
    // Simplified coverage check - full implementation would use semantic analysis
    const explanationWords = explanation.explanation.toLowerCase().split(/\s+/);
    const observationWords = observation.toLowerCase().split(/\s+/);
    
    const overlap = explanationWords.filter(word => 
      observationWords.includes(word) && word.length > 3
    ).length;
    
    return overlap >= Math.min(2, observationWords.length * 0.3);
  }

  /**
   * Analyze word frequency for anomaly detection
   */
  private analyzeWordFrequency(observations: string[]): Record<string, number> {
    const wordFreq: Record<string, number> = {};
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

    observations.forEach(obs => {
      const words = obs.toLowerCase().match(/\b\w+\b/g) || [];
      words.forEach(word => {
        if (!stopWords.has(word) && word.length > 2) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });
    });

    return wordFreq;
  }
}
