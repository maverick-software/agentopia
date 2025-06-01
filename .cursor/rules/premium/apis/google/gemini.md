# Google Gemini API - Text Generation Documentation

## Overview

The Google Gemini API provides access to Google's most advanced large language models for text generation, reasoning, and multimodal understanding. Gemini models excel at complex reasoning, code generation, creative writing, and multi-turn conversations.

## Available Models

### Gemini 2.5 Series

#### Gemini 2.5 Flash (Recommended)
- **Capabilities**: Fast inference, thinking mode, multimodal understanding
- **Context Window**: 1M tokens
- **Use Cases**: General text generation, code completion, data analysis
- **Pricing**: $0.15/1M input tokens, $0.60/1M output tokens (thinking: $3.50)

#### Gemini 2.5 Pro
- **Capabilities**: Advanced reasoning, complex problem solving
- **Context Window**: 1M tokens
- **Use Cases**: Research, complex analysis, professional writing
- **Pricing**: $1.25/1M input tokens, $10.00/1M output tokens

### Gemini 2.0 Series

#### Gemini 2.0 Flash
- **Capabilities**: Balanced performance, agent-ready, multimodal
- **Context Window**: 1M tokens
- **Use Cases**: General purpose, agent applications, real-time chat
- **Pricing**: $0.10/1M input tokens, $0.40/1M output tokens

#### Gemini 2.0 Flash Lite
- **Capabilities**: Cost-effective, high-scale usage
- **Context Window**: Standard
- **Use Cases**: Simple tasks, batch processing, high-volume applications
- **Pricing**: $0.075/1M input tokens, $0.30/1M output tokens

### Gemini 1.5 Series

#### Gemini 1.5 Pro
- **Capabilities**: Highest intelligence, breakthrough context window
- **Context Window**: 2M tokens
- **Use Cases**: Long document analysis, complex reasoning
- **Pricing**: $1.25/1M input tokens, $5.00/1M output tokens

#### Gemini 1.5 Flash
- **Capabilities**: Fast multimodal processing
- **Context Window**: 1M tokens
- **Use Cases**: Repetitive tasks, real-time applications
- **Pricing**: $0.075/1M input tokens, $0.30/1M output tokens

## Authentication

### API Key Setup
```bash
# Environment variable
export GEMINI_API_KEY="your_api_key_here"

# Or in code
const API_KEY = "your_api_key_here";
```

### Base URL
```
https://generativelanguage.googleapis.com/v1beta/models/
```

## Basic Text Generation

### Simple Request
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: ${GEMINI_API_KEY}" \
  -d '{
    "contents": [
      {
        "parts": [
          {"text": "Write a short story about artificial intelligence."}
        ]
      }
    ]
  }' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
```

### Python Implementation
```python
import google.generativeai as genai

# Configure API key
genai.configure(api_key="your_api_key")

# Initialize model
model = genai.GenerativeModel('gemini-2.0-flash')

# Generate content
response = model.generate_content("Write a Python function to calculate fibonacci numbers")

print(response.text)
```

### Node.js Implementation
```javascript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("your_api_key");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

async function generateText() {
  const prompt = "Explain quantum computing in simple terms";
  const result = await model.generateContent(prompt);
  console.log(result.response.text());
}

generateText();
```

## Advanced Features

### Multi-turn Conversations
```python
import google.generativeai as genai

model = genai.GenerativeModel('gemini-2.0-flash')
chat = model.start_chat(history=[])

# First message
response1 = chat.send_message("Hello! I'm working on a Python project.")
print("AI:", response1.text)

# Follow-up message
response2 = chat.send_message("Can you help me with error handling?")
print("AI:", response2.text)

# Continue conversation
response3 = chat.send_message("Show me an example with try-catch blocks.")
print("AI:", response3.text)
```

### System Instructions
```python
model = genai.GenerativeModel(
    model_name='gemini-2.0-flash',
    system_instruction="You are a helpful coding assistant. Always provide clean, well-commented code examples."
)

response = model.generate_content("Create a REST API endpoint in Python")
print(response.text)
```

### Generation Configuration
```python
generation_config = genai.types.GenerationConfig(
    candidate_count=1,
    stop_sequences=['x'],
    max_output_tokens=1000,
    temperature=0.7,
    top_p=0.8,
    top_k=10
)

