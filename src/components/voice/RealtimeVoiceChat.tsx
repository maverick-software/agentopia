import React from 'react';
import { Mic, Square, Volume2, Loader2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRealtimeVoiceChat } from '@/hooks/voice/useRealtimeVoiceChat';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface RealtimeVoiceChatProps {
  conversationId: string;
  agentId: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  className?: string;
  onClose?: () => void;
}

export function RealtimeVoiceChat({ 
  conversationId, 
  agentId, 
  voice = 'alloy',
  className,
  onClose
}: RealtimeVoiceChatProps) {
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
    isSupported
  } = useRealtimeVoiceChat({
    conversationId,
    agentId,
    voice,
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

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Real-time Voice Chat</h2>
          {isPlaying && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Playing
            </span>
          )}
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Transcript Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {transcript.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center text-muted-foreground">
            <div>
              <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Click the microphone to start talking</p>
              <p className="text-sm mt-2">Your conversation will appear here in real-time</p>
            </div>
          </div>
        ) : (
          <>
            {transcript.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-4 py-2',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <span className="text-xs opacity-60 mt-1 block">
                    {msg.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            
            {/* Tool Execution Indicator */}
            {currentToolExecution && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-2 bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2 text-sm">
                    {currentToolExecution.status === 'executing' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    ) : currentToolExecution.status === 'completed' ? (
                      <Wrench className="w-4 h-4 text-green-500" />
                    ) : (
                      <Wrench className="w-4 h-4 text-red-500" />
                    )}
                    <span className="font-medium">
                      {currentToolExecution.status === 'executing' && `Executing ${currentToolExecution.name}...`}
                      {currentToolExecution.status === 'completed' && `Completed ${currentToolExecution.name}`}
                      {currentToolExecution.status === 'failed' && `Failed: ${currentToolExecution.name}`}
                    </span>
                  </div>
                  {currentToolExecution.error && (
                    <p className="text-xs text-red-500 mt-1">{currentToolExecution.error}</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="border-t border-border p-4">
        {/* Audio Level Indicator */}
        {isRecording && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="text-sm font-medium text-red-500">Recording...</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-red-500 transition-all duration-100"
                style={{ width: `${audioLevel * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Main Button */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleToggleRecording}
            disabled={isProcessing}
            className={cn(
              'flex-1 h-16 text-lg',
              isRecording && 'bg-red-500 hover:bg-red-600'
            )}
            variant={isRecording ? 'destructive' : 'default'}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                Processing...
              </>
            ) : isRecording ? (
              <>
                <Square className="w-6 h-6 mr-2" />
                Stop Recording
              </>
            ) : (
              <>
                <Mic className="w-6 h-6 mr-2" />
                Start Talking
              </>
            )}
          </Button>

          {/* Additional Controls */}
          {transcript.length > 0 && (
            <Button
              variant="outline"
              size="icon"
              onClick={clearTranscript}
              disabled={isRecording || isProcessing}
              title="Clear transcript"
              className="h-16 w-16"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </Button>
          )}

          {isPlaying && (
            <Button
              variant="outline"
              size="icon"
              onClick={stopPlayback}
              title="Stop playback"
              className="h-16 w-16"
            >
              <Square className="w-6 h-6" />
            </Button>
          )}
        </div>

        {/* Instructions */}
        {!isRecording && !isProcessing && transcript.length === 0 && (
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Click "Start Talking" and speak naturally. The AI will respond with voice and text.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              MCP tools will be executed automatically when needed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

