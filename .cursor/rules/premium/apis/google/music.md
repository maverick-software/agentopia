# Google Music Generation API Documentation

## Overview

Google's Music Generation API, powered by Lyria models, provides advanced AI-driven music composition and synthesis capabilities. The API enables creation of instrumental music, song composition, and audio generation across various genres and styles through the Gemini platform.

## Available Models

### Lyria 2 (Latest)
- **Capabilities**: Professional-quality music generation and composition
- **Formats**: Instrumental, vocals, full compositions
- **Duration**: Up to 4 minutes per generation
- **Quality**: High-fidelity audio output (44.1kHz, stereo)
- **Pricing**: Contact Google for enterprise pricing

### Lyria 1
- **Capabilities**: Basic music generation and simple compositions
- **Formats**: Primarily instrumental
- **Duration**: Up to 2 minutes per generation
- **Quality**: Standard audio quality
- **Pricing**: Contact Google for pricing

## Authentication & Setup

### API Key Configuration
```bash
# Environment variable
export GEMINI_API_KEY="your_api_key_here"
```

### Base URL
```
https://generativelanguage.googleapis.com/v1beta/models/lyria-2:generateMusic
```

### SDK Installation
```bash
# Python
pip install google-generativeai

# Node.js
npm install @google/generative-ai
```

## Basic Music Generation

### Simple Text-to-Music
```python
import google.generativeai as genai

# Configure API key
genai.configure(api_key="your_api_key")

# Generate music
music_gen = genai.MusicGenerationModel("lyria-2")
response = music_gen.generate_music(
    prompt="A peaceful piano melody with soft strings, suitable for meditation",
    duration_seconds=120,
    tempo="slow",
    key="C major",
    style="ambient"
)

# Save audio
with open("peaceful_melody.mp3", "wb") as f:
    f.write(response.audio_data)
```

### REST API Request
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: ${GEMINI_API_KEY}" \
  -d '{
    "prompt": "Upbeat jazz composition with saxophone and piano",
    "duration_seconds": 180,
    "tempo": "medium",
    "genre": "jazz",
    "instruments": ["saxophone", "piano", "bass", "drums"]
  }' \
  "https://generativelanguage.googleapis.com/v1beta/models/lyria-2:generateMusic"
```

### Node.js Implementation
```javascript
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';

const genAI = new GoogleGenerativeAI("your_api_key");

async function generateMusic() {
  const musicModel = genAI.getGenerativeModel({
    model: "lyria-2"
  });

  const result = await musicModel.generateContent({
    prompt: "Epic orchestral piece with dramatic crescendos and heroic themes",
    durationSeconds: 240,
    genre: "orchestral",
    mood: "epic"
  });

  // Save music file
  fs.writeFileSync("epic_orchestral.mp3", result.response.audioData);
  console.log("Music generated successfully: epic_orchestral.mp3");
}

generateMusic();
```

## Advanced Generation Parameters

### Comprehensive Music Parameters
```python
response = music_gen.generate_music(
    prompt="A romantic acoustic guitar ballad with gentle vocals",
    duration_seconds=180,
    
    # Musical Structure
    tempo="slow",                    # slow, medium, fast, or BPM (60-200)
    key="G major",                   # Musical key
    time_signature="4/4",            # Time signature
    
    # Style and Genre
    genre="folk",                    # Genre classification
    style="acoustic",                # Style descriptor
    mood="romantic",                 # Emotional mood
    energy_level="low",              # low, medium, high
    
    # Instrumentation
    instruments=["acoustic_guitar", "vocals", "strings"],
    lead_instrument="acoustic_guitar",
    
    # Audio Quality
    audio_format="mp3",              # mp3, wav, flac
    sample_rate=44100,               # Sample rate in Hz
    bitrate=320,                     # For MP3 format
    
    # Generation Controls
    creativity=0.7,                  # 0.0 to 1.0 (conservative to creative)
    variation=0.5,                   # Musical variation level
    repetition=0.3                   # Amount of repetition
)

with open("romantic_ballad.mp3", "wb") as f:
    f.write(response.audio_data)
