# Graph Semantic Memory SOP
# Standard Operating Procedure for Knowledge Graph Implementation

## Overview

Graph Semantic Memory represents the long-term knowledge store of an AI agent, implemented as a knowledge graph that captures entities, relationships, and conceptual understanding. This SOP provides comprehensive guidance for implementing, managing, and optimizing semantic memory systems.

## Technology Foundation

### Core Concept
Knowledge graphs store factual information as interconnected nodes (entities) and edges (relationships), enabling sophisticated reasoning, inference, and contextual understanding. Unlike episodic memory which stores events, semantic memory stores **what we know** about the world.

### Research Foundation
- **Cognitive Science**: Based on human semantic memory models (Tulving, 1972)
- **Graph Theory**: Leverages network analysis and graph algorithms
- **Knowledge Representation**: Follows RDF, OWL, and semantic web standards
- **AI Research**: Incorporates advances in knowledge graph embeddings and neural-symbolic AI

## Vendor Recommendations

### Primary Recommendation: Zep (getzep.com)
**Rating**: ⭐⭐⭐⭐⭐ (Preferred - IMPLEMENTED IN AGENTOPIA)

**Strengths**:
- Purpose-built for AI memory management
- Native LLM integration with memory-aware APIs
- Automatic memory extraction and graph construction
- Built-in temporal reasoning and memory decay
- Production-ready with enterprise features
- Comprehensive observability and analytics
- **v3 API**: Simplified graph.add() interface for all data types
- **Async Processing**: Handles large-scale ingestion efficiently

**Use Cases**:
- AI agents requiring sophisticated memory management
- Applications needing automatic knowledge extraction
- Systems requiring temporal reasoning capabilities
- Production environments with enterprise requirements
- **Account-wide knowledge graphs** (as implemented in Agentopia)

**Implementation Status**: ✅ **FULLY INTEGRATED IN AGENTOPIA**
- Secure API key management via Supabase Vault
- Async ingestion queue for scalability
- Automatic graph building from conversations
- Context injection in chat pipeline

**Pricing**: Contact for enterprise pricing, offers developer tiers

### Cloud-Based Solutions

#### Amazon Neptune
**Rating**: ⭐⭐⭐⭐ (Enterprise Grade)

**Strengths**:
- Fully managed graph database service
- Supports both property graphs (Gremlin) and RDF (SPARQL)
- High availability with automated backups
- Integrated with AWS ecosystem
- Serverless options available
- Strong security and compliance features

**Weaknesses**:
- Higher cost for smaller deployments
- Vendor lock-in to AWS ecosystem
- Learning curve for query languages

**Best For**: Large-scale enterprise applications, AWS-native architectures
**Pricing**: $0.10-0.72/hour per instance + storage costs

#### Azure Cosmos DB (Gremlin API)
**Rating**: ⭐⭐⭐⭐ (Enterprise Grade)

**Strengths**:
- Multi-model database with graph support
- Global distribution capabilities
- Automatic scaling
- SLA guarantees (99.999% availability)
- Integration with Azure AI services

**Best For**: Microsoft ecosystem, global applications
**Pricing**: Request Units model, varies by throughput

### Self-Hosted Solutions

#### Neo4j
**Rating**: ⭐⭐⭐⭐⭐ (Industry Standard)

**Strengths**:
- Most mature graph database
- Cypher query language (intuitive)
- Excellent tooling and ecosystem
- Strong community and documentation
- ACID compliance
- Built-in graph algorithms library

**Editions**:
- **Community**: Free, limited to single instance
- **Enterprise**: $36,000/year, full features
- **AuraDB**: Cloud-managed service

**Best For**: Complex graph analytics, established teams, rich ecosystem needs

#### ArangoDB
**Rating**: ⭐⭐⭐⭐ (Multi-Model)

**Strengths**:
- Multi-model (document, graph, search)
- Native graph algorithms
- Distributed architecture
- AQL query language
- Good performance characteristics

**Best For**: Teams needing multiple data models in one system
**Pricing**: Free community edition, enterprise licensing available

### Open Source Alternatives

#### Apache TinkerPop/JanusGraph
**Rating**: ⭐⭐⭐ (Distributed Focus)

