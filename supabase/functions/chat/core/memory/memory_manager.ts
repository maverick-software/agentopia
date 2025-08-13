// Memory Manager Component
// Handles storage, retrieval, and management of agent memories

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { Pinecone } from 'npm:@pinecone-database/pinecone@2.0.0';
import { SemanticMemoryManager } from './semantic_memory.ts';
import OpenAI from 'npm:openai@4.28.0';
import {
  AgentMemory,
  MemoryType,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  WorkingMemory,
} from '../../types/memory.types.ts';
import { generateMemoryId, generateTimestamp } from '../../types/utils.ts';
import { EpisodicMemoryManager } from './episodic_memory.ts';
import { MemoryConsolidationManager } from './memory_consolidation.ts';
import { MemoryFactory } from './memory_factory.ts';

// ============================
// Interfaces
// ============================

export interface MemoryQuery {
  agent_id: string;
  query?: string;
  types?: MemoryType[];
  limit?: number;
  min_importance?: number;
  min_relevance?: number;
  time_range?: {
    start: string;
    end: string;
  };
}

export interface MemorySearchResult {
  memory: AgentMemory;
  relevance_score: number;
  distance?: number;
  highlight?: string;
}

export interface ConsolidationCriteria {
  agent_id: string;
  memory_type?: MemoryType;
  older_than?: string;
  importance_below?: number;
  access_count_below?: number;
  max_memories?: number;
}

export interface ConsolidationResult {
  original_count: number;
  consolidated_count: number;
  memories: AgentMemory[];
  removed_ids: string[];
  tokens_saved: number;
}

export interface DecayResult {
  processed: number;
  decayed: number;
  expired: number;
  removed_ids: string[];
}

// ============================
// Memory Manager Implementation
// ============================

export class MemoryManager {
  private ranker: MemoryRanker;
  private consolidator: MemoryConsolidator;
  public episodicManager: EpisodicMemoryManager;
  public semanticManager: SemanticMemoryManager | null;
  public consolidationManager: MemoryConsolidationManager;
  
  constructor(
    private supabase: SupabaseClient,
    private pinecone: Pinecone | null,
    private openai: OpenAI,
    private config: {
      index_name: string;
      namespace?: string;
      embedding_model?: string;
      max_memories_per_agent?: number;
    }
  ) {
    this.ranker = new ImportanceBasedRanker();
    this.consolidator = new MemoryConsolidator(openai);
    
    // Initialize specialized managers
    this.episodicManager = new EpisodicMemoryManager(supabase);
    this.semanticManager = pinecone ? new SemanticMemoryManager(supabase, pinecone, openai, {
      index_name: config.index_name,
      namespace: config.namespace,
      embedding_model: config.embedding_model,
    }) : null;
    this.consolidationManager = new MemoryConsolidationManager(
      supabase,
      this.episodicManager,
      this.semanticManager
    );
  }
  
  /**
   * Store a new memory
   */
  async store(memory: Partial<AgentMemory>): Promise<string> {
    const id = memory.id || generateMemoryId();
    const timestamp = generateTimestamp();
    
    // Complete memory object
    const completeMemory: AgentMemory = {
      id,
      agent_id: memory.agent_id!,
      memory_type: memory.memory_type!,
      content: memory.content!,
      embeddings: memory.embeddings,
      importance: memory.importance || 0.5,
      decay_rate: memory.decay_rate || 0.1,
      access_count: 0,
      related_memories: memory.related_memories || [],
      source_message_id: memory.source_message_id,
      last_accessed: timestamp,
      created_at: timestamp,
      expires_at: memory.expires_at,
    };
    
    // Generate embeddings if not provided
    if (!completeMemory.embeddings) {
      completeMemory.embeddings = await this.generateEmbeddings(completeMemory);
    }
    
    // Store in database
    const { error: dbError } = await this.supabase
      .from('agent_memories')
      .insert(completeMemory);
    
    if (dbError) {
      throw new Error(`Failed to store memory: ${dbError.message}`);
    }
    
    // Store in vector database
    const index = this.pinecone.index(this.config.index_name);
    await index.upsert([{
      id,
      values: completeMemory.embeddings,
      metadata: {
        agent_id: completeMemory.agent_id,
        memory_type: completeMemory.memory_type,
        importance: completeMemory.importance,
        created_at: completeMemory.created_at,
        content: JSON.stringify(completeMemory.content),
      },
    }]);
    
    // Check if consolidation is needed
    await this.checkConsolidationNeeded(completeMemory.agent_id);
    
    return id;
  }
  