```

### Genre-Specific Generation
```python
genres = {
    "classical": {
        "instruments": ["piano", "violin", "cello", "flute"],
        "tempo": "medium",
        "style": "orchestral",
        "complexity": "high"
    },
    "jazz": {
        "instruments": ["saxophone", "piano", "bass", "drums"],
        "tempo": "medium", 
        "style": "swing",
        "improvisation": True
    },
    "electronic": {
        "instruments": ["synthesizer", "drum_machine", "bass_synth"],
        "tempo": "fast",
        "style": "edm",
        "effects": ["reverb", "delay", "filter"]
    },
    "folk": {
        "instruments": ["acoustic_guitar", "harmonica", "vocals"],
        "tempo": "medium",
        "style": "acoustic",
        "authenticity": "traditional"
    },
    "rock": {
        "instruments": ["electric_guitar", "bass", "drums", "vocals"],
        "tempo": "fast",
        "style": "energetic",
        "distortion": "medium"
    }
}

# Generate music for each genre
for genre_name, settings in genres.items():
    prompt = f"A {genre_name} composition showcasing traditional elements and musical characteristics"
    
    response = music_gen.generate_music(
        prompt=prompt,
        duration_seconds=150,
        genre=genre_name,
        **settings
    )
    
    filename = f"{genre_name}_composition.mp3"
    with open(filename, "wb") as f:
        f.write(response.audio_data)
    
    print(f"Generated {genre_name} composition: {filename}")
```

## Musical Styles and Moods

### Mood-Based Generation
```python
moods = {
    "happy": {
        "tempo": "medium_fast",
        "key": "C major",
        "energy_level": "high",
        "brightness": 0.8
    },
    "sad": {
        "tempo": "slow",
        "key": "D minor", 
        "energy_level": "low",
        "brightness": 0.2
    },
    "dramatic": {
        "tempo": "variable",
        "key": "F# minor",
        "energy_level": "high",
        "dynamics": "wide_range"
    },
    "peaceful": {
        "tempo": "slow",
        "key": "F major",
        "energy_level": "low",
        "harmony": "consonant"
    },
    "mysterious": {
        "tempo": "medium_slow",
        "key": "B minor",
        "energy_level": "medium",
        "harmony": "dissonant"
    }
}

base_prompt = "An instrumental piece that evokes a strong emotional response"

for mood_name, mood_settings in moods.items():
    full_prompt = f"{base_prompt}, specifically conveying a {mood_name} atmosphere"
    
    response = music_gen.generate_music(
        prompt=full_prompt,
        duration_seconds=120,
        mood=mood_name,
        **mood_settings
    )
    
    filename = f"mood_{mood_name}.mp3"
    with open(filename, "wb") as f:
        f.write(response.audio_data)
    
    print(f"Generated {mood_name} mood piece: {filename}")
```

### Style Variations
```python
def generate_style_variations(base_composition, styles):
    """Generate variations of a composition in different styles."""
    
    variations = {}
    
    for style_name, style_desc in styles.items():
        prompt = f"""
        {base_composition} arranged in {style_name} style.
        {style_desc}
        Maintain the core melody while adapting the arrangement, 
        instrumentation, and musical characteristics to fit the style.
        """
        
        response = music_gen.generate_music(
            prompt=prompt,
            duration_seconds=120,
            style=style_name,
            preserve_melody=True,
            adaptation_level=0.7
        )
        
        filename = f"variation_{style_name}.mp3"
        with open(filename, "wb") as f:
            f.write(response.audio_data)
        
        variations[style_name] = filename
        print(f"Generated {style_name} variation: {filename}")
    
    return variations

# Define musical styles
musical_styles = {
    "baroque": "Complex counterpoint, ornate melodic lines, harpsichord and strings",
    "romantic": "Emotional expressiveness, rich harmonies, full orchestration",
    "minimalist": "Simple repetitive patterns, gradual changes, sparse orchestration",
    "impressionist": "Colorful harmonies, fluid forms, atmospheric textures",
    "bebop": "Fast tempo, complex chord progressions, improvisation",
    "ambient": "Atmospheric textures, slow evolution, ethereal soundscapes"
}

# Generate variations
base_theme = "A gentle melody in 3/4 time with a nostalgic character"
style_variations = generate_style_variations(base_theme, musical_styles)
```

## Instrumental and Vocal Generation

### Instrumental Compositions
```python
def generate_instrumental_piece(instrument_focus, supporting_instruments):
    """Generate an instrumental piece with featured instrument."""
    
    prompt = f"""
    An instrumental composition featuring {instrument_focus} as the lead instrument,
    supported by {', '.join(supporting_instruments)}.
    The piece should showcase the unique characteristics and capabilities
    of the {instrument_focus} while maintaining good musical balance.
    """
    
    response = music_gen.generate_music(
        prompt=prompt,
        duration_seconds=180,
        lead_instrument=instrument_focus,
        instruments=supporting_instruments + [instrument_focus],
        instrumental_only=True,
        showcase_lead=True
    )
    
    return response

