# PiAPI LLM API - Standard Operating Procedure (SOP)

## Overview

PiAPI provides unified access to leading large language models (LLMs) including OpenAI's GPT series, Anthropic's Claude, Google's Gemini, and other state-of-the-art models through a single, consistent API interface. The platform offers competitive pricing with 25-75% discounts compared to official APIs.

**Official PiAPI LLM Documentation**: [https://piapi.ai/docs/llm-api](https://piapi.ai/docs/llm-api)

**API Base URL**: `https://api.piapi.ai/v1/chat/completions`

## Key Features

### Supported Models
- **OpenAI**: GPT-4o, GPT-4o-mini, GPT-4.1, GPT-4.1-mini, GPT-4.1-nano, o3-mini
- **Anthropic**: Claude 3.7 Sonnet, Claude 4 Opus, Claude 4 Sonnet
- **Google**: Gemini 2.5 Flash, Gemini 2.5 Pro
- **Meta**: Llama 3.3, Llama 4 (Scout/Maverick)
- **Specialized**: Coding-optimized, reasoning-focused variants

### Advanced Capabilities
- **Function Calling**: Tools and external API integration
- **Vision Support**: Image analysis and understanding
- **Long Context**: Up to 1M+ tokens for supported models
- **Streaming**: Real-time response generation
- **Custom Instructions**: System prompts and behavior control
- **Multimodal**: Text, image, and code processing

### Pricing Advantages
- **75% Discount**: GPT-4o-mini ($0.1125 vs $0.15 per 1M input tokens)
- **75% Discount**: GPT-4o ($1.875 vs $2.50 per 1M input tokens)
- **75% Discount**: Claude 3.7 Sonnet ($2.25 vs $3.00 per 1M input tokens)

## Pricing Structure

### Pay-as-you-go (PAYG) Pricing

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Notes |
|-------|----------------------|------------------------|--------|
| **GPT-4o-mini** | $0.1125 | $0.45 | 75% of OpenAI pricing |
| **GPT-4o** | $1.875 | $7.50 | Creator Plan+ only |
| **GPT-4.1/4.1-mini** | 75% of OpenAI | 75% of OpenAI | Latest models |
| **Claude 3.7 Sonnet** | $2.25 | $11.25 | Creator Plan+ only |
| **o3-mini** | Premium pricing | Premium pricing | Advanced reasoning |
| **Gemini 2.5 Flash** | Competitive rates | Competitive rates | Fast processing |

### Service Notes
- **Availability**: Sometimes faces availability issues due to steep discounts
- **Backup Recommended**: Always have alternative API sources ready
- **Plan Requirements**: Premium models require Creator Plan or above

## API Architecture

### Chat Completions Endpoint
```bash
POST https://api.piapi.ai/v1/chat/completions
```

#### Request Headers
```json
{
  "Authorization": "Bearer YOUR_API_KEY",
  "Content-Type": "application/json"
}
```

#### Basic Request Example
```json
{
  "model": "gpt-4o-mini",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful AI assistant specialized in software development."
    },
    {
      "role": "user",
      "content": "Explain the concept of RESTful APIs and provide a simple example."
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1500,
  "stream": false
}
```

#### Streaming Request Example
```json
{
  "model": "claude-3-7-sonnet-20250219",
  "messages": [
    {
      "role": "user",
      "content": "Write a detailed analysis of machine learning trends in 2025."
    }
  ],
  "temperature": 0.3,
  "max_tokens": 2048,
  "stream": true
}
```

## Advanced Features

### Function Calling
Enable models to use external tools and APIs:

```json
{
  "model": "gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": "What's the weather like in Tokyo today?"
    }
  ],
  "functions": [
    {
      "name": "get_weather",
      "description": "Get current weather for a location",
      "parameters": {
        "type": "object",
        "properties": {
          "location": {
            "type": "string",
            "description": "City name"
          },
          "units": {
            "type": "string",
            "enum": ["celsius", "fahrenheit"]
          }
        },
        "required": ["location"]
      }
    }
  ],
  "function_call": "auto"
}
```

### Vision Processing
Analyze images with supported models:

```json
{
  "model": "gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Describe what you see in this image and identify any potential safety issues."
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "https://example.com/construction-site.jpg"
          }
        }
      ]
    }
  ],
  "max_tokens": 1000
}
```

### Custom GPTs (Gizmo Support)
Access specialized ChatGPT models:

```json
{
  "model": "gpt-4-gizmo-g-gFt1ghYJl",
  "messages": [
    {
      "role": "user",
      "content": "Create a professional logo design concept for a tech startup."
    }
  ]
}
```

**Note**: Gizmo model names follow the pattern `gpt-4-gizmo-g-{ID}` where the ID is extracted from the ChatGPT URL.

## Parameter Reference

### Core Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | Model identifier (required) |
| `messages` | array | Conversation history (required) |
| `temperature` | float | Randomness control (0.0-2.0, default: 1.0) |
| `max_tokens` | integer | Maximum response length |
| `top_p` | float | Nucleus sampling parameter (0.0-1.0) |
| `stream` | boolean | Enable streaming responses (default: false) |

### Advanced Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `functions` | array | Available functions for tool calling |
| `function_call` | string/object | Function calling behavior control |
| `presence_penalty` | float | Penalty for token presence (-2.0 to 2.0) |
| `frequency_penalty` | float | Penalty for token frequency (-2.0 to 2.0) |
| `stop` | string/array | Stop sequences for generation |
| `logit_bias` | object | Token probability modifications |
| `n` | integer | Number of completions to generate |

## Response Format

### Standard Response
```json
{
  "id": "chatcmpl-83jZ61GDHtdlsFUzXDbpGeoU193Mj",
  "object": "chat.completion",
  "created": 1695900828,
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "RESTful APIs (Representational State Transfer) are a set of architectural principles..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 45,
    "completion_tokens": 312,
    "total_tokens": 357
  }
}
```

### Streaming Response
```json
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1695900828,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"role":"assistant","content":"REST"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1695900828,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":"ful APIs"},"finish_reason":null}]}

data: [DONE]
```

### Function Call Response
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": null,
        "function_call": {
          "name": "get_weather",
          "arguments": "{\"location\": \"Tokyo\", \"units\": \"celsius\"}"
        }
      },
      "finish_reason": "function_call"
    }
  ]
}
```

## Model Selection Guide

### Use Case Optimization

```javascript
function selectOptimalModel(useCase, requirements = {}) {
  const modelMatrix = {
    // Fast, cost-effective tasks
    'simple_qa': 'gpt-4o-mini',
    'content_summary': 'gpt-4o-mini',
    'basic_coding': 'gpt-4o-mini',
    
    // Complex reasoning and analysis
    'complex_analysis': 'claude-3-7-sonnet-20250219',
    'research_writing': 'gpt-4o',
    'advanced_coding': 'gpt-4.1',
    
    // Specialized tasks
    'image_analysis': 'gpt-4o',
    'function_calling': 'gpt-4o',
    'long_context': 'claude-3-7-sonnet-20250219',
    'reasoning': 'o3-mini',
    
    // Speed-optimized
    'real_time_chat': 'gpt-4o-mini',
    'streaming_content': 'gemini-2.5-flash'
  };
  
  let selectedModel = modelMatrix[useCase] || 'gpt-4o-mini';
  
  // Adjust based on requirements
  if (requirements.maxBudget && requirements.maxBudget < 0.5) {
    selectedModel = 'gpt-4o-mini';
  }
  
  if (requirements.needsVision) {
    selectedModel = 'gpt-4o';
  }
  
  if (requirements.contextLength > 100000) {
    selectedModel = 'claude-3-7-sonnet-20250219';
  }
  
  return selectedModel;
}
```

### Model Capabilities Matrix

| Model | Context Length | Vision | Function Calling | Reasoning | Speed | Cost |
|-------|----------------|--------|------------------|-----------|-------|------|
| **GPT-4o-mini** | 128K | ❌ | ✅ | Good | Fast | Lowest |
| **GPT-4o** | 128K | ✅ | ✅ | Excellent | Medium | Medium |
| **GPT-4.1** | 1M | ✅ | ✅ | Excellent | Medium | High |
| **Claude 3.7 Sonnet** | 200K | ✅ | ✅ | Excellent | Medium | High |
| **o3-mini** | 128K | ❌ | ✅ | Superior | Slow | Highest |
| **Gemini 2.5 Flash** | 1M | ✅ | ✅ | Good | Fastest | Low |

## Integration Examples

### Node.js Implementation
```javascript
class PiAPILLM {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.piapi.ai/v1';
  }
  
  async chatCompletion(messages, options = {}) {
    const payload = {
      model: options.model || 'gpt-4o-mini',
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1500,
      stream: options.stream || false,
      ...options
    };
    
    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (options.stream) {
        return this.handleStreamingResponse(response);
      }
      
      return response.json();
    } catch (error) {
      throw new Error(`PiAPI LLM error: ${error.message}`);
    }
  }
  
  async handleStreamingResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    return {
      async* stream() {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') return;
              
              try {
                yield JSON.parse(data);
              } catch (e) {
                console.warn('Failed to parse streaming data:', data);
              }
            }
          }
        }
      }
    };
  }
  
  async generateWithFunctions(prompt, functions, options = {}) {
    const messages = [
      { role: 'user', content: prompt }
    ];
    
    return this.chatCompletion(messages, {
      ...options,
      functions,
      function_call: 'auto'
    });
  }
  
  async analyzeImage(prompt, imageUrl, options = {}) {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
    ];
    
    return this.chatCompletion(messages, {
      model: 'gpt-4o',
      ...options
    });
  }
  
  async conversationWithContext(conversation, systemPrompt, options = {}) {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation
    ];
    
    return this.chatCompletion(messages, options);
  }
}

