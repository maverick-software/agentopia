import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { toast } from 'react-hot-toast';
import { 
  Volume2, 
  Search, 
  FileText, 
  Loader2, 
  Save,
  ExternalLink,
  AlertCircle
} from 'lucide-react';

interface ToolsTabProps {
  agentId: string;
  agentData?: any;
  onAgentUpdated?: (updatedData: any) => void;
}

interface ToolSettings {
  voice_enabled: boolean;
  web_search_enabled: boolean;
  document_creation_enabled: boolean;
}

export function ToolsTab({ agentId, agentData, onAgentUpdated }: ToolsTabProps) {
  const [settings, setSettings] = useState<ToolSettings>({
    voice_enabled: false,
    web_search_enabled: false,
    document_creation_enabled: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const supabase = useSupabaseClient();

  useEffect(() => {
    // Load current tool settings from agent data
    if (agentData) {
      setSettings({
        voice_enabled: agentData.voice_enabled || false,
        web_search_enabled: agentData.web_search_enabled || false,
        document_creation_enabled: agentData.document_creation_enabled || false
      });
    }
  }, [agentData]);

  const handleToggle = (tool: keyof ToolSettings, enabled: boolean) => {
    setSettings(prev => ({ ...prev, [tool]: enabled }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('agents')
        .update({
          voice_enabled: settings.voice_enabled,
          web_search_enabled: settings.web_search_enabled,
          document_creation_enabled: settings.document_creation_enabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)
        .select()
        .single();

      if (error) throw error;

      toast.success('Tool settings updated successfully');
      setHasChanges(false);
      onAgentUpdated?.(data);
    } catch (error) {
      console.error('Error updating tool settings:', error);
      toast.error('Failed to update tool settings');
    } finally {
      setIsLoading(false);
    }
  };

  const tools = [
    {
      id: 'voice_enabled' as keyof ToolSettings,
      name: 'Voice Synthesis',
      description: 'Enable text-to-speech capabilities for agent responses',
      icon: Volume2,
      enabled: settings.voice_enabled,
      requiresApi: 'ElevenLabs API',
      status: 'available' // This would be dynamic based on API configuration
    },
    {
      id: 'web_search_enabled' as keyof ToolSettings,
      name: 'Web Search',
      description: 'Allow agent to search the web for current information',
      icon: Search,
      enabled: settings.web_search_enabled,
      requiresApi: 'Search API (Serper, SerpAPI, or Brave)',
      status: 'available'
    },
    {
      id: 'document_creation_enabled' as keyof ToolSettings,
      name: 'Document Creation',
      description: 'Enable agent to create and edit documents',
      icon: FileText,
      enabled: settings.document_creation_enabled,
      requiresApi: 'Document API',
      status: 'available'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Tools & Capabilities</h3>
        <p className="text-sm text-muted-foreground">
          Configure which tools and capabilities your agent can use.
        </p>
      </div>

      <div className="space-y-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isConfigured = tool.status === 'available';
          
          return (
            <Card key={tool.id} className={!isConfigured ? 'opacity-60' : ''}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${
                      tool.enabled && isConfigured
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{tool.name}</h4>
                        {!isConfigured && (
                          <Badge variant="outline" className="text-xs">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            API Required
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {tool.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Requires: {tool.requiresApi}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!isConfigured && (
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Configure
                      </Button>
                    )}
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={tool.id}
                        checked={tool.enabled && isConfigured}
                        onCheckedChange={(checked) => handleToggle(tool.id, checked)}
                        disabled={!isConfigured}
                      />
                      <Label htmlFor={tool.id} className="sr-only">
                        Toggle {tool.name}
                      </Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">Tool Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            To enable these tools, you'll need to configure the required APIs in the Integrations section.
          </p>
          <Button variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            Go to Integrations
          </Button>
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="flex items-center justify-end pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="min-w-[100px]"
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
