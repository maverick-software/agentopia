# Fireworks AI - Audio & Voice Services SOP

## Overview
**Version:** 2.0  
**Last Updated:** May 2025  
**Service Category:** Audio Processing & Voice AI  
**Purpose:** Comprehensive implementation guide for Fireworks AI's audio services including speech-to-text, voice agents, streaming transcription, and real-time audio processing.

---

## 🎯 SUPPORTED MODELS & CAPABILITIES

### 🎤 **Speech-to-Text (Whisper Models)**
#### Whisper v3-Large
- **Model ID:** `whisper-v3`
- **Pricing:** $0.0015 per audio minute (async), $0.0032 per minute (streaming)
- **Features:** Industry-leading accuracy, 20x faster than OpenAI
- **Performance:** 1 hour audio transcribed in 4 seconds
- **Languages:** 80+ languages supported
- **Quality:** 2.00% WER on Librispeech Clean dataset

#### Whisper v3-Large-Turbo
- **Model ID:** `whisper-v3-turbo`
- **Pricing:** $0.0009 per audio minute (async)
- **Features:** Optimized for speed, 3x faster processing
- **Performance:** 1 hour audio transcribed in 3 seconds
- **Use Cases:** High-volume processing, real-time applications

### 🔊 **Voice Agent Platform (Beta)**
#### Real-time Voice Agents
- **Latency:** <300ms end-to-end
- **Components:** ASR + LLM + TTS integrated
- **Features:** Conversational AI, interruption handling, context awareness
- **Deployment:** Serverless and dedicated options

#### Voice Agent Services
- **Fireworks ASR:** Proprietary speech recognition
- **Fireworks TTS:** Realistic, steerable voices  
- **Voice Processing:** Real-time audio streaming, WebRTC support

### 📡 **Streaming Transcription**
#### Real-time Processing
- **Latency:** 300ms end-to-end for 16kHz mono PCM
- **Connection:** WebSocket-based streaming
- **Accuracy:** Within 3% WER of Whisper v3-large
- **Concurrency:** 50 concurrent streams (serverless), unlimited (dedicated)

---

## 🔧 IMPLEMENTATION PATTERNS

### Basic Speech-to-Text (Async)
```python
import requests
import base64

class FireworksAudioProcessor:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.fireworks.ai/inference/v1'
    
    def transcribe_audio(self, audio_file_path, model='whisper-v3', **kwargs):
        """
        Transcribe audio file using Fireworks Whisper models
        """
        # Read and encode audio file
        with open(audio_file_path, 'rb') as audio_file:
            audio_data = base64.b64encode(audio_file.read()).decode('utf-8')
        
        payload = {
            'model': model,
            'file': audio_data,
            'response_format': kwargs.get('response_format', 'json'),
            'language': kwargs.get('language'),
            'timestamp_granularities': kwargs.get('timestamp_granularities', ['word']),
            'translation': kwargs.get('translation', False),
            'vad_filter': kwargs.get('vad_filter', True),
            'audio_filter': kwargs.get('audio_filter', 'dynamic')
        }
        
        response = requests.post(
            f'{self.base_url}/audio/transcriptions',
            headers={
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            },
            json=payload
        )
        
        response.raise_for_status()
        return response.json()
    
    def translate_audio(self, audio_file_path, target_language='en', **kwargs):
        """
        Translate audio to specified language
        """
        return self.transcribe_audio(
            audio_file_path, 
            translation=True,
            language=target_language,
            **kwargs
        )

# Usage example
processor = FireworksAudioProcessor('your_api_key_here')

# Basic transcription
result = processor.transcribe_audio('meeting_recording.wav')
print("Transcription:", result['text'])

# With word-level timestamps
result_with_timestamps = processor.transcribe_audio(
    'podcast.mp3',
    timestamp_granularities=['word', 'segment'],
    response_format='verbose_json'
)

for segment in result_with_timestamps['segments']:
    print(f"[{segment['start']:.2f}s - {segment['end']:.2f}s]: {segment['text']}")
```