  /**
   * Retrieve memories based on query
   */
  async retrieve(query: MemoryQuery): Promise<MemorySearchResult[]> {
    const results: MemorySearchResult[] = [];
    
    if (query.query) {
      // Vector search
      const vectorResults = await this.vectorSearch(query);
      results.push(...vectorResults);
    } else {
      // Database search
      const dbResults = await this.databaseSearch(query);
      results.push(...dbResults);
    }
    
    // Rank results
    const ranked = this.ranker.rank(results, {
      query: query.query,
      timestamp: generateTimestamp(),
      agent_id: query.agent_id,
    });
    
    // Apply limit
    const limited = query.limit ? ranked.slice(0, query.limit) : ranked;
    
    // Update access counts
    await this.updateAccessCounts(limited.map(r => r.memory.id));
    
    return limited;
  }
  
  /**
   * Update a memory
   */
  async update(id: string, updates: Partial<AgentMemory>): Promise<void> {
    // Update database
    const { error } = await this.supabase
      .from('agent_memories')
      .update({
        ...updates,
        updated_at: generateTimestamp(),
      })
      .eq('id', id);
    
    if (error) {
      throw new Error(`Failed to update memory: ${error.message}`);
    }
    
    // Update vector database if embeddings changed
    if (updates.embeddings) {
      const index = this.pinecone.index(this.config.index_name);
      await index.update({
        id,
        values: updates.embeddings,
      });
    }
  }
  
  /**
   * Delete a memory
   */
  async delete(id: string): Promise<void> {
    // Delete from database
    const { error } = await this.supabase
      .from('agent_memories')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new Error(`Failed to delete memory: ${error.message}`);
    }
    
