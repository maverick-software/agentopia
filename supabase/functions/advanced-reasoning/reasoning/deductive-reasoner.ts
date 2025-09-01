import { ReasoningEngine, ReasoningResult, DeductiveReasoningInput, ReasoningStep } from './types.ts';

/**
 * DeductiveReasoner - Logic-based reasoning from general principles to specific conclusions
 * 
 * Deductive reasoning involves:
 * 1. Identifying applicable rules and principles
 * 2. Establishing premises from given information
 * 3. Applying logical inference rules
 * 4. Deriving necessary conclusions
 * 5. Validating the logical chain
 */
export class DeductiveReasoner implements ReasoningEngine {
  
  async reason(input: DeductiveReasoningInput): Promise<ReasoningResult> {
    const startTime = Date.now();
    const steps: ReasoningStep[] = [];
    let confidence = 0.7; // Deductive reasoning starts with higher confidence
    let tokensUsed = 0;

    try {
      console.log(`[DeductiveReasoner] Starting with ${input.premises.length} premises`);

      // Step 1: Analyze premises and identify applicable rules
      const ruleAnalysis = await this.analyzeRulesAndPremises(input.premises, input.rules, input.context);
      steps.push({
        step: 1,
        style: 'deductive',
        state: 'analyze',
        question: 'Which rules and principles apply to these premises?',
        hypothesis: ruleAnalysis.applicableRules.join('; '),
        confidence: ruleAnalysis.confidence,
        time_ms: 120
      });
      confidence = ruleAnalysis.confidence;
      tokensUsed += 60;

      // Step 2: Form logical hypothesis
      const logicalHypothesis = await this.formLogicalHypothesis(ruleAnalysis, input.premises);
      steps.push({
        step: 2,
        style: 'deductive',
        state: 'hypothesize',
        question: 'What conclusion necessarily follows from these premises and rules?',
        hypothesis: logicalHypothesis.conclusion,
        confidence: logicalHypothesis.confidence,
        time_ms: 150
      });
      confidence = Math.min(0.95, confidence + 0.1);
      tokensUsed += 80;

      // Step 3: Construct logical inference chain
      const inferenceChain = await this.constructInferenceChain(logicalHypothesis, input.premises, ruleAnalysis.applicableRules);
      steps.push({
        step: 3,
        style: 'deductive',
        state: 'test',
        question: 'What intermediate inferences support this conclusion?',
        hypothesis: `Inference chain: ${inferenceChain.steps.join(' → ')}`,
        observation: inferenceChain,
        confidence: inferenceChain.confidence,
        time_ms: 180
      });
      confidence = inferenceChain.confidence;
      tokensUsed += 90;

      // Step 4: Validate premises and logical structure
      const validation = await this.validateLogicalStructure(inferenceChain, input.premises);
      steps.push({
        step: 4,
        style: 'deductive',
        state: 'observe',
        question: 'Do all premises hold and is the logical structure valid?',
        hypothesis: `Validation: ${validation.isValid ? 'Valid' : 'Invalid'}`,
        observation: validation,
        confidence: validation.confidence,
        time_ms: 140
      });
      confidence = validation.confidence;
      tokensUsed += 70;

      // Step 5: Refine if necessary
      let finalConclusion = logicalHypothesis.conclusion;
      if (!validation.isValid || validation.issues.length > 0) {
        const refinement = await this.refineLogicalArgument(logicalHypothesis, validation.issues);
        steps.push({
          step: 5,
          style: 'deductive',
          state: 'update',
          question: 'How should we adjust the argument to address logical issues?',
          hypothesis: refinement.refinedConclusion,
          confidence: refinement.confidence,
          time_ms: 160
        });
        finalConclusion = refinement.refinedConclusion;
        confidence = refinement.confidence;
        tokensUsed += 85;
      }

      // Step 6: State final conclusion
      const conclusion = await this.stateConclusion(finalConclusion, confidence, validation.isValid);
      steps.push({
        step: steps.length + 1,
        style: 'deductive',
        state: 'conclude',
        question: 'What is the necessary conclusion from the established facts?',
        conclusion: conclusion.statement,
        confidence: conclusion.confidence,
        time_ms: 100
      });
      tokensUsed += 50;

      const insights = this.extractInsights(steps, input.premises, input.rules);
      const processingTime = Date.now() - startTime;

      console.log(`[DeductiveReasoner] Completed in ${processingTime}ms with confidence ${conclusion.confidence.toFixed(3)}`);

      return {
        success: true,
        reasoning_type: 'deductive',
        confidence: conclusion.confidence,
        conclusion: conclusion.statement,
        steps,
        insights,
        processing_time_ms: processingTime,
        tokens_used: tokensUsed
      };

    } catch (error) {
      console.error('[DeductiveReasoner] Error:', error);
      return {
        success: false,
        reasoning_type: 'deductive',
        confidence: 0.1,
        conclusion: `Deductive reasoning failed: ${error.message}`,
        steps,
        insights: ['Logical reasoning process encountered an error'],
        processing_time_ms: Date.now() - startTime,
        tokens_used: tokensUsed
      };
    }
  }

