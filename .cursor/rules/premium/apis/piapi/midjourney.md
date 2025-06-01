# PiAPI Midjourney API - Standard Operating Procedure

## Overview

PiAPI provides the most stable and comprehensive unofficial Midjourney API, supporting all Midjourney features including V7, V6.1, style reference (--sref), character reference (--cref), and advanced features like inpainting and outpainting.

**Base Endpoint**: `https://api.piapi.ai/api/v1/task`
**Model**: `midjourney`
**Official Docs**: [https://piapi.ai/docs/midjourney-api](https://piapi.ai/docs/midjourney-api)

## Pricing (Pay-as-you-go)

| Mode | Price per Task |
|------|----------------|
| Relax Mode | $0.015 |
| Fast Mode | $0.045 |
| Turbo Mode | $0.10 |

**Host-your-account**: $8/seat/month

## Authentication

```bash
curl -H "x-api-key: YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     https://api.piapi.ai/api/v1/task
```

## Common Request Structure

```json
{
  "model": "midjourney",
  "task_type": "operation_type",
  "input": {
    // Operation-specific parameters
  },
  "config": {
    "service_mode": "public|private",
    "webhook_config": {
      "endpoint": "https://your-webhook.com",
      "secret": "optional"
    }
  }
}
```

## Supported Operations

### 1. Imagine (Text-to-Image)

Generate 4 images from a text prompt.

**Task Type**: `imagine`

```json
{
  "model": "midjourney",
  "task_type": "imagine",
  "input": {
    "prompt": "a majestic lion in a savanna at sunset --v 7 --style raw",
    "aspect_ratio": "16:9",
    "mode": "fast",
    "version": "7"
  },
  "config": {
    "service_mode": "public"
  }
}
```

**Parameters**:
- `prompt` (required): Text description with optional parameters
- `aspect_ratio`: `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, etc.
- `mode`: `relax`, `fast`, `turbo`
- `version`: `5.2`, `6`, `6.1`, `7`
- `chaos`: 0-100 (randomness level)
- `quality`: 0.25, 0.5, 1, 2 (generation quality)
- `seed`: Integer for reproducible results
- `stylize`: 0-1000 (how artistic vs literal)

**Example Response**:
```json
{
  "code": 200,
  "data": {
    "task_id": "abc123-456-789",
    "status": "completed",
    "output": {
      "image_url": "https://cdn.midjourney.com/...",
      "image_urls": [
        "https://cdn.midjourney.com/grid1.png",
        "https://cdn.midjourney.com/grid2.png",
        "https://cdn.midjourney.com/grid3.png", 
        "https://cdn.midjourney.com/grid4.png"
      ],
      "seed": 1234567890,
      "content": "a majestic lion in a savanna at sunset"
    }
  }
}
```

### 2. Upscale

Enhance one of the 4 generated images.

**Task Type**: `upscale`

```json
{
  "model": "midjourney",
  "task_type": "upscale",
  "input": {
    "origin_task_id": "parent_task_id",
    "index": 1
  }
}
```

**Parameters**:
- `origin_task_id`: Task ID from imagine operation
- `index`: 1-4 (which image to upscale)

### 3. Variation

Create variations of a selected image.

**Task Type**: `variation`

```json
{
  "model": "midjourney",
  "task_type": "variation",
  "input": {
    "origin_task_id": "parent_task_id",
    "index": 2
  }
}
```

### 4. Reroll

Generate 4 new images with the same prompt.

**Task Type**: `reroll`

```json
{
  "model": "midjourney",
  "task_type": "reroll",
  "input": {
    "origin_task_id": "parent_task_id"
  }
}
```

### 5. Describe

Generate text descriptions of an uploaded image.

**Task Type**: `describe`

```json
{
  "model": "midjourney",
  "task_type": "describe",
  "input": {
    "image_url": "https://example.com/image.jpg"
  }
}
```

**Response**:
```json
{
  "output": {
    "descriptions": [
      "a realistic portrait of a woman with flowing hair",
      "professional headshot in natural lighting",
      "artistic photography with soft focus background",
      "contemporary portrait with warm tones"
    ]
  }
}
```

### 6. Blend

Combine 2-5 images into one.

**Task Type**: `blend`

```json
{
  "model": "midjourney",
  "task_type": "blend",
  "input": {
    "image_urls": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ],
    "aspect_ratio": "1:1"
  }
}
```

### 7. Inpaint (Vary Region)

Edit specific regions of an image.

**Task Type**: `inpaint`

```json
{
  "model": "midjourney",
  "task_type": "inpaint",
  "input": {
    "origin_task_id": "parent_task_id",
    "mask": "base64_mask_data",
    "prompt": "replace with a red sports car"
  }
}
```

### 8. Outpaint (Zoom Out)

Extend the image beyond original boundaries.

**Task Type**: `outpaint`

```json
{
  "model": "midjourney",
  "task_type": "outpaint",
  "input": {
    "origin_task_id": "parent_task_id",
    "zoom_ratio": 2.0,
    "prompt": "expand to show more of the landscape"
  }
}
```

### 9. Pan

Expand image in a specific direction.

**Task Type**: `pan`

```json
{
  "model": "midjourney",
  "task_type": "pan",
  "input": {
    "origin_task_id": "parent_task_id",
    "direction": "left"
  }
}
```

**Directions**: `left`, `right`, `up`, `down`

### 10. Seed

Get the seed value from an existing image.

**Task Type**: `seed`

```json
{
  "model": "midjourney",
  "task_type": "seed",
  "input": {
    "origin_task_id": "parent_task_id"
  }
}
```

## Advanced Features

### Style Reference (--sref)

Use an image as style reference:

```json
{
  "input": {
    "prompt": "a modern city --sref https://example.com/style.jpg",
    "sref_weight": 100
  }
}
```

### Character Reference (--cref)

Maintain character consistency:

```json
{
  "input": {
    "prompt": "the character running through a forest --cref https://example.com/character.jpg",
    "cref_weight": 100
  }
}
```

### Quality and Style Parameters

```json
{
  "input": {
    "prompt": "a beautiful landscape --v 7 --style raw --quality 2 --chaos 50 --stylize 750"
  }
}
```

## Error Handling

### Common Errors

- **Prompt too long**: Max 2500 characters
- **Invalid image URL**: Must be publicly accessible
- **Inappropriate content**: Violates Midjourney guidelines
- **Rate limit exceeded**: Too many concurrent requests

### Error Response Example

```json
{
  "code": 400,
  "data": {
    "error": {
      "code": 1100,
      "message": "Prompt contains inappropriate content",
      "detail": "Please revise your prompt to comply with guidelines"
    }
  }
}
```

## Best Practices

### 1. Prompt Engineering

**Good Practice**:
```
"professional headshot of a business executive, soft lighting, neutral background, high quality, photorealistic --v 7 --style raw"
```

**Avoid**:
```
"pic of person"
```

### 2. Parameter Optimization

- Use `--v 7` for latest features
- Use `--style raw` for photorealistic results
- Set `--quality 2` for high-detail images
- Use `--ar 16:9` for landscape videos

### 3. Batch Processing

```javascript
async function generateMultipleImages(prompts) {
  const tasks = await Promise.all(
    prompts.map(prompt => 
      createMidjourneyTask({
        prompt,
        mode: 'fast'
      })
    )
  );
  
  return tasks.map(task => task.task_id);
}
```

### 4. Webhook Integration

```javascript
app.post('/webhook/midjourney', (req, res) => {
  const { task_id, status, output } = req.body;
  
  if (status === 'completed') {
    // Process completed image
    handleCompletedImage(task_id, output);
  } else if (status === 'failed') {
    // Handle failure
    handleFailedTask(task_id);
  }
  
  res.status(200).send('OK');
});
```

## Task Workflow Examples

### Complete Image Generation Workflow

```javascript
// 1. Generate initial images
const imagineTask = await createTask({
  model: 'midjourney',
  task_type: 'imagine',
  input: {
    prompt: 'a futuristic city at night --v 7 --ar 16:9',
    mode: 'fast'
  }
});