// Usage examples
const llm = new PiAPILLM('your_api_key');

async function basicExample() {
  try {
    const response = await llm.chatCompletion([
      {
        role: 'user',
        content: 'Explain quantum computing in simple terms.'
      }
    ], {
      model: 'gpt-4o-mini',
      temperature: 0.3,
      maxTokens: 1000
    });
    
    console.log(response.choices[0].message.content);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function streamingExample() {
  try {
    const response = await llm.chatCompletion([
      {
        role: 'user',
        content: 'Write a detailed blog post about renewable energy trends.'
      }
    ], {
      model: 'claude-3-7-sonnet-20250219',
      stream: true,
      maxTokens: 2000
    });
    
    for await (const chunk of response.stream()) {
      if (chunk.choices[0].delta.content) {
        process.stdout.write(chunk.choices[0].delta.content);
      }
    }
  } catch (error) {
    console.error('Streaming error:', error.message);
  }
}
```

### Python Implementation
```python
import requests
import json
from typing import Dict, List, Any, Optional, Generator

class PiAPILLM:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.piapi.ai/v1"
        
    def chat_completion(self, messages: List[Dict], **options) -> Dict[str, Any]:
        """Generate chat completion"""
        payload = {
            "model": options.get("model", "gpt-4o-mini"),
            "messages": messages,
            "temperature": options.get("temperature", 0.7),
            "max_tokens": options.get("max_tokens", 1500),
            "stream": options.get("stream", False),
            **{k: v for k, v in options.items() 
               if k not in ["model", "temperature", "max_tokens", "stream"]}
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            f"{self.base_url}/chat/completions",
            headers=headers,
            json=payload,
            stream=payload.get("stream", False)
        )
        response.raise_for_status()
        
        if payload.get("stream"):
            return self._handle_streaming_response(response)
        
        return response.json()
    
    def _handle_streaming_response(self, response) -> Generator[Dict, None, None]:
        """Handle streaming response from API"""
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith('data: '):
                    data = line_str[6:]
                    if data == '[DONE]':
                        break
                    try:
                        yield json.loads(data)
                    except json.JSONDecodeError:
                        continue
    
    def generate_with_functions(self, prompt: str, functions: List[Dict], **options) -> Dict[str, Any]:
        """Generate response with function calling capability"""
        messages = [{"role": "user", "content": prompt}]
        
        return self.chat_completion(
            messages,
            functions=functions,
            function_call="auto",
            **options
        )
    
    def analyze_image(self, prompt: str, image_url: str, **options) -> Dict[str, Any]:
        """Analyze image with vision-capable model"""
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": image_url}}
                ]
            }
        ]
        
        return self.chat_completion(
            messages,
            model="gpt-4o",
            **options
        )
    
    def conversation_with_context(self, conversation: List[Dict], 
                                system_prompt: str, **options) -> Dict[str, Any]:
        """Continue conversation with system context"""
        messages = [
            {"role": "system", "content": system_prompt},
            *conversation
        ]
        
        return self.chat_completion(messages, **options)