model = genai.GenerativeModel('gemini-2.0-flash')
response = model.generate_content(
    "Write creative poetry about technology",
    generation_config=generation_config
)
```

### Function Calling
```python
def get_weather(location: str) -> str:
    """Get weather information for a location."""
    # Implementation here
    return f"Weather in {location}: Sunny, 25°C"

# Define function schema
weather_function = genai.protos.FunctionDeclaration(
    name="get_weather",
    description="Get current weather for a location",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "location": genai.protos.Schema(type=genai.protos.Type.STRING)
        },
        required=["location"]
    )
)

# Create tool with function
weather_tool = genai.protos.Tool(
    function_declarations=[weather_function]
)

# Use in model
model = genai.GenerativeModel('gemini-2.0-flash', tools=[weather_tool])
response = model.generate_content("What's the weather like in London?")

# Handle function calls
for part in response.parts:
    if fn := part.function_call:
        args = {key: val for key, val in fn.args.items()}
        result = get_weather(**args)
        print(f"Function result: {result}")
```

### Streaming Responses
```python
model = genai.GenerativeModel('gemini-2.0-flash')
response = model.generate_content(
    "Write a long essay about the future of AI",
    stream=True
)

for chunk in response:
    print(chunk.text, end='', flush=True)
```

### Thinking Mode (Gemini 2.5 Flash)
```python
model = genai.GenerativeModel('gemini-2.5-flash')

# Enable thinking mode for complex reasoning
response = model.generate_content(
    "Solve this complex math problem step by step: If a train travels at 60 mph for 2 hours, then 80 mph for 1.5 hours, what's the average speed?",
    generation_config=genai.types.GenerationConfig(
        response_modalities=["TEXT"],
        response_schema={"type": "object", "properties": {"thinking": {"type": "string"}, "answer": {"type": "string"}}}
    )
)

print("Thinking process:", response.candidates[0].content.parts[0].text)
```

## Content Safety

### Safety Settings
```python
from google.generativeai.types import HarmCategory, HarmBlockThreshold

safety_settings = {
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
}

model = genai.GenerativeModel('gemini-2.0-flash')
response = model.generate_content(
    "Write a story about overcoming challenges",
    safety_settings=safety_settings
)
```

### Checking Safety Ratings
```python
response = model.generate_content("Tell me about safety in AI")

for candidate in response.candidates:
    print(f"Finish reason: {candidate.finish_reason}")
    for rating in candidate.safety_ratings:
        print(f"Category: {rating.category}")
        print(f"Probability: {rating.probability}")
        print(f"Blocked: {rating.blocked}")
```

## Context Caching

### Creating Cached Content
```python
# For long contexts, cache frequently used content
document = """
[Long document content here...]
"""

# Create cached content
cached_content = genai.caching.CachedContent.create(
    model='gemini-2.0-flash',
    display_name='large_document',
    system_instruction="You are an expert analyst.",
    contents=[document],
    ttl=datetime.timedelta(hours=1)
)

# Use cached content
model = genai.GenerativeModel.from_cached_content(cached_content)
response = model.generate_content("Summarize the key points")
```

### Managing Cache
```python
# List cached content
cached_contents = genai.caching.CachedContent.list()
for content in cached_contents:
    print(f"Name: {content.name}")
    print(f"Display Name: {content.display_name}")
    print(f"Usage: {content.usage_metadata}")

# Update TTL
cached_content.update(ttl=datetime.timedelta(hours=2))

# Delete cached content
cached_content.delete()
```

## Token Management

### Counting Tokens
```python
model = genai.GenerativeModel('gemini-2.0-flash')

# Count tokens in prompt
prompt = "Write a comprehensive guide about machine learning"
token_count = model.count_tokens(prompt)
print(f"Input tokens: {token_count.total_tokens}")

# Count tokens with conversation history
chat = model.start_chat(history=[
    {"role": "user", "parts": ["Hello"]},
    {"role": "model", "parts": ["Hi there! How can I help you today?"]}
])

