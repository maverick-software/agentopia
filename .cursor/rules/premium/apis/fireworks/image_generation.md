# Fireworks AI - Image Generation SOP

## Overview
**Version:** 2.0  
**Last Updated:** May 2025  
**Service Category:** Image Generation & Visual AI  
**Purpose:** Comprehensive implementation guide for Fireworks AI's image generation models including FLUX.1, SDXL variants, customization options, and production deployment patterns.

---

## 🎯 SUPPORTED MODELS & CAPABILITIES

### 🔥 **FLUX.1 Series (Flagship Models)**
#### FLUX.1 [dev] FP8
- **Model ID:** `accounts/fireworks/models/flux-1-dev-fp8`
- **Pricing:** $0.0005 per step ($0.014 per default image at 28 steps)
- **Parameters:** 12 billion parameters, hybrid architecture
- **Features:** Best quality, commercial use enabled, flow matching
- **Resolution:** 1024x1024 base, supports multiple aspect ratios
- **Strengths:** Exceptional detail, prompt adherence, style diversity

#### FLUX.1 [schnell] FP8
- **Model ID:** `accounts/fireworks/models/flux-1-schnell-fp8`
- **Pricing:** $0.00035 per step ($0.0014 per default image at 4 steps)
- **Features:** Fastest variant, ideal for prototyping and high-volume
- **Steps:** Optimized for 4-step generation
- **Use Cases:** Real-time applications, batch generation, cost optimization

### 🎨 **Stable Diffusion XL (SDXL) Series**
#### SDXL 1024 v1.0
- **Model ID:** `accounts/fireworks/models/stable-diffusion-xl-1024-v1-0`
- **Pricing:** $0.00013 per step
- **Resolution:** 1024x1024 base, multiple aspect ratios supported
- **Features:** Mature model, wide LoRA ecosystem, reliable results

#### Playground v2.5 1024px Aesthetic
- **Model ID:** `accounts/fireworks/models/playground-v2-5-1024px-aesthetic`
- **Features:** Enhanced aesthetic quality, vibrant colors, artistic styles
- **Specialty:** Commercial photography, marketing materials

#### Japanese Stable Diffusion XL
- **Model ID:** `accounts/fireworks/models/japanese-stable-diffusion-xl`
- **Features:** Optimized for Japanese text, anime styles, cultural accuracy
- **Specialty:** Anime, manga, Japanese cultural content

#### SSD-1B (Segmind)
- **Model ID:** `accounts/fireworks/models/SSD-1B`
- **Features:** Distilled SDXL model, faster generation, smaller size
- **Use Cases:** Mobile applications, edge deployment

### 📐 **Supported Resolutions & Aspect Ratios**

#### FLUX.1 Models
| Aspect Ratio | Resolution Examples | Use Cases |
|--------------|-------------------|-----------|
| 1:1 | 1024x1024 | Social media, avatars, logos |
| 2:3 | 832x1248 | Portrait photography, mobile |
| 3:2 | 1248x832 | Landscape photography, prints |
| 4:5 | 896x1120 | Instagram posts, product shots |
| 5:4 | 1120x896 | Traditional photography format |
| 16:9 | 1344x768 | Widescreen, presentations, banners |
| 9:16 | 768x1344 | Vertical video, mobile stories |
| 9:21 | 640x1536 | Ultra-tall formats, infographics |
| 21:9 | 1536x640 | Ultrawide, cinematic scenes |

#### SDXL Models
| Resolution | Use Cases |
|------------|-----------|
| 640x1536 | Ultra-tall portraits |
| 768x1344 | Mobile-optimized portraits |
| 832x1216 | Standard portrait |
| 896x1152 | Slightly wide portrait |
| 1024x1024 | Square format (default) |
| 1152x896 | Slightly wide landscape |
| 1216x832 | Standard landscape |
| 1344x768 | Wide landscape |
| 1536x640 | Ultra-wide landscape |

---

## 🔧 IMPLEMENTATION PATTERNS

### Basic Image Generation
```javascript
// Basic FLUX.1 [dev] image generation
async function generateImage(prompt, options = {}) {
  const response = await fetch('https://api.fireworks.ai/inference/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'accounts/fireworks/models/flux-1-dev-fp8',
      prompt: prompt,
      n: options.count || 1,
      size: options.size || '1024x1024',
      steps: options.steps || 28,
      guidance_scale: options.guidance || 3.5,
      seed: options.seed,
      response_format: 'b64_json'
    })
  });

  const data = await response.json();
  return data.data.map(img => img.b64_json);
}

// Usage examples
const portrait = await generateImage(
  "Professional headshot of a confident business executive, studio lighting, high resolution",
  { size: '832x1248', steps: 28, guidance: 3.5 }
);

const landscape = await generateImage(
  "Serene mountain landscape at golden hour, misty valleys, dramatic lighting",
  { size: '1344x768', steps: 20, guidance: 4.0 }
);
```

