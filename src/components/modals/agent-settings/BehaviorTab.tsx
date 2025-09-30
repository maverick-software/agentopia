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
  MessageSquare,
  Settings
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
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
  const [customInstructions, setCustomInstructions] = useState('');
  const [reasoningEnabled, setReasoningEnabled] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Load agent settings
  useEffect(() => {
    const loadAgentSettings = async () => {
      if (!agentId) return;
      
      setLoadingSettings(true);
      try {
        const { data, error } = await supabase
          .from('agents')
          .select('metadata')
          .eq('id', agentId)
          .single();

        if (error) throw error;

        const metadata = data?.metadata || {};
        const settings = metadata.settings || {};
        
        setReasoningStyle(settings.reasoning_style || 'analytical');
        setCustomInstructions(settings.custom_instructions || '');
        setReasoningEnabled(settings.reasoning_enabled === true); // Defaults to false if undefined

      } catch (error) {
        console.error('Error loading agent settings:', error);
      } finally {
        setLoadingSettings(false);
      }
    };

    loadAgentSettings();
  }, [agentId, supabase]);



  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    
    setLoading(true);
    
    try {
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
          reasoning_enabled: reasoningEnabled
        }
      };

      // Update agent
      const { data, error } = await supabase
        .from('agents')
        .update({
          metadata: updatedMetadata
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
  }, [agentId, user, reasoningStyle, customInstructions, reasoningEnabled, supabase, onAgentUpdated]);

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Behavior & Instructions</h3>
        <p className="text-sm text-muted-foreground">
          Configure advanced reasoning, system instructions, and assistant behavior.
        </p>
      </div>

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

      {/* Advanced Reasoning */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>Advanced Reasoning</span>
          </CardTitle>
          <CardDescription>
            Enable enhanced reasoning capabilities and chain-of-thought processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Advanced Reasoning</Label>
              <div className="text-sm text-muted-foreground">
                Activates sophisticated reasoning patterns including inductive, abductive, and deductive logic
              </div>
            </div>
            <Switch
              checked={reasoningEnabled}
              onCheckedChange={setReasoningEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* System Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>System Instructions</span>
          </CardTitle>
          <CardDescription>
            Core behavioral guidelines that define your agent's most important operating principles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Primary Instructions</Label>
              <Textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Example: You are a professional customer support agent. Always be polite, helpful, and solution-focused. When handling complaints, acknowledge the issue, apologize sincerely, and provide clear next steps. Escalate to a human agent if the customer requests it or if the issue requires manual intervention."
                rows={6}
                className="w-full"
              />
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium text-foreground">💡 Best Practices:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Be specific about tone, style, and approach</li>
                  <li>• Define clear boundaries and escalation rules</li>
                  <li>• Include examples of desired responses</li>
                  <li>• Specify any compliance or safety requirements</li>
                </ul>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Note:</strong> These instructions are sent as system prompts and take highest priority in guiding your agent's behavior. They will be applied to every conversation.
              </p>
            </div>
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
