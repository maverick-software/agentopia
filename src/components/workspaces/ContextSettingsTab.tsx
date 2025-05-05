import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useWorkspaceSettings, WorkspaceContextSettings } from '@/hooks/useWorkspaceSettings';
import { Loader2, AlertCircle, RefreshCw, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider, 
  TooltipTrigger
} from '@/components/ui/tooltip';

interface ContextSettingsTabProps {
  workspaceId: string;
}

export const ContextSettingsTab: React.FC<ContextSettingsTabProps> = ({ workspaceId }) => {
  const {
    contextSettings,
    loading,
    error,
    fetchSettings,
    updateSettings
  } = useWorkspaceSettings();

  // Local state for form values
  const [windowSize, setWindowSize] = useState<number>(20);
  const [tokenLimit, setTokenLimit] = useState<number>(8000);
  const [agentAwarenessEnabled, setAgentAwarenessEnabled] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Fetch settings when component mounts
  useEffect(() => {
    if (workspaceId) {
      fetchSettings(workspaceId);
    }
  }, [workspaceId, fetchSettings]);

  // Update local state when settings are loaded
  useEffect(() => {
    if (contextSettings) {
      setWindowSize(contextSettings.context_window_size);
      setTokenLimit(contextSettings.context_window_token_limit);
      // Agent awareness toggle - future enhancement, not currently in DB schema
      // setAgentAwarenessEnabled(contextSettings.agent_awareness_enabled || false);
    }
  }, [contextSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const success = await updateSettings(workspaceId, {
        context_window_size: windowSize,
        context_window_token_limit: tokenLimit
      });

      if (success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000); // Clear success message after 3 seconds
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (err: any) {
      setSaveError(err.message || 'An error occurred while saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (contextSettings) {
      setWindowSize(contextSettings.context_window_size);
      setTokenLimit(contextSettings.context_window_token_limit);
    } else {
      // Reset to defaults if no settings loaded
      setWindowSize(20);
      setTokenLimit(8000);
    }
    setSaveError(null);
  };

  if (loading && !contextSettings) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="window-size">Context Window Size</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    The number of most recent messages to include when an agent responds.
                    Higher values provide more context but use more tokens.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="text-sm font-medium">{windowSize} messages</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            id="window-size"
            type="number"
            min={1}
            max={100}
            value={windowSize}
            onChange={(e) => setWindowSize(Number(e.target.value))}
            className="w-20"
          />
          <Slider
            value={[windowSize]}
            min={1}
            max={100}
            step={1}
            onValueChange={(value) => setWindowSize(value[0])}
            className="flex-1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="token-limit">Token Limit</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Maximum number of tokens to include in the context.
                    Higher values provide more context but increase costs and response times.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="text-sm font-medium">{tokenLimit.toLocaleString()} tokens</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            id="token-limit"
            type="number"
            min={1000}
            max={32000}
            step={1000}
            value={tokenLimit}
            onChange={(e) => setTokenLimit(Number(e.target.value))}
            className="w-24"
          />
          <Slider
            value={[tokenLimit]}
            min={1000}
            max={32000}
            step={1000}
            onValueChange={(value) => setTokenLimit(value[0])}
            className="flex-1"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2 pt-2">
        <Switch
          id="agent-awareness"
          checked={agentAwarenessEnabled}
          onCheckedChange={setAgentAwarenessEnabled}
        />
        <div className="grid gap-1.5 leading-none">
          <Label htmlFor="agent-awareness" className="cursor-pointer">Enable Agent Awareness</Label>
          <p className="text-sm text-muted-foreground">
            Allow agents to know about other agents in this workspace
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      {saveError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          {saveError}
        </div>
      )}

      {saveSuccess && (
        <div className="rounded-md bg-green-500/10 border border-green-500 p-3 text-sm text-green-600 flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          Settings saved successfully!
        </div>
      )}

      <div className="flex space-x-2 pt-2">
        <Button 
          variant="default" 
          onClick={handleSave}
          disabled={isSaving || loading || !contextSettings || (
            contextSettings.context_window_size === windowSize &&
            contextSettings.context_window_token_limit === tokenLimit
          )}
        >
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Changes
        </Button>
        <Button 
          variant="outline" 
          onClick={handleReset}
          disabled={isSaving || loading || !contextSettings}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>
    </div>
  );
}; 