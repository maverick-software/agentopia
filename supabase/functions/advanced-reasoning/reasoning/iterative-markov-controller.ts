import { ReasoningState, ReasoningStyle, ReasoningStep } from './types.ts';
import { CriticSystem, CritiqueResult, AlternativePerspective } from './critic-system.ts';

interface ControllerConfig {
  sessionId: string;
  agentId: string;
  userId: string;
  supabase: any;
  maxIterations: number;
  confidenceThreshold: number;
  timeoutMs: number;
  includeMemory: boolean;
}

interface ChainResult {
  iterations: number;
  finalConfidence: number;
  conclusion: string;
  insights: string[];
  steps: ReasoningStep[];
  memoryConnections: any;
  forcedStop: boolean;
  stopReason: string;
  totalTokens: number;
  critiques?: any[];
  alternativePerspectives?: AlternativePerspective[];
  reconsiderationCycles?: number;
}

interface MemoryContext {
  episodic: any[];
  semantic: any[];
}

/**
 * IterativeMarkovController - Orchestrates the iterative reasoning process
 * 
 * This controller manages the complete reasoning chain:
 * 1. Context accumulation across iterations
 * 2. Confidence tracking and threshold management
 * 3. Memory integration and insight extraction
 * 4. Safety controls and timeout handling
 * 5. State transition management via Markov chain
 */
export class IterativeMarkovController {
  private config: ControllerConfig;
  private currentContext: string[] = [];
  private memoryConnections: any = { episodic: [], semantic: [] };
  private totalTokens = 0;
  private startTime: number;
  private criticSystem: CriticSystem;
  private reconsiderationCount = 0;
  private maxReconsiderations = 3;
  private challengingQuestions: string[] = [];

  // Markov transition weights (enhanced from existing system)
  private baseWeights = {
    analyze: { hypothesize: 0.7, conclude: 0.3 },
    hypothesize: { test: 0.6, conclude: 0.4 },
    test: { observe: 1.0 },
    observe: { update: 0.8, conclude: 0.2 },
    update: { hypothesize: 0.7, conclude: 0.3 },
    conclude: {}
  };

  constructor(config: ControllerConfig) {
    this.config = config;
    this.startTime = Date.now();
    this.criticSystem = new CriticSystem();
  }

