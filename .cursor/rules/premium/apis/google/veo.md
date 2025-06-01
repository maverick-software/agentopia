# Google Veo API - Video Generation Documentation

## Overview

Google Veo is a cutting-edge video generation model that creates high-quality videos from text prompts or reference images. Veo offers advanced video generation capabilities including camera controls, motion effects, and audio synchronization through the Gemini API platform.

## Available Models

### Veo 3 (Latest)
- **Capabilities**: Highest quality video generation with synchronized audio
- **Resolution**: Up to 1080p
- **Duration**: Up to 60 seconds
- **Audio**: Synchronized speech and sound effects
- **Pricing**: $0.75 per second (with audio), $0.50 per second (video only)

### Veo 2
- **Capabilities**: High-quality video generation with advanced controls
- **Resolution**: Up to 1080p
- **Duration**: Up to 60 seconds
- **Features**: Camera controls, motion brush, interpolation
- **Pricing**: $0.50 per second

## Authentication & Setup

### API Key Configuration
```bash
# Environment variable
export GEMINI_API_KEY="your_api_key_here"
```

### Base URL
```
https://generativelanguage.googleapis.com/v1beta/models/veo-3:generateVideo
```

### SDK Installation
```bash
# Python
pip install google-generativeai

# Node.js
npm install @google/generative-ai
```

## Basic Video Generation

### Simple Text-to-Video
```python
import google.generativeai as genai

# Configure API key
genai.configure(api_key="your_api_key")

# Generate video
veo = genai.VideoGenerationModel("veo-3")
response = veo.generate_video(
    prompt="A majestic eagle soaring through mountain valleys at sunset",
    duration_seconds=10,
    aspect_ratio="16:9",
    quality="high"
)

# Save video
with open("eagle_video.mp4", "wb") as f:
    f.write(response.video_data)
```

### REST API Request
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: ${GEMINI_API_KEY}" \
  -d '{
    "prompt": "A bustling city street at night with neon lights and flowing traffic",
    "duration_seconds": 8,
    "aspect_ratio": "16:9",
    "quality": "high",
    "camera_motion": "pan_right"
  }' \
  "https://generativelanguage.googleapis.com/v1beta/models/veo-3:generateVideo"
```

### Node.js Implementation
```javascript
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';

const genAI = new GoogleGenerativeAI("your_api_key");

async function generateVideo() {
  const videoModel = genAI.getGenerativeModel({
    model: "veo-3"
  });

  const result = await videoModel.generateContent({
    prompt: "A peaceful ocean wave rolling onto a sandy beach",
    durationSeconds: 12,
    aspectRatio: "16:9",
    quality: "high"
  });

  // Save video file
  fs.writeFileSync("ocean_wave.mp4", result.response.videoData);
  console.log("Video generated successfully: ocean_wave.mp4");
}

generateVideo();
```

## Advanced Generation Parameters

### Comprehensive Parameter Control
```python
response = veo.generate_video(
    prompt="A magical forest with glowing fireflies dancing among ancient trees",
    duration_seconds=15,
    aspect_ratio="16:9",
    quality="ultra_high",
    fps=24,
    camera_motion="dolly_forward",
    motion_intensity="medium",
    lighting="cinematic",
    style="photorealistic",
    seed=42,
    safety_filter_level="block_few"
)

with open("magical_forest.mp4", "wb") as f:
    f.write(response.video_data)
```

### Camera Motion Controls
```python
camera_motions = [
    "static",           # No camera movement
    "pan_left",         # Pan camera to the left
    "pan_right",        # Pan camera to the right
    "tilt_up",          # Tilt camera upward
    "tilt_down",        # Tilt camera downward
    "dolly_forward",    # Move camera forward
    "dolly_backward",   # Move camera backward
    "zoom_in",          # Zoom into the scene
    "zoom_out",         # Zoom out from the scene
    "orbit_left",       # Orbit around subject left
    "orbit_right",      # Orbit around subject right
    "crane_up",         # Crane camera upward
    "crane_down"        # Crane camera downward
]

