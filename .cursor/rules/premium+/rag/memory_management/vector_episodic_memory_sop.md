# Vector Episodic Memory SOP
# Standard Operating Procedure for Event-Based Memory Systems

## Overview

Vector Episodic Memory stores specific events, interactions, and experiences as searchable vector embeddings, enabling AI agents to recall contextual information from past conversations and events. This memory type captures **what happened when** and serves as the foundation for building long-term contextual understanding.

## Technology Foundation

### Core Concept
Episodic memory stores time-stamped events and interactions as high-dimensional vector embeddings, enabling semantic similarity search to retrieve relevant past experiences. Unlike semantic memory which stores facts, episodic memory preserves the context and sequence of events.

### Research Foundation
- **Cognitive Psychology**: Based on Endel Tulving's episodic memory theory (1972)
- **Vector Search**: Leverages approximate nearest neighbor (ANN) algorithms
- **Temporal Modeling**: Incorporates time-decay and recency bias
- **Context Windows**: Manages token limits through intelligent summarization

## Vendor Recommendations

### Primary Recommendation: Pinecone
**Rating**: ⭐⭐⭐⭐⭐ (Preferred for Vector Storage)

**Strengths**:
- Purpose-built vector database with sub-100ms query latency
- Fully managed with automatic scaling and load balancing
- Hybrid search capabilities (dense + sparse vectors)
- Strong consistency and durability guarantees
- Rich metadata filtering for complex queries
- Production-ready with enterprise features
- Excellent developer experience and documentation

**Key Features**:
- Real-time vector search at massive scale
- Advanced metadata filtering and faceting
- Automatic index optimization
- Multi-tenancy and namespace isolation
- Comprehensive monitoring and analytics
- High availability with 99.9% uptime SLA

**Use Cases**:
- High-throughput conversational AI systems
- Large-scale episodic memory storage
- Production applications requiring reliability
- Systems needing advanced metadata filtering

**Pricing**: $0.096/1M vectors/month + compute costs

### Cloud Vector Database Solutions

#### Weaviate Cloud
**Rating**: ⭐⭐⭐⭐ (Feature-Rich)

**Strengths**:
- Multi-modal vector search (text, images, audio)
- Built-in ML model inference
- GraphQL API with flexible querying
- Hybrid search capabilities
- Strong schema flexibility
- Active open-source community

**Best For**: Multi-modal applications, complex data types
**Pricing**: Free tier available, usage-based pricing

#### Amazon OpenSearch (with vector support)
**Rating**: ⭐⭐⭐ (AWS Integration)

**Strengths**:
- Integrated with AWS ecosystem
- Combines vector search with traditional search
- Strong analytics and monitoring
- Proven enterprise reliability

**Weaknesses**:
- Less optimized for pure vector workloads
- More complex setup for vector-only use cases

**Best For**: AWS-native architectures, hybrid search needs

### Self-Hosted Vector Solutions

#### Chroma
**Rating**: ⭐⭐⭐⭐ (Developer-Friendly)

**Strengths**:
- Open-source and embeddable
- Python-native with simple API
- Built-in embedding functions
- Local development friendly
- Strong LangChain integration

**Best For**: Development, prototyping, local deployments
**Cost**: Free open-source

#### Qdrant
**Rating**: ⭐⭐⭐⭐ (Performance-Focused)

**Strengths**:
- High performance and efficiency
- Advanced filtering capabilities
- Rust-based for speed and safety
- Quantization support for memory efficiency
- Rich API and client libraries

**Best For**: Performance-critical applications, resource efficiency
**Cost**: Open-source with cloud offering

#### Milvus
**Rating**: ⭐⭐⭐⭐ (Enterprise-Scale)

**Strengths**:
- Highly scalable distributed architecture
- Multiple index types (IVF, HNSW, DiskANN)
- Strong consistency guarantees
- Rich ecosystem and tooling
- CNCF graduated project

**Best For**: Large-scale production deployments
**Cost**: Open-source with commercial support

### Traditional Database Solutions

#### PostgreSQL + pgvector
**Rating**: ⭐⭐⭐ (SQL Integration)

**Strengths**:
- Leverages existing PostgreSQL expertise
- ACID transactions
- Rich SQL ecosystem
- Cost-effective for smaller deployments

**Weaknesses**:
- Limited performance at very large scales
- Manual optimization required

**Best For**: Teams with PostgreSQL expertise, transactional requirements

#### MongoDB Atlas Vector Search
**Rating**: ⭐⭐⭐⭐ (Unified Platform)

**Strengths**:
- Combines document and vector storage
- Single database for all memory types
- Native aggregation pipeline support
- Strong enterprise features

**Best For**: Unified memory architecture, MongoDB expertise

## Implementation Architecture

### Core Components

