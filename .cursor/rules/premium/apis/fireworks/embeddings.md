# Fireworks AI - Embeddings SOP

## Overview
**Version:** 2.0  
**Last Updated:** May 2025  
**Service Category:** Vector Embeddings & Semantic Search  
**Purpose:** Comprehensive implementation guide for Fireworks AI's embedding models for text vectorization, semantic search, RAG systems, and vector database integration.

---

## 🎯 SUPPORTED EMBEDDING MODELS

### 📊 **Text Embedding Models**
#### Nomic Embed Text v1.5
- **Model ID:** `nomic-ai/nomic-embed-text-v1.5`
- **Pricing:** $0.008 per 1M tokens
- **Dimensions:** 768
- **Max Tokens:** 8192
- **Features:** Optimized for retrieval, clustering, classification
- **Languages:** English-focused with multilingual capabilities

#### BGE Large EN v1.5
- **Model ID:** `BAAI/bge-large-en-v1.5`
- **Pricing:** $0.008 per 1M tokens
- **Dimensions:** 1024
- **Max Tokens:** 512
- **Features:** High-quality English embeddings, semantic similarity
- **Strengths:** Academic papers, technical documents

#### E5 Large v2
- **Model ID:** `intfloat/e5-large-v2`
- **Pricing:** $0.008 per 1M tokens
- **Dimensions:** 1024
- **Max Tokens:** 512
- **Features:** Multilingual support, instruction-following
- **Use Cases:** Cross-lingual search, document retrieval

### 🌐 **Multilingual Models**
#### Multilingual E5 Large
- **Model ID:** `intfloat/multilingual-e5-large`
- **Dimensions:** 1024
- **Languages:** 100+ languages
- **Features:** Cross-lingual semantic search
- **Use Cases:** Global applications, multilingual content

---

## 🔧 IMPLEMENTATION PATTERNS

### Basic Text Embeddings
```python
import requests
import numpy as np
from typing import List, Dict, Union

class FireworksEmbeddings:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = 'https://api.fireworks.ai/inference/v1'
        self.default_model = 'nomic-ai/nomic-embed-text-v1.5'
    
    def create_embeddings(self, texts: Union[str, List[str]], 
                         model: str = None) -> Dict:
        """
        Create embeddings for text(s)
        """
        if isinstance(texts, str):
            texts = [texts]
        
        model = model or self.default_model
        
        payload = {
            'model': model,
            'input': texts
        }
        
        response = requests.post(
            f'{self.base_url}/embeddings',
            headers={
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            },
            json=payload
        )
        
        response.raise_for_status()
        return response.json()
    
    def get_embeddings_array(self, texts: Union[str, List[str]], 
                           model: str = None) -> np.ndarray:
        """
        Get embeddings as numpy array
        """
        result = self.create_embeddings(texts, model)
        embeddings = [item['embedding'] for item in result['data']]
        return np.array(embeddings)
    
    def cosine_similarity(self, embedding1: np.ndarray, 
                         embedding2: np.ndarray) -> float:
        """
        Calculate cosine similarity between two embeddings
        """
        dot_product = np.dot(embedding1, embedding2)
        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)
        return dot_product / (norm1 * norm2)
    
    def find_most_similar(self, query_text: str, candidate_texts: List[str],
                         model: str = None, top_k: int = 5) -> List[Dict]:
        """
        Find most similar texts to query
        """
        # Get all embeddings
        all_texts = [query_text] + candidate_texts
        embeddings = self.get_embeddings_array(all_texts, model)
        
        query_embedding = embeddings[0]
        candidate_embeddings = embeddings[1:]
        
        # Calculate similarities
        similarities = []
        for i, candidate_embedding in enumerate(candidate_embeddings):
            similarity = self.cosine_similarity(query_embedding, candidate_embedding)
            similarities.append({
                'text': candidate_texts[i],
                'similarity': similarity,
                'index': i
            })
        
        # Sort by similarity
        similarities.sort(key=lambda x: x['similarity'], reverse=True)
        return similarities[:top_k]

# Usage example
embedder = FireworksEmbeddings('your_api_key_here')

# Basic embedding creation
texts = [
    "The quick brown fox jumps over the lazy dog",
    "Machine learning is a subset of artificial intelligence",
    "Python is a popular programming language"
]

embeddings_result = embedder.create_embeddings(texts)
print(f"Created {len(embeddings_result['data'])} embeddings")

# Similarity search
query = "What is AI?"
candidates = [
    "Artificial intelligence is the simulation of human intelligence",
    "Dogs are loyal pets",
    "Machine learning algorithms learn from data",
    "The weather is nice today",
    "Neural networks are inspired by the human brain"
]

similar_texts = embedder.find_most_similar(query, candidates, top_k=3)
for result in similar_texts:
    print(f"Similarity: {result['similarity']:.3f} - {result['text']}")
```

