import { ReasoningStyle, ComplexityAnalysis } from './types.ts';

/**
 * ComplexityAnalyzer - Analyzes query complexity and recommends reasoning style
 * 
 * This analyzer evaluates multiple factors to determine:
 * 1. Overall complexity score
 * 2. Appropriate reasoning style
 * 3. Confidence in the recommendation
 */
export class ComplexityAnalyzer {
  
  /**
   * Analyze query complexity and return detailed analysis
   */
  async analyze(query: string): Promise<ComplexityAnalysis> {
    const factors = this.extractComplexityFactors(query);
    const score = this.calculateComplexityScore(factors);
    const recommendedStyle = this.recommendStyle({ score, factors, query });
    const reasoning = this.explainRecommendation(factors, recommendedStyle);

    return {
      score,
      factors,
      recommendedStyle,
      reasoning
    };
  }

  /**
   * Recommend reasoning style based on complexity analysis
   */
  recommendStyle(analysis: { score: number; factors: any; query: string }): ReasoningStyle {
    const { query, factors } = analysis;
    
    // Check for explicit reasoning style indicators
    const explicitStyle = this.detectExplicitStyle(query);
    if (explicitStyle) {
      return explicitStyle;
    }

    // Analyze query patterns
    const patterns = this.analyzeQueryPatterns(query);
    
    // Decision logic based on patterns and complexity
    if (patterns.hasObservations && patterns.hasPatternWords) {
      return 'inductive'; // Pattern recognition from observations
    }
    
    if (patterns.hasRules && patterns.hasLogicalWords) {
      return 'deductive'; // Logical deduction from rules
    }
    
    if (patterns.hasAnomalies || patterns.hasExplanationWords) {
      return 'abductive'; // Explanation of observations
    }
    
    if (patterns.hasComparisons) {
      return 'analogical'; // Comparison-based reasoning
    }
    
    if (patterns.hasCausalWords) {
      return 'causal'; // Cause-effect relationships
    }
    
    if (patterns.hasProbabilityWords) {
      return 'probabilistic'; // Uncertainty and probability
    }

    // Default based on complexity score
    if (analysis.score < 0.3) {
      return 'deductive'; // Simple, direct reasoning
    } else if (analysis.score < 0.7) {
      return 'inductive'; // Moderate complexity, pattern-based
    } else {
      return 'abductive'; // High complexity, explanation-seeking
    }
  }

  /**
   * Extract complexity factors from query
   */
  private extractComplexityFactors(query: string) {
    const length = query.length;
    const words = query.toLowerCase().split(/\s+/);
    
    // Question word indicators
    const questionWords = this.countMatches(query, [
      'what', 'why', 'how', 'when', 'where', 'which', 'who',
      'explain', 'describe', 'analyze', 'compare', 'evaluate'
    ]);

    // Reasoning keyword indicators
    const reasoningKeywords = this.countMatches(query, [
      'because', 'therefore', 'since', 'given', 'assuming',
      'if', 'then', 'implies', 'leads to', 'results in',
      'pattern', 'trend', 'relationship', 'correlation',
      'cause', 'effect', 'reason', 'explanation'
    ]);

    // Context density (complex sentence structures)
    const contextDensity = this.calculateContextDensity(query);

    return {
      length: Math.min(1.0, length / 500), // Normalize to 0-1
      questionWords: Math.min(1.0, questionWords / 3), // Normalize to 0-1
      contextDensity,
      reasoningKeywords: Math.min(1.0, reasoningKeywords / 5) // Normalize to 0-1
    };
  }

  /**
   * Calculate overall complexity score
   */
  private calculateComplexityScore(factors: any): number {
    const weights = {
      length: 0.2,
      questionWords: 0.3,
      contextDensity: 0.3,
      reasoningKeywords: 0.2
    };

    return Math.min(1.0, Math.max(0.0,
      factors.length * weights.length +
      factors.questionWords * weights.questionWords +
      factors.contextDensity * weights.contextDensity +
      factors.reasoningKeywords * weights.reasoningKeywords
    ));
  }

