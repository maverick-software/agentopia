import React, { useState } from 'react';
import { Mic, X, ChevronLeft, ChevronRight, Loader2, Wrench, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  { value: 'Space', label: 'Space' },
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
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('manual');
  const [pttKey, setPttKey] = useState<PTTKey>('Space');
  
  const selectedVoiceIndex = VOICE_OPTIONS.findIndex(v => v.value === selectedVoice);

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

  const handleVoiceChange = (direction: 'prev' | 'next') => {
    const currentIndex = selectedVoiceIndex;
    const newIndex = direction === 'next' 
      ? (currentIndex + 1) % VOICE_OPTIONS.length
      : (currentIndex - 1 + VOICE_OPTIONS.length) % VOICE_OPTIONS.length;
    setSelectedVoice(VOICE_OPTIONS[newIndex].value);
  };

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

  const currentVoiceOption = VOICE_OPTIONS[selectedVoiceIndex];

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

        {/* Settings Modal */}
        {showSettings ? (
          <div className="mb-8 text-center animate-in fade-in duration-200">
            <h3 className="text-lg font-medium mb-6">Recording Settings</h3>
            
            {/* Recording Mode Selector */}
            <div className="mb-6">
              <label className="block text-sm text-muted-foreground mb-3">Recording Mode</label>
              <div className="flex flex-col gap-2">
                {RECORDING_MODES.map(mode => (
                  <button
                    key={mode.value}
                    onClick={() => setRecordingMode(mode.value)}
                    className={cn(
                      'px-4 py-3 rounded-lg text-left transition-colors',
                      recordingMode === mode.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 hover:bg-muted'
                    )}
                    disabled={isRecording}
                  >
                    <div className="font-medium">{mode.label}</div>
                    <div className="text-xs opacity-80">{mode.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* PTT Key Selector (only show if push-to-talk mode) */}
            {recordingMode === 'push-to-talk' && (
              <div className="mb-6">
                <label className="block text-sm text-muted-foreground mb-3">Push-to-Talk Key</label>
                <div className="flex gap-2 justify-center">
                  {PTT_KEYS.map(key => (
                    <button
                      key={key.value}
                      onClick={() => setPttKey(key.value)}
                      className={cn(
                        'px-4 py-2 rounded-lg transition-colors',
                        pttKey === key.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 hover:bg-muted'
                      )}
                      disabled={isRecording}
                    >
                      {key.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={() => setShowSettings(false)}
              variant="outline"
              className="mt-4"
            >
              Done
            </Button>
          </div>
        ) : showVoiceSelector ? (
          <div className="mb-8 text-center animate-in fade-in duration-200">
            <h3 className="text-lg font-medium mb-6">Choose a voice</h3>
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => handleVoiceChange('prev')}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="min-w-[200px] text-center">
                <h4 className="text-xl font-semibold mb-1">{currentVoiceOption.label}</h4>
                <p className="text-sm text-muted-foreground">{currentVoiceOption.description}</p>
              </div>

              <button
                onClick={() => handleVoiceChange('next')}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <Button
              onClick={() => setShowVoiceSelector(false)}
              variant="outline"
              className="mt-6"
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="mb-8 flex items-center justify-center gap-4">
            <button
              onClick={() => setShowVoiceSelector(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={isRecording || isProcessing}
            >
              Voice: {currentVoiceOption.label}
            </button>
            <span className="text-muted-foreground">|</span>
            <button
              onClick={() => setShowSettings(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              disabled={isRecording || isProcessing}
            >
              <Settings className="w-3.5 h-3.5" />
              {recordingMode === 'push-to-talk' ? `PTT: ${pttKey}` : RECORDING_MODES.find(m => m.value === recordingMode)?.label}
            </button>
          </div>
        )}
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

        {/* Close Button (alternative position) */}
        {onClose && (
          <button
            onClick={onClose}
            className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Status Text */}
      <div className="absolute bottom-24 left-0 right-0 text-center">
        {isRecording && (
          <p className="text-sm text-muted-foreground animate-pulse">
            {recordingMode === 'conversational' ? 'Listening... (will auto-stop)' :
             recordingMode === 'push-to-talk' ? `Holding ${pttKey}...` :
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
            Hold {pttKey} to talk
          </p>
        )}
      </div>
    </div>
  );
}

