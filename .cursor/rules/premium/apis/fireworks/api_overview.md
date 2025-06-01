---
description: 
globs: 
alwaysApply: false
---
# Fireworks AI API Implementation SOP

## Standard Operating Procedure for Fireworks AI Platform Integration
**Version:** 2.0  
**Last Updated:** May 2025  
**Author:** Digital Oracle Development Team  
**Purpose:** Comprehensive guide for implementing Fireworks AI generative AI platform including serverless inference, fine-tuning, dedicated deployments, and multi-modal capabilities with proper CLI commands and API integration.

---

## 🎯 OVERVIEW

This SOP covers complete Fireworks AI platform implementation including:
- **Serverless Inference:** Text, vision, audio, embeddings, and image generation
- **Fine-Tuning:** LoRA-based model customization with rapid deployment + Reinforcement Learning (RL) tuning
- **Dedicated Deployments:** Private GPU instances for production workloads with B200 support
- **Multi-Modal Capabilities:** Chat completions, function calling, vision, and voice agents
- **Cost Optimization:** Per-token pricing and scaling strategies with 3D Optimizer

**🆕 May 2025 Updates:**
- **Experiment Platform (GA):** Instant access to 1000+ models with multi-tenant/enterprise setups
- **Build SDK (Beta):** Programmatic fine-tuning, evaluation, and deployment management
- **Voice Agent Platform (Beta):** Real-time ASR, TTS, and voice agents with low latency
- **NVIDIA B200 + FP4 Inference:** 300 tokens/sec for DeepSeek models with 3-4x faster throughput
- **Global Virtual Cloud:** 8 major clouds, 18 regions worldwide with VPC deployment
- **3D Optimizer v2:** Intelligent tuning engine balancing quality, speed, and cost
- **Vision Platform Enhancements:** Qwen2.5-VL, Llama 4 Maverick, Phi-3.5 Vision support
- **Reinforcement Fine-Tuning (Beta):** Reward-based training with composable pipelines

**Key Benefits:**
- Blazing fast inference (up to 300 tokens/sec on B200)
- Industry-leading FireAttention CUDA optimization (4x faster than vLLM)
- Instant fine-tuned model deployment in ~1 minute
- Post-paid billing with spending limits
- 264 tokens/second on DeepSeek V3 (industry leader)

---

## 🆕 MAY 2025 PLATFORM UPDATES

### Experiment Platform (GA)
Access to 1000+ models with instant experimentation capabilities.

```bash
# Access 1000+ models instantly
firectl list models --category experimental

# Create experiment with multiple models
firectl create experiment \
  --name "model-comparison" \
  --models "llama-v4-scout,qwen3-235b,deepseek-r1-0528" \
  --dataset my-evaluation-set

# Run A/B testing
firectl run experiment EXPERIMENT_ID --split-traffic 50/50
```

### Build SDK (Beta)
Programmatic control over fine-tuning, evaluation, and deployment.

```python
# Install Build SDK
pip install fireworks-build-sdk

from fireworks_build import BuildClient

client = BuildClient(api_key="your_api_key")

# Programmatic fine-tuning
job = client.fine_tune.create(
    base_model="llama-v4-scout",
    dataset="my-dataset",
    output_model="my-custom-model",
    hyperparameters={
        "learning_rate": 0.0001,
        "epochs": 3,
        "lora_rank": 16
    }
)

# Monitor training
status = client.fine_tune.get(job.id)
print(f"Status: {status.state}, Progress: {status.progress}%")

# Deploy to inference
deployment = client.deploy.create(
    model=job.output_model,
    gpu_type="h100",
    replicas=2
)
```

### Voice Agent Platform (Beta)
Real-time voice agents with Fireworks ASR, LLM, and TTS integration.

