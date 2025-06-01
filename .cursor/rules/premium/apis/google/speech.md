# Google Speech Generation API Documentation

## Overview

Google's Speech Generation API provides advanced text-to-speech (TTS) capabilities through the Gemini platform. The API offers natural-sounding speech synthesis with multiple voice options, language support, and audio customization features for creating high-quality spoken content.

## Available Models

### Gemini 2.5 Flash TTS
- **Capabilities**: Fast, cost-effective speech synthesis
- **Voices**: 30+ voice options
- **Languages**: 24+ languages supported
- **Quality**: Standard to high quality
- **Pricing**: $0.50 per 1M input tokens

### Gemini 2.5 Pro TTS
- **Capabilities**: Premium quality speech synthesis
- **Voices**: Full voice library with enhanced naturalness
- **Languages**: 24+ languages with regional variants
- **Quality**: High to ultra-high quality
- **Pricing**: $1.00 per 1M input tokens

## Authentication & Setup

### API Key Configuration
```bash
# Environment variable
export GEMINI_API_KEY="your_api_key_here"
```

### Base URL
```
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateSpeech
```

### SDK Installation
```bash
# Python
pip install google-generativeai

# Node.js
npm install @google/generative-ai
```

## Basic Speech Generation

### Simple Text-to-Speech
```python
import google.generativeai as genai

# Configure API key
genai.configure(api_key="your_api_key")

# Generate speech
tts = genai.SpeechGenerationModel("gemini-2.5-flash")
response = tts.generate_speech(
    text="Hello, welcome to our advanced text-to-speech demonstration.",
    voice="en-US-Neural2-F",
    speaking_rate=1.0,
    pitch=0.0,
    volume_gain_db=0.0
)

# Save audio
with open("greeting.wav", "wb") as f:
    f.write(response.audio_data)
```

### REST API Request
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: ${GEMINI_API_KEY}" \
  -d '{
    "text": "This is a sample text for speech generation.",
    "voice": "en-US-Neural2-D",
    "speaking_rate": 1.0,
    "pitch": 0.0,
    "audio_format": "wav"
  }' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateSpeech"
```

### Node.js Implementation
```javascript
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';

const genAI = new GoogleGenerativeAI("your_api_key");

async function generateSpeech() {
  const speechModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-tts"
  });

  const result = await speechModel.generateContent({
    text: "Welcome to our text-to-speech service powered by Google AI",
    voice: "en-US-Neural2-F",
    speakingRate: 1.0,
    pitch: 0.0
  });

  // Save audio file
  fs.writeFileSync("welcome.wav", result.response.audioData);
  console.log("Speech generated successfully: welcome.wav");
}

generateSpeech();
```

## Voice Options and Languages

### Available Voices by Language

#### English (US)
```python
us_voices = {
    "en-US-Neural2-A": "Male, deep and authoritative",
    "en-US-Neural2-C": "Female, warm and friendly", 
    "en-US-Neural2-D": "Male, professional and clear",
    "en-US-Neural2-E": "Female, youthful and energetic",
    "en-US-Neural2-F": "Female, sophisticated and calm",
    "en-US-Neural2-G": "Female, confident and articulate",
    "en-US-Neural2-H": "Female, expressive and dynamic",
    "en-US-Neural2-I": "Male, casual and conversational",
    "en-US-Neural2-J": "Male, mature and reliable"
}

# Generate samples for each voice
text = "Hello, this is a demonstration of voice quality and characteristics."

for voice_id, description in us_voices.items():
    response = tts.generate_speech(
        text=text,
        voice=voice_id,
        speaking_rate=1.0
    )
    
    filename = f"voice_sample_{voice_id.replace('-', '_')}.wav"
    with open(filename, "wb") as f:
        f.write(response.audio_data)
    
    print(f"Generated {voice_id}: {description}")
