# PiAPI Luma Dream Machine API - Standard Operating Procedure (SOP)

## Overview

Luma Dream Machine is an advanced AI video generation model developed by Luma Labs, capable of creating high-quality, realistic videos from text prompts and images. PiAPI provides comprehensive access to Dream Machine's capabilities through both Pay-as-you-go (PAYG) and Host-your-account (HYA) service options.

**Official PiAPI Luma Documentation**: [https://piapi.ai/dream-machine-api](https://piapi.ai/dream-machine-api)

**API Base URL**: `https://api.piapi.ai/api/v1/`

## Key Features

### Generation Capabilities
- **Text-to-Video**: Generate videos from descriptive text prompts
- **Image-to-Video**: Animate static images with text guidance
- **Video Extension**: Extend existing videos with additional content
- **Enhance Prompt**: AI-powered prompt optimization
- **Camera Motion**: Professional camera movements and trajectories
- **Watermark Removal**: Remove Luma watermarks (Premium plans)
- **Priority Generation**: Faster processing during peak times

### Technical Specifications
- **Output Resolution**: Up to 1080p HD quality
- **Frame Rate**: 30 FPS standard
- **Duration**: 5-second generations standard
- **Aspect Ratios**: 16:9, 9:16, 1:1 supported
- **Processing Speed**: 120 frames in ~120 seconds
- **Physics Simulation**: Accurate real-world physics

## Pricing Structure

### Pay-as-you-go (PAYG) Options

| Service | Price | Description |
|---------|-------|-------------|
| **Standard Generation** | $0.30/call | Basic video generation |
| **Custom Deployment** | Contact Us | High concurrency, lower latency |

### Host-your-account (HYA) Option
- **Flat Rate**: $10/seat/month
- Connect your own Dream Machine accounts
- Access to all API features
- Multi-account load balancing support
- Use your existing Luma account credits

### Premium Features (Subscription Plans)
- **Watermark Removal**: Remove "LUMA" watermark
- **Priority Generation**: Fastest processing queue
- **Commercial Use**: Licensed for commercial applications
- **Extended Support**: Enhanced customer service

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
  "model": "luma",
  "task_type": "txt2video",
  "input": {
    "prompt": "A serene lake surrounded by mountains at sunset, camera slowly panning right",
    "aspect_ratio": "16:9",
    "expand_prompt": true,
    "model_name": "luma-ray2",
    "duration": 5
  },
  "config": {
    "service_mode": "public",
    "webhook_config": {
      "endpoint": "https://your-webhook.com/luma",
      "secret": "webhook_secret"
    }
  }
}
```

#### Image-to-Video Request Example
```json
{
  "model": "luma",
  "task_type": "img2video",
  "input": {
    "prompt": "The portrait subject slowly opens their eyes and smiles",
    "image_url": "https://example.com/portrait.jpg",
    "aspect_ratio": "9:16",
    "camera_motion": "zoom_in"
  },
  "config": {
    "service_mode": "public"
  }
}
```

#### Video Extension Request Example
```json
{
  "model": "luma",
  "task_type": "video_extend",
  "input": {
    "prompt": "Continue the scene with more dramatic lighting",
    "video_url": "https://example.com/original_video.mp4",
    "extend_direction": "forward"
  }
}
```

## Advanced Features

### Enhanced Prompt Feature
Automatically improve prompt quality:

```json
{
  "input": {
    "prompt": "car driving",
    "expand_prompt": true
  }
}
```

Result: "A sleek sports car driving through winding mountain roads at golden hour, cinematic camera movement following the vehicle"

### Camera Motion Control
Specify professional camera movements:

```json
{
  "input": {
    "camera_motion": "dolly_forward",
    "motion_intensity": 0.7
  }
}
```

**Available Camera Motions:**
- `static` - No camera movement
- `pan_left` / `pan_right` - Horizontal panning
- `tilt_up` / `tilt_down` - Vertical tilting
- `zoom_in` / `zoom_out` - Zoom movements
- `dolly_forward` / `dolly_backward` - Forward/backward tracking
- `orbit_left` / `orbit_right` - Circular movement around subject

### Model Selection
Choose from available Luma models:

```json
{
  "input": {
    "model_name": "luma-ray2",  // Latest model with improved quality
    "duration": 5
  }
}
```

**Available Models:**
- `luma-ray2` - Latest model with enhanced quality and motion
- `luma-dream-machine` - Standard Dream Machine model
- `luma-v1` - Legacy model for compatibility

## Parameter Reference

### Core Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Text description for video generation |
| `aspect_ratio` | string | No | "16:9", "9:16", "1:1" (default: "16:9") |
| `expand_prompt` | boolean | No | Enable AI prompt enhancement |
| `model_name` | string | No | Specific Luma model to use |
| `duration` | integer | No | Video length in seconds (default: 5) |

### Image-to-Video Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `image_url` | string | URL of input image for animation |
| `camera_motion` | string | Camera movement type |
| `motion_intensity` | float | Strength of motion (0.0-1.0) |
| `maintain_subject` | boolean | Keep subject consistent during animation |

### Video Extension Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `video_url` | string | URL of video to extend |
| `extend_direction` | string | "forward" or "backward" |
| `transition_smoothness` | float | Smoothness of transition (0.0-1.0) |

## Response Format

### Successful Task Creation
```json
{
  "code": 200,
  "data": {
    "task_id": "luma_12345-abcd-efgh-ijkl",
    "model": "luma",
    "task_type": "txt2video",
    "status": "pending",
    "input": {
      "prompt": "A serene lake surrounded by mountains at sunset",
      "aspect_ratio": "16:9",
      "expand_prompt": true
    },
    "meta": {
      "created_at": "2024-12-09T10:30:00Z",
      "usage": {
        "type": "quota",
        "consume": 30000
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
    "task_id": "luma_12345-abcd-efgh-ijkl",
    "status": "completed",
    "output": {
      "video_url": "https://cdn.piapi.ai/videos/luma_final_12345.mp4",
      "preview_gif": "https://cdn.piapi.ai/previews/luma_preview_12345.gif",
      "duration": 5.0,
      "resolution": "1024x576",
      "frame_count": 150,
      "file_size": 8947234
    },
    "meta": {
      "created_at": "2024-12-09T10:30:00Z",
      "started_at": "2024-12-09T10:30:10Z",
      "ended_at": "2024-12-09T10:32:15Z",
      "processing_time": 125,
      "enhanced_prompt": "A serene lake surrounded by snow-capped mountains at sunset, warm golden light reflecting on calm water surface, cinematic wide shot"
    }
  },
  "message": "success"
}
```

## Rate Limits & Concurrency

### Processing Times
- **Standard Generation**: 90-150 seconds
- **Image-to-Video**: 100-160 seconds
- **Video Extension**: 80-120 seconds
- **Peak Hours**: Additional 20-40 seconds delay

### Concurrent Job Limits by Plan

| Plan | PAYG Concurrent Jobs | HYA Concurrent Jobs |
|------|----------------------|---------------------|
| **Free** | 1 | N/A |
| **Creator ($8/month)** | 2 | 3 |
| **Pro ($50/month)** | 10+ | 15+ |

## Error Handling

### Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| 1100 | Invalid prompt length | Ensure prompt is 1-1500 characters |
| 1200 | Authentication failed | Verify API key is correct |
| 1300 | Insufficient credits | Top up account balance |
| 1400 | Rate limit exceeded | Wait or upgrade plan |
| 1500 | Service temporarily unavailable | Retry after delay |
| 1600 | Invalid image URL | Ensure image is accessible and supported format |
| 1700 | Unsupported aspect ratio | Use supported ratios |
| 1800 | Video processing failed | Check input quality and retry |

### Error Response Example
```json
{
  "code": 400,
  "data": {
    "error": {
      "code": 1600,
      "message": "Invalid image URL",
      "detail": "Image must be accessible via HTTPS and in JPG/PNG format"
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
  cinematic: "Close-up of a vintage motorcycle riding through neon-lit city streets at night, rain reflections on asphalt, cinematic depth of field",
  natural: "Time-lapse of clouds moving over a vast desert landscape, golden hour lighting, smooth camera movement",
  creative: "Abstract liquid mercury flowing and transforming into geometric shapes, iridescent reflections, hypnotic motion"
};
```

### 2. Optimal Configuration
```javascript
const bestPractices = {
  socialMedia: {
    aspect_ratio: "9:16",
    camera_motion: "dolly_forward",
    duration: 5
  },
  professional: {
    aspect_ratio: "16:9", 
    expand_prompt: true,
    model_name: "luma-ray2",
    motion_intensity: 0.6
  }
};
```

### 3. Image-to-Video Optimization
```javascript
const imageToVideoTips = {
  // Best image characteristics
  idealInput: {
    resolution: "1024x576 or higher",
    format: "JPG or PNG",
    lighting: "Well-lit, clear subject",
    composition: "Central subject, minimal background clutter"
  },
  
  // Effective animation prompts
  animationStyles: [
    "The subject slowly turns their head and looks directly at camera",
    "Gentle wind blows through the hair and clothing",
    "The background gradually shifts from day to night",
    "Camera slowly zooms in on the subject's expression"
  ]
};
```

## Integration Examples

### Node.js Implementation
```javascript
const axios = require('axios');

class LumaAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.piapi.ai/api/v1';
  }
  
  async generateVideo(prompt, options = {}) {
    const payload = {
      model: 'luma',
      task_type: options.imageUrl ? 'img2video' : 'txt2video',
      input: {
        prompt,
        aspect_ratio: options.aspectRatio || '16:9',
        expand_prompt: options.enhancePrompt || false,
        model_name: options.modelName || 'luma-ray2',
        duration: options.duration || 5,
        ...options
      },
      config: {
        service_mode: 'public',
        webhook_config: options.webhook
      }
    };
    
    if (options.imageUrl) {
      payload.input.image_url = options.imageUrl;
    }
    
    try {
      const response = await axios.post(`${this.baseURL}/task`, payload, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data.data;
    } catch (error) {
      throw new Error(`Luma API error: ${error.response?.data?.message || error.message}`);
    }
  }
  
  async extendVideo(videoUrl, prompt, options = {}) {
    const payload = {
      model: 'luma',
      task_type: 'video_extend',
      input: {
        prompt,
        video_url: videoUrl,
        extend_direction: options.direction || 'forward',
        transition_smoothness: options.smoothness || 0.8
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
      throw new Error(`Video extension error: ${error.message}`);
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

// Usage examples
const luma = new LumaAPI('your_api_key');

async function createLumaVideo() {
  try {
    // Text-to-video generation
    const textTask = await luma.generateVideo(
      "A futuristic city skyline at night with flying cars", 
      {
        aspectRatio: '16:9',
        enhancePrompt: true,
        modelName: 'luma-ray2',
        camera_motion: 'dolly_forward'
      }
    );
    
    console.log('Text-to-video task created:', textTask.task_id);
    
    // Image-to-video generation
    const imageTask = await luma.generateVideo(
      "The portrait comes to life with a gentle smile",
      {
        imageUrl: 'https://example.com/portrait.jpg',
        aspectRatio: '9:16',
        camera_motion: 'zoom_in'
      }
    );
    
    console.log('Image-to-video task created:', imageTask.task_id);
    
    // Wait for completion
    const completed = await luma.waitForCompletion(textTask.task_id);
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

class LumaAPI:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.piapi.ai/api/v1"
        
    def generate_video(self, prompt: str, **options) -> Dict:
        """Generate a video from text prompt or image"""
        task_type = 'img2video' if 'image_url' in options else 'txt2video'
        
        payload = {
            "model": "luma",
            "task_type": task_type,
            "input": {
                "prompt": prompt,
                "aspect_ratio": options.get("aspect_ratio", "16:9"),
                "expand_prompt": options.get("enhance_prompt", False),
                "model_name": options.get("model_name", "luma-ray2"),
                "duration": options.get("duration", 5),
                **{k: v for k, v in options.items() 
                   if k not in ["aspect_ratio", "enhance_prompt", "model_name", "duration"]}
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
    
    def extend_video(self, video_url: str, prompt: str, **options) -> Dict:
        """Extend an existing video"""
        payload = {
            "model": "luma",
            "task_type": "video_extend",
            "input": {
                "prompt": prompt,
                "video_url": video_url,
                "extend_direction": options.get("direction", "forward"),
                "transition_smoothness": options.get("smoothness", 0.8)
            }
        }
        
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
def create_luma_videos():
    luma = LumaAPI("your_api_key")
    
    try:
        # Create text-to-video
        task = luma.generate_video(
            "A peaceful garden with butterflies flying among colorful flowers",
            aspect_ratio="16:9",
            enhance_prompt=True,
            camera_motion="pan_right"
        )
        
        print(f"Task created: {task['task_id']}")
        
        # Wait for completion
        completed = luma.wait_for_completion(task["task_id"])
        print(f"Video URL: {completed['output']['video_url']}")
        
        # Extend the video
        extended_task = luma.extend_video(
            completed['output']['video_url'],
            "The scene transitions to golden sunset lighting",
            direction="forward"
        )
        
        extended_result = luma.wait_for_completion(extended_task["task_id"])
        print(f"Extended video URL: {extended_result['output']['video_url']}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_luma_videos()
```

## Workflow Examples

### Video Series Creation
```javascript
async function createVideoSeries(scenes) {
  const results = [];
  
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    
    // Generate base video
    const task = await luma.generateVideo(scene.prompt, {
      aspectRatio: '16:9',
      enhancePrompt: true,
      camera_motion: scene.cameraMotion
    });
    
    const completed = await luma.waitForCompletion(task.task_id);
    results.push(completed);
    
    // Add delay between generations
    if (i < scenes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  return results;
}

// Usage
const videoSeries = await createVideoSeries([
  {
    prompt: "Opening shot: A mysterious forest entrance at dawn",
    cameraMotion: "dolly_forward"
  },
  {
    prompt: "Medium shot: A person walking through the forest path",
    cameraMotion: "pan_left"
  },
  {
    prompt: "Close-up: Sunlight filtering through tree leaves",
    cameraMotion: "tilt_up"
  }
]);
```

## Troubleshooting

### Common Issues

1. **Slow Processing Times**
   - Peak hours cause delays
   - Complex prompts require more processing
   - Image-to-video takes longer than text-to-video

2. **Quality Issues**
   - Use specific, detailed prompts
   - Enable prompt enhancement for better results
   - Choose appropriate aspect ratios

3. **Motion Artifacts**
   - Reduce motion intensity for subtle animations
   - Use clear, high-quality input images
   - Avoid conflicting motion instructions

### Performance Tips

1. **Prompt Optimization**
   - Be specific about camera movements
   - Include lighting and environment details
   - Use cinematic terminology

2. **Resource Management**
   - Monitor processing times during peak hours
   - Use webhooks for efficient monitoring
   - Plan batch processing with appropriate delays

3. **Quality Control**
   - Test with different camera motions
   - Use prompt enhancement for better results
   - Verify input image quality before processing

## Support Resources

- **Discord Community**: [Join PiAPI Discord](https://discord.gg/piapi)
- **Documentation**: [https://piapi.ai/docs](https://piapi.ai/docs)
- **Luma Labs Official**: [https://lumalabs.ai](https://lumalabs.ai)
- **Email Support**: contact@piapi.ai

## Changelog

- **Ray-2 Model**: Enhanced quality and motion consistency
- **Video Extension**: Support for extending generated videos
- **Camera Motion**: Advanced camera movement controls
- **Prompt Enhancement**: AI-powered prompt optimization
- **Watermark Removal**: Premium feature for commercial use 