# Generate videos with different camera movements
base_prompt = "A stunning mountain landscape with snow-capped peaks"

for motion in camera_motions[:5]:  # Generate first 5 for example
    response = veo.generate_video(
        prompt=f"{base_prompt}",
        duration_seconds=8,
        camera_motion=motion,
        quality="high"
    )
    
    filename = f"mountain_{motion}.mp4"
    with open(filename, "wb") as f:
        f.write(response.video_data)
    print(f"Generated: {filename}")
```

### Aspect Ratio and Quality Options
```python
# Available aspect ratios
aspect_ratios = {
    "16:9": "Widescreen (landscape)",
    "9:16": "Portrait (mobile)",
    "1:1": "Square (social media)",
    "4:3": "Traditional TV",
    "21:9": "Cinematic ultrawide"
}

# Quality settings
quality_levels = {
    "draft": "Fast generation, lower quality",
    "standard": "Balanced quality and speed",
    "high": "High quality, slower generation",
    "ultra_high": "Maximum quality, slowest"
}

# Generate video in different formats
for ratio_key, ratio_desc in aspect_ratios.items():
    response = veo.generate_video(
        prompt="A colorful hot air balloon floating over countryside",
        duration_seconds=10,
        aspect_ratio=ratio_key,
        quality="high"
    )
    
    filename = f"balloon_{ratio_key.replace(':', 'x')}.mp4"
    with open(filename, "wb") as f:
        f.write(response.video_data)
    print(f"Generated {ratio_desc}: {filename}")
```

## Video with Audio Generation (Veo 3)

### Synchronized Audio Generation
```python
# Generate video with synchronized audio
response = veo.generate_video(
    prompt="A guitarist playing an acoustic guitar around a campfire under starry sky",
    duration_seconds=20,
    include_audio=True,
    audio_style="ambient_music",
    voice_description="warm, melodic guitar strumming",
    background_audio="crackling fire, gentle wind"
)

with open("campfire_guitar.mp4", "wb") as f:
    f.write(response.video_data)

# Extract audio track separately if needed
if hasattr(response, 'audio_data'):
    with open("campfire_guitar.wav", "wb") as f:
        f.write(response.audio_data)
```

### Dialog and Speech Generation
```python
# Generate video with speech
response = veo.generate_video(
    prompt="A news anchor delivering breaking news in a modern studio",
    duration_seconds=30,
    include_audio=True,
    speech_text="Good evening, this is breaking news from our newsroom...",
    voice_style="professional, clear, authoritative",
    background_audio="subtle newsroom ambiance"
)

with open("news_broadcast.mp4", "wb") as f:
    f.write(response.video_data)
```

### Music Video Generation
```python
def generate_music_video(song_description, music_style, duration=60):
    """Generate a music video with synchronized audio."""
    
    prompt = f"""
    A dynamic music video featuring {song_description}.
    Visual style: cinematic, high energy, professional music video production.
    Multiple camera angles, dynamic lighting, rhythm-matched editing.
    """
    
    response = veo.generate_video(
        prompt=prompt,
        duration_seconds=duration,
        include_audio=True,
        audio_style=music_style,
        camera_motion="dynamic_multi",  # Multiple camera movements
        motion_intensity="high",
        quality="ultra_high"
    )
    
    return response

# Usage
music_video = generate_music_video(
    song_description="an energetic rock band performing on stage",
    music_style="rock, electric guitars, drums, energetic",
    duration=45
)

with open("rock_performance.mp4", "wb") as f:
    f.write(music_video.video_data)
```

## Image-to-Video Generation

### Using Reference Images
```python
from PIL import Image

# Load reference image
reference_image = Image.open("starting_scene.jpg")

# Generate video starting from the image
response = veo.generate_video_from_image(
    reference_image=reference_image,
    prompt="The scene comes to life as characters begin moving and interacting",
    duration_seconds=12,
    motion_intensity="medium",
    preserve_subject=True,
    camera_motion="slight_zoom_in"
)