# Generate instrumental showcases
instrumental_pieces = {
    "piano_solo": {
        "lead": "piano",
        "supporting": []
    },
    "violin_concerto": {
        "lead": "violin",
        "supporting": ["orchestra", "strings", "woodwinds"]
    },
    "guitar_ensemble": {
        "lead": "acoustic_guitar",
        "supporting": ["classical_guitar", "bass_guitar"]
    },
    "saxophone_quartet": {
        "lead": "tenor_saxophone",
        "supporting": ["alto_saxophone", "soprano_saxophone", "baritone_saxophone"]
    }
}

for piece_name, config in instrumental_pieces.items():
    response = generate_instrumental_piece(config["lead"], config["supporting"])
    
    filename = f"{piece_name}.mp3"
    with open(filename, "wb") as f:
        f.write(response.audio_data)
    
    print(f"Generated instrumental piece: {filename}")
```

### Vocal Music Generation
```python
def generate_vocal_music(lyrics, vocal_style, accompaniment):
    """Generate music with vocals based on lyrics and style."""
    
    if lyrics:
        prompt = f"""
        A {vocal_style} song with the following lyrics:
        {lyrics}
        
        The musical arrangement should complement the mood and meaning
        of the lyrics with appropriate {accompaniment} accompaniment.
        """
    else:
        prompt = f"""
        A {vocal_style} song with wordless vocals (humming, vocalizations),
        accompanied by {accompaniment}. The vocals should be melodic
        and expressive without specific lyrics.
        """
    
    response = music_gen.generate_music(
        prompt=prompt,
        duration_seconds=200,
        include_vocals=True,
        vocal_style=vocal_style,
        accompaniment=accompaniment,
        lyrics_provided=bool(lyrics)
    )
    
    return response

# Generate different vocal styles
vocal_examples = [
    {
        "lyrics": "Walking through the forest, sunlight filters down, nature's symphony surrounds me",
        "style": "folk",
        "accompaniment": "acoustic guitar and light percussion"
    },
    {
        "lyrics": None,  # Wordless vocals
        "style": "jazz",
        "accompaniment": "piano trio with bass and drums"
    },
    {
        "lyrics": "City lights are calling, dreams within my reach, tonight we're going to make it",
        "style": "pop",
        "accompaniment": "full band with synthesizers"
    }
]

for i, example in enumerate(vocal_examples):
    response = generate_vocal_music(
        example["lyrics"],
        example["style"], 
        example["accompaniment"]
    )
    
    filename = f"vocal_song_{i+1}_{example['style']}.mp3"
    with open(filename, "wb") as f:
        f.write(response.audio_data)
    
    print(f"Generated vocal piece: {filename}")
```

## Musical Structure and Composition

### Structured Compositions
```python
def generate_structured_composition(structure, theme, genre):
    """Generate music following a specific musical structure."""
    
    structure_prompts = {
        "AABA": "Classic 32-bar song form with verse-verse-bridge-verse structure",
        "verse_chorus": "Popular song structure with alternating verses and choruses",
        "sonata": "Classical sonata form with exposition, development, and recapitulation",
        "rondo": "Rondo form with recurring main theme and contrasting episodes",
        "theme_variations": "Theme and variations form with original theme and multiple variations"
    }
    
    structure_desc = structure_prompts.get(structure, "Free-form structure")
    
    prompt = f"""
    A {genre} composition following {structure} structure: {structure_desc}.
    Main theme: {theme}
    
    The piece should clearly demonstrate the chosen musical form
    with distinct sections and appropriate transitions between them.
    """
    
    response = music_gen.generate_music(
        prompt=prompt,
        duration_seconds=240,
        genre=genre,
        musical_form=structure,
        theme=theme,
        structured_composition=True
    )
    
    return response

# Generate compositions with different structures
compositions = [
    ("AABA", "A melancholy jazz standard", "jazz"),
    ("verse_chorus", "An uplifting pop anthem", "pop"),
    ("sonata", "A dramatic classical movement", "classical"),
    ("theme_variations", "A baroque-style theme", "baroque")
]