```

#### English (UK)
```python
uk_voices = {
    "en-GB-Neural2-A": "Female, British accent, professional",
    "en-GB-Neural2-B": "Male, British accent, refined",
    "en-GB-Neural2-C": "Female, British accent, warm",
    "en-GB-Neural2-D": "Male, British accent, authoritative"
}
```

#### Spanish
```python
spanish_voices = {
    "es-ES-Neural2-A": "Female, Spain Spanish, elegant",
    "es-ES-Neural2-B": "Male, Spain Spanish, confident",
    "es-US-Neural2-A": "Female, Latin American Spanish, warm",
    "es-US-Neural2-B": "Male, Latin American Spanish, professional"
}
```

#### French
```python
french_voices = {
    "fr-FR-Neural2-A": "Female, French accent, sophisticated",
    "fr-FR-Neural2-B": "Male, French accent, articulate",
    "fr-CA-Neural2-A": "Female, Canadian French, friendly",
    "fr-CA-Neural2-B": "Male, Canadian French, clear"
}
```

### Multi-Language Support
```python
multilingual_demo = {
    "en-US": ("Hello, welcome to our global service.", "en-US-Neural2-F"),
    "es-ES": ("Hola, bienvenido a nuestro servicio global.", "es-ES-Neural2-A"),
    "fr-FR": ("Bonjour, bienvenue dans notre service mondial.", "fr-FR-Neural2-A"),
    "de-DE": ("Hallo, willkommen bei unserem globalen Service.", "de-DE-Neural2-A"),
    "it-IT": ("Ciao, benvenuto nel nostro servizio globale.", "it-IT-Neural2-A"),
    "pt-BR": ("Olá, bem-vindo ao nosso serviço global.", "pt-BR-Neural2-A"),
    "ja-JP": ("こんにちは、私たちのグローバルサービスへようこそ。", "ja-JP-Neural2-A"),
    "ko-KR": ("안녕하세요, 글로벌 서비스에 오신 것을 환영합니다.", "ko-KR-Neural2-A"),
    "zh-CN": ("您好，欢迎使用我们的全球服务。", "zh-CN-Neural2-A")
}

for lang_code, (text, voice) in multilingual_demo.items():
    response = tts.generate_speech(
        text=text,
        voice=voice,
        speaking_rate=1.0
    )
    
    filename = f"greeting_{lang_code}.wav"
    with open(filename, "wb") as f:
        f.write(response.audio_data)
    
    print(f"Generated {lang_code}: {text}")
```

## Advanced Speech Parameters

### Comprehensive Parameter Control
```python
def generate_customized_speech(text, voice_settings):
    """Generate speech with custom parameters."""
    
    response = tts.generate_speech(
        text=text,
        voice=voice_settings.get("voice", "en-US-Neural2-F"),
        speaking_rate=voice_settings.get("speaking_rate", 1.0),  # 0.25 - 4.0
        pitch=voice_settings.get("pitch", 0.0),  # -20.0 to 20.0 semitones
        volume_gain_db=voice_settings.get("volume_gain_db", 0.0),  # -96.0 to 16.0 dB
        audio_format=voice_settings.get("audio_format", "wav"),  # wav, mp3, ogg
        sample_rate=voice_settings.get("sample_rate", 24000),  # 8000, 16000, 24000, 48000
        effects=voice_settings.get("effects", [])  # Audio effects
    )
    
    return response

# Example: Create different speaking styles
speaking_styles = {
    "slow_and_low": {
        "voice": "en-US-Neural2-D",
        "speaking_rate": 0.8,
        "pitch": -5.0,
        "volume_gain_db": -2.0
    },
    "fast_and_energetic": {
        "voice": "en-US-Neural2-E", 
        "speaking_rate": 1.3,
        "pitch": 3.0,
        "volume_gain_db": 2.0
    },
    "professional_narrator": {
        "voice": "en-US-Neural2-A",
        "speaking_rate": 0.95,
        "pitch": 0.0,
        "volume_gain_db": 0.0
    }
}

text = "This is a demonstration of different speaking styles and voice characteristics."

for style_name, settings in speaking_styles.items():
    response = generate_customized_speech(text, settings)
    
    filename = f"style_{style_name}.wav"
    with open(filename, "wb") as f:
        f.write(response.audio_data)
    
    print(f"Generated {style_name} style")
```

### Audio Format Options
```python
def generate_multiple_formats(text, voice="en-US-Neural2-F"):
    """Generate audio in multiple formats."""
    
    formats = {
        "wav": {"format": "wav", "sample_rate": 24000},
        "mp3": {"format": "mp3", "bitrate": 128},
        "ogg": {"format": "ogg", "quality": 5},
        "flac": {"format": "flac", "compression": 8}
    }
    
    generated_files = {}
    
    for format_name, settings in formats.items():
        response = tts.generate_speech(
            text=text,
            voice=voice,
            audio_format=settings["format"],
            **{k: v for k, v in settings.items() if k != "format"}
        )
        
        filename = f"audio_sample.{format_name}"
        with open(filename, "wb") as f:
            f.write(response.audio_data)
        
        generated_files[format_name] = filename
        print(f"Generated {format_name}: {filename}")
    
    return generated_files