with open("image_to_video.mp4", "wb") as f:
    f.write(response.video_data)
```

### Character Animation
```python
def animate_character(character_image_path, animation_description):
    """Animate a character from a static image."""
    
    character_image = Image.open(character_image_path)
    
    response = veo.generate_video_from_image(
        reference_image=character_image,
        prompt=f"The character {animation_description}, maintaining consistent appearance",
        duration_seconds=8,
        motion_intensity="medium",
        preserve_character=True,
        quality="high"
    )
    
    return response

# Example usage
animated_video = animate_character(
    character_image_path="character_portrait.jpg",
    animation_description="waves hello with a warm smile, then nods approvingly"
)

with open("character_animation.mp4", "wb") as f:
    f.write(animated_video.video_data)
```

## Advanced Video Effects

### Motion Brush Controls
```python
# Define specific motion areas and directions
motion_controls = {
    "subject_motion": {
        "area": "center",           # Focus area for motion
        "direction": "up_and_down", # Motion direction
        "intensity": "gentle"       # Motion strength
    },
    "background_motion": {
        "area": "background",
        "direction": "left_to_right",
        "intensity": "subtle"
    },
    "camera_follow": True           # Camera follows main subject
}

response = veo.generate_video(
    prompt="A butterfly landing on a flower in a gentle breeze",
    duration_seconds=10,
    motion_controls=motion_controls,
    quality="high"
)

with open("butterfly_motion.mp4", "wb") as f:
    f.write(response.video_data)
```

### Temporal Effects and Transitions
```python
def create_time_lapse_video(scene_description, time_period):
    """Create time-lapse style video."""
    
    prompt = f"""
    Time-lapse of {scene_description} over {time_period}.
    Fast-forward motion, smooth transitions, professional time-lapse photography style.
    Consistent lighting changes showing passage of time.
    """
    
    response = veo.generate_video(
        prompt=prompt,
        duration_seconds=15,
        motion_intensity="time_lapse",
        camera_motion="static",
        quality="high",
        fps=30
    )
    
    return response

# Generate time-lapse videos
time_lapse = create_time_lapse_video(
    scene_description="a busy city intersection with traffic and pedestrians",
    time_period="from dawn to dusk"
)

with open("city_timelapse.mp4", "wb") as f:
    f.write(time_lapse.video_data)
```

### Style Transfer and Effects
```python
video_styles = {
    "cinematic": "film-like quality, color grading, depth of field",
    "anime": "animated style, cell shading, vibrant colors",
    "vintage": "retro film look, grain, warm colors",
    "cyberpunk": "neon lighting, futuristic, high contrast",
    "documentary": "realistic, natural lighting, handheld feel",
    "music_video": "dynamic, stylized, rhythm-matched cuts"
}

base_prompt = "A person walking through a futuristic cityscape"

for style_name, style_description in video_styles.items():
    response = veo.generate_video(
        prompt=f"{base_prompt}, {style_description}",
        duration_seconds=8,
        style=style_name,
        quality="high"
    )
    
    filename = f"cityscape_{style_name}.mp4"
    with open(filename, "wb") as f:
        f.write(response.video_data)
    print(f"Generated {style_name} style: {filename}")
```

## Video Editing and Extension

### Video Extension
```python
# Load existing video
with open("original_video.mp4", "rb") as f:
    original_video = f.read()

# Extend the video
response = veo.extend_video(
    original_video=original_video,
    extension_prompt="The scene continues as the camera reveals more of the landscape",
    extension_duration=8,
    maintain_continuity=True,
    quality="high"
)

with open("extended_video.mp4", "wb") as f:
    f.write(response.video_data)
```

### Video Interpolation
```python
# Create smooth transition between two scenes
response = veo.interpolate_video(
    start_frame_prompt="A peaceful meadow in daylight",
    end_frame_prompt="The same meadow under starry night sky",
    duration_seconds=12,
    transition_style="smooth_morph",
    quality="high"
)

