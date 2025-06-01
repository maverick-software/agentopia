# Google Imagen API - Image Generation Documentation

## Overview

Google Imagen is a state-of-the-art text-to-image generation model that creates high-quality, photorealistic images from natural language descriptions. Imagen offers powerful image generation, editing, and enhancement capabilities through the Gemini API platform.

## Available Models

### Imagen 3 (Latest)
- **Capabilities**: Highest quality image generation, advanced prompt understanding
- **Resolution**: Up to 1024x1024 pixels
- **Use Cases**: Professional content creation, marketing materials, artistic generation
- **Pricing**: $0.03 per image

### Imagen 3 Fast
- **Capabilities**: Optimized for speed while maintaining quality
- **Resolution**: Up to 1024x1024 pixels
- **Use Cases**: Rapid prototyping, real-time applications, batch generation
- **Pricing**: $0.02 per image

### Imagen 2 (Previous Generation)
- **Capabilities**: Reliable image generation with good quality
- **Resolution**: Up to 1024x1024 pixels
- **Use Cases**: General purpose image generation, cost-effective projects
- **Pricing**: $0.02 per image

## Authentication & Setup

### API Key Configuration
```bash
# Environment variable
export GEMINI_API_KEY="your_api_key_here"
```

### Base URL
```
https://generativelanguage.googleapis.com/v1beta/models/imagen-3:generateImages
```

### SDK Installation
```bash
# Python
pip install google-generativeai

# Node.js
npm install @google/generative-ai
```

## Basic Image Generation

### Simple Text-to-Image
```python
import google.generativeai as genai

# Configure API key
genai.configure(api_key="your_api_key")

# Generate image
imagen = genai.ImageGenerationModel("imagen-3")
response = imagen.generate_images(
    prompt="A serene mountain landscape at sunset with snow-capped peaks",
    number_of_images=1,
    safety_filter_level="block_few",
    person_generation="allow_adult"
)

# Save image
response.images[0].save("mountain_landscape.png")
```

### REST API Request
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: ${GEMINI_API_KEY}" \
  -d '{
    "prompt": "A futuristic city skyline with flying cars and neon lights",
    "number_of_images": 1,
    "aspect_ratio": "1:1",
    "safety_filter_level": "block_few"
  }' \
  "https://generativelanguage.googleapis.com/v1beta/models/imagen-3:generateImages"