# Usage examples
def main():
    llm = PiAPILLM("your_api_key")
    
    # Basic completion
    try:
        response = llm.chat_completion([
            {
                "role": "user", 
                "content": "Explain the benefits of microservices architecture."
            }
        ], model="gpt-4o-mini", temperature=0.3)
        
        print(response["choices"][0]["message"]["content"])
        
    except Exception as e:
        print(f"Error: {e}")
    
    # Function calling example
    weather_function = {
        "name": "get_weather",
        "description": "Get current weather for a location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "City name"},
                "units": {"type": "string", "enum": ["celsius", "fahrenheit"]}
            },
            "required": ["location"]
        }
    }
    
    try:
        response = llm.generate_with_functions(
            "What's the weather like in Tokyo?",
            [weather_function],
            model="gpt-4o"
        )
        
        if response["choices"][0]["message"].get("function_call"):
            function_call = response["choices"][0]["message"]["function_call"]
            print(f"Function called: {function_call['name']}")
            print(f"Arguments: {function_call['arguments']}")
            
    except Exception as e:
        print(f"Function calling error: {e}")
    
    # Streaming example
    try:
        stream = llm.chat_completion([
            {
                "role": "user",
                "content": "Write a comprehensive guide to API design best practices."
            }
        ], model="claude-3-7-sonnet-20250219", stream=True, max_tokens=2000)
        
        for chunk in stream:
            if chunk["choices"][0]["delta"].get("content"):
                print(chunk["choices"][0]["delta"]["content"], end="")
                
    except Exception as e:
        print(f"Streaming error: {e}")