```javascript
// Initialize voice agent
const voiceAgent = new FireworksVoiceAgent({
  apiKey: process.env.FIREWORKS_API_KEY,
  config: {
    asr: {
      model: 'fireworks-asr',
      language: 'en-US',
      realtime: true
    },
    llm: {
      model: 'llama-v4-maverick',
      temperature: 0.7
    },
    tts: {
      model: 'fireworks-tts',
      voice: 'professional',
      speed: 1.0
    }
  }
});

// Start voice conversation
voiceAgent.startConversation({
  onSpeechStart: () => console.log('User started speaking'),
  onSpeechEnd: (transcript) => console.log('Transcript:', transcript),
  onResponse: (audioBlob) => playAudio(audioBlob),
  onError: (error) => console.error('Voice error:', error)
});

// Real-time voice processing
voiceAgent.processAudioStream(audioStream);
```

### NVIDIA B200 + FP4 Inference
Industry-leading performance with 300 tokens/sec capability.

```bash
# Deploy on B200 for maximum performance
firectl create deployment \
  --model deepseek-v3 \
  --gpu-type b200 \
  --gpu-count 1 \
  --precision fp4 \
  --max-tokens-per-second 300

# Monitor B200 performance
firectl get deployment DEPLOYMENT_ID --metrics
# Expected output: ~264 tokens/second for DeepSeek V3
```

### Global Virtual Cloud
8 major clouds, 18 regions worldwide with VPC deployment options.

```bash
# List available regions
firectl list regions

# Deploy globally
firectl create deployment \
  --model llama-v4-scout \
  --region us-west-2 \
  --fallback-regions eu-west-1,asia-southeast-1 \
  --auto-scale true

# VPC deployment for enterprise
firectl create vpc-deployment \
  --model custom-model \
  --vpc-id vpc-12345 \
  --security-groups sg-67890 \
  --compliance-mode hipaa
```

### 3D Optimizer v2
Intelligent tuning engine balancing quality, speed, and cost.

```python
from fireworks_client import Fireworks3DOptimizer

optimizer = Fireworks3DOptimizer(
    model="llama-v4-maverick",
    target_latency=200,  # ms
    target_cost=0.50,    # $ per 1M tokens
    target_quality=0.85  # benchmark score
)

# Find optimal configuration
config = optimizer.optimize(
    dataset="validation-set",
    iterations=50
)

print(f"Optimal config: {config}")
# Output: gpu_type=h100, batch_size=8, precision=fp8, etc.

# Apply optimization
deployment = client.deploy.create(**config)
```

### Qwen3 Controllable Reasoning
Toggle reasoning on/off for speed vs transparency tradeoffs.

```javascript
// Qwen3 with reasoning mode
const reasoningResponse = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'accounts/fireworks/models/qwen3-235b-a22b',
    messages: [
      { role: 'user', content: 'Explain quantum computing step by step' }
    ],
    // Enable reasoning mode (default)
    extra_body: {
      reasoning_effort: 'medium'  // 'low', 'medium', 'high'
    },
    max_tokens: 4096
  })
});

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
      { role: 'user', content: 'Quick answer: What is 2+2?' }
    ],
    extra_body: {
      reasoning_effort: 'none'  // Disable reasoning for speed
    },
    max_tokens: 100
  })
});

// Tool calling with reasoning - shows both <think>...</think> AND tool calls
const toolCallResponse = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'accounts/fireworks/models/qwen3-235b-a22b',
    messages: [
      { role: 'user', content: 'What\'s the weather in Boston today?' }
    ],
    tools: [{
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather',
        parameters: {
          type: 'object',
          properties: { location: { type: 'string' } },
          required: ['location']
        }
      }
    }],
    max_tokens: 4096
  })
});
```

---

## 📋 PREREQUISITES

### Required Knowledge
- [ ] RESTful API concepts and HTTP methods
- [ ] JSON data formats and Bearer token authentication
- [ ] Node.js/JavaScript or Python for SDK usage
- [ ] Basic understanding of LLM concepts and tokens

### Required Accounts & Tools
- [ ] Fireworks AI account with API key
- [ ] `firectl` CLI tool installed
- [ ] Development environment (Node.js 16+ or Python 3.8+)
- [ ] Git for version control

### Environment Setup
```bash
# Install Fireworks CLI
pip install firectl

# Login to Fireworks
firectl login

# Verify authentication
firectl whoami

# Set environment variable
export FIREWORKS_API_KEY="your_api_key_here"
```

---

## 🔧 API AUTHENTICATION & CONFIGURATION