with open("day_to_night_transition.mp4", "wb") as f:
    f.write(response.video_data)
```

### Video Upscaling and Enhancement
```python
# Load lower quality video
with open("low_res_video.mp4", "rb") as f:
    low_res_video = f.read()

# Upscale and enhance
response = veo.enhance_video(
    input_video=low_res_video,
    target_resolution="1080p",
    enhance_quality=True,
    stabilize_motion=True,
    reduce_noise=True
)

with open("enhanced_video.mp4", "wb") as f:
    f.write(response.video_data)
```

## Batch Processing and Automation

### Batch Video Generation
```python
import concurrent.futures
import time

class VeoBatchProcessor:
    def __init__(self, model_name="veo-3", max_workers=3):
        genai.configure(api_key="your_api_key")
        self.veo = genai.VideoGenerationModel(model_name)
        self.max_workers = max_workers
    
    def generate_single_video(self, video_spec):
        """Generate a single video from specification."""
        prompt, filename, params = video_spec
        
        try:
            response = self.veo.generate_video(
                prompt=prompt,
                **params
            )
            
            with open(filename, "wb") as f:
                f.write(response.video_data)
            
            return f"Successfully generated: {filename}"
            
        except Exception as e:
            return f"Failed to generate {filename}: {str(e)}"
    
    def generate_batch(self, video_specs):
        """Generate multiple videos in parallel."""
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Add delays to respect rate limits
            futures = []
            for i, spec in enumerate(video_specs):
                if i > 0:
                    time.sleep(2)  # Delay between submissions
                future = executor.submit(self.generate_single_video, spec)
                futures.append(future)
            
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        return results

# Usage
processor = VeoBatchProcessor()

video_specs = [
    (
        "A sunrise over mountains with morning mist",
        "sunrise.mp4",
        {"duration_seconds": 10, "quality": "high"}
    ),
    (
        "Ocean waves crashing on rocky coastline",
        "ocean_waves.mp4",
        {"duration_seconds": 12, "camera_motion": "pan_right"}
    ),
    (
        "A butterfly garden with colorful flowers",
        "butterfly_garden.mp4",
        {"duration_seconds": 15, "motion_intensity": "gentle"}
    )
]

results = processor.generate_batch(video_specs)
for result in results:
    print(result)
```

### Automated Video Series Creation
```python
def create_video_series(base_concept, variations, output_dir):
    """Create a series of related videos."""
    import os
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    videos = []
    
    for i, variation in enumerate(variations):
        full_prompt = f"{base_concept} {variation}"
        
        response = veo.generate_video(
            prompt=full_prompt,
            duration_seconds=8,
            quality="high",
            aspect_ratio="16:9"
        )
        
        filename = f"{output_dir}/video_{i+1:03d}_{variation.replace(' ', '_')}.mp4"
        
        with open(filename, "wb") as f:
            f.write(response.video_data)
        
        videos.append(filename)
        print(f"Generated: {filename}")
    
    return videos

# Example: Create weather condition series
base_concept = "A peaceful lake surrounded by forest"
weather_variations = [
    "on a sunny day with clear skies",
    "during a thunderstorm with lightning",
    "in winter with snow falling",
    "at sunset with golden light",
    "in morning fog",
    "during autumn with falling leaves"
]

video_series = create_video_series(
    base_concept,
    weather_variations,
    "weather_series"
)
```

## Quality Control and Optimization

### Video Quality Assessment
```python
import cv2
import numpy as np