if __name__ == "__main__":
    main()
```

## Workflow Examples

### Multi-Step Analysis Pipeline
```javascript
async function comprehensiveAnalysis(topic) {
  // Step 1: Research outline
  const outline = await llm.chatCompletion([
    {
      role: 'user',
      content: `Create a comprehensive research outline for the topic: "${topic}". Include 5-7 main sections with subsections.`
    }
  ], {
    model: 'gpt-4o',
    temperature: 0.3
  });
  
  // Step 2: Detailed analysis for each section
  const outlineContent = outline.choices[0].message.content;
  const detailedAnalysis = await llm.chatCompletion([
    {
      role: 'system',
      content: 'You are a expert researcher and analyst. Provide detailed, well-sourced analysis.'
    },
    {
      role: 'user',
      content: `Based on this outline:\n\n${outlineContent}\n\nWrite a detailed analysis of the first section, including current trends, challenges, and future implications.`
    }
  ], {
    model: 'claude-3-7-sonnet-20250219',
    maxTokens: 2000
  });
  
  // Step 3: Generate executive summary
  const summary = await llm.chatCompletion([
    {
      role: 'user',
      content: `Create an executive summary (300-400 words) based on this analysis:\n\n${detailedAnalysis.choices[0].message.content}`
    }
  ], {
    model: 'gpt-4o-mini',
    temperature: 0.2
  });
  
  return {
    outline: outlineContent,
    analysis: detailedAnalysis.choices[0].message.content,
    summary: summary.choices[0].message.content
  };
}
```

### Code Review Assistant
```javascript
async function codeReviewWorkflow(codeSnippet, language) {
  // Parallel analysis for efficiency
  const [securityReview, performanceReview, bestPracticesReview] = await Promise.all([
    // Security analysis
    llm.chatCompletion([
      {
        role: 'system',
        content: 'You are a cybersecurity expert. Analyze code for security vulnerabilities.'
      },
      {
        role: 'user',
        content: `Review this ${language} code for security issues:\n\n\`\`\`${language}\n${codeSnippet}\n\`\`\``
      }
    ], { model: 'gpt-4o', temperature: 0.1 }),
    
    // Performance analysis  
    llm.chatCompletion([
      {
        role: 'system',
        content: 'You are a performance optimization expert. Focus on efficiency and scalability.'
      },
      {
        role: 'user',
        content: `Analyze this ${language} code for performance improvements:\n\n\`\`\`${language}\n${codeSnippet}\n\`\`\``
      }
    ], { model: 'gpt-4.1', temperature: 0.1 }),
    
    // Best practices review
    llm.chatCompletion([
      {
        role: 'system',
        content: 'You are a senior developer focused on code quality and best practices.'
      },
      {
        role: 'user',
        content: `Review this ${language} code for adherence to best practices:\n\n\`\`\`${language}\n${codeSnippet}\n\`\`\``
      }
    ], { model: 'claude-3-7-sonnet-20250219', temperature: 0.1 })
  ]);
  
  // Compile comprehensive review
  const finalReview = await llm.chatCompletion([
    {
      role: 'system',
      content: 'Synthesize multiple code reviews into a single, actionable report.'
    },
    {
      role: 'user',
      content: `Combine these three code reviews into a prioritized action plan:\n\nSecurity Review:\n${securityReview.choices[0].message.content}\n\nPerformance Review:\n${performanceReview.choices[0].message.content}\n\nBest Practices Review:\n${bestPracticesReview.choices[0].message.content}`
    }
  ], { model: 'gpt-4o', temperature: 0.2 });
  
  return finalReview.choices[0].message.content;
}
```

## Error Handling & Best Practices

### Robust Error Handling
```javascript
class PiAPIErrorHandler {
  static async withRetry(apiCall, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        console.warn(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff with jitter
        const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  static handleAPIError(error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 401:
          throw new Error('Invalid API key. Please check your authentication.');
        case 429:
          throw new Error('Rate limit exceeded. Please slow down your requests.');
        case 400:
          throw new Error(`Bad request: ${data.error?.message || 'Invalid parameters'}`);
        case 503:
          throw new Error('Service temporarily unavailable. Please try again later.');
        default:
          throw new Error(`API error ${status}: ${data.error?.message || 'Unknown error'}`);
      }
    }
    
    throw error;
  }
}