### Authentication Headers
All API requests require Bearer token authentication:

```javascript
const headers = {
  'Authorization': 'Bearer YOUR_API_KEY',
  'Content-Type': 'application/json'
};
```

### Base URLs & Endpoints
- **Base URL:** `https://api.fireworks.ai/inference/v1`
- **Chat Completions:** `/chat/completions`
- **Text Completions:** `/completions`
- **Embeddings:** `/embeddings`
- **Image Generation:** `/images/generations`
- **Audio Transcription:** `/audio/transcriptions`
- **Audio Translation:** `/audio/translations`
- **Models:** `/models`

---

## 💬 CHAT COMPLETIONS API

### Basic Chat Completion
**Endpoint:** `POST /chat/completions`

```javascript
const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is the capital of France?' }
    ],
    max_tokens: 2000,
    temperature: 0.7,
    top_p: 0.9
  })
});
```

### Advanced Parameters
```javascript
{
  model: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
  messages: [...],
  max_tokens: 2000,
  prompt_truncate_len: 1500,
  temperature: 1,
  top_p: 1,
  top_k: 50,
  frequency_penalty: 0,
  presence_penalty: 0,
  repetition_penalty: 1,
  reasoning_effort: 'low', // 'low', 'medium', 'high'
  n: 1,
  ignore_eos: false,
  stop: ['STOP', 'END'],
  response_format: { type: 'json_object' }, // For JSON mode
  stream: false,
  context_length_exceeded_behavior: 'truncate',
  user: 'user_identifier'
}
```

### Function Calling
```javascript
{
  model: 'accounts/fireworks/models/firefunction-v2',
  messages: [...],
  tools: [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather information',
        parameters: {
          type: 'object',
          required: ['location'],
          properties: {
            location: {
              type: 'string',
              description: 'City name'
            }
          }
        }
      }
    }
  ]
}
```

---

## 📝 TEXT COMPLETIONS API

### Basic Text Completion
**Endpoint:** `POST /completions`

```javascript
const response = await fetch('https://api.fireworks.ai/inference/v1/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
    prompt: 'The capital of France is',
    max_tokens: 100,
    temperature: 0.7
  })
});
```

### Vision-Language Models
```javascript
{
  model: 'accounts/fireworks/models/llama-v3p2-11b-vision-instruct',
  prompt: 'Describe this image:',
  images: ['data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAA...'],
  max_tokens: 500
}
```

---

## 🧠 EMBEDDINGS API

### Generate Embeddings
**Endpoint:** `POST /embeddings`

```javascript
const response = await fetch('https://api.fireworks.ai/inference/v1/embeddings', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'accounts/fireworks/models/nomic-embed-text-v1.5',
    input: [
      'Your text to embed here',
      'Another piece of text'
    ]
  })
});
```

**Response Format:**
```javascript
{
  object: 'list',
  data: [
    {
      object: 'embedding',
      index: 0,
      embedding: [-0.006929283, 0.005336422, ...]
    }
  ],
  model: 'accounts/fireworks/models/nomic-embed-text-v1.5',
  usage: {
    prompt_tokens: 8,
    total_tokens: 8
  }
}
```

---

## 🎨 IMAGE GENERATION API

### Generate Images
**Endpoint:** `POST /images/generations`

```javascript
const response = await fetch('https://api.fireworks.ai/inference/v1/images/generations', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'accounts/fireworks/models/flux-1-dev-fp8',
    prompt: 'A beautiful sunset over mountains',
    n: 1,
    size: '1024x1024',
    response_format: 'url'
  })
});
```

### Advanced Image Options
```javascript
{
  model: 'accounts/fireworks/models/stable-diffusion-xl-1024-v1-0',
  prompt: 'A cyberpunk cityscape at night',
  negative_prompt: 'blurry, low quality',
  n: 1,
  size: '1024x1024',
  response_format: 'url', // or 'b64_json'
  steps: 30,
  guidance_scale: 7.5,
  seed: 42
}
```

---

## 🎵 AUDIO API

### Speech-to-Text Transcription
**Endpoint:** `POST /audio/transcriptions`