for structure, theme, genre in compositions:
    response = generate_structured_composition(structure, theme, genre)
    
    filename = f"structure_{structure}_{genre}.mp3"
    with open(filename, "wb") as f:
        f.write(response.audio_data)
    
    print(f"Generated {structure} composition: {filename}")
```

### Multi-Movement Works
```python
def generate_multi_movement_work(movements, overall_theme):
    """Generate a multi-movement musical work."""
    
    generated_movements = []
    
    for i, movement in enumerate(movements):
        prompt = f"""
        Movement {i+1} of a multi-movement work.
        Overall theme: {overall_theme}
        
        This movement: {movement['description']}
        Tempo: {movement['tempo']}
        Character: {movement['character']}
        
        This should connect thematically with the other movements
        while having its own distinct musical identity.
        """
        
        response = music_gen.generate_music(
            prompt=prompt,
            duration_seconds=movement['duration'],
            tempo=movement['tempo'],
            mood=movement['character'],
            movement_number=i+1,
            thematic_unity=True
        )
        
        filename = f"movement_{i+1}_{movement['name']}.mp3"
        with open(filename, "wb") as f:
            f.write(response.audio_data)
        
        generated_movements.append(filename)
        print(f"Generated movement {i+1}: {filename}")
    
    return generated_movements

# Example: Generate a classical suite
suite_movements = [
    {
        "name": "allegro",
        "description": "Energetic opening movement with fast-paced themes",
        "tempo": "fast",
        "character": "energetic",
        "duration": 180
    },
    {
        "name": "andante",
        "description": "Slow, lyrical movement with beautiful melodies",
        "tempo": "slow",
        "character": "peaceful",
        "duration": 200
    },
    {
        "name": "scherzo",
        "description": "Playful, dance-like movement with rhythmic complexity",
        "tempo": "medium_fast",
        "character": "playful",
        "duration": 150
    },
    {
        "name": "finale",
        "description": "Triumphant conclusion bringing together earlier themes",
        "tempo": "fast",
        "character": "triumphant",
        "duration": 220
    }
]

suite_movements_files = generate_multi_movement_work(
    suite_movements,
    "A celebration of the changing seasons"
)
```

## Batch Processing and Automation

### Music Library Generation
```python
import concurrent.futures
import time

class MusicBatchProcessor:
    def __init__(self, model_name="lyria-2", max_workers=3):
        genai.configure(api_key="your_api_key")
        self.music_gen = genai.MusicGenerationModel(model_name)
        self.max_workers = max_workers
    
    def generate_single_track(self, track_spec):
        """Generate a single music track from specification."""
        prompt, filename, params = track_spec
        
        try:
            response = self.music_gen.generate_music(
                prompt=prompt,
                **params
            )
            
            with open(filename, "wb") as f:
                f.write(response.audio_data)
            
            return f"Successfully generated: {filename}"
            
        except Exception as e:
            return f"Failed to generate {filename}: {str(e)}"
    
    def generate_music_library(self, track_specs):
        """Generate a library of music tracks."""
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Add delays between submissions for rate limiting
            futures = []
            for i, spec in enumerate(track_specs):
                if i > 0:
                    time.sleep(5)  # Longer delay for music generation
                future = executor.submit(self.generate_single_track, spec)
                futures.append(future)
            
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        return results

# Usage: Generate background music library
processor = MusicBatchProcessor()

background_music_specs = [
    (
        "Peaceful ambient music for meditation and relaxation",
        "ambient_meditation.mp3",
        {"duration_seconds": 300, "genre": "ambient", "tempo": "very_slow"}
    ),
    (
        "Upbeat corporate background music for presentations",
        "corporate_upbeat.mp3", 
        {"duration_seconds": 180, "genre": "corporate", "tempo": "medium", "energy_level": "medium"}
    ),
    (
        "Gentle acoustic music for coffee shop atmosphere",
        "cafe_acoustic.mp3",
        {"duration_seconds": 240, "genre": "acoustic", "instruments": ["acoustic_guitar", "light_percussion"]}
    ),
    (
        "Energetic workout music with driving rhythm",
        "workout_energy.mp3",
        {"duration_seconds": 200, "genre": "electronic", "tempo": "fast", "energy_level": "high"}
    ),
    (
        "Romantic dinner music with soft jazz elements",
        "romantic_dinner.mp3",
        {"duration_seconds": 220, "genre": "jazz", "mood": "romantic", "instruments": ["piano", "saxophone"]}
    )
]

results = processor.generate_music_library(background_music_specs)
for result in results:
    print(result)