### Vector Database Integration
```python
import chromadb
from chromadb.config import Settings
import uuid

class VectorDatabase:
    def __init__(self, embedder: FireworksEmbeddings, db_path: str = "./vector_db"):
        self.embedder = embedder
        self.client = chromadb.PersistentClient(path=db_path)
        self.collections = {}
    
    def create_collection(self, collection_name: str, metadata: Dict = None):
        """
        Create a new vector collection
        """
        collection = self.client.create_collection(
            name=collection_name,
            metadata=metadata or {}
        )
        self.collections[collection_name] = collection
        return collection
    
    def get_collection(self, collection_name: str):
        """
        Get existing collection
        """
        if collection_name not in self.collections:
            self.collections[collection_name] = self.client.get_collection(collection_name)
        return self.collections[collection_name]
    
    def add_documents(self, collection_name: str, documents: List[str],
                     metadatas: List[Dict] = None, ids: List[str] = None):
        """
        Add documents to collection with automatic embedding
        """
        collection = self.get_collection(collection_name)
        
        # Generate IDs if not provided
        if ids is None:
            ids = [str(uuid.uuid4()) for _ in documents]
        
        # Create embeddings
        embeddings = self.embedder.get_embeddings_array(documents)
        
        # Add to collection
        collection.add(
            embeddings=embeddings.tolist(),
            documents=documents,
            metadatas=metadatas or [{}] * len(documents),
            ids=ids
        )
        
        return ids
    
    def search(self, collection_name: str, query: str, 
              n_results: int = 10, where: Dict = None) -> Dict:
        """
        Semantic search in collection
        """
        collection = self.get_collection(collection_name)
        
        # Get query embedding
        query_embedding = self.embedder.get_embeddings_array([query])[0]
        
        # Search
        results = collection.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=n_results,
            where=where
        )
        
        return results
    
    def update_document(self, collection_name: str, doc_id: str, 
                       new_document: str, new_metadata: Dict = None):
        """
        Update existing document
        """
        collection = self.get_collection(collection_name)
        
        # Create new embedding
        new_embedding = self.embedder.get_embeddings_array([new_document])[0]
        
        # Update
        collection.update(
            ids=[doc_id],
            embeddings=[new_embedding.tolist()],
            documents=[new_document],
            metadatas=[new_metadata] if new_metadata else None
        )
    
    def delete_documents(self, collection_name: str, ids: List[str]):
        """
        Delete documents from collection
        """
        collection = self.get_collection(collection_name)
        collection.delete(ids=ids)

# Usage example
embedder = FireworksEmbeddings('your_api_key_here')
vector_db = VectorDatabase(embedder)

# Create collection
collection = vector_db.create_collection(
    "knowledge_base",
    metadata={"description": "Company knowledge base"}
)

# Add documents
documents = [
    "Our company was founded in 2020 and specializes in AI solutions",
    "We offer machine learning consulting services to enterprise clients",
    "Our team consists of 50 data scientists and engineers",
    "We have offices in San Francisco, New York, and London",
    "Our main products include NLP APIs and computer vision tools"
]

metadatas = [
    {"category": "company_info", "date": "2024-01-01"},
    {"category": "services", "date": "2024-01-02"},
    {"category": "team", "date": "2024-01-03"},
    {"category": "locations", "date": "2024-01-04"},
    {"category": "products", "date": "2024-01-05"}
]

doc_ids = vector_db.add_documents("knowledge_base", documents, metadatas)
print(f"Added {len(doc_ids)} documents to knowledge base")

# Search
search_results = vector_db.search(
    "knowledge_base", 
    "What services does the company provide?",
    n_results=3
)

print("Search Results:")
for i, doc in enumerate(search_results['documents'][0]):
    distance = search_results['distances'][0][i]
    metadata = search_results['metadatas'][0][i]
    print(f"Distance: {distance:.3f} | Category: {metadata['category']}")
    print(f"Document: {doc}\n")
```

