import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Settings, 
  Mail, 
  ChevronRight, 
  ArrowLeft,
  Shield,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useGmailConnection } from '@/hooks/useGmailIntegration';
import { useIntegrationsByClassification } from '@/hooks/useIntegrations';
import { toast } from 'react-hot-toast';

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

const DEFAULT_GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify'
];

export function AgentIntegrationsManager({ 
  agentId, 
  category = 'channel', 
  title = 'Integrations', 
  description = 'Connect external services to this agent' 
}: AgentIntegrationsManagerProps) {
  const { user } = useAuth();
  const { connections: gmailConnections } = useGmailConnection();
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
  const [selectedScopes, setSelectedScopes] = useState<string[]>(DEFAULT_GMAIL_SCOPES);
  const [editingPermission, setEditingPermission] = useState<AgentPermission | null>(null);
  
  // Data state
  const [permissions, setPermissions] = useState<AgentPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (agentId && user) {
      fetchAgentPermissions();
    }
  }, [agentId, user]);

  const fetchAgentPermissions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_agent_integration_permissions', {
        p_agent_id: agentId
      });

      if (error) throw error;

      const formattedPermissions = data?.map((perm: any) => ({
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
      })) || [];

      setPermissions(formattedPermissions);
    } catch (error) {
      console.error('Error fetching agent permissions:', error);
      toast.error('Failed to load integration permissions');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Show available integrations (only Gmail for now)
  const handleAddIntegration = () => {
    setWorkflowMode('add');
    setShowAddModal(true);
  };

  // Step 2: Show credentials for selected integration
  const handleSelectIntegration = (integration: { id: string; name: string; icon_name?: string }) => {
    setSelectedIntegration(integration);
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
      const { data, error } = await supabase.rpc('grant_agent_integration_permission', {
        p_agent_id: agentId,
        p_connection_id: selectedCredential.id,
        p_allowed_scopes: selectedScopes,
        p_permission_level: 'custom'
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
        p_permission_level: 'custom'
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
    setSelectedScopes(DEFAULT_GMAIL_SCOPES);
    setEditingPermission(null);
    setWorkflowMode('add');
  };

  // Show credentials for existing integration
  const handleViewCredentials = (permission: AgentPermission) => {
    // Find the integration type and set up for viewing
    setWorkflowMode('view');
    setSelectedIntegration({ name: 'Gmail', icon_name: 'Mail' });
    setSelectedCredential(permission.connection);
    setShowViewModal(true);
  };

  // Start editing permissions for existing integration
  const handleModifyPermissions = (permission: AgentPermission) => {
    setWorkflowMode('edit');
    setEditingPermission(permission);
    setSelectedCredential(permission.connection);
    setSelectedScopes(permission.allowed_scopes || DEFAULT_GMAIL_SCOPES);
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

  // Get available integrations for this classification
  const availableIntegrations = integrations.filter(integration => 
    integration.status === 'available' && 
    !permissions.some(perm => perm.connection?.provider_name === integration.name)
  );

  // Filter permissions to only show those that match the current category
  const filteredPermissions = permissions.filter(permission => {
    // Find the integration definition by matching provider name
    const integration = integrations.find(int => 
      int.name.toLowerCase() === permission.connection?.provider_name?.toLowerCase()
    );
    
    // If we found the integration, use its agent_classification
    if (integration) {
      return integration.agent_classification === category;
    }
    
    // If no integration found, default based on provider name patterns
    // Gmail should be a channel, everything else defaults to tool
    const providerName = permission.connection?.provider_name?.toLowerCase();
    if (providerName === 'gmail') {
      return category === 'channel';
    }
    
    return category === 'tool';
  });

  // Get available credentials for selected integration
  const availableCredentials = gmailConnections.filter(
    conn => conn.connection_status === 'active' && 
    !permissions.some(perm => perm.user_oauth_connection_id === conn.id)
  );

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
          {filteredPermissions.length > 0 ? (
            <div className="space-y-3">
              {filteredPermissions.map(permission => (
                <div key={permission.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-background rounded">
                      <Mail className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="font-medium">{permission.connection?.provider_name || 'Integration'}</div>
                      <div className="text-sm text-muted-foreground">
                        {permission.connection?.external_username}
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

      {/* Step 1: Add Integration Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add {category === 'channel' ? 'Channel' : category === 'tool' ? 'Tool' : 'Integration'}</DialogTitle>
            <DialogDescription>
              Choose {category === 'channel' ? 'a channel' : category === 'tool' ? 'a tool' : 'an integration'} to connect to this agent
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto min-h-0 max-h-[calc(85vh-10rem)]">
            <div className="space-y-4 p-1">
              {availableIntegrations.length > 0 ? (
                availableIntegrations.map((integration: { id: string; name: string; description?: string }) => (
                  <div
                    key={integration.id}
                    className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted"
                    onClick={() => handleSelectIntegration(integration)}
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-8 w-8 text-blue-500" />
                      <div>
                        <div className="font-medium">{integration.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {integration.description}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5" />
                  </div>
                ))
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No new integrations available. Gmail is currently the only supported integration.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: Select Credentials Modal */}
      <Dialog open={showCredentialsModal && workflowMode === 'add'} onOpenChange={setShowCredentialsModal}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCredentialsModal(false);
                  setShowAddModal(true);
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              Select Credentials
            </DialogTitle>
            <DialogDescription>
              Choose which {selectedIntegration?.name} account to use
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto min-h-0 max-h-[calc(85vh-10rem)]">
            <div className="space-y-4 p-1">
              {availableCredentials.length > 0 ? (
                availableCredentials.map(credential => (
                  <div
                    key={credential.id}
                    className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted"
                    onClick={() => handleSelectCredential(credential)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-background rounded">
                        <Mail className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <div className="font-medium">{credential.external_username}</div>
                        <div className="text-sm text-muted-foreground">
                          {credential.connection_metadata?.user_name || 'Gmail Account'}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5" />
                  </div>
                ))
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No available credentials. Please connect a Gmail account first in the{' '}
                    <a href="/integrations" className="text-primary hover:underline">
                      Integrations page
                    </a>
                    .
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowCredentialsModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 3: Select Permissions Modal */}
      <Dialog open={showPermissionsModal} onOpenChange={setShowPermissionsModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {workflowMode === 'add' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowPermissionsModal(false);
                    setShowCredentialsModal(true);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {workflowMode === 'edit' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowPermissionsModal(false);
                    setShowViewModal(true);
                    setWorkflowMode('view');
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {workflowMode === 'edit' ? 'Modify Permissions' : 'Set Permissions'}
            </DialogTitle>
            <DialogDescription>
              Choose what this agent can do with {selectedCredential?.external_username}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Allowed Actions</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes('https://www.googleapis.com/auth/gmail.readonly')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedScopes([...selectedScopes, 'https://www.googleapis.com/auth/gmail.readonly']);
                      } else {
                        setSelectedScopes(selectedScopes.filter(s => s !== 'https://www.googleapis.com/auth/gmail.readonly'));
                      }
                    }}
                    className="rounded border-border"
                  />
                  <Mail className="h-4 w-4" />
                  Read emails
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes('https://www.googleapis.com/auth/gmail.send')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedScopes([...selectedScopes, 'https://www.googleapis.com/auth/gmail.send']);
                      } else {
                        setSelectedScopes(selectedScopes.filter(s => s !== 'https://www.googleapis.com/auth/gmail.send'));
                      }
                    }}
                    className="rounded border-border"
                  />
                  <Mail className="h-4 w-4" />
                  Send emails
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes('https://www.googleapis.com/auth/gmail.modify')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedScopes([...selectedScopes, 'https://www.googleapis.com/auth/gmail.modify']);
                      } else {
                        setSelectedScopes(selectedScopes.filter(s => s !== 'https://www.googleapis.com/auth/gmail.modify'));
                      }
                    }}
                    className="rounded border-border"
                  />
                  <Settings className="h-4 w-4" />
                  Modify emails (archive, labels, etc.)
                </label>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermissionsModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={workflowMode === 'edit' ? handleUpdatePermission : handleGrantPermission} 
              disabled={selectedScopes.length === 0 || saving}
            >
              {saving ? (workflowMode === 'edit' ? 'Updating...' : 'Adding...') : (workflowMode === 'edit' ? 'Update Permissions' : `Add ${category === 'channel' ? 'Channel' : category === 'tool' ? 'Tool' : 'Integration'}`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Detail Modal (for existing integrations) */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              Gmail Integration
            </DialogTitle>
            <DialogDescription>
              Account: {selectedCredential?.external_username}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">Current Permissions</span>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                {(() => {
                  const permission = permissions.find(p => p.connection?.external_username === selectedCredential?.external_username);
                  const scopes = permission?.allowed_scopes || [];
                  
                  return (
                    <>
                      {scopes.includes('https://www.googleapis.com/auth/gmail.readonly') && (
                        <div>• Read emails</div>
                      )}
                      {scopes.includes('https://www.googleapis.com/auth/gmail.send') && (
                        <div>• Send emails</div>
                      )}
                      {scopes.includes('https://www.googleapis.com/auth/gmail.modify') && (
                        <div>• Modify emails (archive, labels, etc.)</div>
                      )}
                      {scopes.length === 0 && (
                        <div>• No permissions granted</div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                const permission = permissions.find(p => p.connection?.external_username === selectedCredential?.external_username);
                if (permission) {
                  handleRevokePermission(permission.id);
                  setShowViewModal(false);
                }
              }}
            >
              Remove {category === 'channel' ? 'Channel' : category === 'tool' ? 'Tool' : 'Integration'}
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                const permission = permissions.find(p => p.connection?.external_username === selectedCredential?.external_username);
                if (permission) {
                  handleModifyPermissions(permission);
                }
              }}
            >
              Modify Permissions
            </Button>
            <Button onClick={() => setShowViewModal(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 