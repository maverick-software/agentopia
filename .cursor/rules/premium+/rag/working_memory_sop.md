# Working Memory SOP
# Standard Operating Procedure for Short-Term Context Management

## Overview

Working Memory (also called Short-Term Memory) serves as the active workspace for AI agents, managing the immediate context window and maintaining conversational flow. This SOP covers implementation strategies for efficient context management, overflow handling, and real-time processing optimization.

## Technology Foundation

### Core Concept
Working memory manages the limited context window available to language models, ensuring optimal utilization of tokens while maintaining conversational coherence. It acts as a dynamic buffer between long-term memory systems and the LLM's immediate processing capabilities.

### Research Foundation
- **Cognitive Psychology**: Based on Baddeley's working memory model (1974)
- **Information Theory**: Token efficiency and information density optimization
- **Attention Mechanisms**: Importance-based token allocation
- **Compression Theory**: Lossy and lossless context compression

## Context Window Management Strategies

### 1. Fixed Window Approaches

#### Simple FIFO (First In, First Out)
```python
class FIFOWorkingMemory:
    def __init__(self, max_tokens=4000):
        self.max_tokens = max_tokens
        self.messages = []
        self.current_tokens = 0
    
    def add_message(self, message):
        message_tokens = self.count_tokens(message)
        self.messages.append(message)
        self.current_tokens += message_tokens
        
        # Remove oldest messages if over limit
        while self.current_tokens > self.max_tokens and self.messages:
            removed = self.messages.pop(0)
            self.current_tokens -= self.count_tokens(removed)
    
    def get_context(self):
        return self.messages
```

#### Sliding Window with Overlap
```python
class SlidingWindowMemory:
    def __init__(self, max_tokens=4000, overlap_ratio=0.2):
        self.max_tokens = max_tokens
        self.overlap_tokens = int(max_tokens * overlap_ratio)
        self.messages = []
    
    def add_message(self, message):
        self.messages.append(message)
        total_tokens = sum(self.count_tokens(msg) for msg in self.messages)
        
        if total_tokens > self.max_tokens:
            # Keep overlap from recent messages
            self._maintain_overlap()
    
    def _maintain_overlap(self):
        # Calculate which messages to keep for overlap
        overlap_messages = []
        overlap_tokens = 0
        
        for message in reversed(self.messages):
            msg_tokens = self.count_tokens(message)
            if overlap_tokens + msg_tokens <= self.overlap_tokens:
                overlap_messages.insert(0, message)
                overlap_tokens += msg_tokens
            else:
                break
        
        self.messages = overlap_messages
```

### 2. Intelligent Prioritization

#### Importance-Based Retention
```python
class ImportanceBasedMemory:
    def __init__(self, max_tokens=4000):
        self.max_tokens = max_tokens
        self.messages = []
    
    def add_message(self, message):
        # Calculate importance score
        importance = self.calculate_importance(message)
        message['importance'] = importance
        
        self.messages.append(message)
        self._optimize_context()
    
    def calculate_importance(self, message):
        score = 0.0
        
        # Recency bias (recent messages more important)
        score += 0.3
        
        # Content-based importance
        if any(keyword in message['content'].lower() 
               for keyword in ['error', 'problem', 'help', 'question']):
            score += 0.4
        
        # User interaction importance
        if message['role'] == 'user':
            score += 0.2
        
        # Length penalty (very short messages less important)
        if len(message['content']) < 20:
            score -= 0.1
        
        return max(0.0, min(1.0, score))
    
    def _optimize_context(self):
        total_tokens = sum(self.count_tokens(msg) for msg in self.messages)
        
        if total_tokens > self.max_tokens:
            # Sort by importance (keep most important)
            self.messages.sort(key=lambda x: x['importance'], reverse=True)
            
            # Keep messages until token limit
            kept_messages = []
            current_tokens = 0
            
            for message in self.messages:
                msg_tokens = self.count_tokens(message)
                if current_tokens + msg_tokens <= self.max_tokens:
                    kept_messages.append(message)
                    current_tokens += msg_tokens
            
            # Restore chronological order
            self.messages = sorted(kept_messages, key=lambda x: x['timestamp'])
```