# Usage
audio_files = generate_multiple_formats(
    "This audio is available in multiple formats for your convenience."
)
```

## SSML (Speech Synthesis Markup Language)

### Basic SSML Usage
```python
def generate_ssml_speech(ssml_text):
    """Generate speech from SSML markup."""
    
    response = tts.generate_speech(
        text=ssml_text,
        voice="en-US-Neural2-F",
        text_type="ssml"  # Specify SSML input
    )
    
    return response

# Basic SSML example
ssml_basic = """
<speak>
    <p>Welcome to our <emphasis level="strong">advanced</emphasis> text-to-speech service.</p>
    <break time="1s"/>
    <p>We offer <prosody rate="slow">natural</prosody> and 
    <prosody pitch="high">expressive</prosody> speech synthesis.</p>
</speak>
"""

response = generate_ssml_speech(ssml_basic)
with open("ssml_basic.wav", "wb") as f:
    f.write(response.audio_data)
```

### Advanced SSML Features
```python
# Comprehensive SSML example
ssml_advanced = """
<speak>
    <voice name="en-US-Neural2-F">
        <p>
            <s>Good morning, and welcome to our quarterly report.</s>
            <break time="500ms"/>
            <s>Today, we'll cover <emphasis level="moderate">three main topics</emphasis>:</s>
        </p>
        
        <p>
            <s>First, <prosody rate="slow" pitch="low">financial performance</prosody>.</s>
            <s>Second, <prosody rate="medium" pitch="medium">market expansion</prosody>.</s>
            <s>And finally, <prosody rate="fast" pitch="high">future innovations</prosody>.</s>
        </p>
        
        <break time="1s"/>
        
        <p>
            <s>Our revenue increased by <say-as interpret-as="percentage">15%</say-as> this quarter.</s>
            <s>That's approximately <say-as interpret-as="currency" language="en-US">$2.5 million</say-as> in additional income.</s>
        </p>
        
        <p>
            <s>The meeting is scheduled for <say-as interpret-as="date" format="mdy">03/15/2024</say-as> 
            at <say-as interpret-as="time" format="hms12">2:30 PM</say-as>.</s>
        </p>
        
        <p>
            <s><prosody volume="x-loud">Thank you</prosody> for your attention.</s>
            <break time="500ms"/>
            <s>We look forward to <emphasis level="strong">continued success</emphasis> together.</s>
        </p>
    </voice>
</speak>
"""

response = generate_ssml_speech(ssml_advanced)
with open("quarterly_report.wav", "wb") as f:
    f.write(response.audio_data)
```

### SSML with Multiple Voices
```python
# Multi-voice conversation
ssml_conversation = """
<speak>
    <voice name="en-US-Neural2-D">
        <s>Welcome to our customer service line.</s>
        <s>How may I assist you today?</s>
    </voice>
    
    <break time="1s"/>
    
    <voice name="en-US-Neural2-F">
        <s>Hello, I have a question about my recent order.</s>
        <s>The tracking number is <say-as interpret-as="characters">ABC123XYZ</say-as>.</s>
    </voice>
    
    <break time="500ms"/>
    
    <voice name="en-US-Neural2-D">
        <s>Let me look that up for you.</s>
        <break time="2s"/>
        <s>I can see that your order shipped yesterday and should arrive by 
        <say-as interpret-as="date" format="mdy">03/20/2024</say-as>.</s>
    </voice>
    
    <break time="500ms"/>
    
    <voice name="en-US-Neural2-F">
        <s><prosody rate="fast">That's perfect!</prosody> 
        <emphasis level="moderate">Thank you</emphasis> so much for your help.</s>
    </voice>
</speak>
"""

response = generate_ssml_speech(ssml_conversation)
with open("customer_service_call.wav", "wb") as f:
    f.write(response.audio_data)
```

## Specialized Use Cases

### Audiobook Narration
```python
def generate_audiobook_chapter(chapter_text, narrator_voice="en-US-Neural2-A"):
    """Generate audiobook-style narration."""
    
    # Add SSML formatting for better audiobook experience
    ssml_content = f"""
    <speak>
        <voice name="{narrator_voice}">
            <prosody rate="0.9" pitch="-1.0">
                <p>
                    <break time="1s"/>
                    {chapter_text}
                    <break time="2s"/>
                </p>
            </prosody>
        </voice>
    </speak>
    """
    
    response = tts.generate_speech(
        text=ssml_content,
        text_type="ssml",
        audio_format="mp3",
        sample_rate=22050  # Good balance for audiobooks
    )
    
    return response

