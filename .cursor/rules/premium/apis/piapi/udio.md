# PiAPI Udio API - Standard Operating Procedure

## Overview

PiAPI provides access to Udio's powerful AI music generation capabilities through a unified API. Generate complete songs from text prompts, extend existing tracks, and create custom lyrics with professional-quality audio output.

**Base Endpoint**: `https://api.piapi.ai/api/v1/task`
**Model**: `music-u`
**Official Docs**: [https://piapi.ai/docs/music-api](https://piapi.ai/docs/music-api)

## Pricing (Pay-as-you-go)

| Operation | Price per Generation |
|-----------|---------------------|
| Music Generation | $0.05 |
| Song Extension | $0.05 |
| Lyrics Generation | $0.05 |

**Host-your-account**: $10/seat/month

## Authentication

```bash
curl -H "x-api-key: YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     https://api.piapi.ai/api/v1/task
```

## Common Request Structure

```json
{
  "model": "music-u",
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

### 1. Generate Music

Create music from text descriptions with different lyrical modes.

**Task Type**: `generate_music`

#### Simple Prompt Generation

Generate music based on textual description with auto-generated lyrics.

```json
{
  "model": "music-u",
  "task_type": "generate_music",
  "input": {
    "gpt_description_prompt": "night breeze, piano",
    "negative_tags": "",
    "lyrics_type": "generate",
    "seed": -1
  },
  "config": {
    "service_mode": "public",
    "webhook_config": {
      "endpoint": "",
      "secret": ""
    }
  }
}
```

**Parameters**:
- `gpt_description_prompt` (required): Musical style/mood description
- `negative_tags`: Styles to avoid (comma-separated)
- `lyrics_type`: `generate`, `instrumental`, `user`
- `seed`: Random seed for reproducible results (-1 for random)
- `title`: Optional song title

#### Instrumental Generation

Create instrumental music without vocals.

```json
{
  "model": "music-u",
  "task_type": "generate_music",
  "input": {
    "gpt_description_prompt": "epic orchestral soundtrack, cinematic",
    "negative_tags": "pop,rock",
    "lyrics_type": "instrumental",
    "seed": -1
  },
  "config": {
    "service_mode": "public"
  }
}
```

#### Custom Lyrics Generation

Generate music using your own lyrics.

```json
{
  "model": "music-u",
  "task_type": "generate_music",
  "input": {
    "lyrics": "[Verse]\nIn the gentle evening air,\nWhispers dance without a care.\nStars ignite our dreams above,\nWrapped in warmth, we find our love.\n[Chorus]\nLet the music play tonight,\nFeel the rhythm burning bright,\nEvery heartbeat tells a story,\nIn this moment, we find glory.",
    "gpt_description_prompt": "jazz, pop",
    "negative_tags": "heavy metal",
    "lyrics_type": "user",
    "seed": -1
  },
  "config": {
    "service_mode": "public"
  }
}
```

**Response Example**:
```json
{
  "code": 200,
  "data": {
    "task_id": "abc123-456-789",
    "status": "completed",
    "output": {
      "audio_url": "https://cdn.udio.com/song.mp3",
      "duration": 120.5,
      "title": "Night Breeze Melody",
      "lyrics": "Generated or provided lyrics...",
      "tags": ["jazz", "pop", "chill"],
      "created_at": "2025-01-30T10:00:00Z"
    }
  }
}
```

### 2. Song Extension

Extend existing songs with additional content.

**Task Type**: `song_extend`

```json
{
  "model": "music-u",
  "task_type": "song_extend",
  "input": {
    "origin_task_id": "original_song_task_id",
    "extend_direction": "end",
    "extend_prompt": "add a guitar solo",
    "extend_duration": 30
  }
}
```

**Parameters**:
- `origin_task_id`: Task ID of the original song
- `extend_direction`: `beginning`, `end`
- `extend_prompt`: Description of what to add
- `extend_duration`: Length in seconds to extend

### 3. Generate Lyrics

Create lyrics based on theme or prompt.

**Task Type**: `generate_lyrics`

```json
{
  "model": "music-u",
  "task_type": "generate_lyrics",
  "input": {
    "theme": "love and loss",
    "style": "pop ballad",
    "structure": "verse-chorus-verse-chorus-bridge-chorus",
    "mood": "melancholic"
  }
}
```

**Response Example**:
```json
{
  "output": {
    "lyrics": "[Verse 1]\nEmpty rooms echo with your name\nPhotographs that look the same\nBut everything has changed somehow\nI'm learning to let go now\n\n[Chorus]\nLove and loss, they dance together\nIn my heart like stormy weather\nWhat we had will never fade\nBut I'm stronger than the pain\n\n[Verse 2]\nMemories like shooting stars\nBeautiful but from afar\nTime will heal what's broken here\nThrough the joy and through the tears\n\n[Chorus]\nLove and loss, they dance together\nIn my heart like stormy weather\nWhat we had will never fade\nBut I'm stronger than the pain\n\n[Bridge]\nSome days I still hear your voice\nReminding me I have a choice\nTo hold on tight or let it go\nThis is how I learn to grow\n\n[Chorus]\nLove and loss, they dance together\nIn my heart like stormy weather\nWhat we had will never fade\nBut I'm stronger than the pain",
    "structure_breakdown": {
      "verses": 2,
      "choruses": 3,
      "bridges": 1,
      "estimated_duration": "3:30"
    }
  }
}
```

## Musical Styles and Genres

### Popular Genres
- **Pop**: Catchy melodies, mainstream appeal
- **Rock**: Guitar-driven, energetic
- **Jazz**: Complex harmonies, improvisation
- **Classical**: Orchestral, sophisticated
- **Electronic**: Synthesized sounds, beats
- **Hip-hop**: Rhythmic vocals, beats
- **Country**: Storytelling, acoustic
- **Blues**: Emotional, guitar-based
- **Reggae**: Laid-back rhythm, Caribbean

### Mood Descriptors
- **Upbeat**: Energetic, positive
- **Chill**: Relaxed, calm
- **Dark**: Moody, intense
- **Romantic**: Loving, intimate
- **Epic**: Grand, cinematic
- **Mysterious**: Enigmatic, suspenseful
- **Nostalgic**: Wistful, reflective

### Instrumentation
- **Piano**: Classical, jazz, pop
- **Guitar**: Acoustic, electric, fingerpicked
- **Strings**: Violin, cello, orchestral
- **Drums**: Various styles and patterns
- **Synthesizer**: Electronic sounds
- **Brass**: Trumpet, saxophone, horns
- **Vocals**: Male, female, harmony

## Lyrics Structure

### Standard Song Structure

```
[Intro]
[Verse 1]
[Pre-Chorus] (optional)
[Chorus]
[Verse 2]
[Pre-Chorus] (optional)
[Chorus]
[Bridge]
[Chorus]
[Outro]
```

### Lyrics Formatting

```
[Verse 1]
First verse lyrics here
Multiple lines supported
Each line on new line

[Chorus]
Catchy chorus lyrics
Repeatable hook
Memorable phrases

[Verse 2]
Second verse lyrics
Different from first
Continues the story

[Bridge]
Bridge section
Changes the mood
Builds to final chorus
```

## Best Practices

### 1. Prompt Engineering

**Good Prompts**:
```
"Acoustic folk ballad with fingerpicked guitar and soft female vocals"
"Upbeat electronic dance music with heavy bass and synth leads"
"Melancholic jazz piano piece with subtle drums and walking bass"
```

**Avoid Vague Prompts**:
```
"good music"
"song"
"beats"
```

### 2. Genre Mixing

```json
{
  "gpt_description_prompt": "jazz-fusion with electronic elements, saxophone lead, synthesized bass"
}
```

### 3. Mood and Energy Control

```json
{
  "gpt_description_prompt": "high-energy rock anthem",
  "negative_tags": "slow, ballad, acoustic"
}
```

### 4. Lyrics Guidelines

**Effective Lyrics**:
- Tell a story or convey emotion
- Use rhyme schemes consistently
- Include repeated hooks/phrases
- Match the musical mood

**Structure Example**:
```
[Verse 1]
Set the scene, introduce the story
Use specific imagery and details
Build toward the chorus theme

[Chorus]
Main message or emotion
Most memorable part
Designed to be sung along

[Verse 2]
Develop the story further
Add new information
Keep consistent with verse 1

[Bridge]
Change perspective or add twist
Different melody/rhythm
Builds tension for final chorus
```

## Error Handling

### Common Errors

- **Prompt too long**: Max 2500 characters
- **Invalid lyrics format**: Use proper structure tags
- **Inappropriate content**: Violates platform guidelines
- **File size limits**: Generated audio files have size restrictions

### Error Response Example

```json
{
  "code": 400,
  "data": {
    "error": {
      "code": 1100,
      "message": "Lyrics contain inappropriate content",
      "detail": "Please revise lyrics to comply with content guidelines"
    }
  }
}
```

## Integration Examples

### Node.js Example

```javascript
class UdioAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.piapi.ai/api/v1';
  }
  
  async generateMusic(prompt, options = {}) {
    const response = await fetch(`${this.baseURL}/task`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'music-u',
        task_type: 'generate_music',
        input: {
          gpt_description_prompt: prompt,
          lyrics_type: options.lyricsType || 'generate',
          negative_tags: options.negativeTags || '',
          seed: options.seed || -1,
          lyrics: options.lyrics,
          title: options.title
        }
      })
    });
    
    return response.json();
  }
  
  async generateLyrics(theme, style = 'pop') {
    const response = await fetch(`${this.baseURL}/task`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'music-u',
        task_type: 'generate_lyrics',
        input: {
          theme,
          style,
          structure: 'verse-chorus-verse-chorus-bridge-chorus'
        }
      })
    });
    
    return response.json();
  }
  
  async extendSong(taskId, direction = 'end', prompt = '', duration = 30) {
    const response = await fetch(`${this.baseURL}/task`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'music-u',
        task_type: 'song_extend',
        input: {
          origin_task_id: taskId,
          extend_direction: direction,
          extend_prompt: prompt,
          extend_duration: duration
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

class UdioAPI:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.piapi.ai/api/v1'
        
    def generate_music(self, prompt, lyrics_type='generate', **options):
        headers = {
            'x-api-key': self.api_key,
            'Content-Type': 'application/json'
        }
        
        data = {
            'model': 'music-u',
            'task_type': 'generate_music',
            'input': {
                'gpt_description_prompt': prompt,
                'lyrics_type': lyrics_type,
                'negative_tags': options.get('negative_tags', ''),
                'seed': options.get('seed', -1),
                'lyrics': options.get('lyrics'),
                'title': options.get('title')
            }
        }
        
        response = requests.post(
            f'{self.base_url}/task',
            headers=headers,
            json=data
        )
        
        return response.json()
    
    def generate_lyrics(self, theme, style='pop'):
        headers = {
            'x-api-key': self.api_key,
            'Content-Type': 'application/json'
        }
        
        data = {
            'model': 'music-u',
            'task_type': 'generate_lyrics',
            'input': {
                'theme': theme,
                'style': style,
                'structure': 'verse-chorus-verse-chorus-bridge-chorus'
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
                
            time.sleep(15)  # Music generation takes longer
            
        raise TimeoutError(f"Task {task_id} did not complete within {timeout}s")
```

## Workflow Examples

### Complete Song Creation Workflow

```javascript
// 1. Generate lyrics first
const lyricsTask = await udio.generateLyrics(
  'adventure and discovery',
  'folk rock'
);

const lyricsResult = await pollTask(lyricsTask.task_id);

// 2. Generate music with custom lyrics
const musicTask = await udio.generateMusic(
  'upbeat folk rock with acoustic guitar and harmonica',
  {
    lyricsType: 'user',
    lyrics: lyricsResult.output.lyrics,
    title: 'Journey Ahead'
  }
);

const musicResult = await pollTask(musicTask.task_id);

// 3. Extend the song with an outro
const extendTask = await udio.extendSong(
  musicResult.task_id,
  'end',
  'fade out with harmonica solo',
  20
);
```

### Batch Music Generation

```javascript
async function generateMusicPlaylist(themes, style = 'pop') {
  const tasks = [];
  
  for (const theme of themes) {
    const task = await udio.generateMusic(
      `${style} song about ${theme}`,
      { lyricsType: 'generate' }
    );
    
    tasks.push({
      theme,
      taskId: task.task_id
    });
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Wait for all completions
  const results = await Promise.all(
    tasks.map(async task => {
      const result = await pollTask(task.taskId);
      return {
        theme: task.theme,
        audioUrl: result.output.audio_url,
        title: result.output.title
      };
    })
  );
  
  return results;
}

// Usage
const playlist = await generateMusicPlaylist([
  'summer romance',
  'city nights',
  'overcoming challenges',
  'childhood memories'
], 'indie pop');
```

## File Requirements

### Audio Output
- **Format**: MP3, WAV
- **Quality**: High-fidelity audio
- **Duration**: Up to 4 minutes per generation
- **Sample Rate**: 44.1kHz
- **Bit Rate**: 320kbps (MP3)

### Lyrics Input
- **Format**: Plain text with structure tags
- **Max length**: 2500 characters
- **Encoding**: UTF-8
- **Structure**: Use [Tag] format for sections

## Performance Optimization

### Caching Strategy

```javascript
// Cache generated songs to avoid regeneration
const songCache = new Map();

async function getCachedSong(prompt, options) {
  const cacheKey = JSON.stringify({ prompt, options });
  
  if (songCache.has(cacheKey)) {
    return songCache.get(cacheKey);
  }
  
  const result = await udio.generateMusic(prompt, options);
  const completedResult = await pollTask(result.task_id);
  
  if (completedResult.status === 'completed') {
    songCache.set(cacheKey, completedResult);
  }
  
  return completedResult;
}
```

### Concurrent Processing

```javascript
// Process multiple music requests concurrently
async function batchGenerateMusic(requests) {
  const BATCH_SIZE = 5; // Respect rate limits
  const results = [];
  
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    const batch = requests.slice(i, i + BATCH_SIZE);
    
    const batchTasks = await Promise.all(
      batch.map(request => 
        udio.generateMusic(request.prompt, request.options)
      )
    );
    
    results.push(...batchTasks);
    
    // Wait between batches
    if (i + BATCH_SIZE < requests.length) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  return results;
}
```

## Troubleshooting

### Common Issues

1. **Generation Takes Too Long**
   - Music generation typically takes 60-120 seconds
   - Use webhooks instead of polling frequently
   - Check service status if delays persist

2. **Audio Quality Issues**
   - Ensure prompts are specific and detailed
   - Avoid conflicting style descriptions
   - Use negative tags to exclude unwanted elements

3. **Lyrics Not Matching Music**
   - Ensure lyrics structure matches musical style
   - Use appropriate song structure tags
   - Test with instrumental first, then add lyrics

### Debug Mode

```javascript
// Enable detailed logging for debugging
const task = await udio.generateMusic(prompt, {
  lyricsType: 'generate',
  debug: true
});

console.log('Task details:', task.data.meta);
```

## Rate Limits & Concurrency

### Free Plan
- 2 concurrent music generations
- Basic audio quality
- Limited daily generations

### Creator Plan ($8/month)
- 5 concurrent generations
- High-quality audio
- Extended generation limits

### Pro Plan ($50/month)
- 10 concurrent generations
- Premium audio quality
- Unlimited daily generations
- Priority processing

---

*For more examples and advanced usage, see the [PiAPI Udio Documentation](https://piapi.ai/docs/music-api)*

*Last Updated: January 2025* 