```

### Playlist Generation
```python
def generate_themed_playlist(theme, track_count, duration_per_track):
    """Generate a complete playlist around a specific theme."""
    
    theme_variations = [
        f"Opening track: Introduce the {theme} theme with gentle, welcoming music",
        f"Building energy: Develop the {theme} theme with increasing intensity",
        f"Peak moment: Climactic expression of {theme} with full arrangement",
        f"Reflection: Contemplative interpretation of {theme} with solo instruments",
        f"Finale: Triumphant conclusion celebrating the {theme} theme"
    ]
    
    # Extend variations if more tracks needed
    if track_count > len(theme_variations):
        for i in range(track_count - len(theme_variations)):
            theme_variations.append(f"Variation {i+1}: Creative exploration of {theme} theme")
    
    playlist = []
    
    for i in range(track_count):
        track_prompt = theme_variations[i % len(theme_variations)]
        
        response = music_gen.generate_music(
            prompt=track_prompt,
            duration_seconds=duration_per_track,
            track_number=i+1,
            playlist_theme=theme,
            maintain_cohesion=True
        )
        
        filename = f"playlist_{theme.replace(' ', '_')}_track_{i+1:02d}.mp3"
        with open(filename, "wb") as f:
            f.write(response.audio_data)
        
        playlist.append(filename)
        print(f"Generated track {i+1}: {filename}")
        
        # Small delay between tracks
        time.sleep(2)
    
    return playlist

# Generate themed playlists
playlists = {
    "nature_sounds": {"count": 6, "duration": 180},
    "urban_journey": {"count": 5, "duration": 200}, 
    "emotional_landscapes": {"count": 7, "duration": 160}
}

for theme, config in playlists.items():
    print(f"\nGenerating {theme} playlist...")
    playlist_files = generate_themed_playlist(
        theme, 
        config["count"], 
        config["duration"]
    )
    print(f"Completed {theme} playlist: {len(playlist_files)} tracks")
```

## Advanced Features and Customization

### Style Transfer and Arrangement
```python
def generate_style_transfer(original_melody, target_style):
    """Generate music by transferring a melody to a different style."""
    
    prompt = f"""
    Take this musical concept: {original_melody}
    And arrange it in {target_style} style.
    
    Maintain the core melodic content while completely transforming
    the harmonic structure, rhythm, instrumentation, and overall
    musical character to authentically represent {target_style}.
    """
    
    response = music_gen.generate_music(
        prompt=prompt,
        duration_seconds=150,
        style_transfer=True,
        source_melody=original_melody,
        target_style=target_style,
        preserve_melody=0.7,  # How much of original melody to preserve
        style_adaptation=0.8   # How strongly to apply target style
    )
    
    return response

# Example style transfers
style_transfers = [
    ("A simple children's lullaby melody", "jazz fusion"),
    ("A classical minuet theme", "electronic dance music"),
    ("A folk song melody", "orchestral arrangement"),
    ("A pop chorus hook", "baroque counterpoint")
]

for original, target in style_transfers:
    response = generate_style_transfer(original, target)
    
    filename = f"transfer_{target.replace(' ', '_')}.mp3"
    with open(filename, "wb") as f:
        f.write(response.audio_data)
    
    print(f"Generated style transfer: {filename}")
```

### Interactive Music Generation
```python
def generate_interactive_variations(base_prompt, user_inputs):
    """Generate music variations based on user input parameters."""
    
    variations = {}
    
    for variation_name, user_params in user_inputs.items():
        # Combine base prompt with user customizations
        enhanced_prompt = f"""
        {base_prompt}
        
        User customizations:
        - Mood: {user_params.get('mood', 'neutral')}
        - Energy: {user_params.get('energy', 'medium')}
        - Preferred instruments: {', '.join(user_params.get('instruments', ['default']))}
        - Special requests: {user_params.get('special_requests', 'none')}
        """
        
        response = music_gen.generate_music(
            prompt=enhanced_prompt,
            duration_seconds=120,
            **user_params
        )
        
        filename = f"interactive_{variation_name}.mp3"
        with open(filename, "wb") as f:
            f.write(response.audio_data)
        
        variations[variation_name] = filename
        print(f"Generated interactive variation: {filename}")
    
    return variations

# Simulate user customizations
base_composition = "A melodic piece suitable for background listening"