**Strengths**:
- Highly scalable distributed architecture
- Supports multiple storage backends
- Apache foundation project
- Gremlin query language
- Pluggable architecture

**Challenges**:
- Complex setup and configuration
- Steeper learning curve
- Limited tooling compared to commercial options

**Best For**: Massive scale requirements, custom implementations

#### OrientDB
**Rating**: ⭐⭐⭐ (Multi-Model)

**Strengths**:
- Multi-model database (graph, document, key-value)
- ACID transactions
- SQL-like syntax
- Good performance for medium-scale applications

**Best For**: Teams familiar with SQL, mixed data model needs

#### GraphDB (Ontotext)
**Rating**: ⭐⭐⭐⭐ (Semantic Web Focus)

**Strengths**:
- RDF and SPARQL native
- Excellent for semantic web applications
- Reasoning and inference capabilities
- OWL support

**Best For**: Semantic web applications, ontology-heavy use cases

## Implementation Architecture

### Core Components

#### 1. Entity Extraction Pipeline
```
Input Text → NER Models → Entity Normalization → Graph Insertion
```

**Technologies**:
- **spaCy**: Industrial-strength NLP
- **Hugging Face Transformers**: BERT-based NER models
- **Stanford CoreNLP**: Academic-grade extraction
- **Custom Rules**: Domain-specific patterns

#### 2. Relationship Extraction
```
Entity Pairs → Dependency Parsing → Relation Classification → Edge Creation
```

**Approaches**:
- **Pattern-based**: Regular expressions and linguistic patterns
- **ML-based**: Transformer models for relation extraction
- **Hybrid**: Combination of rules and machine learning

#### 3. Knowledge Graph Schema
```yaml
Nodes:
  - Person: {name, birth_date, occupation, ...}
  - Organization: {name, founded, industry, ...}
  - Concept: {name, definition, category, ...}
  - Event: {name, date, location, participants, ...}

Edges:
  - WORKS_FOR: Person → Organization
  - PART_OF: Organization → Organization
  - RELATED_TO: Concept → Concept
  - PARTICIPATED_IN: Person → Event
```

#### 4. Confidence Scoring System
```
Node Score = f(source_reliability, extraction_confidence, validation_results)
Edge Score = f(evidence_strength, source_count, temporal_consistency)
```

## Implementation Best Practices

### 1. Schema Design Principles

#### Flexible Schema Evolution
- Start with core entity types and relationships
- Design for extensibility with generic properties
- Implement schema versioning from day one
- Use property graphs for flexibility over rigid schemas

#### Naming Conventions
```
Entities: PascalCase (Person, Organization)
Relationships: UPPER_SNAKE_CASE (WORKS_FOR, PART_OF)
Properties: snake_case (first_name, created_at)
```

#### Data Quality Standards
- Implement unique constraints for entity identification
- Establish data validation rules
- Create audit trails for all changes
- Implement soft deletes for data recovery

### 2. Performance Optimization

#### Indexing Strategy
```sql
-- Neo4j Examples
CREATE INDEX ON :Person(name)
CREATE INDEX ON :Organization(name)
CREATE FULLTEXT INDEX entity_search FOR (n:Person|Organization) ON EACH [n.name, n.description]
```

#### Query Optimization
- Use query profiling tools (EXPLAIN/PROFILE in Neo4j)
- Implement query result caching
- Optimize for common access patterns
- Use parameterized queries to prevent injection

#### Memory Management
- Configure appropriate heap sizes for graph databases
- Implement connection pooling
- Use read replicas for query-heavy workloads
- Monitor memory usage and garbage collection

### 3. Data Integration Pipeline

#### ETL Process
```python
# Example extraction pipeline
def process_memory_into_graph(episodic_memory):
    # 1. Extract entities and relationships
    entities = extract_entities(episodic_memory.content)
    relationships = extract_relationships(episodic_memory.content, entities)
    
    # 2. Resolve entities (deduplication)
    resolved_entities = entity_resolver.resolve(entities)
    
    # 3. Validate and score
    scored_entities = confidence_scorer.score(resolved_entities)
    scored_relationships = confidence_scorer.score(relationships)
    
    # 4. Update graph
    graph.upsert_entities(scored_entities)
    graph.upsert_relationships(scored_relationships)
    
    # 5. Update episodic memory with graph references
    episodic_memory.graph_references = extract_graph_ids(resolved_entities)
    return episodic_memory
```

