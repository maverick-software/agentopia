# PiAPI Flux Image Generation API - Standard Operating Procedure (SOP)

## Overview

PiAPI provides access to the powerful FLUX.1 suite of image generation models developed by Black Forest Labs. These state-of-the-art text-to-image models offer exceptional quality, prompt adherence, and commercial use capabilities through PiAPI's unified API platform.

**Official PiAPI Flux Documentation**: [https://piapi.ai/flux-api](https://piapi.ai/flux-api)

**API Base URL**: `https://api.piapi.ai/api/v1/`

## Key Features

### Available Models
- **Flux-Dev**: High-quality model for development and non-commercial use
- **Flux-Schnell**: Fast generation model optimized for speed
- **Flux-Pro**: Professional-grade model for commercial applications
- **Flux-Dev-Advanced**: Enhanced capabilities with LoRA and ControlNet support

### Generation Capabilities
- **Text-to-Image**: Generate images from detailed text prompts
- **Image-to-Image**: Transform existing images based on text guidance
- **LoRA Integration**: Custom style and character consistency
- **ControlNet Support**: Precise control over composition and structure
- **Redux Variation**: Advanced image variations and modifications
- **Fill/Inpaint**: Smart image completion and editing
- **Outpaint**: Extend images beyond original boundaries

### Technical Specifications
- **Output Resolution**: Up to 2048x2048 pixels
- **Aspect Ratios**: 16:9, 9:16, 1:1, 4:3, 3:4, and custom dimensions
- **Processing Speed**: 15-45 seconds depending on model and complexity
- **Batch Generation**: Multiple images per request (model dependent)
- **Commercial License**: Flux-Schnell and Flux-Pro available for commercial use

## Pricing Structure

### Pay-as-you-go (PAYG) Options

| Model | Price per Image | Commercial Use | Speed |
|-------|----------------|----------------|-------|
| **Flux-Schnell** | $0.002 | ✅ Yes | Fastest (15-20s) |
| **Flux-Dev** | $0.015 | ❌ Non-commercial only | Standard (25-35s) |
| **Flux-Pro** | $0.05 | ✅ Yes | Premium (30-45s) |
| **Flux-Dev-Advanced** | $0.02 | ❌ Non-commercial only | Variable |

### Host-your-account (HYA) Option
- **Flat Rate**: $8/seat/month
- Connect your own Black Forest Labs accounts
- Access to all model variants
- Custom LoRA and ControlNet support

## API Architecture

### Create Image Task
```bash
POST https://api.piapi.ai/api/v1/task
```

#### Request Headers
```json
{
  "X-API-Key": "your_api_key",
  "Content-Type": "application/json"
}
```

#### Text-to-Image Request Example
```json
{
  "model": "Qubico/flux1-dev",
  "task_type": "txt2img",
  "input": {
    "prompt": "A majestic dragon soaring over a medieval castle at sunset, cinematic lighting, highly detailed, fantasy art style",
    "negative_prompt": "blurry, low quality, distorted, ugly",
    "width": 1024,
    "height": 1024,
    "guidance_scale": 3.5,
    "denoise": 0.7,
    "seed": 12345
  },
  "config": {
    "service_mode": "public",
    "webhook_config": {
      "endpoint": "https://your-webhook.com/flux",
      "secret": "webhook_secret"
    }
  }
}
```

#### Image-to-Image Request Example
```json
{
  "model": "Qubico/flux1-schnell",
  "task_type": "img2img",
  "input": {
    "prompt": "Transform this into a cyberpunk style artwork with neon lights",
    "image": "https://example.com/input-image.jpg",
    "denoise": 0.6,
    "guidance_scale": 4.0,
    "batch_size": 1
  }
}
```

## Advanced Features

### LoRA (Low-Rank Adaptation) Support
Apply custom styles and character consistency:

```json
{
  "model": "Qubico/flux1-dev-advanced",
  "task_type": "txt2img-lora",
  "input": {
    "prompt": "A portrait in anime style",
    "lora_settings": [
      {
        "path": "https://example.com/anime-style-lora.safetensors",
        "scale": 0.8
      }
    ]
  }
}
```

### ControlNet Integration
Precise control over image composition:

```json
{
  "model": "Qubico/flux1-dev-advanced", 
  "task_type": "controlnet-lora",
  "input": {
    "prompt": "A realistic portrait with the same pose",
    "control_net_settings": [
      {
        "path": "controlnet-pose",
        "control_image_url": "https://example.com/pose-reference.jpg",
        "conditioning_scale": 1.0
      }
    ]
  }
}
```

### Redux Variation
Advanced image variations:

```json
{
  "model": "Qubico/flux1-dev-advanced",
  "task_type": "redux-variation",
  "input": {
    "prompt": "Create a variation with different lighting",
    "image": "https://example.com/original.jpg",
    "variation_strength": 0.7
  }
}
```

### Fill/Inpaint Operations
Smart image completion:

```json
{
  "model": "Qubico/flux1-dev-advanced",
  "task_type": "fill-inpaint",
  "input": {
    "prompt": "Replace the background with a mountain landscape",
    "image": "https://example.com/original.jpg",
    "mask": "https://example.com/mask.jpg"
  }
}
```

## Parameter Reference

### Core Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Text description for image generation |
| `negative_prompt` | string | No | Elements to avoid in generation |
| `width` | integer | No | Image width (txt2img only, max 1048576 pixels total) |
| `height` | integer | No | Image height (txt2img only, max 1048576 pixels total) |
| `guidance_scale` | float | No | Prompt adherence strength (1.5-5.0, default: 3.5) |
| `denoise` | float | No | Denoising strength (0.0-1.0, default: 0.7) |
| `seed` | integer | No | Random seed for reproducible results |
| `batch_size` | integer | No | Number of images (1-4, Schnell only) |

### Advanced Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `lora_settings` | array | LoRA configurations with path and scale |
| `control_net_settings` | array | ControlNet configurations |
| `image` | string | Input image URL for img2img operations |
| `mask` | string | Mask image URL for inpainting |
| `conditioning_scale` | float | ControlNet influence strength |
| `variation_strength` | float | Strength of variation for redux operations |

## Response Format

### Successful Task Creation
```json
{
  "code": 200,
  "data": {
    "task_id": "flux_12345-abcd-efgh-ijkl",
    "model": "Qubico/flux1-dev",
    "task_type": "txt2img",
    "status": "pending",
    "input": {
      "prompt": "A majestic dragon soaring over a medieval castle",
      "width": 1024,
      "height": 1024
    },
    "meta": {
      "created_at": "2024-12-09T10:30:00Z",
      "usage": {
        "type": "quota",
        "consume": 15000
      }
    }
  },
  "message": "success"
}
```

### Completed Task Response
```json
{
  "code": 200,
  "data": {
    "task_id": "flux_12345-abcd-efgh-ijkl",
    "status": "completed",
    "output": {
      "image_url": "https://cdn.piapi.ai/images/flux_final_12345.png",
      "width": 1024,
      "height": 1024,
      "seed": 12345,
      "model_version": "flux1-dev"
    },
    "meta": {
      "created_at": "2024-12-09T10:30:00Z",
      "started_at": "2024-12-09T10:30:05Z",
      "ended_at": "2024-12-09T10:30:32Z",
      "processing_time": 27
    }
  },
  "message": "success"
}
```

## Rate Limits & Concurrency

### Processing Times
- **Flux-Schnell**: 15-20 seconds
- **Flux-Dev**: 25-35 seconds  
- **Flux-Pro**: 30-45 seconds
- **Advanced Operations**: 40-60 seconds

### Concurrent Job Limits by Plan

| Plan | PAYG Concurrent Jobs | HYA Concurrent Jobs |
|------|----------------------|---------------------|
| **Free** | 2 | N/A |
| **Creator ($8/month)** | 5 | 8 |
| **Pro ($50/month)** | 15+ | 20+ |

## Error Handling

### Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| 1100 | Invalid prompt length | Ensure prompt is 1-1500 characters |
| 1200 | Authentication failed | Verify API key is correct |
| 1300 | Insufficient credits | Top up account balance |
| 1400 | Rate limit exceeded | Wait or upgrade plan |
| 1500 | Service temporarily unavailable | Retry after delay |
| 1600 | Invalid image URL | Ensure image is accessible and valid format |
| 1700 | Invalid dimensions | Check width*height doesn't exceed 1048576 |
| 1800 | LoRA/ControlNet load failed | Verify LoRA/ControlNet URLs and compatibility |

### Error Response Example
```json
{
  "code": 400,
  "data": {
    "error": {
      "code": 1700,
      "message": "Invalid image dimensions",
      "detail": "Width * height cannot exceed 1048576 pixels"
    }
  },
  "message": "failed"
}
```

## Best Practices

### 1. Prompt Engineering
```javascript
// Effective prompt examples
const prompts = {
  photorealistic: "A professional headshot of a business executive, soft lighting, neutral background, high quality, photorealistic, 8k resolution",
  artistic: "An oil painting of a serene landscape, impressionist style, warm colors, masterpiece quality",
  character: "A fantasy warrior character, detailed armor, dramatic lighting, concept art style, highly detailed"
};
```

### 2. Model Selection Strategy
```javascript
function selectFluxModel(requirements) {
  if (requirements.commercial && requirements.speed === 'fast') {
    return 'Qubico/flux1-schnell';
  } else if (requirements.commercial && requirements.quality === 'premium') {
    return 'Qubico/flux1-pro';
  } else if (requirements.lora || requirements.controlnet) {
    return 'Qubico/flux1-dev-advanced';
  } else {
    return 'Qubico/flux1-dev';
  }
}
```

### 3. Optimal Configuration
```javascript
const optimalSettings = {
  portrait: {
    width: 768,
    height: 1024,
    guidance_scale: 3.5,
    denoise: 0.7
  },
  landscape: {
    width: 1024,
    height: 768,
    guidance_scale: 4.0,
    denoise: 0.8
  },
  square: {
    width: 1024,
    height: 1024,
    guidance_scale: 3.5,
    denoise: 0.7
  }
};
```

## Integration Examples

### Node.js Implementation
```javascript
class FluxAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.piapi.ai/api/v1';
  }
  
  async generateImage(prompt, options = {}) {
    const payload = {
      model: options.model || 'Qubico/flux1-dev',
      task_type: options.imageUrl ? 'img2img' : 'txt2img',
      input: {
        prompt,
        negative_prompt: options.negativePrompt || '',
        width: options.width || 1024,
        height: options.height || 1024,
        guidance_scale: options.guidanceScale || 3.5,
        denoise: options.denoise || 0.7,
        seed: options.seed,
        batch_size: options.batchSize || 1,
        ...options
      },
      config: {
        service_mode: 'public',
        webhook_config: options.webhook
      }
    };
    
    if (options.imageUrl) {
      payload.input.image = options.imageUrl;
      delete payload.input.width;
      delete payload.input.height;
    }
    
    try {
      const response = await fetch(`${this.baseURL}/task`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      return response.json();
    } catch (error) {
      throw new Error(`Flux API error: ${error.message}`);
    }
  }
  
  async generateWithLora(prompt, loraSettings, options = {}) {
    return this.generateImage(prompt, {
      model: 'Qubico/flux1-dev-advanced',
      lora_settings: loraSettings,
      ...options
    });
  }
  
  async generateWithControlNet(prompt, controlNetSettings, options = {}) {
    return this.generateImage(prompt, {
      model: 'Qubico/flux1-dev-advanced',
      control_net_settings: controlNetSettings,
      ...options
    });
  }
  
  async getTaskStatus(taskId) {
    try {
      const response = await fetch(`${this.baseURL}/task/${taskId}`, {
        headers: { 'X-API-Key': this.apiKey }
      });
      
      return response.json();
    } catch (error) {
      throw new Error(`Failed to get task status: ${error.message}`);
    }
  }
  
  async waitForCompletion(taskId, maxWaitTime = 180000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const task = await this.getTaskStatus(taskId);
      
      if (task.data.status === 'completed') {
        return task.data;
      } else if (task.data.status === 'failed') {
        throw new Error(`Task failed: ${task.data.error?.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('Task timeout');
  }
}