### Streaming Real-time Transcription
```python
import websocket
import json
import threading
import time
import urllib.parse

class FireworksStreamingTranscriber:
    def __init__(self, api_key, model='whisper-v3', language='en'):
        self.api_key = api_key
        self.model = model
        self.language = language
        self.segments = {}
        self.lock = threading.Lock()
        self.ws = None
    
    def start_streaming(self, audio_chunks_generator):
        """
        Start streaming transcription session
        audio_chunks_generator: Iterator that yields audio chunks (bytes)
        """
        url = "ws://audio-streaming.us-virginia-1.direct.fireworks.ai/v1/audio/transcriptions/streaming"
        params = urllib.parse.urlencode({
            "model": self.model,
            "language": self.language,
            "response_format": "json"
        })
        
        self.ws = websocket.WebSocketApp(
            f"{url}?{params}",
            header={"Authorization": f"Bearer {self.api_key}"},
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )
        
        # Start audio streaming in separate thread
        self.audio_generator = audio_chunks_generator
        self.ws.run_forever()
    
    def on_open(self, ws):
        """WebSocket connection opened"""
        print("🎤 Streaming connection established")
        
        # Start sending audio chunks
        def send_audio():
            try:
                for chunk in self.audio_generator:
                    if len(chunk) > 0:
                        ws.send(chunk, opcode=websocket.ABNF.OPCODE_BINARY)
                        time.sleep(0.05)  # 50ms intervals
                    
                # Signal end of audio
                time.sleep(2)
                ws.close()
            except Exception as e:
                print(f"Error sending audio: {e}")
        
        threading.Thread(target=send_audio, daemon=True).start()
    
    def on_message(self, ws, message):
        """Process incoming transcription segments"""
        try:
            data = json.loads(message)
            new_segments = {seg["id"]: seg["text"] for seg in data.get("segments", [])}
            
            with self.lock:
                self.segments.update(new_segments)
                # Print incremental transcript
                transcript = " ".join(self.segments.values())
                print(f"\r🔊 {transcript}", end="", flush=True)
                
        except json.JSONDecodeError as e:
            print(f"Error parsing message: {e}")
    
    def on_error(self, ws, error):
        print(f"❌ WebSocket error: {error}")
    
    def on_close(self, ws, close_status_code, close_msg):
        print(f"\n✅ Transcription session ended")
        return self.get_final_transcript()
    
    def get_final_transcript(self):
        """Get the complete final transcript"""
        with self.lock:
            return " ".join(self.segments.values())

# Usage with audio file
def audio_chunks_from_file(file_path, chunk_duration_ms=100):
    """Generate audio chunks from file"""
    import torchaudio
    
    waveform, sample_rate = torchaudio.load(file_path)
    
    # Convert to 16kHz mono if needed
    if sample_rate != 16000:
        resampler = torchaudio.transforms.Resample(sample_rate, 16000)
        waveform = resampler(waveform)
    
    if waveform.shape[0] > 1:  # Convert to mono
        waveform = waveform.mean(dim=0, keepdim=True)
    
    # Convert to 16-bit PCM
    waveform_int16 = (waveform * 32767).clamp(-32768, 32767).to(torch.int16)
    
    # Generate chunks
    chunk_size = int(16000 * chunk_duration_ms / 1000)
    for i in range(0, waveform_int16.shape[1], chunk_size):
        chunk = waveform_int16[:, i:i+chunk_size]
        yield chunk.numpy().tobytes()

# Example usage
transcriber = FireworksStreamingTranscriber('your_api_key_here')
audio_chunks = audio_chunks_from_file('interview.wav')
final_transcript = transcriber.start_streaming(audio_chunks)
print(f"Final transcript: {final_transcript}")
```