#### Batch Processing
- Process memories in batches for efficiency
- Implement incremental updates
- Use transaction boundaries appropriately
- Handle failures gracefully with retry logic

### 4. Query Patterns and Optimization

#### Common Query Types

**Entity Lookup**:
```cypher
// Neo4j Cypher
MATCH (p:Person {name: $person_name})
RETURN p
```

**Relationship Traversal**:
```cypher
MATCH (p:Person)-[r:WORKS_FOR]->(o:Organization)
WHERE p.name = $person_name
RETURN o.name, r.start_date
```

**Graph Analytics**:
```cypher
// Find influential people (high degree centrality)
MATCH (p:Person)
WITH p, size((p)--()) as connections
ORDER BY connections DESC
LIMIT 10
RETURN p.name, connections
```

#### Zep-Specific Queries (v3 API - As Implemented in Agentopia)
```python
# Using Zep v3 API
from zep_cloud.client import Zep

client = Zep(api_key="your-key")

# INGESTION - Add messages to thread (automatic knowledge extraction)
# Note: Uses thread.addMessages, NOT graph.add (which doesn't exist in v3)
messages = [
    {
        "role": "user",
        "content": "The user is building an AI agent platform..."
    },
    {
        "role": "assistant", 
        "content": "That's interesting! Tell me more about the platform."
    }
]

# Create thread if needed
thread_id = f"user_{user_id}_graph"
try:
    await client.thread.addMessages(thread_id, {"messages": messages})
except Exception as e:
    if "thread not found" in str(e):
        # Create thread first
        await client.thread.create({"threadId": thread_id, "userId": user_id})
        await client.thread.addMessages(thread_id, {"messages": messages})

# RETRIEVAL - Get user context (includes graph-derived knowledge)
# Note: Uses thread.getUserContext, NOT memory.searchMemory
try:
    context = await client.thread.getUserContext(thread_id)
    # context.context contains the formatted context string
    # Parse and use as needed
except Exception as e:
    if "not found" in str(e):
        # Thread doesn't exist yet, return empty
        context = None
```

**Agentopia Implementation**:
```typescript
// Direct ingestion in chat function (no queue needed)
// File: supabase/functions/chat/core/memory/getzep_semantic_manager.ts

// INGESTION
const threadId = `user_${this.config.userId}_graph`;
const messages = this.parseContentToMessages(content);

try {
    // Try to add messages to existing thread
    await this.client.thread.addMessages(threadId, { messages });
} catch (error: any) {
    if (error?.message?.includes('thread not found')) {
        // Create thread if it doesn't exist
        await this.client.thread.create({ 
            threadId: threadId, 
            userId: this.config.userId 
        });
        // Retry adding messages
        await this.client.thread.addMessages(threadId, { messages });
    }
}

// RETRIEVAL
try {
    const context = await this.client.thread.getUserContext(threadId);
    return this.parseContextToMemories(context);
} catch (error: any) {
    if (error?.message?.includes('not found')) {
        // Thread doesn't exist yet, return empty
        return [];
    }
    throw error;
}
```

### 5. Memory Integration Patterns

#### Episodic-to-Semantic Pipeline
```python
class MemoryIntegrator:
    def process_episodic_memory(self, episodic_memory):
        # Extract semantic facts from episodic memories
        facts = self.fact_extractor.extract(episodic_memory)
        
        # Check for conflicts with existing knowledge
        conflicts = self.conflict_detector.detect(facts, self.semantic_graph)
        
        # Resolve conflicts and update confidence scores
        resolved_facts = self.conflict_resolver.resolve(conflicts)
        
        # Update semantic graph
        self.semantic_graph.integrate_facts(resolved_facts)
        
        # Update episodic memory with semantic links
        episodic_memory.semantic_links = self.link_extractor.extract(facts)
        
        return episodic_memory
```

