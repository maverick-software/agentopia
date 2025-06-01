# Fireworks AI - Language Models & Text Generation SOP

## Overview
**Version:** 2.0  
**Last Updated:** May 2025  
**Service Category:** Text Generation & Language Models  
**Purpose:** Comprehensive implementation guide for Fireworks AI's language models including chat completions, reasoning models, function calling, and streaming responses.

---

## 🎯 SUPPORTED MODELS & CAPABILITIES

### 🔥 **Reasoning Models (May 2025)**
#### DeepSeek R1 Series
- **DeepSeek R1 0528 (Latest)** - Enhanced reasoning with updated capabilities
  - **Model ID:** `accounts/fireworks/models/deepseek-r1-0528`
  - **Pricing:** $3.00 input / $8.00 output per 1M tokens
  - **Context:** 128K tokens
  - **Features:** Step-by-step reasoning, mathematical problem solving

- **DeepSeek R1 (Fast)**
  - **Model ID:** `accounts/fireworks/models/deepseek-r1`
  - **Pricing:** $3.00 input / $8.00 output per 1M tokens
  - **Features:** Advanced reasoning with chain-of-thought

- **DeepSeek R1 (Basic)**
  - **Model ID:** `accounts/fireworks/models/deepseek-r1-basic`
  - **Pricing:** $0.55 input / $2.19 output per 1M tokens
  - **Features:** Cost-optimized reasoning

#### Qwen3 Series - Controllable Reasoning
- **Qwen3-235B-A22B**
  - **Model ID:** `accounts/fireworks/models/qwen3-235b-a22b`
  - **Pricing:** $0.22 input / $0.88 output per 1M tokens
  - **Parameters:** 235B total, 22B active (MoE)
  - **Features:** Controllable chain-of-thought, tool calling + reasoning
  - **License:** Apache-2.0

- **Qwen3-30B-A3B**
  - **Model ID:** `accounts/fireworks/models/qwen3-30b-a3b`
  - **Pricing:** $0.15 input / $0.60 output per 1M tokens

### 🚀 **General Purpose Models**
#### Meta Llama 4 Series (Latest)
- **Llama 4 Maverick (Basic)**
  - **Model ID:** `accounts/fireworks/models/llama4-maverick-instruct-basic`
  - **Pricing:** $0.22 input / $0.88 output per 1M tokens
  - **Features:** Balanced performance for most use cases

- **Llama 4 Scout (Basic)**
  - **Model ID:** `accounts/fireworks/models/llama4-scout-instruct-basic`
  - **Pricing:** $0.15 input / $0.60 output per 1M tokens
  - **Features:** Optimized for speed and efficiency

#### DeepSeek V3
- **Model ID:** `accounts/fireworks/models/deepseek-v3`
- **Pricing:** $0.90 per 1M tokens
- **Parameters:** 671B total, 37B active (MoE)
- **Performance:** 264 tokens/second on B200 (industry-leading)
- **Features:** Function calling, FP8 precision, aggressive MoE

#### Classic Models
- **Llama 3.1 405B** - $3.00 per 1M tokens
- **Llama 3.1 70B** - $0.90 per 1M tokens
- **Mixtral 8x7B** - $0.50 per 1M tokens
- **Mixtral 8x22B** - $1.20 per 1M tokens

---

## 🔧 IMPLEMENTATION PATTERNS

### Basic Chat Completion
```javascript
// Basic chat completion with OpenAI-compatible API
const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'accounts/fireworks/models/llama4-maverick-instruct-basic',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Explain quantum computing in simple terms.' }
    ],
    max_tokens: 1000,
    temperature: 0.7,
    top_p: 0.9
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

### Python SDK Implementation
```python
import fireworks.client
import os

# Initialize client
fireworks.client.api_key = os.getenv("FIREWORKS_API_KEY")

# Basic completion
response = fireworks.client.ChatCompletion.create(
    model="accounts/fireworks/models/deepseek-r1-0528",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Solve this step by step: What is 15% of 240?"}
    ],
    max_tokens=2000,
    temperature=0.3  # Lower temperature for reasoning tasks
)

print(response.choices[0].message.content)
```

### Streaming Responses
```javascript
// Streaming implementation for real-time responses
const streamResponse = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'accounts/fireworks/models/qwen3-235b-a22b',
    messages: [
      { role: 'user', content: 'Write a detailed explanation of machine learning.' }
    ],
    stream: true,
    max_tokens: 2000
  })
});