token_count = model.count_tokens(chat.history)
print(f"Conversation tokens: {token_count.total_tokens}")
```

### Token Optimization
```python
def optimize_prompt(prompt: str, max_tokens: int = 1000) -> str:
    """Optimize prompt to fit within token limit."""
    model = genai.GenerativeModel('gemini-2.0-flash')
    
    token_count = model.count_tokens(prompt)
    if token_count.total_tokens <= max_tokens:
        return prompt
    
    # Truncate or summarize if too long
    words = prompt.split()
    target_words = int(len(words) * (max_tokens / token_count.total_tokens))
    return " ".join(words[:target_words])
```

## Multimodal Capabilities

### Text with Images
```python
import PIL.Image

# Load image
image = PIL.Image.open("path/to/image.jpg")

model = genai.GenerativeModel('gemini-2.0-flash')
response = model.generate_content([
    "Analyze this image and describe what you see",
    image
])

print(response.text)
```

### Text with Audio
```python
# Upload audio file
audio_file = genai.upload_file("path/to/audio.mp3")

response = model.generate_content([
    "Transcribe this audio and summarize the key points",
    audio_file
])

print(response.text)
```

### Text with Video
```python
# Upload video file
video_file = genai.upload_file("path/to/video.mp4")

response = model.generate_content([
    "Describe what happens in this video",
    video_file
])

print(response.text)
```

## Batch Processing

### Batch Text Generation
```python
import asyncio

async def generate_batch(prompts: list[str]):
    model = genai.GenerativeModel('gemini-2.0-flash')
    
    tasks = []
    for prompt in prompts:
        task = asyncio.create_task(
            model.generate_content_async(prompt)
        )
        tasks.append(task)
    
    responses = await asyncio.gather(*tasks)
    return [response.text for response in responses]

# Usage
prompts = [
    "Write a haiku about spring",
    "Explain photosynthesis",
    "Create a python function for sorting"
]

results = asyncio.run(generate_batch(prompts))
for i, result in enumerate(results):
    print(f"Result {i+1}: {result}\n")
```

## Code Generation

### Python Code Generation
```python
model = genai.GenerativeModel('gemini-2.0-flash')

# Code generation with specific requirements
prompt = """
Create a Python class for a simple bank account with the following features:
- Initialize with account holder name and initial balance
- Methods to deposit and withdraw money
- Method to check balance
- Method to get account statement
- Include proper error handling
"""

response = model.generate_content(prompt)
print(response.text)
```

### Code Review and Debugging
```python
code_to_review = """
def calculate_average(numbers):
    total = 0
    for num in numbers:
        total += num
    return total / len(numbers)
"""

prompt = f"""
Review this Python code and suggest improvements:

```python
{code_to_review}
```

Focus on:
1. Error handling
2. Edge cases
3. Code efficiency
4. Best practices
"""

response = model.generate_content(prompt)
print(response.text)
```

## Advanced Use Cases

### Creative Writing Assistant
```python
def creative_writing_assistant(genre: str, theme: str, length: str):
    prompt = f"""
    You are a creative writing assistant. Write a {length} {genre} story with the theme of {theme}.
    
    Requirements:
    - Engaging opening
    - Well-developed characters
    - Clear narrative structure
    - Vivid descriptions
    - Satisfying conclusion
    
    Theme: {theme}
    Genre: {genre}
    Length: {length}
    """
    
    model = genai.GenerativeModel('gemini-2.0-flash')
    response = model.generate_content(prompt)
    return response.text

# Usage
story = creative_writing_assistant("science fiction", "time travel", "short story")
print(story)
```

### Research Assistant
```python
def research_assistant(topic: str, depth: str = "comprehensive"):
    prompt = f"""
    Conduct a {depth} research analysis on: {topic}
    
    Please provide:
    1. Executive summary
    2. Key findings
    3. Current trends
    4. Future implications
    5. Recommendations
    6. Sources and references
    
    Structure your response with clear headings and bullet points.
    """
    
    model = genai.GenerativeModel('gemini-2.0-flash')
    response = model.generate_content(prompt)
    return response.text