  /**
   * Detect explicit reasoning style indicators
   */
  private detectExplicitStyle(query: string): ReasoningStyle | null {
    const lowerQuery = query.toLowerCase();

    // Explicit style keywords
    if (this.hasAnyMatch(lowerQuery, ['inductive', 'pattern', 'generalize', 'observe'])) {
      return 'inductive';
    }
    
    if (this.hasAnyMatch(lowerQuery, ['deductive', 'logical', 'prove', 'given that'])) {
      return 'deductive';
    }
    
    if (this.hasAnyMatch(lowerQuery, ['abductive', 'explain', 'best explanation', 'why'])) {
      return 'abductive';
    }
    
    if (this.hasAnyMatch(lowerQuery, ['analogical', 'similar', 'like', 'compare'])) {
      return 'analogical';
    }
    
    if (this.hasAnyMatch(lowerQuery, ['causal', 'cause', 'effect', 'because', 'leads to'])) {
      return 'causal';
    }
    
    if (this.hasAnyMatch(lowerQuery, ['probabilistic', 'likely', 'chance', 'probability'])) {
      return 'probabilistic';
    }

    return null;
  }

  /**
   * Analyze query patterns for reasoning style hints
   */
  private analyzeQueryPatterns(query: string) {
    const lowerQuery = query.toLowerCase();

    return {
      hasObservations: this.hasAnyMatch(lowerQuery, [
        'observe', 'notice', 'see', 'data shows', 'evidence', 'examples'
      ]),
      hasPatternWords: this.hasAnyMatch(lowerQuery, [
        'pattern', 'trend', 'consistent', 'regular', 'always', 'usually'
      ]),
      hasRules: this.hasAnyMatch(lowerQuery, [
        'rule', 'law', 'principle', 'given', 'assume', 'if'
      ]),
      hasLogicalWords: this.hasAnyMatch(lowerQuery, [
        'therefore', 'thus', 'hence', 'follows', 'implies', 'must'
      ]),
      hasAnomalies: this.hasAnyMatch(lowerQuery, [
        'strange', 'unusual', 'unexpected', 'anomaly', 'surprising'
      ]),
      hasExplanationWords: this.hasAnyMatch(lowerQuery, [
        'explain', 'why', 'reason', 'account for', 'justify'
      ]),
      hasComparisons: this.hasAnyMatch(lowerQuery, [
        'similar', 'like', 'compare', 'analogy', 'parallel'
      ]),
      hasCausalWords: this.hasAnyMatch(lowerQuery, [
        'cause', 'effect', 'because', 'due to', 'leads to', 'results in'
      ]),
      hasProbabilityWords: this.hasAnyMatch(lowerQuery, [
        'likely', 'probable', 'chance', 'odds', 'maybe', 'possibly'
      ])
    };
  }

  /**
   * Calculate context density based on sentence complexity
   */
  private calculateContextDensity(query: string): number {
    const sentences = query.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgWordsPerSentence = query.split(/\s+/).length / Math.max(1, sentences.length);
    const commaCount = (query.match(/,/g) || []).length;
    const clauseIndicators = this.countMatches(query, [
      'which', 'that', 'where', 'when', 'while', 'although', 'because'
    ]);

    // Normalize complexity indicators
    const lengthComplexity = Math.min(1.0, avgWordsPerSentence / 20);
    const punctuationComplexity = Math.min(1.0, commaCount / 5);
    const clauseComplexity = Math.min(1.0, clauseIndicators / 3);

    return (lengthComplexity + punctuationComplexity + clauseComplexity) / 3;
  }

  /**
   * Generate explanation for reasoning style recommendation
   */
  private explainRecommendation(factors: any, style: ReasoningStyle): string {
    const explanations = {
      inductive: 'Query suggests pattern recognition from observations or examples',
      deductive: 'Query involves logical deduction from established rules or premises',
      abductive: 'Query seeks explanation for observations or anomalies',
      analogical: 'Query involves comparison or similarity analysis',
      causal: 'Query focuses on cause-effect relationships',
      probabilistic: 'Query involves uncertainty or probability assessment'
    };

    const complexityLevel = factors.length + factors.questionWords + factors.contextDensity + factors.reasoningKeywords;
    const complexityDesc = complexityLevel < 0.3 ? 'low' : complexityLevel < 0.7 ? 'moderate' : 'high';

    return `${explanations[style]} (complexity: ${complexityDesc})`;
  }

  /**
   * Count matches of keywords in text
   */
  private countMatches(text: string, keywords: string[]): number {
    const lowerText = text.toLowerCase();
    return keywords.reduce((count, keyword) => {
      return count + (lowerText.includes(keyword) ? 1 : 0);
    }, 0);
  }

  /**
   * Check if text has any of the given matches
   */
  private hasAnyMatch(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }
}