// Usage examples
const flux = new FluxAPI('your_api_key');

async function generateArtwork() {
  try {
    // Basic text-to-image
    const task = await flux.generateImage(
      "A cyberpunk cityscape at night with neon lights reflecting in wet streets",
      {
        model: 'Qubico/flux1-dev',
        width: 1024,
        height: 768,
        guidanceScale: 4.0
      }
    );
    
    console.log('Task created:', task.data.task_id);
    
    // Wait for completion
    const result = await flux.waitForCompletion(task.data.task_id);
    console.log('Image URL:', result.output.image_url);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}
```

### Python Implementation
```python
import requests
import time
from typing import Dict, Any, Optional, List

class FluxAPI:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.piapi.ai/api/v1"
        
    def generate_image(self, prompt: str, **options) -> Dict[str, Any]:
        """Generate an image from text prompt or modify existing image"""
        model = options.get('model', 'Qubico/flux1-dev')
        task_type = 'img2img' if 'image_url' in options else 'txt2img'
        
        payload = {
            "model": model,
            "task_type": task_type,
            "input": {
                "prompt": prompt,
                "negative_prompt": options.get("negative_prompt", ""),
                "guidance_scale": options.get("guidance_scale", 3.5),
                "denoise": options.get("denoise", 0.7),
                "seed": options.get("seed"),
                "batch_size": options.get("batch_size", 1)
            },
            "config": {
                "service_mode": "public"
            }
        }
        
        # Add dimensions for txt2img only
        if task_type == 'txt2img':
            payload["input"]["width"] = options.get("width", 1024)
            payload["input"]["height"] = options.get("height", 1024)
        elif 'image_url' in options:
            payload["input"]["image"] = options["image_url"]
            
        # Add LoRA settings if provided
        if 'lora_settings' in options:
            payload["input"]["lora_settings"] = options["lora_settings"]
            
        # Add ControlNet settings if provided
        if 'control_net_settings' in options:
            payload["input"]["control_net_settings"] = options["control_net_settings"]
            
        if "webhook" in options:
            payload["config"]["webhook_config"] = options["webhook"]
            
        headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            f"{self.base_url}/task",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        
        return response.json()["data"]
    
    def generate_with_lora(self, prompt: str, lora_settings: List[Dict], **options) -> Dict[str, Any]:
        """Generate image with LoRA customizations"""
        return self.generate_image(
            prompt,
            model='Qubico/flux1-dev-advanced',
            lora_settings=lora_settings,
            **options
        )
    
    def generate_with_controlnet(self, prompt: str, controlnet_settings: List[Dict], **options) -> Dict[str, Any]:
        """Generate image with ControlNet guidance"""
        return self.generate_image(
            prompt,
            model='Qubico/flux1-dev-advanced',
            control_net_settings=controlnet_settings,
            **options
        )
    
    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """Get current task status"""
        headers = {"X-API-Key": self.api_key}
        
        response = requests.get(
            f"{self.base_url}/task/{task_id}",
            headers=headers
        )
        response.raise_for_status()
        
        return response.json()["data"]
    
    def wait_for_completion(self, task_id: str, max_wait: int = 180) -> Dict[str, Any]:
        """Wait for task completion with polling"""
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            task = self.get_task_status(task_id)
            
            if task["status"] == "completed":
                return task
            elif task["status"] == "failed":
                raise Exception(f"Task failed: {task.get('error', {}).get('message')}")
            
            time.sleep(5)
            
        raise TimeoutError("Task completion timeout")

# Usage example
def create_flux_images():
    flux = FluxAPI("your_api_key")
    
    try:
        # Generate with LoRA
        lora_task = flux.generate_with_lora(
            "A portrait in anime style",
            lora_settings=[
                {
                    "path": "https://example.com/anime-lora.safetensors",
                    "scale": 0.8
                }
            ],
            width=768,
            height=1024
        )
        
        print(f"LoRA task created: {lora_task['task_id']}")
        
        # Generate with ControlNet
        controlnet_task = flux.generate_with_controlnet(
            "A realistic portrait maintaining the same pose",
            controlnet_settings=[
                {
                    "path": "controlnet-pose",
                    "control_image_url": "https://example.com/pose-ref.jpg",
                    "conditioning_scale": 1.0
                }
            ]
        )
        
        print(f"ControlNet task created: {controlnet_task['task_id']}")
        
        # Wait for completion
        lora_result = flux.wait_for_completion(lora_task["task_id"])
        print(f"LoRA image URL: {lora_result['output']['image_url']}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_flux_images()
```

## Workflow Examples

### Style Transfer Pipeline
```javascript
async function styleTransferWorkflow(originalImage, stylePrompt) {
  // 1. Generate style reference
  const styleTask = await flux.generateImage(stylePrompt, {
    model: 'Qubico/flux1-dev',
    width: 1024,
    height: 1024
  });
  
  const styleResult = await flux.waitForCompletion(styleTask.data.task_id);
  
  // 2. Apply style to original image
  const transferTask = await flux.generateImage(
    `Transform this image to match the artistic style: ${stylePrompt}`,
    {
      model: 'Qubico/flux1-dev',
      imageUrl: originalImage,
      denoise: 0.6,
      guidanceScale: 4.5
    }
  );
  
  return flux.waitForCompletion(transferTask.data.task_id);
}
```

### Batch Character Generation
```javascript
async function generateCharacterVariations(basePrompt, variations) {
  const results = [];
  
  for (const variation of variations) {
    const fullPrompt = `${basePrompt}, ${variation}`;
    
    const task = await flux.generateImage(fullPrompt, {
      model: 'Qubico/flux1-schnell',
      width: 768,
      height: 1024,
      batchSize: 2
    });
    
    results.push(task);
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Wait for all completions
  const completed = await Promise.all(
    results.map(task => flux.waitForCompletion(task.data.task_id))
  );
  
  return completed.map(result => result.output.image_url);
}

// Usage
const characterVariations = await generateCharacterVariations(
  "A fantasy mage character, detailed robes, magical staff",
  [
    "young female elf with silver hair",
    "elderly human male with white beard", 
    "middle-aged dwarf with braided hair",
    "mysterious hooded figure in shadows"
  ]
);
```

## File Requirements

### Input Images
- **Formats**: JPG, PNG, WebP
- **Max size**: 25MB
- **Min dimensions**: 256x256px
- **Max dimensions**: Limited by total pixel count (1048576 for generation)
- **URL requirement**: Must be publicly accessible

### Output Images
- **Format**: PNG (high quality)
- **Resolution**: Up to 2048x2048px
- **File size**: Varies by content complexity
- **Expiration**: URLs expire after 7 days

## Performance Optimization

### Concurrent Processing
```javascript
// Process multiple images concurrently with rate limiting
async function batchProcess(prompts, maxConcurrent = 3) {
  const queue = [...prompts];
  const results = [];
  const active = [];
  
  while (queue.length > 0 || active.length > 0) {
    // Start new tasks if under limit
    while (active.length < maxConcurrent && queue.length > 0) {
      const prompt = queue.shift();
      
      const task = flux.generateImage(prompt, {
        model: 'Qubico/flux1-schnell'
      }).then(task => 
        flux.waitForCompletion(task.data.task_id)
      );
      
      active.push(task);
    }
    
    // Wait for at least one to complete
    const completed = await Promise.race(active);
    results.push(completed);
    
    // Remove completed task from active list
    const index = active.indexOf(completed);
    active.splice(index, 1);
  }
  
  return results;
}
```

### Caching Strategy
```javascript
// Cache generated images to avoid regeneration
const imageCache = new Map();

async function getCachedImage(prompt, options) {
  const cacheKey = JSON.stringify({ prompt, options });
  
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }
  
  const task = await flux.generateImage(prompt, options);
  const result = await flux.waitForCompletion(task.data.task_id);
  
  imageCache.set(cacheKey, result.output.image_url);
  
  // Cache for 24 hours
  setTimeout(() => imageCache.delete(cacheKey), 24 * 60 * 60 * 1000);
  
  return result.output.image_url;
}
```

## Troubleshooting

### Common Issues

1. **Generation Quality Problems**
   - Use more specific, detailed prompts
   - Adjust guidance_scale (3.5-4.5 for most cases)
   - Try different models (Pro for highest quality)
   - Use negative prompts to exclude unwanted elements

2. **LoRA/ControlNet Issues**
   - Verify LoRA URLs are publicly accessible
   - Check LoRA compatibility with Flux models
   - Adjust scale values (0.6-1.0 typical range)
   - Ensure ControlNet images match expected format

3. **Rate Limit Errors**
   - Implement proper exponential backoff
   - Use batch processing with delays
   - Consider upgrading to higher plan tier
   - Monitor concurrent job usage

### Debug Mode
```javascript
// Enable detailed logging for debugging
const task = await flux.generateImage(prompt, {
  model: 'Qubico/flux1-dev',
  debug: true // Get additional metadata
});

console.log('Task details:', task.data.meta);
```

## Support Resources

- **Discord Community**: [Join PiAPI Discord](https://discord.gg/piapi)
- **Documentation**: [https://piapi.ai/docs/flux-api](https://piapi.ai/docs/flux-api)
- **Black Forest Labs**: [https://blackforestlabs.ai](https://blackforestlabs.ai)
- **Email Support**: contact@piapi.ai

## Changelog

- **Advanced Models**: Added LoRA and ControlNet support
- **Redux Features**: Advanced variation and editing capabilities
- **Batch Generation**: Multiple images per request (Schnell)
- **Commercial Licensing**: Flux-Schnell and Pro available for commercial use
- **Performance Improvements**: Faster processing and better quality

---

*For more examples and advanced usage, see the [PiAPI Flux Documentation](https://piapi.ai/docs/flux-api)*

*Last Updated: January 2025* 