### RAG (Retrieval-Augmented Generation) System
```python
class RAGSystem:
    def __init__(self, embedder: FireworksEmbeddings, vector_db: VectorDatabase,
                 llm_api_key: str):
        self.embedder = embedder
        self.vector_db = vector_db
        self.llm_api_key = llm_api_key
        self.llm_base_url = 'https://api.fireworks.ai/inference/v1'
    
    def create_knowledge_base(self, collection_name: str, documents: List[Dict]):
        """
        Create knowledge base from documents
        """
        # Create collection
        self.vector_db.create_collection(collection_name)
        
        # Prepare documents
        texts = []
        metadatas = []
        
        for doc in documents:
            # Chunk large documents
            chunks = self.chunk_document(doc['content'], max_chunk_size=1000)
            
            for i, chunk in enumerate(chunks):
                texts.append(chunk)
                metadatas.append({
                    **doc.get('metadata', {}),
                    'chunk_index': i,
                    'total_chunks': len(chunks),
                    'source': doc.get('source', 'unknown')
                })
        
        # Add to vector database
        doc_ids = self.vector_db.add_documents(collection_name, texts, metadatas)
        return doc_ids
    
    def chunk_document(self, text: str, max_chunk_size: int = 1000, 
                      overlap: int = 100) -> List[str]:
        """
        Split document into overlapping chunks
        """
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + max_chunk_size
            
            # Try to break at sentence boundary
            if end < len(text):
                sentence_end = text.rfind('.', start, end)
                if sentence_end > start:
                    end = sentence_end + 1
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            start = max(start + max_chunk_size - overlap, end)
        
        return chunks
    
    def retrieve_context(self, collection_name: str, query: str, 
                        top_k: int = 5) -> List[Dict]:
        """
        Retrieve relevant context for query
        """
        search_results = self.vector_db.search(
            collection_name, query, n_results=top_k
        )
        
        context_items = []
        for i in range(len(search_results['documents'][0])):
            context_items.append({
                'content': search_results['documents'][0][i],
                'metadata': search_results['metadatas'][0][i],
                'relevance_score': 1 - search_results['distances'][0][i]  # Convert distance to similarity
            })
        
        return context_items
    
    def generate_answer(self, query: str, context_items: List[Dict],
                       model: str = 'accounts/fireworks/models/llama-v3p1-8b-instruct') -> Dict:
        """
        Generate answer using retrieved context
        """
        # Build context string
        context_text = "\n\n".join([
            f"Source: {item['metadata'].get('source', 'Unknown')}\n{item['content']}"
            for item in context_items
        ])
        
        # Create prompt
        prompt = f"""Based on the following context information, answer the user's question. If the answer is not found in the context, say so clearly.

Context:
{context_text}

Question: {query}

Answer:"""

        # Call LLM
        response = requests.post(
            f'{self.llm_base_url}/chat/completions',
            headers={
                'Authorization': f'Bearer {self.llm_api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': model,
                'messages': [
                    {'role': 'user', 'content': prompt}
                ],
                'max_tokens': 500,
                'temperature': 0.1
            }
        )
        
        response.raise_for_status()
        llm_result = response.json()
        
        return {
            'answer': llm_result['choices'][0]['message']['content'],
            'context_used': context_items,
            'model': model
        }
    
    def ask(self, collection_name: str, question: str, top_k: int = 5) -> Dict:
        """
        End-to-end RAG query
        """
        # Retrieve relevant context
        context_items = self.retrieve_context(collection_name, question, top_k)
        
        # Generate answer
        result = self.generate_answer(question, context_items)
        
        return {
            'question': question,
            'answer': result['answer'],
            'sources': [item['metadata'] for item in context_items],
            'relevance_scores': [item['relevance_score'] for item in context_items]
        }

# Usage example
embedder = FireworksEmbeddings('your_api_key_here')
vector_db = VectorDatabase(embedder)
rag = RAGSystem(embedder, vector_db, 'your_api_key_here')

# Create knowledge base
documents = [
    {
        'content': """Fireworks AI is a generative AI platform that provides fast inference for open-source models. 
        The company was founded by former Google DeepMind researchers and offers services including text generation, 
        image generation, and fine-tuning capabilities. Fireworks specializes in optimizing model performance 
        while reducing costs for enterprise applications.""",
        'metadata': {'source': 'company_overview.txt', 'date': '2024-01-01'},
        'source': 'Company Documentation'
    },
    {
        'content': """Fireworks AI supports various language models including Llama 3.1, DeepSeek, Qwen3, and Mistral. 
        The platform offers both serverless and dedicated deployment options. Pricing varies by model size and 
        usage patterns, with competitive rates for high-volume customers.""",
        'metadata': {'source': 'technical_specs.txt', 'date': '2024-01-02'},
        'source': 'Technical Documentation'
    }
]

# Create knowledge base
rag.create_knowledge_base('fireworks_kb', documents)

# Ask questions
question = "What models does Fireworks AI support?"
result = rag.ask('fireworks_kb', question)

print(f"Question: {result['question']}")
print(f"Answer: {result['answer']}")
print(f"Sources: {result['sources']}")
```

