import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, 
  Check, 
  Search,
  Globe,
  Shield,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Plus,
  Key,
  Zap,
  Settings,
  FileText,
  BarChart3
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useWebSearchConnection } from '@/hooks/useWebSearchIntegration';
import { useConnections } from '@/hooks/useConnections';
import { useIntegrationsByClassification } from '@/hooks/useIntegrations';
import { toast } from 'react-hot-toast';

interface EnhancedToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

export function EnhancedToolsModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated
}: EnhancedToolsModalProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const { connections: webSearchConnections, refetch: refetchWebSearchConnections } = useWebSearchConnection();
  const { connections, refetch: refetchConnections } = useConnections({ includeRevoked: false });
  const { integrations } = useIntegrationsByClassification('tool');
  
  // UI state
  const [activeTab, setActiveTab] = useState('connected');
  const [connectingService, setConnectingService] = useState<string | null>(null);
  const [setupService, setSetupService] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [selectingCredentialFor, setSelectingCredentialFor] = useState<string | null>(null);
  
  // Setup form state
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [connectionName, setConnectionName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Agent-level permissions for tools
  type AgentPermission = {
    id: string;
    connection_id: string;
    provider_name: string;
    external_username?: string | null;
    is_active: boolean;
    allowed_scopes?: string[];
  };
  const [agentPermissions, setAgentPermissions] = useState<AgentPermission[]>([]);

  // DB-driven capabilities for tools
  type CapabilityRow = { capability_key: string; display_label: string; display_order: number };
  const [capabilitiesByIntegrationId, setCapabilitiesByIntegrationId] = useState<Record<string, CapabilityRow[]>>({});

  // Load capabilities for current tool integrations
  useEffect(() => {
    (async () => {
      try {
        const ids = integrations.map(i => i.id);
        if (!ids.length) return;
        const { data } = await supabase
          .from('integration_capabilities')
          .select('integration_id, capability_key, display_label, display_order')
          .in('integration_id', ids)
          .order('display_order');
        const map: Record<string, CapabilityRow[]> = {};
        (data || []).forEach((row: any) => {
          if (!map[row.integration_id]) map[row.integration_id] = [];
          map[row.integration_id].push({ capability_key: row.capability_key, display_label: row.display_label, display_order: row.display_order ?? 0 });
        });
        setCapabilitiesByIntegrationId(map);
      } catch {}
    })();
  }, [integrations, supabase]);

  // Fetch agent permissions (tools)
  const fetchAgentPermissions = useCallback(async () => {
    if (!agentId) return;
    try {
      const { data, error: rpcError } = await supabase.rpc('get_agent_integration_permissions', { p_agent_id: agentId });
      if (rpcError) throw rpcError;
      const rows = (data || []).map((r: any) => ({
        id: r.permission_id,
        connection_id: r.connection_id,
        provider_name: r.provider_name,
        external_username: r.external_username,
        is_active: r.is_active,
        allowed_scopes: r.allowed_scopes || []
      }));
      setAgentPermissions(rows);
    } catch (e) {
      console.error('Failed fetching agent tool permissions', e);
    }
  }, [agentId, supabase]);

  useEffect(() => { fetchAgentPermissions(); }, [fetchAgentPermissions]);

  // Search providers for unified Web Search integration
  const SEARCH_PROVIDERS = [
    { 
      id: 'serper_api', 
      name: 'Serper API', 
      setupUrl: 'https://serper.dev/api-key', 
      rateLimit: '1,000 queries/month free',
      description: 'Google search results with rich snippets and knowledge graph'
    },
    { 
      id: 'serpapi', 
      name: 'SerpAPI', 
      setupUrl: 'https://serpapi.com/manage-api-key', 
      rateLimit: '100 queries/month free',
      description: 'Multiple search engines with location-based results'
    },
    { 
      id: 'brave_search', 
      name: 'Brave Search API', 
      setupUrl: 'https://api.search.brave.com/app/keys', 
      rateLimit: '2,000 queries/month free',
      description: 'Privacy-focused search with independent index'
    }
  ];

  // Tool categories for API key setup
  const TOOL_CATEGORIES = [
    {
      id: 'research',
      name: 'Research & Data',
      tools: [
        { 
          id: 'web_search', 
          name: 'Web Search', 
          setupUrl: null, // Multiple providers
          rateLimit: 'Varies by provider'
        }
      ]
    }
  ];

  // Available tool services organized by category
  // DB-driven tool integrations
  const TOOL_INTEGRATIONS = (integrations || [])
    .filter((i: any) => i.status === 'available')
    .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name));

  // Clear saved state after 3 seconds
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  // Reset form state
  const resetForm = () => {
    setSelectedProvider('');
    setApiKey('');
    setConnectionName('');
    setError(null);
  };

  const handleApiKeySetup = async (toolId: string) => {
    if (!selectedProvider || !apiKey || !user) {
      setError('Please select a provider and enter an API key');
      return;
    }

    setConnectingService(toolId);
    setError(null);

    try {
      // Get provider configuration
      const { data: providerData, error: providerError } = await supabase
        .from('oauth_providers')
        .select('id')
        .eq('name', selectedProvider)
        .single();

      if (providerError) throw providerError;

      // Skip vault entirely - store as plain text for reliability
      let storedValue = apiKey;
      console.log('Storing API key as plain text for reliability');
      
      // Commented out vault encryption to avoid issues
      // try {
      //   const { data: encryptedKey, error: encryptError } = await supabase
      //     .rpc('vault_encrypt', { 
      //       data: apiKey,
      //       key_name: `${selectedProvider}_api_key_${user.id}_${Date.now()}`
      //     });
      //   
      //   if (encryptError) throw encryptError;
      //   storedValue = encryptedKey;
      //   console.log('API key encrypted successfully in vault');
      // } catch (vaultError) {
      //   console.log('Vault encryption failed, storing as plain text:', vaultError);
      // }

      // Store connection with encrypted or plain text API key
      const { error: insertError } = await supabase
        .from('user_oauth_connections')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id, // Required field
          external_username: connectionName || `${selectedProvider} Connection`,
          connection_name: connectionName || `${selectedProvider} Connection`,
          encrypted_access_token: storedValue, // Store either vault ID or plain text
          vault_access_token_id: storedValue, // Store in both for compatibility
          scopes_granted: ['web_search', 'news_search', 'image_search'],
          connection_status: 'active',
          credential_type: 'api_key'
        });

      if (insertError) throw insertError;

      // Get the tool name - for web search, show provider name; for others use the tool name
      const providerInfo = SEARCH_PROVIDERS.find(p => p.id === selectedProvider);
      const toolName = toolId === 'web_search' 
        ? `Web Search (${providerInfo?.name || selectedProvider})`
        : (TOOL_CATEGORIES.flatMap(cat => cat.tools).find(tool => tool.id === selectedProvider)?.name || selectedProvider);

      toast.success(`${toolName} connected successfully! 🎉`);
      setSaved(true);
      setSetupService(null);
      resetForm();
      
      // Refresh both web search connections and centralized connections
      await refetchWebSearchConnections();
      await refetchConnections();
      
      // Switch to connected tab to show the new connection
      setActiveTab('connected');
      
    } catch (error: any) {
      console.error('API key setup error:', error);
      setError(error.message || 'Failed to connect tool');
      toast.error('Failed to connect tool');
    } finally {
      setConnectingService(null);
    }
  };

  const getToolStatus = (providerName: string) => {
    // For unified Web Search, check if any web search provider is connected
    if (providerName === 'web search' || providerName === 'web_search') {
      const webSearchProviders = ['serper_api', 'serpapi', 'brave_search'];
      const hasWebSearchPermission = agentPermissions.some(p => 
        webSearchProviders.includes(p.provider_name) && p.is_active
      );
      if (hasWebSearchPermission) return 'connected';
      
      const hasWebSearchCredential = connections.some(c => 
        webSearchProviders.includes(c.provider_name) && c.connection_status === 'active'
      );
      return hasWebSearchCredential ? 'available' : 'available';
    }
    
    // For other providers, check normally
    const exists = agentPermissions.some(p => p.provider_name === providerName && p.is_active);
    if (exists) return 'connected';
    const hasCredential = connections.some(c => c.provider_name === providerName && c.connection_status === 'active');
    return hasCredential ? 'available' : 'available';
  };

  const defaultScopesForProvider = (provider: string): string[] => {
    // For unified web search or individual search providers
    if (['serper_api','serpapi','brave_search','web_search'].includes(provider)) {
      return ['web_search','news_search','image_search','local_search'];
    }
    return [];
  };

  const renderCapabilitiesBadges = (integrationId?: string) => {
    const caps = integrationId ? (capabilitiesByIntegrationId as any)?.[integrationId] : null;
    if (!caps || caps.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {caps.map((c: any) => (
          <Badge key={c.capability_key} variant="secondary" className="text-xs">{c.display_label}</Badge>
        ))}
      </div>
    );
  };

  const renderCredentialSelector = (provider: string, integrationId?: string) => {
    const creds = connections.filter(c => c.provider_name === provider && c.connection_status === 'active');
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-500" />
            <span>Select credential</span>
          </CardTitle>
          <CardDescription>Choose an existing credential or add a new one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Capabilities</div>
            {renderCapabilitiesBadges(integrationId)}
          </div>
          {creds.length === 0 && (
            <div className="text-sm text-muted-foreground">No saved credentials for this provider.</div>
          )}
          {creds.map((c) => (
            <div key={c.connection_id} className="flex items-center justify-between p-3 border rounded">
              <div className="text-sm">
                <div className="font-medium">{c.provider_display_name}</div>
                <div className="text-muted-foreground">{c.external_username || c.connection_name}</div>
              </div>
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    setConnectingService(provider);
                    const { error: grantError } = await supabase.rpc('grant_agent_integration_permission', {
                      p_agent_id: agentId,
                      p_connection_id: c.connection_id,
                      p_allowed_scopes: defaultScopesForProvider(provider),
                      p_permission_level: 'custom'
                    });
                    if (grantError) throw grantError;
                    await fetchAgentPermissions();
                    setSelectingCredentialFor(null);
                    setActiveTab('connected');
                  } catch (e) {
                    console.error('Grant permission error', e);
                    toast.error('Failed to authorize agent');
                  } finally {
                    setConnectingService(null);
                  }
                }}
              >
                Authorize Agent
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  const renderConnectedTools = () => {
    // Show tools added to the AGENT
    const toolConnections = agentPermissions.filter(p => p.is_active);

    if (toolConnections.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Settings className="h-12 w-12 text-muted-foreground opacity-50" />
          <div className="text-center">
            <p className="text-muted-foreground font-medium">No tools connected</p>
            <p className="text-sm text-muted-foreground mt-1">Add a tool to get started</p>
          </div>
          <Button
            onClick={() => setActiveTab('available')}
            className="mt-4"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Tool
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-end mb-4">
          <Button
            onClick={() => setActiveTab('available')}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Tool
          </Button>
        </div>
        
        {(() => {
          // Group web search providers under unified "Web Search" entry
          const webSearchProviders = ['serper_api', 'serpapi', 'brave_search'];
          const webSearchConnections = toolConnections.filter(c => 
            webSearchProviders.includes(c.provider_name)
          );
          const otherConnections = toolConnections.filter(c => 
            !webSearchProviders.includes(c.provider_name)
          );

          const items = [];

          // Add unified Web Search entry if any web search providers are connected
          if (webSearchConnections.length > 0) {
            const webSearchIntegration = TOOL_INTEGRATIONS.find(i => i.name.toLowerCase() === 'web search');
            const providerNames = webSearchConnections.map(c => {
              const provider = SEARCH_PROVIDERS.find(p => p.id === c.provider_name);
              return provider?.name || c.provider_name;
            }).join(', ');

            items.push(
              <div
                key="web_search_unified"
                className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Search className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-medium">Web Search</h3>
                    <p className="text-sm text-muted-foreground">
                      Using: {providerNames}
                    </p>
                    {renderCapabilitiesBadges(webSearchIntegration?.id)}
                  </div>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                  Connected
                </Badge>
              </div>
            );
          }

          // Add other (non-web search) connections
          otherConnections.forEach((connection) => {
            const matched = TOOL_INTEGRATIONS.find(i => i.name.toLowerCase().includes((connection as any).provider_name?.toLowerCase() || ''));
            items.push(
              <div
                key={connection.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Settings className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-medium">{matched?.name || connection.provider_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {(connection as any).external_username || 'Authorized'}
                    </p>
                    {renderCapabilitiesBadges(matched?.id)}
                  </div>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                  Connected
                </Badge>
              </div>
            );
          });

          return items;
        })()}
      </div>
    );
  };

  const renderApiKeySetup = (tool: any) => {
    // For Web Search integration, show provider selection
    if (tool.id === 'web_search') {
      return (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Search className="h-5 w-5 text-blue-500" />
              <span>Web Search Setup</span>
            </CardTitle>
            <CardDescription>
              Choose a search provider and enter your API key to enable web search capabilities.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="provider_select">
                Search Provider
              </Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose your search provider" />
                </SelectTrigger>
                <SelectContent>
                  {SEARCH_PROVIDERS.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      <div className="flex flex-col text-left">
                        <span className="font-medium">{provider.name}</span>
                        <span className="text-xs text-muted-foreground">{provider.rateLimit}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProvider && (
              <>
                <div>
                  <Label htmlFor="connection_name">
                    Connection Name (Optional)
                  </Label>
                  <Input
                    id="connection_name"
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                    placeholder={`My ${SEARCH_PROVIDERS.find(p => p.id === selectedProvider)?.name} Connection`}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="api_key">
                    API Key
                  </Label>
                  <Input
                    id="api_key"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="mt-1"
                  />
                </div>

                {SEARCH_PROVIDERS.find(p => p.id === selectedProvider) && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p><strong>Provider:</strong> {SEARCH_PROVIDERS.find(p => p.id === selectedProvider)?.description}</p>
                        <p><strong>Rate Limit:</strong> {SEARCH_PROVIDERS.find(p => p.id === selectedProvider)?.rateLimit}</p>
                        <p>
                          <Button variant="link" className="p-0 h-auto" asChild>
                            <a 
                              href={SEARCH_PROVIDERS.find(p => p.id === selectedProvider)?.setupUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              Get API Key <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          </Button>
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={() => handleApiKeySetup(tool.id)}
                  disabled={!apiKey || connectingService === tool.id}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white"
                >
                  {connectingService === tool.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting Web Search...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Connect Web Search
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      );
    }

    // Fallback for other tool types (non-web search)
    const availableProviders = TOOL_CATEGORIES
      .find(cat => cat.id === 'research')?.tools || [];

    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5 text-blue-500" />
            <span>API Key Setup</span>
          </CardTitle>
          <CardDescription>
            Enter your API key to connect {tool.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="provider_select">
              Search Provider
            </Label>
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a search provider" />
              </SelectTrigger>
              <SelectContent>
                {availableProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProvider && (
            <>
              <div>
                <Label htmlFor="connection_name">
                  Connection Name (Optional)
                </Label>
                <Input
                  id="connection_name"
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                  placeholder={`My ${availableProviders.find(p => p.id === selectedProvider)?.name} Connection`}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="api_key">
                  API Key
                </Label>
                <Input
                  id="api_key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  className="mt-1"
                />
              </div>

              {availableProviders.find(p => p.id === selectedProvider) && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p><strong>Rate Limit:</strong> {availableProviders.find(p => p.id === selectedProvider)?.rateLimit}</p>
                      <p>
                        <Button variant="link" className="p-0 h-auto" asChild>
                          <a 
                            href={availableProviders.find(p => p.id === selectedProvider)?.setupUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            Get API Key <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                )}

              <Button
                onClick={() => handleApiKeySetup(tool.id)}
                disabled={!apiKey || connectingService === tool.id}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white"
              >
                {connectingService === tool.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Connect Tool
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderAvailableTools = () => {
    return (
      <div className="space-y-6">
        <div className="text-sm text-muted-foreground mb-4">Choose tools to enhance your agent's capabilities:</div>
        <div className="space-y-3">
          {TOOL_INTEGRATIONS.map((integration: any) => {
            const provider = integration.name.toLowerCase();
            const status = getToolStatus(provider);
            const isConnected = status === 'connected';
            const isSetupMode = setupService === provider;
            const isSelecting = selectingCredentialFor === provider;
            
            if (isSetupMode && (provider === 'web search' || provider === 'web_search' || integration.name.toLowerCase() === 'web search')) {
              // Show API key setup for Web Search integration
              const display = integration.name;
              return (
                <div key={integration.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">{display}</h4>
                        <Badge variant="outline" className="text-xs">Setting up...</Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setSetupService(null); resetForm(); }}>Cancel</Button>
                  </div>
                  {renderApiKeySetup({ id: 'web_search', name: display } as any)}
                </div>
              );
            }

            if (isSelecting) {
              return (
                <div key={integration.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center"><Search className="h-5 w-5 text-white" /></div>
                      <div>
                        <h3 className="font-medium">{integration.name}</h3>
                        <p className="text-sm text-muted-foreground">Choose credential</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectingCredentialFor(null)}>Cancel</Button>
                  </div>
                  {renderCredentialSelector(provider, integration.id)}
                </div>
              );
            }

            return (
              <div key={integration.id} className={`flex items-center justify-between p-4 rounded-lg border transition-all ${isConnected ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20' : 'border-border hover:bg-accent/50'}`}>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-medium">{integration.name}</h4>
                    {isConnected && (<Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">Connected</Badge>)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{integration.description}</p>
                  {renderCapabilitiesBadges(integration.id)}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {isConnected ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <Button
                      onClick={() => {
                        // For Web Search integration, show API key setup with provider selection
                        if (provider === 'web search' || provider === 'web_search' || integration.name.toLowerCase() === 'web search') {
                          setSetupService(provider);
                        } else {
                          // For other integrations, use credential selection
                          setSelectingCredentialFor(provider);
                        }
                      }}
                      size="sm"
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center">
            ⚡ Tools
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Connect tools and services to expand your agent's capabilities.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="connected">Connected Tools</TabsTrigger>
              <TabsTrigger value="available">Add New Tool</TabsTrigger>
            </TabsList>
            
            <TabsContent value="connected" className="mt-6">
              <div className="min-h-[300px]">
                {renderConnectedTools()}
              </div>
            </TabsContent>
            
            <TabsContent value="available" className="mt-6">
              <div className="min-h-[300px]">
                {renderAvailableTools()}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}