# Example chapter
chapter_1 = """
Chapter One: The Beginning.

It was a dark and stormy night when Sarah first discovered the mysterious letter hidden in her grandmother's attic. The envelope was yellowed with age, and the handwriting was barely legible. As she carefully opened it, she had no idea that this moment would change her life forever.

The letter spoke of ancient secrets, hidden treasures, and a family legacy that had been kept secret for generations. Sarah's hands trembled as she read each word, her heart racing with excitement and anticipation.
"""

audiobook_response = generate_audiobook_chapter(chapter_1)
with open("audiobook_chapter_1.mp3", "wb") as f:
    f.write(audiobook_response.audio_data)
```

### Podcast Introduction Generation
```python
def generate_podcast_intro(podcast_name, host_name, episode_title, episode_number):
    """Generate professional podcast introduction."""
    
    intro_ssml = f"""
    <speak>
        <voice name="en-US-Neural2-F">
            <prosody rate="1.1" pitch="2.0" volume="loud">
                <emphasis level="strong">Welcome to {podcast_name}!</emphasis>
            </prosody>
            
            <break time="800ms"/>
            
            <prosody rate="0.95" pitch="0.0">
                <s>I'm your host, {host_name}, and this is episode {episode_number}.</s>
                
                <break time="500ms"/>
                
                <s>Today we're diving into: <emphasis level="moderate">{episode_title}</emphasis>.</s>
                
                <break time="1s"/>
                
                <prosody rate="1.0" pitch="-1.0">
                    <s>Let's get started!</s>
                </prosody>
            </prosody>
        </voice>
    </speak>
    """
    
    response = tts.generate_speech(
        text=intro_ssml,
        text_type="ssml",
        audio_format="mp3"
    )
    
    return response

# Generate podcast intro
podcast_intro = generate_podcast_intro(
    podcast_name="Tech Talk Today",
    host_name="Alex Johnson", 
    episode_title="The Future of Artificial Intelligence",
    episode_number=142
)

with open("podcast_intro.mp3", "wb") as f:
    f.write(podcast_intro.audio_data)
```

### Voice Assistant Responses
```python
def generate_assistant_responses():
    """Generate voice assistant style responses."""
    
    responses = {
        "greeting": "Hello! How can I help you today?",
        "weather": "The current temperature is 72 degrees Fahrenheit with partly cloudy skies.",
        "time": "The current time is 3:45 PM.",
        "reminder": "You have a meeting with the marketing team in 15 minutes.",
        "error": "I'm sorry, I didn't understand that. Could you please repeat your request?",
        "goodbye": "Goodbye! Have a wonderful day!"
    }
    
    voice_settings = {
        "voice": "en-US-Neural2-H",
        "speaking_rate": 1.1,
        "pitch": 1.0,
        "audio_format": "wav"
    }
    
    generated_responses = {}
    
    for response_type, text in responses.items():
        response = tts.generate_speech(
            text=text,
            **voice_settings
        )
        
        filename = f"assistant_{response_type}.wav"
        with open(filename, "wb") as f:
            f.write(response.audio_data)
        
        generated_responses[response_type] = filename
        print(f"Generated assistant response: {response_type}")
    
    return generated_responses

assistant_responses = generate_assistant_responses()
```

### Educational Content
```python
def generate_educational_content(lesson_content, subject="General"):
    """Generate educational audio content with appropriate pacing."""
    
    # Format for educational content
    educational_ssml = f"""
    <speak>
        <voice name="en-US-Neural2-A">
            <prosody rate="0.85" pitch="0.0">
                <p>
                    <s><emphasis level="moderate">Welcome to today's lesson on {subject}.</emphasis></s>
                    <break time="1s"/>
                </p>
                
                <p>
                    {lesson_content}
                </p>
                
                <break time="1s"/>
                
                <p>
                    <s>That concludes today's lesson.</s>
                    <s><prosody rate="0.9">Please review the material and we'll see you next time.</prosody></s>
                </p>
            </prosody>
        </voice>
    </speak>
    """
    
    response = tts.generate_speech(
        text=educational_ssml,
        text_type="ssml",
        audio_format="mp3"
    )
    
    return response