#### 1. Memory Ingestion Pipeline
```
Conversation → Chunking → Embedding → Metadata Extraction → Storage
```

**Process Flow**:
1. **Input Processing**: Clean and normalize conversation data
2. **Chunking Strategy**: Split into semantically coherent segments
3. **Embedding Generation**: Convert text to vector representations
4. **Metadata Extraction**: Extract temporal, user, and contextual metadata
5. **Storage**: Store vectors with rich metadata for filtering

#### 2. Memory Retrieval System
```
Query → Embedding → Vector Search → Metadata Filtering → Ranking → Return
```

**Retrieval Strategies**:
- **Semantic Similarity**: Vector cosine similarity search
- **Temporal Filtering**: Recency-based relevance scoring
- **Metadata Filtering**: User, session, topic-based filters
- **Hybrid Ranking**: Combine similarity with relevance scores

#### 3. Memory Lifecycle Management
```
Creation → Active Use → Decay → Archival → Deletion
```

**Lifecycle Stages**:
- **Active**: Recently created, high relevance
- **Aging**: Decreasing relevance over time
- **Archived**: Low relevance but preserved
- **Expired**: Beyond retention policy

## Implementation Best Practices

### 1. Chunking Strategies

#### Semantic Chunking
```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

def create_semantic_chunks(conversation):
    # Split by conversation turns first
    turns = split_by_speaker(conversation)
    
    # Then by semantic coherence
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=512,
        chunk_overlap=50,
        separators=["\n\n", "\n", ". ", " "]
    )
    
    chunks = []
    for turn in turns:
        turn_chunks = splitter.split_text(turn.content)
        for chunk in turn_chunks:
            chunks.append({
                'content': chunk,
                'speaker': turn.speaker,
                'timestamp': turn.timestamp,
                'turn_id': turn.id
            })
    
    return chunks
```

#### Message-Level Chunking
```python
def create_message_chunks(conversation):
    """Store each message as a separate memory chunk"""
    chunks = []
    for message in conversation.messages:
        chunks.append({
            'content': message.content,
            'role': message.role,
            'timestamp': message.timestamp,
            'session_id': conversation.session_id,
            'user_id': conversation.user_id
        })
    return chunks
```

### 2. Metadata Schema Design

#### Comprehensive Metadata
```json
{
  "memory_id": "mem_12345",
  "content": "User asked about machine learning algorithms",
  "embedding": [0.1, 0.2, ..., 0.9],
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "user_id": "user_123",
    "session_id": "sess_456",
    "message_role": "user",
    "topics": ["machine_learning", "algorithms"],
    "entities": ["GPT", "neural_networks"],
    "sentiment": 0.7,
    "importance_score": 0.8,
    "conversation_turn": 15,
    "response_length": 142,
    "language": "en"
  }
}
```

### 3. Embedding Strategies

#### Multi-Model Approach
```python
class EmbeddingManager:
    def __init__(self):
        # General purpose embeddings
        self.general_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Domain-specific embeddings
        self.domain_model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')
        
        # Conversation-optimized embeddings
        self.dialogue_model = OpenAIEmbeddings(model="text-embedding-ada-002")
    
    def generate_embeddings(self, text, context_type="general"):
        if context_type == "technical":
            return self.domain_model.encode(text)
        elif context_type == "conversation":
            return self.dialogue_model.embed_query(text)
        else:
            return self.general_model.encode(text)
```

### 4. Retrieval Optimization