### 3. Hierarchical Summarization

#### Multi-Level Compression
```python
class HierarchicalWorkingMemory:
    def __init__(self, max_tokens=4000, summary_model=None):
        self.max_tokens = max_tokens
        self.summary_model = summary_model
        self.recent_messages = []  # Full detail
        self.medium_summary = ""   # Compressed medium-term
        self.long_summary = ""     # Highly compressed long-term
    
    def add_message(self, message):
        self.recent_messages.append(message)
        self._manage_hierarchy()
    
    def _manage_hierarchy(self):
        total_tokens = self._calculate_total_tokens()
        
        if total_tokens > self.max_tokens:
            # Compress oldest recent messages into medium summary
            messages_to_compress = self.recent_messages[:5]
            self.recent_messages = self.recent_messages[5:]
            
            new_summary = self.summary_model.summarize(
                messages_to_compress + [self.medium_summary]
            )
            
            # If medium summary gets too long, compress into long summary
            if len(new_summary) > 500:  # tokens
                self.long_summary = self.summary_model.summarize([
                    self.long_summary,
                    new_summary
                ], max_length=200)
                self.medium_summary = ""
            else:
                self.medium_summary = new_summary
    
    def get_context(self):
        context_parts = []
        
        if self.long_summary:
            context_parts.append(f"Previous context: {self.long_summary}")
        
        if self.medium_summary:
            context_parts.append(f"Recent summary: {self.medium_summary}")
        
        # Add recent messages
        context_parts.extend([msg['content'] for msg in self.recent_messages])
        
        return "\n".join(context_parts)
```

## Advanced Memory Strategies

### 1. Semantic Clustering

#### Topic-Based Retention
```python
from sklearn.cluster import KMeans
from sentence_transformers import SentenceTransformer

class SemanticWorkingMemory:
    def __init__(self, max_tokens=4000, max_clusters=5):
        self.max_tokens = max_tokens
        self.max_clusters = max_clusters
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        self.messages = []
    
    def add_message(self, message):
        # Generate embedding for message
        embedding = self.embedder.encode(message['content'])
        message['embedding'] = embedding
        
        self.messages.append(message)
        self._optimize_with_clustering()
    
    def _optimize_with_clustering(self):
        if len(self.messages) <= self.max_clusters:
            return
        
        total_tokens = sum(self.count_tokens(msg) for msg in self.messages)
        
        if total_tokens > self.max_tokens:
            # Cluster messages by semantic similarity
            embeddings = [msg['embedding'] for msg in self.messages[:-5]]  # Keep recent 5
            recent_messages = self.messages[-5:]
            
            if len(embeddings) > self.max_clusters:
                kmeans = KMeans(n_clusters=self.max_clusters)
                clusters = kmeans.fit_predict(embeddings)
                
                # Select representative message from each cluster
                representative_messages = []
                for i in range(self.max_clusters):
                    cluster_messages = [msg for j, msg in enumerate(self.messages[:-5]) 
                                      if clusters[j] == i]
                    if cluster_messages:
                        # Select most recent or most important message from cluster
                        representative = max(cluster_messages, 
                                           key=lambda x: x.get('importance', 0))
                        representative_messages.append(representative)
                
                # Combine representatives with recent messages
                self.messages = representative_messages + recent_messages
```

### 2. Zep Integration for Working Memory