# Math lesson example
math_lesson = """
Today we'll learn about the Pythagorean theorem. 

The Pythagorean theorem states that in a right triangle, the square of the length of the hypotenuse equals the sum of the squares of the lengths of the other two sides.

This can be written as: a squared plus b squared equals c squared.

For example, if one side is 3 units and another side is 4 units, then the hypotenuse would be 5 units, because 3 squared plus 4 squared equals 9 plus 16, which equals 25, and the square root of 25 is 5.
"""

math_audio = generate_educational_content(math_lesson, "Mathematics")
with open("math_lesson_pythagorean.mp3", "wb") as f:
    f.write(math_audio.audio_data)
```

## Batch Processing and Automation

### Batch Speech Generation
```python
import concurrent.futures
import time

class SpeechBatchProcessor:
    def __init__(self, model_name="gemini-2.5-flash-tts", max_workers=5):
        genai.configure(api_key="your_api_key")
        self.tts = genai.SpeechGenerationModel(model_name)
        self.max_workers = max_workers
    
    def generate_single_speech(self, speech_spec):
        """Generate a single speech file from specification."""
        text, filename, params = speech_spec
        
        try:
            response = self.tts.generate_speech(
                text=text,
                **params
            )
            
            with open(filename, "wb") as f:
                f.write(response.audio_data)
            
            return f"Successfully generated: {filename}"
            
        except Exception as e:
            return f"Failed to generate {filename}: {str(e)}"
    
    def generate_batch(self, speech_specs):
        """Generate multiple speech files in parallel."""
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [executor.submit(self.generate_single_speech, spec) for spec in speech_specs]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        return results

# Usage
processor = SpeechBatchProcessor()

speech_specs = [
    (
        "Welcome to our customer service line.",
        "greeting.wav",
        {"voice": "en-US-Neural2-F", "speaking_rate": 1.0}
    ),
    (
        "Please hold while we connect you to the next available agent.",
        "hold_message.wav",
        {"voice": "en-US-Neural2-F", "speaking_rate": 0.9}
    ),
    (
        "Thank you for calling. Have a great day!",
        "goodbye.wav",
        {"voice": "en-US-Neural2-F", "speaking_rate": 1.0}
    ),
    (
        "Your call is important to us. Current wait time is approximately 5 minutes.",
        "wait_time.wav",
        {"voice": "en-US-Neural2-A", "speaking_rate": 0.95}
    )
]

results = processor.generate_batch(speech_specs)
for result in results:
    print(result)
```

### Automated Content Pipeline
```python
def create_content_pipeline(content_list, voice_mapping, output_dir):
    """Create a complete content pipeline with different voices."""
    import os
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    generated_files = []
    
    for content_item in content_list:
        content_type = content_item["type"]
        text = content_item["text"]
        voice = voice_mapping.get(content_type, "en-US-Neural2-F")
        
        # Customize settings based on content type
        if content_type == "announcement":
            settings = {"speaking_rate": 1.1, "pitch": 2.0, "volume_gain_db": 2.0}
        elif content_type == "instruction":
            settings = {"speaking_rate": 0.9, "pitch": 0.0, "volume_gain_db": 0.0}
        elif content_type == "warning":
            settings = {"speaking_rate": 0.8, "pitch": -2.0, "volume_gain_db": 3.0}
        else:
            settings = {"speaking_rate": 1.0, "pitch": 0.0, "volume_gain_db": 0.0}
        
        response = tts.generate_speech(
            text=text,
            voice=voice,
            **settings
        )
        
        filename = f"{output_dir}/{content_type}_{content_item['id']}.wav"
        with open(filename, "wb") as f:
            f.write(response.audio_data)
        
        generated_files.append(filename)
        print(f"Generated {content_type}: {filename}")
    
    return generated_files

# Example content pipeline
content_pipeline_data = [
    {
        "id": "001",
        "type": "announcement",
        "text": "Attention passengers: Flight 123 to New York is now boarding at Gate 7."
    },
    {
        "id": "002", 
        "type": "instruction",
        "text": "Please have your boarding pass and ID ready for inspection."
    },
    {
        "id": "003",
        "type": "warning",
        "text": "This is the final boarding call for Flight 123 to New York."
    },
    {
        "id": "004",
        "type": "general",
        "text": "Thank you for flying with us today. We hope you have a pleasant journey."
    }
]

voice_assignments = {
    "announcement": "en-US-Neural2-H",
    "instruction": "en-US-Neural2-F", 
    "warning": "en-US-Neural2-D",
    "general": "en-US-Neural2-C"
}