const reader = streamResponse.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices[0]?.delta?.content;
        if (content) {
          process.stdout.write(content);
        }
      } catch (e) {
        // Skip malformed JSON
      }
    }
  }
}
```

---

## 🛠️ ADVANCED FEATURES

### Controllable Reasoning (Qwen3)
```javascript
// Qwen3 with reasoning mode enabled
const reasoningResponse = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'accounts/fireworks/models/qwen3-235b-a22b',
    messages: [
      { role: 'user', content: 'Analyze the pros and cons of renewable energy adoption.' }
    ],
    extra_body: {
      reasoning_effort: 'medium'  // 'low', 'medium', 'high', 'none'
    },
    max_tokens: 4096,
    temperature: 0.6,
    top_p: 0.95,
    top_k: 20
  })
});

// Response contains <think>...</think> reasoning blocks
const data = await reasoningResponse.json();
console.log(data.choices[0].message.content);

// Fast mode without reasoning
const fastResponse = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'accounts/fireworks/models/qwen3-235b-a22b',
    messages: [
      { role: 'user', content: 'Quick answer: What is the capital of France?' }
    ],
    extra_body: {
      reasoning_effort: 'none'  // Disable reasoning for speed
    },
    max_tokens: 100,
    temperature: 0.7,
    top_p: 0.8
  })
});
```

### Function Calling & Tool Use
```python
import json
import requests

# Define available tools/functions
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_current_weather",
            "description": "Fetch the current weather in a given location.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City name, e.g., London",
                    },
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
                },
                "required": ["location"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_compound_interest",
            "description": "Calculate compound interest for investments.",
            "parameters": {
                "type": "object",
                "properties": {
                    "principal": {"type": "number", "description": "Initial investment amount"},
                    "rate": {"type": "number", "description": "Annual interest rate (as decimal)"},
                    "time": {"type": "number", "description": "Time period in years"},
                    "compound_frequency": {"type": "integer", "description": "Compounding frequency per year"}
                },
                "required": ["principal", "rate", "time"]
            },
        },
    }
]

# Function calling with DeepSeek V3
response = requests.post(
    'https://api.fireworks.ai/inference/v1/chat/completions',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'model': 'accounts/fireworks/models/deepseek-v3',
        'messages': [
            {'role': 'user', 'content': 'What is the weather like in Tokyo and calculate compound interest for $10,000 at 5% for 10 years?'}
        ],
        'tools': tools,
        'max_tokens': 2000
    }
)

data = response.json()
message = data['choices'][0]['message']

# Check if function calls were made
if 'tool_calls' in message:
    for tool_call in message['tool_calls']:
        function_name = tool_call['function']['name']
        arguments = json.loads(tool_call['function']['arguments'])
        print(f"Function: {function_name}")
        print(f"Arguments: {arguments}")
```

### Multi-turn Conversations with Memory
```python
# Multi-turn conversation implementation
class FireworksChat:
    def __init__(self, model="accounts/fireworks/models/llama4-maverick-instruct-basic"):
        self.model = model
        self.messages = []
        self.api_key = os.getenv("FIREWORKS_API_KEY")
    
    def add_system_message(self, content):
        """Add system message to set context"""
        self.messages.append({"role": "system", "content": content})
    
    def send_message(self, content, temperature=0.7, max_tokens=1000):
        """Send user message and get assistant response"""
        # Add user message
        self.messages.append({"role": "user", "content": content})
        
        # Get response
        response = requests.post(
            'https://api.fireworks.ai/inference/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': self.model,
                'messages': self.messages,
                'temperature': temperature,
                'max_tokens': max_tokens
            }
        )
        
        data = response.json()
        assistant_message = data['choices'][0]['message']['content']
        
        # Add assistant response to conversation history
        self.messages.append({"role": "assistant", "content": assistant_message})
        
        return assistant_message
    
    def clear_history(self):
        """Clear conversation history"""
        self.messages = []

# Usage example
chat = FireworksChat()
chat.add_system_message("You are a helpful coding assistant.")

response1 = chat.send_message("How do I create a REST API in Python?")
print("Assistant:", response1)

response2 = chat.send_message("Can you show me a Flask example for that?")
print("Assistant:", response2)