### Python SDK Implementation
```python
import requests
import base64
import json
from io import BytesIO
from PIL import Image

class FireworksImageGenerator:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.fireworks.ai/inference/v1'
    
    def generate_image(self, prompt, model='accounts/fireworks/models/flux-1-dev-fp8', **kwargs):
        """
        Generate images using Fireworks AI models
        """
        payload = {
            'model': model,
            'prompt': prompt,
            'n': kwargs.get('n', 1),
            'size': kwargs.get('size', '1024x1024'),
            'steps': kwargs.get('steps', 28),
            'guidance_scale': kwargs.get('guidance_scale', 3.5),
            'response_format': 'b64_json'
        }
        
        # Add optional parameters
        if 'seed' in kwargs:
            payload['seed'] = kwargs['seed']
        
        response = requests.post(
            f'{self.base_url}/images/generations',
            headers={
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            },
            json=payload
        )
        
        response.raise_for_status()
        return response.json()
    
    def save_images(self, response_data, base_filename='generated_image'):
        """Save generated images to files"""
        saved_files = []
        
        for i, image_data in enumerate(response_data['data']):
            # Decode base64 image
            image_bytes = base64.b64decode(image_data['b64_json'])
            image = Image.open(BytesIO(image_bytes))
            
            # Save image
            filename = f"{base_filename}_{i+1}.png"
            image.save(filename)
            saved_files.append(filename)
        
        return saved_files

# Usage example
generator = FireworksImageGenerator('your_api_key_here')

# High-quality portrait
portrait_response = generator.generate_image(
    prompt="Portrait of a young artist in their studio, natural lighting, oil painting style",
    model='accounts/fireworks/models/flux-1-dev-fp8',
    size='832x1248',
    steps=30,
    guidance_scale=4.0,
    seed=12345
)

# Save images
files = generator.save_images(portrait_response, 'artist_portrait')
print(f"Generated images: {files}")
```

### Batch Generation for Multiple Variants
```python
import asyncio
import aiohttp

async def batch_generate_variants(prompt, variations, api_key):
    """
    Generate multiple style variations of the same prompt concurrently
    """
    async def single_generation(session, variant):
        payload = {
            'model': 'accounts/fireworks/models/flux-1-dev-fp8',
            'prompt': f"{prompt}, {variant['style']}",
            'size': variant.get('size', '1024x1024'),
            'steps': variant.get('steps', 28),
            'guidance_scale': variant.get('guidance', 3.5),
            'seed': variant.get('seed'),
            'response_format': 'b64_json'
        }
        
        async with session.post(
            'https://api.fireworks.ai/inference/v1/images/generations',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json=payload
        ) as response:
            data = await response.json()
            return {
                'variant': variant['name'],
                'images': data['data']
            }
    
    async with aiohttp.ClientSession() as session:
        tasks = [single_generation(session, variant) for variant in variations]
        results = await asyncio.gather(*tasks)
        return results

# Usage example
base_prompt = "A futuristic cityscape at sunset"
style_variations = [
    {'name': 'cyberpunk', 'style': 'cyberpunk aesthetic, neon lights, dark atmosphere'},
    {'name': 'minimalist', 'style': 'minimalist design, clean lines, soft colors'},
    {'name': 'photorealistic', 'style': 'photorealistic, detailed architecture, HDR'},
    {'name': 'artistic', 'style': 'artistic painting style, impressionist, vibrant colors'}
]

results = asyncio.run(batch_generate_variants(
    base_prompt, 
    style_variations, 
    'your_api_key_here'
))

for result in results:
    print(f"Generated {result['variant']} variant with {len(result['images'])} images")
```

---

## 🛠️ ADVANCED FEATURES

