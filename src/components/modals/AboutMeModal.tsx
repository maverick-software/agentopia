import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Loader2, 
  Check, 
  Camera, 
  Smile,
  Briefcase,
  Zap,
  Brain,
  Palette
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { toast } from 'react-hot-toast';

interface AboutMeModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
    description?: string;
    personality?: string;
    avatar_url?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

const PERSONALITY_OPTIONS = [
  {
    id: 'helpful',
    name: 'Friendly & Warm',
    description: 'I love helping and making people feel comfortable',
    icon: Smile,
    gradient: 'from-pink-500 to-rose-400'
  },
  {
    id: 'professional',
    name: 'Professional & Focused',
    description: 'I keep things organized and get results',
    icon: Briefcase,
    gradient: 'from-blue-600 to-blue-500'
  },
  {
    id: 'energetic',
    name: 'Energetic & Enthusiastic',
    description: 'I bring energy and excitement to everything!',
    icon: Zap,
    gradient: 'from-yellow-500 to-orange-500'
  },
  {
    id: 'thoughtful',
    name: 'Thoughtful & Analytical',
    description: 'I think deeply and consider all angles',
    icon: Brain,
    gradient: 'from-purple-600 to-indigo-500'
  },
  {
    id: 'creative',
    name: 'Creative & Playful',
    description: 'I love exploring new ideas and having fun',
    icon: Palette,
    gradient: 'from-green-500 to-teal-500'
  }
];

export function AboutMeModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated
}: AboutMeModalProps) {
  const supabase = useSupabaseClient();
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPersonality, setSelectedPersonality] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Initialize form data when modal opens or agent data changes
  useEffect(() => {
    if (isOpen && agentData) {
      setName(agentData.name || '');
      setDescription(agentData.description || '');
      setSelectedPersonality(agentData.personality || '');
      setAvatarUrl(agentData.avatar_url || '');
      setSaved(false);
    }
  }, [isOpen, agentData]);

  // Clear saved state after 3 seconds
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const handleSave = useCallback(async () => {
    if (!agentId) return;
    
    setLoading(true);
    
    try {
      const { data: updatedAgent, error } = await supabase
        .from('agents')
        .update({
          name: name.trim(),
          description: description.trim(),
          personality: selectedPersonality,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)
        .select()
        .single();

      if (error) throw error;

      toast.success('Your agent has been updated! 🎉');
      setSaved(true);
      
      // Notify parent component
      if (onAgentUpdated && updatedAgent) {
        onAgentUpdated(updatedAgent);
      }
      
    } catch (error: any) {
      console.error('Error updating agent:', error);
      toast.error('Failed to update agent identity');
    } finally {
      setLoading(false);
    }
  }, [agentId, name, description, selectedPersonality, avatarUrl, supabase, onAgentUpdated]);

  const getSelectedPersonality = () => {
    return PERSONALITY_OPTIONS.find(p => p.id === selectedPersonality);
  };

  const hasChanges = () => {
    if (!agentData) return false;
    return (
      name !== (agentData.name || '') ||
      description !== (agentData.description || '') ||
      selectedPersonality !== (agentData.personality || '') ||
      avatarUrl !== (agentData.avatar_url || '')
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center">
            🎭 Profile
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Help me build my identity and personality so I can be the best companion for you.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6 space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={name || 'Agent'} />
                ) : (
                  <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    {name?.charAt(0)?.toUpperCase() || 'A'}
                  </AvatarFallback>
                )}
              </Avatar>
              <button 
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full"
                onClick={() => toast.info('Avatar editor coming soon! 📸')}
              >
                <Camera className="h-6 w-6 text-white" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Click to upload a photo or choose a style
            </p>
          </div>

          {/* Name Section */}
          <div className="space-y-2">
            <Label htmlFor="agent-name" className="text-sm font-medium">
              What should I call myself?
            </Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Choose a friendly name for me..."
              className="bg-background border-border"
            />
          </div>

          {/* Description Section */}
          <div className="space-y-2">
            <Label htmlFor="agent-description" className="text-sm font-medium">
              How should I introduce myself?
            </Label>
            <Textarea
              id="agent-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="I'm a helpful AI who loves to..."
              className="bg-background border-border min-h-[80px] resize-none"
            />
          </div>

          {/* Personality Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              What's my personality like?
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {PERSONALITY_OPTIONS.map((personality) => {
                const Icon = personality.icon;
                const isSelected = selectedPersonality === personality.id;
                
                return (
                  <button
                    key={personality.id}
                    onClick={() => setSelectedPersonality(personality.id)}
                    className={`flex items-center p-3 rounded-lg border transition-all duration-200 text-left ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${personality.gradient} flex items-center justify-center mr-3 flex-shrink-0`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{personality.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {personality.description}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || !hasChanges()}
            className="min-w-[120px]"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="mr-2 h-4 w-4" />
            ) : null}
            {loading ? 'Saving...' : saved ? 'Saved!' : 'Save My Identity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}