### Voice Agent Implementation
```python
import asyncio
import websockets
import json

class FireworksVoiceAgent:
    def __init__(self, api_key, voice_config=None):
        self.api_key = api_key
        self.voice_config = voice_config or {
            'voice': 'nova',
            'speed': 1.0,
            'pitch': 1.0
        }
        self.conversation_context = []
    
    async def start_voice_conversation(self, websocket_uri=None):
        """
        Start a voice agent conversation session
        """
        uri = websocket_uri or "wss://voice-agents.fireworks.ai/v1/realtime"
        
        async with websockets.connect(
            uri,
            extra_headers={"Authorization": f"Bearer {self.api_key}"}
        ) as websocket:
            
            # Send initial configuration
            config = {
                "type": "session.update",
                "session": {
                    "modalities": ["text", "audio"],
                    "voice": self.voice_config['voice'],
                    "input_audio_format": "pcm16",
                    "output_audio_format": "pcm16",
                    "turn_detection": {
                        "type": "server_vad",
                        "threshold": 0.5
                    }
                }
            }
            await websocket.send(json.dumps(config))
            
            # Handle incoming messages
            async for message in websocket:
                await self.handle_voice_message(json.loads(message))
    
    async def handle_voice_message(self, message):
        """Process voice agent messages"""
        msg_type = message.get('type')
        
        if msg_type == 'conversation.item.created':
            # New conversation item (user speech or agent response)
            item = message['item']
            if item['type'] == 'message':
                role = item['role']
                content = item.get('content', [])
                print(f"{role.upper()}: {self.extract_text_content(content)}")
        
        elif msg_type == 'response.audio.delta':
            # Streaming audio response from agent
            audio_data = message['delta']
            await self.play_audio_chunk(audio_data)
        
        elif msg_type == 'input_audio_buffer.speech_started':
            print("🎤 User started speaking...")
        
        elif msg_type == 'input_audio_buffer.speech_stopped':
            print("🎤 User stopped speaking")
    
    def extract_text_content(self, content_list):
        """Extract text from content array"""
        for item in content_list:
            if item.get('type') == 'text':
                return item.get('text', '')
        return ''
    
    async def play_audio_chunk(self, audio_data):
        """Play audio chunk (implement with your audio library)"""
        # Implement audio playback here
        # Example: use pyaudio, sounddevice, or browser Web Audio API
        pass

# Usage example
async def run_voice_agent():
    agent = FireworksVoiceAgent('your_api_key_here')
    await agent.start_voice_conversation()

# asyncio.run(run_voice_agent())
```

---

## ⚡ PERFORMANCE OPTIMIZATION

### Audio Processing Pipeline
```python
class OptimizedAudioPipeline:
    def __init__(self, api_key):
        self.api_key = api_key
        self.processor = FireworksAudioProcessor(api_key)
    
    def preprocess_audio(self, audio_path, target_format='wav', 
                        sample_rate=16000, channels=1):
        """
        Preprocess audio for optimal transcription
        """
        import torchaudio
        
        # Load audio
        waveform, sr = torchaudio.load(audio_path)
        
        # Resample if needed
        if sr != sample_rate:
            resampler = torchaudio.transforms.Resample(sr, sample_rate)
            waveform = resampler(waveform)
        
        # Convert to mono if needed
        if waveform.shape[0] > channels:
            waveform = waveform.mean(dim=0, keepdim=True)
        
        # Apply noise reduction (optional)
        if self.detect_noise_level(waveform) > 0.3:
            waveform = self.apply_noise_reduction(waveform)
        
        # Save processed audio
        processed_path = f"processed_{audio_path}"
        torchaudio.save(processed_path, waveform, sample_rate)
        
        return processed_path
    
    def batch_transcribe(self, audio_files, concurrent_limit=5):
        """
        Transcribe multiple files concurrently
        """
        import asyncio
        import aiohttp
        
        async def transcribe_single(session, file_path):
            # Preprocess audio
            processed_file = self.preprocess_audio(file_path)
            
            # Transcribe using async HTTP
            result = await self.async_transcribe(session, processed_file)
            return {
                'file': file_path,
                'transcript': result['text'],
                'duration': result.get('duration'),
                'confidence': result.get('confidence')
            }
        
        async def batch_process():
            semaphore = asyncio.Semaphore(concurrent_limit)
            async with aiohttp.ClientSession() as session:
                tasks = []
                for file_path in audio_files:
                    async with semaphore:
                        task = transcribe_single(session, file_path)
                        tasks.append(task)
                
                return await asyncio.gather(*tasks)
        
        return asyncio.run(batch_process())
    
    def detect_noise_level(self, waveform):
        """Detect background noise level"""
        # Simple noise detection using signal variance
        return float(waveform.var())
    
    def apply_noise_reduction(self, waveform):
        """Apply basic noise reduction"""
        # Implement noise reduction (e.g., spectral subtraction)
        return waveform  # Placeholder
```