def assess_video_quality(video_path):
    """Assess basic video quality metrics."""
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        return {"error": "Could not open video file"}
    
    # Get video properties
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = frame_count / fps if fps > 0 else 0
    
    # Sample frames for quality analysis
    frame_qualities = []
    sample_points = np.linspace(0, frame_count - 1, min(10, frame_count), dtype=int)
    
    for frame_num in sample_points:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        ret, frame = cap.read()
        
        if ret:
            # Calculate sharpness (Laplacian variance)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
            
            # Calculate brightness
            brightness = np.mean(gray)
            
            frame_qualities.append({
                "sharpness": sharpness,
                "brightness": brightness
            })
    
    cap.release()
    
    # Calculate averages
    avg_sharpness = np.mean([fq["sharpness"] for fq in frame_qualities])
    avg_brightness = np.mean([fq["brightness"] for fq in frame_qualities])
    
    quality_assessment = {
        "resolution": f"{width}x{height}",
        "fps": fps,
        "duration_seconds": duration,
        "frame_count": frame_count,
        "avg_sharpness": avg_sharpness,
        "avg_brightness": avg_brightness,
        "quality_score": min(100, avg_sharpness / 100)  # Normalized score
    }
    
    return quality_assessment

# Quality control in generation pipeline
def generate_with_quality_control(prompt, min_quality_score=30, max_attempts=3):
    """Generate video with quality control."""
    
    for attempt in range(max_attempts):
        print(f"Generation attempt {attempt + 1}")
        
        response = veo.generate_video(
            prompt=prompt,
            duration_seconds=10,
            quality="high"
        )
        
        # Save temporary file for assessment
        temp_file = f"temp_quality_check_{attempt}.mp4"
        with open(temp_file, "wb") as f:
            f.write(response.video_data)
        
        # Assess quality
        quality = assess_video_quality(temp_file)
        
        print(f"Quality score: {quality.get('quality_score', 0):.2f}")
        
        if quality.get('quality_score', 0) >= min_quality_score:
            print("Quality check passed!")
            return response
        else:
            os.remove(temp_file)
            print(f"Quality check failed, retrying...")
    
    print("Failed to generate video meeting quality standards")
    return None

# Usage
video_response = generate_with_quality_control(
    prompt="A majestic eagle soaring through clouds",
    min_quality_score=40
)

if video_response:
    with open("final_eagle_video.mp4", "wb") as f:
        f.write(video_response.video_data)
```

### Content Safety and Filtering
```python
def safe_video_generation(prompt, safety_level="moderate"):
    """Generate video with enhanced safety filtering."""
    
    # Safety configurations
    safety_configs = {
        "strict": {
            "safety_filter_level": "block_most",
            "content_restrictions": ["violence", "explicit", "harmful"]
        },
        "moderate": {
            "safety_filter_level": "block_some",
            "content_restrictions": ["explicit", "harmful"]
        },
        "permissive": {
            "safety_filter_level": "block_few",
            "content_restrictions": ["harmful"]
        }
    }
    
    config = safety_configs.get(safety_level, safety_configs["moderate"])
    
    # Check prompt for restricted content
    for restriction in config["content_restrictions"]:
        if restriction.lower() in prompt.lower():
            return {"error": f"Prompt contains restricted content: {restriction}"}
    
    try:
        response = veo.generate_video(
            prompt=prompt,
            duration_seconds=10,
            safety_filter_level=config["safety_filter_level"],
            quality="high"
        )
        
        return {"success": True, "video_data": response.video_data}
        
    except Exception as e:
        if "safety" in str(e).lower():
            return {"error": "Content blocked by safety filters"}
        else:
            return {"error": f"Generation failed: {str(e)}"}

# Usage
result = safe_video_generation(
    prompt="A peaceful garden with butterflies and flowers",
    safety_level="moderate"
)

if result.get("success"):
    with open("safe_garden_video.mp4", "wb") as f:
        f.write(result["video_data"])
    print("Video generated successfully with safety checks")
else:
    print(f"Generation failed: {result['error']}")
```

## Error Handling and Troubleshooting

### Robust Video Generation
```python
import time
import random
from datetime import datetime

