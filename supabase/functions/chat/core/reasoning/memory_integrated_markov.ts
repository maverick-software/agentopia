import { ReasoningState, ReasoningStyle, ReasoningStep } from './types.ts';
import { MemoryManager } from '../memory/memory_manager.ts';

type Weights = Record<ReasoningState, Partial<Record<ReasoningState, number>>>;

interface MemoryContext {
  episodic: Array<{
    id: string;
    content: any;
    relevance_score?: number;
    created_at: string;
    importance?: number;
  }>;
  semantic: Array<{
    id?: string;
    content: any;
    relevance_score?: number;
    source?: string;
  }>;
}

interface EnhancedReasoningStep extends ReasoningStep {
  memories_used?: MemoryContext;
  memory_insights?: string[];
}

const baseWeights: Weights = {
  analyze: { hypothesize: 0.7, conclude: 0.3 },
  hypothesize: { test: 0.6, conclude: 0.4 },
  test: { observe: 1.0 },
  observe: { update: 0.8, conclude: 0.2 },
  update: { hypothesize: 0.7, conclude: 0.3 },
  conclude: {},
};

export class MemoryIntegratedMarkov {
  private weights: Weights;
  private style: ReasoningStyle;
  private tools: string[];
  private facts: string[];
  private memoryManager: MemoryManager | null;
  private agentId: string;
  private query: string;
  
  constructor(opts: { 
    style?: ReasoningStyle; 
    toolsAvailable?: string[]; 
    facts?: string[];
    memoryManager?: MemoryManager;
    agentId?: string;
    query?: string;
  }) {
    this.weights = JSON.parse(JSON.stringify(baseWeights));
    this.style = opts.style || 'inductive';
    this.tools = opts.toolsAvailable || [];
    this.facts = opts.facts || [];
    this.memoryManager = opts.memoryManager || null;
    this.agentId = opts.agentId || '';
    this.query = opts.query || '';
    
    // Adjust transition weights dynamically per style
    if (this.style === 'abductive') {
      this.bump('analyze', 'hypothesize', 0.2);
      this.bump('hypothesize', 'test', 0.25);
      this.bump('observe', 'update', 0.2);
    } else if (this.style === 'deductive') {
      this.bump('analyze', 'conclude', 0.35);
      this.bump('hypothesize', 'conclude', 0.2);
    } else if (this.style === 'inductive') {
      this.bump('analyze', 'observe', 0.3);
      this.bump('observe', 'update', 0.2);
      this.bump('update', 'conclude', 0.2);
    }
    
    // If tools are available, make tests more likely
    if (this.tools.length) {
      this.bump('hypothesize', 'test', 0.2);
      this.bump('analyze', 'test', 0.1);
    }
  }

  private bump(from: ReasoningState, to: ReasoningState, delta: number) {
    const row = (this.weights[from] = this.weights[from] || {});
    row[to] = (row[to] || 0) + delta;
  }

  next(current: ReasoningState, infoGap: number, confidence: number): ReasoningState {
    const w = { ...this.weights[current] };
    if (current === 'analyze' || current === 'hypothesize') {
      w.test = (w.test || 0) + Math.max(0, Math.min(0.3, infoGap));
    }
    if (current === 'observe' || current === 'update') {
      w.conclude = (w.conclude || 0) + Math.max(0, Math.min(0.3, confidence));
    }
    const entries = Object.entries(w) as Array<[ReasoningState, number]>;
    const total = entries.reduce((s, [,v]) => s + v, 0) || 1;
    let r = Math.random() * total;
    for (const [state, v] of entries) { 
      r -= v; 
      if (r <= 0) return state; 
    }
    return 'conclude';
  }

