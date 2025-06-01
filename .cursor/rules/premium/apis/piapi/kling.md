# PiAPI Kling Video API - Standard Operating Procedure (SOP)

## Overview

Kling is a state-of-the-art AI video generation model developed by Kuaishou Technology, transforming text descriptions and images into high-quality, cinematic videos. PiAPI provides comprehensive access to Kling's 1.0, 1.5, 1.6, and 2.0 video models through both Pay-as-you-go (PAYG) and Host-your-account (HYA) service options.

**Official PiAPI Kling Documentation**: [https://piapi.ai/kling-api](https://piapi.ai/kling-api)

**API Base URL**: `https://api.piapi.ai/api/v1/`

## Key Features

### Available Models
- **Kling 1.0**: Basic video generation with standard features
- **Kling 1.5**: Enhanced model with improved motion fluidity
- **Kling 1.6**: Advanced features including Elements and Effects
- **Kling 2.0 Master**: Professional-grade cinematic quality (Pro mode only)

### Generation Capabilities
- **Text-to-Video**: Generate videos from text prompts
- **Image-to-Video**: Animate static images with text guidance
- **Video Extensions**: Extend existing videos by 4.5 seconds per extension
- **Motion Brush**: Precise control over object movement paths
- **Lip Sync**: Generate synchronized voiceover and video
- **Virtual Try-On**: AI-powered garment fitting visualization
- **Kling Effects**: Professional visual effects and transformations
- **Elements**: Environmental and atmospheric effects

## Pricing Structure

### Pay-as-you-go (PAYG) Options

| Mode | Duration | Price | Description |
|------|----------|-------|-------------|
| **Standard - 5s** | 5 seconds | $0.16/video | Basic quality generation |
| **Standard - 10s** | 10 seconds | $0.32/video | Extended standard generation |
| **Pro - 5s** | 5 seconds | $0.56/video | Professional quality |
| **Pro - 10s** | 10 seconds | $1.12/video | Extended professional quality |

### Host-your-account (HYA) Option
- **Flat Rate**: $10/seat/month
- Connect your own Kling accounts
- Access to all API features
- Multi-account load balancing support
- Use your existing Kling account credits

## API Architecture

### Create Video Task
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

#### Text-to-Video Request Example
```json
{
  "model": "kling",
  "task_type": "txt2video",
  "input": {
    "prompt": "A majestic eagle soaring through mountain peaks at sunset",
    "negative_prompt": "blurry, low quality, distorted",
    "duration": "5",
    "mode": "std",
    "aspect_ratio": "16:9",
    "camera_movement": "zoom_in"
  },
  "config": {
    "service_mode": "public",
    "webhook_config": {
      "endpoint": "https://your-webhook.com/kling",
      "secret": "webhook_secret"
    }
  }
}
```

#### Image-to-Video Request Example
```json
{
  "model": "kling",
  "task_type": "img2video",
  "input": {
    "prompt": "The portrait comes to life, eyes opening slowly",
    "image_url": "https://example.com/portrait.jpg",
    "duration": "5",
    "mode": "pro",
    "aspect_ratio": "9:16"
  },
  "config": {
    "service_mode": "public"
  }
}
```

## Advanced Features

### Motion Brush API
Control precise object movement with custom paths:

```json
{
  "model": "kling",
  "task_type": "motion_brush",
  "input": {
    "image_url": "https://example.com/scene.jpg",
    "motion_data": [
      {
        "object_id": "car",
        "path": [
          {"x": 100, "y": 200, "frame": 0},
          {"x": 300, "y": 200, "frame": 30},
          {"x": 500, "y": 150, "frame": 60}
        ]
      }
    ],
    "duration": "5"
  }
}
```

### Lip Sync Generation
Generate synchronized speech and video:

```json
{
  "model": "kling",
  "task_type": "lipsync",
  "input": {
    "character_image": "https://example.com/character.jpg",
    "text": "Hello, welcome to our demonstration",
    "voice_style": "professional_female",
    "duration": "auto"
  }
}
```

### Kling Effects
Apply professional visual effects:

```json
{
  "model": "kling",
  "task_type": "effects",
  "input": {
    "base_video": "https://example.com/original.mp4",
    "effect_type": "fire_explosion",
    "intensity": 0.8,
    "timing": "middle"
  }
}
```

## Parameter Reference

### Core Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Text description for video generation |
| `negative_prompt` | string | No | Elements to avoid in generation |
| `duration` | string | Yes | "5" or "10" seconds |
| `mode` | string | Yes | "std" (standard) or "pro" (professional) |
| `aspect_ratio` | string | No | "16:9", "9:16", "1:1" (default: "16:9") |

### Advanced Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `camera_movement` | string | "static", "zoom_in", "zoom_out", "pan_left", "pan_right" |
| `seed` | integer | Reproducible generation seed |
| `creativity` | float | Creative freedom (0.1-1.0) |
| `cfg_scale` | float | Prompt adherence strength (1.0-20.0) |
| `image_tail_url` | string | End frame reference image |
| `version` | string | Model version: "1.0", "1.5", "1.6", "2.0" |

## Response Format

### Successful Task Creation
```json
{
  "code": 200,
  "data": {
    "task_id": "kling_12345-abcd-efgh-ijkl",
    "model": "kling",
    "task_type": "txt2video",
    "status": "pending",
    "input": {
      "prompt": "A majestic eagle soaring through mountain peaks",
      "duration": "5",
      "mode": "std"
    },
    "meta": {
      "created_at": "2024-12-09T10:30:00Z",
      "usage": {
        "type": "quota",
        "consume": 16000
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
    "task_id": "kling_12345-abcd-efgh-ijkl",
    "status": "completed",
    "output": {
      "video_url": "https://cdn.piapi.ai/videos/kling_final_12345.mp4",
      "preview_url": "https://cdn.piapi.ai/previews/kling_preview_12345.gif",
      "duration": 5.0,
      "resolution": "1024x576",
      "file_size": 12458752
    },
    "meta": {
      "created_at": "2024-12-09T10:30:00Z",
      "started_at": "2024-12-09T10:30:15Z",
      "ended_at": "2024-12-09T10:32:30Z",
      "processing_time": 135
    }
  },
  "message": "success"
}
```

## Rate Limits & Concurrency

### Concurrent Job Limits by Plan

| Plan | PAYG Concurrent Jobs | HYA Concurrent Jobs |
|------|----------------------|---------------------|
| **Free** | 1 | N/A |
| **Creator ($8/month)** | 3 | 5 |
| **Pro ($50/month)** | 20+ | 20+ |

### Processing Times
- **Standard Mode**: 90-150 seconds
- **Professional Mode**: 120-200 seconds
- **Peak Hours**: Additional 30-60 seconds delay

## Error Handling

### Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| 1100 | Invalid prompt length | Ensure prompt is 1-2500 characters |
| 1200 | Authentication failed | Verify API key is correct |
| 1300 | Insufficient credits | Top up account balance |
| 1400 | Rate limit exceeded | Wait or upgrade plan |
| 1500 | Service temporarily unavailable | Retry after delay |
| 1600 | Invalid image URL | Ensure image is accessible and valid |
| 1700 | Unsupported aspect ratio | Use supported ratios |

### Error Response Example
```json
{
  "code": 400,
  "data": {
    "error": {
      "code": 1100,
      "message": "Prompt too long",
      "detail": "Prompt exceeds maximum length of 2500 characters"
    }
  },
  "message": "failed"
}
```

## Best Practices

### 1. Prompt Engineering
```javascript
// Good prompt examples
const prompts = {
  cinematic: "A close-up shot of a vintage car driving through neon-lit city streets at night, cinematic lighting, 4k quality",
  natural: "A serene forest scene with sunlight filtering through trees, gentle breeze moving leaves, realistic movement",
  creative: "Abstract geometric shapes transforming and flowing in space, vibrant colors, smooth transitions"
};
```

### 2. Optimal Settings
```javascript
const optimalConfig = {
  shortForm: {
    duration: "5",
    mode: "std",
    aspect_ratio: "9:16"  // TikTok/Instagram
  },
  longForm: {
    duration: "10", 
    mode: "pro",
    aspect_ratio: "16:9"  // YouTube/TV
  }
};
```

### 3. Performance Optimization
```javascript
// Batch processing with delay
async function processVideoBatch(prompts) {
  const results = [];
  
  for (let i = 0; i < prompts.length; i++) {
    const task = await createKlingTask(prompts[i]);
    results.push(task);
    
    // Respect rate limits
    if (i < prompts.length - 1) {
      await delay(2000); // 2 second delay between requests
    }
  }
  
  return results;
}
```

## Integration Examples

### Node.js Implementation
```javascript
const axios = require('axios');

class KlingAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.piapi.ai/api/v1';
  }
  
  async generateVideo(prompt, options = {}) {
    const payload = {
      model: 'kling',
      task_type: 'txt2video',
      input: {
        prompt,
        duration: options.duration || '5',
        mode: options.mode || 'std',
        aspect_ratio: options.aspectRatio || '16:9',
        ...options
      },
      config: {
        service_mode: 'public',
        webhook_config: options.webhook
      }
    };
    
    try {
      const response = await axios.post(`${this.baseURL}/task`, payload, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data.data;
    } catch (error) {
      throw new Error(`Kling API error: ${error.response?.data?.message || error.message}`);
    }
  }
  
  async getTaskStatus(taskId) {
    try {
      const response = await axios.get(`${this.baseURL}/task/${taskId}`, {
        headers: { 'X-API-Key': this.apiKey }
      });
      
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get task status: ${error.message}`);
    }
  }
  
  async waitForCompletion(taskId, maxWaitTime = 300000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const task = await this.getTaskStatus(taskId);
      
      if (task.status === 'completed') {
        return task;
      } else if (task.status === 'failed') {
        throw new Error(`Task failed: ${task.error?.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds
    }
    
    throw new Error('Task timeout');
  }
}

// Usage example
const kling = new KlingAPI('your_api_key');

async function createVideoExample() {
  try {
    // Create video task
    const task = await kling.generateVideo(
      "A time-lapse of a flower blooming in a garden", 
      {
        duration: '10',
        mode: 'pro',
        aspectRatio: '16:9'
      }
    );
    
    console.log('Task created:', task.task_id);
    
    // Wait for completion
    const completed = await kling.waitForCompletion(task.task_id);
    console.log('Video URL:', completed.output.video_url);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}
```

### Python Implementation
```python
import requests
import time
from typing import Dict, Optional

class KlingAPI:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.piapi.ai/api/v1"
        
    def generate_video(self, prompt: str, **options) -> Dict:
        """Generate a video from text prompt"""
        payload = {
            "model": "kling",
            "task_type": "txt2video",
            "input": {
                "prompt": prompt,
                "duration": options.get("duration", "5"),
                "mode": options.get("mode", "std"),
                "aspect_ratio": options.get("aspect_ratio", "16:9"),
                **{k: v for k, v in options.items() 
                   if k not in ["duration", "mode", "aspect_ratio"]}
            },
            "config": {
                "service_mode": "public"
            }
        }
        
        if "webhook" in options:
            payload["config"]["webhook_config"] = options["webhook"]
            
        headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            f"{self.base_url}/task",
            json=payload,
            headers=headers
        )
        response.raise_for_status()
        
        return response.json()["data"]
    
    def get_task_status(self, task_id: str) -> Dict:
        """Get current task status"""
        headers = {"X-API-Key": self.api_key}
        
        response = requests.get(
            f"{self.base_url}/task/{task_id}",
            headers=headers
        )
        response.raise_for_status()
        
        return response.json()["data"]
    
    def wait_for_completion(self, task_id: str, max_wait: int = 300) -> Dict:
        """Wait for task completion with polling"""
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            task = self.get_task_status(task_id)
            
            if task["status"] == "completed":
                return task
            elif task["status"] == "failed":
                raise Exception(f"Task failed: {task.get('error', {}).get('message')}")
            
            time.sleep(10)  # Poll every 10 seconds
            
        raise TimeoutError("Task completion timeout")

# Usage example
def create_kling_video():
    kling = KlingAPI("your_api_key")
    
    try:
        # Generate video
        task = kling.generate_video(
            "A peaceful lake reflecting mountains at sunset",
            duration="10",
            mode="pro",
            camera_movement="pan_right"
        )
        
        print(f"Task created: {task['task_id']}")
        
        # Wait for completion
        completed = kling.wait_for_completion(task["task_id"])
        print(f"Video URL: {completed['output']['video_url']}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_kling_video()
```

## Troubleshooting

### Common Issues

1. **Long Processing Times**
   - Professional mode takes longer than standard
   - Peak hours experience delays
   - Complex prompts require more processing

2. **Quality Issues**
   - Use specific, detailed prompts
   - Avoid conflicting instructions
   - Try different camera movements

3. **Rate Limit Errors**
   - Implement proper delays between requests
   - Monitor concurrent job usage
   - Consider upgrading plan for higher limits

### Performance Tips

1. **Prompt Optimization**
   - Be specific about visual elements
   - Include camera and lighting descriptions
   - Avoid contradictory instructions

2. **Resource Management**
   - Monitor credit usage through Account API
   - Use webhooks for efficient task monitoring
   - Implement proper error handling

3. **Quality Control**
   - Test with standard mode before using professional
   - Use appropriate aspect ratios for target platform
   - Consider video extension for longer content

## Support Resources

- **Discord Community**: [Join PiAPI Discord](https://discord.gg/piapi)
- **Documentation**: [https://piapi.ai/docs](https://piapi.ai/docs)
- **API Status**: Monitor service availability
- **Email Support**: contact@piapi.ai

## Changelog

- **v2.0**: Kling 2.0 Master support with cinematic quality
- **v1.6**: Elements and Effects features added
- **v1.5**: Enhanced motion fluidity and quality
- **v1.0**: Initial release with basic text/image-to-video 