### Cost Optimization Strategies
```python
class AudioCostOptimizer:
    def __init__(self):
        self.pricing = {
            'whisper-v3': {'async': 0.0015, 'streaming': 0.0032},
            'whisper-v3-turbo': {'async': 0.0009, 'streaming': 0.0025}
        }
    
    def choose_optimal_model(self, audio_duration_minutes, 
                           use_case, quality_requirement):
        """
        Choose the most cost-effective model
        """
        if use_case == 'real_time':
            # Streaming required
            if quality_requirement == 'high':
                return 'whisper-v3'
            else:
                return 'whisper-v3-turbo'
        
        elif use_case == 'batch_processing':
            # Async processing, optimize for cost
            if audio_duration_minutes > 60:  # Long audio
                return 'whisper-v3-turbo'  # Faster = cheaper
            else:
                return 'whisper-v3'  # Better quality for short audio
        
        return 'whisper-v3'  # Default
    
    def estimate_cost(self, audio_duration_minutes, model, processing_type):
        """Estimate processing cost"""
        rate = self.pricing.get(model, {}).get(processing_type, 0)
        return audio_duration_minutes * rate
    
    def optimize_audio_segments(self, long_audio_path, max_segment_minutes=30):
        """
        Split long audio into optimal segments for processing
        """
        import torchaudio
        
        waveform, sample_rate = torchaudio.load(long_audio_path)
        duration_seconds = waveform.shape[1] / sample_rate
        
        if duration_seconds / 60 <= max_segment_minutes:
            return [long_audio_path]  # No splitting needed
        
        # Split into segments
        segment_samples = int(max_segment_minutes * 60 * sample_rate)
        segments = []
        
        for i in range(0, waveform.shape[1], segment_samples):
            segment = waveform[:, i:i+segment_samples]
            segment_path = f"segment_{i//segment_samples}.wav"
            torchaudio.save(segment_path, segment, sample_rate)
            segments.append(segment_path)
        
        return segments
```

---

## 🚀 PRODUCTION DEPLOYMENT

### Voice-Enabled Web Application
```javascript
// Frontend: Voice-enabled chat interface
class VoiceChat {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.websocket = null;
    }
    
    async startVoiceChat() {
        // Request microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { sampleRate: 16000, channelCount: 1 } 
        });
        
        // Start streaming transcription
        this.connectWebSocket();
        
        // Setup audio recording
        this.mediaRecorder = new MediaRecorder(stream);
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.sendAudioChunk(event.data);
            }
        };
        
        this.mediaRecorder.start(100); // 100ms chunks
        this.isRecording = true;
    }
    
    connectWebSocket() {
        const wsUrl = 'wss://audio-streaming.fireworks.ai/v1/audio/transcriptions/streaming';
        const params = new URLSearchParams({
            model: 'whisper-v3',
            language: 'en'
        });
        
        this.websocket = new WebSocket(`${wsUrl}?${params}`, [], {
            headers: { 'Authorization': `Bearer ${this.apiKey}` }
        });
        
        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleTranscription(data);
        };
        
        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    sendAudioChunk(audioBlob) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            // Convert to required format and send
            audioBlob.arrayBuffer().then(buffer => {
                this.websocket.send(buffer);
            });
        }
    }
    
    handleTranscription(data) {
        // Update UI with transcription
        const transcript = data.segments?.map(s => s.text).join(' ') || '';
        document.getElementById('transcript').textContent = transcript;
        
        // Send to LLM when user stops speaking
        if (data.is_final) {
            this.processWithLLM(transcript);
        }
    }
    
    async processWithLLM(transcript) {
        // Send transcript to Fireworks LLM
        const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'accounts/fireworks/models/llama-v3p1-405b-instruct',
                messages: [
                    { role: 'user', content: transcript }
                ]
            })
        });
        
        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        
        // Convert response to speech and play
        this.textToSpeech(aiResponse);
    }
    
    async textToSpeech(text) {
        // Use Fireworks TTS or browser speech synthesis
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        speechSynthesis.speak(utterance);
    }
    
    stopVoiceChat() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
        }
        
        if (this.websocket) {
            this.websocket.close();
        }
    }
}

// Usage
const voiceChat = new VoiceChat('your_api_key_here');
document.getElementById('start-btn').onclick = () => voiceChat.startVoiceChat();
document.getElementById('stop-btn').onclick = () => voiceChat.stopVoiceChat();
```