user_customizations = {
    "relaxing_version": {
        "mood": "peaceful",
        "energy": "low",
        "tempo": "slow",
        "instruments": ["piano", "strings"],
        "special_requests": "extra soft and gentle"
    },
    "energetic_version": {
        "mood": "upbeat",
        "energy": "high", 
        "tempo": "fast",
        "instruments": ["electric_guitar", "drums"],
        "special_requests": "driving rhythm and dynamic"
    },
    "ambient_version": {
        "mood": "atmospheric",
        "energy": "low",
        "tempo": "very_slow",
        "instruments": ["synthesizer", "ambient_pads"],
        "special_requests": "spacious and ethereal"
    }
}

interactive_variations = generate_interactive_variations(
    base_composition,
    user_customizations
)
```

## Quality Control and Optimization

### Music Quality Assessment
```python
def assess_music_quality(audio_path):
    """Assess basic quality metrics of generated music."""
    try:
        import librosa
        import numpy as np
    except ImportError:
        print("Please install librosa: pip install librosa")
        return None
    
    # Load audio
    y, sr = librosa.load(audio_path, sr=None)
    
    # Calculate metrics
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    zero_crossing_rate = librosa.feature.zero_crossing_rate(y)[0]
    mfccs = librosa.feature.mfcc(y=y, sr=sr)
    
    # Assess audio characteristics
    duration = len(y) / sr
    rms_energy = librosa.feature.rms(y=y)[0]
    
    quality_metrics = {
        "duration_seconds": duration,
        "tempo_bpm": tempo,
        "avg_spectral_centroid": np.mean(spectral_centroid),
        "avg_zero_crossing_rate": np.mean(zero_crossing_rate),
        "avg_energy": np.mean(rms_energy),
        "dynamic_range": np.max(rms_energy) - np.min(rms_energy),
        "mfcc_variance": np.var(mfccs),
        "sample_rate": sr
    }
    
    # Simple quality score
    quality_score = 0
    if 60 <= tempo <= 200:  # Reasonable tempo range
        quality_score += 25
    if np.mean(rms_energy) > 0.01:  # Sufficient energy
        quality_score += 25
    if quality_metrics["dynamic_range"] > 0.05:  # Good dynamics
        quality_score += 25
    if quality_metrics["mfcc_variance"] > 100:  # Musical complexity
        quality_score += 25
    
    quality_metrics["quality_score"] = quality_score
    
    return quality_metrics

# Quality control in generation pipeline
def generate_with_quality_control(prompt, min_quality_score=70, max_attempts=3):
    """Generate music with quality control checks."""
    
    for attempt in range(max_attempts):
        print(f"Generation attempt {attempt + 1}")
        
        response = music_gen.generate_music(
            prompt=prompt,
            duration_seconds=120
        )
        
        # Save temporary file for assessment
        temp_file = f"temp_quality_check_{attempt}.mp3"
        with open(temp_file, "wb") as f:
            f.write(response.audio_data)
        
        # Assess quality
        quality = assess_music_quality(temp_file)
        
        if quality:
            print(f"Quality score: {quality['quality_score']}")
            print(f"Tempo: {quality['tempo_bpm']:.1f} BPM")
            print(f"Duration: {quality['duration_seconds']:.1f} seconds")
            
            if quality['quality_score'] >= min_quality_score:
                print("Quality check passed!")
                return response
        
        # Clean up temporary file
        import os
        os.remove(temp_file)
        print("Quality check failed, retrying...")
    
    print("Failed to generate music meeting quality standards")
    return None

# Usage
music_response = generate_with_quality_control(
    prompt="A beautiful piano composition with emotional depth",
    min_quality_score=75
)

if music_response:
    with open("final_piano_composition.mp3", "wb") as f:
        f.write(music_response.audio_data)
```

## Error Handling and Troubleshooting

### Robust Music Generation
```python
import time
import random