#### Retrieval Augmentation
```python
def augment_query_with_semantic_context(query, user_context):
    # Find relevant semantic concepts
    concepts = semantic_graph.find_concepts(query)
    
    # Get related entities and relationships
    context_graph = semantic_graph.get_subgraph(concepts, depth=2)
    
    # Format as additional context
    semantic_context = format_graph_as_context(context_graph)
    
    # Combine with episodic context
    full_context = f"{semantic_context}\n\nRecent conversations:\n{user_context}"
    
    return full_context
```

## Monitoring and Maintenance

### Key Metrics
- **Graph Size**: Number of nodes and edges over time
- **Query Performance**: Response times for common queries
- **Data Quality**: Confidence score distributions
- **Growth Rate**: New entities and relationships per period
- **Conflict Rate**: Percentage of extractions requiring resolution

### Maintenance Tasks
- **Daily**: Monitor query performance and error rates
- **Weekly**: Review data quality metrics and confidence scores
- **Monthly**: Analyze graph growth patterns and optimize queries
- **Quarterly**: Review schema evolution and plan updates

### Alerting
```yaml
alerts:
  - name: "High Query Latency"
    condition: "p95_query_time > 1000ms"
    action: "Scale read replicas"
  
  - name: "Low Confidence Scores"
    condition: "avg_confidence < 0.7"
    action: "Review extraction models"
  
  - name: "Graph Growth Anomaly"
    condition: "daily_growth > 2x_avg"
    action: "Investigate data quality"
```

## Integration Examples

### LangChain Integration
```python
from langchain.memory import ZepMemory
from langchain.retrievers import ZepRetriever

# Configure Zep-based semantic memory
semantic_memory = ZepMemory(
    session_id="user123",
    url="https://your-zep-instance.com",
    api_key="your-api-key",
    memory_type="semantic"
)

# Use as retriever in RAG pipeline
semantic_retriever = ZepRetriever(
    zep_client=zep_client,
    session_id="user123",
    top_k=5
)
```

### Agentopia Production Implementation
```typescript
// File: supabase/functions/chat/core/memory/memory_manager.ts
// Direct ingestion - no queue needed
const semanticPromise = (async () => {
    if (!this.getzepManager) return;
    
    try {
        // Direct ingestion to GetZep
        await this.getzepManager.ingest(
            `User: ${messages[0].content}\nAssistant: ${messages[1].content}`
        );
        console.log('[MemoryManager] ✅ Successfully ingested to GetZep');
    } catch (error) {
        console.warn('[MemoryManager] GetZep ingestion failed:', error);
    }
})();

// Context retrieval in chat pipeline
// File: supabase/functions/chat/processor/stages.ts
if (agent.metadata?.settings?.use_account_graph) {
    const memoryResults = await this.memoryManager.contextualSearch(
        context.agent_id,
        queryText,
        { memory_types: ['episodic', 'semantic'] }
    );
    
    // Semantic metrics with actual memory content
    metrics.semantic_memory = {
        searched: true,
        results_count: memoryResults.semantic?.length || 0,
        memories: memoryResults.semantic?.slice(0, 10).map((m: any) => ({
            id: m.id,
            content: m.content || m,
            relevance_score: m.relevance_score,
            source: 'getzep'
        }))
    };
}
```

### Custom Graph Integration
```python
from neo4j import GraphDatabase

class SemanticMemoryRetriever:
    def __init__(self, neo4j_uri, auth):
        self.driver = GraphDatabase.driver(neo4j_uri, auth=auth)
    
    def retrieve_semantic_context(self, query_entities):
        with self.driver.session() as session:
            result = session.run("""
                MATCH (e:Entity)
                WHERE e.name IN $entities
                MATCH (e)-[r*1..2]-(related)
                RETURN e, r, related
                LIMIT 20
            """, entities=query_entities)
            
            return self.format_graph_context(result)
```

## Security and Compliance

### Data Privacy
- Implement field-level encryption for sensitive data
- Use role-based access control (RBAC)
- Audit all data access and modifications
- Implement data retention policies

