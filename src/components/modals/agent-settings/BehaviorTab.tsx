import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  Loader2, 
  Check, 
  Brain,
  Zap,
  MessageSquare,
  Settings
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { getModelsByProvider } from '@/lib/llm/modelRegistry';
import { toast } from 'react-hot-toast';

interface BehaviorTabProps {
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

const REASONING_STYLES = [
  {
    id: 'analytical',
    name: 'Analytical',
    description: 'Step-by-step logical reasoning with detailed analysis',
    icon: '🔍'
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Innovative thinking with multiple perspectives and brainstorming',
    icon: '💡'
  },
  {
    id: 'practical',
    name: 'Practical',
    description: 'Solution-focused approach with actionable recommendations',
    icon: '🛠️'
  },
  {
    id: 'collaborative',
    name: 'Collaborative',
    description: 'Interactive reasoning that builds on user input and feedback',
    icon: '🤝'
  },
  {
    id: 'systematic',
    name: 'Systematic',
    description: 'Structured methodology following established frameworks',
    icon: '📋'
  }
];

export function BehaviorTab({ agentId, agentData, onAgentUpdated }: BehaviorTabProps) {
  const supabase = useSupabaseClient();
  const { user } = useAuth();

  // Form state
  const [reasoningStyle, setReasoningStyle] = useState('analytical');
  const [selectedModel, setSelectedModel] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [reasoningEnabled, setReasoningEnabled] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Available models
  const [availableModels, setAvailableModels] = useState<any[]>([]);

  // Load agent settings
  useEffect(() => {
    const loadAgentSettings = async () => {
      if (!agentId) return;
      
      setLoadingSettings(true);
      try {
        const { data, error } = await supabase
          .from('agents')
          .select('metadata, model_provider, model_name')
          .eq('id', agentId)
          .single();

        if (error) throw error;

        const metadata = data?.metadata || {};
        const settings = metadata.settings || {};
        
        setReasoningStyle(settings.reasoning_style || 'analytical');
        setCustomInstructions(settings.custom_instructions || '');
        setWebSearchEnabled(settings.web_search_enabled === true);
        setReasoningEnabled(settings.reasoning_enabled === true);
        
        // Set model selection
        if (data.model_provider && data.model_name) {
          setSelectedModel(`${data.model_provider}:${data.model_name}`);
        }

      } catch (error) {
        console.error('Error loading agent settings:', error);
      } finally {
        setLoadingSettings(false);
      }
    };

    loadAgentSettings();
  }, [agentId, supabase]);

  // Load available models
  useEffect(() => {
    const loadModels = () => {
      const models: any[] = [];
      
      // Get models from all providers
      const providers = ['openai', 'anthropic', 'google', 'ollama'];
      providers.forEach(provider => {
        try {
          const providerModels = getModelsByProvider(provider);
          providerModels.forEach(model => {
            models.push({
              id: `${provider}:${model.id}`,
              name: model.name,
              provider: provider,
              description: model.description || `${provider} model`
            });
          });
        } catch (error) {
          console.warn(`Failed to load models for provider ${provider}:`, error);
        }
      });
      
      setAvailableModels(models);
    };

    loadModels();
  }, []);

  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    
    setLoading(true);
    
    try {
      // Parse model selection
      let modelProvider = '';
      let modelName = '';
      if (selectedModel && selectedModel.includes(':')) {
        [modelProvider, modelName] = selectedModel.split(':');
      }

      // Get current metadata
      const { data: currentData } = await supabase
        .from('agents')
        .select('metadata')
        .eq('id', agentId)
        .single();

      const currentMetadata = currentData?.metadata || {};
      const updatedMetadata = {
        ...currentMetadata,
        settings: {
          ...currentMetadata.settings,
          reasoning_style: reasoningStyle,
          custom_instructions: customInstructions,
          web_search_enabled: webSearchEnabled,
          reasoning_enabled: reasoningEnabled
        }
      };

      // Update agent
      const { data, error } = await supabase
        .from('agents')
        .update({
          metadata: updatedMetadata,
          model_provider: modelProvider || null,
          model_name: modelName || null
        })
        .eq('id', agentId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Behavior settings updated successfully! 🧠');
      
      if (onAgentUpdated) {
        onAgentUpdated(data);
      }
      
    } catch (error: any) {
      console.error('Error updating agent behavior:', error);
      toast.error('Failed to update behavior settings');
    } finally {
      setLoading(false);
    }
  }, [agentId, user, reasoningStyle, selectedModel, customInstructions, webSearchEnabled, reasoningEnabled, supabase, onAgentUpdated]);

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium">Behavior & Instructions</h3>
        <p className="text-sm text-muted-foreground">
          Configure advanced reasoning, system instructions, and assistant behavior.
        </p>
      </div>

      {/* Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>Language Model</span>
          </CardTitle>
          <CardDescription>
            Choose the AI model that powers your agent's responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Model</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Select a model..." />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div>
                      <div className="font-medium">{model.name}</div>
                      <div className="text-xs text-muted-foreground">{model.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reasoning Style */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Reasoning Style</span>
          </CardTitle>
          <CardDescription>
            How your agent approaches problems and formulates responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Style</Label>
            <Select value={reasoningStyle} onValueChange={setReasoningStyle}>
              <SelectTrigger className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONING_STYLES.map((style) => (
                  <SelectItem key={style.id} value={style.id}>
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{style.icon}</span>
                      <div>
                        <div className="font-medium">{style.name}</div>
                        <div className="text-xs text-muted-foreground">{style.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Capabilities</span>
          </CardTitle>
          <CardDescription>
            Enable or disable specific agent capabilities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Web Search</Label>
              <div className="text-sm text-muted-foreground">
                Allow agent to search the web for current information
              </div>
            </div>
            <Switch
              checked={webSearchEnabled}
              onCheckedChange={setWebSearchEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Advanced Reasoning</Label>
              <div className="text-sm text-muted-foreground">
                Enable enhanced reasoning capabilities and chain-of-thought processing
              </div>
            </div>
            <Switch
              checked={reasoningEnabled}
              onCheckedChange={setReasoningEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Custom Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Custom Instructions</span>
          </CardTitle>
          <CardDescription>
            Additional instructions to guide your agent's behavior
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Instructions</Label>
            <Textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Enter custom instructions for your agent..."
              rows={4}
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              These instructions will be included in every conversation with your agent.
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
    </div>
  );
}
