import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

interface ConversationMemorySectionProps {
  contextHistorySize: number;
  onContextSizeChange: (value: number[]) => void;
}

export const ConversationMemorySection: React.FC<ConversationMemorySectionProps> = ({
  contextHistorySize,
  onContextSizeChange,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Conversation Memory
        </Label>
        <p className="text-xs text-muted-foreground mt-1">
          How many recent messages should I remember from our conversation?
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Messages to remember:</span>
          <span className="text-sm font-medium bg-primary/10 px-2 py-1 rounded">
            {contextHistorySize} {contextHistorySize === 1 ? 'message' : 'messages'}
          </span>
        </div>

        <Slider value={[contextHistorySize]} onValueChange={onContextSizeChange} min={0} max={100} step={5} className="w-full" />

        <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          {contextHistorySize === 0
            ? "I won't remember any previous messages in our conversation."
            : contextHistorySize <= 10
              ? "I'll remember only the most recent exchanges."
              : contextHistorySize <= 25
                ? "I'll maintain good context of our recent conversation."
                : contextHistorySize <= 50
                  ? "I'll remember a substantial portion of our conversation history."
                  : "I'll remember extensive conversation history for maximum context."}
        </p>
      </div>
    </div>
  );
};