  /**
   * Retrieve relevant memories for the current reasoning step
   */
  private async retrieveMemoriesForStep(
    state: ReasoningState, 
    question: string,
    previousSteps: EnhancedReasoningStep[]
  ): Promise<MemoryContext> {
    if (!this.memoryManager || !this.agentId) {
      console.log(`[MemoryIntegratedMarkov] No memory manager (${!!this.memoryManager}) or agent ID (${this.agentId})`);
      return { episodic: [], semantic: [] };
    }

    try {
      // Build context-aware query based on reasoning state
      let memoryQuery = question;
      
      // Add context from previous steps
      if (previousSteps.length > 0) {
        const lastStep = previousSteps[previousSteps.length - 1];
        if (lastStep.hypothesis) {
          memoryQuery = `${memoryQuery} Context: ${lastStep.hypothesis}`;
        }
      }

      // Retrieve memories with contextual search
      const memories = await this.memoryManager.contextualSearch(
        this.agentId,
        memoryQuery,
        {
          memory_types: ['episodic', 'semantic']
        }
      );

      // Filter and format memories based on reasoning state
      let episodicMemories = memories.episodic || [];
      let semanticMemories = memories.semantic || [];

      // State-specific memory filtering
      switch (state) {
        case 'analyze':
          // Focus on recent similar experiences
          episodicMemories = episodicMemories.slice(0, 3);
          semanticMemories = semanticMemories.slice(0, 5);
          break;
        case 'hypothesize':
          // Focus on conceptual knowledge
          episodicMemories = episodicMemories.slice(0, 2);
          semanticMemories = semanticMemories.slice(0, 7);
          break;
        case 'test':
          // Focus on procedural and validation memories
          episodicMemories = episodicMemories.filter((m: any) => 
            m.content?.outcome || m.content?.validation
          ).slice(0, 3);
          break;
        case 'observe':
          // Focus on outcome-related memories
          episodicMemories = episodicMemories.filter((m: any) => 
            m.content?.outcome || m.content?.result
          ).slice(0, 4);
          break;
        case 'update':
          // Balance both types
          episodicMemories = episodicMemories.slice(0, 3);
          semanticMemories = semanticMemories.slice(0, 3);
          break;
        case 'conclude':
          // Focus on high-importance memories
          episodicMemories = episodicMemories
            .sort((a: any, b: any) => (b.importance || 0) - (a.importance || 0))
            .slice(0, 2);
          semanticMemories = semanticMemories.slice(0, 3);
          break;
      }

      return {
        episodic: episodicMemories,
        semantic: semanticMemories
      };
    } catch (error) {
      console.error(`[MemoryIntegratedMarkov] Failed to retrieve memories:`, error);
      return { episodic: [], semantic: [] };
    }
  }

  /**
   * Format memories into a context string for the LLM
   */
  private formatMemoriesForPrompt(memories: MemoryContext): string {
    const sections: string[] = [];
    
    if (memories.episodic.length > 0) {
      sections.push('=== Past Experiences ===');
      memories.episodic.forEach((mem, idx) => {
        const content = mem.content;
        const event = content?.event || 'Past interaction';
        const outcome = content?.outcome || '';
        const context = content?.context ? 
          `Context: ${JSON.stringify(content.context).substring(0, 200)}` : '';
        
        sections.push(`Experience ${idx + 1}: ${event}`);
        if (outcome) sections.push(`  Outcome: ${outcome}`);
        if (context) sections.push(`  ${context}`);
        if (mem.relevance_score) {
          sections.push(`  Relevance: ${(mem.relevance_score * 100).toFixed(0)}%`);
        }
      });
    }
    
    if (memories.semantic.length > 0) {
      sections.push('\n=== Known Concepts ===');
      memories.semantic.forEach((mem, idx) => {
        const content = typeof mem.content === 'string' ? 
          mem.content : 
          (mem.content?.definition || mem.content?.concept || JSON.stringify(mem.content));
        
        sections.push(`Concept ${idx + 1}: ${content.substring(0, 300)}`);
        if (mem.relevance_score) {
          sections.push(`  Relevance: ${(mem.relevance_score * 100).toFixed(0)}%`);
        }
      });
    }
    
    return sections.length > 0 ? sections.join('\n') : '';
  }

