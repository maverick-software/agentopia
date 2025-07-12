import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Key, Shield, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

interface OAuthConnection {
  connection_id: string;
  provider_name: string;
  provider_display_name: string;
  external_username: string;
  connection_name: string;
  scopes_granted: string[];
  connection_status: string;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export function CredentialsPage() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<OAuthConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchConnections();
    }
  }, [user]);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_user_oauth_connections', {
        p_user_id: user?.id
      });

      if (error) {
        console.error('Error fetching connections:', error);
        return;
      }

      setConnections(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshToken = async (connectionId: string) => {
    try {
      setRefreshing(connectionId);
      // TODO: Implement token refresh logic
      console.log('Token refresh not yet implemented');
    } catch (error) {
      console.error('Error refreshing token:', error);
    } finally {
      setRefreshing(null);
    }
  };

  const handleRevokeConnection = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('user_oauth_connections')
        .update({ connection_status: 'revoked' })
        .eq('id', connectionId);

      if (error) {
        console.error('Error revoking connection:', error);
        return;
      }

      fetchConnections();
    } catch (error) {
      console.error('Error:', error);
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
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Credentials</h1>
        <p className="text-gray-400">
          Manage your OAuth connections and API credentials stored securely in the vault.
        </p>
      </div>

      <div className="grid gap-4">
        {connections.length === 0 ? (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="h-12 w-12 text-gray-500 mb-4" />
              <p className="text-gray-400 text-center">
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
            <Card key={connection.connection_id} className="bg-gray-800 border-gray-700">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">{getProviderIcon(connection.provider_name)}</div>
                    <div>
                      <CardTitle className="text-white">
                        {connection.provider_display_name}
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        {connection.external_username || connection.connection_name || 'Connected Account'}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={getStatusColor(connection.connection_status)}
                  >
                    {connection.connection_status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm">
                    <Key className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-400">Scopes:</span>
                    <span className="text-gray-300">
                      {connection.scopes_granted.length} permissions granted
                    </span>
                  </div>
                  
                  {connection.token_expires_at && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Shield className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-400">Token expires:</span>
                      <span className="text-gray-300">
                        {format(new Date(connection.token_expires_at), 'PPp')}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center space-x-2 text-sm">
                    <ExternalLink className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-400">Connected:</span>
                    <span className="text-gray-300">
                      {format(new Date(connection.created_at), 'PP')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  {connection.connection_status === 'active' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRefreshToken(connection.connection_id)}
                      disabled={refreshing === connection.connection_id}
                      className="text-gray-300 hover:text-white"
                    >
                      {refreshing === connection.connection_id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Refresh Token
                    </Button>
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

                {/* Expandable scopes section */}
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                    View granted permissions
                  </summary>
                  <div className="mt-2 space-y-1">
                    {connection.scopes_granted.map((scope, index) => (
                      <div key={index} className="text-gray-500 pl-4">
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