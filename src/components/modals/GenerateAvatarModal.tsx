import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { generateAgentAvatar } from '@/lib/openaiClient';
import { toast } from 'react-hot-toast';

interface GenerateAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName?: string;
  onAvatarGenerated: (avatarUrl: string) => void;
}

export function GenerateAvatarModal({
  isOpen,
  onClose,
  agentId,
  agentName,
  onAvatarGenerated
}: GenerateAvatarModalProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get suggested prompts based on agent name
  const getSuggestedPrompts = () => {
    const basePrompts = [
      "Professional business avatar, clean modern style",
      "Friendly cartoon character, approachable and warm",
      "Minimalist geometric design, tech-focused",
      "Abstract artistic representation, creative and unique"
    ];
    
    if (agentName) {
      return [
        `Professional avatar for ${agentName}, modern and friendly`,
        ...basePrompts
      ];
    }
    
    return basePrompts;
  };

  const handleGenerate = async () => {
    if (!agentId || !user) {
      toast.error('Unable to generate avatar');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // Generate the avatar using AI
      const generatedImageUrl = await generateAgentAvatar(
        agentId,
        prompt || `Professional avatar for ${agentName || 'agent'}, modern and friendly`
      );

      if (!generatedImageUrl) {
        throw new Error('Failed to generate avatar image');
      }

      // Update the agent's avatar in the database
      const { error: updateError } = await supabase
        .from('agents')
        .update({ avatar_url: generatedImageUrl })
        .eq('id', agentId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      toast.success('Avatar generated successfully! 🎨');
      onAvatarGenerated(generatedImageUrl);
      onClose();
      setPrompt('');
      
    } catch (error: any) {
      console.error('Error generating avatar:', error);
      setError(error.message || 'Failed to generate avatar');
      toast.error('Failed to generate avatar');
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    if (!generating) {
      setPrompt('');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-purple-500" />
            Generate Avatar
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a unique AI-generated avatar for {agentName || 'your agent'}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6 space-y-6">
          {/* Description Input */}
          <div>
            <Label htmlFor="avatar-prompt" className="text-sm font-medium">
              Describe your ideal avatar (optional)
            </Label>
            <Textarea
              id="avatar-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Describe how you want ${agentName || 'your agent'} to look...`}
              className="mt-2 min-h-[100px] resize-none"
              disabled={generating}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave blank for a default professional avatar, or describe style, colors, mood, etc.
            </p>
          </div>

          {/* Suggested Prompts */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Quick suggestions:
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {getSuggestedPrompts().map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setPrompt(suggestion)}
                  disabled={generating}
                  className="text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-colors text-sm group"
                >
                  <div className="flex items-center">
                    <Wand2 className="h-3 w-3 mr-2 text-muted-foreground group-hover:text-primary transition-colors" />
                    {suggestion}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive text-destructive text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={generating}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={generating}
            className="min-w-[120px] bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Avatar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}