response3 = chat.send_message("How would I add authentication to it?")
print("Assistant:", response3)
```

---

## ⚡ PERFORMANCE OPTIMIZATION

### Model Selection Guidelines
```python
# Performance vs cost optimization
def choose_model(task_type, complexity, budget):
    """
    Choose optimal model based on requirements
    """
    if task_type == "reasoning" and complexity == "high":
        return "accounts/fireworks/models/deepseek-r1-0528"  # Best reasoning
    
    elif task_type == "reasoning" and budget == "low":
        return "accounts/fireworks/models/deepseek-r1-basic"  # Cost-effective reasoning
    
    elif task_type == "function_calling":
        return "accounts/fireworks/models/qwen3-235b-a22b"  # Reasoning + tools
    
    elif task_type == "general" and complexity == "high":
        return "accounts/fireworks/models/llama4-maverick-instruct-basic"
    
    elif task_type == "general" and budget == "low":
        return "accounts/fireworks/models/llama4-scout-instruct-basic"
    
    elif task_type == "speed_critical":
        return "accounts/fireworks/models/deepseek-v3"  # 264 tokens/sec on B200
    
    else:
        return "accounts/fireworks/models/llama4-scout-instruct-basic"  # Default

# Parameter optimization
def optimize_parameters(task_type):
    """
    Optimize parameters for different task types
    """
    if task_type == "reasoning":
        return {
            "temperature": 0.3,  # Lower for consistency
            "top_p": 0.95,
            "top_k": 20,
            "max_tokens": 2000
        }
    
    elif task_type == "creative":
        return {
            "temperature": 0.8,  # Higher for creativity
            "top_p": 0.9,
            "max_tokens": 1500
        }
    
    elif task_type == "factual":
        return {
            "temperature": 0.1,  # Very low for accuracy
            "top_p": 0.9,
            "max_tokens": 1000
        }
    
    else:
        return {
            "temperature": 0.7,
            "top_p": 0.9,
            "max_tokens": 1000
        }
```

### Batching and Concurrency
```python
import asyncio
import aiohttp

async def batch_completions(prompts, model="accounts/fireworks/models/llama4-scout-instruct-basic"):
    """
    Process multiple prompts concurrently
    """
    async def single_completion(session, prompt):
        payload = {
            'model': model,
            'messages': [{'role': 'user', 'content': prompt}],
            'max_tokens': 500
        }
        
        async with session.post(
            'https://api.fireworks.ai/inference/v1/chat/completions',
            headers={
                'Authorization': 'Bearer YOUR_API_KEY',
                'Content-Type': 'application/json'
            },
            json=payload
        ) as response:
            data = await response.json()
            return data['choices'][0]['message']['content']
    
    async with aiohttp.ClientSession() as session:
        tasks = [single_completion(session, prompt) for prompt in prompts]
        results = await asyncio.gather(*tasks)
        return results

# Usage
prompts = [
    "Explain photosynthesis",
    "What is machine learning?",
    "Describe the water cycle",
    "How does gravity work?"
]

results = asyncio.run(batch_completions(prompts))
for i, result in enumerate(results):
    print(f"Prompt {i+1}: {result}\n")
```

---

## 🔒 SECURITY & BEST PRACTICES

### API Key Management
```python
import os
from cryptography.fernet import Fernet

class SecureFireworksClient:
    def __init__(self):
        # Store encrypted API key
        self.cipher = Fernet(os.getenv('ENCRYPTION_KEY').encode())
        encrypted_key = os.getenv('ENCRYPTED_FIREWORKS_KEY')
        self.api_key = self.cipher.decrypt(encrypted_key.encode()).decode()
    
    def chat_completion(self, messages, model, **kwargs):
        """Secure chat completion with validation"""
        # Input validation
        if not isinstance(messages, list):
            raise ValueError("Messages must be a list")
        
        # Content filtering (implement your filters)
        filtered_messages = self.filter_content(messages)
        
        # Rate limiting (implement your logic)
        self.check_rate_limit()
        
        # Make request
        return self._make_request(filtered_messages, model, **kwargs)
    
    def filter_content(self, messages):
        """Implement content filtering"""
        # Add your content filtering logic here
        return messages
    
    def check_rate_limit(self):
        """Implement rate limiting"""
        # Add your rate limiting logic here
        pass
