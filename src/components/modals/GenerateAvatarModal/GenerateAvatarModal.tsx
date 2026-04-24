import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Shuffle, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { generateAgentAvatar } from '@/lib/openaiClient';
import { toast } from 'react-hot-toast';
import { AvatarCustomizationFields } from './AvatarCustomizationFields';
import { AvatarPreviewCard } from './AvatarPreviewCard';
import { DEFAULT_AVATAR_OPTIONS, RANDOM_OPTION_POOLS } from './constants';
import { generateAvatarPrompt, randomizeAvatarOptions } from './promptUtils';
import type { AvatarOptions, GenerateAvatarModalProps } from './types';

export function GenerateAvatarModal({
  isOpen,
  onClose,
  agentId,
  agentName,
  onAvatarGenerated,
}: GenerateAvatarModalProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedMediaId, setGeneratedMediaId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [options, setOptions] = useState<AvatarOptions>(DEFAULT_AVATAR_OPTIONS);

  const randomizeFeatures = () => {
    setOptions(randomizeAvatarOptions(RANDOM_OPTION_POOLS));
    toast.success('Random features selected! 🎲');
  };

  const handleGenerate = async () => {
    if (!agentId || !user) {
      toast.error('Unable to generate avatar');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const prompt = generateAvatarPrompt(options, agentName);
      const result = await generateAgentAvatar(supabase, agentId, prompt);
      const { mediaLibraryId } = result;

      if (!mediaLibraryId) {
        throw new Error('Failed to generate avatar image');
      }

      const { data: signedUrlData, error: urlError } = await supabase.functions.invoke('media-library-api', {
        body: {
          action: 'get_signed_url',
          document_id: mediaLibraryId,
          expiry_seconds: 3600,
        },
      });

      if (urlError || !signedUrlData?.success || !signedUrlData?.data?.signed_url) {
        throw new Error('Failed to get image URL');
      }

      setGeneratedImageUrl(signedUrlData.data.signed_url);
      setGeneratedMediaId(mediaLibraryId);
      setShowPreview(true);
      toast.success('Avatar generated! Review and approve below. 🎨');
    } catch (generationError: any) {
      setError(generationError.message || 'Failed to generate avatar');
      toast.error('Failed to generate avatar');
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveAvatar = async () => {
    if (!generatedMediaId || !user) return;

    try {
      const avatarReference = `media-library:${generatedMediaId}`;
      const { error: updateError } = await supabase
        .from('agents')
        .update({ avatar_url: avatarReference })
        .eq('id', agentId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      onAvatarGenerated(avatarReference);
      toast.success('Avatar updated successfully! 🎨');
      onClose();
    } catch {
      toast.error('Failed to update avatar');
    }
  };

  const handleRejectAvatar = async () => {
    if (!generatedMediaId) return;

    try {
      await supabase.functions.invoke('media-library-api', {
        body: {
          action: 'delete',
          document_id: generatedMediaId,
        },
      });
    } catch {
      // No-op: state still gets reset.
    } finally {
      setGeneratedImageUrl(null);
      setGeneratedMediaId(null);
      setShowPreview(false);
      toast.success('Avatar rejected. Try generating a new one!');
    }
  };

  const handleClose = () => {
    if (generating) return;
    setError(null);
    setShowAdvanced(false);
    setGeneratedImageUrl(null);
    setGeneratedMediaId(null);
    setShowPreview(false);
    setOptions(DEFAULT_AVATAR_OPTIONS);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-xl border-border">
        <DialogHeader className="pb-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold flex items-center">
                <Sparkles className="h-5 w-5 mr-2 text-primary" />
                Generate Avatar
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-1">
                Customize and create a unique AI-generated avatar for {agentName || 'your agent'}.
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={randomizeFeatures} disabled={generating} className="flex items-center gap-2">
              <Shuffle className="h-4 w-4" />
              Random
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-6">
          <AvatarCustomizationFields
            options={options}
            generating={generating}
            showAdvanced={showAdvanced}
            onToggleAdvanced={() => setShowAdvanced((prev) => !prev)}
            setOptions={setOptions}
          />

          {showPreview && generatedImageUrl && (
            <AvatarPreviewCard
              generatedImageUrl={generatedImageUrl}
              agentName={agentName}
              generating={generating}
              onReject={handleRejectAvatar}
              onGenerateNew={handleGenerate}
              onApprove={handleApproveAvatar}
            />
          )}

          {error && (
            <Card className="bg-destructive/10 border-destructive/20">
              <CardContent className="p-4">
                <p className="text-destructive text-sm">{error}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
          <Button variant="outline" onClick={handleClose} disabled={generating}>
            {showPreview ? 'Close' : 'Cancel'}
          </Button>
          {!showPreview && (
            <Button onClick={handleGenerate} disabled={generating} className="min-w-[140px]">
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