  /**
   * Extract insights from memories for the current reasoning state
   */
  private extractMemoryInsights(memories: MemoryContext, state: ReasoningState): string[] {
    const insights: string[] = [];
    
    // Extract patterns from episodic memories
    if (memories.episodic.length > 0) {
      const outcomes = memories.episodic
        .map(m => m.content?.outcome)
        .filter(Boolean);
      
      if (outcomes.length > 0) {
        insights.push(`Previous similar situations had outcomes: ${outcomes.join(', ')}`);
      }
      
      const tools = memories.episodic
        .flatMap(m => m.content?.context?.tools_used || [])
        .filter(Boolean);
      
      if (tools.length > 0) {
        const uniqueTools = [...new Set(tools)];
        insights.push(`Previously used tools: ${uniqueTools.join(', ')}`);
      }
    }
    
    // Extract concepts from semantic memories
    if (memories.semantic.length > 0) {
      const concepts = memories.semantic
        .map(m => {
          if (typeof m.content === 'string') return m.content.substring(0, 100);
          return m.content?.concept || m.content?.definition?.substring(0, 100);
        })
        .filter(Boolean)
        .slice(0, 3);
      
      if (concepts.length > 0) {
        insights.push(`Related concepts: ${concepts.join('; ')}`);
      }
    }
    
    return insights;
  }

  /**
   * Build a memory-aware question for the current reasoning state
   */
  private buildMemoryAwareQuestion(
    style: ReasoningStyle, 
    state: ReasoningState,
    memories: MemoryContext
  ): string {
    const facts = this.facts && this.facts.length
      ? `Current Context:\n- ${this.facts.slice(0, 5).join('\n- ')}`
      : '';
    
    const toolHint = this.tools && this.tools.length
      ? `Available Tools: ${this.tools.join(', ')}`
      : '';
    
    const memoryContext = this.formatMemoriesForPrompt(memories);
    
    const promptHeader = [facts, toolHint, memoryContext]
      .filter(Boolean)
      .join('\n\n');

    const q = (s: string) => {
      const fullPrompt = promptHeader ? `${promptHeader}\n\n${s}` : s;
      return `Based on the above context and memories, ${fullPrompt}`;
    };

    // State and style specific questions
    if (style === 'inductive') {
      switch (state) {
        case 'analyze': 
          return q('what patterns or regularities are most evident, considering both current facts and past experiences?');
        case 'hypothesize': 
          return q('given these patterns and what we know from past similar situations, what general rule best accounts for them?');
        case 'test': 
          return q('if that rule were true, what immediate prediction follows that we can verify based on our knowledge?');
        case 'observe': 
          return q('considering the available evidence and past outcomes, does the prediction appear supported or contradicted?');
        case 'update': 
          return q('refine the rule so that it better fits all observed facts and aligns with our accumulated knowledge. What is the refined rule?');
        case 'conclude': 
          return q('state the most probable general rule in one sentence, informed by both current analysis and historical patterns.');
      }
    }

    if (style === 'abductive') {
      switch (state) {
        case 'analyze': 
          return q('which observations are most salient or surprising, especially compared to our past experiences?');
        case 'hypothesize': 
          return q('what is the most plausible explanation that would make these observations expected, considering what has worked before?');
        case 'test': 
          return q('if that explanation were correct, what evidence should we expect based on similar past scenarios?');
        case 'observe': 
          return q('relative to that expectation and our historical knowledge, what evidence is present or missing?');
        case 'update': 
          return q('revise the explanation to best fit the totality of evidence and past learnings. What is the revised explanation?');
        case 'conclude': 
          return q('state the best current explanation in one sentence, synthesizing current findings with established knowledge.');
      }
    }

    // Deductive
    switch (state) {
      case 'analyze': 
        return q('which rules, constraints, or established principles from our knowledge base apply directly to this case?');
      case 'hypothesize': 
        return q('applying those rules and known principles, what conclusion necessarily follows for this case?');
      case 'test': 
        return q('what intermediate inference can be derived that supports that conclusion based on our understanding?');
      case 'observe': 
        return q('do the premises required for that inference hold in the described case, considering past validations?');
      case 'update': 
        return q('adjust the inference so that all premises are satisfied according to our knowledge. What is the adjusted inference?');
      case 'conclude': 
        return q('state the necessary conclusion that follows from established facts and principles, in one sentence.');
    }
    
    return q('What conclusion follows from the available evidence and knowledge?');
  }

