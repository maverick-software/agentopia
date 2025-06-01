# PiAPI Faceswap API - Standard Operating Procedure

## Overview

PiAPI provides powerful face-swapping capabilities for both images and videos through their Faceswap API. Swap faces between photos, apply face swaps to videos, and handle multiple faces in a single operation with high-quality results.

**Base Endpoint**: `https://api.piapi.ai/api/v1/task`
**Model**: `faceswap`
**Official Docs**: [https://piapi.ai/docs/faceswap-api](https://piapi.ai/docs/faceswap-api)

## Pricing (Pay-as-you-go)

| Operation | Price per Task |
|-----------|----------------|
| Image Faceswap | $0.01 |
| Video Faceswap | $0.05/second |
| Multi Faceswap | $0.02 |

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
  "model": "faceswap",
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

### 1. Image Faceswap

Swap faces between two images.

**Task Type**: `face_swap`

```json
{
  "model": "faceswap",
  "task_type": "face_swap",
  "input": {
    "target_image": "https://example.com/person1.jpg",
    "swap_image": "https://example.com/person2.jpg",
    "face_index_target": 0,
    "face_index_swap": 0,
    "face_enhance": true
  },
  "config": {
    "service_mode": "public"
  }
}
```

**Parameters**:
- `target_image` (required): URL of the target image (where face will be placed)
- `swap_image` (required): URL of the source face image
- `face_index_target`: Which face to replace in target (0-based index)
- `face_index_swap`: Which face to use from swap image (0-based index)
- `face_enhance`: Apply face enhancement (default: true)
- `face_restore`: Restore face details (default: false)

**Response Example**:
```json
{
  "code": 200,
  "data": {
    "task_id": "abc123-456-789",
    "status": "completed",
    "output": {
      "image_url": "https://cdn.piapi.ai/faceswap_result.jpg",
      "faces_detected": {
        "target": 1,
        "swap": 1
      },
      "processing_time": 3.2
    }
  }
}
```

### 2. Video Faceswap

Apply face swap to video content.

**Task Type**: `video_face_swap`

```json
{
  "model": "faceswap",
  "task_type": "video_face_swap",
  "input": {
    "target_video": "https://example.com/video.mp4",
    "swap_image": "https://example.com/face.jpg",
    "face_index_swap": 0,
    "frame_rate_limit": 30,
    "quality": "high"
  }
}
```

**Parameters**:
- `target_video` (required): URL of the target video
- `swap_image` (required): URL of the face to swap in
- `face_index_swap`: Which face to use from swap image
- `frame_rate_limit`: Max FPS to process (default: 30)
- `quality`: Processing quality - `low`, `medium`, `high`
- `start_time`: Start time in seconds (optional)
- `end_time`: End time in seconds (optional)

**Response Example**:
```json
{
  "output": {
    "video_url": "https://cdn.piapi.ai/faceswap_video.mp4",
    "duration": 15.5,
    "frames_processed": 465,
    "faces_detected_per_frame": 1,
    "processing_time": 45.2
  }
}
```

### 3. Multi Faceswap

Swap multiple faces in a single image.

**Task Type**: `multi_face_swap`

```json
{
  "model": "faceswap",
  "task_type": "multi_face_swap",
  "input": {
    "target_image": "https://example.com/group_photo.jpg",
    "face_swaps": [
      {
        "swap_image": "https://example.com/face1.jpg",
        "target_face_index": 0,
        "swap_face_index": 0
      },
      {
        "swap_image": "https://example.com/face2.jpg", 
        "target_face_index": 1,
        "swap_face_index": 0
      }
    ],
    "enhance_all": true
  }
}
```

**Parameters**:
- `target_image` (required): URL of the target image with multiple faces
- `face_swaps` (required): Array of face swap operations
- `enhance_all`: Apply enhancement to all faces (default: true)
- `preserve_expressions`: Maintain original expressions (default: true)

## Face Detection and Indexing

### Understanding Face Indices

Face indices are assigned based on face detection order, typically:
- **Index 0**: Largest/most prominent face
- **Index 1**: Second largest face
- **Index 2**: Third largest face
- And so on...

### Face Detection Example

```json
{
  "model": "faceswap",
  "task_type": "detect_faces",
  "input": {
    "image_url": "https://example.com/photo.jpg"
  }
}
```

**Response**:
```json
{
  "output": {
    "faces_detected": 3,
    "face_locations": [
      {
        "index": 0,
        "bbox": [100, 150, 200, 250],
        "confidence": 0.95,
        "landmarks": {...}
      },
      {
        "index": 1,
        "bbox": [300, 120, 380, 200],
        "confidence": 0.88,
        "landmarks": {...}
      }
    ]
  }
}
```

## Quality and Enhancement Options

### Enhancement Settings

```json
{
  "input": {
    "face_enhance": true,
    "face_restore": true,
    "skin_smoothing": 0.7,
    "color_correction": true,
    "edge_blending": "high"
  }
}
```

**Enhancement Parameters**:
- `face_enhance`: Improve face quality and details
- `face_restore`: Restore degraded face features
- `skin_smoothing`: 0.0-1.0 (amount of skin smoothing)
- `color_correction`: Match skin tones between faces
- `edge_blending`: `low`, `medium`, `high` (blending quality)

### Quality Presets

```json
{
  "input": {
    "quality_preset": "ultra_high"
  }
}
```

**Presets**:
- `fast`: Quick processing, lower quality
- `balanced`: Good balance of speed and quality
- `high`: High quality, slower processing
- `ultra_high`: Maximum quality, longest processing

## Error Handling

### Common Errors

- **No face detected**: Image contains no detectable faces
- **Face index out of range**: Specified face index doesn't exist
- **Invalid image format**: Unsupported image format
- **Image too large**: Image exceeds size limits
- **Video too long**: Video exceeds duration limits

### Error Response Example

```json
{
  "code": 400,
  "data": {
    "error": {
      "code": 1100,
      "message": "No face detected in swap image",
      "detail": "Please ensure the swap image contains at least one clear face"
    }
  }
}
```

## Best Practices

### 1. Image Quality Requirements

**Optimal Input Images**:
- **Resolution**: 512x512px minimum, 2048x2048px maximum
- **Face size**: At least 128x128px in the image
- **Lighting**: Even, front-facing lighting preferred
- **Angle**: Front-facing or slight angle (±30 degrees)
- **Quality**: High resolution, minimal blur or artifacts

### 2. Face Selection Tips

```javascript
// Always detect faces first for multi-face images
async function detectAndSwapFaces(targetImage, swapImage) {
  // 1. Detect faces in target image
  const detection = await faceswap.detectFaces(targetImage);
  
  if (detection.faces_detected === 0) {
    throw new Error('No faces detected in target image');
  }
  
  // 2. Select the largest face (index 0) for swap
  const swapResult = await faceswap.swapFaces({
    target_image: targetImage,
    swap_image: swapImage,
    face_index_target: 0,
    face_index_swap: 0
  });
  
  return swapResult;
}
```

### 3. Video Processing Optimization

```json
{
  "input": {
    "target_video": "https://example.com/video.mp4",
    "swap_image": "https://example.com/face.jpg",
    "quality": "medium",
    "frame_rate_limit": 24,
    "start_time": 10,
    "end_time": 30
  }
}
```

**Tips**:
- Use `medium` quality for faster processing
- Limit frame rate to 24-30 FPS
- Process shorter clips (30-60 seconds)
- Use `start_time` and `end_time` for specific segments

### 4. Batch Processing

```javascript
async function batchFaceSwap(targets, swapFace) {
  const results = [];
  
  for (const target of targets) {
    try {
      const result = await faceswap.swapFaces({
        target_image: target,
        swap_image: swapFace,
        face_enhance: true
      });
      
      results.push({
        target,
        result: result.output.image_url,
        status: 'success'
      });
      
    } catch (error) {
      results.push({
        target,
        error: error.message,
        status: 'failed'
      });
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}
```

## Integration Examples

### Node.js Example

```javascript
class FaceswapAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.piapi.ai/api/v1';
  }
  
  async swapFaces(targetImage, swapImage, options = {}) {
    const response = await fetch(`${this.baseURL}/task`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'faceswap',
        task_type: 'face_swap',
        input: {
          target_image: targetImage,
          swap_image: swapImage,
          face_index_target: options.targetIndex || 0,
          face_index_swap: options.swapIndex || 0,
          face_enhance: options.enhance !== false,
          ...options
        }
      })
    });
    
    return response.json();
  }
  
  async swapVideoFaces(targetVideo, swapImage, options = {}) {
    const response = await fetch(`${this.baseURL}/task`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'faceswap',
        task_type: 'video_face_swap',
        input: {
          target_video: targetVideo,
          swap_image: swapImage,
          quality: options.quality || 'medium',
          frame_rate_limit: options.frameRate || 30,
          ...options
        }
      })
    });
    
    return response.json();
  }
  
  async multiSwap(targetImage, faceSwaps, options = {}) {
    const response = await fetch(`${this.baseURL}/task`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'faceswap',
        task_type: 'multi_face_swap',
        input: {
          target_image: targetImage,
          face_swaps: faceSwaps,
          enhance_all: options.enhanceAll !== false,
          ...options
        }
      })
    });
    
    return response.json();
  }
  
  async detectFaces(imageUrl) {
    const response = await fetch(`${this.baseURL}/task`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'faceswap',
        task_type: 'detect_faces',
        input: {
          image_url: imageUrl
        }
      })
    });
    
    return response.json();
  }
}
```

### Python Example

```python
import requests
import time

class FaceswapAPI:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.piapi.ai/api/v1'
        
    def swap_faces(self, target_image, swap_image, **options):
        headers = {
            'x-api-key': self.api_key,
            'Content-Type': 'application/json'
        }
        
        data = {
            'model': 'faceswap',
            'task_type': 'face_swap',
            'input': {
                'target_image': target_image,
                'swap_image': swap_image,
                'face_index_target': options.get('target_index', 0),
                'face_index_swap': options.get('swap_index', 0),
                'face_enhance': options.get('enhance', True),
                **options
            }
        }
        
        response = requests.post(
            f'{self.base_url}/task',
            headers=headers,
            json=data
        )
        
        return response.json()
    
    def swap_video_faces(self, target_video, swap_image, **options):
        headers = {
            'x-api-key': self.api_key,
            'Content-Type': 'application/json'
        }
        
        data = {
            'model': 'faceswap',
            'task_type': 'video_face_swap',
            'input': {
                'target_video': target_video,
                'swap_image': swap_image,
                'quality': options.get('quality', 'medium'),
                'frame_rate_limit': options.get('frame_rate', 30),
                **options
            }
        }
        
        response = requests.post(
            f'{self.base_url}/task',
            headers=headers,
            json=data
        )
        
        return response.json()
    
    def detect_faces(self, image_url):
        headers = {
            'x-api-key': self.api_key,
            'Content-Type': 'application/json'
        }
        
        data = {
            'model': 'faceswap',
            'task_type': 'detect_faces',
            'input': {
                'image_url': image_url
            }
        }
        
        response = requests.post(
            f'{self.base_url}/task',
            headers=headers,
            json=data
        )
        
        return response.json()
    
    def wait_for_completion(self, task_id, timeout=120):
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            task = self.get_task(task_id)
            
            if task['data']['status'] == 'completed':
                return task
            elif task['data']['status'] == 'failed':
                raise Exception(f"Task failed: {task['data']['error']}")
                
            time.sleep(5)
            
        raise TimeoutError(f"Task {task_id} did not complete within {timeout}s")
```

## Workflow Examples

### Complete Face Swap Workflow

```javascript
async function completeSwapWorkflow(targetImage, swapImage) {
  // 1. Detect faces in target image
  const detection = await faceswap.detectFaces(targetImage);
  
  if (detection.data.output.faces_detected === 0) {
    throw new Error('No faces found in target image');
  }
  
  console.log(`Found ${detection.data.output.faces_detected} faces`);
  
  // 2. Perform face swap on the largest face
  const swapTask = await faceswap.swapFaces(targetImage, swapImage, {
    targetIndex: 0,
    enhance: true,
    quality_preset: 'high'
  });
  
  // 3. Wait for completion
  const result = await pollTask(swapTask.data.task_id);
  
  return result.data.output.image_url;
}
```

### Video Face Swap with Progress Tracking

```javascript
async function swapVideoWithProgress(videoUrl, faceUrl) {
  // Start video face swap
  const task = await faceswap.swapVideoFaces(videoUrl, faceUrl, {
    quality: 'high',
    frame_rate_limit: 30
  });
  
  console.log(`Started video processing: ${task.data.task_id}`);
  
  // Poll for progress
  let lastStatus = '';
  while (true) {
    const status = await faceswap.getTask(task.data.task_id);
    
    if (status.data.status !== lastStatus) {
      console.log(`Status: ${status.data.status}`);
      lastStatus = status.data.status;
    }
    
    if (status.data.status === 'completed') {
      console.log('Video processing completed!');
      return status.data.output.video_url;
    }
    
    if (status.data.status === 'failed') {
      throw new Error(`Processing failed: ${status.data.error.message}`);
    }
    
    // Video processing takes longer
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}
```

### Multi-Face Group Photo Swap

```javascript
async function swapGroupPhoto(groupPhoto, newFaces) {
  // 1. Detect faces in group photo
  const detection = await faceswap.detectFaces(groupPhoto);
  const facesFound = detection.data.output.faces_detected;
  
  console.log(`Found ${facesFound} faces in group photo`);
  
  // 2. Prepare face swap operations
  const faceSwaps = [];
  for (let i = 0; i < Math.min(facesFound, newFaces.length); i++) {
    faceSwaps.push({
      swap_image: newFaces[i],
      target_face_index: i,
      swap_face_index: 0
    });
  }
  
  // 3. Perform multi-face swap
  const swapTask = await faceswap.multiSwap(groupPhoto, faceSwaps, {
    enhance_all: true,
    preserve_expressions: true
  });
  
  const result = await pollTask(swapTask.data.task_id);
  return result.data.output.image_url;
}

// Usage
const result = await swapGroupPhoto(
  'https://example.com/group.jpg',
  [
    'https://example.com/face1.jpg',
    'https://example.com/face2.jpg',
    'https://example.com/face3.jpg'
  ]
);
```

## File Requirements

### Input Images
- **Formats**: JPG, PNG, WebP
- **Max size**: 10MB
- **Min resolution**: 256x256px
- **Max resolution**: 4096x4096px
- **Face size**: Minimum 128x128px in image

### Input Videos
- **Formats**: MP4, AVI, MOV
- **Max size**: 100MB
- **Max duration**: 60 seconds
- **Resolution**: Up to 1920x1080px
- **Frame rate**: Up to 60 FPS

### Output Files
- **Images**: PNG format, same resolution as input
- **Videos**: MP4 format, same resolution as input
- **Expiration**: URLs expire after 7 days

## Performance Optimization

### Concurrent Processing

```javascript
// Process multiple face swaps concurrently
async function batchProcessImages(targets, swapFace) {
  const BATCH_SIZE = 5; // Respect rate limits
  const results = [];
  
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    
    const batchTasks = await Promise.all(
      batch.map(target => 
        faceswap.swapFaces(target, swapFace, { enhance: true })
      )
    );
    
    results.push(...batchTasks);
    
    // Wait between batches
    if (i + BATCH_SIZE < targets.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return results;
}
```

### Caching Strategy

```javascript
// Cache face detection results
const faceCache = new Map();

async function getCachedFaceDetection(imageUrl) {
  if (faceCache.has(imageUrl)) {
    return faceCache.get(imageUrl);
  }
  
  const detection = await faceswap.detectFaces(imageUrl);
  
  if (detection.data.status === 'completed') {
    faceCache.set(imageUrl, detection.data.output);
  }
  
  return detection.data.output;
}
```

## Troubleshooting

### Common Issues

1. **No Faces Detected**
   - Ensure image has clear, front-facing faces
   - Check image quality and resolution
   - Try with different lighting/angle

2. **Poor Swap Quality**
   - Use higher resolution input images
   - Enable face enhancement options
   - Ensure faces are similar sizes

3. **Video Processing Fails**
   - Reduce video duration
   - Lower frame rate limit
   - Use medium quality setting

### Debug Mode

```javascript
// Enable detailed logging
const task = await faceswap.swapFaces(target, swap, {
  face_enhance: true,
  debug: true
});

console.log('Processing details:', task.data.meta);
```

## Rate Limits & Concurrency

### Free Plan
- 3 concurrent tasks
- Basic quality only
- Limited daily operations

### Creator Plan ($8/month)
- 10 concurrent tasks
- All quality options
- Extended daily limits

### Pro Plan ($50/month)
- 20 concurrent tasks
- Premium processing
- Unlimited daily operations
- Priority queue

---

*For more examples and advanced usage, see the [PiAPI Faceswap Documentation](https://piapi.ai/docs/faceswap-api)*

*Last Updated: January 2025* 