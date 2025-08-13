import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useConnections } from '@/hooks/useConnections';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, RefreshCw, Trash2, CheckCircle, AlertCircle, Shield, Key, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

// Using centralized service types via hook; keep a minimal view model here if needed
interface OAuthConnection {
  connection_id: string;
  provider_name: string;
  provider_display_name: string;
  external_username: string | null;
  connection_name: string | null;
  scopes_granted: string[];
  connection_status: string;
  credential_type: string;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RefreshStatus {
  [connectionId: string]: {
    isRefreshing: boolean;
    success: boolean;
    message: string;
    newExpiryDate?: string;
    needsReconnection?: boolean;
  };
}

export function CredentialsPage() {
  const { user } = useAuth();
  const { connections: unifiedConnections, loading: loadingUnified, revoke: revokeUnified, refetch } = useConnections({ includeRevoked: false });
  const [connections, setConnections] = useState<OAuthConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>({});

  useEffect(() => {
    if (user) {
      fetchConnections();
    }
  }, [user]);

  const fetchConnections = async () => {
    if (!user) return;

    try {
      // Use authoritative RPC only to avoid stale overwrite from hook state
      const { data, error } = await supabase.rpc('get_user_oauth_connections', { p_user_id: user.id });
      if (error) throw error;
      const mapped = (data || []).map((row: any) => ({
        connection_id: row.connection_id,
        provider_name: row.provider_name || row.oauth_providers?.name,
        provider_display_name: row.provider_display_name || row.oauth_providers?.display_name,
        external_username: row.external_username ?? null,
        connection_name: row.connection_name ?? null,
        scopes_granted: row.scopes_granted || [],
        connection_status: row.connection_status,
        credential_type: row.credential_type,
        token_expires_at: row.token_expires_at ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
      setConnections(mapped);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshToken = async (connectionId: string) => {
    try {
      // Set refreshing state
      setRefreshStatus(prev => ({
        ...prev,
        [connectionId]: {
          isRefreshing: true,
          success: false,
          message: 'Refreshing token...'
        }
      }));

      console.log('Starting token refresh for connection:', connectionId);
      
      // Find the connection details
      const connection = connections.find(c => c.connection_id === connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      console.log('Refreshing token for:', connection.provider_name);

      // Use the dedicated oauth-refresh function
      const { data, error } = await supabase.functions.invoke('oauth-refresh', {
        body: {
          connection_id: connectionId
        }
      });

      if (error) {
        console.error('OAuth refresh error:', error);
        throw error;
      }

      console.log('Token refresh response:', data);

      // Set success state with expiry info
      const expiryDate = data?.expires_at ? new Date(data.expires_at) : null;
      setRefreshStatus(prev => ({
        ...prev,
        [connectionId]: {
          isRefreshing: false,
          success: true,
          message: 'Success!',
          newExpiryDate: expiryDate?.toISOString()
        }
      }));

      // Refresh the unified hook and then our local list for immediate UI consistency
      await refetch();
      await fetchConnections();
      
      // Clear success state after 3 seconds
      setTimeout(() => {
        setRefreshStatus(prev => ({
          ...prev,
          [connectionId]: {
            isRefreshing: false,
            success: false,
            message: ''
          }
        }));
      }, 3000);

    } catch (error) {
      console.error('Error refreshing token:', error);
      
      // Parse the error to provide user-friendly messages
      let userFriendlyMessage = 'Unable to refresh token. Please try again.';
      let isExpiredToken = false;
      
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as Error).message.toLowerCase();
        
        // Check for expired token scenarios
        if (errorMessage.includes('expired') || 
            errorMessage.includes('revoked') || 
            errorMessage.includes('invalid_grant') ||
            errorMessage.includes('needs to be renewed')) {
          userFriendlyMessage = 'Your connection has expired and needs to be renewed. Please disconnect and reconnect your account.';
          isExpiredToken = true;
        } else if (errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
          userFriendlyMessage = 'Permission denied. Please reconnect your account with the required permissions.';
          isExpiredToken = true;
        } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
          userFriendlyMessage = 'Network error. Please check your connection and try again.';
        }
      }
      
      // Set error state with user-friendly message
      setRefreshStatus(prev => ({
        ...prev,
        [connectionId]: {
          isRefreshing: false,
          success: false,
          message: userFriendlyMessage,
          needsReconnection: isExpiredToken
        }
      }));

      // Clear error state after longer time for expired tokens (so users can read the message)
      const clearTimeout = isExpiredToken ? 10000 : 5000; // 10 seconds for expired tokens
      setTimeout(() => {
        setRefreshStatus(prev => ({
          ...prev,
          [connectionId]: {
            isRefreshing: false,
            success: false,
            message: '',
            needsReconnection: false
          }
        }));
      }, clearTimeout);
    }
  };

  const handleRevokeConnection = async (connectionId: string) => {
    try {
      await revokeUnified(connectionId)
      // Remove immediately from local state for responsive UX
      setConnections(prev => prev.filter(c => c.connection_id !== connectionId))
    } catch (error) {
      console.error('Error:', error);
      // As a fallback, refetch from server
      await refetch()
      await fetchConnections()
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'expired':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'revoked':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-muted-foreground border-gray-500/20';
    }
  };

  const getProviderIcon = (providerName: string) => {
    // You can expand this to return different icons for different providers
    switch (providerName.toLowerCase()) {
      case 'gmail':
        return '📧';
      case 'github':
        return '🐙';
      case 'slack':
        return '💬';
      default:
        return '🔗';
    }
  };

  const isTokenExpired = (expiresAt: string | null): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) <= new Date();
  };

  const getTokenExpiryColor = (expiresAt: string | null, refreshStatus?: any): string => {
    if (refreshStatus?.success) return 'text-green-400';
    if (!expiresAt) return 'text-muted-foreground';
    return isTokenExpired(expiresAt) ? 'text-red-400' : 'text-green-400';
  };

  const formatExpiryDate = (expiresAt: string | null, refreshStatus?: any): string => {
    // Show new expiry if refresh was successful and we have the new date
    const dateToFormat = refreshStatus?.newExpiryDate || expiresAt;
    
    if (!dateToFormat) return 'No expiry information';
    
    const date = new Date(dateToFormat);
    const now = new Date();
    
    if (date <= now) {
      return `Expired ${date.toLocaleString()}`;
    } else {
      return `Expires ${date.toLocaleString()}`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Credentials</h1>
        <p className="text-muted-foreground">
          Manage your OAuth connections and API credentials stored securely in the vault.
        </p>
      </div>

      <div className="grid gap-4">
        {connections.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                No credentials found. Connect to services from the Integrations page.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => window.location.href = '/integrations'}
              >
                Go to Integrations
              </Button>
            </CardContent>
          </Card>
        ) : (
          connections.map((connection) => (
            <Card key={connection.connection_id} className="bg-card border-border">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">{getProviderIcon(connection.provider_name)}</div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <CardTitle className="text-foreground">
                          {connection.provider_display_name}
                        </CardTitle>
                        <Badge 
                          variant="outline"
                          className={`text-xs ${
                            connection.credential_type === 'oauth'
                              ? 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300'
                              : 'border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-300'
                          }`}
                        >
                          {connection.credential_type === 'oauth' ? 'OAuth' : 'API Key'}
                        </Badge>
                      </div>
                      <CardDescription className="text-muted-foreground">
                        {connection.external_username || connection.connection_name || 'Connected Account'}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={getStatusColor(connection.connection_status)}
                  >
                    {connection.connection_status === 'expired' ? 'Expired - Reconnect Needed' : 
                     connection.connection_status === 'revoked' ? 'Revoked' :
                     connection.connection_status === 'active' ? 'Active' : 
                     connection.connection_status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Scopes:</span>
                    <span className="text-foreground">
                      {connection.scopes_granted.length} permissions granted
                    </span>
                  </div>
                  
                  {connection.credential_type === 'oauth' && connection.token_expires_at && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Token expires:</span>
                      <span className={getTokenExpiryColor(connection.token_expires_at, refreshStatus[connection.connection_id])}>
                        {formatExpiryDate(connection.token_expires_at, refreshStatus[connection.connection_id])}
                      </span>
                    </div>
                  )}
                  
                  {connection.credential_type === 'api_key' && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">API Key:</span>
                      <span className="text-foreground">Long-lived credential (no expiry)</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-2 text-sm">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Connected:</span>
                    <span className="text-foreground">
                      {format(new Date(connection.created_at), 'PP')}
                    </span>
                  </div>
                </div>

                {/* Show expired connection guidance */}
                {connection.connection_status === 'expired' && (
                  <div className="mt-2 p-3 bg-amber-900/20 border border-amber-500/30 rounded-md text-sm">
                    <div className="flex items-start gap-2 text-amber-300">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium mb-1">Connection Expired</div>
                        <div className="text-xs opacity-90 mb-2">
                          This connection has expired and needs to be renewed. This typically happens when tokens are unused for more than 7 days.
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                            onClick={() => handleRevokeConnection(connection.connection_id)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Disconnect
                          </Button>
                          <span className="text-xs opacity-70 self-center">
                            Then reconnect to restore access
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2 pt-2">
                  {connection.connection_status === 'active' && connection.credential_type === 'oauth' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRefreshToken(connection.connection_id)}
                      disabled={refreshStatus[connection.connection_id]?.isRefreshing}
                      className={`text-foreground hover:text-white ${
                        refreshStatus[connection.connection_id]?.success 
                          ? 'border-green-500 text-green-400' 
                          : refreshStatus[connection.connection_id]?.message && !refreshStatus[connection.connection_id]?.isRefreshing
                          ? 'border-red-500 text-red-400'
                          : ''
                      }`}
                    >
                      {refreshStatus[connection.connection_id]?.success ? (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      ) : refreshStatus[connection.connection_id]?.isRefreshing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : refreshStatus[connection.connection_id]?.message && !refreshStatus[connection.connection_id]?.isRefreshing ? (
                        <AlertCircle className="h-4 w-4 mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      {refreshStatus[connection.connection_id]?.success 
                        ? 'Success!' 
                        : refreshStatus[connection.connection_id]?.isRefreshing 
                        ? 'Refreshing...'
                        : refreshStatus[connection.connection_id]?.message && !refreshStatus[connection.connection_id]?.isRefreshing
                        ? 'Error'
                        : 'Refresh Token'
                      }
                    </Button>
                  )}
                  {connection.connection_status === 'active' && connection.credential_type === 'api_key' && (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Key className="h-4 w-4" />
                      <span>API Key Active</span>
                    </div>
                  )}
                  
                  {connection.connection_status !== 'revoked' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokeConnection(connection.connection_id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Revoke
                    </Button>
                  )}
                </div>

                {/* Show refresh status message if there's an error */}
                {refreshStatus[connection.connection_id]?.message && 
                 !refreshStatus[connection.connection_id]?.isRefreshing && 
                 !refreshStatus[connection.connection_id]?.success && (
                  <div className={`mt-2 p-3 border rounded-md text-sm ${
                    refreshStatus[connection.connection_id]?.needsReconnection 
                      ? 'bg-amber-900/20 border-amber-500/30' 
                      : 'bg-red-900/20 border-red-500/20'
                  }`}>
                    <div className={`flex items-start gap-2 ${
                      refreshStatus[connection.connection_id]?.needsReconnection 
                        ? 'text-amber-300' 
                        : 'text-red-400'
                    }`}>
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium mb-1">
                          {refreshStatus[connection.connection_id]?.needsReconnection 
                            ? 'Connection Expired' 
                            : 'Refresh Failed'}
                        </div>
                        <div className="text-xs opacity-90 mb-2">
                          {refreshStatus[connection.connection_id].message}
                        </div>
                        {refreshStatus[connection.connection_id]?.needsReconnection && (
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                              onClick={() => handleRevokeConnection(connection.connection_id)}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Disconnect
                            </Button>
                            <span className="text-xs opacity-70 self-center">
                              Then reconnect to restore access
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Expandable scopes section */}
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    View granted permissions
                  </summary>
                  <div className="mt-2 space-y-1">
                    {connection.scopes_granted.map((scope, index) => (
                      <div key={index} className="text-muted-foreground pl-4">
                        • {scope}
                      </div>
                    ))}
                  </div>
                </details>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
} 