#### Pinecone Integration Example
```python
import pinecone
from datetime import datetime, timedelta

class PineconeEpisodicMemory:
    def __init__(self, api_key, environment, index_name):
        pinecone.init(api_key=api_key, environment=environment)
        self.index = pinecone.Index(index_name)
        self.embedding_model = OpenAIEmbeddings()
    
    def store_memory(self, content, metadata):
        """Store a conversation memory in Pinecone"""
        embedding = self.embedding_model.embed_query(content)
        
        # Add importance and temporal metadata
        enhanced_metadata = {
            **metadata,
            'importance': self.calculate_importance(content, metadata),
            'created_at': datetime.now().isoformat(),
            'decay_factor': 1.0  # Fresh memory
        }
        
        memory_id = f"mem_{metadata['user_id']}_{int(datetime.now().timestamp())}"
        
        self.index.upsert([(memory_id, embedding, enhanced_metadata)])
        return memory_id
    
    def retrieve_relevant_memories(self, query, user_id, limit=10, time_window_days=30):
        """Retrieve relevant episodic memories with temporal filtering"""
        query_embedding = self.embedding_model.embed_query(query)
        
        # Calculate time window for filtering
        cutoff_date = (datetime.now() - timedelta(days=time_window_days)).isoformat()
        
        # Search with metadata filtering
        results = self.index.query(
            vector=query_embedding,
            top_k=limit * 2,  # Get more results for post-processing
            filter={
                "user_id": {"$eq": user_id},
                "created_at": {"$gte": cutoff_date}
            },
            include_metadata=True
        )
        
        # Apply temporal decay and re-rank
        scored_results = []
        current_time = datetime.now()
        
        for match in results.matches:
            # Calculate temporal decay
            created_at = datetime.fromisoformat(match.metadata['created_at'])
            time_diff = current_time - created_at
            decay_factor = self.calculate_temporal_decay(time_diff)
            
            # Combine similarity with temporal relevance and importance
            final_score = (
                match.score * 0.6 +  # Semantic similarity
                decay_factor * 0.3 +  # Temporal relevance
                match.metadata.get('importance', 0.5) * 0.1  # Importance
            )
            
            scored_results.append((match, final_score))
        
        # Sort by final score and return top results
        scored_results.sort(key=lambda x: x[1], reverse=True)
        return [result[0] for result in scored_results[:limit]]
    
    def calculate_temporal_decay(self, time_diff):
        """Exponential decay based on time difference"""
        days = time_diff.days
        return math.exp(-days / 30)  # Half-life of ~30 days
    
    def calculate_importance(self, content, metadata):
        """Calculate importance score based on content and context"""
        score = 0.5  # Base score
        
        # Length indicates detailed information
        if len(content) > 100:
            score += 0.2
        
        # Questions are important for context
        if '?' in content:
            score += 0.2
        
        # User messages often more important than system
        if metadata.get('message_role') == 'user':
            score += 0.1
        
        return min(1.0, score)
```

#### Zep Integration Example
```python
from zep_python import ZepClient, Message

class ZepEpisodicMemory:
    def __init__(self, api_key, base_url):
        self.client = ZepClient(api_key=api_key, base_url=base_url)
    
    def store_conversation_turn(self, session_id, user_message, assistant_message):
        """Store a complete conversation turn in Zep"""
        messages = [
            Message(
                role="user",
                content=user_message,
                metadata={"importance": self.calculate_importance(user_message)}
            ),
            Message(
                role="assistant", 
                content=assistant_message,
                metadata={"importance": self.calculate_importance(assistant_message)}
            )
        ]
        
        return self.client.add_memory(session_id, messages)
    
    def retrieve_conversation_context(self, session_id, query, limit=10):
        """Retrieve relevant conversation context using Zep's hybrid search"""
        # Use Zep's built-in vector + graph search
        search_results = self.client.search_memory(
            session_id=session_id,
            query=query,
            limit=limit,
            search_type="similarity"  # or "mmr" for maximum marginal relevance
        )
        
        return self.format_conversation_context(search_results)
    
    def get_conversation_summary(self, session_id):
        """Get Zep's automatic conversation summary"""
        summary = self.client.get_session_summary(session_id)
        return summary.content if summary else None
```

### 5. Memory Consolidation

#### Automatic Summarization
```python
class MemoryConsolidator:
    def __init__(self, vector_store, summarization_model):
        self.vector_store = vector_store
        self.summarization_model = summarization_model
    
    def consolidate_session_memories(self, session_id, threshold=50):
        # Retrieve all memories from session
        memories = self.get_session_memories(session_id)
        
        if len(memories) > threshold:
            # Create summary of older memories
            old_memories = memories[:-20]  # Keep recent 20 as-is
            summary = self.summarize_memories(old_memories)
            
            # Store summary as consolidated memory
            consolidated_memory = {
                'content': summary,
                'metadata': {
                    'type': 'consolidated',
                    'original_count': len(old_memories),
                    'time_range': self.get_time_range(old_memories),
                    'session_id': session_id
                }
            }
            
            # Archive original memories and store summary
            self.archive_memories(old_memories)
            self.vector_store.store_memory(consolidated_memory['content'], 
                                         consolidated_memory['metadata'])
    
    def summarize_memories(self, memories):
        """Create intelligent summary of memory collection"""
        combined_text = "\n".join([mem['content'] for mem in memories])
        
        summary = self.summarization_model.summarize(
            combined_text,
            max_length=200,
            min_length=50
        )
        
        return summary
```

## Monitoring and Performance

### Key Metrics

#### Performance Metrics
- **Query Latency**: p50, p95, p99 response times
- **Throughput**: Queries per second capacity
- **Memory Growth**: Rate of new memory creation
- **Storage Efficiency**: Compression ratios and storage costs

#### Quality Metrics
- **Retrieval Relevance**: Manual evaluation of search results
- **Temporal Accuracy**: Correct time-based filtering
- **User Satisfaction**: Feedback on memory recall quality
- **Coverage**: Percentage of conversations successfully stored

### Monitoring Setup