  /**
   * Run the memory-integrated reasoning chain
   */
  async run(
    style: ReasoningStyle, 
    maxSteps: number, 
    ask: (q: string) => Promise<string>, 
    shouldTest: (s: string, memories: MemoryContext) => Promise<{
      needed: boolean; 
      tool?: string; 
      args?: any; 
      gap: number
    }>,
    observe: (action?: {tool?: string; name?: string; args?: any}) => Promise<any>
  ): Promise<EnhancedReasoningStep[]> {
    const steps: EnhancedReasoningStep[] = [];
    let state: ReasoningState = 'analyze';
    let confidence = 0.5;
    let infoGap = 0.0;
    
    console.log(`[MemoryIntegratedMarkov] Starting reasoning with style: ${style}, agent: ${this.agentId}`);
    
    for (let i = 1; i <= maxSteps; i++) {
      try {
        // Retrieve relevant memories for this step
        const memories = await this.retrieveMemoriesForStep(state, this.query, steps);
        console.log(`[MemoryIntegratedMarkov] Step ${i}: Retrieved ${memories.episodic.length} episodic and ${memories.semantic.length} semantic memories`);
        
        // Extract insights from memories
        const memoryInsights = this.extractMemoryInsights(memories, state);
        
        // Build memory-aware question
        const question = this.buildMemoryAwareQuestion(style, state, memories);
        
        // Ask the question with memory context
        let hypothesis = '';
        try {
          hypothesis = await ask(question);
          console.log(`[MemoryIntegratedMarkov] Step ${i} hypothesis: ${hypothesis?.substring(0, 100)}...`);
        } catch (askError) {
          console.error(`[MemoryIntegratedMarkov] Error getting hypothesis for step ${i}:`, askError);
          hypothesis = `Step ${i}: Unable to generate hypothesis due to error`;
          confidence = Math.max(0.1, confidence - 0.3);
        }
        
        let action: any = undefined;
        let observation: any = undefined;
        let conclusion: string | undefined;
        
        // Test phase with memory context
        if (state === 'hypothesize' || state === 'analyze') {
          try {
            const test = await shouldTest(hypothesis, memories);
            infoGap = test.gap;
            if (test.needed) {
              action = { tool: test.tool, name: test.tool, args: test.args };
              observation = await observe(action);
              
              // Adjust confidence based on observation
              if (observation) {
                confidence = Math.min(0.9, confidence + 0.15);
              }
            }
          } catch (testError) {
            console.error(`[MemoryIntegratedMarkov] Error in test phase for step ${i}:`, testError);
            infoGap = 0.1; // Default low gap
          }
        }
        
        // Conclude phase
        if (state === 'conclude') {
          conclusion = hypothesis;
          confidence = Math.min(0.95, confidence + 0.2);
          
          steps.push({
            step: i,
            style,
            state,
            question,
            hypothesis,
            observation,
            conclusion,
            confidence,
            time_ms: 1,
            memories_used: memories,
            memory_insights: memoryInsights
          } as EnhancedReasoningStep);
          
          break;
        }
        
        // Add step with memory context
        steps.push({
          step: i,
          style,
          state,
          question,
          hypothesis,
          action,
          observation,
          confidence,
          time_ms: 1,
          memories_used: memories,
          memory_insights: memoryInsights
        } as EnhancedReasoningStep);
        
        // Transition to next state
        state = this.next(state, infoGap, confidence);
        
        // Adjust confidence based on memory alignment
        if (memories.episodic.length > 0 || memories.semantic.length > 0) {
          confidence = Math.min(0.95, confidence + 0.05);
        }
        
      } catch (error) {
        console.error(`[MemoryIntegratedMarkov] Error in step ${i}:`, error);
        // Continue with reduced confidence
        confidence = Math.max(0.1, confidence - 0.2);
      }
    }
    
    console.log(`[MemoryIntegratedMarkov] Completed with ${steps.length} steps`);
    return steps;
  }
}