pipeline_files = create_content_pipeline(
    content_pipeline_data,
    voice_assignments,
    "airport_announcements"
)
```

## Audio Processing and Enhancement

### Audio Quality Optimization
```python
def optimize_audio_quality(text, voice, output_format="wav"):
    """Generate speech optimized for different use cases."""
    
    quality_presets = {
        "broadcast": {
            "sample_rate": 48000,
            "audio_format": "wav",
            "speaking_rate": 0.95,
            "volume_gain_db": 1.0
        },
        "phone_system": {
            "sample_rate": 8000,
            "audio_format": "wav",
            "speaking_rate": 0.9,
            "volume_gain_db": 3.0
        },
        "podcast": {
            "sample_rate": 44100,
            "audio_format": "mp3",
            "speaking_rate": 1.0,
            "volume_gain_db": 0.0
        },
        "audiobook": {
            "sample_rate": 22050,
            "audio_format": "mp3",
            "speaking_rate": 0.85,
            "volume_gain_db": -1.0
        }
    }
    
    optimized_files = {}
    
    for preset_name, settings in quality_presets.items():
        response = tts.generate_speech(
            text=text,
            voice=voice,
            **settings
        )
        
        filename = f"optimized_{preset_name}.{settings['audio_format']}"
        with open(filename, "wb") as f:
            f.write(response.audio_data)
        
        optimized_files[preset_name] = filename
        print(f"Generated {preset_name} optimized audio: {filename}")
    
    return optimized_files

# Generate optimized versions
sample_text = "This is a sample audio file optimized for different use cases and quality requirements."
optimized_audio = optimize_audio_quality(sample_text, "en-US-Neural2-F")
```

### Audio Post-Processing
```python
def post_process_audio(input_audio_path, effects):
    """Apply post-processing effects to generated audio."""
    try:
        from pydub import AudioSegment
        from pydub.effects import normalize, compress_dynamic_range
        import numpy as np
    except ImportError:
        print("Please install pydub: pip install pydub")
        return None
    
    # Load audio
    audio = AudioSegment.from_file(input_audio_path)
    
    # Apply effects
    if "normalize" in effects:
        audio = normalize(audio)
    
    if "compress" in effects:
        audio = compress_dynamic_range(audio)
    
    if "fade_in" in effects:
        audio = audio.fade_in(effects["fade_in"])
    
    if "fade_out" in effects:
        audio = audio.fade_out(effects["fade_out"])
    
    if "speed_change" in effects:
        speed_factor = effects["speed_change"]
        # Change speed without changing pitch
        audio = audio._spawn(audio.raw_data, overrides={
            "frame_rate": int(audio.frame_rate * speed_factor)
        }).set_frame_rate(audio.frame_rate)
    
    return audio

# Example post-processing
original_response = tts.generate_speech(
    text="This audio will be post-processed with various effects.",
    voice="en-US-Neural2-F"
)

with open("original_speech.wav", "wb") as f:
    f.write(original_response.audio_data)

# Apply post-processing
effects_config = {
    "normalize": True,
    "compress": True,
    "fade_in": 200,  # 200ms fade in
    "fade_out": 500  # 500ms fade out
}

processed_audio = post_process_audio("original_speech.wav", effects_config)
if processed_audio:
    processed_audio.export("processed_speech.wav", format="wav")
    print("Audio post-processing completed")
```

## Error Handling and Quality Control

### Robust Speech Generation
```python
import time
import random

