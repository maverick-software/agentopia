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
  BarChart3,
  RefreshCw,
  Trash2,
  Wrench,
  Mail
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useWebSearchConnection } from '@/integrations/web-search';
import { useConnections, useIntegrationsByClassification, useAgentIntegrationPermissions, VaultService } from '@/integrations/_shared';
import { ZapierMCPModal } from './ZapierMCPModal';
import { toast } from 'react-hot-toast';

// Zapier Tools List Component
interface ZapierToolsListProps {
  agentId: string;
  connectionId: string;
  onToolsUpdate: (count: number) => void;
}

function ZapierToolsList({ agentId, connectionId, onToolsUpdate }: ZapierToolsListProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const [tools, setTools] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadTools = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { ZapierMCPManager } = await import('@/lib/mcp/zapier-mcp-manager');
      const manager = new ZapierMCPManager(supabase, user.id);
      const connectionTools = await manager.getConnectionTools(connectionId);
      setTools(connectionTools);
      onToolsUpdate(connectionTools.length);
    } catch (err) {
      console.error('Failed to load tools:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tools');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadTools();
  }, [connectionId, user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading tools...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-blue-500" />
          Available Tools ({tools.length})
        </CardTitle>
        <CardDescription>
          These automation tools are available from the connected Zapier MCP server.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tools.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No tools discovered yet.</p>
            <p className="text-sm">Try refreshing to discover available tools.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tools.map((tool) => (
              <div key={tool.id} className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-sm">{tool.tool_name}</h4>
                  <Badge variant="outline" className="text-xs">
                    MCP Tool
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {tool.tool_schema.description || 'No description available'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last updated: {new Date(tool.last_updated).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
  const [showZapierModal, setShowZapierModal] = useState(false);
  const [zapierConnection, setZapierConnection] = useState<any>(null);
  const [zapierToolsCount, setZapierToolsCount] = useState(0);
  const [zapierToolsRefreshKey, setZapierToolsRefreshKey] = useState(0);
  
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

  // Use the new hook to fetch agent permissions
  const { permissions: integrationPermissions, refetch: refetchIntegrationPermissions } = useAgentIntegrationPermissions(agentId);

  useEffect(() => {
    // Map integration permissions to the format expected by this component
    const mappedPermissions = integrationPermissions.map(perm => ({
      id: perm.permission_id,
      connection_id: perm.connection_id,
      provider_name: perm.provider_name,
      external_username: perm.external_username,
      is_active: perm.is_active,
      allowed_scopes: perm.allowed_scopes || []
    }));
    setAgentPermissions(mappedPermissions);
  }, [integrationPermissions]);

  // Check for existing Zapier MCP connection
  useEffect(() => {
    const checkZapierConnection = async () => {
      if (!agentId || !user?.id) return;
      
      try {
        const { ZapierMCPManager } = await import('@/lib/mcp/zapier-mcp-manager');
        const manager = new ZapierMCPManager(supabase, user.id);
        
        const connections = await manager.getAgentConnections(agentId);
        const connection = connections.length > 0 ? connections[0] : null;
        setZapierConnection(connection);
        
        if (connection) {
          const tools = await manager.getConnectionTools(connection.id);
          setZapierToolsCount(tools.length);
        }
      } catch (error) {
        console.error('Failed to check Zapier connection:', error);
      }
    };

    if (isOpen) {
      checkZapierConnection();
    }
  }, [isOpen, agentId, user?.id, supabase]);

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

      // ✅ SECURE: Create vault secret for API key
      const secretName = `${selectedProvider}_api_key_${user.id}_${Date.now()}`;
      const { data: vaultSecretId, error: vaultError } = await supabase.rpc('create_vault_secret', {
        p_secret: apiKey,
        p_name: secretName,
        p_description: `${selectedProvider} API key for user ${user.id} - Created: ${new Date().toISOString()}`
      });

      if (vaultError || !vaultSecretId) {
        throw new Error(`Failed to secure API key in vault: ${vaultError?.message}`);
      }

      console.log(`✅ API key securely stored in vault: ${vaultSecretId}`);
      const storedValue = vaultSecretId; // ✅ Store vault UUID only

      // Store connection with encrypted or plain text API key
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id, // Required field
          external_username: connectionName || `${selectedProvider} Connection`,
          connection_name: connectionName || `${selectedProvider} Connection`,
          encrypted_access_token: null, // ✅ DO NOT store plain text
          vault_access_token_id: storedValue, // ✅ Store vault UUID only
          scopes_granted: ['web_search', 'news_search', 'image_search'],
          connection_status: 'active',
          credential_type: 'api_key'
        })
        .select('id')
        .single();

      if (insertError || !connectionData) throw insertError || new Error('Failed to create connection');

      // ✅ IMPORTANT: Associate the connection with this agent
      const { error: grantError } = await supabase.rpc('grant_agent_integration_permission', {
        p_agent_id: agentId,
        p_connection_id: connectionData.id,
        p_allowed_scopes: defaultScopesForProvider(selectedProvider),
        p_permission_level: 'custom',
        p_user_id: user.id
      });

      if (grantError) {
        console.error('Failed to grant agent permission:', grantError);
        throw new Error(`Connected but failed to associate with agent: ${grantError.message}`);
      }

      // Refresh agent permissions to show the new connection
      await refetchIntegrationPermissions();

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
    
    // For unified Email Relay, check if any email provider is connected
    if (providerName === 'email relay' || providerName === 'email_relay') {
      const emailRelayProviders = ['smtp', 'sendgrid', 'mailgun'];
      const hasEmailPermission = agentPermissions.some(p => 
        emailRelayProviders.includes(p.provider_name) && p.is_active
      );
      if (hasEmailPermission) return 'connected';
      
      const hasEmailCredential = connections.some(c => 
        emailRelayProviders.includes(c.provider_name) && c.connection_status === 'active'
      );
      return hasEmailCredential ? 'available' : 'available';
    }
    
    // For other providers, check normally
    const exists = agentPermissions.some(p => p.provider_name === providerName && p.is_active);
    if (exists) return 'connected';
    const hasCredential = connections.some(c => c.provider_name === providerName && c.connection_status === 'active');
    return hasCredential ? 'available' : 'available';
  };

  const defaultScopesForProvider = (provider: string): string[] => {
    // For Gmail OAuth provider
    if (provider === 'gmail') {
      return ['gmail_send_email','gmail_read_emails','gmail_search_emails','gmail_email_actions'];
    }
    // For unified web search or individual search providers
    if (['serper_api','serpapi','brave_search','web_search'].includes(provider)) {
      return ['web_search','news_search','image_search','local_search'];
    }
    // For email relay providers
    if (['smtp','sendgrid','mailgun','email_relay'].includes(provider)) {
      return ['smtp_send_email','smtp_test_connection'];
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
    // For web search, check all web search provider types
    const isWebSearch = provider === 'web search' || provider === 'web_search' || provider.toLowerCase().includes('web search');
    const webSearchProviders = ['serper_api', 'serpapi', 'brave_search'];
    
    // For email relay, check all email provider types
    const isEmailRelay = provider === 'email relay' || provider === 'email_relay' || provider.toLowerCase().includes('email relay');
    const emailRelayProviders = ['smtp', 'sendgrid', 'mailgun'];
    
    const creds = isWebSearch 
      ? connections.filter(c => webSearchProviders.includes(c.provider_name) && c.connection_status === 'active')
      : isEmailRelay
      ? connections.filter(c => emailRelayProviders.includes(c.provider_name) && c.connection_status === 'active')
      : connections.filter(c => c.provider_name === provider && c.connection_status === 'active');
    
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
                      p_allowed_scopes: defaultScopesForProvider(c.provider_name), // Use actual provider name from connection
                      p_permission_level: 'custom',
                      p_user_id: user?.id // Add user_id to disambiguate function overload
                    });
                    if (grantError) throw grantError;
                    await refetchIntegrationPermissions();
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
          
          {/* Add new connection button */}
          <div className="flex items-center justify-between p-3 border border-dashed border-muted-foreground/30 rounded">
            <div className="text-sm">
              <div className="font-medium text-muted-foreground">Add new connection</div>
              <div className="text-muted-foreground text-xs">Create a new {isWebSearch ? 'web search' : provider} connection</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectingCredentialFor(null);
                setSetupService(provider);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add New
            </Button>
          </div>
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
          
          // Group email relay providers under unified "Email Relay" entry
          const emailRelayProviders = ['smtp', 'sendgrid', 'mailgun'];
          const emailRelayConnections = toolConnections.filter(c => 
            emailRelayProviders.includes(c.provider_name)
          );
          
          const otherConnections = toolConnections.filter(c => 
            !webSearchProviders.includes(c.provider_name) && !emailRelayProviders.includes(c.provider_name)
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
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                    Connected
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500"
                    onClick={async () => {
                      if (!confirm('Remove all Web Search providers from this agent?')) return;
                      try {
                        // Remove all web search provider permissions
                        for (const connection of webSearchConnections) {
                          const { error } = await supabase.rpc('revoke_agent_integration_permission', { 
                            p_permission_id: connection.id 
                          });
                          if (error) throw error;
                        }
                        await refetchIntegrationPermissions();
                        toast.success('Web Search tools removed from agent');
                      } catch (e: any) {
                        console.error('Remove web search error', e);
                        toast.error('Failed to remove Web Search tools');
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          }

          // Add unified Email Relay entry if any email providers are connected
          if (emailRelayConnections.length > 0) {
            const emailRelayIntegration = TOOL_INTEGRATIONS.find(i => i.name.toLowerCase() === 'email relay');
            const EMAIL_PROVIDER_NAMES = {
              'smtp': 'SMTP Server',
              'sendgrid': 'SendGrid',
              'mailgun': 'Mailgun'
            };
            const providerNames = emailRelayConnections.map(c => {
              return EMAIL_PROVIDER_NAMES[c.provider_name as keyof typeof EMAIL_PROVIDER_NAMES] || c.provider_name;
            }).join(', ');

            items.push(
              <div
                key="email_relay_unified"
                className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-medium">Email Relay</h3>
                    <p className="text-sm text-muted-foreground">
                      Using: {providerNames}
                    </p>
                    {renderCapabilitiesBadges(emailRelayIntegration?.id)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                    Connected
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500"
                    onClick={async () => {
                      if (!confirm('Remove all Email Relay providers from this agent?')) return;
                      try {
                        // Remove all email relay provider permissions
                        for (const connection of emailRelayConnections) {
                          const { error } = await supabase.rpc('revoke_agent_integration_permission', { 
                            p_permission_id: connection.id 
                          });
                          if (error) throw error;
                        }
                        await refetchIntegrationPermissions();
                        toast.success('Email Relay tools removed from agent');
                      } catch (e: any) {
                        console.error('Remove email relay error', e);
                        toast.error('Failed to remove Email Relay tools');
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          }

          // Add other (non-web search, non-email relay) connections
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
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                    Connected
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500"
                    onClick={async () => {
                      if (!confirm(`Remove ${matched?.name || connection.provider_name} from this agent?`)) return;
                      try {
                        const { error } = await supabase.rpc('revoke_agent_integration_permission', { 
                          p_permission_id: connection.id 
                        });
                        if (error) throw error;
                        await refetchIntegrationPermissions();
                        toast.success(`${matched?.name || connection.provider_name} removed from agent`);
                      } catch (e: any) {
                        console.error('Remove tool error', e);
                        toast.error(`Failed to remove ${matched?.name || connection.provider_name}`);
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
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

  const renderDigitalOceanSetup = (tool: any) => {
    const handleDigitalOceanSetup = async () => {
      if (!user || !apiKey.trim()) {
        setError('API token is required');
        return;
      }

      setConnectingService('digitalocean');
      setError(null);

      try {
        // Get DigitalOcean OAuth provider
        const { data: providerData, error: providerError } = await supabase
          .from('oauth_providers')
          .select('id')
          .eq('name', 'digitalocean')
          .single();

        if (providerError) throw providerError;

        // Store API key securely in vault
        const vaultService = new VaultService(supabase);
        const secretName = `digitalocean_api_key_${user.id}_${Date.now()}`;
        const vaultKeyId = await vaultService.createSecret(
          secretName,
          apiKey,
          `DigitalOcean API key - Created: ${new Date().toISOString()}`
        );

        console.log(`✅ DigitalOcean API key securely stored in vault: ${vaultKeyId}`);

        // Create connection record
        const { data: connectionData, error: insertError } = await supabase
          .from('user_integration_credentials')
          .insert({
            user_id: user.id,
            oauth_provider_id: providerData.id,
            external_user_id: user.id,
            external_username: connectionName || 'DigitalOcean Connection',
            connection_name: connectionName || 'DigitalOcean Connection',
            encrypted_access_token: null,
            vault_access_token_id: vaultKeyId,
            scopes_granted: ['droplet:read', 'image:read', 'region:read', 'size:read'],
            connection_status: 'active',
            credential_type: 'api_key'
          })
          .select('id')
          .single();

        if (insertError || !connectionData) throw insertError || new Error('Failed to create DigitalOcean connection');

        // ✅ IMPORTANT: Associate the DigitalOcean connection with this agent
        const { error: grantError } = await supabase.rpc('grant_agent_integration_permission', {
          p_agent_id: agentId,
          p_connection_id: connectionData.id,
          p_allowed_scopes: ['droplet:read', 'droplet:create', 'droplet:delete', 'image:read', 'region:read', 'size:read'],
          p_permission_level: 'custom',
          p_user_id: user.id
        });

        if (grantError) {
          console.error('Failed to grant agent permission for DigitalOcean:', grantError);
          throw new Error(`Connected but failed to associate DigitalOcean with agent: ${grantError.message}`);
        }

        // Refresh agent permissions to show the new DigitalOcean connection
        await refetchIntegrationPermissions();

        toast.success('DigitalOcean API key connected successfully! 🎉');
        
        // Reset form and refresh connections
        setApiKey('');
        setConnectionName('');
        setSetupService(null);
        await refetchConnections();
        
        // Switch to connected tab
        setActiveTab('connected');

      } catch (err: any) {
        console.error('Error connecting DigitalOcean API key:', err);
        setError(err.message || 'Failed to connect DigitalOcean API key');
        toast.error('Failed to connect DigitalOcean API key');
      } finally {
        setConnectingService(null);
      }
    };

    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wrench className="h-5 w-5 text-blue-500" />
            <span>DigitalOcean Setup</span>
          </CardTitle>
          <CardDescription>
            Connect your DigitalOcean account to manage droplets and infrastructure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="do_connection_name">
              Connection Name (Optional)
            </Label>
            <Input
              id="do_connection_name"
              value={connectionName}
              onChange={(e) => setConnectionName(e.target.value)}
              placeholder="My DigitalOcean Connection"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="do_api_key">
              DigitalOcean API Token
            </Label>
            <Input
              id="do_api_key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your DigitalOcean API token"
              className="mt-1"
            />
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>Required scopes:</strong> Read access to droplets, images, regions, and sizes</p>
                <p>
                  <Button variant="link" className="p-0 h-auto" asChild>
                    <a 
                      href="https://cloud.digitalocean.com/account/api/tokens" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Get API Token <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                </p>
              </div>
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleDigitalOceanSetup}
            disabled={!apiKey || connectingService === 'digitalocean'}
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white"
          >
            {connectingService === 'digitalocean' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Key className="h-4 w-4 mr-2" />
                Connect DigitalOcean
              </>
            )}
          </Button>
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

            if (isSetupMode && (provider === 'digitalocean' || integration.name.toLowerCase() === 'digitalocean')) {
              // Show API key setup for DigitalOcean integration
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
                  {renderDigitalOceanSetup({ id: 'digitalocean', name: display } as any)}
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
                        // For Web Search integration, check existing connections first
                        if (provider === 'web search' || provider === 'web_search' || integration.name.toLowerCase() === 'web search') {
                          // Check if there are existing web search connections
                          const webSearchProviders = ['serper_api', 'serpapi', 'brave_search'];
                          const existingWebSearchConnections = connections.filter(c => 
                            webSearchProviders.includes(c.provider_name) && c.connection_status === 'active'
                          );
                          
                          if (existingWebSearchConnections.length > 0) {
                            // Show credential selector if existing connections found
                            setSelectingCredentialFor(provider);
                          } else {
                            // Show setup form if no existing connections
                            setSetupService(provider);
                          }
                        } else if (provider === 'digitalocean' || integration.name.toLowerCase() === 'digitalocean') {
                          // For DigitalOcean, check existing connections first
                          const existingDigitalOceanConnections = connections.filter(c => 
                            c.provider_name === 'digitalocean' && c.connection_status === 'active'
                          );
                          
                          if (existingDigitalOceanConnections.length > 0) {
                            // Show credential selector if existing connections found
                            setSelectingCredentialFor(provider);
                          } else {
                            // Show API key setup form for DigitalOcean
                            setSetupService(provider);
                          }
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="connected">Connected Tools</TabsTrigger>
              <TabsTrigger value="zapier">Zapier MCP</TabsTrigger>
              <TabsTrigger value="available">Add New Tool</TabsTrigger>
            </TabsList>
            
            <TabsContent value="connected" className="mt-6">
              <div className="min-h-[300px]">
                {renderConnectedTools()}
              </div>
            </TabsContent>

            <TabsContent value="zapier" className="mt-6">
              <div className="min-h-[300px] space-y-6">
                {zapierConnection ? (
                  // Connected State
                  <>
                    {/* Connection Status */}
                    <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-card">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                          <Zap className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h3 className="font-medium">Zapier MCP Server Connected</h3>
                          <p className="text-sm text-muted-foreground">
                            {zapierToolsCount} tools available
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={zapierConnection.is_active ? "default" : "secondary"}>
                          {zapierConnection.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (!user?.id) return;
                            try {
                              const { ZapierMCPManager } = await import('@/lib/mcp/zapier-mcp-manager');
                              const manager = new ZapierMCPManager(supabase, user.id);
                              await manager.refreshConnectionTools(zapierConnection.id);
                              
                              // Trigger refresh of the tools list component
                              setZapierToolsRefreshKey(prev => prev + 1);
                              
                              toast.success('Tools refreshed successfully');
                            } catch (error) {
                              console.error('Failed to refresh tools:', error);
                              toast.error('Failed to refresh tools');
                            }
                          }}
                          title="Refresh Tools"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (!user?.id || !confirm('Are you sure you want to disconnect from the Zapier MCP server?')) return;
                            try {
                              const { ZapierMCPManager } = await import('@/lib/mcp/zapier-mcp-manager');
                              const manager = new ZapierMCPManager(supabase, user.id);
                              await manager.deleteConnection(zapierConnection.id);
                              
                              setZapierConnection(null);
                              setZapierToolsCount(0);
                              
                              toast.success('Disconnected from Zapier MCP server');
                            } catch (error) {
                              console.error('Failed to disconnect:', error);
                              toast.error('Failed to disconnect');
                            }
                          }}
                          title="Disconnect"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Available Tools */}
                    <ZapierToolsList 
                      key={zapierToolsRefreshKey}
                      agentId={agentId}
                      connectionId={zapierConnection.id}
                      onToolsUpdate={(count) => setZapierToolsCount(count)}
                    />
                  </>
                ) : (
                  // Not Connected State
                  <div className="text-center py-12">
                    <Zap className="w-16 h-16 mx-auto mb-4 text-orange-500" />
                    <h3 className="text-lg font-semibold mb-2">Zapier MCP Server</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Connect this agent to its unique Zapier MCP server to access automation tools and workflows.
                    </p>
                    <Button
                      onClick={() => setShowZapierModal(true)}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Connect MCP Server
                    </Button>
                  </div>
                )}
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

      {/* Zapier MCP Modal */}
      <ZapierMCPModal
        isOpen={showZapierModal}
        onClose={() => {
          setShowZapierModal(false);
          // Refresh connection status when modal closes
          if (agentId && user?.id) {
            setTimeout(async () => {
              try {
                const { ZapierMCPManager } = await import('@/lib/mcp/zapier-mcp-manager');
                const manager = new ZapierMCPManager(supabase, user.id);
                
                const connections = await manager.getAgentConnections(agentId);
                const connection = connections.length > 0 ? connections[0] : null;
                setZapierConnection(connection);
                
                if (connection) {
                  const tools = await manager.getConnectionTools(connection.id);
                  setZapierToolsCount(tools.length);
                } else {
                  setZapierToolsCount(0);
                }
              } catch (error) {
                console.error('Failed to refresh Zapier connection:', error);
              }
            }, 100);
          }
        }}
        agentId={agentId}
        agentData={agentData}
      />
    </Dialog>
  );
}