### Model-Specific Optimization
```python
def optimize_parameters_for_model(model_name, use_case):
    """
    Optimize generation parameters based on model and use case
    """
    if 'flux-1-dev' in model_name:
        if use_case == 'portrait':
            return {
                'steps': 28,
                'guidance_scale': 3.5,
                'size': '832x1248'
            }
        elif use_case == 'landscape':
            return {
                'steps': 25,
                'guidance_scale': 4.0,
                'size': '1344x768'
            }
        elif use_case == 'artistic':
            return {
                'steps': 35,
                'guidance_scale': 5.0,
                'size': '1024x1024'
            }
    
    elif 'flux-1-schnell' in model_name:
        # Optimized for speed
        return {
            'steps': 4,
            'guidance_scale': 2.0,
            'size': '1024x1024'
        }
    
    elif 'stable-diffusion-xl' in model_name:
        return {
            'steps': 30,
            'guidance_scale': 7.0,
            'size': '1024x1024'
        }
    
    # Default parameters
    return {
        'steps': 20,
        'guidance_scale': 3.5,
        'size': '1024x1024'
    }

# Usage
portrait_params = optimize_parameters_for_model(
    'accounts/fireworks/models/flux-1-dev-fp8', 
    'portrait'
)
```

### Smart Prompt Enhancement
```python
import re

class PromptEnhancer:
    def __init__(self):
        self.style_keywords = {
            'photorealistic': ['highly detailed', 'sharp focus', 'professional photography'],
            'artistic': ['oil painting', 'brush strokes', 'artistic composition'],
            'cinematic': ['cinematic lighting', 'film grain', 'dramatic atmosphere'],
            'portrait': ['studio lighting', 'shallow depth of field', 'professional headshot']
        }
        
        self.quality_boosters = [
            'high resolution',
            'masterpiece',
            'best quality',
            'highly detailed'
        ]
    
    def enhance_prompt(self, base_prompt, style='photorealistic', add_quality=True):
        """Enhance prompt with style and quality keywords"""
        enhanced = base_prompt
        
        # Add style-specific keywords
        if style in self.style_keywords:
            style_words = ', '.join(self.style_keywords[style])
            enhanced = f"{enhanced}, {style_words}"
        
        # Add quality boosters
        if add_quality:
            quality_words = ', '.join(self.quality_boosters)
            enhanced = f"{enhanced}, {quality_words}"
        
        return enhanced
    
    def generate_negative_prompt(self, avoid_list=None):
        """Generate negative prompt to avoid common issues"""
        default_negatives = [
            'blurry',
            'low quality',
            'distorted',
            'artifacts',
            'oversaturated',
            'extra limbs',
            'deformed hands'
        ]
        
        if avoid_list:
            default_negatives.extend(avoid_list)
        
        return ', '.join(default_negatives)

# Usage
enhancer = PromptEnhancer()

# Enhance for different styles
base_prompt = "A woman reading a book in a coffee shop"

photorealistic = enhancer.enhance_prompt(base_prompt, 'photorealistic')
artistic = enhancer.enhance_prompt(base_prompt, 'artistic')
cinematic = enhancer.enhance_prompt(base_prompt, 'cinematic')

print("Photorealistic:", photorealistic)
print("Artistic:", artistic)
print("Cinematic:", cinematic)

# Generate negative prompt
negative = enhancer.generate_negative_prompt(['cartoon', 'anime'])
print("Negative prompt:", negative)
```

### Image-to-Image and Inpainting (Coming Soon)
```python
# Note: These features are in development for FLUX models on Fireworks
class AdvancedImageGeneration:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.fireworks.ai/inference/v1'
    
    def img2img(self, init_image_path, prompt, strength=0.75, **kwargs):
        """
        Image-to-image generation (when available)
        """
        # This will be available in future updates
        pass
    
    def inpaint(self, image_path, mask_path, prompt, **kwargs):
        """
        Inpainting functionality (when available)
        """
        # This will be available in future updates
        pass
    
    def outpaint(self, image_path, expand_directions, prompt, **kwargs):
        """
        Outpainting functionality (when available)
        """
        # This will be available in future updates
        pass
```

---

## ⚡ PERFORMANCE OPTIMIZATION