```javascript
const formData = new FormData();
formData.append('file', audioFile);
formData.append('model', 'accounts/fireworks/models/whisper-v3-large');
formData.append('response_format', 'json');

const response = await fetch('https://api.fireworks.ai/inference/v1/audio/transcriptions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: formData
});
```

### Audio Translation
**Endpoint:** `POST /audio/translations`

```javascript
const formData = new FormData();
formData.append('file', audioFile);
formData.append('model', 'accounts/fireworks/models/whisper-v3-large');
formData.append('response_format', 'json');

const response = await fetch('https://api.fireworks.ai/inference/v1/audio/translations', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: formData
});
```

### Streaming Transcription
For real-time audio transcription, use WebSocket connection:

```javascript
const ws = new WebSocket('wss://api.fireworks.ai/inference/v1/audio/stream');
ws.onopen = () => {
  ws.send(JSON.stringify({
    model: 'accounts/fireworks/models/whisper-v3-large-turbo',
    config: {
      sample_rate: 16000,
      encoding: 'linear16'
    }
  }));
};
```

---

## 📊 MODEL MANAGEMENT

### List Available Models
**Endpoint:** `GET /models`

```javascript
const response = await fetch('https://api.fireworks.ai/inference/v1/models', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
```

### Model Categories & Pricing (May 2025)

#### Text & Vision Models
| Model Category | Price per 1M tokens | Examples |
|---|---|---|
| < 4B parameters | $0.10 | Llama 3.2 3B |
| 4B - 16B parameters | $0.20 | Llama 3.1 8B, Qwen3-30B |
| > 16B parameters | $0.90 | Llama 3.1 70B, DeepSeek V3 |
| MoE 0B - 56B | $0.50 | Mixtral 8x7B |
| MoE 56.1B - 176B | $1.20 | Mixtral 8x22B |
| **🆕 DeepSeek R1 (Fast)** | $3.00 input, $8.00 output | DeepSeek R1 |
| **🆕 DeepSeek R1 0528 (Fast)** | $3.00 input, $8.00 output | DeepSeek R1 0528 |
| **🆕 DeepSeek R1 (Basic)** | $0.55 input, $2.19 output | DeepSeek R1 Basic |
| Llama 3.1 405B | $3.00 | Llama 3.1 405B |
| **🆕 Meta Llama 4 Maverick (Basic)** | $0.22 input, $0.88 output | Llama 4 Maverick |
| **🆕 Meta Llama 4 Scout (Basic)** | $0.15 input, $0.60 output | Llama 4 Scout |
| **🆕 Qwen3 235B** | $0.22 input, $0.88 output | Qwen3-235B-A22B |
| **🆕 Qwen3 30B** | $0.15 input, $0.60 output | Qwen3-30B-A3B |

#### Featured May 2025 Models

**🔥 DeepSeek R1 0528 (Latest):**
- Updated version of state-of-the-art DeepSeek R1
- Enhanced reasoning capabilities
- Same pricing as original R1: $3.00 input, $8.00 output

**🚀 Qwen3-235B-A22B:**
- 235B total parameters, 22B active (MoE architecture)
- Controllable chain-of-thought with `reasoning_effort` parameter
- Tool calling + reasoning in same completion
- Apache-2.0 license
- Endpoint: `accounts/fireworks/models/qwen3-235b-a22b`

**⚡ Llama 4 Models:**
- **Maverick (Basic)**: Balanced performance for most use cases
- **Scout (Basic)**: Optimized for speed and efficiency
- Enhanced coding and reasoning capabilities

#### Audio Models (per minute)
| Model | Price | Use Case |
|---|---|---|
| **🆕 Fireworks ASR** | $0.0025 | Real-time voice agents (Beta) |
| Whisper-v3-large | $0.0015 | High accuracy transcription |
| Whisper-v3-large-turbo | $0.0009 | Fast transcription |
| Streaming transcription | $0.0032 | Real-time processing |

#### Image Generation (per step)
| Model | Price per step | Typical cost |
|---|---|---|
| SDXL models | $0.00013 | $0.0039 per 30-step image |
| FLUX.1 [dev] | $0.0005 | $0.014 per 28-step image |
| FLUX.1 [schnell] | $0.00035 | $0.0014 per 4-step image |

