import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  Volume2, 
  Search, 
  FileText, 
  Loader2, 
  Save,
  ExternalLink,
  AlertCircle,
  Settings,
  Plus,
  Key
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

interface CredentialModalState {
  isOpen: boolean;
  toolType: 'voice' | 'web_search' | 'document_creation' | null;
  selectedProvider: string;
  availableProviders: any[];
  availableCredentials: any[];
}

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  requiresApiKey: boolean;
  requiresOAuth: boolean;
}

export function ToolsTab({ agentId, agentData, onAgentUpdated }: ToolsTabProps) {
  const [settings, setSettings] = useState<ToolSettings>({
    voice_enabled: false,
    web_search_enabled: false,
    document_creation_enabled: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [credentialModal, setCredentialModal] = useState<CredentialModalState>({
    isOpen: false,
    toolType: null,
    selectedProvider: '',
    availableProviders: [],
    availableCredentials: []
  });
  const [newApiKey, setNewApiKey] = useState('');
  const supabase = useSupabaseClient();
  const { user } = useAuth();

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

  // Provider configurations
  const providerConfigs: Record<string, ProviderConfig[]> = {
    voice: [
      { id: 'elevenlabs', name: 'ElevenLabs', description: 'High-quality AI voice synthesis', requiresApiKey: true, requiresOAuth: false },
      { id: 'openai_tts', name: 'OpenAI TTS', description: 'OpenAI text-to-speech', requiresApiKey: true, requiresOAuth: false },
      { id: 'azure_speech', name: 'Azure Speech', description: 'Microsoft Azure Speech Services', requiresApiKey: true, requiresOAuth: false }
    ],
    web_search: [
      { id: 'serper', name: 'Serper', description: 'Google Search API via Serper', requiresApiKey: true, requiresOAuth: false },
      { id: 'serpapi', name: 'SerpAPI', description: 'Google Search results API', requiresApiKey: true, requiresOAuth: false },
      { id: 'brave_search', name: 'Brave Search', description: 'Privacy-focused search API', requiresApiKey: true, requiresOAuth: false }
    ],
    document_creation: [
      { id: 'google_docs', name: 'Google Docs', description: 'Create and edit Google Documents', requiresApiKey: false, requiresOAuth: true },
      { id: 'microsoft_office', name: 'Microsoft Office', description: 'Create and edit Office documents', requiresApiKey: false, requiresOAuth: true },
      { id: 'notion', name: 'Notion', description: 'Create and manage Notion pages', requiresApiKey: true, requiresOAuth: false }
    ]
  };

  const handleToggle = async (tool: keyof ToolSettings, enabled: boolean) => {
    if (enabled) {
      // Check if credentials exist for this tool
      const toolType = tool.replace('_enabled', '') as 'voice' | 'web_search' | 'document_creation';
      const hasCredentials = await checkExistingCredentials(toolType);
      
      if (!hasCredentials) {
        // Open credential selection modal
        openCredentialModal(toolType);
        return;
      }
    }
    
    setSettings(prev => ({ ...prev, [tool]: enabled }));
    setHasChanges(true);
  };

  const checkExistingCredentials = async (toolType: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('user_integrations')
        .select('id')
        .eq('user_id', user?.id)
        .eq('connection_status', 'connected')
        .ilike('connection_name', `%${toolType}%`)
        .limit(1);

      if (error) {
        console.error('Error checking credentials:', error);
        return false;
      }
      return (data?.length || 0) > 0;
    } catch (error) {
      console.error('Error checking credentials:', error);
      return false;
    }
  };

  const openCredentialModal = async (toolType: 'voice' | 'web_search' | 'document_creation') => {
    const providers = providerConfigs[toolType] || [];
    
    // Load existing credentials
    try {
      const { data: credentials, error } = await supabase
        .from('user_integrations')
        .select('*')
        .eq('user_id', user?.id)
        .ilike('connection_name', `%${toolType}%`);

      if (error) {
        console.error('Error loading credentials:', error);
        // Continue anyway to allow new credential creation
      }

      setCredentialModal({
        isOpen: true,
        toolType,
        selectedProvider: '',
        availableProviders: providers,
        availableCredentials: credentials || []
      });
    } catch (error) {
      console.error('Error loading credentials:', error);
      // Continue anyway to allow new credential creation
      setCredentialModal({
        isOpen: true,
        toolType,
        selectedProvider: '',
        availableProviders: providers,
        availableCredentials: []
      });
    }
  };

  const handleProviderSelect = (providerId: string) => {
    setCredentialModal(prev => ({ ...prev, selectedProvider: providerId }));
  };

  const handleCreateCredential = async () => {
    if (!credentialModal.selectedProvider || !user) return;

    const provider = credentialModal.availableProviders.find(p => p.id === credentialModal.selectedProvider);
    if (!provider) return;

    try {
      if (provider.requiresApiKey && !newApiKey.trim()) {
        toast.error('API key is required');
        return;
      }

      const configuration = provider.requiresApiKey 
        ? { api_key: newApiKey, provider: provider.id, auth_type: 'api_key' }
        : { provider: provider.id, auth_type: 'oauth', oauth_pending: true };

      const credentialData = {
        user_id: user.id,
        integration_id: '00000000-0000-0000-0000-000000000001', // Placeholder UUID
        connection_name: `${credentialModal.toolType}_${provider.id}`,
        connection_status: 'connected' as const,
        configuration,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('user_integrations')
        .insert(credentialData);

      if (error) throw error;

      toast.success(`${provider.name} credentials saved successfully`);
      setNewApiKey('');
      setCredentialModal(prev => ({ ...prev, isOpen: false }));
      
      // Enable the tool now that credentials are configured
      const toolKey = `${credentialModal.toolType}_enabled` as keyof ToolSettings;
      setSettings(prev => ({ ...prev, [toolKey]: true }));
      setHasChanges(true);
      
    } catch (error) {
      console.error('Error saving credentials:', error);
      toast.error('Failed to save credentials');
    }
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
    <div className="space-y-4">
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

      {/* Credential Configuration Modal */}
      <Dialog open={credentialModal.isOpen} onOpenChange={(open) => 
        setCredentialModal(prev => ({ ...prev, isOpen: open }))
      }>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Configure {credentialModal.toolType?.replace('_', ' ')} Provider</span>
            </DialogTitle>
            <DialogDescription>
              Select a provider and configure your credentials to enable this tool.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Existing Credentials */}
            {credentialModal.availableCredentials.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Existing Credentials</Label>
                <div className="space-y-2">
                  {credentialModal.availableCredentials.map((cred) => (
                    <div key={cred.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium text-sm">{cred.integration_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {cred.provider_id} • {cred.status}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Use existing credential and enable tool
                          const toolKey = `${credentialModal.toolType}_enabled` as keyof ToolSettings;
                          setSettings(prev => ({ ...prev, [toolKey]: true }));
                          setHasChanges(true);
                          setCredentialModal(prev => ({ ...prev, isOpen: false }));
                        }}
                      >
                        Use This
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or create new</span>
                  </div>
                </div>
              </div>
            )}

            {/* Provider Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Provider</Label>
              <Select value={credentialModal.selectedProvider} onValueChange={handleProviderSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a provider..." />
                </SelectTrigger>
                <SelectContent>
                  {credentialModal.availableProviders.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      <div>
                        <div className="font-medium">{provider.name}</div>
                        <div className="text-xs text-muted-foreground">{provider.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Credential Input */}
            {credentialModal.selectedProvider && (
              <div className="space-y-4">
                {(() => {
                  const provider = credentialModal.availableProviders.find(p => p.id === credentialModal.selectedProvider);
                  if (!provider) return null;

                  return (
                    <div className="space-y-3">
                      {provider.requiresApiKey && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center space-x-2">
                            <Key className="h-4 w-4" />
                            <span>API Key</span>
                          </Label>
                          <Input
                            type="password"
                            value={newApiKey}
                            onChange={(e) => setNewApiKey(e.target.value)}
                            placeholder="Enter your API key..."
                          />
                          <p className="text-xs text-muted-foreground">
                            Your API key will be encrypted and stored securely.
                          </p>
                        </div>
                      )}
                      
                      {provider.requiresOAuth && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            This provider requires OAuth authentication. Click "Connect" to authorize access.
                          </p>
                        </div>
                      )}

                      <div className="flex space-x-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => setCredentialModal(prev => ({ ...prev, isOpen: false }))}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateCredential}
                          className="flex-1"
                          disabled={provider.requiresApiKey && !newApiKey.trim()}
                        >
                          {provider.requiresOAuth ? 'Connect' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