### Cost-Effective Generation Strategies
```python
class CostOptimizedGenerator:
    def __init__(self, api_key):
        self.api_key = api_key
        self.model_costs = {
            'flux-1-dev-fp8': 0.0005,      # per step
            'flux-1-schnell-fp8': 0.00035,  # per step
            'stable-diffusion-xl': 0.00013  # per step
        }
    
    def choose_optimal_model(self, quality_requirement, budget_per_image):
        """Choose the best model based on quality needs and budget"""
        
        if quality_requirement == 'highest' and budget_per_image >= 0.015:
            return {
                'model': 'accounts/fireworks/models/flux-1-dev-fp8',
                'steps': 28,
                'estimated_cost': 0.014
            }
        elif quality_requirement == 'good' and budget_per_image >= 0.002:
            return {
                'model': 'accounts/fireworks/models/flux-1-schnell-fp8',
                'steps': 4,
                'estimated_cost': 0.0014
            }
        elif budget_per_image <= 0.004:
            return {
                'model': 'accounts/fireworks/models/stable-diffusion-xl-1024-v1-0',
                'steps': 30,
                'estimated_cost': 0.0039
            }
        else:
            return {
                'model': 'accounts/fireworks/models/flux-1-schnell-fp8',
                'steps': 6,
                'estimated_cost': 0.0021
            }
    
    def batch_optimize(self, prompts, total_budget):
        """Optimize batch generation within budget constraints"""
        cost_per_image = total_budget / len(prompts)
        
        # Choose model configuration
        config = self.choose_optimal_model('good', cost_per_image)
        
        return {
            'recommended_config': config,
            'total_estimated_cost': config['estimated_cost'] * len(prompts),
            'images_per_dollar': 1 / config['estimated_cost']
        }

# Usage example
optimizer = CostOptimizedGenerator('your_api_key')

# Optimize for different scenarios
high_quality_config = optimizer.choose_optimal_model('highest', 0.02)
budget_config = optimizer.choose_optimal_model('good', 0.005)

print("High quality config:", high_quality_config)
print("Budget config:", budget_config)

# Batch optimization
prompts = ["cat", "dog", "bird", "fish"] * 25  # 100 prompts
batch_config = optimizer.batch_optimize(prompts, 5.00)  # $5 budget
print("Batch config:", batch_config)
```

### Performance Monitoring
```python
import time
import logging
from datetime import datetime

class ImageGenerationTracker:
    def __init__(self, log_file="image_generation.log"):
        logging.basicConfig(
            filename=log_file,
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
    
    def track_generation(self, model, prompt, params, generation_time, cost=None):
        """Track image generation metrics"""
        usage_data = {
            "timestamp": datetime.now().isoformat(),
            "model": model,
            "prompt_length": len(prompt),
            "parameters": params,
            "generation_time_seconds": generation_time,
            "estimated_cost": cost,
            "images_per_second": params.get('n', 1) / generation_time if generation_time > 0 else 0
        }
        
        self.logger.info(f"IMAGE_GENERATION: {usage_data}")
        return usage_data
    
    def calculate_cost(self, model, steps, num_images=1):
        """Calculate estimated cost for image generation"""
        cost_per_step = {
            'flux-1-dev-fp8': 0.0005,
            'flux-1-schnell-fp8': 0.00035,
            'stable-diffusion-xl': 0.00013
        }
        
        model_key = None
        for key in cost_per_step:
            if key in model:
                model_key = key
                break
        
        if model_key:
            return cost_per_step[model_key] * steps * num_images
        return None

# Usage example
tracker = ImageGenerationTracker()

def tracked_generation(prompt, **kwargs):
    start_time = time.time()
    
    # Make API request here
    response = generate_image(prompt, **kwargs)
    
    end_time = time.time()
    generation_time = end_time - start_time
    
    # Calculate cost
    cost = tracker.calculate_cost(
        kwargs.get('model', 'flux-1-dev-fp8'),
        kwargs.get('steps', 28),
        kwargs.get('n', 1)
    )
    
    # Track metrics
    tracker.track_generation(
        kwargs.get('model', 'flux-1-dev-fp8'),
        prompt,
        kwargs,
        generation_time,
        cost
    )
    
    return response
```

---

## 🔒 CONTENT SAFETY & FILTERING

