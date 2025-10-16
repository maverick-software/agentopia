import React, { useState } from 'react';
import { Mic, X, Loader2, Wrench, Settings } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRealtimeVoiceChat, type RecordingMode, type PTTKey } from '@/hooks/voice/useRealtimeVoiceChat';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface RealtimeVoiceChatProps {
  conversationId: string;
  agentId: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  className?: string;
  onClose?: () => void;
}

const VOICE_OPTIONS = [
  { value: 'echo', label: 'Echo', description: 'Confident and optimistic' },
  { value: 'alloy', label: 'Alloy', description: 'Balanced and neutral' },
  { value: 'shimmer', label: 'Shimmer', description: 'Bright and inquisitive' },
  { value: 'nova', label: 'Nova', description: 'Warm and friendly' },
  { value: 'fable', label: 'Fable', description: 'Expressive and dynamic' },
  { value: 'onyx', label: 'Onyx', description: 'Deep and authoritative' },
] as const;

const RECORDING_MODES: { value: RecordingMode; label: string; description: string }[] = [
  { value: 'manual', label: 'Manual', description: 'Click to start/stop recording' },
  { value: 'conversational', label: 'Conversational', description: 'Auto-stops after silence' },
  { value: 'push-to-talk', label: 'Push-to-Talk', description: 'Hold key to record' },
];

const PTT_KEYS: { value: PTTKey; label: string }[] = [
  { value: 'Space', label: 'Space Bar' },
  { value: 'Tab', label: 'Tab' },
  { value: 'Control', label: 'Ctrl' },
  { value: 'Alt', label: 'Alt' },
  { value: 'Shift', label: 'Shift' },
];

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

  const {
    isRecording,
    isProcessing,
    isPlaying,
    error,
    transcript,
    currentToolExecution,
    audioLevel,
    startRecording,
    stopRecording,
    stopPlayback,
    clearTranscript,
    isSupported,
    isPTTPressed
  } = useRealtimeVoiceChat({
    conversationId,
    agentId,
    voice: selectedVoice,
    recordingMode,
    pttKey,
    onError: (err) => {
      toast.error(err.message || 'Voice chat error');
    }
  });

  // Show error toast when error state changes
  React.useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  if (!isSupported) {
    return (
      <div className="flex items-center justify-center p-8 text-center">
        <div className="text-muted-foreground">
          <p className="font-medium mb-2">Real-time voice chat not supported</p>
          <p className="text-sm">Your browser doesn't support the required features for real-time voice chat.</p>
        </div>
      </div>
    );
  }

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else if (!isProcessing) {
      startRecording();
    }
  };

  // Calculate orb animation scale based on audio level or state
  const orbScale = isRecording 
    ? 1 + (audioLevel * 0.3) 
    : isProcessing || isPlaying 
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
              isProcessing && 'animate-spin',
              isPlaying && 'shadow-blue-400/60'
            )}
            style={{
              transform: `scale(${orbScale})`,
              transition: 'transform 100ms ease-out'
            }}
          >
            {/* Inner glow effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-white/20 to-transparent" />
            
            {/* Tool execution overlay */}
            {currentToolExecution && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-background/90 backdrop-blur-sm rounded-full p-4">
                  {currentToolExecution.status === 'executing' ? (
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  ) : currentToolExecution.status === 'completed' ? (
                    <Wrench className="w-8 h-8 text-green-500" />
                  ) : (
                    <Wrench className="w-8 h-8 text-red-500" />
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Pulse rings when active */}
          {(isRecording || isPlaying) && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-blue-400/30 animate-ping" 
                   style={{ animationDuration: '2s' }} />
              <div className="absolute inset-0 rounded-full border-2 border-blue-400/20 animate-ping" 
                   style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
            </>
          )}
        </div>

        {/* Transcript Display (when active) */}
        {transcript.length > 0 && (
          <div className="w-full max-h-48 overflow-y-auto mb-8 space-y-3 px-4">
            {transcript.slice(-3).map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  'text-center',
                  msg.role === 'user' ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                <p className={cn(
                  'text-sm',
                  msg.role === 'user' ? 'font-medium' : 'font-normal'
                )}>
                  {msg.role === 'user' ? 'You: ' : 'AI: '}
                  {msg.content}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Tool Execution Status */}
        {currentToolExecution && (
          <div className="mb-6 text-center">
            <p className="text-sm text-muted-foreground">
              {currentToolExecution.status === 'executing' && `Executing ${currentToolExecution.name}...`}
              {currentToolExecution.status === 'completed' && `Completed ${currentToolExecution.name}`}
              {currentToolExecution.status === 'failed' && `Failed: ${currentToolExecution.name}`}
            </p>
          </div>
        )}

        <div className="mb-8 flex items-center justify-center gap-4">
            {/* Voice Selector Dropdown */}
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
            
            {/* Recording Mode Dropdown */}
            <Select
              value={recordingMode}
              onValueChange={(value: RecordingMode) => setRecordingMode(value)}
              disabled={isRecording || isProcessing}
            >
              <SelectTrigger className="w-[180px] h-8 text-sm bg-transparent border-0 focus:ring-0">
                <SelectValue>
                  <span className="flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5" />
                    {RECORDING_MODES.find(m => m.value === recordingMode)?.label}
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
                <SelectTrigger className="w-[100px] h-8 text-sm bg-transparent border-0 focus:ring-0">
                  <SelectValue>{pttKey}</SelectValue>
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
      <div className="w-full flex items-center justify-center gap-4 pb-8">
        {/* Microphone Button */}
        <button
          onClick={handleToggleRecording}
          disabled={isProcessing}
          className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg',
            'hover:scale-110 active:scale-95',
            isRecording 
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : isProcessing
              ? 'bg-muted cursor-not-allowed'
              : 'bg-white hover:bg-white/90 text-black'
          )}
          title={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isProcessing ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Status Text */}
      <div className="absolute bottom-32 left-0 right-0 flex justify-center">
        <div className="text-center">
          {isRecording && (
            <p className="text-sm text-muted-foreground animate-pulse">
              {recordingMode === 'conversational' ? 'Listening... (will auto-stop)' :
               recordingMode === 'push-to-talk' ? `Holding ${PTT_KEYS.find(k => k.value === pttKey)?.label}...` :
               'Listening...'}
            </p>
          )}
          {isProcessing && (
            <p className="text-sm text-muted-foreground">
              Processing...
            </p>
          )}
          {isPlaying && (
            <p className="text-sm text-muted-foreground">
              Speaking...
            </p>
          )}
          {!isRecording && !isProcessing && !isPlaying && recordingMode === 'push-to-talk' && (
            <p className="text-xs text-muted-foreground/60">
              Hold {PTT_KEYS.find(k => k.value === pttKey)?.label} to talk
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