class RobustSpeechGenerator:
    def __init__(self, model_name="gemini-2.5-flash-tts"):
        self.tts = genai.SpeechGenerationModel(model_name)
        self.max_retries = 3
        self.base_delay = 1
    
    def generate_with_retry(self, text, **kwargs):
        """Generate speech with retry logic and error handling."""
        
        for attempt in range(self.max_retries):
            try:
                response = self.tts.generate_speech(
                    text=text,
                    **kwargs
                )
                return response
                
            except Exception as e:
                error_msg = str(e).lower()
                
                if "quota" in error_msg or "limit" in error_msg:
                    wait_time = 300  # 5 minutes for quota issues
                    print(f"Quota exceeded. Waiting {wait_time} seconds...")
                    time.sleep(wait_time)
                    
                elif "rate" in error_msg:
                    delay = self.base_delay * (2 ** attempt) + random.uniform(0, 1)
                    print(f"Rate limited. Waiting {delay:.2f} seconds...")
                    time.sleep(delay)
                    
                elif "text too long" in error_msg:
                    print("Text too long, attempting to split...")
                    return self._handle_long_text(text, **kwargs)
                    
                else:
                    print(f"Attempt {attempt + 1} failed: {str(e)}")
                    if attempt == self.max_retries - 1:
                        print("All attempts failed")
                        return None
                    time.sleep(self.base_delay * (attempt + 1))
        
        return None
    
    def _handle_long_text(self, text, **kwargs):
        """Handle text that exceeds length limits."""
        # Split text into smaller chunks
        sentences = text.split('. ')
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            if len(current_chunk + sentence) < 5000:  # Safe limit
                current_chunk += sentence + ". "
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence + ". "
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        # Generate speech for each chunk
        audio_segments = []
        for i, chunk in enumerate(chunks):
            print(f"Processing chunk {i+1}/{len(chunks)}")
            response = self.generate_with_retry(chunk, **kwargs)
            if response:
                audio_segments.append(response.audio_data)
            time.sleep(1)  # Small delay between chunks
        
        # Combine audio segments (simplified - in practice, use audio library)
        if audio_segments:
            combined_audio = b''.join(audio_segments)
            class CombinedResponse:
                def __init__(self, audio_data):
                    self.audio_data = audio_data
            return CombinedResponse(combined_audio)
        
        return None
    
    def validate_and_generate(self, text, **kwargs):
        """Validate input and generate speech."""
        
        # Text validation
        if not text or len(text.strip()) == 0:
            print("Error: Empty text provided")
            return None
        
        # Remove or replace problematic characters
        cleaned_text = text.replace('\x00', '').replace('\r\n', '\n')
        
        # Voice validation
        voice = kwargs.get('voice', 'en-US-Neural2-F')
        if not self._is_valid_voice(voice):
            print(f"Warning: Unknown voice {voice}, using default")
            kwargs['voice'] = 'en-US-Neural2-F'
        
        # Parameter validation
        speaking_rate = kwargs.get('speaking_rate', 1.0)
        if not 0.25 <= speaking_rate <= 4.0:
            print(f"Warning: Speaking rate {speaking_rate} out of range, adjusting")
            kwargs['speaking_rate'] = max(0.25, min(4.0, speaking_rate))
        
        pitch = kwargs.get('pitch', 0.0)
        if not -20.0 <= pitch <= 20.0:
            print(f"Warning: Pitch {pitch} out of range, adjusting")
            kwargs['pitch'] = max(-20.0, min(20.0, pitch))
        
        return self.generate_with_retry(cleaned_text, **kwargs)
    
    def _is_valid_voice(self, voice):
        """Check if voice ID is valid."""
        valid_voices = [
            "en-US-Neural2-A", "en-US-Neural2-C", "en-US-Neural2-D",
            "en-US-Neural2-E", "en-US-Neural2-F", "en-US-Neural2-G",
            "en-US-Neural2-H", "en-US-Neural2-I", "en-US-Neural2-J"
        ]
        return voice in valid_voices

# Usage
generator = RobustSpeechGenerator()

speech_response = generator.validate_and_generate(
    text="This is a test of the robust speech generation system with error handling and validation.",
    voice="en-US-Neural2-F",
    speaking_rate=1.0,
    pitch=0.0
)

if speech_response:
    with open("robust_speech.wav", "wb") as f:
        f.write(speech_response.audio_data)
    print("Speech generated successfully with robust handling!")
else:
    print("Failed to generate speech")
```

## Integration Examples

### Flask Web Application
```python
from flask import Flask, request, jsonify, send_file
import io
import base64
import tempfile
import os

app = Flask(__name__)