// 2. Wait for completion
const imagineResult = await pollTask(imagineTask.task_id);

// 3. Upscale favorite image
const upscaleTask = await createTask({
  model: 'midjourney', 
  task_type: 'upscale',
  input: {
    origin_task_id: imagineTask.task_id,
    index: 2
  }
});

// 4. Create variations
const variationTask = await createTask({
  model: 'midjourney',
  task_type: 'variation', 
  input: {
    origin_task_id: imagineTask.task_id,
    index: 3
  }
});
```

## Rate Limits & Concurrency

### Free Plan
- 3 concurrent jobs
- Basic features only

### Creator Plan ($8/month)
- 10 concurrent jobs  
- Advanced features
- Priority processing

### Pro Plan ($50/month)
- 30 concurrent jobs
- All premium features
- Bulk generation discounts

## File Requirements

### Input Images
- **Formats**: JPG, PNG, GIF, WebP
- **Max size**: 25MB
- **Min dimensions**: 256x256px
- **Max dimensions**: 4096x4096px
- **URL requirement**: Must be publicly accessible

### Output Images
- **Format**: PNG
- **Resolution**: Up to 2048x2048px (V7)
- **Expiration**: URLs expire after 7 days
- **Download**: Save important images immediately

## Troubleshooting

### Common Issues

1. **Task Stuck in Processing**
   - Check Midjourney service status
   - Retry after 5-10 minutes
   - Contact support if persists

2. **Image URLs Not Loading**
   - URLs expire after 7 days
   - Re-fetch from task if needed
   - Download and store locally

3. **Quality Issues**
   - Use higher quality settings
   - Try different style parameters
   - Optimize prompt structure

### Debug Information

```javascript
// Enable detailed logging
const task = await createTask({
  model: 'midjourney',
  task_type: 'imagine',
  input: { /* ... */ },
  config: {
    debug: true // Get additional metadata
  }
});
```

## Integration Libraries

### Node.js Example

```javascript
class MidjourneyAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.piapi.ai/api/v1';
  }
  
  async imagine(prompt, options = {}) {
    const response = await fetch(`${this.baseURL}/task`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'midjourney',
        task_type: 'imagine',
        input: {
          prompt,
          mode: options.mode || 'fast',
          aspect_ratio: options.aspectRatio,
          ...options
        }
      })
    });
    
    return response.json();
  }
  
  async getTask(taskId) {
    const response = await fetch(`${this.baseURL}/task/${taskId}`, {
      headers: { 'x-api-key': this.apiKey }
    });
    
    return response.json();
  }
}
```

### Python Example

```python
import requests
import time