#### Embeddings
| Model size | Price per 1M tokens |
|---|---|
| Up to 150M | $0.008 |
| 150M - 350M | $0.016 |

---

## 🔧 FINE-TUNING SERVICE

### Dataset Preparation
Create JSONL dataset with conversation format:

```jsonl
{"messages": [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": "What is AI?"}, {"role": "assistant", "content": "AI is artificial intelligence..."}]}
{"messages": [{"role": "user", "content": "Explain machine learning"}, {"role": "assistant", "content": "Machine learning is a subset of AI..."}]}
```

### CLI Commands

#### Create Dataset
```bash
# Upload dataset
firectl create dataset my-dataset path/to/training_data.jsonl

# Verify dataset
firectl get dataset my-dataset
```

#### Start Fine-Tuning Job
```bash
# Basic fine-tuning
firectl create sftj --base-model llama-v3p1-8b-instruct --dataset my-dataset --output-model my-tuned-model

# Advanced fine-tuning with options
firectl create sftj \
  --base-model llama-v3p1-8b-instruct \
  --dataset my-dataset \
  --output-model my-tuned-model \
  --job-id my-fine-tuning-job \
  --learning-rate 0.0001 \
  --epochs 2 \
  --early-stop \
  --evaluation-dataset my-eval-set \
  --max-context-length 8192 \
  --lora-rank 16 \
  --turbo \
  --wandb-entity my-org \
  --wandb-api-key xxx \
  --wandb-project "My Project"
```

#### Monitor Job Status
```bash
# Check job status
firectl get sftj JOB_ID

# List all models
firectl list models

# Get model details
firectl get model MODEL_ID
```

#### Download Model Weights
```bash
firectl download model MODEL_ID ./local_path
```

### Fine-Tuning Pricing
| Model Category | Price per 1M training tokens |
|---|---|
| Up to 16B parameters | $0.50 |
| 16.1B - 80B parameters | $3.00 |
| MoE 0B - 56B (Mixtral) | $2.00 |
| MoE 56.1B - 176B | $6.00 |

**Minimum charge:** $3 per job

---

## 🚀 DEDICATED DEPLOYMENTS

### Creating On-Demand Deployments
```bash
# Create deployment
firectl create deployment \
  --model llama-v3p1-70b-instruct \
  --name my-deployment \
  --gpu-type h100 \
  --gpu-count 2 \
  --max-replicas 4

# List deployments
firectl list deployments

# Get deployment status
firectl get deployment DEPLOYMENT_ID

# Delete deployment
firectl delete deployment DEPLOYMENT_ID
```

### GPU Pricing (per hour, billed per second)
| GPU Type | Price per hour |
|---|---|
| A100 80GB | $2.90 |
| H100 80GB | $5.80 |
| H200 141GB | $9.99 |
| AMD MI300X | $4.99 |

### Benefits of Dedicated Deployments
- **Guaranteed capacity and speeds**
- **Custom hardware configurations**
- **Multi-LoRA serving (up to 100 LoRAs)**
- **No cold starts**
- **Higher throughput and lower latency**

---

## 📚 INTEGRATION PATTERNS

### Express.js Middleware Example
```javascript
// fireworks-middleware.js
import fetch from 'node-fetch';

export function createFireworksMiddleware() {
  return async (req, res, next) => {
    if (!req.path.startsWith('/api/fireworks/')) {
      return next();
    }

    const { prompt, model = 'llama-v3p1-8b-instruct' } = req.body;

    try {
      const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FIREWORKS_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: `accounts/fireworks/models/${model}`,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000
        })
      });

      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
}
```

### React Hook Example
```javascript
// useFireworks.js
import { useState, useCallback } from 'react';

export function useFireworks() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateText = useCallback(async (prompt, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/fireworks/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: options.model || 'llama-v3p1-8b-instruct',
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 1000
        })
      });

      if (!response.ok) throw new Error('API request failed');
      
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generateText, loading, error };
}
```