### Content Moderation Pipeline
```python
import re
import requests

class ContentSafetyFilter:
    def __init__(self):
        self.prohibited_keywords = [
            # Add your prohibited content keywords here
            'violence', 'explicit', 'harmful'
        ]
        
        self.warning_keywords = [
            # Keywords that require review
            'weapon', 'drug', 'political'
        ]
    
    def check_prompt_safety(self, prompt):
        """Check if prompt contains prohibited content"""
        prompt_lower = prompt.lower()
        
        # Check for prohibited content
        for keyword in self.prohibited_keywords:
            if keyword in prompt_lower:
                return {
                    'safe': False,
                    'reason': f'Contains prohibited keyword: {keyword}',
                    'action': 'reject'
                }
        
        # Check for content requiring review
        warnings = []
        for keyword in self.warning_keywords:
            if keyword in prompt_lower:
                warnings.append(keyword)
        
        if warnings:
            return {
                'safe': True,
                'warnings': warnings,
                'action': 'review'
            }
        
        return {
            'safe': True,
            'action': 'proceed'
        }
    
    def moderate_generated_image(self, image_data):
        """
        Moderate generated image content
        This would integrate with external moderation services
        """
        # Implement image content moderation here
        # This could use services like AWS Rekognition, Google Vision API, etc.
        pass

# Usage
safety_filter = ContentSafetyFilter()

def safe_generate_image(prompt, **kwargs):
    """Generate image with content safety checks"""
    
    # Check prompt safety
    safety_check = safety_filter.check_prompt_safety(prompt)
    
    if not safety_check['safe']:
        raise ValueError(f"Prompt rejected: {safety_check['reason']}")
    
    if safety_check['action'] == 'review':
        print(f"Warning: Prompt contains sensitive keywords: {safety_check['warnings']}")
    
    # Proceed with generation
    return generate_image(prompt, **kwargs)
```

---

## 🚀 PRODUCTION DEPLOYMENT

### Express.js Image Generation Server
```javascript
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const sharp = require('sharp');

const app = express();

// Security and rate limiting
app.use(helmet());
app.use(express.json({ limit: '10mb' }));

const imageGenLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: 'Too many image generation requests, please try again later.'
});

app.use('/api/generate', imageGenLimit);

// Image generation endpoint
app.post('/api/generate', async (req, res) => {
  try {
    const { 
      prompt, 
      model = 'accounts/fireworks/models/flux-1-dev-fp8',
      size = '1024x1024',
      steps = 28,
      guidance_scale = 3.5,
      n = 1,
      seed
    } = req.body;

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Valid prompt is required' });
    }

    if (prompt.length > 1000) {
      return res.status(400).json({ error: 'Prompt too long (max 1000 characters)' });
    }

    // Generate image
    const response = await fetch('https://api.fireworks.ai/inference/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FIREWORKS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        prompt,
        n,
        size,
        steps,
        guidance_scale,
        seed,
        response_format: 'b64_json'
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Optionally process images (resize, watermark, etc.)
    const processedImages = await Promise.all(
      data.data.map(async (img) => {
        const buffer = Buffer.from(img.b64_json, 'base64');
        
        // Optional: Add watermark or resize
        const processed = await sharp(buffer)
          .resize(null, null, { withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer();
        
        return {
          b64_json: processed.toString('base64'),
          format: 'jpeg'
        };
      })
    );

    res.json({
      images: processedImages,
      prompt,
      model,
      parameters: { size, steps, guidance_scale, seed }
    });

  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ 
      error: 'Image generation failed',
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'image-generation' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Image generation server running on port ${PORT}`);
});
```

### Docker Configuration
```dockerfile
# Dockerfile for Fireworks AI image generation service
FROM node:18-alpine

WORKDIR /app

# Install dependencies for image processing
RUN apk add --no-cache \
    vips-dev \
    python3 \
    make \
    g++

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000

USER node

CMD ["node", "server.js"]
```

### Kubernetes Deployment
```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fireworks-image-gen
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fireworks-image-gen
  template:
    metadata:
      labels:
        app: fireworks-image-gen
    spec:
      containers:
      - name: image-gen
        image: your-registry/fireworks-image-gen:latest
        ports:
        - containerPort: 3000
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
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: fireworks-image-gen-service
spec:
  selector:
    app: fireworks-image-gen
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

---

## 📊 MODEL COMPARISON & BENCHMARKS

### Performance Metrics (May 2025)
| Model | Cost per Image | Generation Time | Quality Score | Best Use Cases |
|-------|----------------|-----------------|---------------|----------------|
| FLUX.1 [dev] FP8 | $0.014 (28 steps) | ~8-12s | 9.5/10 | Professional photography, marketing, high-quality art |
| FLUX.1 [schnell] FP8 | $0.0014 (4 steps) | ~2-3s | 8.5/10 | Prototyping, real-time applications, high-volume |
| SDXL 1024 v1.0 | $0.0039 (30 steps) | ~6-8s | 8.0/10 | General purpose, LoRA compatibility |
| Playground v2.5 | $0.0039 (30 steps) | ~6-8s | 8.2/10 | Aesthetic content, vibrant imagery |