class RobustVideoGenerator:
    def __init__(self, model_name="veo-3"):
        self.veo = genai.VideoGenerationModel(model_name)
        self.max_retries = 3
        self.base_delay = 2
        
    def generate_with_retry(self, prompt, **kwargs):
        """Generate video with comprehensive error handling."""
        
        for attempt in range(self.max_retries):
            try:
                print(f"Attempt {attempt + 1}: Generating video...")
                
                response = self.veo.generate_video(
                    prompt=prompt,
                    **kwargs
                )
                
                print("Video generated successfully!")
                return response
                
            except Exception as e:
                error_msg = str(e).lower()
                
                if "quota" in error_msg or "limit" in error_msg:
                    wait_time = 300  # 5 minutes for quota issues
                    print(f"Quota/limit exceeded. Waiting {wait_time} seconds...")
                    time.sleep(wait_time)
                    
                elif "rate" in error_msg:
                    # Exponential backoff for rate limiting
                    delay = self.base_delay * (2 ** attempt) + random.uniform(0, 2)
                    print(f"Rate limited. Waiting {delay:.2f} seconds...")
                    time.sleep(delay)
                    
                elif "safety" in error_msg or "blocked" in error_msg:
                    print("Content blocked by safety filters")
                    return None
                    
                elif "timeout" in error_msg:
                    print("Request timed out, retrying...")
                    time.sleep(self.base_delay * (attempt + 1))
                    
                else:
                    print(f"Unexpected error: {str(e)}")
                    if attempt == self.max_retries - 1:
                        print("All attempts failed")
                        return None
                    time.sleep(self.base_delay * (attempt + 1))
        
        return None
    
    def validate_and_generate(self, prompt, **kwargs):
        """Validate parameters and generate video."""
        
        # Parameter validation
        duration = kwargs.get('duration_seconds', 10)
        if duration > 60:
            print("Warning: Duration exceeds 60 seconds, setting to 60")
            kwargs['duration_seconds'] = 60
        elif duration < 1:
            print("Warning: Duration below 1 second, setting to 1")
            kwargs['duration_seconds'] = 1
            
        # Prompt validation
        if len(prompt) > 2000:
            print("Warning: Prompt too long, truncating...")
            prompt = prompt[:2000]
            
        if len(prompt.strip()) == 0:
            print("Error: Empty prompt provided")
            return None
        
        return self.generate_with_retry(prompt, **kwargs)

# Usage
generator = RobustVideoGenerator()

video_response = generator.validate_and_generate(
    prompt="A serene lake at sunset with gentle ripples on the water",
    duration_seconds=12,
    quality="high",
    aspect_ratio="16:9"
)

if video_response:
    with open("lake_sunset.mp4", "wb") as f:
        f.write(video_response.video_data)
    print("Video saved successfully!")
else:
    print("Failed to generate video")
```

### Rate Limiting and Queue Management
```python
import queue
import threading
from datetime import datetime, timedelta