### Python SDK Example
```python
# fireworks_client.py
import fireworks.client
import os

# Initialize client
fireworks.client.api_key = os.getenv("FIREWORKS_API_KEY")

class FireworksService:
    def __init__(self):
        self.client = fireworks.client
    
    def chat_completion(self, messages, model="llama-v3p1-8b-instruct", **kwargs):
        """Generate chat completion"""
        return self.client.ChatCompletion.create(
            model=f"accounts/fireworks/models/{model}",
            messages=messages,
            **kwargs
        )
    
    def generate_embedding(self, text, model="nomic-embed-text-v1.5"):
        """Generate text embeddings"""
        return self.client.Embedding.create(
            model=f"accounts/fireworks/models/{model}",
            input=text
        )
    
    def generate_image(self, prompt, model="stable-diffusion-xl-1024-v1-0", **kwargs):
        """Generate images"""
        return self.client.Image.create(
            model=f"accounts/fireworks/models/{model}",
            prompt=prompt,
            **kwargs
        )
```

---

## 🔒 SECURITY & BEST PRACTICES

### API Key Management
```javascript
// environment.ts
export const config = {
  fireworks: {
    apiKey: process.env.FIREWORKS_API_KEY,
    baseURL: 'https://api.fireworks.ai/inference/v1',
    timeout: 30000
  }
};

// Never expose API keys in client-side code
// Use server-side proxy for browser applications
```

### Error Handling
```javascript
class FireworksAPIError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = 'FireworksAPIError';
    this.status = status;
    this.response = response;
  }
}

async function safeFireworksRequest(endpoint, options) {
  try {
    const response = await fetch(endpoint, options);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new FireworksAPIError(
        errorData.error?.message || 'API request failed',
        response.status,
        errorData
      );
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof FireworksAPIError) throw error;
    throw new FireworksAPIError(error.message, 0, null);
  }
}
```

### Rate Limiting & Retries
```javascript
class FireworksClient {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.fireworks.ai/inference/v1';
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, config);
        
        if (response.status === 429) {
          // Rate limited, wait and retry
          if (attempt < this.maxRetries) {
            await new Promise(resolve => 
              setTimeout(resolve, this.retryDelay * Math.pow(2, attempt))
            );
            continue;
          }
        }
        
        return await this.handleResponse(response);
      } catch (error) {
        if (attempt === this.maxRetries) throw error;
        await new Promise(resolve => 
          setTimeout(resolve, this.retryDelay * Math.pow(2, attempt))
        );
      }
    }
  }
}
```

---

## 📈 MONITORING & OPTIMIZATION

### Usage Tracking
```javascript
// usage-tracker.js
class FireworksUsageTracker {
  constructor() {
    this.usage = {
      tokens: 0,
      requests: 0,
      cost: 0,
      models: {}
    };
  }

  trackRequest(model, inputTokens, outputTokens) {
    const totalTokens = inputTokens + outputTokens;
    const cost = this.calculateCost(model, inputTokens, outputTokens);

    this.usage.tokens += totalTokens;
    this.usage.requests += 1;
    this.usage.cost += cost;

    if (!this.usage.models[model]) {
      this.usage.models[model] = { requests: 0, tokens: 0, cost: 0 };
    }
    this.usage.models[model].requests += 1;
    this.usage.models[model].tokens += totalTokens;
    this.usage.models[model].cost += cost;
  }

  calculateCost(model, inputTokens, outputTokens) {
    const pricing = {
      'llama-v3p1-8b-instruct': 0.20 / 1000000, // $0.20 per 1M tokens
      'mixtral-8x7b-instruct': 0.50 / 1000000,
      'deepseek-r1': { input: 3.00 / 1000000, output: 8.00 / 1000000 }
    };

    const modelPricing = pricing[model];
    if (typeof modelPricing === 'number') {
      return (inputTokens + outputTokens) * modelPricing;
    } else if (modelPricing?.input && modelPricing?.output) {
      return inputTokens * modelPricing.input + outputTokens * modelPricing.output;
    }
    return 0;
  }
}
```