#### Zep-Powered Context Management
```python
from zep_python import ZepClient

class ZepWorkingMemory:
    def __init__(self, session_id, api_key, max_tokens=4000):
        self.client = ZepClient(api_key=api_key)
        self.session_id = session_id
        self.max_tokens = max_tokens
    
    def add_message(self, message):
        """Add message to Zep and get optimized context"""
        # Store in Zep
        self.client.add_memory(
            session_id=self.session_id,
            memory_messages=[message],
            metadata={"importance": self.calculate_importance(message)}
        )
        
        return self.get_optimized_context()
    
    def get_optimized_context(self):
        """Get context optimized for current token limit"""
        # Get Zep's automatic summary
        summary = self.client.get_session_summary(self.session_id)
        
        # Get recent messages that fit in remaining tokens
        summary_tokens = self.count_tokens(summary.content if summary else "")
        remaining_tokens = self.max_tokens - summary_tokens - 500  # Buffer
        
        recent_messages = self.client.get_memory(
            session_id=self.session_id,
            limit=20,  # Get more than we need
            order_by="created_at desc"
        )
        
        # Select messages that fit in token budget
        selected_messages = []
        current_tokens = 0
        
        for message in recent_messages:
            msg_tokens = self.count_tokens(message.content)
            if current_tokens + msg_tokens <= remaining_tokens:
                selected_messages.append(message)
                current_tokens += msg_tokens
            else:
                break
        
        # Combine summary with recent messages
        context_parts = []
        if summary and summary.content:
            context_parts.append(f"Summary: {summary.content}")
        
        context_parts.extend([msg.content for msg in reversed(selected_messages)])
        
        return "\n".join(context_parts)
```

### 3. Multi-Turn Conversation Management

#### Thread-Aware Memory
```python
class ThreadAwareWorkingMemory:
    def __init__(self, max_tokens=4000):
        self.max_tokens = max_tokens
        self.conversation_threads = {}  # thread_id -> messages
        self.active_thread = None
    
    def switch_thread(self, thread_id):
        """Switch context to different conversation thread"""
        self.active_thread = thread_id
        if thread_id not in self.conversation_threads:
            self.conversation_threads[thread_id] = []
    
    def add_message(self, message, thread_id=None):
        if thread_id:
            self.switch_thread(thread_id)
        
        if self.active_thread:
            self.conversation_threads[self.active_thread].append(message)
            self._optimize_thread(self.active_thread)
    
    def get_context(self, thread_id=None):
        if thread_id:
            target_thread = thread_id
        else:
            target_thread = self.active_thread
        
        if target_thread in self.conversation_threads:
            return self.conversation_threads[target_thread]
        return []
    
    def _optimize_thread(self, thread_id):
        messages = self.conversation_threads[thread_id]
        total_tokens = sum(self.count_tokens(msg) for msg in messages)
        
        if total_tokens > self.max_tokens:
            # Apply optimization strategy (e.g., summarization)
            self.conversation_threads[thread_id] = self._apply_compression(messages)
```

## Performance Optimization

### 1. Token Counting Optimization

#### Efficient Token Estimation
```python
import tiktoken

class TokenCounter:
    def __init__(self, model_name="gpt-3.5-turbo"):
        self.encoder = tiktoken.encoding_for_model(model_name)
        self._cache = {}
    
    def count_tokens(self, text):
        """Count tokens with caching for efficiency"""
        text_hash = hash(text)
        
        if text_hash not in self._cache:
            self._cache[text_hash] = len(self.encoder.encode(text))
        
        return self._cache[text_hash]
    
    def estimate_tokens(self, text):
        """Fast estimation for very long texts"""
        # Rough estimation: 1 token ≈ 4 characters for English
        return len(text) // 4
    
    def clear_cache(self):
        """Clear cache to prevent memory bloat"""
        self._cache.clear()
```

### 2. Asynchronous Processing

