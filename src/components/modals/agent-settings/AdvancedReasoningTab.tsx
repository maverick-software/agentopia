import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { 
  Loader2, 
  Check, 
  Settings,
  Zap,
  Brain,
  Target,
  Clock
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface AdvancedReasoningTabProps {
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

const REASONING_MODES = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'Direct response without explicit reasoning steps',
    icon: '⚡'
  },
  {
    id: 'chain_of_thought',
    name: 'Chain of Thought',
    description: 'Step-by-step reasoning process shown to user',
    icon: '🔗'
  },
  {
    id: 'tree_of_thought',
    name: 'Tree of Thought',
    description: 'Explore multiple reasoning paths before responding',
    icon: '🌳'
  },
  {
    id: 'reflection',
    name: 'Reflection',
    description: 'Self-critique and improve responses before delivery',
    icon: '🪞'
  }
];

const REASONING_DEPTH = [
  { value: 1, label: 'Shallow', description: 'Quick, surface-level reasoning' },
  { value: 2, label: 'Moderate', description: 'Balanced reasoning depth' },
  { value: 3, label: 'Deep', description: 'Thorough, comprehensive analysis' },
  { value: 4, label: 'Exhaustive', description: 'Maximum depth reasoning (slower)' }
];

export function AdvancedReasoningTab({ agentId, agentData, onAgentUpdated }: AdvancedReasoningTabProps) {
  const supabase = useSupabaseClient();
  const { user } = useAuth();

  // Form state
  const [reasoningEnabled, setReasoningEnabled] = useState(false);
  const [reasoningMode, setReasoningMode] = useState('chain_of_thought');
  const [reasoningDepth, setReasoningDepth] = useState(2);
  const [showReasoningProcess, setShowReasoningProcess] = useState(true);
  const [adaptiveReasoning, setAdaptiveReasoning] = useState(true);
  const [reasoningTimeout, setReasoningTimeout] = useState(30);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Load agent settings
  useEffect(() => {
    const loadReasoningSettings = async () => {
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
        const reasoningSettings = settings.reasoning || {};
        
        setReasoningEnabled(settings.reasoning_enabled === true);
        setReasoningMode(reasoningSettings.mode || 'chain_of_thought');
        setReasoningDepth(reasoningSettings.depth || 2);
        setShowReasoningProcess(reasoningSettings.show_process !== false);
        setAdaptiveReasoning(reasoningSettings.adaptive !== false);
        setReasoningTimeout(reasoningSettings.timeout || 30);

      } catch (error) {
        console.error('Error loading reasoning settings:', error);
      } finally {
        setLoadingSettings(false);
      }
    };

    loadReasoningSettings();
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
          reasoning_enabled: reasoningEnabled,
          reasoning: {
            mode: reasoningMode,
            depth: reasoningDepth,
            show_process: showReasoningProcess,
            adaptive: adaptiveReasoning,
            timeout: reasoningTimeout
          }
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

      toast.success('Advanced reasoning settings updated! 🧠');
      
      if (onAgentUpdated) {
        onAgentUpdated(data);
      }
      
    } catch (error: any) {
      console.error('Error updating reasoning settings:', error);
      toast.error('Failed to update reasoning settings');
    } finally {
      setLoading(false);
    }
  }, [agentId, user, reasoningEnabled, reasoningMode, reasoningDepth, showReasoningProcess, adaptiveReasoning, reasoningTimeout, supabase, onAgentUpdated]);

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Advanced Reasoning</h2>
        <p className="text-muted-foreground text-sm">
          Configure enhanced reasoning capabilities for complex problem-solving.
        </p>
      </div>

      {/* Main Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Enable Advanced Reasoning</span>
          </CardTitle>
          <CardDescription>
            Activate enhanced reasoning capabilities for your agent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Advanced Reasoning</Label>
              <div className="text-sm text-muted-foreground">
                Enable chain-of-thought processing and enhanced problem-solving
              </div>
            </div>
            <Switch
              checked={reasoningEnabled}
              onCheckedChange={setReasoningEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Reasoning Configuration */}
      {reasoningEnabled && (
        <>
          {/* Reasoning Mode */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="h-5 w-5" />
                <span>Reasoning Mode</span>
              </CardTitle>
              <CardDescription>
                Choose how your agent approaches complex problems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={reasoningMode} onValueChange={setReasoningMode}>
                  <SelectTrigger className="max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONING_MODES.map((mode) => (
                      <SelectItem key={mode.id} value={mode.id}>
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">{mode.icon}</span>
                          <div>
                            <div className="font-medium">{mode.name}</div>
                            <div className="text-xs text-muted-foreground">{mode.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Reasoning Depth */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>Reasoning Depth</span>
              </CardTitle>
              <CardDescription>
                Control how thoroughly your agent analyzes problems
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base">
                    Depth: {REASONING_DEPTH.find(d => d.value === reasoningDepth)?.label}
                  </Label>
                </div>
                <Slider
                  value={[reasoningDepth]}
                  onValueChange={(value) => setReasoningDepth(value[0])}
                  max={4}
                  min={1}
                  step={1}
                  className="w-full max-w-md"
                />
                <div className="text-xs text-muted-foreground">
                  {REASONING_DEPTH.find(d => d.value === reasoningDepth)?.description}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reasoning Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Reasoning Options</span>
              </CardTitle>
              <CardDescription>
                Fine-tune reasoning behavior and presentation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Show Reasoning Process</Label>
                  <div className="text-sm text-muted-foreground">
                    Display the reasoning steps to users during conversations
                  </div>
                </div>
                <Switch
                  checked={showReasoningProcess}
                  onCheckedChange={setShowReasoningProcess}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Adaptive Reasoning</Label>
                  <div className="text-sm text-muted-foreground">
                    Automatically adjust reasoning depth based on question complexity
                  </div>
                </div>
                <Switch
                  checked={adaptiveReasoning}
                  onCheckedChange={setAdaptiveReasoning}
                />
              </div>
            </CardContent>
          </Card>

          {/* Performance Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Performance Settings</span>
              </CardTitle>
              <CardDescription>
                Balance reasoning quality with response time
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Reasoning Timeout: {reasoningTimeout}s</Label>
                </div>
                <Slider
                  value={[reasoningTimeout]}
                  onValueChange={(value) => setReasoningTimeout(value[0])}
                  max={120}
                  min={10}
                  step={5}
                  className="w-full max-w-md"
                />
                <div className="text-xs text-muted-foreground">
                  Maximum time allowed for reasoning before fallback to standard response
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