```

### Error Handling and Retries
```python
import time
import random
from functools import wraps

def exponential_backoff(max_retries=3, base_delay=1):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except requests.exceptions.RequestException as e:
                    if attempt == max_retries:
                        raise e
                    
                    # Handle rate limiting
                    if hasattr(e, 'response') and e.response.status_code == 429:
                        delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                        print(f"Rate limited. Retrying in {delay:.2f} seconds...")
                        time.sleep(delay)
                    else:
                        raise e
            
        return wrapper
    return decorator

@exponential_backoff(max_retries=3)
def robust_chat_completion(messages, model, **kwargs):
    """Chat completion with automatic retry on failures"""
    response = requests.post(
        'https://api.fireworks.ai/inference/v1/chat/completions',
        headers={
            'Authorization': 'Bearer YOUR_API_KEY',
            'Content-Type': 'application/json'
        },
        json={
            'model': model,
            'messages': messages,
            **kwargs
        },
        timeout=30
    )
    
    response.raise_for_status()
    return response.json()
```

---

## 📊 MONITORING & ANALYTICS

### Usage Tracking
```python
import time
import logging
from datetime import datetime

class FireworksUsageTracker:
    def __init__(self, log_file="fireworks_usage.log"):
        logging.basicConfig(
            filename=log_file,
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
    
    def track_completion(self, model, input_tokens, output_tokens, response_time, cost=None):
        """Track completion usage and performance"""
        usage_data = {
            "timestamp": datetime.now().isoformat(),
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "response_time_seconds": response_time,
            "tokens_per_second": output_tokens / response_time if response_time > 0 else 0,
            "estimated_cost": cost
        }
        
        self.logger.info(f"COMPLETION_USAGE: {usage_data}")
        return usage_data
    
    def calculate_cost(self, model, input_tokens, output_tokens):
        """Calculate estimated cost based on model pricing"""
        pricing = {
            "accounts/fireworks/models/deepseek-r1-0528": {"input": 3.00, "output": 8.00},
            "accounts/fireworks/models/qwen3-235b-a22b": {"input": 0.22, "output": 0.88},
            "accounts/fireworks/models/llama4-maverick-instruct-basic": {"input": 0.22, "output": 0.88},
            "accounts/fireworks/models/llama4-scout-instruct-basic": {"input": 0.15, "output": 0.60},
            "accounts/fireworks/models/deepseek-v3": {"input": 0.90, "output": 0.90}
        }
        
        if model in pricing:
            prices = pricing[model]
            cost = (input_tokens / 1_000_000 * prices["input"]) + (output_tokens / 1_000_000 * prices["output"])
            return cost
        return None

# Usage example
tracker = FireworksUsageTracker()

def tracked_completion(messages, model, **kwargs):
    start_time = time.time()
    
    response = requests.post(
        'https://api.fireworks.ai/inference/v1/chat/completions',
        headers={
            'Authorization': 'Bearer YOUR_API_KEY',
            'Content-Type': 'application/json'
        },
        json={
            'model': model,
            'messages': messages,
            **kwargs
        }
    )
    
    end_time = time.time()
    response_time = end_time - start_time
    
    data = response.json()
    usage = data.get('usage', {})
    
    cost = tracker.calculate_cost(
        model,
        usage.get('prompt_tokens', 0),
        usage.get('completion_tokens', 0)
    )
    
    tracker.track_completion(
        model,
        usage.get('prompt_tokens', 0),
        usage.get('completion_tokens', 0),
        response_time,
        cost
    )
    
    return data
```

---

## 🔄 MIGRATION & COMPATIBILITY

### OpenAI to Fireworks Migration
```python
# Drop-in replacement for OpenAI client
from openai import OpenAI

# Original OpenAI client
# openai_client = OpenAI(api_key="openai_key")

# Fireworks client (same interface)
fireworks_client = OpenAI(
    api_key="fireworks_key",
    base_url="https://api.fireworks.ai/inference/v1"
)

# Same code works with both!
response = fireworks_client.chat.completions.create(
    model="accounts/fireworks/models/llama4-maverick-instruct-basic",
    messages=[
        {"role": "user", "content": "Hello, world!"}
    ]
)

print(response.choices[0].message.content)
```

### Model Comparison Testing
```python
import asyncio

async def compare_models(prompt, models):
    """Compare performance across different models"""
    results = {}
    
    for model in models:
        start_time = time.time()
        
        response = await make_async_request(prompt, model)
        
        end_time = time.time()
        
        results[model] = {
            "response": response,
            "response_time": end_time - start_time,
            "model": model
        }
    
    return results

# Test different models
models_to_test = [
    "accounts/fireworks/models/llama4-maverick-instruct-basic",
    "accounts/fireworks/models/llama4-scout-instruct-basic",
    "accounts/fireworks/models/qwen3-235b-a22b",
    "accounts/fireworks/models/deepseek-v3"
]

results = asyncio.run(compare_models("Explain quantum computing", models_to_test))

for model, result in results.items():
    print(f"\nModel: {model}")
    print(f"Response Time: {result['response_time']:.2f}s")
    print(f"Response: {result['response'][:200]}...")
```

---

## 📝 TROUBLESHOOTING GUIDE

### Common Issues and Solutions

#### 1. **Rate Limiting (429 Error)**
```python
# Solution: Implement exponential backoff
def handle_rate_limit(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        for attempt in range(5):
            try:
                return func(*args, **kwargs)
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 429:
                    wait_time = (2 ** attempt) + random.uniform(0, 1)
                    time.sleep(wait_time)
                else:
                    raise
        raise Exception("Max retries exceeded")
    return wrapper
```

#### 2. **Context Length Exceeded**
```python
def truncate_messages(messages, max_tokens=100000):
    """Truncate messages to fit context window"""
    total_tokens = sum(len(msg['content'].split()) for msg in messages)
    
    if total_tokens <= max_tokens:
        return messages
    
    # Keep system message and recent messages
    if messages[0]['role'] == 'system':
        system_msg = messages[0]
        other_messages = messages[1:]
    else:
        system_msg = None
        other_messages = messages
    
    # Truncate from the beginning, keeping recent context
    truncated = other_messages[-10:]  # Keep last 10 messages
    
    if system_msg:
        return [system_msg] + truncated
    return truncated
```

#### 3. **Function Calling Issues**
```python
def validate_function_schema(tools):
    """Validate function calling schema"""
    for tool in tools:
        if tool['type'] != 'function':
            raise ValueError("Tool type must be 'function'")
        
        func = tool['function']
        required_fields = ['name', 'description', 'parameters']
        
        for field in required_fields:
            if field not in func:
                raise ValueError(f"Missing required field: {field}")
    
    return True
```

---

## 🚀 PRODUCTION DEPLOYMENT

### Express.js Middleware
```javascript
// Production-ready Express middleware
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/chat', limiter);

// Fireworks AI middleware
app.post('/api/chat', async (req, res) => {
  try {
    const { message, model = 'accounts/fireworks/models/llama4-scout-instruct-basic' } = req.body;
    
    // Input validation
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Invalid message' });
    }
    
    const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FIREWORKS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: message }],
        max_tokens: 1000,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    res.json({ response: data.choices[0].message.content });
    
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Docker Deployment
```dockerfile
# Dockerfile for Fireworks AI integration
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000

USER node

CMD ["node", "server.js"]
```

---

## 📈 PERFORMANCE BENCHMARKS

### Model Performance Comparison (May 2025)
| Model | Tokens/Second | Cost per 1M | Use Case |
|-------|---------------|-------------|----------|
| DeepSeek V3 | 264 (B200) | $0.90 | Speed critical |
| DeepSeek R1 0528 | ~150 | $3.00/$8.00 | Complex reasoning |
| Qwen3-235B-A22B | ~180 | $0.22/$0.88 | Reasoning + tools |
| Llama 4 Maverick | ~200 | $0.22/$0.88 | General purpose |
| Llama 4 Scout | ~250 | $0.15/$0.60 | Cost optimization |

### Latency Optimization Tips
1. **Model Selection:** Use Scout for speed, Maverick for balance
2. **Parameter Tuning:** Lower temperature for faster sampling
3. **Context Management:** Truncate long conversations
4. **Streaming:** Use streaming for perceived speed improvement
5. **Dedicated Deployments:** Use for guaranteed performance

---

*This SOP provides comprehensive guidance for implementing Fireworks AI's language models in production environments. For the latest updates and model releases, refer to the Fireworks AI documentation and blog.* 