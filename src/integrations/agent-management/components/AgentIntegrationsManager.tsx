import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Settings, 
  Mail, 
  ChevronRight, 
  Search
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useConnections, useIntegrationsByClassification, getAgentIntegrationPermissions } from '@/integrations/_shared';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { toast } from 'react-hot-toast';
import {
  createPipedreamMcpConnection,
  syncPipedreamAccounts,
  type PipedreamAccount,
} from '@/integrations/pipedream';
import {
  AddIntegrationModal,
  CredentialsDetailModal,
  PermissionsModal,
  SelectCredentialsModal,
} from './AgentIntegrationsManagerModals';

interface AgentPermission {
  id: string;
  agent_id: string;
  user_oauth_connection_id: string;
  allowed_scopes: string[];
  permission_level: string;
  is_active: boolean;
  connection?: {
    connection_name: string;
    external_username: string;
    provider_name: string;
  };
}

interface AgentIntegrationsManagerProps {
  agentId: string;
  category?: 'tool' | 'channel';
  title?: string;
  description?: string;
}

const DEFAULT_SEARCH_API_SCOPES = [
  'web_search',
  'news_search', 
  'image_search',
  'local_search'
];

export function AgentIntegrationsManager({ 
  agentId, 
  category = 'channel', 
  title = 'Integrations', 
  description = 'Connect external services to this agent' 
}: AgentIntegrationsManagerProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const { connections: unifiedConnections } = useConnections({ includeRevoked: false });
  const { integrations } = useIntegrationsByClassification(category as 'tool' | 'channel');
  
  // State for modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  
  // State for workflow
  const [workflowMode, setWorkflowMode] = useState<'add' | 'view' | 'edit'>('add');
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const [selectedCredential, setSelectedCredential] = useState<any>(null);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [editingPermission, setEditingPermission] = useState<AgentPermission | null>(null);
  const [capabilities, setCapabilities] = useState<Record<string, { capability_key: string; display_label: string; display_order: number }[]>>({});
  
  // Data state
  const [permissions, setPermissions] = useState<AgentPermission[]>([]);
  const [pipedreamAccounts, setPipedreamAccounts] = useState<PipedreamAccount[]>([]);
  const [pipedreamConnections, setPipedreamConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (agentId && user) {
      fetchAgentPermissions();
      fetchPipedreamAgentState();
    }
  }, [agentId, user, unifiedConnections]);

  useEffect(() => {
    if (category === 'tool' && user?.id) {
      syncPipedreamAccounts(supabase)
        .then(setPipedreamAccounts)
        .catch((error) => console.warn('Pipedream account sync skipped', error));
    }
  }, [category, supabase, user?.id]);

  useEffect(() => {
    // Load capability catalog for current classification integrations
    (async () => {
      try {
        if (!integrations || integrations.length === 0) return;
        const ids = integrations.map(i => i.id);
        const { data } = await supabase
          .from('integration_capabilities')
          .select('integration_id, capability_key, display_label, display_order')
          .in('integration_id', ids)
          .order('display_order');
        const map: Record<string, any[]> = {};
        (data || []).forEach((row: any) => {
          if (!map[row.integration_id]) map[row.integration_id] = [];
          map[row.integration_id].push({ capability_key: row.capability_key, display_label: row.display_label, display_order: row.display_order });
        });
        setCapabilities(map);
      } catch (e) {
        console.warn('Capabilities load skipped', e);
      }
    })();
  }, [integrations, supabase]);

  const fetchAgentPermissions = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      // Use the new helper function instead of RPC
      const data = await getAgentIntegrationPermissions(agentId, user.id);

      const formattedPermissions = data.map((perm: any) => ({
        id: perm.permission_id,
        agent_id: perm.agent_id,
        user_oauth_connection_id: perm.connection_id,
        allowed_scopes: perm.allowed_scopes || [],
        permission_level: perm.permission_level,
        is_active: perm.is_active,
        connection: {
          connection_name: perm.connection_name,
          external_username: perm.external_username,
          provider_name: perm.provider_name
        },
        integration_name: perm.integration_name || perm.provider_name || 'Unknown'
      }));

      setPermissions(formattedPermissions);
    } catch (error) {
      console.error('Error fetching agent permissions:', error);
      toast.error('Failed to load integration permissions');
    } finally {
      setLoading(false);
    }
  };

  const fetchPipedreamAgentState = async () => {
    if (category !== 'tool') return;

    const { data, error } = await supabase
      .from('agent_mcp_connections')
      .select('id, connection_name, auth_config, is_active, mcp_tools_cache(count)')
      .eq('agent_id', agentId)
      .eq('connection_type', 'pipedream')
      .order('connection_name');

    if (error) {
      console.warn('Failed to load Pipedream MCP connections', error);
      return;
    }

    setPipedreamConnections(data || []);
  };

  // Step 1: Show available integrations (only Gmail for now)
  const handleAddIntegration = () => {
    setWorkflowMode('add');
    setShowAddModal(true);
  };

  // Step 2: Show credentials for selected integration
  const handleSelectIntegration = (integration: { id: string; name: string; icon_name?: string }) => {
    setSelectedIntegration(integration);
    
    // Set default scopes based on integration type
    const integrationId = integration.id || integration.name.toLowerCase();
    const defaultScopes = integrationId.includes('pipedream') ? ['pipedream_mcp'] :
                         (integrationId.includes('serper') || 
                          integrationId.includes('serpapi') || 
                          integrationId.includes('brave') || 
                          integrationId.includes('search')) ? DEFAULT_SEARCH_API_SCOPES :
                         [];
    
    setSelectedScopes(defaultScopes);
    setShowAddModal(false);
    setShowCredentialsModal(true);
  };

  // Step 3: Show permissions for selected credential
  const handleSelectCredential = (credential: any) => {
    setSelectedCredential(credential);
    setShowCredentialsModal(false);
    setShowPermissionsModal(true);
  };

  // Final step: Grant permission
  const handleGrantPermission = async () => {
    if (!selectedCredential || selectedScopes.length === 0) {
      toast.error('Please select at least one permission');
      return;
    }

    try {
      setSaving(true);
      if (selectedCredential.provider_name === 'pipedream') {
        await createPipedreamMcpConnection(supabase, {
          agentId,
          appSlug: selectedCredential.app_slug,
          accountId: selectedCredential.id,
          connectionName: `${selectedCredential.provider_display_name} via Pipedream`,
        });
        toast.success('Pipedream MCP tools assigned successfully');
        resetModals();
        fetchPipedreamAgentState();
        return;
      }

      const { data, error } = await supabase.rpc('grant_agent_integration_permission', {
        p_agent_id: agentId,
        p_connection_id: selectedCredential.id,
        p_allowed_scopes: selectedScopes,
        p_permission_level: 'custom',
        p_user_id: user?.id
      });

      if (error) throw error;

      toast.success(`${category === 'channel' ? 'Channel' : category === 'tool' ? 'Tool' : 'Integration'} added successfully`);
      resetModals();
      fetchAgentPermissions();
    } catch (error) {
      console.error('Error granting permission:', error);
      toast.error(`Failed to add ${category === 'channel' ? 'channel' : category === 'tool' ? 'tool' : 'integration'}`);
    } finally {
      setSaving(false);
    }
  };

  // Update existing permission
  const handleUpdatePermission = async () => {
    if (!editingPermission || selectedScopes.length === 0) {
      toast.error('Please select at least one permission');
      return;
    }

    try {
      setSaving(true);
      // Use the existing grant function which handles updates via ON CONFLICT
      const { data, error } = await supabase.rpc('grant_agent_integration_permission', {
        p_agent_id: agentId,
        p_connection_id: editingPermission.user_oauth_connection_id,
        p_allowed_scopes: selectedScopes,
        p_permission_level: 'custom',
        p_user_id: user?.id
      });

      if (error) throw error;

      toast.success('Permissions updated successfully');
      resetModals();
      fetchAgentPermissions();
    } catch (error) {
      console.error('Error updating permission:', error);
      toast.error('Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const resetModals = () => {
    setShowAddModal(false);
    setShowCredentialsModal(false);
    setShowPermissionsModal(false);
    setShowViewModal(false);
    setSelectedIntegration(null);
    setSelectedCredential(null);
    setSelectedScopes([]);
    setEditingPermission(null);
    setWorkflowMode('add');
  };

  // Show credentials for existing integration
  const handleViewCredentials = (permission: AgentPermission) => {
    // Find the integration type and set up for viewing
    setWorkflowMode('view');
    const providerName = permission.connection?.provider_name || 'Integration';
    const iconName = providerName.toLowerCase().includes('search') ? 'Search' : 'Settings';
    setSelectedIntegration({ name: providerName, icon_name: iconName });
    setSelectedCredential(permission.connection);
    setShowViewModal(true);
  };

  // Start editing permissions for existing integration
  const handleModifyPermissions = (permission: AgentPermission) => {
    setWorkflowMode('edit');
    setEditingPermission(permission);
    setSelectedCredential(permission.connection);
    
    // Set default scopes based on provider type if no existing scopes
    const providerName = permission.connection?.provider_name?.toLowerCase();
    const defaultScopes = (providerName?.includes('search') || 
                          providerName?.includes('serper') || 
                          providerName?.includes('serpapi') || 
                          providerName?.includes('brave')) ? DEFAULT_SEARCH_API_SCOPES : [];
    
    setSelectedScopes(permission.allowed_scopes || defaultScopes);
    setShowViewModal(false);
    setShowPermissionsModal(true);
  };

  const handleRevokePermission = async (permissionId: string) => {
    try {
      const { error } = await supabase.rpc('revoke_agent_integration_permission', {
        p_permission_id: permissionId
      });

      if (error) throw error;
      toast.success(`${category === 'channel' ? 'Channel' : category === 'tool' ? 'Tool' : 'Integration'} removed`);
      fetchAgentPermissions();
    } catch (error) {
      console.error('Error revoking permission:', error);
      toast.error(`Failed to remove ${category === 'channel' ? 'channel' : category === 'tool' ? 'tool' : 'integration'}`);
    }
  };

  const handleRemovePipedreamConnection = async (connectionId: string) => {
    const { error } = await supabase
      .from('agent_mcp_connections')
      .delete()
      .eq('id', connectionId);

    if (error) {
      toast.error('Failed to remove Pipedream MCP tools');
      return;
    }

    toast.success('Pipedream MCP tools removed');
    fetchPipedreamAgentState();
  };

  // Get available integrations for this classification
  const availableIntegrations = integrations.filter(integration => 
    integration.status === 'available' && 
    !permissions.some(perm => perm.connection?.provider_name === integration.name)
  );

  // Filter permissions to only show those that match the current category
  const filteredPermissions = permissions.filter(permission => {
    const providerName = permission.connection?.provider_name?.toLowerCase();
    
    // Find the integration definition by matching provider name
    // Try multiple matching strategies to handle naming inconsistencies
    const integration = integrations.find(int => {
      const intName = int.name.toLowerCase();
      // Direct match
      if (intName === providerName) return true;
      // Search provider matching
      if ((providerName?.includes('search') || providerName?.includes('serper') || providerName?.includes('serpapi') || providerName?.includes('brave')) &&
          (intName.includes('search') || intName.includes('web'))) return true;
      return false;
    });
    
    // If we found the integration, use its agent_classification
    if (integration) {
      return integration.agent_classification === category;
    }
    
    // If no integration found, default based on provider name patterns
    if (providerName?.includes('search') || 
        providerName?.includes('serper') || 
        providerName?.includes('serpapi') || 
        providerName?.includes('brave') ||
        providerName === 'web search') {
      return category === 'tool';
    }
    
    // Default: if we don't know what it is, show it in tools
    return category === 'tool';
  });

  // Get available credentials for selected integration
  const getAvailableCredentials = () => {
    if (!selectedIntegration) return [];
    
    const integrationId = selectedIntegration.id || selectedIntegration.name?.toLowerCase();
    if (integrationId === 'pipedream' || selectedIntegration.name?.toLowerCase() === 'pipedream') {
      return pipedreamAccounts
        .filter((account) => account.healthy && !account.dead)
        .filter((account) => !pipedreamConnections.some((connection) =>
          connection.auth_config?.account_id === account.account_id &&
          connection.auth_config?.app_slug === account.app_slug
        ))
        .map((account) => ({
          id: account.account_id,
          external_username: account.account_name || account.account_id,
          provider_display_name: account.app_name,
          provider_name: 'pipedream',
          app_slug: account.app_slug,
          connection_metadata: {},
        }));
    }

    // Centralized: unify from useConnections
    const providerMap: Record<string, string | null> = {
      'serper-api': 'serper_api',
      'serper api': 'serper_api',
      'serpapi': 'serpapi',
      'brave-search-api': 'brave_search',
      'brave search api': 'brave_search',
      'web-search': null,
      'web search': null,
    }
    const provider = providerMap[integrationId as keyof typeof providerMap]
    return unifiedConnections
      .filter(c => c.connection_status === 'active' && (!provider || c.provider_name === provider))
      .filter(c => !permissions.some(perm => perm.user_oauth_connection_id === c.connection_id))
      .map(c => ({
        id: c.connection_id,
        external_username: c.external_username || c.connection_name || `${c.provider_display_name} Connection`,
        provider_display_name: c.provider_display_name,
        provider_name: c.provider_name,
        connection_metadata: {},
      }))
  };
  
  const availableCredentials = getAvailableCredentials();

  // Helper function to get the appropriate icon for each integration type
  const getIntegrationIcon = (providerName?: string) => {
    const provider = providerName?.toLowerCase();
    switch (provider) {
      case 'serper api':
      case 'serpapi':
      case 'brave search api':
      case 'web search':
      case 'websearch':
        return <Search className="h-5 w-5 text-green-500" />;
      case 'pipedream':
        return <Settings className="h-5 w-5 text-purple-500" />;
      default:
        return <Settings className="h-5 w-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading integrations...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleAddIntegration}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add {category === 'channel' ? 'Channel' : category === 'tool' ? 'Tool' : 'Integration'}
          </Button>
        </CardHeader>
        <CardContent>
          {filteredPermissions.length > 0 || pipedreamConnections.length > 0 ? (
            <div className="space-y-3">
              {pipedreamConnections.map((connection) => (
                <div key={connection.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-background rounded">
                      <Settings className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <div className="font-medium">{connection.connection_name}</div>
                      <div className="text-sm text-muted-foreground">
                        Pipedream MCP · {connection.auth_config?.app_slug || 'app'} · {connection.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={connection.is_active ? "default" : "secondary"}>
                      {connection.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePipedreamConnection(connection.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              {filteredPermissions.map(permission => (
                <div key={permission.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-background rounded">
                      {getIntegrationIcon(permission.connection?.provider_name)}
                    </div>
                    <div>
                      <div className="font-medium">
                        {(() => {
                          const providerName = permission.connection?.provider_name || permission.integration_name || 'Integration';
                          // Capitalize provider names for better display
                          if (providerName.toLowerCase() === 'slack') return 'Slack';
                          if (providerName.toLowerCase() === 'discord') return 'Discord';
                          if (providerName.toLowerCase().includes('serper')) return 'Serper API';
                          if (providerName.toLowerCase().includes('serpapi')) return 'SerpAPI';
                          if (providerName.toLowerCase().includes('brave')) return 'Brave Search';
                          return providerName;
                        })()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {permission.connection?.external_username || permission.connection?.connection_name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={permission.is_active ? "default" : "secondary"}>
                      {permission.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewCredentials(permission)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Settings className="h-10 w-10 mx-auto opacity-50 mb-2" />
              <p>No {category === 'channel' ? 'channels' : category === 'tool' ? 'tools' : 'integrations'} connected</p>
              <p className="text-xs mt-1">Add {category === 'channel' ? 'a channel' : category === 'tool' ? 'a tool' : 'an integration'} to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AddIntegrationModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        category={category}
        availableIntegrations={availableIntegrations}
        capabilities={capabilities}
        onSelectIntegration={handleSelectIntegration}
      />

      <SelectCredentialsModal
        open={showCredentialsModal && workflowMode === 'add'}
        onOpenChange={setShowCredentialsModal}
        selectedIntegration={selectedIntegration}
        availableCredentials={availableCredentials}
        onSelectCredential={handleSelectCredential}
        getIntegrationIcon={getIntegrationIcon}
        onBack={() => {
          setShowCredentialsModal(false);
          setShowAddModal(true);
        }}
      />

      <PermissionsModal
        open={showPermissionsModal}
        onOpenChange={setShowPermissionsModal}
        workflowMode={workflowMode}
        selectedIntegration={selectedIntegration}
        selectedCredential={selectedCredential}
        selectedScopes={selectedScopes}
        setSelectedScopes={setSelectedScopes}
        saving={saving}
        category={category}
        onBackFromAdd={() => {
          setShowPermissionsModal(false);
          setShowCredentialsModal(true);
        }}
        onBackFromEdit={() => {
          setShowPermissionsModal(false);
          setShowViewModal(true);
          setWorkflowMode('view');
        }}
        onSubmit={workflowMode === 'edit' ? handleUpdatePermission : handleGrantPermission}
      />

      <CredentialsDetailModal
        open={showViewModal}
        onOpenChange={setShowViewModal}
        category={category}
        selectedIntegration={selectedIntegration}
        selectedCredential={selectedCredential}
        permissions={permissions}
        getIntegrationIcon={getIntegrationIcon}
        onRevokePermission={handleRevokePermission}
        onModifyPermissions={handleModifyPermissions}
      />
    </>
  );
} 