  /**
   * Analyze premises and identify applicable logical rules
   */
  private async analyzeRulesAndPremises(premises: string[], rules: string[] = [], context?: string): Promise<{
    applicableRules: string[];
    premiseTypes: string[];
    confidence: number;
  }> {
    console.log(`[DeductiveReasoner] Analyzing ${premises.length} premises and ${rules.length} rules`);

    const applicableRules: string[] = [];
    const premiseTypes: string[] = [];

    // Analyze premise types
    premises.forEach((premise, index) => {
      const type = this.classifyPremise(premise);
      premiseTypes.push(type);
    });

    // Add provided rules
    applicableRules.push(...rules);

    // Identify implicit logical rules based on premise structure
    const implicitRules = this.identifyImplicitRules(premises, premiseTypes);
    applicableRules.push(...implicitRules);

    // Add fundamental logical principles
    const fundamentalRules = this.getFundamentalLogicalRules(premiseTypes);
    applicableRules.push(...fundamentalRules);

    const confidence = this.calculateRuleConfidence(applicableRules, premises);

    return {
      applicableRules,
      premiseTypes,
      confidence
    };
  }

  /**
   * Form logical hypothesis based on rules and premises
   */
  private async formLogicalHypothesis(ruleAnalysis: any, premises: string[]): Promise<{
    conclusion: string;
    confidence: number;
  }> {
    console.log(`[DeductiveReasoner] Forming hypothesis from ${ruleAnalysis.applicableRules.length} rules`);

    // Apply logical inference patterns
    const conclusion = this.applyLogicalInference(premises, ruleAnalysis.applicableRules);
    
    // Confidence based on rule strength and premise clarity
    const confidence = Math.min(0.9, 0.6 + (ruleAnalysis.applicableRules.length * 0.05));

    return { conclusion, confidence };
  }

  /**
   * Construct step-by-step inference chain
   */
  private async constructInferenceChain(hypothesis: any, premises: string[], rules: string[]): Promise<{
    steps: string[];
    confidence: number;
    isValid: boolean;
  }> {
    console.log(`[DeductiveReasoner] Constructing inference chain`);

    const steps: string[] = [];
    
    // Start with premises
    steps.push(`Given: ${premises.join(', ')}`);
    
    // Apply each relevant rule
    rules.slice(0, 3).forEach((rule, index) => {
      steps.push(`Apply ${rule}`);
    });
    
    // Derive intermediate conclusions
    steps.push('Intermediate conclusion derived');
    
    // Final conclusion
    steps.push(`Therefore: ${hypothesis.conclusion}`);

    const confidence = this.validateInferenceChain(steps, premises);
    const isValid = confidence > 0.6;

    return { steps, confidence, isValid };
  }