### Audio Processing Microservice
```python
# FastAPI microservice for audio processing
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import uvicorn
import tempfile
import os

app = FastAPI(title="Fireworks Audio Service")

processor = FireworksAudioProcessor(os.getenv('FIREWORKS_API_KEY'))

@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    model: str = "whisper-v3",
    language: str = None,
    translation: bool = False
):
    """Transcribe uploaded audio file"""
    
    # Validate file type
    if not file.content_type.startswith('audio/'):
        raise HTTPException(400, "File must be audio format")
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_file_path = tmp_file.name
    
    try:
        # Process audio
        result = processor.transcribe_audio(
            tmp_file_path,
            model=model,
            language=language,
            translation=translation
        )
        
        return JSONResponse({
            "transcript": result['text'],
            "language": result.get('language'),
            "duration": result.get('duration'),
            "confidence": result.get('confidence', 0.95)
        })
        
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {str(e)}")
    
    finally:
        # Clean up temp file
        os.unlink(tmp_file_path)

@app.post("/batch-transcribe")
async def batch_transcribe(files: list[UploadFile] = File(...)):
    """Transcribe multiple audio files"""
    
    results = []
    for file in files:
        try:
            # Process each file
            with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
                content = await file.read()
                tmp_file.write(content)
                tmp_file_path = tmp_file.name
            
            result = processor.transcribe_audio(tmp_file_path)
            results.append({
                "filename": file.filename,
                "transcript": result['text'],
                "status": "success"
            })
            
            os.unlink(tmp_file_path)
            
        except Exception as e:
            results.append({
                "filename": file.filename,
                "error": str(e),
                "status": "failed"
            })
    
    return JSONResponse({"results": results})

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "fireworks-audio"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## 📊 BENCHMARKS & PERFORMANCE

### Model Performance Comparison (May 2025)
| Model | Processing Speed | Cost per Minute | Accuracy (WER) | Best Use Cases |
|-------|------------------|-----------------|----------------|----------------|
| Whisper v3-Large | 900x real-time | $0.0015 (async) | 2.00% | High-accuracy transcription |
| Whisper v3-Turbo | 1200x real-time | $0.0009 (async) | 2.5% | High-volume processing |
| Streaming v3 | 300ms latency | $0.0032 | 3% | Real-time applications |

### Use Case Recommendations
```python
def recommend_audio_solution(use_case, audio_length, quality_needs, budget):
    """
    Recommend optimal Fireworks audio solution
    """
    recommendations = {
        'podcast_transcription': {
            'model': 'whisper-v3-turbo',
            'processing': 'async',
            'features': ['vad_filter', 'word_timestamps']
        },
        'meeting_notes': {
            'model': 'whisper-v3',
            'processing': 'async', 
            'features': ['speaker_diarization', 'word_timestamps']
        },
        'voice_assistant': {
            'model': 'whisper-v3',
            'processing': 'streaming',
            'features': ['real_time', 'interruption_handling']
        },
        'call_center': {
            'model': 'whisper-v3-turbo',
            'processing': 'streaming',
            'features': ['low_latency', 'noise_reduction']
        },
        'content_creation': {
            'model': 'whisper-v3',
            'processing': 'async',
            'features': ['high_accuracy', 'multiple_languages']
        }
    }
    
    return recommendations.get(use_case, recommendations['podcast_transcription'])
```

---

*This SOP provides comprehensive guidance for implementing Fireworks AI's audio and voice services. For the latest features and updates, refer to the Fireworks AI documentation and audio API guides.* 