// Usage with error handling
async function safeAPICall() {
  try {
    return await PiAPIErrorHandler.withRetry(async () => {
      return await llm.chatCompletion([
        { role: 'user', content: 'Hello, how are you?' }
      ]);
    });
  } catch (error) {
    PiAPIErrorHandler.handleAPIError(error);
  }
}
```

### Cost Optimization
```javascript
class CostOptimizer {
  static selectModelByBudget(task, maxCostPer1KTokens) {
    const costMatrix = {
      'gpt-4o-mini': 0.0001125,      // Input cost
      'gpt-4o': 0.001875,
      'claude-3-7-sonnet': 0.00225,
      'gpt-4.1': 0.002,             // Estimated
    };
    
    // Filter models within budget
    const affordableModels = Object.entries(costMatrix)
      .filter(([model, cost]) => cost <= maxCostPer1KTokens)
      .sort((a, b) => b[1] - a[1]); // Highest quality within budget
    
    if (affordableModels.length === 0) {
      throw new Error('No models available within budget');
    }
    
    return affordableModels[0][0];
  }
  
  static estimateCost(inputTokens, outputTokens, model) {
    const pricing = {
      'gpt-4o-mini': { input: 0.0001125, output: 0.00045 },
      'gpt-4o': { input: 0.001875, output: 0.0075 },
      'claude-3-7-sonnet': { input: 0.00225, output: 0.01125 }
    };
    
    const modelPricing = pricing[model];
    if (!modelPricing) return null;
    
    return (inputTokens * modelPricing.input) + (outputTokens * modelPricing.output);
  }
}
```

## Rate Limiting & Performance

### Rate Limit Management
```javascript
class RateLimiter {
  constructor(requestsPerMinute = 60) {
    this.requests = [];
    this.limit = requestsPerMinute;
  }
  
  async waitForAvailability() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Remove requests older than 1 minute
    this.requests = this.requests.filter(time => time > oneMinuteAgo);
    
    if (this.requests.length >= this.limit) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = (oldestRequest + 60000) - now;
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.waitForAvailability();
      }
    }
    
    this.requests.push(now);
  }
}

const rateLimiter = new RateLimiter(50); // 50 requests per minute

async function rateLimitedAPICall(messages, options) {
  await rateLimiter.waitForAvailability();
  return llm.chatCompletion(messages, options);
}
```

## Support Resources

- **Discord Community**: [Join PiAPI Discord](https://discord.gg/piapi)
- **Documentation**: [https://piapi.ai/docs/llm-api](https://piapi.ai/docs/llm-api)
- **Model Comparison**: [https://piapi.ai/models](https://piapi.ai/models)
- **Pricing Calculator**: [https://piapi.ai/pricing](https://piapi.ai/pricing)
- **Email Support**: contact@piapi.ai

## Changelog

- **Claude 4 Support**: Added Claude 4 Opus and Sonnet models
- **GPT-4.1 Series**: Latest OpenAI models with extended context
- **o3-mini Integration**: Advanced reasoning capabilities
- **Vision Enhancements**: Improved image analysis features
- **Function Calling**: Enhanced tool integration capabilities
- **Streaming Optimization**: Faster response generation

---

*For more examples and advanced usage, see the [PiAPI LLM Documentation](https://piapi.ai/docs/llm-api)*

*Last Updated: January 2025* 