class MidjourneyAPI:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.piapi.ai/api/v1'
        
    def imagine(self, prompt, **options):
        headers = {
            'x-api-key': self.api_key,
            'Content-Type': 'application/json'
        }
        
        data = {
            'model': 'midjourney',
            'task_type': 'imagine',
            'input': {
                'prompt': prompt,
                'mode': options.get('mode', 'fast'),
                **options
            }
        }
        
        response = requests.post(
            f'{self.base_url}/task',
            headers=headers,
            json=data
        )
        
        return response.json()
    
    def wait_for_completion(self, task_id, timeout=300):
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            task = self.get_task(task_id)
            
            if task['data']['status'] == 'completed':
                return task
            elif task['data']['status'] == 'failed':
                raise Exception(f"Task failed: {task['data']['error']}")
                
            time.sleep(10)
            
        raise TimeoutError(f"Task {task_id} did not complete within {timeout}s")
```

## Performance Optimization

### Concurrent Processing

```javascript
// Process multiple prompts concurrently
async function batchGenerate(prompts) {
  const BATCH_SIZE = 10; // Respect rate limits
  const results = [];
  
  for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
    const batch = prompts.slice(i, i + BATCH_SIZE);
    
    const batchTasks = await Promise.all(
      batch.map(prompt => midjourney.imagine(prompt))
    );
    
    results.push(...batchTasks);
    
    // Wait between batches to avoid rate limiting
    if (i + BATCH_SIZE < prompts.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return results;
}
```

### Caching Strategy

```javascript
// Cache completed tasks to avoid re-processing
const taskCache = new Map();

async function getCachedTask(taskId) {
  if (taskCache.has(taskId)) {
    return taskCache.get(taskId);
  }
  
  const task = await midjourney.getTask(taskId);
  
  if (task.data.status === 'completed') {
    taskCache.set(taskId, task);
  }
  
  return task;
}
```

---

*For more examples and advanced usage, see the [PiAPI Midjourney Documentation](https://piapi.ai/docs/midjourney-api)*

*Last Updated: January 2025* 