### Compliance Considerations
- **GDPR**: Right to be forgotten, data portability
- **CCPA**: California privacy requirements
- **HIPAA**: Healthcare data protection (if applicable)
- **SOC 2**: Security and availability controls

## Troubleshooting Guide

### Common Issues

#### Poor Query Performance
**Symptoms**: Slow response times, high CPU usage
**Solutions**:
- Add appropriate indexes
- Optimize query patterns
- Increase memory allocation
- Use query profiling tools

#### Low Extraction Quality
**Symptoms**: Low confidence scores, incorrect relationships
**Solutions**:
- Retrain extraction models
- Adjust confidence thresholds
- Implement domain-specific rules
- Improve input data quality

#### Graph Fragmentation
**Symptoms**: Many disconnected components
**Solutions**:
- Improve entity resolution
- Add more relationship types
- Implement entity linking
- Review extraction coverage

#### GetZep v3 API Issues (Agentopia-Specific)
**Symptoms**: 404 errors, "thread not found", "not found"
**Solutions**:
- Use `client.thread.addMessages()` for ingestion, NOT `graph.add()` (doesn't exist)
- Use `client.thread.getUserContext()` for retrieval, NOT `memory.searchMemory()`
- Auto-create threads on first message: catch "thread not found" and create
- Thread ID format must be consistent: `user_${userId}_graph`
- API key must use `Api-Key` header, not `Bearer` for REST (SDK handles this)
- Verify API key starts with `z_` and has correct permissions

#### Vault Decryption Failures
**Symptoms**: "invalid ciphertext" errors
**Solutions**:
- API keys stored directly as fallback
- Check vault configuration in Supabase dashboard
- Use `vault_decrypt` RPC function for edge functions

### Performance Tuning Checklist
- [ ] Appropriate indexes created
- [ ] Query cache configured
- [ ] Memory settings optimized
- [ ] Connection pooling enabled
- [ ] Read replicas for scaling
- [ ] Monitoring and alerting active

## Cost Optimization

### Zep Optimization
- Use appropriate tier for usage patterns
- Implement memory retention policies
- Monitor API usage and optimize calls
- Cache frequently accessed memories

### Self-Hosted Optimization
- Right-size infrastructure based on usage
- Use spot instances for non-critical workloads
- Implement data archiving strategies
- Optimize backup and recovery processes

### General Strategies
- Implement data lifecycle management
- Use compression for archived data
- Monitor and optimize query patterns
- Regular cost reviews and adjustments

## Agentopia-Specific Implementation Notes

### Current Status
✅ **PRODUCTION READY** - GetZep v3 fully integrated and operational

### Architecture Decisions
1. **Account-Wide Graphs**: Single graph per user, shared across all agents
2. **Async Processing**: Queue-based ingestion for scalability
3. **Vault Integration**: Secure API key storage with fallback mechanism
4. **Feature Flags**: Gradual rollout capability built-in

### Key Files
- **GetZep Manager**: `supabase/functions/chat/core/memory/getzep_semantic_manager.ts`
- **Memory Orchestrator**: `supabase/functions/chat/core/memory/memory_manager.ts`
- **Context Enrichment**: `supabase/functions/chat/processor/stages.ts`
- **Message Handler**: `supabase/functions/chat/processor/handlers.ts`
- **UI Component**: `src/pages/GraphSettingsPage.tsx`
- **Process Modal**: `src/components/modals/ProcessModal.tsx`
- **Documentation**: `docs/integrations/getzep.mdc`

### Testing Scripts
- `scripts/tests/check_zep_connection.ts` - Verify connection
- `scripts/tests/send_to_getzep.ts` - Test data ingestion
- `scripts/tests/e2e_graph.ts` - End-to-end testing

### Monitoring
- Ingestion success via Edge Function logs: `[GetZepSemantic] ✅ Successfully ingested`
- Retrieval metrics in Process Modal (episodic & semantic memory sections)
- Memory content visible in expandable dropdowns in Process Modal
- Error tracking in Edge Function logs (404s auto-handled)
- Knowledge Graph toggle status per agent in UI

---

*Last Updated: January 2025*
*Next Review: April 2025*
*Owner: AI Architecture Team*
*Implementation Lead: Agentopia Development Team* 