  /**
   * Execute the complete iterative reasoning chain
   */
  async executeChain(query: string, reasoningStyle: ReasoningStyle): Promise<ChainResult> {
    console.log(`[IterativeMarkov] Starting chain for style: ${reasoningStyle}`);
    
    const steps: ReasoningStep[] = [];
    let currentState: ReasoningState = 'analyze';
    let confidence = 0.5;
    let iteration = 0;
    let forcedStop = false;
    let stopReason = '';

    // Initialize context with query
    this.currentContext = [query];

    // Adjust weights based on reasoning style
    const weights = this.adjustWeightsForStyle(reasoningStyle);

    try {
      // Main reasoning loop
      while (iteration < this.config.maxIterations) {
        iteration++;
        
        // Check timeout
        if (Date.now() - this.startTime > this.config.timeoutMs) {
          forcedStop = true;
          stopReason = 'timeout';
          break;
        }

        console.log(`[IterativeMarkov] Iteration ${iteration}, State: ${currentState}, Confidence: ${confidence.toFixed(3)}`);

        // Retrieve relevant memories for this step
        const memories = await this.retrieveMemories(query, steps);
        
        // Execute reasoning step
        const step = await this.executeReasoningStep(
          iteration,
          currentState,
          reasoningStyle,
          query,
          memories,
          confidence
        );

        steps.push(step);

        // Update confidence based on step results
        confidence = this.updateConfidence(confidence, step, memories);

        // Accumulate context from this step
        this.accumulateContext(step);

        // Check if we should conclude
        if (currentState === 'conclude' || confidence >= this.config.confidenceThreshold) {
          stopReason = confidence >= this.config.confidenceThreshold ? 'confidence_reached' : 'natural_conclusion';
          break;
        }

        // Transition to next state
        currentState = this.getNextState(currentState, weights, confidence);
      }

      // If we hit max iterations without concluding
      if (iteration >= this.config.maxIterations && stopReason === '') {
        stopReason = 'max_iterations';
      }

      // Generate initial conclusion
      let conclusion = await this.generateConclusion(steps, query, confidence);
      
      // CRITICAL ENHANCEMENT: Apply critic system
      const critiqueResult = await this.criticSystem.critiqueConclusion(
        conclusion,
        steps,
        reasoningStyle,
        confidence
      );
      
      // Adjust confidence based on critique
      confidence = Math.max(0.1, confidence + critiqueResult.confidenceAdjustment);
      
      // Store challenging questions for future iterations
      this.challengingQuestions = critiqueResult.recommendedQuestions;
      
      // Handle reconsideration if needed
      let alternativePerspectives = critiqueResult.alternativePerspectives;
      if (critiqueResult.requiresReconsideration && this.reconsiderationCount < this.maxReconsiderations) {
        console.log(`[IterativeMarkov] Critic triggered reconsideration (cycle ${this.reconsiderationCount + 1})`);
        
        const reconsiderationResult = await this.performReconsideration(
          conclusion,
          steps,
          critiqueResult,
          reasoningStyle,
          query
        );
        
        if (reconsiderationResult) {
          conclusion = reconsiderationResult.revisedConclusion;
          confidence = reconsiderationResult.finalConfidence;
          steps.push(...reconsiderationResult.additionalSteps);
          alternativePerspectives = reconsiderationResult.alternativePerspectives;
        }
      }
      
      // If confidence is still low, prepare conflicting views
      if (confidence < 0.6 && alternativePerspectives.length > 0) {
        conclusion = this.presentWithAlternatives(conclusion, alternativePerspectives, confidence);
      }
      
      // Extract insights including critic insights
      const insights = this.extractInsights(steps);
      insights.push(...this.extractCriticInsights(critiqueResult));

      console.log(`[IterativeMarkov] Chain completed: ${iteration} iterations, confidence: ${confidence.toFixed(3)}, reason: ${stopReason}, reconsiderations: ${this.reconsiderationCount}`);

      return {
        iterations: iteration,
        finalConfidence: confidence,
        conclusion,
        insights,
        steps,
        memoryConnections: this.memoryConnections,
        forcedStop,
        stopReason,
        totalTokens: this.totalTokens,
        critiques: critiqueResult.critiques,
        alternativePerspectives: confidence < 0.6 ? alternativePerspectives : undefined,
        reconsiderationCycles: this.reconsiderationCount
      };

    } catch (error) {
      console.error('[IterativeMarkov] Chain execution failed:', error);
      throw new Error(`Reasoning chain failed: ${error.message}`);
    }
  }

  /**
   * Adjust Markov weights based on reasoning style
   */
  private adjustWeightsForStyle(style: ReasoningStyle): any {
    const weights = JSON.parse(JSON.stringify(this.baseWeights));

    switch (style) {
      case 'inductive':
        // Favor observation and pattern building
        weights.analyze.observe = 0.4;
        weights.observe.update = 0.9;
        weights.update.hypothesize = 0.8;
        break;
      
      case 'deductive':
        // Favor direct logical progression
        weights.analyze.conclude = 0.5;
        weights.hypothesize.conclude = 0.6;
        break;
      
      case 'abductive':
        // Favor hypothesis generation and testing
        weights.analyze.hypothesize = 0.8;
        weights.hypothesize.test = 0.7;
        weights.observe.update = 0.9;
        break;
    }

    return weights;
  }

  /**
   * Execute a single reasoning step
   */
  private async executeReasoningStep(
    iteration: number,
    state: ReasoningState,
    style: ReasoningStyle,
    query: string,
    memories: MemoryContext,
    confidence: number
  ): Promise<ReasoningStep> {
    
    // Build context-aware question
    const question = this.buildContextualQuestion(state, style, query, memories);
    
    // Get LLM response
    const hypothesis = await this.askLLM(question);
    
    // Determine if testing is needed
    const shouldTest = state === 'hypothesize' || state === 'test';
    let action: any = undefined;
    let observation: any = undefined;

    if (shouldTest) {
      // For now, we'll simulate testing - in full implementation this would
      // integrate with actual tools and knowledge retrieval
      action = { type: 'knowledge_check', query: hypothesis };
      observation = { result: 'validated', confidence_boost: 0.1 };
    }

    // Store step in database
    await this.storeReasoningStep({
      session_id: this.config.sessionId,
      step_number: iteration,
      reasoning_state: state,
      question,
      hypothesis,
      action,
      observation,
      confidence,
      memories_used: memories,
      memory_insights: this.extractMemoryInsights(memories),
      facts_considered: this.currentContext.slice(-3), // Last 3 context items
      processing_time_ms: 100, // Placeholder
      tokens_used: 50 // Placeholder
    });

    return {
      step: iteration,
      style,
      state,
      question,
      hypothesis,
      action,
      observation,
      confidence,
      time_ms: 100
    };
  }

