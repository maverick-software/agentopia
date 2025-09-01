import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { toast } from 'react-hot-toast';
import { Loader2, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const MBTI_TYPES = [
  { type: 'INTJ', name: 'The Architect', description: 'Imaginative and strategic thinkers with a plan for everything' },
  { type: 'INTP', name: 'The Thinker', description: 'Innovative inventors with an unquenchable thirst for knowledge' },
  { type: 'ENTJ', name: 'The Commander', description: 'Bold, imaginative and strong-willed leaders, always finding a way' },
  { type: 'ENTP', name: 'The Debater', description: 'Smart and curious thinkers who cannot resist an intellectual challenge' },
  { type: 'INFJ', name: 'The Advocate', description: 'Creative and insightful, inspired and independent perfectionists' },
  { type: 'INFP', name: 'The Mediator', description: 'Poetic, kind and altruistic people, always eager to help a good cause' },
  { type: 'ENFJ', name: 'The Protagonist', description: 'Charismatic and inspiring leaders, able to mesmerize their listeners' },
  { type: 'ENFP', name: 'The Campaigner', description: 'Enthusiastic, creative and sociable free spirits' },
  { type: 'ISTJ', name: 'The Logistician', description: 'Practical and fact-minded, reliable and responsible' },
  { type: 'ISFJ', name: 'The Protector', description: 'Warm-hearted and dedicated, always ready to protect their loved ones' },
  { type: 'ESTJ', name: 'The Executive', description: 'Excellent administrators, unsurpassed at managing things or people' },
  { type: 'ESFJ', name: 'The Consul', description: 'Extraordinarily caring, social and popular people, always eager to help' },
  { type: 'ISTP', name: 'The Virtuoso', description: 'Bold and practical experimenters, masters of all kinds of tools' },
  { type: 'ISFP', name: 'The Adventurer', description: 'Flexible and charming artists, always ready to explore new possibilities' },
  { type: 'ESTP', name: 'The Entrepreneur', description: 'Smart, energetic and perceptive people, truly enjoy living on the edge' },
  { type: 'ESFP', name: 'The Entertainer', description: 'Spontaneous, energetic and enthusiastic people - life is never boring' }
];

const getMBTIName = (type: string): string => {
  return MBTI_TYPES.find(mbti => mbti.type === type)?.name || 'Unknown Type';
};

const getMBTIDescription = (type: string): string => {
  return MBTI_TYPES.find(mbti => mbti.type === type)?.description || 'No description available';
};

interface GeneralTabProps {
  agentId: string;
  agentData?: {
    name?: string;
    description?: string;
    role?: string;
    model?: string;
    personality?: string;
    metadata?: {
      mbtiType?: string;
      purpose?: string;
      theme?: string;
      [key: string]: any;
    };
  };
  onAgentUpdated?: (updatedData: any) => void;
}

export function GeneralTab({ agentId, agentData, onAgentUpdated }: GeneralTabProps) {
  const [name, setName] = useState(agentData?.name || '');
  const [role, setRole] = useState(agentData?.role || '');
  const [description, setDescription] = useState(agentData?.description || '');
  const [model, setModel] = useState(agentData?.model || 'gpt-4');
  const [isLoading, setIsLoading] = useState(false);
  const supabase = useSupabaseClient();

  useEffect(() => {
    setName(agentData?.name || '');
    setRole(agentData?.role || '');
    setDescription(agentData?.description || '');
    setModel(agentData?.model || 'gpt-4');
  }, [agentData]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Agent name is required');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('agents')
        .update({
          name: name.trim(),
          role: role.trim() || null,
          description: description.trim() || null,
          model: model,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)
        .select()
        .single();

      if (error) throw error;

      toast.success('Agent details updated successfully');
      onAgentUpdated?.(data);
    } catch (error) {
      console.error('Error updating agent:', error);
      toast.error('Failed to update agent details');
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = 
    name !== (agentData?.name || '') ||
    role !== (agentData?.role || '') ||
    description !== (agentData?.description || '') ||
    model !== (agentData?.model || 'gpt-4');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <h3 className="text-lg font-semibold">General Information</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your agent's basic information, identity, and language model.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Agent Name */}
        <div className="space-y-2">
          <Label htmlFor="agent-name" className="text-sm font-medium">
            Agent Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="agent-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter agent name"
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            This is how your agent will be identified in conversations.
          </p>
        </div>

        {/* Role */}
        <div className="space-y-2">
          <Label htmlFor="agent-role" className="text-sm font-medium">
            Role
          </Label>
          <Input
            id="agent-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g., Customer Support Agent, Research Assistant"
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Optional role or title that describes the agent's primary function.
          </p>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="agent-description" className="text-sm font-medium">
            Description
          </Label>
          <Textarea
            id="agent-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this agent does and its purpose"
            className="min-h-[100px] resize-none w-full"
          />
          <p className="text-xs text-muted-foreground">
            A brief description of the agent's capabilities and intended use.
          </p>
        </div>

        {/* LLM Model Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Language Model</CardTitle>
            <CardDescription>
              Choose the language model that powers your agent's responses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model-select">Model Selection</Label>
              <Select value={model} onValueChange={setModel}>
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

        {/* MBTI Personality Display */}
        {agentData?.metadata?.mbtiType && (
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Badge variant="secondary">{agentData.metadata.mbtiType}</Badge>
                Personality Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="font-medium">
                  {getMBTIName(agentData.metadata.mbtiType)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {getMBTIDescription(agentData.metadata.mbtiType)}
                </p>
                {agentData.metadata.purpose && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-sm font-medium mb-1">Original Purpose</div>
                    <p className="text-sm text-muted-foreground">{agentData.metadata.purpose}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Save Button - Fixed at bottom */}
      {hasChanges && (
        <div className="flex items-center justify-end pt-6 border-t border-border">
          <Button
            onClick={handleSave}
            disabled={isLoading || !name.trim()}
            size="sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