### Quality Comparison Guide
```python
def recommend_model(use_case, budget_per_image, quality_priority):
    """
    Recommend optimal model based on requirements
    """
    recommendations = {
        'commercial_photography': {
            'high_budget': 'flux-1-dev-fp8',
            'medium_budget': 'flux-1-schnell-fp8',
            'low_budget': 'playground-v2-5'
        },
        'social_media': {
            'high_budget': 'flux-1-dev-fp8',
            'medium_budget': 'flux-1-schnell-fp8',
            'low_budget': 'stable-diffusion-xl'
        },
        'prototyping': {
            'any_budget': 'flux-1-schnell-fp8'
        },
        'artistic_creation': {
            'high_budget': 'flux-1-dev-fp8',
            'medium_budget': 'playground-v2-5',
            'low_budget': 'stable-diffusion-xl'
        }
    }
    
    budget_tier = 'high_budget' if budget_per_image > 0.01 else 'medium_budget' if budget_per_image > 0.003 else 'low_budget'
    
    if use_case in recommendations:
        return recommendations[use_case].get(budget_tier, recommendations[use_case].get('any_budget'))
    
    return 'flux-1-schnell-fp8'  # Default recommendation
```

---

## 🔄 MIGRATION & INTEGRATION

### OpenAI DALL-E to Fireworks Migration
```python
# Migration helper for OpenAI DALL-E users
class FireworksMigrationHelper:
    def __init__(self, fireworks_api_key):
        self.api_key = fireworks_api_key
        self.size_mapping = {
            '256x256': '640x640',    # Upscale to supported size
            '512x512': '640x640',    # Upscale to supported size
            '1024x1024': '1024x1024',  # Direct mapping
            '1792x1024': '1344x768',   # Closest aspect ratio
            '1024x1792': '768x1344'    # Closest aspect ratio
        }
    
    def migrate_dalle_request(self, dalle_params):
        """Convert DALL-E parameters to Fireworks format"""
        fireworks_params = {
            'model': 'accounts/fireworks/models/flux-1-dev-fp8',
            'prompt': dalle_params['prompt'],
            'n': dalle_params.get('n', 1),
            'size': self.size_mapping.get(dalle_params.get('size', '1024x1024'), '1024x1024'),
            'response_format': 'b64_json'
        }
        
        # Map quality to steps (DALL-E doesn't have steps)
        if dalle_params.get('quality') == 'hd':
            fireworks_params['steps'] = 35
            fireworks_params['guidance_scale'] = 4.0
        else:
            fireworks_params['steps'] = 28
            fireworks_params['guidance_scale'] = 3.5
        
        return fireworks_params

# Usage
migrator = FireworksMigrationHelper('your_api_key')

dalle_request = {
    'prompt': 'A sunset over mountains',
    'n': 2,
    'size': '1024x1024',
    'quality': 'hd'
}

fireworks_request = migrator.migrate_dalle_request(dalle_request)
print("Migrated request:", fireworks_request)
```

---

## 📝 TROUBLESHOOTING GUIDE

### Common Issues and Solutions

#### 1. **Generation Taking Too Long**
```python
# Solution: Use faster models or reduce steps
def optimize_for_speed(original_params):
    optimized = original_params.copy()
    
    # Switch to faster model
    if 'flux-1-dev' in optimized['model']:
        optimized['model'] = 'accounts/fireworks/models/flux-1-schnell-fp8'
        optimized['steps'] = 4
    
    # Reduce steps for other models
    elif optimized.get('steps', 20) > 20:
        optimized['steps'] = max(optimized['steps'] // 2, 10)
    
    return optimized
```

#### 2. **Low Quality Results**
```python
# Solution: Optimize parameters for quality
def optimize_for_quality(original_params):
    optimized = original_params.copy()
    
    # Use highest quality model
    optimized['model'] = 'accounts/fireworks/models/flux-1-dev-fp8'
    
    # Increase steps and guidance
    optimized['steps'] = max(optimized.get('steps', 28), 28)
    optimized['guidance_scale'] = max(optimized.get('guidance_scale', 3.5), 4.0)
    
    return optimized
```

#### 3. **Rate Limiting Issues**
```python
# Solution: Implement proper rate limiting and retries
import time
import random

def generate_with_retry(params, max_retries=3):
    for attempt in range(max_retries):
        try:
            return generate_image(**params)
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                print(f"Rate limited. Waiting {wait_time:.2f} seconds...")
                time.sleep(wait_time)
            else:
                raise
    
    raise Exception("Max retries exceeded")
```

---

*This SOP provides comprehensive guidance for implementing Fireworks AI's image generation models in production environments. For the latest model updates and features, refer to the Fireworks AI documentation and blog.* 