# Usage
research = research_assistant("artificial intelligence in healthcare")
print(research)
```

### Data Analysis Helper
```python
def analyze_data_description(data_description: str):
    prompt = f"""
    Based on this data description, provide a comprehensive analysis plan:
    
    Data: {data_description}
    
    Please provide:
    1. Suggested analysis approach
    2. Key metrics to calculate
    3. Visualization recommendations
    4. Potential insights to look for
    5. Python code examples for analysis
    6. Statistical tests to consider
    """
    
    model = genai.GenerativeModel('gemini-2.0-flash')
    response = model.generate_content(prompt)
    return response.text

# Usage
analysis_plan = analyze_data_description("Customer purchase data with demographics, purchase history, and satisfaction scores")
print(analysis_plan)
```

## Error Handling

### Common Error Patterns
```python
import google.generativeai as genai
from google.generativeai.types import BlockedPromptException, StopCandidateException

def safe_generate_content(prompt: str, max_retries: int = 3):
    model = genai.GenerativeModel('gemini-2.0-flash')
    
    for attempt in range(max_retries):
        try:
            response = model.generate_content(prompt)
            return response.text
            
        except BlockedPromptException:
            print("Prompt was blocked by safety filters")
            return None
            
        except StopCandidateException:
            print("Response was stopped due to safety concerns")
            return None
            
        except Exception as e:
            if attempt == max_retries - 1:
                print(f"Failed after {max_retries} attempts: {e}")
                return None
            else:
                print(f"Attempt {attempt + 1} failed, retrying: {e}")
                time.sleep(2 ** attempt)  # Exponential backoff
    
    return None
```

### Rate Limit Handling
```python
import time
from datetime import datetime, timedelta

class RateLimiter:
    def __init__(self, max_requests_per_minute: int = 15):
        self.max_requests = max_requests_per_minute
        self.requests = []
    
    def wait_if_needed(self):
        now = datetime.now()
        # Remove requests older than 1 minute
        self.requests = [req_time for req_time in self.requests 
                        if now - req_time < timedelta(minutes=1)]
        
        if len(self.requests) >= self.max_requests:
            sleep_time = 60 - (now - self.requests[0]).total_seconds()
            if sleep_time > 0:
                print(f"Rate limit reached, waiting {sleep_time:.2f} seconds")
                time.sleep(sleep_time)
        
        self.requests.append(now)

# Usage
rate_limiter = RateLimiter()
model = genai.GenerativeModel('gemini-2.0-flash')

for prompt in prompts:
    rate_limiter.wait_if_needed()
    response = model.generate_content(prompt)
    print(response.text)
```

## Performance Optimization

### Caching Strategies
```python
from functools import lru_cache
import hashlib

@lru_cache(maxsize=128)
def cached_generate_content(prompt: str, model_name: str = 'gemini-2.0-flash'):
    """Cache responses for identical prompts."""
    model = genai.GenerativeModel(model_name)
    response = model.generate_content(prompt)
    return response.text

def persistent_cache_generate(prompt: str, cache_file: str = "cache.json"):
    """Persistent cache using file storage."""
    import json
    import os
    
    # Create hash of prompt for cache key
    cache_key = hashlib.md5(prompt.encode()).hexdigest()
    
    # Load existing cache
    cache = {}
    if os.path.exists(cache_file):
        with open(cache_file, 'r') as f:
            cache = json.load(f)
    
    # Check if response is cached
    if cache_key in cache:
        return cache[cache_key]
    
    # Generate new response
    model = genai.GenerativeModel('gemini-2.0-flash')
    response = model.generate_content(prompt)
    
    # Store in cache
    cache[cache_key] = response.text
    with open(cache_file, 'w') as f:
        json.dump(cache, f)
    
    return response.text
```

### Parallel Processing
```python
import concurrent.futures
import threading

class GeminiProcessor:
    def __init__(self, model_name: str = 'gemini-2.0-flash', max_workers: int = 5):
        self.model_name = model_name
        self.max_workers = max_workers
        self.rate_limiter = threading.Semaphore(max_workers)
    
    def process_single(self, prompt: str) -> str:
        with self.rate_limiter:
            model = genai.GenerativeModel(self.model_name)
            response = model.generate_content(prompt)
            return response.text
    
    def process_batch(self, prompts: list[str]) -> list[str]:
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [executor.submit(self.process_single, prompt) for prompt in prompts]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        return results