#### Pinecone Monitoring
```python
class PineconeMonitor:
    def __init__(self, pinecone_index):
        self.index = pinecone_index
        
    def check_index_health(self):
        # Check index statistics
        stats = self.index.describe_index_stats()
        
        return {
            'total_vectors': stats.total_vector_count,
            'index_fullness': stats.index_fullness,
            'namespaces': len(stats.namespaces),
            'dimension': stats.dimension
        }
    
    def monitor_query_performance(self, query_vector, metadata_filter=None):
        start_time = time.time()
        
        results = self.index.query(
            vector=query_vector,
            top_k=10,
            filter=metadata_filter,
            include_metadata=True
        )
        
        query_time = time.time() - start_time
        
        return {
            'query_time': query_time,
            'results_count': len(results.matches),
            'max_score': max([m.score for m in results.matches]) if results.matches else 0
        }
```

#### Custom Monitoring
```python
import prometheus_client as prom

# Define metrics
MEMORY_OPERATIONS = prom.Counter('episodic_memory_operations_total', 'Total memory operations', ['operation', 'status'])
QUERY_LATENCY = prom.Histogram('episodic_memory_query_duration_seconds', 'Query latency')
MEMORY_SIZE = prom.Gauge('episodic_memory_vectors_total', 'Total number of vectors stored')

class MemoryMonitor:
    def record_operation(self, operation, status='success'):
        MEMORY_OPERATIONS.labels(operation=operation, status=status).inc()
    
    def record_query_latency(self, duration):
        QUERY_LATENCY.observe(duration)
    
    def update_memory_count(self, count):
        MEMORY_SIZE.set(count)
```

## Integration Patterns

### LangChain Integration
```python
from langchain.memory import VectorStoreRetrieverMemory
from langchain.vectorstores import Pinecone
from langchain.schema import BaseMessage

class PineconeEpisodicMemoryChain:
    def __init__(self, pinecone_index, embedding_model):
        self.vectorstore = Pinecone(pinecone_index, embedding_model, "content")
        
        self.memory = VectorStoreRetrieverMemory(
            vectorstore=self.vectorstore,
            memory_key="episodic_context",
            return_docs=True
        )
    
    def process_conversation_turn(self, human_message, ai_message):
        # Store the conversation turn
        self.memory.save_context(
            {"input": human_message},
            {"output": ai_message}
        )
        
        # Retrieve relevant context for next turn
        relevant_memories = self.memory.load_memory_variables({})
        return relevant_memories
```

### Framework-Agnostic Integration
```python
class EpisodicMemoryInterface:
    def __init__(self, config):
        self.config = config
        self.vector_store = self._initialize_vector_store()
        
    def _initialize_vector_store(self):
        provider = self.config.get('provider', 'pinecone')
        
        if provider == 'pinecone':
            return PineconeEpisodicMemory(
                api_key=self.config['api_key'],
                environment=self.config['environment'],
                index_name=self.config['index_name']
            )
        elif provider == 'zep':
            return ZepEpisodicMemory(
                api_key=self.config['api_key'],
                base_url=self.config['base_url']
            )
        elif provider == 'chroma':
            return ChromaEpisodicMemory(
                collection_name=self.config['collection_name']
            )
        else:
            raise ValueError(f"Unsupported provider: {provider}")
    
    def process_turn(self, user_input, system_response, session_id, user_id):
        """Process a complete conversation turn"""
        # Store user message
        user_metadata = {
            'user_id': user_id,
            'session_id': session_id,
            'message_role': 'user',
            'timestamp': datetime.now().isoformat()
        }
        self.vector_store.store_memory(user_input, user_metadata)
        
        # Store system response
        system_metadata = {
            'user_id': user_id,
            'session_id': session_id,
            'message_role': 'assistant',
            'timestamp': datetime.now().isoformat()
        }
        self.vector_store.store_memory(system_response, system_metadata)
        
        # Return relevant context for next turn
        return self.vector_store.retrieve_relevant_memories(
            user_input, user_id, limit=5
        )
```

## Cost Optimization

### Pinecone Cost Optimization
- Choose appropriate vector dimensions (trade-off between quality and cost)
- Implement intelligent archival to reduce active vector count
- Use namespaces for efficient multi-tenancy
- Monitor and optimize query patterns
- Implement caching for frequently accessed memories

### General Vector Database Optimization
- Implement quantization for memory-intensive deployments
- Use tiered storage (hot/warm/cold) based on access patterns
- Optimize batch sizes for ingestion and retrieval
- Monitor storage growth and implement alerts

### Zep Cost Optimization
- Use appropriate retention policies
- Implement memory consolidation for long sessions
- Monitor API usage and optimize query patterns
- Leverage built-in summarization features

---

*Last Updated: [Current Date]*
*Next Review: [Quarterly Review Date]*
*Owner: AI Memory Team* 