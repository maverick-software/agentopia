/**
 * Simple Voice Chat Hook - COPIED FROM WORKING useVoiceRecorder
 * Stripped down version that just records and sends to voice-chat-stream
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type RecordingMode = 'manual' | 'push-to-talk';
export type PTTKey = 'Space' | 'ControlLeft' | 'ControlRight';

interface UseSimpleVoiceChatOptions {
  conversationId: string;
  agentId: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  recordingMode?: RecordingMode;
  pttKey?: PTTKey;
  onError?: (error: Error) => void;
  onComplete?: (messageId: string) => void;
}

interface VoiceChatState {
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
  audioLevel: number;
}

export function useSimpleVoiceChat(options: UseSimpleVoiceChatOptions) {
  const {
    conversationId,
    agentId,
    voice = 'alloy',
    recordingMode = 'manual',
    pttKey = 'Space',
    onError,
    onComplete
  } = options;

  const [state, setState] = useState<VoiceChatState>({
    isRecording: false,
    isProcessing: false,
    error: null,
    audioLevel: 0
  });
  const [isPTTPressed, setIsPTTPressed] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pttActiveRef = useRef(false);

  /**
   * Start recording - EXACT COPY FROM useVoiceRecorder.ts
   */
  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;

      // Set up audio visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Start audio level monitoring
      const updateAudioLevel = () => {
        if (analyserRef.current && state.isRecording) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          const normalizedLevel = Math.min(average / 128, 1);
          
          setState(prev => ({ ...prev, audioLevel: normalizedLevel }));
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop audio visualization
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        // Clean up audio context
        if (audioContextRef.current) {
          await audioContextRef.current.close();
          audioContextRef.current = null;
        }

        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Process the audio
        await processAudio();
      };

      // Start recording
      mediaRecorder.start();
      setState(prev => ({ ...prev, isRecording: true, audioLevel: 0 }));
      updateAudioLevel();

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to start recording');
      setState(prev => ({ ...prev, error: err.message }));
      onError?.(err);
    }
  }, [state.isRecording, onError]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      setState(prev => ({ ...prev, isRecording: false, audioLevel: 0 }));
    }
  }, [state.isRecording]);

  /**
   * Process audio and send to backend
   */
  const processAudio = useCallback(async () => {
    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      // Create blob from recorded chunks
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
      });

      if (audioBlob.size < 1000) {
        throw new Error('Recording is too short. Please record for at least 1-2 seconds.');
      }

      // Get authentication token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Convert to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // Send to voice-chat-stream
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/voice-chat-stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audio_input: base64Audio,
          conversation_id: conversationId,
          agent_id: agentId,
          voice: voice,
          format: 'webm'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Voice chat failed: ${response.status}`);
      }

      // Handle SSE streaming response
      console.log('[SimpleVoiceChat] Processing voice chat response...');
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      let audioBase64 = '';
      let completedMessageId = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;
            
            try {
              const jsonStr = line.slice(6); // Remove 'data: ' prefix
              const data = JSON.parse(jsonStr);
              
              console.log('[SimpleVoiceChat] SSE event:', data.event, data);
              
              if (data.event === 'text' || data.event === 'text_delta') {
                fullResponse += (data.data || data.text || '');
              } else if (data.event === 'audio') {
                // Store audio for playback
                audioBase64 = data.audio;
                console.log('[SimpleVoiceChat] Received audio, length:', data.audio?.length);
              } else if (data.event === 'complete') {
                console.log('[SimpleVoiceChat] Voice chat completed:', data);
                completedMessageId = data.message_id;
              } else if (data.event === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              console.warn('[SimpleVoiceChat] Failed to parse SSE event:', line, e);
            }
          }
        }
      }

      console.log('[SimpleVoiceChat] Full response:', fullResponse);

      // Auto-play the audio response
      if (audioBase64) {
        console.log('[SimpleVoiceChat] Auto-playing audio response...');
        try {
          const audioBlob = new Blob(
            [Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))],
            { type: 'audio/mpeg' }
          );
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            console.log('[SimpleVoiceChat] Audio playback finished');
          };
          
          await audio.play();
        } catch (playError) {
          console.error('[SimpleVoiceChat] Audio playback failed:', playError);
        }
      }

      setState(prev => ({ ...prev, isProcessing: false }));

      // Notify parent that voice chat is complete
      if (completedMessageId && onComplete) {
        onComplete(completedMessageId);
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to process audio');
      setState(prev => ({ ...prev, error: err.message, isProcessing: false }));
      onError?.(err);
    }
  }, [conversationId, agentId, voice, onError]);

  // PTT keyboard event handlers
  useEffect(() => {
    if (recordingMode !== 'push-to-talk') return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === pttKey && !pttActiveRef.current && !state.isProcessing) {
        e.preventDefault();
        pttActiveRef.current = true;
        setIsPTTPressed(true);
        console.log('[SimpleVoiceChat] PTT key pressed, starting recording');
        await startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === pttKey && pttActiveRef.current) {
        e.preventDefault();
        pttActiveRef.current = false;
        setIsPTTPressed(false);
        console.log('[SimpleVoiceChat] PTT key released, stopping recording');
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [recordingMode, pttKey, startRecording, stopRecording, state.isProcessing]);

  return {
    ...state,
    isPTTPressed,
    recordingMode,
    pttKey,
    startRecording,
    stopRecording
  };
}

