import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { 
  Loader2, 
  Check, 
  Brain
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { TabRef } from './types';

interface ReasoningTabProps {
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

export const ReasoningTab = forwardRef<TabRef, ReasoningTabProps>(({ agentId, agentData, onAgentUpdated }, ref) => {
  const supabase = useSupabaseClient();
  const { user } = useAuth();

  // Form state
  const [reasoningEnabled, setReasoningEnabled] = useState(false);
  const [originalReasoningEnabled, setOriginalReasoningEnabled] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
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
        
        const enabled = settings.reasoning_enabled === true;
        setReasoningEnabled(enabled);
        setOriginalReasoningEnabled(enabled); // Store original value

      } catch (error) {
        console.error('Error loading reasoning settings:', error);
      } finally {
        setLoadingSettings(false);
      }
    };

    loadReasoningSettings();
  }, [agentId, supabase]);

  // Expose save method and state to parent via ref
  useImperativeHandle(ref, () => ({
    save: async () => {
      await handleSave();
    },
    hasChanges: reasoningEnabled !== originalReasoningEnabled,
    saving: loading,
    saveSuccess
  }));

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

      toast.success('Reasoning settings updated successfully! 🧠');
      
      // Update original value to reflect saved state
      setOriginalReasoningEnabled(reasoningEnabled);
      
      // Show success state
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
      
      if (onAgentUpdated) {
        onAgentUpdated(data);
      }
      
    } catch (error: any) {
      console.error('Error updating reasoning settings:', error);
      toast.error('Failed to update reasoning settings');
    } finally {
      setLoading(false);
    }
  }, [agentId, user, reasoningEnabled, supabase, onAgentUpdated]);

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
        <h3 className="text-lg font-medium">Advanced Reasoning</h3>
        <p className="text-sm text-muted-foreground">
          Configure enhanced reasoning capabilities and chain-of-thought processing for your agent.
        </p>
      </div>

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
                Activates sophisticated reasoning patterns including inductive, abductive, and deductive logic. The system automatically selects the most appropriate reasoning style based on the context of each message.
              </div>
            </div>
            <Switch
              checked={reasoningEnabled}
              onCheckedChange={setReasoningEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Additional information card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Advanced Reasoning Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              When enabled, your agent will use sophisticated reasoning patterns to analyze complex queries and provide more thoughtful, well-reasoned responses.
            </p>
            <div className="space-y-2">
              <p className="font-medium text-foreground">Reasoning Styles:</p>
              <ul className="space-y-1.5 ml-4">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span><strong>Inductive:</strong> Recognizes patterns from examples and observations</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span><strong>Deductive:</strong> Applies logical rules to reach conclusions</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span><strong>Abductive:</strong> Generates the best explanation for observations</span>
                </li>
              </ul>
            </div>
            <p className="pt-2">
              The system automatically selects the most appropriate reasoning style based on the query context, available tools, and conversation history.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

ReasoningTab.displayName = 'ReasoningTab';