---

## 🚀 PRODUCTION DEPLOYMENT

### Scalable Embedding Service
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import asyncio
import aiohttp
import uvicorn

app = FastAPI(title="Fireworks Embeddings Service")

class EmbeddingRequest(BaseModel):
    texts: List[str]
    model: Optional[str] = 'nomic-ai/nomic-embed-text-v1.5'

class SimilarityRequest(BaseModel):
    query: str
    candidates: List[str]
    model: Optional[str] = 'nomic-ai/nomic-embed-text-v1.5'
    top_k: Optional[int] = 5

class EmbeddingService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = 'https://api.fireworks.ai/inference/v1'
    
    async def create_embeddings_async(self, texts: List[str], model: str):
        """Async embedding creation"""
        async with aiohttp.ClientSession() as session:
            payload = {
                'model': model,
                'input': texts
            }
            
            async with session.post(
                f'{self.base_url}/embeddings',
                headers={
                    'Authorization': f'Bearer {self.api_key}',
                    'Content-Type': 'application/json'
                },
                json=payload
            ) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    raise HTTPException(status_code=response.status, 
                                      detail="Embedding creation failed")

# Global service instance
embedding_service = EmbeddingService(os.getenv('FIREWORKS_API_KEY'))

@app.post("/embeddings")
async def create_embeddings(request: EmbeddingRequest):
    """Create embeddings for texts"""
    try:
        result = await embedding_service.create_embeddings_async(
            request.texts, request.model
        )
        return {
            "embeddings": [item['embedding'] for item in result['data']],
            "model": request.model,
            "usage": result.get('usage', {})
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/similarity")
async def find_similar(request: SimilarityRequest):
    """Find most similar texts to query"""
    try:
        # Get embeddings for all texts
        all_texts = [request.query] + request.candidates
        result = await embedding_service.create_embeddings_async(
            all_texts, request.model
        )
        
        embeddings = [item['embedding'] for item in result['data']]
        query_embedding = np.array(embeddings[0])
        candidate_embeddings = np.array(embeddings[1:])
        
        # Calculate similarities
        similarities = []
        for i, candidate_embedding in enumerate(candidate_embeddings):
            similarity = np.dot(query_embedding, candidate_embedding) / (
                np.linalg.norm(query_embedding) * np.linalg.norm(candidate_embedding)
            )
            similarities.append({
                'text': request.candidates[i],
                'similarity': float(similarity),
                'index': i
            })
        
        # Sort and return top_k
        similarities.sort(key=lambda x: x['similarity'], reverse=True)
        return {
            "query": request.query,
            "results": similarities[:request.top_k],
            "model": request.model
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "fireworks-embeddings"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## 📊 PERFORMANCE OPTIMIZATION

### Batch Processing & Caching
```python
import redis
import json
import hashlib
from typing import List, Optional

class EmbeddingCache:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_client = redis.from_url(redis_url)
        self.cache_ttl = 86400  # 24 hours
    
    def get_cache_key(self, text: str, model: str) -> str:
        """Generate cache key for text and model"""
        content = f"{text}:{model}"
        return f"embedding:{hashlib.md5(content.encode()).hexdigest()}"
    
    def get_cached_embedding(self, text: str, model: str) -> Optional[List[float]]:
        """Get cached embedding if available"""
        key = self.get_cache_key(text, model)
        cached = self.redis_client.get(key)
        if cached:
            return json.loads(cached)
        return None
    
    def cache_embedding(self, text: str, model: str, embedding: List[float]):
        """Cache embedding with TTL"""
        key = self.get_cache_key(text, model)
        self.redis_client.setex(
            key, 
            self.cache_ttl, 
            json.dumps(embedding)
        )

class OptimizedEmbedder:
    def __init__(self, api_key: str, use_cache: bool = True):
        self.embedder = FireworksEmbeddings(api_key)
        self.cache = EmbeddingCache() if use_cache else None
        self.batch_size = 100  # Process in batches
    
    def get_embeddings_with_cache(self, texts: List[str], 
                                 model: str = None) -> List[List[float]]:
        """Get embeddings with caching support"""
        model = model or self.embedder.default_model
        
        # Check cache for existing embeddings
        cached_embeddings = {}
        uncached_texts = []
        
        if self.cache:
            for i, text in enumerate(texts):
                cached = self.cache.get_cached_embedding(text, model)
                if cached:
                    cached_embeddings[i] = cached
                else:
                    uncached_texts.append((i, text))
        else:
            uncached_texts = list(enumerate(texts))
        
        # Process uncached texts in batches
        new_embeddings = {}
        if uncached_texts:
            for batch_start in range(0, len(uncached_texts), self.batch_size):
                batch_end = min(batch_start + self.batch_size, len(uncached_texts))
                batch_items = uncached_texts[batch_start:batch_end]
                batch_texts = [item[1] for item in batch_items]
                
                # Get embeddings for batch
                batch_embeddings = self.embedder.get_embeddings_array(batch_texts, model)
                
                # Store results and cache
                for j, (original_index, text) in enumerate(batch_items):
                    embedding = batch_embeddings[j].tolist()
                    new_embeddings[original_index] = embedding
                    
                    if self.cache:
                        self.cache.cache_embedding(text, model, embedding)
        
        # Combine cached and new embeddings
        result = []
        for i in range(len(texts)):
            if i in cached_embeddings:
                result.append(cached_embeddings[i])
            else:
                result.append(new_embeddings[i])
        
        return result
    
    def batch_similarity_search(self, queries: List[str], 
                               candidate_texts: List[str],
                               model: str = None, top_k: int = 5) -> List[List[Dict]]:
        """Batch similarity search"""
        model = model or self.embedder.default_model
        
        # Get embeddings for all texts
        all_texts = queries + candidate_texts
        all_embeddings = self.get_embeddings_with_cache(all_texts, model)
        
        query_embeddings = np.array(all_embeddings[:len(queries)])
        candidate_embeddings = np.array(all_embeddings[len(queries):])
        
        # Calculate similarities for all queries
        results = []
        for i, query_embedding in enumerate(query_embeddings):
            similarities = []
            
            for j, candidate_embedding in enumerate(candidate_embeddings):
                similarity = np.dot(query_embedding, candidate_embedding) / (
                    np.linalg.norm(query_embedding) * np.linalg.norm(candidate_embedding)
                )
                similarities.append({
                    'text': candidate_texts[j],
                    'similarity': float(similarity),
                    'index': j
                })
            
            # Sort and get top_k
            similarities.sort(key=lambda x: x['similarity'], reverse=True)
            results.append(similarities[:top_k])
        
        return results

# Usage example
optimized_embedder = OptimizedEmbedder('your_api_key_here', use_cache=True)

# Batch processing
queries = [
    "What is machine learning?",
    "How does AI work?",
    "Explain neural networks"
]

candidates = [
    "Machine learning is a subset of artificial intelligence",
    "Artificial intelligence simulates human intelligence",
    "Neural networks are computing systems inspired by biology",
    "Dogs are loyal pets",
    "The weather is nice today"
]

# Batch similarity search
batch_results = optimized_embedder.batch_similarity_search(
    queries, candidates, top_k=2
)

for i, query in enumerate(queries):
    print(f"Query: {query}")
    for result in batch_results[i]:
        print(f"  Similarity: {result['similarity']:.3f} - {result['text']}")
    print()
```

---

## 🔄 INTEGRATION EXAMPLES

### Pinecone Integration
```python
import pinecone

def setup_pinecone_integration(api_key: str, environment: str):
    """Setup Pinecone vector database integration"""
    
    # Initialize Pinecone
    pinecone.init(api_key=api_key, environment=environment)
    
    # Create index if it doesn't exist
    index_name = "fireworks-embeddings"
    if index_name not in pinecone.list_indexes():
        pinecone.create_index(
            name=index_name,
            dimension=768,  # Nomic embed dimension
            metric="cosine"
        )
    
    return pinecone.Index(index_name)

# Usage with Fireworks embeddings
embedder = FireworksEmbeddings('your_fireworks_api_key')
pinecone_index = setup_pinecone_integration('your_pinecone_api_key', 'us-west1-gcp')

# Add documents to Pinecone with Fireworks embeddings
documents = ["Document 1 content", "Document 2 content"]
embeddings = embedder.get_embeddings_array(documents)

# Upsert to Pinecone
vectors = [
    (f"doc_{i}", embedding.tolist(), {"text": doc})
    for i, (embedding, doc) in enumerate(zip(embeddings, documents))
]

pinecone_index.upsert(vectors)
```

---

*This SOP provides comprehensive guidance for implementing Fireworks AI's embedding models in production applications. For the latest model updates and features, refer to the Fireworks AI documentation.* 