  /**
   * Retrieve relevant memories for current reasoning step
   */
  private async retrieveMemories(query: string, previousSteps: ReasoningStep[]): Promise<MemoryContext> {
    if (!this.config.includeMemory) {
      return { episodic: [], semantic: [] };
    }

    try {
      // Build memory query from current context
      let memoryQuery = query;
      if (previousSteps.length > 0) {
        const lastStep = previousSteps[previousSteps.length - 1];
        if (lastStep.hypothesis) {
          memoryQuery = `${query} ${lastStep.hypothesis}`;
        }
      }

      // This would integrate with the existing MemoryManager
      // For now, return empty memories - will be implemented in full system
      const memories: MemoryContext = {
        episodic: [],
        semantic: []
      };

      // Track memory usage
      this.memoryConnections.episodic.push(...memories.episodic);
      this.memoryConnections.semantic.push(...memories.semantic);

      return memories;

    } catch (error) {
      console.error('[IterativeMarkov] Memory retrieval failed:', error);
      return { episodic: [], semantic: [] };
    }
  }

  /**
   * Perform reconsideration based on critic feedback
   */
  private async performReconsideration(
    originalConclusion: string,
    steps: ReasoningStep[],
    critiqueResult: CritiqueResult,
    style: ReasoningStyle,
    query: string
  ): Promise<any> {
    this.reconsiderationCount++;
    console.log(`[IterativeMarkov] Performing reconsideration ${this.reconsiderationCount}`);
    
    const additionalSteps: ReasoningStep[] = [];
    let revisedConclusion = originalConclusion;
    let finalConfidence = steps[steps.length - 1]?.confidence || 0.5;
    
    // Address each major critique
    const majorCritiques = critiqueResult.critiques
      .filter(c => c.severity > 0.5)
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 3); // Focus on top 3 critiques
    
    for (const critique of majorCritiques) {
      // Generate a challenging question based on the critique
      const challengingQuestion = this.generateChallengingQuestionFromCritique(critique, query);
      
      // Execute a reasoning step to address the critique
      const reconsiderationStep = await this.executeReasoningStep(
        steps.length + additionalSteps.length + 1,
        'update',
        style,
        challengingQuestion,
        { episodic: [], semantic: [] },
        finalConfidence
      );
      
      reconsiderationStep.hypothesis = `Addressing ${critique.type}: ${reconsiderationStep.hypothesis}`;
      additionalSteps.push(reconsiderationStep);
      
      // Update confidence based on how well we addressed the critique
      finalConfidence = Math.min(0.9, finalConfidence + 0.1);
    }
    
    // Generate revised conclusion incorporating critique responses
    const revisionPrompt = `
Original conclusion: ${originalConclusion}

Critical issues addressed:
${majorCritiques.map(c => `- ${c.description}`).join('\n')}

Responses to critiques:
${additionalSteps.map(s => s.hypothesis).join('\n')}

Generate a revised, more robust conclusion that addresses these critiques while maintaining intellectual honesty about limitations.
`;
    
    revisedConclusion = await this.askLLM(revisionPrompt);
    
    // Re-evaluate with critic (but don't recurse infinitely)
    const reEvaluation = await this.criticSystem.critiqueConclusion(
      revisedConclusion,
      [...steps, ...additionalSteps],
      style,
      finalConfidence
    );
    
    finalConfidence = Math.max(0.1, finalConfidence + reEvaluation.confidenceAdjustment);
    