#### Background Optimization
```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

class AsyncWorkingMemory:
    def __init__(self, max_tokens=4000):
        self.max_tokens = max_tokens
        self.messages = []
        self.executor = ThreadPoolExecutor(max_workers=2)
        self._optimization_lock = asyncio.Lock()
    
    async def add_message(self, message):
        """Add message and trigger async optimization"""
        self.messages.append(message)
        
        # Trigger optimization in background if needed
        total_tokens = sum(self.count_tokens(msg) for msg in self.messages)
        if total_tokens > self.max_tokens * 1.2:  # 20% buffer before optimization
            asyncio.create_task(self._optimize_async())
    
    async def _optimize_async(self):
        """Optimize memory in background"""
        async with self._optimization_lock:
            if self._needs_optimization():
                # Run CPU-intensive optimization in thread pool
                optimized_messages = await asyncio.get_event_loop().run_in_executor(
                    self.executor,
                    self._perform_optimization,
                    self.messages.copy()
                )
                
                self.messages = optimized_messages
    
    def _perform_optimization(self, messages):
        """CPU-intensive optimization logic"""
        # Implement summarization, clustering, etc.
        return self._apply_summarization(messages)
```

## Integration Patterns

### 1. LangChain Integration

#### Custom Memory Class
```python
from langchain.memory.chat_memory import BaseChatMemory
from langchain.schema import BaseMessage

class OptimizedChatMemory(BaseChatMemory):
    def __init__(self, max_tokens=4000, optimization_strategy="importance"):
        super().__init__()
        self.max_tokens = max_tokens
        self.optimization_strategy = optimization_strategy
        self.working_memory = self._create_memory_handler()
    
    def _create_memory_handler(self):
        if self.optimization_strategy == "importance":
            return ImportanceBasedMemory(self.max_tokens)
        elif self.optimization_strategy == "semantic":
            return SemanticWorkingMemory(self.max_tokens)
        else:
            return FIFOWorkingMemory(self.max_tokens)
    
    def save_context(self, inputs, outputs):
        """Save conversation turn to working memory"""
        # Convert to internal message format
        for role, content in inputs.items():
            message = {
                'role': 'user',
                'content': content,
                'timestamp': datetime.now()
            }
            self.working_memory.add_message(message)
        
        for role, content in outputs.items():
            message = {
                'role': 'assistant',
                'content': content,
                'timestamp': datetime.now()
            }
            self.working_memory.add_message(message)
    
    def load_memory_variables(self, inputs):
        """Load optimized context for next turn"""
        context = self.working_memory.get_context()
        return {self.memory_key: self._format_messages(context)}
```

### 2. Framework-Agnostic Integration

#### Generic Memory Interface
```python
class WorkingMemoryInterface:
    def __init__(self, config):
        self.config = config
        self.memory_handler = self._initialize_handler()
    
    def _initialize_handler(self):
        provider = self.config.get('provider', 'local')
        
        if provider == 'zep':
            return ZepWorkingMemory(
                session_id=self.config['session_id'],
                api_key=self.config['api_key'],
                max_tokens=self.config['max_tokens']
            )
        elif provider == 'semantic':
            return SemanticWorkingMemory(
                max_tokens=self.config['max_tokens']
            )
        else:
            return ImportanceBasedMemory(
                max_tokens=self.config['max_tokens']
            )
    
    def process_turn(self, user_input, system_response):
        """Process a complete conversation turn"""
        # Add user message
        user_message = {
            'role': 'user',
            'content': user_input,
            'timestamp': datetime.now()
        }
        self.memory_handler.add_message(user_message)
        
        # Add system response
        system_message = {
            'role': 'assistant',
            'content': system_response,
            'timestamp': datetime.now()
        }
        self.memory_handler.add_message(system_message)
        
        # Return optimized context for next turn
        return self.memory_handler.get_context()
```

## Monitoring and Metrics

### 1. Performance Metrics