# Usage
processor = GeminiProcessor()
prompts = ["Explain AI", "Write a poem", "Code a function"]
results = processor.process_batch(prompts)
```

## Monitoring and Analytics

### Usage Tracking
```python
import time
from datetime import datetime
from collections import defaultdict

class GeminiUsageTracker:
    def __init__(self):
        self.requests = []
        self.token_usage = defaultdict(int)
        self.errors = []
    
    def track_request(self, prompt: str, response: str, model: str):
        request_data = {
            'timestamp': datetime.now(),
            'model': model,
            'prompt_length': len(prompt),
            'response_length': len(response),
            'tokens_used': self._estimate_tokens(prompt + response)
        }
        self.requests.append(request_data)
        self.token_usage[model] += request_data['tokens_used']
    
    def track_error(self, error: Exception, prompt: str):
        error_data = {
            'timestamp': datetime.now(),
            'error_type': type(error).__name__,
            'error_message': str(error),
            'prompt_length': len(prompt)
        }
        self.errors.append(error_data)
    
    def _estimate_tokens(self, text: str) -> int:
        # Rough estimation: 4 characters per token
        return len(text) // 4
    
    def get_stats(self):
        return {
            'total_requests': len(self.requests),
            'total_tokens': sum(self.token_usage.values()),
            'tokens_by_model': dict(self.token_usage),
            'error_count': len(self.errors),
            'error_rate': len(self.errors) / max(len(self.requests), 1)
        }

# Usage
tracker = GeminiUsageTracker()
model = genai.GenerativeModel('gemini-2.0-flash')

try:
    prompt = "Explain machine learning"
    response = model.generate_content(prompt)
    tracker.track_request(prompt, response.text, 'gemini-2.0-flash')
except Exception as e:
    tracker.track_error(e, prompt)

print(tracker.get_stats())
```

## Best Practices

### 1. Prompt Engineering
```python
# Good: Specific, clear instructions
def create_effective_prompt(task: str, context: str, format: str):
    return f"""
    Task: {task}
    
    Context: {context}
    
    Requirements:
    - Be specific and accurate
    - Use proper formatting
    - Include examples where helpful
    
    Output format: {format}
    
    Please proceed:
    """

# Example usage
prompt = create_effective_prompt(
    task="Create a REST API endpoint",
    context="Python Flask application for user management",
    format="Python code with comments and error handling"
)
```

### 2. Model Selection Strategy
```python
def select_optimal_model(task_type: str, complexity: str, budget: str):
    """Select the best model based on requirements."""
    
    if budget == "low":
        if complexity == "simple":
            return "gemini-2.0-flash-lite"
        else:
            return "gemini-2.0-flash"
    
    elif complexity == "high" or task_type in ["research", "analysis"]:
        return "gemini-2.5-pro"
    
    elif task_type in ["code", "creative"]:
        return "gemini-2.5-flash"
    
    else:
        return "gemini-2.0-flash"

# Usage
model_name = select_optimal_model("code", "medium", "moderate")
model = genai.GenerativeModel(model_name)
```

### 3. Security Best Practices
```python
import os
import re

class SecureGeminiClient:
    def __init__(self):
        # Use environment variables for API keys
        self.api_key = os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash')
    
    def sanitize_input(self, prompt: str) -> str:
        """Sanitize user input before sending to API."""
        # Remove potential injection patterns
        prompt = re.sub(r'[^\w\s\.\,\?\!]', '', prompt)
        
        # Limit length
        if len(prompt) > 10000:
            prompt = prompt[:10000]
        
        return prompt
    
    def safe_generate(self, prompt: str) -> str:
        """Generate content with safety checks."""
        sanitized_prompt = self.sanitize_input(prompt)
        
        try:
            response = self.model.generate_content(sanitized_prompt)
            return response.text
        except Exception as e:
            # Log error securely (don't expose API key)
            print(f"Generation failed: {type(e).__name__}")
            return "I apologize, but I couldn't generate a response to that request."

# Usage
client = SecureGeminiClient()
response = client.safe_generate("Tell me about Python programming")
```

This comprehensive documentation covers all aspects of using the Google Gemini API for text generation, from basic usage to advanced features and best practices. 