class RobustMusicGenerator:
    def __init__(self, model_name="lyria-2"):
        self.music_gen = genai.MusicGenerationModel(model_name)
        self.max_retries = 3
        self.base_delay = 5  # Longer delays for music generation
    
    def generate_with_retry(self, prompt, **kwargs):
        """Generate music with comprehensive error handling."""
        
        for attempt in range(self.max_retries):
            try:
                print(f"Attempt {attempt + 1}: Generating music...")
                
                response = self.music_gen.generate_music(
                    prompt=prompt,
                    **kwargs
                )
                
                print("Music generated successfully!")
                return response
                
            except Exception as e:
                error_msg = str(e).lower()
                
                if "quota" in error_msg or "limit" in error_msg:
                    wait_time = 600  # 10 minutes for quota issues
                    print(f"Quota exceeded. Waiting {wait_time} seconds...")
                    time.sleep(wait_time)
                    
                elif "rate" in error_msg:
                    delay = self.base_delay * (2 ** attempt) + random.uniform(0, 2)
                    print(f"Rate limited. Waiting {delay:.2f} seconds...")
                    time.sleep(delay)
                    
                elif "duration" in error_msg:
                    print("Duration too long, reducing...")
                    kwargs['duration_seconds'] = min(kwargs.get('duration_seconds', 120), 240)
                    
                elif "complexity" in error_msg:
                    print("Request too complex, simplifying...")
                    prompt = self._simplify_prompt(prompt)
                    
                else:
                    print(f"Unexpected error: {str(e)}")
                    if attempt == self.max_retries - 1:
                        print("All attempts failed")
                        return None
                    time.sleep(self.base_delay * (attempt + 1))
        
        return None
    
    def _simplify_prompt(self, prompt):
        """Simplify a complex prompt."""
        # Remove complex descriptors
        complex_terms = [
            "extremely complex", "highly intricate", "elaborate",
            "sophisticated", "advanced", "professional-level"
        ]
        
        simplified = prompt
        for term in complex_terms:
            simplified = simplified.replace(term, "")
        
        # Add simplification note
        simplified += " Keep the arrangement simple and clear."
        
        return simplified
    
    def validate_and_generate(self, prompt, **kwargs):
        """Validate parameters and generate music."""
        
        # Duration validation
        duration = kwargs.get('duration_seconds', 120)
        if duration > 240:  # 4 minute limit
            print("Warning: Duration exceeds limit, setting to 240 seconds")
            kwargs['duration_seconds'] = 240
        elif duration < 10:
            print("Warning: Duration too short, setting to 10 seconds")
            kwargs['duration_seconds'] = 10
        
        # Prompt validation
        if len(prompt) > 1000:
            print("Warning: Prompt too long, truncating...")
            prompt = prompt[:1000]
        
        if len(prompt.strip()) == 0:
            print("Error: Empty prompt provided")
            return None
        
        # Instrument validation
        instruments = kwargs.get('instruments', [])
        if len(instruments) > 10:
            print("Warning: Too many instruments specified, limiting to 10")
            kwargs['instruments'] = instruments[:10]
        
        return self.generate_with_retry(prompt, **kwargs)

# Usage
generator = RobustMusicGenerator()

music_response = generator.validate_and_generate(
    prompt="A serene orchestral piece that captures the beauty of a sunrise over mountains",
    duration_seconds=180,
    genre="orchestral",
    mood="peaceful"
)

if music_response:
    with open("sunrise_orchestral.mp3", "wb") as f:
        f.write(music_response.audio_data)
    print("Music generated successfully with robust handling!")
else:
    print("Failed to generate music")
```

## Integration Examples

### Flask Web Application
```python
from flask import Flask, request, jsonify, send_file
import tempfile
import os
import uuid

app = Flask(__name__)