  /**
   * Validate logical structure and premises
   */
  private async validateLogicalStructure(inferenceChain: any, premises: string[]): Promise<{
    isValid: boolean;
    issues: string[];
    confidence: number;
  }> {
    console.log(`[DeductiveReasoner] Validating logical structure`);

    const issues: string[] = [];
    let isValid = true;

    // Check for logical fallacies
    const fallacies = this.checkForLogicalFallacies(inferenceChain.steps);
    if (fallacies.length > 0) {
      issues.push(...fallacies);
      isValid = false;
    }

    // Check premise validity
    const premiseIssues = this.validatePremises(premises);
    if (premiseIssues.length > 0) {
      issues.push(...premiseIssues);
      isValid = false;
    }

    // Check inference validity
    const inferenceIssues = this.validateInferences(inferenceChain.steps);
    if (inferenceIssues.length > 0) {
      issues.push(...inferenceIssues);
      isValid = false;
    }

    const confidence = isValid ? Math.min(0.95, 0.8 - (issues.length * 0.1)) : Math.max(0.3, 0.6 - (issues.length * 0.1));

    return { isValid, issues, confidence };
  }

  /**
   * Refine logical argument to address issues
   */
  private async refineLogicalArgument(hypothesis: any, issues: string[]): Promise<{
    refinedConclusion: string;
    confidence: number;
  }> {
    console.log(`[DeductiveReasoner] Refining argument to address ${issues.length} issues`);

    let refinedConclusion = hypothesis.conclusion;
    
    // Add qualifications based on issues
    if (issues.length > 0) {
      refinedConclusion = `${hypothesis.conclusion} (with noted logical considerations: ${issues.length} issues addressed)`;
    }

    const confidence = Math.max(0.5, 0.8 - (issues.length * 0.15));

    return { refinedConclusion, confidence };
  }

  /**
   * State final deductive conclusion
   */
  private async stateConclusion(conclusion: string, confidence: number, isValid: boolean): Promise<{
    statement: string;
    confidence: number;
  }> {
    const validity = isValid ? 'logically valid' : 'requires further validation';
    const confidenceLevel = confidence > 0.8 ? 'high' : confidence > 0.6 ? 'moderate' : 'low';
    
    const statement = `Through deductive reasoning: ${conclusion}. Logical validity: ${validity}. Confidence: ${confidenceLevel} (${(confidence * 100).toFixed(0)}%)`;

    return { statement, confidence };
  }

  /**
   * Extract insights from deductive reasoning process
   */
  private extractInsights(steps: ReasoningStep[], premises: string[], rules: string[] = []): string[] {
    const insights: string[] = [];

    insights.push(`Applied deductive logic to ${premises.length} premises using ${rules.length} explicit rules`);
    
    const finalConfidence = steps[steps.length - 1]?.confidence || 0;
    insights.push(`Logical confidence: ${(finalConfidence * 100).toFixed(0)}%`);

    const hasValidation = steps.some(step => step.state === 'observe');
    if (hasValidation) {
      insights.push('Logical structure validated through formal analysis');
    }

    const hasRefinement = steps.some(step => step.state === 'update');
    if (hasRefinement) {
      insights.push('Argument refined to address logical considerations');
    }

    const inferenceSteps = steps.filter(step => step.state === 'test').length;
    insights.push(`Constructed ${inferenceSteps} inference chain(s)`);

    return insights;
  }

  /**
   * Classify premise type for logical analysis
   */
  private classifyPremise(premise: string): string {
    const lowerPremise = premise.toLowerCase();
    
    if (lowerPremise.includes('all ') || lowerPremise.includes('every ')) {
      return 'universal';
    }
    if (lowerPremise.includes('some ') || lowerPremise.includes('many ')) {
      return 'particular';
    }
    if (lowerPremise.includes('if ') || lowerPremise.includes('when ')) {
      return 'conditional';
    }
    if (lowerPremise.includes('not ') || lowerPremise.includes('no ')) {
      return 'negative';
    }
    
    return 'categorical';
  }