class VideoGenerationQueue:
    def __init__(self, requests_per_hour=20):
        self.requests_per_hour = requests_per_hour
        self.request_queue = queue.Queue()
        self.results = {}
        self.is_running = False
        self.request_times = []
        
    def add_request(self, request_id, prompt, output_path, **kwargs):
        """Add video generation request to queue."""
        self.request_queue.put({
            'id': request_id,
            'prompt': prompt,
            'output_path': output_path,
            'kwargs': kwargs,
            'submitted_at': datetime.now()
        })
        print(f"Request {request_id} added to queue")
    
    def can_make_request(self):
        """Check if we can make a request based on rate limits."""
        now = datetime.now()
        
        # Remove requests older than 1 hour
        self.request_times = [
            req_time for req_time in self.request_times
            if now - req_time < timedelta(hours=1)
        ]
        
        return len(self.request_times) < self.requests_per_hour
    
    def wait_for_rate_limit(self):
        """Wait until we can make another request."""
        while not self.can_make_request():
            oldest_request = min(self.request_times)
            wait_until = oldest_request + timedelta(hours=1)
            wait_seconds = (wait_until - datetime.now()).total_seconds()
            
            if wait_seconds > 0:
                print(f"Rate limit reached. Waiting {wait_seconds:.0f} seconds...")
                time.sleep(min(wait_seconds, 60))  # Check every minute
    
    def process_queue(self):
        """Process queued requests with rate limiting."""
        self.is_running = True
        veo = genai.VideoGenerationModel("veo-3")
        
        while self.is_running:
            try:
                # Get request from queue
                request = self.request_queue.get(timeout=10)
                
                # Wait for rate limit if needed
                self.wait_for_rate_limit()
                
                print(f"Processing request {request['id']}...")
                
                try:
                    # Record request time
                    self.request_times.append(datetime.now())
                    
                    # Generate video
                    response = veo.generate_video(
                        prompt=request['prompt'],
                        **request['kwargs']
                    )
                    
                    # Save video
                    with open(request['output_path'], "wb") as f:
                        f.write(response.video_data)
                    
                    self.results[request['id']] = {
                        'status': 'completed',
                        'output_path': request['output_path'],
                        'completed_at': datetime.now()
                    }
                    
                    print(f"Request {request['id']} completed successfully")
                    
                except Exception as e:
                    self.results[request['id']] = {
                        'status': 'failed',
                        'error': str(e),
                        'completed_at': datetime.now()
                    }
                    
                    print(f"Request {request['id']} failed: {str(e)}")
                
                self.request_queue.task_done()
                
            except queue.Empty:
                continue
            except KeyboardInterrupt:
                break
    
    def start_processing(self):
        """Start processing queue in background thread."""
        thread = threading.Thread(target=self.process_queue)
        thread.daemon = True
        thread.start()
        return thread
    
    def stop_processing(self):
        """Stop processing queue."""
        self.is_running = False
    
    def get_status(self, request_id):
        """Get status of specific request."""
        if request_id in self.results:
            return self.results[request_id]
        else:
            return {'status': 'pending'}
    
    def get_queue_info(self):
        """Get information about the queue."""
        return {
            'queue_size': self.request_queue.qsize(),
            'completed_requests': len([r for r in self.results.values() if r['status'] == 'completed']),
            'failed_requests': len([r for r in self.results.values() if r['status'] == 'failed']),
            'requests_in_last_hour': len(self.request_times)
        }

# Usage
queue_manager = VideoGenerationQueue(requests_per_hour=15)
processing_thread = queue_manager.start_processing()

# Add multiple requests
video_requests = [
    ("A mountain sunrise", "mountain_sunrise.mp4"),
    ("Ocean waves at night", "ocean_night.mp4"),
    ("Forest in autumn", "autumn_forest.mp4"),
    ("City traffic time-lapse", "city_traffic.mp4")
]

for i, (prompt, filename) in enumerate(video_requests):
    queue_manager.add_request(
        request_id=f"video_{i+1}",
        prompt=prompt,
        output_path=filename,
        duration_seconds=10,
        quality="high"
    )

# Monitor progress
import time
while True:
    info = queue_manager.get_queue_info()
    print(f"Queue: {info['queue_size']} pending, {info['completed_requests']} completed, {info['failed_requests']} failed")
    
    if info['queue_size'] == 0 and info['completed_requests'] + info['failed_requests'] == len(video_requests):
        break
    
    time.sleep(30)  # Check every 30 seconds

queue_manager.stop_processing()
print("All requests processed!")
```

## Integration Examples

### Flask Web Application
```python
from flask import Flask, request, jsonify, send_file
import io
import base64
import threading
import uuid

app = Flask(__name__)

# Global queue manager
video_queue = VideoGenerationQueue(requests_per_hour=10)
video_queue.start_processing()