@app.route('/generate-music', methods=['POST'])
def generate_music_api():
    """API endpoint for music generation."""
    try:
        data = request.json
        prompt = data.get('prompt')
        
        if not prompt:
            return jsonify({'error': 'Prompt is required'}), 400
        
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        
        # Generate music
        response = music_gen.generate_music(
            prompt=prompt,
            duration_seconds=data.get('duration_seconds', 120),
            genre=data.get('genre', 'general'),
            tempo=data.get('tempo', 'medium'),
            mood=data.get('mood', 'neutral')
        )
        
        # Save to temporary file
        temp_path = f"temp_music_{request_id}.mp3"
        with open(temp_path, "wb") as f:
            f.write(response.audio_data)
        
        return jsonify({
            'success': True,
            'request_id': request_id,
            'download_url': f'/download-music/{request_id}',
            'message': 'Music generated successfully'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download-music/<request_id>')
def download_music(request_id):
    """Download generated music file."""
    try:
        file_path = f"temp_music_{request_id}.mp3"
        
        if os.path.exists(file_path):
            def remove_file(response):
                try:
                    os.remove(file_path)
                except Exception:
                    pass
                return response
            
            return send_file(
                file_path,
                mimetype='audio/mp3',
                as_attachment=True,
                download_name='generated_music.mp3'
            )
        else:
            return jsonify({'error': 'File not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/music-styles')
def list_music_styles():
    """List available music styles and genres."""
    styles = {
        "genres": ["classical", "jazz", "rock", "electronic", "folk", "ambient"],
        "moods": ["happy", "sad", "energetic", "peaceful", "dramatic", "romantic"],
        "tempos": ["very_slow", "slow", "medium", "fast", "very_fast"],
        "instruments": ["piano", "guitar", "violin", "saxophone", "drums", "synthesizer"]
    }
    
    return jsonify(styles)

if __name__ == '__main__':
    app.run(debug=True)
```

### Streamlit Application
```python
import streamlit as st
import tempfile
import os

st.title("Google Music Generation")

# Sidebar for music parameters
st.sidebar.header("Music Parameters")

# Genre selection
genres = ["classical", "jazz", "rock", "electronic", "folk", "ambient", "pop", "country"]
selected_genre = st.sidebar.selectbox("Genre", genres)

# Mood selection
moods = ["happy", "sad", "energetic", "peaceful", "dramatic", "romantic", "mysterious"]
selected_mood = st.sidebar.selectbox("Mood", moods)

# Tempo selection
tempos = ["very_slow", "slow", "medium", "fast", "very_fast"]
selected_tempo = st.sidebar.selectbox("Tempo", tempos)

# Duration slider
duration = st.sidebar.slider("Duration (seconds)", 30, 240, 120)

# Main interface
st.subheader("Music Generation")
prompt = st.text_area("Describe the music you want to generate:", height=120)

# Example prompts
st.subheader("Example Prompts")
examples = [
    "A peaceful piano melody perfect for studying",
    "An energetic rock anthem with electric guitars",
    "A romantic jazz ballad with saxophone",
    "An epic orchestral piece for a movie trailer"
]

col1, col2 = st.columns(2)
for i, example in enumerate(examples):
    if i % 2 == 0:
        if col1.button(f"Example {i+1}", key=f"ex_{i}"):
            st.session_state.prompt = example
    else:
        if col2.button(f"Example {i+1}", key=f"ex_{i}"):
            st.session_state.prompt = example

# Use session state for prompt
if 'prompt' in st.session_state:
    prompt = st.session_state.prompt

# Generation
if st.button("Generate Music", type="primary"):
    if prompt:
        with st.spinner("Generating music... This may take several minutes."):
            try:
                response = music_gen.generate_music(
                    prompt=prompt,
                    duration_seconds=duration,
                    genre=selected_genre,
                    mood=selected_mood,
                    tempo=selected_tempo
                )
                
                # Save to temporary file
                with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp_file:
                    tmp_file.write(response.audio_data)
                    temp_path = tmp_file.name
                
                # Display audio player
                st.success("Music generated successfully!")
                st.audio(temp_path, format='audio/mp3')
                
                # Download button
                with open(temp_path, 'rb') as audio_file:
                    st.download_button(
                        label="Download Music",
                        data=audio_file.read(),
                        file_name="generated_music.mp3",
                        mime="audio/mp3"
                    )
                
                # Clean up
                os.unlink(temp_path)
                
            except Exception as e:
                st.error(f"Error generating music: {str(e)}")
    else:
        st.warning("Please enter a prompt describing the music you want")

# Display current settings
st.sidebar.subheader("Current Settings")
st.sidebar.info(f"""
**Genre:** {selected_genre}
**Mood:** {selected_mood}
**Tempo:** {selected_tempo}
**Duration:** {duration} seconds
""")

# Additional features
st.subheader("Music Theory Helper")
with st.expander("View Music Theory Tips"):
    st.write("""
    **Tempo Guidelines:**
    - Very Slow: 60-80 BPM (ballads, meditation)
    - Slow: 80-100 BPM (slow songs, blues)
    - Medium: 100-120 BPM (pop, folk)
    - Fast: 120-140 BPM (dance, rock)
    - Very Fast: 140+ BPM (EDM, punk)
    
    **Genre Characteristics:**
    - **Classical**: Orchestral instruments, complex harmonies
    - **Jazz**: Swing rhythms, improvisation, sophisticated chords
    - **Rock**: Electric guitars, strong drums, energetic
    - **Electronic**: Synthesizers, programmed beats, effects
    - **Folk**: Acoustic instruments, storytelling, traditional
    - **Ambient**: Atmospheric, slow evolution, ethereal
    """)
```

This comprehensive documentation covers all aspects of using Google's Music Generation API, from basic composition to advanced musical structures and production integration. 