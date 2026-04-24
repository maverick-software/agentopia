import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Check, RotateCcw, Sparkles, X } from 'lucide-react';

interface AvatarPreviewCardProps {
  generatedImageUrl: string;
  agentName?: string;
  generating: boolean;
  onReject: () => void;
  onGenerateNew: () => void;
  onApprove: () => void;
}

export function AvatarPreviewCard({
  generatedImageUrl,
  agentName,
  generating,
  onReject,
  onGenerateNew,
  onApprove,
}: AvatarPreviewCardProps) {
  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <Label className="text-lg font-semibold">Generated Avatar Preview</Label>
          </div>

          <div className="flex justify-center">
            <div className="relative">
              <img
                src={generatedImageUrl}
                alt="Generated Avatar Preview"
                className="w-32 h-32 rounded-full object-cover border-4 border-primary/20 shadow-lg"
                onError={(e) => {
                  e.currentTarget.src =
                    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iNjQiIGZpbGw9IiNmMWY1ZjkiLz4KPHN2ZyB4PSIzMiIgeT0iMzIiIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5NGE2YjgiIHN0cm9rZS13aWR0aD0iMiI+CjxwYXRoIGQ9Im0yMCAxNi0yLTJtMC0ydjJtMC0yaDJtLTItMnYyIi8+CjxjaXJjbGUgY3g9IjkiIGN5PSI5IiByPSI3Ii8+CjwvZz4KPC9zdmc+';
                }}
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">Do you want to use this avatar for {agentName || 'your agent'}?</p>

          <div className="flex items-center justify-center gap-3">
            <Button onClick={onReject} variant="outline" size="sm" className="flex items-center gap-2">
              <X className="h-4 w-4" />
              Reject
            </Button>
            <Button onClick={onGenerateNew} variant="outline" size="sm" disabled={generating} className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Generate New
            </Button>
            <Button onClick={onApprove} size="sm" className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Approve & Use
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

