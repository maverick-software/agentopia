import React, { useState, useEffect } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  Check, 
  AlertCircle,
  ExternalLink,
  Plus,
  Zap,
  Settings,
  Trash2,
  RefreshCw,
  TestTube,
  Globe,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { ZapierMCPManager, AgentMCPConnection, ZapierMCPConnectionTest } from '@/lib/mcp/zapier-mcp-manager';
import { toast } from 'react-hot-toast';

interface ZapierMCPModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
  };
}

export function ZapierMCPModal({
  isOpen,
  onClose,
  agentId,
  agentData
}: ZapierMCPModalProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  
  // State
  const [activeTab, setActiveTab] = useState('connections');
  const [connections, setConnections] = useState<AgentMCPConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [connectionName, setConnectionName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [testResult, setTestResult] = useState<ZapierMCPConnectionTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Manager instance
  const [manager, setManager] = useState<ZapierMCPManager | null>(null);

  // Initialize manager
  useEffect(() => {
    if (user?.id) {
      setManager(new ZapierMCPManager(supabase, user.id));
    }
  }, [user?.id, supabase]);

  // Load connections
  useEffect(() => {
    if (isOpen && manager && agentId) {
      loadConnections();
    }
  }, [isOpen, manager, agentId]);

  const loadConnections = async () => {
    if (!manager) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await manager.getAgentConnections(agentId);
      setConnections(data);
    } catch (err) {
      console.error('Failed to load MCP connections:', err);
      setError(err instanceof Error ? err.message : 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!manager || !serverUrl.trim()) return;
    
    setTesting(true);
    setTestResult(null);
    
    try {
      const result = await manager.testConnection(serverUrl.trim());
      setTestResult(result);
      
      if (result.success) {
        toast.success(`Connection successful! Found ${result.toolCount} tools.`);
      } else {
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch (err) {
      console.error('Connection test failed:', err);
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Test failed'
      });
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!manager || !connectionName.trim() || !serverUrl.trim()) return;
    
    setSaving(true);
    
    try {
      await manager.createConnection(
        agentId,
        connectionName.trim(),
        serverUrl.trim()
      );
      
      toast.success('Zapier MCP connection created successfully!');
      
      // Reset form
      setConnectionName('');
      setServerUrl('');
      setTestResult(null);
      setShowAddForm(false);
      
      // Reload connections
      await loadConnections();
    } catch (err) {
      console.error('Failed to save connection:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save connection');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!manager) return;
    
    if (!confirm('Are you sure you want to delete this connection? This will remove all associated tools.')) {
      return;
    }
    
    try {
      await manager.deleteConnection(connectionId);
      toast.success('Connection deleted successfully');
      await loadConnections();
    } catch (err) {
      console.error('Failed to delete connection:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete connection');
    }
  };

  const handleRefreshTools = async (connectionId: string) => {
    if (!manager) return;
    
    try {
      await manager.refreshConnectionTools(connectionId);
      toast.success('Tools refreshed successfully');
      await loadConnections();
    } catch (err) {
      console.error('Failed to refresh tools:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to refresh tools');
    }
  };

  const handleToggleConnection = async (connectionId: string, isActive: boolean) => {
    if (!manager) return;
    
    try {
      await manager.updateConnection(connectionId, { is_active: !isActive });
      toast.success(`Connection ${!isActive ? 'activated' : 'deactivated'}`);
      await loadConnections();
    } catch (err) {
      console.error('Failed to toggle connection:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update connection');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-500" />
            Zapier MCP Connections
          </DialogTitle>
          <DialogDescription>
            Connect {agentData?.name || 'this agent'} to Zapier MCP servers to access automation tools.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="tools">Available Tools</TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Add Connection Form */}
            {showAddForm && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Add Zapier MCP Connection</CardTitle>
                  <CardDescription>
                    Enter your unique Zapier MCP server URL to connect and discover available tools.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="connectionName">Connection Name</Label>
                    <Input
                      id="connectionName"
                      placeholder="My Zapier Connection"
                      value={connectionName}
                      onChange={(e) => setConnectionName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="serverUrl">MCP Server URL</Label>
                    <Input
                      id="serverUrl"
                      placeholder="https://your-zapier-mcp-server.com/mcp"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                    />
                  </div>

                  {/* Test Connection */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={!serverUrl.trim() || testing}
                    >
                      {testing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <TestTube className="w-4 h-4 mr-2" />
                          Test Connection
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Test Result */}
                  {testResult && (
                    <Alert variant={testResult.success ? "default" : "destructive"}>
                      {testResult.success ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <AlertDescription>
                        {testResult.success ? (
                          <>
                            Connection successful! Found {testResult.toolCount} tools.
                            {testResult.tools && testResult.tools.length > 0 && (
                              <div className="mt-2">
                                <p className="text-sm font-medium">Sample tools:</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {testResult.tools.slice(0, 3).map((tool, index) => (
                                    <Badge key={index} variant="secondary" className="text-xs">
                                      {tool.name}
                                    </Badge>
                                  ))}
                                  {testResult.tools.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{testResult.tools.length - 3} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          `Connection failed: ${testResult.error}`
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleSaveConnection}
                      disabled={!connectionName.trim() || !serverUrl.trim() || !testResult?.success || saving}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Save Connection
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddForm(false);
                        setConnectionName('');
                        setServerUrl('');
                        setTestResult(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Add Connection Button */}
            {!showAddForm && (
              <Button
                onClick={() => setShowAddForm(true)}
                className="w-full"
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Zapier MCP Connection
              </Button>
            )}

            {/* Connections List */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2">Loading connections...</span>
              </div>
            ) : connections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No Zapier MCP connections configured.</p>
                <p className="text-sm">Add a connection to get started with Zapier automation tools.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {connections.map((connection) => (
                  <Card key={connection.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium">{connection.connection_name}</h3>
                            <Badge variant={connection.is_active ? "default" : "secondary"}>
                              {connection.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {connection.server_url}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Created: {new Date(connection.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRefreshTools(connection.id)}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleConnection(connection.id, connection.is_active)}
                          >
                            {connection.is_active ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteConnection(connection.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
            <div className="text-center py-8 text-muted-foreground">
              <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Tool discovery and management coming soon.</p>
              <p className="text-sm">Tools will be automatically discovered from your active connections.</p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