@app.route('/generate-speech', methods=['POST'])
def generate_speech_api():
    """API endpoint for speech generation."""
    try:
        data = request.json
        text = data.get('text')
        
        if not text:
            return jsonify({'error': 'Text is required'}), 400
        
        # Generate speech
        response = tts.generate_speech(
            text=text,
            voice=data.get('voice', 'en-US-Neural2-F'),
            speaking_rate=data.get('speaking_rate', 1.0),
            pitch=data.get('pitch', 0.0),
            audio_format=data.get('audio_format', 'wav')
        )
        
        # Return as base64 encoded audio
        audio_base64 = base64.b64encode(response.audio_data).decode()
        
        return jsonify({
            'success': True,
            'audio': audio_base64,
            'format': data.get('audio_format', 'wav')
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/generate-speech-file', methods=['POST'])
def generate_speech_file():
    """Generate and return speech file directly."""
    try:
        data = request.json
        text = data.get('text')
        
        response = tts.generate_speech(
            text=text,
            voice=data.get('voice', 'en-US-Neural2-F'),
            audio_format='wav'
        )
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            tmp_file.write(response.audio_data)
            temp_path = tmp_file.name
        
        def remove_file(response):
            try:
                os.remove(temp_path)
            except Exception:
                pass
            return response
        
        return send_file(
            temp_path,
            mimetype='audio/wav',
            as_attachment=True,
            download_name='generated_speech.wav'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/voices')
def list_voices():
    """List available voices."""
    voices = {
        "en-US-Neural2-A": "Male, deep and authoritative",
        "en-US-Neural2-C": "Female, warm and friendly",
        "en-US-Neural2-D": "Male, professional and clear",
        "en-US-Neural2-E": "Female, youthful and energetic",
        "en-US-Neural2-F": "Female, sophisticated and calm",
        "en-US-Neural2-G": "Female, confident and articulate",
        "en-US-Neural2-H": "Female, expressive and dynamic",
        "en-US-Neural2-I": "Male, casual and conversational",
        "en-US-Neural2-J": "Male, mature and reliable"
    }
    
    return jsonify(voices)

if __name__ == '__main__':
    app.run(debug=True)
```

### Streamlit Application
```python
import streamlit as st
import io
import tempfile
import os

st.title("Google Speech Generation")

# Sidebar for voice selection
st.sidebar.header("Voice Settings")

voices = {
    "en-US-Neural2-A": "Male, deep and authoritative",
    "en-US-Neural2-C": "Female, warm and friendly", 
    "en-US-Neural2-D": "Male, professional and clear",
    "en-US-Neural2-E": "Female, youthful and energetic",
    "en-US-Neural2-F": "Female, sophisticated and calm",
    "en-US-Neural2-G": "Female, confident and articulate",
    "en-US-Neural2-H": "Female, expressive and dynamic",
    "en-US-Neural2-I": "Male, casual and conversational",
    "en-US-Neural2-J": "Male, mature and reliable"
}

selected_voice = st.sidebar.selectbox(
    "Choose Voice",
    options=list(voices.keys()),
    format_func=lambda x: f"{x} - {voices[x]}"
)

speaking_rate = st.sidebar.slider("Speaking Rate", 0.25, 4.0, 1.0, 0.1)
pitch = st.sidebar.slider("Pitch", -20.0, 20.0, 0.0, 0.5)
audio_format = st.sidebar.selectbox("Audio Format", ["wav", "mp3"])

# Main interface
st.subheader("Text Input")
text_input = st.text_area("Enter text to convert to speech:", height=150)

# Example texts
st.subheader("Example Texts")
examples = [
    "Hello, welcome to our text-to-speech demonstration.",
    "The quick brown fox jumps over the lazy dog.",
    "In a hole in the ground there lived a hobbit.",
    "To be or not to be, that is the question."
]

col1, col2 = st.columns(2)
for i, example in enumerate(examples):
    if i % 2 == 0:
        if col1.button(f"Example {i+1}", key=f"ex_{i}"):
            st.session_state.text_input = example
    else:
        if col2.button(f"Example {i+1}", key=f"ex_{i}"):
            st.session_state.text_input = example

# Use session state for text input
if 'text_input' in st.session_state:
    text_input = st.session_state.text_input

# Generation
if st.button("Generate Speech", type="primary"):
    if text_input:
        with st.spinner("Generating speech..."):
            try:
                response = tts.generate_speech(
                    text=text_input,
                    voice=selected_voice,
                    speaking_rate=speaking_rate,
                    pitch=pitch,
                    audio_format=audio_format
                )
                
                # Display audio player
                st.success("Speech generated successfully!")
                st.audio(response.audio_data, format=f'audio/{audio_format}')
                
                # Download button
                st.download_button(
                    label=f"Download Audio ({audio_format.upper()})",
                    data=response.audio_data,
                    file_name=f"generated_speech.{audio_format}",
                    mime=f"audio/{audio_format}"
                )
                
            except Exception as e:
                st.error(f"Error generating speech: {str(e)}")
    else:
        st.warning("Please enter some text")

# Display current settings
st.sidebar.subheader("Current Settings")
st.sidebar.info(f"""
**Voice:** {selected_voice}
**Speaking Rate:** {speaking_rate}
**Pitch:** {pitch}
**Format:** {audio_format.upper()}
""")
```

This comprehensive documentation covers all aspects of using Google's Speech Generation API, from basic text-to-speech to advanced SSML features and production integration. 