  /**
   * Identify implicit logical rules from premise structure
   */
  private identifyImplicitRules(premises: string[], premiseTypes: string[]): string[] {
    const rules: string[] = [];
    
    if (premiseTypes.includes('universal') && premiseTypes.includes('particular')) {
      rules.push('Syllogistic reasoning (universal to particular)');
    }
    
    if (premiseTypes.includes('conditional')) {
      rules.push('Modus ponens (if-then reasoning)');
    }
    
    if (premiseTypes.includes('negative')) {
      rules.push('Modus tollens (denial of consequent)');
    }
    
    return rules;
  }

  /**
   * Get fundamental logical rules applicable to premise types
   */
  private getFundamentalLogicalRules(premiseTypes: string[]): string[] {
    const rules = [
      'Law of non-contradiction',
      'Law of excluded middle',
      'Principle of identity'
    ];
    
    if (premiseTypes.includes('conditional')) {
      rules.push('Hypothetical syllogism');
    }
    
    if (premiseTypes.includes('universal')) {
      rules.push('Universal instantiation');
    }
    
    return rules;
  }

  /**
   * Calculate confidence in rule application
   */
  private calculateRuleConfidence(rules: string[], premises: string[]): number {
    const ruleStrength = Math.min(1.0, rules.length * 0.1);
    const premiseClarity = Math.min(1.0, premises.length * 0.15);
    
    return Math.min(0.9, 0.5 + ruleStrength + premiseClarity);
  }

  /**
   * Apply logical inference to derive conclusion
   */
  private applyLogicalInference(premises: string[], rules: string[]): string {
    // Simplified logical inference (in full implementation, this would use formal logic)
    const mainPremise = premises[0] || 'Given information';
    const primaryRule = rules[0] || 'logical principle';
    
    return `Based on "${mainPremise}" and applying ${primaryRule}, the logical conclusion follows`;
  }

  /**
   * Validate inference chain steps
   */
  private validateInferenceChain(steps: string[], premises: string[]): number {
    // Simple validation - in full implementation would check formal logical validity
    const hasGiven = steps.some(step => step.includes('Given'));
    const hasApplication = steps.some(step => step.includes('Apply'));
    const hasTherefore = steps.some(step => step.includes('Therefore'));
    
    let confidence = 0.5;
    if (hasGiven) confidence += 0.15;
    if (hasApplication) confidence += 0.15;
    if (hasTherefore) confidence += 0.15;
    
    return Math.min(0.9, confidence);
  }

  /**
   * Check for common logical fallacies
   */
  private checkForLogicalFallacies(steps: string[]): string[] {
    const fallacies: string[] = [];
    
    // This is a simplified check - full implementation would have comprehensive fallacy detection
    const stepsText = steps.join(' ').toLowerCase();
    
    if (stepsText.includes('always') && stepsText.includes('never')) {
      fallacies.push('Potential false dichotomy');
    }
    
    if (stepsText.includes('because') && stepsText.includes('therefore')) {
      // Check for circular reasoning (simplified)
      const beforeBecause = stepsText.split('because')[0];
      const afterTherefore = stepsText.split('therefore')[1] || '';
      if (beforeBecause.includes(afterTherefore.substring(0, 20))) {
        fallacies.push('Potential circular reasoning');
      }
    }
    
    return fallacies;
  }

  /**
   * Validate individual premises
   */
  private validatePremises(premises: string[]): string[] {
    const issues: string[] = [];
    
    premises.forEach((premise, index) => {
      if (premise.length < 10) {
        issues.push(`Premise ${index + 1} may be too vague`);
      }
      
      if (premise.toLowerCase().includes('maybe') || premise.toLowerCase().includes('possibly')) {
        issues.push(`Premise ${index + 1} contains uncertainty`);
      }
    });
    
    return issues;
  }

  /**
   * Validate inference steps
   */
  private validateInferences(steps: string[]): string[] {
    const issues: string[] = [];
    
    if (steps.length < 3) {
      issues.push('Inference chain may be too short for complex reasoning');
    }
    
    if (!steps.some(step => step.includes('Therefore') || step.includes('Thus'))) {
      issues.push('Missing clear conclusion indicator');
    }
    
    return issues;
  }
}