    return {
      revisedConclusion,
      finalConfidence,
      additionalSteps,
      alternativePerspectives: reEvaluation.alternativePerspectives
    };
  }
  
  /**
   * Present conclusion with alternative perspectives when confidence is low
   */
  private presentWithAlternatives(
    conclusion: string,
    alternatives: AlternativePerspective[],
    confidence: number
  ): string {
    const confidenceLevel = confidence < 0.4 ? 'low' : confidence < 0.6 ? 'moderate' : 'reasonable';
    
    let presentation = `## Primary Conclusion (${confidenceLevel} confidence: ${(confidence * 100).toFixed(0)}%)\n\n`;
    presentation += `${conclusion}\n\n`;
    
    presentation += `## Important Alternative Perspectives\n\n`;
    presentation += `Due to ${confidenceLevel} confidence in the primary conclusion, the following alternative perspectives should be considered:\n\n`;
    
    alternatives.forEach((alt, index) => {
      presentation += `### Alternative ${index + 1}: ${alt.perspective}\n`;
      presentation += `**Reasoning:** ${alt.reasoning}\n`;
      presentation += `**Supporting points:**\n`;
      alt.supportingPoints.forEach(point => {
        presentation += `- ${point}\n`;
      });
      presentation += `**Confidence:** ${(alt.confidence * 100).toFixed(0)}%\n\n`;
    });
    
    presentation += `## Recommendation\n\n`;
    presentation += `Given the complexity and uncertainty in this analysis, it is recommended to:\n`;
    presentation += `1. Consider all perspectives presented above\n`;
    presentation += `2. Gather additional evidence if a definitive conclusion is required\n`;
    presentation += `3. Acknowledge the inherent uncertainty in the reasoning process\n`;
    
    return presentation;
  }
  
  /**
   * Generate challenging question from critique
   */
  private generateChallengingQuestionFromCritique(critique: any, originalQuery: string): string {
    const questionTemplates = {
      logical_inconsistency: `Given the logical gap identified, how can we better connect our premises to our conclusion about: ${originalQuery}?`,
      circular_reasoning: `Without using the conclusion itself as support, what independent evidence exists for: ${originalQuery}?`,
      missing_counterexamples: `What specific cases or examples might contradict our generalization about: ${originalQuery}?`,
      insufficient_evidence: `What additional empirical evidence would strengthen our conclusion about: ${originalQuery}?`,
      confirmation_bias: `What evidence might actually disprove our hypothesis about: ${originalQuery}?`,
      hasty_generalization: `Is our sample size sufficient to make broad claims about: ${originalQuery}?`
    };
    
    return questionTemplates[critique.type] || 
           `How can we address the critique "${critique.description}" in our reasoning about: ${originalQuery}?`;
  }
  
  /**
   * Extract insights from critic evaluation
   */
  private extractCriticInsights(critiqueResult: CritiqueResult): string[] {
    const insights: string[] = [];
    
    if (critiqueResult.critiques.length > 0) {
      insights.push(`Critic identified ${critiqueResult.critiques.length} potential issues`);
      
      const majorIssues = critiqueResult.critiques.filter(c => c.severity > 0.5);
      if (majorIssues.length > 0) {
        insights.push(`Major concerns: ${majorIssues.map(c => c.type).join(', ')}`);
      }
    }
    
    if (critiqueResult.requiresReconsideration) {
      insights.push('Reasoning required reconsideration due to critical issues');
    }
    
    if (critiqueResult.alternativePerspectives.length > 0) {
      insights.push(`${critiqueResult.alternativePerspectives.length} alternative perspectives generated`);
    }
    
    insights.push(`Critic confidence adjustment: ${(critiqueResult.confidenceAdjustment * 100).toFixed(0)}%`);
    
    return insights;
  }

  /**
   * Build contextual question for current reasoning state
   */
  private buildContextualQuestion(
    state: ReasoningState,
    style: ReasoningStyle,
    query: string,
    memories: MemoryContext
  ): string {
    
    // Include accumulated context
    const contextStr = this.currentContext.length > 1 
      ? `\n\nContext from previous steps:\n${this.currentContext.slice(1).join('\n')}`
      : '';

    // Include memory insights
    const memoryStr = memories.episodic.length > 0 || memories.semantic.length > 0
      ? `\n\nRelevant memories:\n${this.formatMemoriesForPrompt(memories)}`
      : '';
    
    // Include challenging questions from critic if available
    const challengingStr = this.challengingQuestions.length > 0
      ? `\n\nCritical questions to consider:\n${this.challengingQuestions.slice(0, 2).map((q, i) => `${i+1}. ${q}`).join('\n')}`
      : '';

    const basePrompt = `${query}${contextStr}${memoryStr}${challengingStr}`;

    // Enhanced state and style specific questions that truly challenge thinking
    const questions = {
      inductive: {
        analyze: 'What patterns are evident, and more importantly, what patterns might we be imagining that don\'t actually exist? Consider both regularities AND irregularities.',
        hypothesize: 'Given these patterns, what general rule accounts for them? But also: What alternative rules could explain the same observations? What would falsify this rule?',
        test: 'If this rule were true, what surprising or non-obvious predictions follow? What would we NOT expect to see if this rule is correct?',
        observe: 'Does evidence support the prediction? More critically: What evidence contradicts it? Are we cherry-picking supportive data?',
        update: 'How must we refine or completely revise the rule? Should we abandon it for a different approach? What assumptions were wrong?',
        conclude: 'State the most probable rule, but also explicitly state its limitations, exceptions, and confidence level.'
      },
      deductive: {
        analyze: 'Which rules apply? But first: Are we certain these rules are valid? What hidden premises are we assuming? Could the rules be wrong?',
        hypothesize: 'What conclusion follows? But also: What other conclusions could follow from different interpretations? Are we committing any logical fallacies?',
        test: 'What inference chain supports this? But critically: Where are the weak links? What assumptions make the chain fragile?',
        observe: 'Do premises hold? More importantly: Under what conditions would they NOT hold? Are we in one of those conditions?',
        update: 'How should we adjust our logic? Should we question the fundamental premises themselves? What if our framework is wrong?',
        conclude: 'State the conclusion, but also state what must be true for this conclusion to be valid, and what would invalidate it.'
      },
      abductive: {
        analyze: 'What needs explanation? But also: Are we focusing on the right anomalies? What are we NOT seeing that might be more important?',
        hypothesize: 'What explains this? But crucially: What are ALL the possible explanations? Why might each be wrong? What\'s the null hypothesis?',
        test: 'What evidence would this predict? But also: What evidence would DISPROVE this explanation? Are we seeking disconfirmation?',
        observe: 'What evidence exists? More critically: What evidence is conspicuously absent? What doesn\'t fit? Are we forcing the explanation?',
        update: 'How should we revise? But fundamentally: Should we abandon this explanation entirely? Is there a simpler explanation (Occam\'s Razor)?',
        conclude: 'State the best explanation, but also present the second-best alternative and why we might be wrong about our choice.'
      }
    };

    const stateQuestion = questions[style]?.[state] || questions.inductive[state];
    
    return `${basePrompt}\n\nBased on the above information, ${stateQuestion}`;
  }

  /**
   * Ask LLM for reasoning step response
   */
  private async askLLM(question: string): Promise<string> {
    try {
      // This would integrate with the existing LLM system
      // For now, return a placeholder response
      console.log(`[IterativeMarkov] LLM Question: ${question.substring(0, 100)}...`);
      
      // Simulate LLM call
      this.totalTokens += 50; // Placeholder token count
      
      return `Reasoning step response for: ${question.substring(0, 50)}...`;
      
    } catch (error) {
      console.error('[IterativeMarkov] LLM call failed:', error);
      return 'Unable to generate reasoning step due to error';
    }
  }

  /**
   * Update confidence based on step results and memory alignment
   */
  private updateConfidence(
    currentConfidence: number,
    step: ReasoningStep,
    memories: MemoryContext
  ): number {
    let newConfidence = currentConfidence;

    // Boost confidence if we have supporting memories
    if (memories.episodic.length > 0 || memories.semantic.length > 0) {
      newConfidence += 0.05;
    }

    // Boost confidence if observation was successful
    if (step.observation && step.observation.result === 'validated') {
      newConfidence += step.observation.confidence_boost || 0.1;
    }

    // Natural confidence progression through reasoning
    if (step.state === 'update' || step.state === 'conclude') {
      newConfidence += 0.1;
    }

    return Math.min(0.95, Math.max(0.1, newConfidence));
  }

  /**
   * Accumulate context from reasoning step
   */
  private accumulateContext(step: ReasoningStep): void {
    if (step.hypothesis) {
      this.currentContext.push(`${step.state}: ${step.hypothesis}`);
    }
    
    // Keep context manageable
    if (this.currentContext.length > 10) {
      this.currentContext = this.currentContext.slice(-8);
    }
  }

  /**
   * Get next Markov state based on weights and confidence
   */
  private getNextState(
    currentState: ReasoningState,
    weights: any,
    confidence: number
  ): ReasoningState {
    const stateWeights = weights[currentState] || {};
    
    // Adjust weights based on confidence
    if (confidence >= this.config.confidenceThreshold * 0.8) {
      stateWeights.conclude = (stateWeights.conclude || 0) + 0.3;
    }

    // Convert to probability distribution
    const entries = Object.entries(stateWeights) as Array<[ReasoningState, number]>;
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0) || 1;
    
    // Random selection based on weights
    let random = Math.random() * total;
    for (const [state, weight] of entries) {
      random -= weight;
      if (random <= 0) {
        return state;
      }
    }
    
    return 'conclude'; // Fallback
  }

  /**
   * Generate final conclusion from reasoning steps
   */
  private async generateConclusion(
    steps: ReasoningStep[],
    originalQuery: string,
    confidence: number
  ): Promise<string> {
    const stepSummaries = steps
      .map(s => `${s.state}: ${s.hypothesis}`)
      .join('\n');
    
    const conclusionPrompt = `
Original query: ${originalQuery}

Reasoning steps:
${stepSummaries}

Final confidence: ${confidence.toFixed(2)}

Based on this reasoning chain, provide a clear, concise conclusion that directly answers the original query.
`;

    return await this.askLLM(conclusionPrompt);
  }

  /**
   * Extract insights from reasoning chain
   */
  private extractInsights(steps: ReasoningStep[]): string[] {
    const insights: string[] = [];
    
    // Pattern insights
    const states = steps.map(s => s.state);
    const stateTransitions = states.slice(1).map((state, i) => `${states[i]} → ${state}`);
    insights.push(`Reasoning pattern: ${stateTransitions.join(' → ')}`);
    
    // Confidence progression
    const confidences = steps.map(s => s.confidence);
    const confidenceChange = confidences[confidences.length - 1] - confidences[0];
    insights.push(`Confidence progression: ${confidenceChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(confidenceChange).toFixed(2)}`);
    
    // Memory usage
    if (this.memoryConnections.episodic.length > 0 || this.memoryConnections.semantic.length > 0) {
      insights.push(`Used ${this.memoryConnections.episodic.length} episodic and ${this.memoryConnections.semantic.length} semantic memories`);
    }
    
    return insights;
  }

  /**
   * Store reasoning step in database
   */
  private async storeReasoningStep(stepData: any): Promise<void> {
    try {
      const { error } = await this.config.supabase
        .from('reasoning_steps')
        .insert(stepData);
      
      if (error) {
        console.error('[IterativeMarkov] Failed to store step:', error);
      }
    } catch (error) {
      console.error('[IterativeMarkov] Database error storing step:', error);
    }
  }

  /**
   * Format memories for LLM prompt
   */
  private formatMemoriesForPrompt(memories: MemoryContext): string {
    const sections: string[] = [];
    
    if (memories.episodic.length > 0) {
      sections.push('Past experiences: ' + memories.episodic.map(m => 
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      ).join('; '));
    }
    
    if (memories.semantic.length > 0) {
      sections.push('Known concepts: ' + memories.semantic.map(m => 
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      ).join('; '));
    }
    
    return sections.join('\n');
  }

  /**
   * Extract insights from memories
   */
  private extractMemoryInsights(memories: MemoryContext): string[] {
    const insights: string[] = [];
    
    if (memories.episodic.length > 0) {
      insights.push(`Referenced ${memories.episodic.length} past experiences`);
    }
    
    if (memories.semantic.length > 0) {
      insights.push(`Applied ${memories.semantic.length} known concepts`);
    }
    
    return insights;
  }
}