#### Real-Time Monitoring
```python
import time
import psutil
from collections import defaultdict

class WorkingMemoryMonitor:
    def __init__(self):
        self.metrics = defaultdict(list)
        self.start_time = time.time()
    
    def record_operation(self, operation, duration, memory_size, token_count):
        """Record operation metrics"""
        timestamp = time.time() - self.start_time
        
        self.metrics['operations'].append({
            'timestamp': timestamp,
            'operation': operation,
            'duration': duration,
            'memory_size': memory_size,
            'token_count': token_count,
            'cpu_percent': psutil.cpu_percent(),
            'memory_percent': psutil.virtual_memory().percent
        })
    
    def get_performance_summary(self):
        """Get performance summary"""
        if not self.metrics['operations']:
            return {}
        
        operations = self.metrics['operations']
        durations = [op['duration'] for op in operations]
        token_counts = [op['token_count'] for op in operations]
        
        return {
            'total_operations': len(operations),
            'avg_duration': sum(durations) / len(durations),
            'max_duration': max(durations),
            'avg_tokens': sum(token_counts) / len(token_counts),
            'max_tokens': max(token_counts),
            'avg_cpu': sum(op['cpu_percent'] for op in operations) / len(operations),
            'avg_memory': sum(op['memory_percent'] for op in operations) / len(operations)
        }
```

### 2. Quality Metrics

#### Context Coherence Tracking
```python
class ContextQualityMonitor:
    def __init__(self, embedder):
        self.embedder = embedder
        self.coherence_scores = []
    
    def measure_coherence(self, context_messages):
        """Measure semantic coherence of context"""
        if len(context_messages) < 2:
            return 1.0
        
        embeddings = [
            self.embedder.encode(msg['content']) 
            for msg in context_messages
        ]
        
        # Calculate average pairwise similarity
        total_similarity = 0
        pair_count = 0
        
        for i in range(len(embeddings)):
            for j in range(i + 1, len(embeddings)):
                similarity = cosine_similarity(
                    embeddings[i].reshape(1, -1),
                    embeddings[j].reshape(1, -1)
                )[0][0]
                total_similarity += similarity
                pair_count += 1
        
        coherence = total_similarity / pair_count if pair_count > 0 else 1.0
        self.coherence_scores.append(coherence)
        
        return coherence
    
    def get_coherence_trend(self):
        """Get coherence trend over time"""
        if len(self.coherence_scores) < 10:
            return "insufficient_data"
        
        recent_avg = sum(self.coherence_scores[-10:]) / 10
        historical_avg = sum(self.coherence_scores[:-10]) / (len(self.coherence_scores) - 10)
        
        if recent_avg > historical_avg * 1.05:
            return "improving"
        elif recent_avg < historical_avg * 0.95:
            return "declining"
        else:
            return "stable"
```

## Troubleshooting Guide

### Common Issues

#### 1. Token Limit Exceeded
**Symptoms**: Frequent context truncation, important information lost
**Solutions**:
- Implement more aggressive summarization
- Increase importance scoring sensitivity
- Use hierarchical compression
- Consider larger context models

#### 2. Poor Context Quality
**Symptoms**: Responses seem unaware of recent context
**Solutions**:
- Adjust importance scoring algorithm
- Implement semantic clustering
- Reduce summarization aggressiveness
- Add conversation turn markers

#### 3. High Latency
**Symptoms**: Slow response times during memory operations
**Solutions**:
- Implement asynchronous optimization
- Add token counting cache
- Optimize summarization model
- Use background processing

#### 4. Memory Fragmentation
**Symptoms**: Disjointed context, missing conversation flow
**Solutions**:
- Maintain conversation turn integrity
- Implement turn-aware summarization
- Add conversation thread tracking
- Preserve user-assistant pairs

### Performance Tuning Checklist
- [ ] Token counting optimized with caching
- [ ] Appropriate context window size for use case
- [ ] Summarization model properly configured
- [ ] Importance scoring tuned for domain
- [ ] Async processing implemented for large contexts
- [ ] Memory usage monitored and bounded
- [ ] Quality metrics tracked and reviewed

## Cost Optimization

### Token Efficiency Strategies
- Implement aggressive summarization for non-critical content
- Use importance scoring to prioritize valuable information
- Cache token counts to avoid repeated calculations
- Monitor token usage patterns and optimize accordingly

### Processing Efficiency
- Use async processing for non-blocking optimization
- Implement caching for expensive operations
- Batch process multiple messages when possible
- Use efficient data structures for message storage

---

*Last Updated: [Current Date]*
*Next Review: [Monthly Review Date]*
*Owner: AI Memory Team* 