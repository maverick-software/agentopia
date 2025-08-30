import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Loader2, 
  Check, 
  Camera, 
  Upload,
  ImageIcon
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { GenerateAvatarModal } from '../GenerateAvatarModal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getModelsByProvider } from '@/lib/llm/modelRegistry';
import { toast } from 'react-hot-toast';

interface IdentityTabProps {
  agentId: string;
  agentData?: {
    name?: string;
    description?: string;
    personality?: string;
    avatar_url?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

// Real personality templates from the actual system  
const PERSONALITY_OPTIONS = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Formal, structured, and business-focused communication',
    icon: '💼'
  },
  {
    id: 'friendly',
    name: 'Friendly',
    description: 'Warm, approachable, and conversational',
    icon: '😊'
  },
  {
    id: 'analytical',
    name: 'Analytical',
    description: 'Data-driven, logical, and detail-oriented',
    icon: '📊'
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Imaginative, innovative, and artistic',
    icon: '🎨'
  },
  {
    id: 'supportive',
    name: 'Supportive',
    description: 'Encouraging, empathetic, and helpful',
    icon: '🤝'
  },
  {
    id: 'direct',
    name: 'Direct',
    description: 'Straightforward, concise, and to-the-point',
    icon: '🎯'
  },
  {
    id: 'enthusiastic',
    name: 'Enthusiastic',
    description: 'Energetic, positive, and motivating',
    icon: '⚡'
  },
  {
    id: 'thoughtful',
    name: 'Thoughtful',
    description: 'Reflective, considerate, and wise',
    icon: '🤔'
  }
];

export function IdentityTab({ agentId, agentData, onAgentUpdated }: IdentityTabProps) {
  const supabase = useSupabaseClient();
  const { user } = useAuth();

  // Form state
  const [name, setName] = useState(agentData?.name || '');
  const [description, setDescription] = useState(agentData?.description || '');
  const [selectedPersonality, setSelectedPersonality] = useState(agentData?.personality || 'professional');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(agentData?.avatar_url || null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Update form when agentData changes
  useEffect(() => {
    if (agentData) {
      setName(agentData.name || '');
      setDescription(agentData.description || '');
      setSelectedPersonality(agentData.personality || 'professional');
      setAvatarUrl(agentData.avatar_url || null);
    }
  }, [agentData]);

  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('agents')
        .update({
          name: name.trim(),
          description: description.trim(),
          personality: selectedPersonality,
          avatar_url: avatarUrl
        })
        .eq('id', agentId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Identity updated successfully! ✨');
      
      if (onAgentUpdated) {
        onAgentUpdated(data);
      }
      
    } catch (error: any) {
      console.error('Error updating agent:', error);
      toast.error('Failed to update identity');
    } finally {
      setLoading(false);
    }
  }, [agentId, user, name, description, selectedPersonality, avatarUrl, supabase, onAgentUpdated]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !agentId || !user) {
      return;
    }

    const file = event.target.files[0];
    const maxSize = 50 * 1024 * 1024; // 50MB (Media Library limit)
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PNG, JPEG, WebP, GIF, or SVG image');
      return;
    }

    if (file.size > maxSize) {
      toast.error('Image must be smaller than 50MB');
      return;
    }

    setUploading(true);

    try {
      // Upload to Media Library via API
      const uploadResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'upload',
          file_name: `avatar-${agentId}-${Date.now()}.${file.name.split('.').pop()}`,
          file_type: file.type,
          file_size: file.size,
          category: 'avatars',
          description: `Avatar for agent ${agentData?.name || agentId}`
        })
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      const uploadData = await uploadResponse.json();

      // Upload actual file to storage
      const { error: storageError } = await supabase.storage
        .from(uploadData.data.bucket)
        .upload(uploadData.data.storage_path, file, {
          contentType: file.type,
          duplex: 'half'
        });

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      // Get signed URL for the uploaded avatar
      const urlResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get_signed_url',
          document_id: uploadData.data.media_id,
          expiry_seconds: 31536000 // 1 year for avatars
        })
      });

      if (!urlResponse.ok) {
        throw new Error(`Failed to get avatar URL: ${urlResponse.status}`);
      }

      const urlData = await urlResponse.json();
      const newAvatarUrl = urlData.data.signed_url;

      setAvatarUrl(newAvatarUrl);
      toast.success('Avatar uploaded to Media Library! 📸');
      
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
      // Reset the input value so the same file can be selected again
      event.target.value = '';
    }
  }, [agentId, user, supabase, agentData?.name]);

  const handleGeneratedAvatar = useCallback((newAvatarUrl: string) => {
    setAvatarUrl(newAvatarUrl);
    setShowGenerateModal(false);
  }, []);

  const getSelectedPersonality = () => {
    return PERSONALITY_OPTIONS.find(p => p.id === selectedPersonality);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Identity & Appearance</h3>
        <p className="text-sm text-muted-foreground">
          Configure your agent's avatar, LLM model, and personality type.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Avatar & Image Generation</CardTitle>
          <CardDescription>
            Upload a custom avatar or generate one using AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl || undefined} alt={name || 'Agent'} />
              <AvatarFallback className="text-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                {name?.charAt(0)?.toUpperCase() || 'A'}
              </AvatarFallback>
            </Avatar>
            
            <div className="space-y-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={uploading}>
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4 mr-2" />
                        Change Avatar
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = handleFileUpload;
                      input.click();
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Image
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowGenerateModal(true)}>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Generate with AI
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <p className="text-xs text-muted-foreground">
                PNG, JPEG, WebP, GIF, or SVG up to 50MB
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>LLM Model Selection</CardTitle>
          <CardDescription>
            Choose the language model that powers your agent's responses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="model-select">Language Model</Label>
            <Select defaultValue="gpt-4">
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Select a model..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4">GPT-4 (Recommended)</SelectItem>
                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Different models have varying capabilities and response styles.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personality Type (MBTI)</CardTitle>
          <CardDescription>
            Define your agent's personality traits and communication style.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Personality Style</Label>
            <Select value={selectedPersonality} onValueChange={setSelectedPersonality}>
              <SelectTrigger className="max-w-md">
                <SelectValue>
                  <div className="flex items-center space-x-2">
                    <span>{getSelectedPersonality()?.icon}</span>
                    <span>{getSelectedPersonality()?.name}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PERSONALITY_OPTIONS.map((personality) => (
                  <SelectItem key={personality.id} value={personality.id}>
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{personality.icon}</span>
                      <div>
                        <div className="font-medium">{personality.name}</div>
                        <div className="text-xs text-muted-foreground">{personality.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This affects how your agent communicates and approaches problems.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Generate Avatar Modal */}
      <GenerateAvatarModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        agentId={agentId}
        agentName={name}
        onAvatarGenerated={handleGeneratedAvatar}
      />
    </div>
  );
}