@app.route('/generate-video', methods=['POST'])
def generate_video_async():
    """Submit video generation request."""
    try:
        data = request.json
        prompt = data.get('prompt')
        
        if not prompt:
            return jsonify({'error': 'Prompt is required'}), 400
        
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        output_path = f"temp_videos/{request_id}.mp4"
        
        # Add to queue
        video_queue.add_request(
            request_id=request_id,
            prompt=prompt,
            output_path=output_path,
            duration_seconds=data.get('duration_seconds', 10),
            quality=data.get('quality', 'high'),
            aspect_ratio=data.get('aspect_ratio', '16:9')
        )
        
        return jsonify({
            'request_id': request_id,
            'status': 'queued',
            'message': 'Video generation request submitted'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/video-status/<request_id>')
def get_video_status(request_id):
    """Get status of video generation request."""
    status = video_queue.get_status(request_id)
    return jsonify(status)

@app.route('/download-video/<request_id>')
def download_video(request_id):
    """Download generated video."""
    status = video_queue.get_status(request_id)
    
    if status.get('status') == 'completed':
        return send_file(
            status['output_path'],
            as_attachment=True,
            download_name=f"generated_video_{request_id}.mp4"
        )
    else:
        return jsonify({'error': 'Video not ready or failed'}), 404

@app.route('/queue-info')
def get_queue_info():
    """Get queue information."""
    return jsonify(video_queue.get_queue_info())

if __name__ == '__main__':
    import os
    os.makedirs('temp_videos', exist_ok=True)
    app.run(debug=True)
```

### Streamlit Application
```python
import streamlit as st
import tempfile
import os

st.title("Veo Video Generator")

# Sidebar parameters
st.sidebar.header("Video Parameters")
duration = st.sidebar.slider("Duration (seconds)", 1, 60, 10)
aspect_ratio = st.sidebar.selectbox("Aspect Ratio", ["16:9", "9:16", "1:1", "4:3"])
quality = st.sidebar.selectbox("Quality", ["draft", "standard", "high", "ultra_high"])
camera_motion = st.sidebar.selectbox("Camera Motion", 
    ["static", "pan_left", "pan_right", "dolly_forward", "zoom_in"])

# Main interface
prompt = st.text_area("Enter your video prompt:", height=150)

# Example prompts
st.subheader("Example Prompts")
examples = [
    "A serene mountain lake at sunset with gentle ripples",
    "A bustling city street at night with neon lights",
    "A magical forest with glowing fireflies",
    "Ocean waves crashing on a rocky coastline"
]

col1, col2 = st.columns(2)
for i, example in enumerate(examples):
    if i % 2 == 0:
        if col1.button(f"Example {i+1}", key=f"ex_{i}"):
            prompt = example
            st.experimental_rerun()
    else:
        if col2.button(f"Example {i+1}", key=f"ex_{i}"):
            prompt = example
            st.experimental_rerun()

# Generation
if st.button("Generate Video", type="primary"):
    if prompt:
        with st.spinner("Generating video... This may take several minutes."):
            try:
                # Initialize Veo
                veo = genai.VideoGenerationModel("veo-3")
                
                # Generate video
                response = veo.generate_video(
                    prompt=prompt,
                    duration_seconds=duration,
                    aspect_ratio=aspect_ratio,
                    quality=quality,
                    camera_motion=camera_motion
                )
                
                # Save to temporary file
                with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_file:
                    tmp_file.write(response.video_data)
                    video_path = tmp_file.name
                
                # Display video
                st.success("Video generated successfully!")
                st.video(video_path)
                
                # Download button
                with open(video_path, 'rb') as video_file:
                    st.download_button(
                        label="Download Video",
                        data=video_file.read(),
                        file_name="generated_video.mp4",
                        mime="video/mp4"
                    )
                
                # Clean up
                os.unlink(video_path)
                
            except Exception as e:
                st.error(f"Error generating video: {str(e)}")
    else:
        st.warning("Please enter a prompt")

# Display generation info
st.sidebar.subheader("Generation Info")
st.sidebar.info(f"""
**Parameters:**
- Duration: {duration} seconds
- Aspect Ratio: {aspect_ratio}
- Quality: {quality}
- Camera Motion: {camera_motion}
""")
```

This comprehensive documentation covers all aspects of using Google Veo for video generation, from basic usage to advanced techniques and production deployment. 