### Performance Monitoring
```javascript
// performance-monitor.js
class FireworksPerformanceMonitor {
  constructor() {
    this.metrics = [];
  }

  async measureRequest(requestFn) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    try {
      const result = await requestFn();
      const endTime = Date.now();
      const endMemory = process.memoryUsage();

      this.metrics.push({
        timestamp: new Date().toISOString(),
        duration: endTime - startTime,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
        success: true
      });

      return result;
    } catch (error) {
      const endTime = Date.now();
      
      this.metrics.push({
        timestamp: new Date().toISOString(),
        duration: endTime - startTime,
        success: false,
        error: error.message
      });

      throw error;
    }
  }

  getAverageResponseTime() {
    const successfulRequests = this.metrics.filter(m => m.success);
    if (successfulRequests.length === 0) return 0;
    
    const totalTime = successfulRequests.reduce((sum, m) => sum + m.duration, 0);
    return totalTime / successfulRequests.length;
  }
}
```

---

## 🏗️ COMPOUND AI SYSTEMS

### Building Multi-Modal Applications
```javascript
// compound-ai-system.js
class CompoundAISystem {
  constructor(fireworksClient) {
    this.client = fireworksClient;
  }

  async processMultiModalInput(text, imageUrl) {
    // 1. Analyze image
    const imageAnalysis = await this.client.chatCompletion([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image in detail:' },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
    ], 'llama-v3p2-11b-vision-instruct');

    // 2. Generate embeddings for text
    const textEmbedding = await this.client.generateEmbedding(text);

    // 3. Combine analysis with text using function calling
    const result = await this.client.chatCompletion([
      {
        role: 'system',
        content: 'You are an AI assistant that can analyze both text and images.'
      },
      {
        role: 'user',
        content: `Text: ${text}\nImage Analysis: ${imageAnalysis.choices[0].message.content}\n\nProvide a comprehensive response.`
      }
    ], 'firefunction-v2');

    return {
      textEmbedding,
      imageAnalysis: imageAnalysis.choices[0].message.content,
      finalResponse: result.choices[0].message.content
    };
  }
}
```

### RAG Implementation with Fireworks
```javascript
// rag-system.js
class FireworksRAGSystem {
  constructor(fireworksClient, vectorDB) {
    this.client = fireworksClient;
    this.vectorDB = vectorDB;
  }

  async indexDocuments(documents) {
    const embeddings = await Promise.all(
      documents.map(doc => this.client.generateEmbedding(doc.content))
    );

    return this.vectorDB.store(documents, embeddings);
  }

  async query(question) {
    // 1. Generate query embedding
    const queryEmbedding = await this.client.generateEmbedding(question);

    // 2. Search similar documents
    const relevantDocs = await this.vectorDB.search(queryEmbedding, 5);

    // 3. Generate response with context
    const context = relevantDocs.map(doc => doc.content).join('\n\n');
    
    const response = await this.client.chatCompletion([
      {
        role: 'system',
        content: 'Answer the question based on the provided context. If the context doesn\'t contain enough information, say so.'
      },
      {
        role: 'user',
        content: `Context:\n${context}\n\nQuestion: ${question}`
      }
    ], 'llama-v3p1-70b-instruct');

    return {
      answer: response.choices[0].message.content,
      sources: relevantDocs.map(doc => doc.metadata)
    };
  }
}
```

---

## 🔄 DEPLOYMENT STRATEGIES

### Environment Configuration
```bash
# .env file for different environments

# Development
NODE_ENV=development
FIREWORKS_API_KEY=fw_dev_xxxxxxxxxxxxxxxx
FIREWORKS_MODEL=llama-v3p1-8b-instruct
FIREWORKS_TIMEOUT=30000

# Production
NODE_ENV=production
FIREWORKS_API_KEY=fw_prod_xxxxxxxxxxxxxxxx
FIREWORKS_MODEL=llama-v3p1-70b-instruct
FIREWORKS_TIMEOUT=60000
FIREWORKS_RATE_LIMIT=600
```

### Docker Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Don't expose API keys in build
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
```

### Kubernetes Deployment
```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fireworks-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fireworks-app
  template:
    metadata:
      labels:
        app: fireworks-app
    spec:
      containers:
      - name: app
        image: your-app:latest
        env:
        - name: FIREWORKS_API_KEY
          valueFrom:
            secretKeyRef:
              name: fireworks-secret
              key: api-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Secret
