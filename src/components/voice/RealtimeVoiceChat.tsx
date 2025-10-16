import React, { useState } from 'react';
import { Mic, X, Loader2, Settings } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSimpleVoiceChat, type RecordingMode, type PTTKey } from '@/hooks/voice/useSimpleVoiceChat';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface RealtimeVoiceChatProps {
  conversationId?: string;
  agentId: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  className?: string;
  onClose?: () => void;
}

const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy', description: 'Neutral and balanced' },
  { value: 'echo', label: 'Echo', description: 'Warm and friendly' },
  { value: 'fable', label: 'Fable', description: 'Expressive' },
  { value: 'onyx', label: 'Onyx', description: 'Deep and authoritative' },
  { value: 'nova', label: 'Nova', description: 'Energetic' },
  { value: 'shimmer', label: 'Shimmer', description: 'Soft and gentle' }
] as const;

const RECORDING_MODES: Array<{ value: RecordingMode; label: string; description: string }> = [
  { value: 'manual', label: 'Manual', description: 'Click to start/stop' },
  { value: 'push-to-talk', label: 'Push-to-Talk', description: 'Hold key to record' }
];

const PTT_KEYS: Array<{ value: PTTKey; label: string }> = [
  { value: 'Space', label: 'Space Bar' },
  { value: 'ControlLeft', label: 'Left Ctrl' },
  { value: 'ControlRight', label: 'Right Ctrl' }
];

/**
 * Real-time Voice Chat Component - SIMPLIFIED VERSION
 * Stripped down to just work like the transcription mode
 */
export function RealtimeVoiceChat({
  conversationId,
  agentId, 
  voice: initialVoice = 'alloy',
  className,
  onClose
}: RealtimeVoiceChatProps) {
  const [selectedVoice, setSelectedVoice] = useState<typeof initialVoice>(initialVoice);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('manual');
  const [pttKey, setPttKey] = useState<PTTKey>('Space');
  
  const currentVoiceOption = VOICE_OPTIONS.find(v => v.value === selectedVoice) || VOICE_OPTIONS[0];
  const currentRecordingMode = RECORDING_MODES.find(m => m.value === recordingMode) || RECORDING_MODES[0];
  const currentPTTKey = PTT_KEYS.find(k => k.value === pttKey) || PTT_KEYS[0];

  const {
    isRecording,
    isProcessing,
    error,
    audioLevel,
    isPTTPressed,
    startRecording,
    stopRecording
  } = useSimpleVoiceChat({
    conversationId: conversationId || '',
    agentId,
    voice: selectedVoice,
    recordingMode,
    pttKey,
    onError: (err) => {
      toast.error(err.message || 'Voice chat error');
    },
    onComplete: (messageId) => {
      console.log('[RealtimeVoiceChat] Voice chat completed, message ID:', messageId);
      // Close the voice chat modal after a short delay to let audio finish playing
      setTimeout(() => {
        onClose?.();
      }, 1000);
    }
  });

  // Show error toast when error state changes
  React.useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else if (!isProcessing) {
      startRecording();
    }
  };

  // Calculate orb animation scale based on audio level
  const orbScale = isRecording 
    ? 1 + (audioLevel * 0.3) 
    : isProcessing 
    ? 1.1 
    : 1;

  return (
    <div className={cn('relative flex flex-col items-center justify-center h-full bg-gradient-to-b from-background to-background/95', className)}>
      {/* Close Button - Top Right */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors z-50"
          title="Close voice chat"
        >
          <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
        </button>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl px-8">
        {/* Animated Orb */}
        <div className="relative mb-12">
          <div 
            className={cn(
              'w-48 h-48 rounded-full transition-all duration-300',
              'bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600',
              'shadow-2xl shadow-blue-500/50',
              isRecording && 'shadow-blue-500/80 animate-pulse',
              isProcessing && 'animate-spin'
            )}
            style={{
              transform: `scale(${orbScale})`,
              transition: 'transform 100ms ease-out'
            }}
          >
            {/* Inner glow effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-white/20 to-transparent" />
          </div>
          
          {/* Pulse rings when recording */}
          {isRecording && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-blue-400/30 animate-ping" 
                   style={{ animationDuration: '2s' }} />
              <div className="absolute inset-0 rounded-full border-2 border-blue-400/20 animate-ping" 
                   style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
            </>
          )}
        </div>

        {/* Settings: Voice, Recording Mode, PTT Key */}
        <div className="mb-8 flex items-center justify-center gap-4">
          {/* Voice Selector */}
          <Select
            value={selectedVoice}
            onValueChange={(value: typeof initialVoice) => setSelectedVoice(value)}
            disabled={isRecording || isProcessing}
          >
            <SelectTrigger className="w-[120px] h-8 text-sm bg-transparent border-0 focus:ring-0">
              <SelectValue>{currentVoiceOption.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {VOICE_OPTIONS.map(voice => (
                <SelectItem key={voice.value} value={voice.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{voice.label}</span>
                    <span className="text-xs text-muted-foreground">{voice.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Recording Mode Selector */}
          <Select
            value={recordingMode}
            onValueChange={(value: RecordingMode) => setRecordingMode(value)}
            disabled={isRecording || isProcessing}
          >
            <SelectTrigger className="w-[180px] h-8 text-sm bg-transparent border-0 focus:ring-0">
              <SelectValue>
                <span className="flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5" />
                  {currentRecordingMode.label}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RECORDING_MODES.map(mode => (
                <SelectItem key={mode.value} value={mode.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{mode.label}</span>
                    <span className="text-xs text-muted-foreground">{mode.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* PTT Key Selector (only show if push-to-talk mode) */}
          {recordingMode === 'push-to-talk' && (
            <Select
              value={pttKey}
              onValueChange={(value: PTTKey) => setPttKey(value)}
              disabled={isRecording || isProcessing}
            >
              <SelectTrigger className="w-[120px] h-8 text-sm bg-transparent border-0 focus:ring-0">
                <SelectValue>{currentPTTKey.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PTT_KEYS.map(key => (
                  <SelectItem key={key.value} value={key.value}>
                    {key.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="w-full flex flex-col items-center justify-center gap-3 pb-8">
        {/* Status Text */}
        <p className="text-sm text-muted-foreground text-center" style={{ marginTop: '-20px' }}>
          {isRecording 
            ? 'Recording...' 
            : isProcessing 
            ? 'Processing...' 
            : recordingMode === 'push-to-talk'
            ? `Hold ${currentPTTKey.label} to talk`
            : 'Click microphone to talk'}
        </p>

        {/* Microphone Button (only for manual mode) */}
        {recordingMode === 'manual' && (
          <button
            onClick={handleToggleRecording}
            disabled={isProcessing}
            className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg',
              isRecording 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-primary hover:bg-primary/90',
              isProcessing && 'opacity-50 cursor-not-allowed'
            )}
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            {isProcessing ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>
        )}

        {/* PTT Indicator (for push-to-talk mode) */}
        {recordingMode === 'push-to-talk' && (
          <div className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg',
            isPTTPressed 
              ? 'bg-red-500 animate-pulse' 
              : 'bg-primary/50',
            isProcessing && 'opacity-50'
          )}>
            {isProcessing ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