    // Delete from vector database
    const index = this.pinecone.index(this.config.index_name);
    await index.deleteOne(id);
  }
  
  /**
   * Consolidate memories based on criteria
   */
  async consolidate(criteria: ConsolidationCriteria): Promise<ConsolidationResult> {
    // Fetch memories to consolidate
    const memories = await this.fetchMemoriesForConsolidation(criteria);
    
    if (memories.length === 0) {
      return {
        original_count: 0,
        consolidated_count: 0,
        memories: [],
        removed_ids: [],
        tokens_saved: 0,
      };
    }
    
    // Perform consolidation
    const result = await this.consolidator.consolidate(
      memories,
      this.determineConsolidationStrategy(memories)
    );
    
    // Store consolidated memories
    for (const memory of result.memories) {
      await this.store(memory);
    }
    
    // Delete original memories
    for (const id of result.removed_ids) {
      await this.delete(id);
    }
    
    return result;
  }
  
  /**
   * Apply decay to memories
   */
  async decay(agent_id: string): Promise<DecayResult> {
    const { data: memories, error } = await this.supabase
      .from('agent_memories')
      .select('*')
      .eq('agent_id', agent_id);
    
    if (error) {
      throw new Error(`Failed to fetch memories for decay: ${error.message}`);
    }
    
    const result: DecayResult = {
      processed: memories?.length || 0,
      decayed: 0,
      expired: 0,
      removed_ids: [],
    };
    
    for (const memory of memories || []) {
      const decayedImportance = this.calculateDecayedImportance(memory);
      
      if (decayedImportance < 0.1) {
        // Remove completely decayed memories
        await this.delete(memory.id);
        result.removed_ids.push(memory.id);
        result.expired++;
      } else if (decayedImportance !== memory.importance) {
        // Update importance
        await this.update(memory.id, { importance: decayedImportance });
        result.decayed++;
      }
    }
    
    return result;
  }
  
  /**
   * Create relationships between memories
   */
  async relate(memory_id: string, related_ids: string[]): Promise<void> {
    const { data: memory, error } = await this.supabase
      .from('agent_memories')
      .select('related_memories')
      .eq('id', memory_id)
      .single();
    
    if (error) {
      throw new Error(`Failed to fetch memory: ${error.message}`);
    }
    
    const updated_relations = [
      ...(memory?.related_memories || []),
      ...related_ids,
    ].filter((id, index, self) => self.indexOf(id) === index);
    
    await this.update(memory_id, { related_memories: updated_relations });
  }
  
  /**
   * Get episodic memories for an agent
   */
  async getEpisodic(
    agent_id: string,
    timeframe?: { start: string; end: string }
  ): Promise<EpisodicMemory[]> {
    let query = this.supabase
      .from('agent_memories')
      .select('*')
      .eq('agent_id', agent_id)
      .eq('memory_type', 'episodic')
      .order('created_at', { ascending: false });
    
    if (timeframe) {
      query = query
        .gte('created_at', timeframe.start)
        .lte('created_at', timeframe.end);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch episodic memories: ${error.message}`);
    }
    
    return (data || []).map(m => ({
      ...m,
      content: m.content as EpisodicMemory['content'],
    }));
  }
  
  /**
   * Get semantic memories for a concept
   */
  async getSemantic(
    agent_id: string,
    concept: string
  ): Promise<SemanticMemory[]> {
    const results = await this.retrieve({
      agent_id,
      query: concept,
      types: ['semantic'],
      limit: 10,
    });
    
    return results.map(r => ({
      ...r.memory,
      content: r.memory.content as SemanticMemory['content'],
    })) as SemanticMemory[];
  }
  
  /**
   * Get procedural memories for a skill
   */
  async getProcedural(
    agent_id: string,
    skill: string
  ): Promise<ProceduralMemory[]> {
    const results = await this.retrieve({
      agent_id,
      query: skill,
      types: ['procedural'],
      limit: 5,
    });
    
    return results.map(r => ({
      ...r.memory,
      content: r.memory.content as ProceduralMemory['content'],
    })) as ProceduralMemory[];
  }
  
  /**
   * Get working memory for an agent
   */
  async getWorking(agent_id: string): Promise<WorkingMemory | null> {
    const { data, error } = await this.supabase
      .from('agent_memories')
      .select('*')
      .eq('agent_id', agent_id)
      .eq('memory_type', 'working')
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      ...data,
      content: data.content as WorkingMemory['content'],
    } as WorkingMemory;
  }
  
  /**
   * Create memories from a conversation using the memory factory
   */
  async createFromConversation(
    messages: any[],
    auto_consolidate: boolean = true
  ): Promise<string[]> {
    if (messages.length === 0) return [];
    
    const agent_id = messages[0]?.context?.agent_id || '';
    
    // Create episodic memories
    const episodicIds = await this.episodicManager.createFromConversation(
      messages,
      auto_consolidate
    );
    
    // Extract and store semantic knowledge
    const semanticIds = await this.semanticManager.extractAndStore(
      agent_id,
      messages
    );
    
    return [...episodicIds, ...semanticIds];
  }
  
  /**
   * Perform comprehensive memory consolidation
   */
  async performMaintenance(agent_id: string): Promise<{
    consolidation: any;
    decay: DecayResult;
    cleanup_expired: number;
  }> {
    // Run consolidation
    const consolidation = await this.consolidationManager.consolidateAgent(agent_id);
    
    // Apply memory decay
    const decay = await this.decay(agent_id);
    
    // Clean up expired memories
    const { data: cleanupResult } = await this.supabase
      .rpc('cleanup_expired_memories');
    
    const cleanupCount = cleanupResult?.find((r: any) => r.agent_id === agent_id)?.deleted_count || 0;
    
    return {
      consolidation,
      decay,
      cleanup_expired: cleanupCount,
    };
  }
  
  /**
   * Get comprehensive memory overview for an agent
   */
  async getMemoryOverview(agent_id: string): Promise<{
    statistics: any;
    recent_activity: any[];
    consolidation_status: any;
    knowledge_graph: any;
  }> {
    // Get memory statistics
    const { data: statistics } = await this.supabase
      .rpc('get_memory_stats', { agent_uuid: agent_id });
    
    // Get recent memories
    const recentMemories = await this.retrieve({
      agent_id,
      limit: 10,
    });
    
    // Get consolidation status
    const consolidationStatus = await this.consolidationManager.checkConsolidationNeeded(agent_id);
    
    // Get knowledge graph
    const knowledgeGraph = await this.semanticManager.buildKnowledgeGraph(agent_id);
    
    return {
      statistics: statistics || [],
      recent_activity: recentMemories,
      consolidation_status: consolidationStatus,
      knowledge_graph: knowledgeGraph,
    };
  }
  
  /**
   * Search across all memory types with context
   */
  async contextualSearch(
    agent_id: string,
    query: string,
    context?: {
      conversation_id?: string;
      timeframe?: { start: string; end: string };
      memory_types?: string[];
    }
  ): Promise<{
    episodic: any[];
    semantic: any[];
    procedural: any[];
    relevance_scores: number[];
  }> {
    const results = {
      episodic: [] as any[],
      semantic: [] as any[],
      procedural: [] as any[],
      relevance_scores: [] as number[],
    };
    
    // Search episodic memories via vector search (Pinecone) if available; fallback to DB query
    if (!context?.memory_types || context.memory_types.includes('episodic')) {
      try {
        // Prefer agent-scoped Pinecone configuration
        const { data: connection } = await this.supabase
          .from('agent_datastores')
          .select(`
            datastore_id,
            datastores:datastore_id (
              id,
              type,
              config
            )
          `)
          .eq('agent_id', agent_id)
          .eq('datastores.type', 'pinecone')
          .single();

        const ds = (connection as any)?.datastores;
        if (ds?.config?.apiKey && ds?.config?.indexName) {
          // Generate embedding
          const emb = await this.openai.embeddings.create({
            model: this.config.embedding_model || 'text-embedding-3-small',
            input: query,
          });
          const vector = emb.data[0].embedding as number[];

          // Query Pinecone
          const pc = new Pinecone({ apiKey: ds.config.apiKey });
          const index = pc.index(ds.config.indexName);
          const search = await index.query({
            vector,
            topK: 10,
            includeMetadata: true,
            includeValues: false,
            filter: { agent_id: { $eq: agent_id }, memory_type: { $eq: 'episodic' } },
          });

          const ids = (search.matches || []).map((m: any) => m.id);
          if (ids.length > 0) {
            const { data: memories } = await this.supabase
              .from('agent_memories')
              .select('*')
              .in('id', ids);
            results.episodic = (memories || []) as any[];
          } else {
            results.episodic = [];
          }
        } else {
          // Fallback: DB episodic query
          results.episodic = await this.episodicManager.query({ agent_id, timeframe: context?.timeframe });
        }
      } catch (err) {
        console.warn('[MemoryManager] Episodic vector search failed; falling back:', (err as Error)?.message);
        try {
          results.episodic = await this.episodicManager.query({ agent_id, timeframe: context?.timeframe });
        } catch {
          results.episodic = [];
        }
      }
    }
    
    // Search semantic memories if available (never throw)
    if (!context?.memory_types || context.memory_types.includes('semantic')) {
      try {
        // Prefer agent-scoped datastore configuration if available
        const { data: connection } = await this.supabase
          .from('agent_datastores')
          .select(`
            datastore_id,
            datastores:datastore_id (
              id,
              type,
              config
            )
          `)
          .eq('agent_id', agent_id)
          .eq('datastores.type', 'pinecone')
          .single();

        const ds = (connection as any)?.datastores;
        if (ds?.config?.apiKey && ds?.config?.indexName) {
          // Build a per-agent semantic manager with the agent's Pinecone credentials
          const dynamicPinecone = new Pinecone({ apiKey: ds.config.apiKey });
          const SemanticCtor = this.semanticManager ? (this.semanticManager as any).constructor : SemanticMemoryManager;
          const agentSemantic = new SemanticCtor(
            this.supabase,
            dynamicPinecone,
            this.openai,
            {
              index_name: ds.config.indexName,
              namespace: this.config.namespace,
              embedding_model: this.config.embedding_model,
            }
          );
          results.semantic = await agentSemantic.query({ agent_id, concept: query });
        } else if (this.semanticManager) {
          // Fallback to default semantic manager
          results.semantic = await this.semanticManager.query({ agent_id, concept: query });
        } else {
          console.info('[MemoryManager] Semantic memory not configured for agent');
          results.semantic = [];
        }
      } catch (err) {
        console.warn('[MemoryManager] Semantic search failed:', (err as Error)?.message);
        results.semantic = [];
      }
    }
    
    // Search procedural memories
    if (!context?.memory_types || context.memory_types.includes('procedural')) {
      results.procedural = await this.getProcedural(agent_id, query);
    }
    
    return results;
  }
  
  // ============================
  // Private Methods
  // ============================
  
  private async generateEmbeddings(memory: AgentMemory): Promise<number[]> {
    const text = this.memoryToText(memory);
    
    const response = await this.openai.embeddings.create({
      model: this.config.embedding_model || 'text-embedding-3-small',
      input: text,
    });
    
    return response.data[0].embedding;
  }
  
  private memoryToText(memory: AgentMemory): string {
    switch (memory.memory_type) {
      case 'episodic':
        const episodic = memory.content as EpisodicMemory['content'];
        return `Event: ${episodic.event}. Context: ${JSON.stringify(episodic.context)}`;
        
      case 'semantic':
        const semantic = memory.content as SemanticMemory['content'];
        return `${semantic.concept}: ${semantic.definition}`;
        
      case 'procedural':
        const procedural = memory.content as ProceduralMemory['content'];
        return `Skill: ${procedural.skill}. Steps: ${procedural.steps.join(', ')}`;
        
      case 'working':
        const working = memory.content as WorkingMemory['content'];
        return `Working memory: ${working.items.join(', ')}`;
        
      default:
        return JSON.stringify(memory.content);
    }
  }
  
  private async vectorSearch(query: MemoryQuery): Promise<MemorySearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await this.openai.embeddings.create({
      model: this.config.embedding_model || 'text-embedding-3-small',
      input: query.query!,
    });
    
    // Search in Pinecone
    const index = this.pinecone.index(this.config.index_name);
    const searchResults = await index.query({
      vector: queryEmbedding.data[0].embedding,
      topK: query.limit || 10,
      includeMetadata: true,
      filter: {
        agent_id: { $eq: query.agent_id },
        ...(query.types && { memory_type: { $in: query.types } }),
        ...(query.min_importance && { importance: { $gte: query.min_importance } }),
      },
    });
    
    // Fetch full memories from database
    const memoryIds = searchResults.matches.map(m => m.id);
    const { data: memories, error } = await this.supabase
      .from('agent_memories')
      .select('*')
      .in('id', memoryIds);
    
    if (error) {
      throw new Error(`Failed to fetch memories: ${error.message}`);
    }
    
    // Combine results
    return searchResults.matches.map(match => {
      const memory = memories?.find(m => m.id === match.id);
      return {
        memory: memory!,
        relevance_score: match.score || 0,
        distance: match.score,
      };
    }).filter(r => r.memory && (!query.min_relevance || r.relevance_score >= query.min_relevance));
  }
  
  private async databaseSearch(query: MemoryQuery): Promise<MemorySearchResult[]> {
    let dbQuery = this.supabase
      .from('agent_memories')
      .select('*')
      .eq('agent_id', query.agent_id);
    
    if (query.types) {
      dbQuery = dbQuery.in('memory_type', query.types);
    }
    
    if (query.min_importance) {
      dbQuery = dbQuery.gte('importance', query.min_importance);
    }
    
    if (query.time_range) {
      dbQuery = dbQuery
        .gte('created_at', query.time_range.start)
        .lte('created_at', query.time_range.end);
    }
    
    const { data, error } = await dbQuery
      .order('importance', { ascending: false })
      .limit(query.limit || 100);
    
    if (error) {
      throw new Error(`Failed to search memories: ${error.message}`);
    }
    
    return (data || []).map(memory => ({
      memory,
      relevance_score: memory.importance,
    }));
  }
  
  private async updateAccessCounts(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.supabase.rpc('increment_memory_access', { memory_id: id });
    }
  }
  
  private calculateDecayedImportance(memory: AgentMemory): number {
    const now = new Date().getTime();
    const lastAccessed = new Date(memory.last_accessed).getTime();
    const daysSinceAccess = (now - lastAccessed) / (1000 * 60 * 60 * 24);
    
    const decayFactor = Math.exp(-memory.decay_rate * daysSinceAccess);
    return memory.importance * decayFactor;
  }
  
  private async checkConsolidationNeeded(agent_id: string): Promise<void> {
    const { count } = await this.supabase
      .from('agent_memories')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent_id);
    
    const maxMemories = this.config.max_memories_per_agent || 1000;
    
    if (count && count > maxMemories * 0.9) {
      // Trigger consolidation in background
      this.consolidate({
        agent_id,
        importance_below: 0.3,
        access_count_below: 2,
        max_memories: Math.floor(maxMemories * 0.8),
      }).catch(err => console.error('Consolidation failed:', err));
    }
  }
  
  private async fetchMemoriesForConsolidation(
    criteria: ConsolidationCriteria
  ): Promise<AgentMemory[]> {
    let query = this.supabase
      .from('agent_memories')
      .select('*')
      .eq('agent_id', criteria.agent_id);
    
    if (criteria.memory_type) {
      query = query.eq('memory_type', criteria.memory_type);
    }
    
    if (criteria.older_than) {
      query = query.lt('created_at', criteria.older_than);
    }
    
    if (criteria.importance_below) {
      query = query.lt('importance', criteria.importance_below);
    }
    
    if (criteria.access_count_below) {
      query = query.lt('access_count', criteria.access_count_below);
    }
    
    const { data, error } = await query
      .order('importance', { ascending: true })
      .limit(criteria.max_memories || 100);
    
    if (error) {
      throw new Error(`Failed to fetch memories for consolidation: ${error.message}`);
    }
    
    return data || [];
  }
  
  private determineConsolidationStrategy(
    memories: AgentMemory[]
  ): 'merge' | 'summarize' | 'abstract' {
    const types = new Set(memories.map(m => m.memory_type));
    
    if (types.size === 1 && types.has('episodic')) {
      return 'summarize';
    }
    
    if (types.has('semantic')) {
      return 'merge';
    }
    
    return 'abstract';
  }
}

// ============================
// Memory Ranker
// ============================

interface RankingContext {
  query?: string;
  timestamp: string;
  agent_id: string;
  total_accesses?: number;
}

interface RankedMemory extends MemorySearchResult {
  score: number;
}

abstract class MemoryRanker {
  abstract rank(
    memories: MemorySearchResult[],
    context: RankingContext
  ): RankedMemory[];
}

class ImportanceBasedRanker extends MemoryRanker {
  rank(memories: MemorySearchResult[], context: RankingContext): RankedMemory[] {
    return memories
      .map(result => ({
        ...result,
        score: this.calculateScore(result, context),
      }))
      .sort((a, b) => b.score - a.score);
  }
  
  private calculateScore(
    result: MemorySearchResult,
    context: RankingContext
  ): number {
    const memory = result.memory;
    
    // Base relevance from search
    const relevance = result.relevance_score || 0;
    
    // Recency factor
    const now = new Date(context.timestamp).getTime();
    const created = new Date(memory.created_at).getTime();
    const daysSinceCreation = (now - created) / (1000 * 60 * 60 * 24);
    const recency = Math.exp(-0.01 * daysSinceCreation);
    
    // Importance
    const importance = memory.importance;
    
    // Access frequency
    const accessFrequency = context.total_accesses
      ? memory.access_count / context.total_accesses
      : 0;
    
    // Weighted combination
    return (
      relevance * 0.4 +
      recency * 0.2 +
      importance * 0.3 +
      accessFrequency * 0.1
    );
  }
}

// ============================
// Memory Consolidator
// ============================

type ConsolidationStrategy = 'merge' | 'summarize' | 'abstract';

class MemoryConsolidator {
  constructor(private openai: OpenAI) {}
  
  async consolidate(
    memories: AgentMemory[],
    strategy: ConsolidationStrategy
  ): Promise<ConsolidationResult> {
    switch (strategy) {
      case 'merge':
        return this.mergeMemories(memories);
      case 'summarize':
        return this.summarizeMemories(memories);
      case 'abstract':
        return this.abstractMemories(memories);
    }
  }
  
  private async mergeMemories(
    memories: AgentMemory[]
  ): Promise<ConsolidationResult> {
    // Group by similarity
    const clusters = await this.clusterMemories(memories);
    
    // Merge each cluster
    const consolidated: AgentMemory[] = [];
    const removed_ids: string[] = [];
    
    for (const cluster of clusters) {
      if (cluster.length === 1) {
        consolidated.push(cluster[0]);
        continue;
      }
      
      const merged = await this.mergeCluster(cluster);
      consolidated.push(merged);
      removed_ids.push(...cluster.map(m => m.id));
    }
    
    return {
      original_count: memories.length,
      consolidated_count: consolidated.length,
      memories: consolidated,
      removed_ids,
      tokens_saved: this.calculateTokenSavings(memories, consolidated),
    };
  }
  
  private async summarizeMemories(
    memories: AgentMemory[]
  ): Promise<ConsolidationResult> {
    // Sort by temporal order
    const sorted = memories.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    // Create summary
    const summaryContent = await this.createSummary(sorted);
    
    const summary: Partial<AgentMemory> = {
      agent_id: memories[0].agent_id,
      memory_type: 'semantic',
      content: {
        concept: 'summarized_events',
        definition: summaryContent,
        source: 'consolidation',
      },
      importance: Math.max(...memories.map(m => m.importance)),
      related_memories: memories.map(m => m.id),
    };
    
    return {
      original_count: memories.length,
      consolidated_count: 1,
      memories: [summary as AgentMemory],
      removed_ids: memories.map(m => m.id),
      tokens_saved: this.calculateTokenSavings(memories, [summary as AgentMemory]),
    };
  }
  
  private async abstractMemories(
    memories: AgentMemory[]
  ): Promise<ConsolidationResult> {
    // Extract patterns and create abstractions
    const abstractions = await this.extractAbstractions(memories);
    
    return {
      original_count: memories.length,
      consolidated_count: abstractions.length,
      memories: abstractions,
      removed_ids: memories.map(m => m.id),
      tokens_saved: this.calculateTokenSavings(memories, abstractions),
    };
  }
  
  private async clusterMemories(
    memories: AgentMemory[]
  ): Promise<AgentMemory[][]> {
    // Simple clustering by content similarity
    // In production, use more sophisticated clustering
    const clusters: AgentMemory[][] = [];
    const used = new Set<string>();
    
    for (const memory of memories) {
      if (used.has(memory.id)) continue;
      
      const cluster = [memory];
      used.add(memory.id);
      
      // Find similar memories
      for (const other of memories) {
        if (used.has(other.id)) continue;
        
        if (this.areSimilar(memory, other)) {
          cluster.push(other);
          used.add(other.id);
        }
      }
      
      clusters.push(cluster);
    }
    
    return clusters;
  }
  
  private areSimilar(a: AgentMemory, b: AgentMemory): boolean {
    // Simple similarity check
    // In production, use embeddings or more sophisticated methods
    if (a.memory_type !== b.memory_type) return false;
    
    const aText = JSON.stringify(a.content);
    const bText = JSON.stringify(b.content);
    
    // Very basic similarity
    const commonWords = this.getCommonWords(aText, bText);
    return commonWords > 0.5;
  }
  
  private getCommonWords(a: string, b: string): number {
    const aWords = new Set(a.toLowerCase().split(/\s+/));
    const bWords = new Set(b.toLowerCase().split(/\s+/));
    
    let common = 0;
    for (const word of aWords) {
      if (bWords.has(word)) common++;
    }
    
    return common / Math.max(aWords.size, bWords.size);
  }
  
  private async mergeCluster(cluster: AgentMemory[]): Promise<AgentMemory> {
    // Merge memories in a cluster
    const base = cluster[0];
    
    return {
      ...base,
      id: generateMemoryId(),
      importance: Math.max(...cluster.map(m => m.importance)),
      access_count: cluster.reduce((sum, m) => sum + m.access_count, 0),
      related_memories: cluster.flatMap(m => [m.id, ...(m.related_memories || [])]),
      created_at: generateTimestamp(),
    };
  }
  
  private async createSummary(memories: AgentMemory[]): Promise<string> {
    // Use LLM to create summary (prefer router per-agent when enabled if accessible)
    const events = memories.map(m => this.memoryToText(m)).join('\n');
    let text = '';
    const useRouter = (Deno.env.get('USE_LLM_ROUTER') || '').toLowerCase() === 'true';
    try {
      if (useRouter) {
        const { LLMRouter } = await import('../../shared/llm/router.ts');
        const router = new LLMRouter();
        // We may not have agent_id here; summaries are generic. Fallback to default agent if provided in config.
        const agentId = (this.config as any)?.agent_id || '';
        if (agentId) {
          const resp = await router.chat(agentId, [
            { role: 'system', content: 'Summarize the following events into a concise narrative:' },
            { role: 'user', content: events },
          ] as any, { maxTokens: 500, temperature: 0.2 });
          text = resp.text || '';
        }
      }
    } catch (_) {}
    if (!text) {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Summarize the following events into a concise narrative:' },
          { role: 'user', content: events },
        ],
        max_tokens: 500,
      });
      text = response.choices[0].message.content || 'Summary unavailable';
    }
    return text;
  }
  
  private async extractAbstractions(
    memories: AgentMemory[]
  ): Promise<AgentMemory[]> {
    // Extract high-level patterns
    // This is a simplified version
    const patterns = new Map<string, AgentMemory[]>();
    
    for (const memory of memories) {
      const pattern = this.identifyPattern(memory);
      if (!patterns.has(pattern)) {
        patterns.set(pattern, []);
      }
      patterns.get(pattern)!.push(memory);
    }
    
    const abstractions: AgentMemory[] = [];
    
    for (const [pattern, group] of patterns) {
      abstractions.push({
        id: generateMemoryId(),
        agent_id: group[0].agent_id,
        memory_type: 'semantic',
        content: {
          concept: pattern,
          definition: `Abstraction from ${group.length} memories`,
          source: 'consolidation',
        },
        importance: Math.max(...group.map(m => m.importance)),
        decay_rate: 0.05,
        access_count: group.reduce((sum, m) => sum + m.access_count, 0),
        related_memories: group.map(m => m.id),
        created_at: generateTimestamp(),
        last_accessed: generateTimestamp(),
      } as AgentMemory);
    }
    
    return abstractions;
  }
  
  private identifyPattern(memory: AgentMemory): string {
    // Simple pattern identification
    if (memory.memory_type === 'episodic') {
      return 'event_pattern';
    } else if (memory.memory_type === 'procedural') {
      return 'skill_pattern';
    }
    return 'general_pattern';
  }
  
  private calculateTokenSavings(
    original: AgentMemory[],
    consolidated: AgentMemory[]
  ): number {
    const originalTokens = original.reduce(
      (sum, m) => sum + this.estimateTokens(m),
      0
    );
    
    const consolidatedTokens = consolidated.reduce(
      (sum, m) => sum + this.estimateTokens(m),
      0
    );
    
    return originalTokens - consolidatedTokens;
  }
  
  private estimateTokens(memory: AgentMemory): number {
    const text = this.memoryToText(memory);
    return Math.ceil(text.length / 4);
  }
  
  private memoryToText(memory: AgentMemory): string {
    return JSON.stringify(memory.content);
  }
}