```

### Node.js Implementation
```javascript
import { GoogleAIFileManager, GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("your_api_key");

async function generateImage() {
  const imageGenModel = genAI.getGenerativeModel({
    model: "imagen-3"
  });

  const result = await imageGenModel.generateContent({
    prompt: "A cute robot painting a self-portrait in an art studio",
    numberOfImages: 1,
    aspectRatio: "1:1"
  });

  // Handle the generated image
  const image = result.response.images[0];
  console.log("Image generated successfully:", image.url);
}

generateImage();
```

## Advanced Generation Parameters

### Comprehensive Parameter Control
```python
response = imagen.generate_images(
    prompt="A majestic dragon soaring through clouds above medieval castle",
    number_of_images=4,
    aspect_ratio="16:9",
    safety_filter_level="block_few",
    person_generation="allow_adult",
    negative_prompt="blurry, low quality, cartoon, anime",
    style_preset="photographic",
    guidance_scale=7.5,
    seed=12345
)

for i, image in enumerate(response.images):
    image.save(f"dragon_castle_{i+1}.png")
```

### Aspect Ratio Options
```python
# Available aspect ratios
aspect_ratios = [
    "1:1",    # Square (1024x1024)
    "9:16",   # Portrait (576x1024)
    "16:9",   # Landscape (1024x576)
    "4:3",    # Traditional (768x1024)
    "3:4"     # Portrait (1024x768)
]

# Generate images in different formats
for ratio in aspect_ratios:
    response = imagen.generate_images(
        prompt="A beautiful garden with colorful flowers",
        aspect_ratio=ratio,
        number_of_images=1
    )
    response.images[0].save(f"garden_{ratio.replace(':', 'x')}.png")
```

### Style Presets
```python
style_presets = [
    "photographic",
    "anime",
    "digital_art",
    "fantasy_art",
    "neon_punk",
    "cyberpunk",
    "enhance",
    "cinematic"
]

for style in style_presets:
    response = imagen.generate_images(
        prompt="A warrior standing on a cliff overlooking the ocean",
        style_preset=style,
        number_of_images=1
    )
    response.images[0].save(f"warrior_{style}.png")
```

## Image Editing and Enhancement

### Image-to-Image Generation
```python
from PIL import Image

# Load base image
base_image = Image.open("original_image.jpg")

# Generate variations
response = imagen.edit_image(
    base_image=base_image,
    prompt="Transform this into a watercolor painting style",
    number_of_images=2,
    strength=0.7  # How much to change (0.0-1.0)
)

for i, image in enumerate(response.images):
    image.save(f"watercolor_variation_{i+1}.png")
```

### Inpainting (Object Removal/Addition)
```python
# Load image and mask
original_image = Image.open("photo_with_object.jpg")
mask_image = Image.open("mask.png")  # White areas will be regenerated

response = imagen.inpaint(
    image=original_image,
    mask=mask_image,
    prompt="A beautiful garden with roses and butterflies",
    number_of_images=1
)

response.images[0].save("inpainted_result.png")
```

### Outpainting (Image Extension)
```python
# Extend image beyond original boundaries
response = imagen.outpaint(
    image=base_image,
    prompt="Extend this landscape to show more of the surrounding forest",
    direction="all",  # or "left", "right", "up", "down"
    number_of_images=1
)

response.images[0].save("extended_landscape.png")
```

### Image Upscaling
```python
# Upscale image to higher resolution
original_image = Image.open("low_res_image.jpg")

response = imagen.upscale(
    image=original_image,
    upscale_factor=4,  # 2x or 4x
    prompt="A highly detailed version of this image"
)

response.images[0].save("upscaled_image.png")
```

## Prompt Engineering for Images

### Effective Prompt Structure
```python
def create_detailed_prompt(subject, setting, style, lighting, mood):
    return f"""
    {subject} in {setting}, {style} style, {lighting} lighting, {mood} mood.
    High quality, detailed, professional photography, sharp focus, 
    vibrant colors, excellent composition.
    """

# Example usage
prompt = create_detailed_prompt(
    subject="A elegant woman in a flowing red dress",
    setting="a grand ballroom with marble columns",
    style="Renaissance painting",
    lighting="golden hour",
    mood="romantic and dreamy"
)

response = imagen.generate_images(prompt=prompt, number_of_images=1)
```

### Prompt Enhancement Techniques
```python
# Base prompt
base_prompt = "A cat sitting on a windowsill"

# Enhanced prompt
enhanced_prompt = """
A beautiful, fluffy orange tabby cat sitting gracefully on a wooden windowsill,
looking out at a garden filled with colorful flowers. Soft natural lighting
filters through lace curtains, creating a warm and cozy atmosphere. 
Professional pet photography, shallow depth of field, bokeh background,
high resolution, detailed fur texture.
"""

# Quality modifiers
quality_modifiers = [
    "high quality", "4k", "8k", "professional photography",
    "award winning", "masterpiece", "highly detailed",
    "sharp focus", "perfect composition"
]

# Negative prompts to avoid
negative_prompts = [
    "blurry", "low quality", "pixelated", "distorted",
    "out of focus", "overexposed", "underexposed",
    "noisy", "grainy", "artifacts"
]
```

### Style-Specific Prompts
```python
def generate_artistic_styles():
    styles = {
        "photorealistic": "photorealistic, professional photography, DSLR, natural lighting",
        "oil_painting": "oil painting, classical art style, brush strokes visible, museum quality",
        "watercolor": "watercolor painting, soft edges, flowing colors, artistic",
        "digital_art": "digital art, concept art, highly detailed, professional illustration",
        "anime": "anime style, manga, cel shading, vibrant colors",
        "cyberpunk": "cyberpunk, neon lights, futuristic, dark atmosphere",
        "vintage": "vintage photography, film grain, retro colors, nostalgic",
        "minimalist": "minimalist, clean, simple, modern design"
    }
    
    base_subject = "A majestic lion in the African savanna"
    
    for style_name, style_prompt in styles.items():
        full_prompt = f"{base_subject}, {style_prompt}"
        response = imagen.generate_images(prompt=full_prompt, number_of_images=1)
        response.images[0].save(f"lion_{style_name}.png")
```

## Batch Processing and Automation

### Batch Image Generation
```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

class ImagenBatchProcessor:
    def __init__(self, model_name="imagen-3", max_workers=5):
        genai.configure(api_key="your_api_key")
        self.imagen = genai.ImageGenerationModel(model_name)
        self.max_workers = max_workers
    
    def generate_single(self, prompt_data):
        prompt, filename = prompt_data
        try:
            response = self.imagen.generate_images(
                prompt=prompt,
                number_of_images=1,
                safety_filter_level="block_few"
            )
            response.images[0].save(filename)
            return f"Successfully generated: {filename}"
        except Exception as e:
            return f"Failed to generate {filename}: {str(e)}"
    
    def generate_batch(self, prompt_list):
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            results = list(executor.map(self.generate_single, prompt_list))
        return results

# Usage
processor = ImagenBatchProcessor()

prompts = [
    ("A sunrise over mountains", "sunrise.png"),
    ("A city at night", "city_night.png"),
    ("A forest in autumn", "autumn_forest.png"),
    ("An ocean wave", "ocean_wave.png")
]

results = processor.generate_batch(prompts)
for result in results:
    print(result)
```

### Automated Image Series Generation
```python
def generate_image_series(base_prompt, variations, save_directory):
    """Generate a series of related images with variations."""
    import os
    
    if not os.path.exists(save_directory):
        os.makedirs(save_directory)
    
    for i, variation in enumerate(variations):
        full_prompt = f"{base_prompt}, {variation}"
        
        response = imagen.generate_images(
            prompt=full_prompt,
            number_of_images=1,
            aspect_ratio="1:1"
        )
        
        filename = f"{save_directory}/variation_{i+1:03d}.png"
        response.images[0].save(filename)
        print(f"Generated: {filename}")

# Example: Generate weather variations
base_prompt = "A beautiful landscape with rolling hills and trees"
weather_variations = [
    "on a sunny day with blue skies",
    "during a thunderstorm with dark clouds",
    "in winter with snow covering everything",
    "at sunset with golden light",
    "in fog with mysterious atmosphere",
    "during autumn with colorful leaves"
]

generate_image_series(base_prompt, weather_variations, "weather_series")
```

## Quality Control and Safety

### Safety Filter Configuration
```python
# Safety filter levels
safety_levels = {
    "block_none": "No filtering",
    "block_few": "Block obviously unsafe content",
    "block_some": "Block potentially unsafe content",
    "block_most": "Block most potentially unsafe content"
}

# Configure safety for different use cases
def safe_generate_image(prompt, use_case="general"):
    safety_configs = {
        "general": "block_some",
        "family_friendly": "block_most",
        "artistic": "block_few",
        "commercial": "block_some"
    }
    
    safety_level = safety_configs.get(use_case, "block_some")
    
    response = imagen.generate_images(
        prompt=prompt,
        safety_filter_level=safety_level,
        person_generation="allow_adult" if use_case == "artistic" else "block_all"
    )
    
    return response
```

### Content Quality Assessment
```python
from PIL import Image
import numpy as np

def assess_image_quality(image_path):
    """Basic image quality assessment."""
    image = Image.open(image_path)
    img_array = np.array(image)
    
    # Calculate basic metrics
    brightness = np.mean(img_array)
    contrast = np.std(img_array)
    
    # Check for solid colors (potential generation failure)
    unique_colors = len(np.unique(img_array.reshape(-1, img_array.shape[-1]), axis=0))
    
    quality_score = {
        "brightness": brightness,
        "contrast": contrast,
        "color_diversity": unique_colors,
        "resolution": image.size,
        "file_size": os.path.getsize(image_path)
    }
    
    return quality_score

# Quality control in generation pipeline
def generate_with_quality_control(prompt, min_quality_score=50):
    max_attempts = 3
    
    for attempt in range(max_attempts):
        response = imagen.generate_images(prompt=prompt, number_of_images=1)
        temp_file = f"temp_quality_check_{attempt}.png"
        response.images[0].save(temp_file)
        
        quality = assess_image_quality(temp_file)
        
        if quality["color_diversity"] > min_quality_score:
            return response.images[0]
        else:
            os.remove(temp_file)
            print(f"Attempt {attempt + 1} failed quality check, retrying...")
    
    print("Failed to generate image meeting quality standards")
    return None
```

## Advanced Use Cases

### Product Photography Generation
```python
def generate_product_images(product_name, background_styles, angles):
    """Generate professional product photography."""
    
    base_prompt = f"Professional product photography of {product_name}"
    
    images = []
    for background in background_styles:
        for angle in angles:
            prompt = f"""
            {base_prompt}, {angle} angle, {background} background.
            Studio lighting, high quality, commercial photography,
            clean composition, sharp focus, white balance corrected,
            professional e-commerce style.
            """
            
            response = imagen.generate_images(
                prompt=prompt,
                number_of_images=1,
                aspect_ratio="1:1",
                style_preset="photographic"
            )
            
            filename = f"{product_name}_{background}_{angle}.png".replace(" ", "_")
            response.images[0].save(filename)
            images.append(filename)
    
    return images

# Usage
product_images = generate_product_images(
    product_name="modern wireless headphones",
    background_styles=["white studio", "wooden desk", "marble surface"],
    angles=["front view", "side view", "three-quarter view"]
)
```

### Art Style Transfer Pipeline
```python
def create_art_style_variations(subject, art_styles):
    """Create the same subject in different artistic styles."""
    
    variations = {}
    
    for style in art_styles:
        style_prompts = {
            "impressionist": "impressionist painting, visible brush strokes, soft colors, artistic",
            "cubist": "cubist art style, geometric shapes, abstract, Picasso-inspired",
            "pop_art": "pop art style, bold colors, high contrast, Andy Warhol inspired",
            "surrealist": "surrealist painting, dreamlike, impossible scenes, Salvador Dali style",
            "photorealistic": "photorealistic, hyperrealistic, extremely detailed",
            "watercolor": "watercolor painting, soft edges, flowing colors",
            "oil_painting": "classical oil painting, rich colors, museum quality"
        }
        
        style_description = style_prompts.get(style, style)
        
        prompt = f"{subject}, {style_description}, masterpiece, high quality"
        
        response = imagen.generate_images(
            prompt=prompt,
            number_of_images=1,
            aspect_ratio="1:1"
        )
        
        filename = f"{style}_variation.png"
        response.images[0].save(filename)
        variations[style] = filename
    
    return variations

# Example usage
art_variations = create_art_style_variations(
    subject="A peaceful garden with a fountain and flowers",
    art_styles=["impressionist", "photorealistic", "watercolor", "oil_painting"]
)
```

### Social Media Content Generation
```python
def generate_social_media_content(topic, platforms):
    """Generate images optimized for different social media platforms."""
    
    platform_specs = {
        "instagram_post": {"aspect_ratio": "1:1", "style": "vibrant, engaging"},
        "instagram_story": {"aspect_ratio": "9:16", "style": "vertical, mobile-optimized"},
        "facebook_cover": {"aspect_ratio": "16:9", "style": "wide, professional"},
        "twitter_header": {"aspect_ratio": "3:1", "style": "horizontal banner"},
        "linkedin_post": {"aspect_ratio": "4:3", "style": "professional, business"}
    }
    
    generated_content = {}
    
    for platform in platforms:
        if platform in platform_specs:
            specs = platform_specs[platform]
            
            prompt = f"""
            {topic} for social media, {specs['style']} style.
            Eye-catching, high engagement potential, social media optimized,
            trending, shareable content, professional quality.
            """
            
            response = imagen.generate_images(
                prompt=prompt,
                aspect_ratio=specs["aspect_ratio"],
                number_of_images=1
            )
            
            filename = f"{platform}_{topic.replace(' ', '_')}.png"
            response.images[0].save(filename)
            generated_content[platform] = filename
    
    return generated_content

# Usage
social_content = generate_social_media_content(
    topic="sustainable living tips",
    platforms=["instagram_post", "facebook_cover", "linkedin_post"]
)
```

## Error Handling and Troubleshooting

### Comprehensive Error Handling
```python
import time
import random
from google.generativeai.types import BlockedPromptException

class RobustImageGenerator:
    def __init__(self, model_name="imagen-3"):
        self.imagen = genai.ImageGenerationModel(model_name)
        self.max_retries = 3
        self.base_delay = 1
    
    def generate_with_retry(self, prompt, **kwargs):
        """Generate image with retry logic and error handling."""
        
        for attempt in range(self.max_retries):
            try:
                response = self.imagen.generate_images(
                    prompt=prompt,
                    **kwargs
                )
                return response
                
            except BlockedPromptException:
                print(f"Prompt blocked by safety filters: {prompt}")
                return None
                
            except Exception as e:
                if "quota" in str(e).lower():
                    print("Quota exceeded, waiting before retry...")
                    time.sleep(60)  # Wait 1 minute for quota reset
                    
                elif "rate limit" in str(e).lower():
                    delay = self.base_delay * (2 ** attempt) + random.uniform(0, 1)
                    print(f"Rate limited, waiting {delay:.2f} seconds...")
                    time.sleep(delay)
                    
                else:
                    print(f"Attempt {attempt + 1} failed: {str(e)}")
                    if attempt == self.max_retries - 1:
                        print("All attempts failed")
                        return None
                    time.sleep(self.base_delay * (attempt + 1))
        
        return None
    
    def validate_and_generate(self, prompt, **kwargs):
        """Validate prompt and generate image."""
        
        # Prompt validation
        if len(prompt) > 1000:
            print("Warning: Prompt may be too long, truncating...")
            prompt = prompt[:1000]
        
        # Check for potentially problematic content
        blocked_terms = ["violence", "explicit", "harmful"]
        if any(term in prompt.lower() for term in blocked_terms):
            print("Warning: Prompt contains potentially blocked terms")
        
        return self.generate_with_retry(prompt, **kwargs)

# Usage
generator = RobustImageGenerator()
response = generator.validate_and_generate(
    prompt="A beautiful landscape with mountains and lakes",
    number_of_images=1,
    aspect_ratio="16:9"
)

if response:
    response.images[0].save("landscape.png")
    print("Image generated successfully")
else:
    print("Failed to generate image")
```

### Rate Limiting and Queue Management
```python
import queue
import threading
import time

class ImageGenerationQueue:
    def __init__(self, requests_per_minute=10):
        self.rpm = requests_per_minute
        self.request_queue = queue.Queue()
        self.results = {}
        self.is_running = False
        
    def add_request(self, request_id, prompt, **kwargs):
        """Add image generation request to queue."""
        self.request_queue.put({
            'id': request_id,
            'prompt': prompt,
            'kwargs': kwargs,
            'timestamp': time.time()
        })
    
    def process_queue(self):
        """Process queued requests with rate limiting."""
        self.is_running = True
        
        while self.is_running:
            try:
                # Get request from queue (wait up to 1 second)
                request = self.request_queue.get(timeout=1)
                
                # Rate limiting
                time.sleep(60 / self.rpm)
                
                # Generate image
                try:
                    response = imagen.generate_images(
                        prompt=request['prompt'],
                        **request['kwargs']
                    )
                    
                    # Save result
                    filename = f"queue_result_{request['id']}.png"
                    response.images[0].save(filename)
                    
                    self.results[request['id']] = {
                        'status': 'success',
                        'filename': filename,
                        'completed_at': time.time()
                    }
                    
                except Exception as e:
                    self.results[request['id']] = {
                        'status': 'failed',
                        'error': str(e),
                        'completed_at': time.time()
                    }
                
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
        return self.results.get(request_id, {'status': 'pending'})

# Usage
queue_manager = ImageGenerationQueue(requests_per_minute=10)
queue_manager.start_processing()

# Add requests
for i in range(5):
    queue_manager.add_request(
        request_id=f"req_{i}",
        prompt=f"A beautiful image number {i}",
        number_of_images=1
    )

# Check status
time.sleep(30)  # Wait for processing
for i in range(5):
    status = queue_manager.get_status(f"req_{i}")
    print(f"Request {i}: {status}")
```

## Performance Optimization

### Caching and Optimization
```python
import hashlib
import json
import os

class ImagenCache:
    def __init__(self, cache_dir="imagen_cache"):
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
        self.metadata_file = os.path.join(cache_dir, "cache_metadata.json")
        self.load_metadata()
    
    def load_metadata(self):
        """Load cache metadata."""
        if os.path.exists(self.metadata_file):
            with open(self.metadata_file, 'r') as f:
                self.metadata = json.load(f)
        else:
            self.metadata = {}
    
    def save_metadata(self):
        """Save cache metadata."""
        with open(self.metadata_file, 'w') as f:
            json.dump(self.metadata, f, indent=2)
    
    def get_cache_key(self, prompt, **kwargs):
        """Generate cache key from prompt and parameters."""
        cache_data = {
            'prompt': prompt,
            'kwargs': kwargs
        }
        cache_string = json.dumps(cache_data, sort_keys=True)
        return hashlib.md5(cache_string.encode()).hexdigest()
    
    def is_cached(self, cache_key):
        """Check if result is cached."""
        return cache_key in self.metadata
    
    def get_cached(self, cache_key):
        """Get cached result."""
        if self.is_cached(cache_key):
            cache_info = self.metadata[cache_key]
            cache_file = os.path.join(self.cache_dir, cache_info['filename'])
            if os.path.exists(cache_file):
                return cache_file
        return None
    
    def cache_result(self, cache_key, image, prompt):
        """Cache generation result."""
        filename = f"{cache_key}.png"
        filepath = os.path.join(self.cache_dir, filename)
        
        image.save(filepath)
        
        self.metadata[cache_key] = {
            'filename': filename,
            'prompt': prompt,
            'created_at': time.time()
        }
        
        self.save_metadata()
        return filepath

# Cached generation function
def cached_generate_image(prompt, cache=None, **kwargs):
    """Generate image with caching."""
    if cache is None:
        cache = ImagenCache()
    
    cache_key = cache.get_cache_key(prompt, **kwargs)
    
    # Check cache first
    cached_path = cache.get_cached(cache_key)
    if cached_path:
        print(f"Using cached result: {cached_path}")
        return Image.open(cached_path)
    
    # Generate new image
    print("Generating new image...")
    response = imagen.generate_images(prompt=prompt, **kwargs)
    image = response.images[0]
    
    # Cache result
    cache.cache_result(cache_key, image, prompt)
    
    return image

# Usage
cache = ImagenCache()
image = cached_generate_image(
    "A beautiful sunset over the ocean",
    cache=cache,
    number_of_images=1
)
```

## Integration Examples

### Flask Web Application
```python
from flask import Flask, request, jsonify, send_file
import io
import base64

app = Flask(__name__)

@app.route('/generate', methods=['POST'])
def generate_image():
    """API endpoint for image generation."""
    try:
        data = request.json
        prompt = data.get('prompt')
        
        if not prompt:
            return jsonify({'error': 'Prompt is required'}), 400
        
        # Generate image
        response = imagen.generate_images(
            prompt=prompt,
            number_of_images=1,
            aspect_ratio=data.get('aspect_ratio', '1:1'),
            safety_filter_level='block_some'
        )
        
        # Convert to base64
        img_buffer = io.BytesIO()
        response.images[0].save(img_buffer, format='PNG')
        img_base64 = base64.b64encode(img_buffer.getvalue()).decode()
        
        return jsonify({
            'success': True,
            'image': img_base64,
            'prompt': prompt
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/generate-file', methods=['POST'])
def generate_image_file():
    """Generate and return image file directly."""
    try:
        data = request.json
        prompt = data.get('prompt')
        
        response = imagen.generate_images(prompt=prompt, number_of_images=1)
        
        # Save to temporary buffer
        img_buffer = io.BytesIO()
        response.images[0].save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        return send_file(
            img_buffer,
            mimetype='image/png',
            as_attachment=True,
            download_name='generated_image.png'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
```

### Streamlit Application
```python
import streamlit as st
from PIL import Image
import io

st.title("Imagen Image Generator")

# Sidebar for parameters
st.sidebar.header("Generation Parameters")

prompt = st.text_area("Enter your prompt:", height=100)
aspect_ratio = st.sidebar.selectbox("Aspect Ratio", ["1:1", "16:9", "9:16", "4:3", "3:4"])
num_images = st.sidebar.slider("Number of Images", 1, 4, 1)
safety_level = st.sidebar.selectbox("Safety Level", ["block_few", "block_some", "block_most"])

if st.button("Generate Images"):
    if prompt:
        with st.spinner("Generating images..."):
            try:
                response = imagen.generate_images(
                    prompt=prompt,
                    number_of_images=num_images,
                    aspect_ratio=aspect_ratio,
                    safety_filter_level=safety_level
                )
                
                # Display generated images
                cols = st.columns(num_images)
                for i, image in enumerate(response.images):
                    with cols[i % len(cols)]:
                        st.image(image, caption=f"Generated Image {i+1}")
                        
                        # Download button
                        img_buffer = io.BytesIO()
                        image.save(img_buffer, format='PNG')
                        st.download_button(
                            label=f"Download Image {i+1}",
                            data=img_buffer.getvalue(),
                            file_name=f"generated_image_{i+1}.png",
                            mime="image/png"
                        )
                
            except Exception as e:
                st.error(f"Error generating images: {str(e)}")
    else:
        st.warning("Please enter a prompt")

# Example prompts
st.subheader("Example Prompts")
example_prompts = [
    "A serene mountain landscape at sunset",
    "A futuristic city with flying cars",
    "A cute robot in a garden",
    "Abstract art with vibrant colors"
]

for example in example_prompts:
    if st.button(example):
        st.text_area("Enter your prompt:", value=example, height=100, key=f"example_{example}")
```

This comprehensive documentation covers all aspects of using Google Imagen for image generation, from basic usage to advanced techniques and production deployment. 