import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { toast } from 'react-hot-toast';
import { Loader2, Save, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MODEL_CARDS, getModelsByProvider, getAllProviders, getModelCard } from '@/lib/llm/modelRegistry';

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
  const [description, setDescription] = useState(agentData?.description || '');
  const [provider, setProvider] = useState<string>('openai');
  const [model, setModel] = useState<string>('gpt-4o-mini');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const supabase = useSupabaseClient();

  // Load agent LLM preferences
  useEffect(() => {
    const loadLLMPreferences = async () => {
      if (!agentId) return;
      
      setLoadingPreferences(true);
      try {
        const { data, error } = await supabase
          .from('agent_llm_preferences')
          .select('provider, model, params, embedding_model')
          .eq('agent_id', agentId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error loading LLM preferences:', error);
        } else if (data) {
          setProvider(data.provider || 'openai');
          setModel(data.model || 'gpt-4o-mini');
        }
      } catch (error) {
        console.error('Error loading LLM preferences:', error);
      } finally {
        setLoadingPreferences(false);
      }
    };

    loadLLMPreferences();
  }, [agentId, supabase]);

  useEffect(() => {
    setName(agentData?.name || '');
    setDescription(agentData?.description || '');
  }, [agentData]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Agent name is required');
      return;
    }

    if (!description.trim()) {
      toast.error('Agent description is required');
      return;
    }

    setIsLoading(true);
    setSaveState('saving');
    
    try {
      // Update basic agent info
      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .update({
          name: name.trim(),
          description: description.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)
        .select()
        .single();

      if (agentError) throw agentError;

      // Update or create LLM preferences
      const { error: prefsError } = await supabase
        .from('agent_llm_preferences')
        .upsert({
          agent_id: agentId,
          provider: provider,
          model: model,
          params: {},
          embedding_model: 'text-embedding-3-small', // Default embedding model
          updated_at: new Date().toISOString()
        });

      if (prefsError) throw prefsError;

      // Success state
      setSaveState('success');
      toast.success('Agent details updated successfully');
      onAgentUpdated?.(agentData);

      // Reset to idle after 2 seconds
      setTimeout(() => {
        setSaveState('idle');
      }, 2000);

    } catch (error) {
      console.error('Error updating agent:', error);
      console.error('Error details:', error);
      
      // Error state
      setSaveState('error');
      toast.error('Failed to update agent details');

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setSaveState('idle');
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = 
    name !== (agentData?.name || '') ||
    description !== (agentData?.description || '') ||
    !loadingPreferences; // Always allow saving if preferences are loaded

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
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

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="agent-description" className="text-sm font-medium">
            Description <span className="text-destructive">*</span>
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
              Choose the language model provider and specific model that powers your agent's responses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingPreferences ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading model preferences...</span>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="provider-select">Provider</Label>
                  <Select value={provider} onValueChange={(value) => {
                    setProvider(value);
                    // Reset to first available model for the new provider
                    const providerModels = getModelsByProvider(value as any);
                    if (providerModels.length > 0) {
                      setModel(providerModels[0].id);
                    }
                  }}>
                    <SelectTrigger className="max-w-md">
                      <SelectValue placeholder="Select a provider..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getAllProviders().map((prov) => (
                        <SelectItem key={prov} value={prov}>
                          {prov === 'openai' && 'OpenAI'}
                          {prov === 'anthropic' && 'Anthropic (Claude)'}
                          {prov === 'google' && 'Google (Gemini)'}
                          {prov === 'mistral' && 'Mistral AI'}
                          {prov === 'groq' && 'Groq'}
                          {prov === 'openrouter' && 'OpenRouter'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model-select">Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="max-w-md">
                      <SelectValue placeholder="Select a model..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getModelsByProvider(provider as any).map((modelCard) => (
                        <SelectItem key={modelCard.id} value={modelCard.id}>
                          <div className="flex items-center space-x-2">
                            <span>{modelCard.displayName}</span>
                            {modelCard.category && (
                              <Badge variant="secondary" className="text-xs">
                                {modelCard.category}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {getModelCard(model) && (
                    <p className="text-xs text-muted-foreground">
                      Context: {getModelCard(model)?.context.toLocaleString()} tokens • 
                      Tools: {getModelCard(model)?.supportsTools ? 'Supported' : 'Not supported'} • 
                      Streaming: {getModelCard(model)?.supportsStreaming ? 'Supported' : 'Not supported'}
                    </p>
                  )}
                </div>
              </>
            )}
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

    </div>
  );
}