metadata:
  name: fireworks-secret
type: Opaque
stringData:
  api-key: "your-fireworks-api-key"
```

---

## 📋 TROUBLESHOOTING

### Common Issues & Solutions

#### Authentication Errors
```javascript
// Check API key format and validity
if (!process.env.FIREWORKS_API_KEY?.startsWith('fw_')) {
  throw new Error('Invalid Fireworks API key format');
}

// Test API key
const testResponse = await fetch('https://api.fireworks.ai/inference/v1/models', {
  headers: { 'Authorization': `Bearer ${process.env.FIREWORKS_API_KEY}` }
});

if (testResponse.status === 401) {
  throw new Error('Invalid API key');
}
```

#### Rate Limiting
```javascript
// Handle rate limiting gracefully
const handleRateLimit = async (response) => {
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || 60;
    console.log(`Rate limited. Retrying after ${retryAfter} seconds.`);
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return true; // Should retry
  }
  return false;
};
```

#### Model Availability
```javascript
// Check if model is available
const checkModelAvailability = async (modelId) => {
  const response = await fetch(`https://api.fireworks.ai/inference/v1/models/${modelId}`, {
    headers: { 'Authorization': `Bearer ${process.env.FIREWORKS_API_KEY}` }
  });
  
  if (response.status === 404) {
    throw new Error(`Model ${modelId} not found or not accessible`);
  }
  
  return response.ok;
};
```

### Debug Mode
```javascript
// Enable debug logging
const debug = process.env.NODE_ENV === 'development';

const fireworksRequest = async (endpoint, options) => {
  if (debug) {
    console.log('Fireworks Request:', {
      endpoint,
      method: options.method,
      headers: { ...options.headers, 'Authorization': '[REDACTED]' },
      body: options.body
    });
  }

  const response = await fetch(endpoint, options);
  
  if (debug) {
    console.log('Fireworks Response:', {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries())
    });
  }

  return response;
};
```

---

## 📚 ADDITIONAL RESOURCES

### Official Documentation
- [Fireworks AI API Reference](mdc:https:/docs.fireworks.ai/api-reference/introduction)
- [Chat Completions](mdc:https:/docs.fireworks.ai/api-reference/post-chatcompletions)
- [Text Completions](mdc:https:/docs.fireworks.ai/api-reference/post-completions)
- [Embeddings](mdc:https:/docs.fireworks.ai/api-reference/creates-an-embedding-vector-representing-the-input-text)
- [Image Generation](mdc:https:/docs.fireworks.ai/api-reference/generate-a-new-image-from-a-text-prompt)
- [Audio Transcription](mdc:https:/docs.fireworks.ai/api-reference/audio-transcriptions)
- [Audio Translation](mdc:https:/docs.fireworks.ai/api-reference/audio-translations)
- [Models List](mdc:https:/docs.fireworks.ai/api-reference/list-models)

### Community & Support
- **Discord:** Join Fireworks AI Discord community
- **Email:** support@fireworks.ai
- **GitHub:** Fireworks AI repositories
- **Blog:** https://fireworks.ai/blog

### Cost Optimization Tips
1. **Use appropriate model sizes** for your use case
2. **Implement caching** for repeated requests
3. **Use streaming** for real-time applications
4. **Monitor token usage** and set spending limits
5. **Consider fine-tuning** for specialized tasks
6. **Use dedicated deployments** for high-volume production

---

## 📄 CHANGELOG

### Version 1.0 (2024)
- Initial SOP creation
- Complete API coverage for all Fireworks AI services
- Integration patterns and best practices
- Security guidelines and monitoring
- Troubleshooting guide

### Version 2.0 (May 2025)
- Added Reinforcement Learning (RL) tuning
- Added B200 support
- Added vision and voice agents
- Added 3D Optimizer
- Added Experiment Platform
- Added Build SDK
- Added Voice Agent Platform
- Added NVIDIA B200 + FP4 Inference
- Added Global Virtual Cloud
- Added Vision Platform Enhancements
- Added Reinforcement Fine-Tuning (Beta)

---

**End of SOP**

For questions or updates to this SOP, contact the Digital Oracle Development Team.

