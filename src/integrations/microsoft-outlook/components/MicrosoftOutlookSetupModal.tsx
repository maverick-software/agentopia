import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Mail, Calendar, Users, CheckCircle, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { revokeConnection } from '@/integrations/_shared/services/connections';

interface MicrosoftOutlookSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface ConnectionStatus {
  isConnected: boolean;
  connectionId?: string;
  externalUsername?: string;
  scopes?: string[];
  expiresAt?: string;
}

export function MicrosoftOutlookSetupModal({ isOpen, onClose, onComplete }: MicrosoftOutlookSetupModalProps) {
  const { user } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ isConnected: false });
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [provider, setProvider] = useState<any>(null);

  const requiredScopes = [
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/Mail.Send',
    'https://graph.microsoft.com/Mail.ReadWrite',
    'https://graph.microsoft.com/Calendars.Read',
    'https://graph.microsoft.com/Calendars.ReadWrite',
    'https://graph.microsoft.com/Contacts.Read',
    'https://graph.microsoft.com/User.Read'
  ];

  useEffect(() => {
    if (isOpen) {
      fetchProvider();
      checkConnectionStatus();
    }
  }, [isOpen, user?.id]);

  const fetchProvider = async () => {
    try {
      const { data, error } = await supabase
        .from('service_providers')
        .select('*')
        .eq('name', 'microsoft-outlook')
        .single();

      if (error) {
        console.error('Error fetching Outlook provider:', error);
        return;
      }

      setProvider(data);
    } catch (error) {
      console.error('Error fetching Outlook provider:', error);
    }
  };

  const checkConnectionStatus = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_integration_credentials')
        .select('*')
        .eq('user_id', user.id)
        .eq('oauth_provider_id', (await supabase.from('service_providers').select('id').eq('name', 'microsoft-outlook').single()).data?.id)
        .eq('connection_status', 'active');

      if (error) {
        console.error('Error checking connection status:', error);
        return;
      }

      if (data && data.length > 0) {
        const connection = data[0];
        setConnectionStatus({
          isConnected: true,
          connectionId: connection.id,
          externalUsername: connection.external_username || undefined,
          scopes: connection.scopes_granted || [],
          expiresAt: connection.token_expires_at || undefined
        });
      } else {
        setConnectionStatus({ isConnected: false });
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
    }
  };

  const handleConnect = async () => {
    if (!provider?.configuration_metadata?.client_id) {
      console.error('Microsoft Client ID not configured');
      return;
    }

    setLoading(true);
    
    try {
      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      
      // Store code verifier in session storage for the callback
      sessionStorage.setItem('outlook_code_verifier', codeVerifier);
      sessionStorage.setItem('outlook_user_id', user!.id);
      
      // Build OAuth URL
      const params = new URLSearchParams({
        client_id: provider.configuration_metadata.client_id,
        scope: requiredScopes.join(' '),
        redirect_uri: `${window.location.origin}/integrations/microsoft-outlook/callback`,
        response_type: 'code',
        state: `outlook_${user!.id}_${Date.now()}`,
        prompt: 'consent',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      });

      const authUrl = `${provider.authorization_endpoint}?${params.toString()}`;
      
      // Open OAuth flow
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error initiating Outlook OAuth:', error);
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connectionStatus.connectionId) return;

    setDisconnecting(true);
    try {
      await revokeConnection(supabase, connectionStatus.connectionId);
      setConnectionStatus({ isConnected: false });
      onComplete?.();
    } catch (error) {
      console.error('Error disconnecting Outlook:', error);
    } finally {
      setDisconnecting(false);
    }
  };

  // PKCE helper functions
  const generateCodeVerifier = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const generateCodeChallenge = async (verifier: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const formatExpiryDate = (expiresAt?: string) => {
    if (!expiresAt) return 'No expiry';
    const date = new Date(expiresAt);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">Setup Microsoft Outlook</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Send emails, manage calendar events, and access contacts in Microsoft Outlook
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Connection Status */}
          <Card className="border-2">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {connectionStatus.isConnected ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                  )}
                  <div>
                    <p className="font-medium">
                      {connectionStatus.isConnected ? 'Connected' : 'Not Connected'}
                    </p>
                    {connectionStatus.isConnected && connectionStatus.externalUsername && (
                      <p className="text-sm text-muted-foreground">
                        Connected as: {connectionStatus.externalUsername}
                      </p>
                    )}
                  </div>
                </div>
                
                {connectionStatus.isConnected ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                  >
                    {disconnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Disconnecting...
                      </>
                    ) : (
                      'Disconnect'
                    )}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleConnect}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Connect Outlook
                      </>
                    )}
                  </Button>
                )}
              </div>

              {connectionStatus.isConnected && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground">Token Expires</p>
                      <p>{formatExpiryDate(connectionStatus.expiresAt)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Permissions</p>
                      <p>{connectionStatus.scopes?.length || 0} scopes granted</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Features */}
          <div>
            <h3 className="font-semibold mb-3">What you can do with Outlook integration:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50">
                <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Email Management</p>
                  <p className="text-xs text-muted-foreground">Send, read, and manage emails</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50">
                <Calendar className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Calendar Events</p>
                  <p className="text-xs text-muted-foreground">Create and manage calendar events</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50">
                <Users className="w-5 h-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Contacts</p>
                  <p className="text-xs text-muted-foreground">Access and manage contacts</p>
                </div>
              </div>
            </div>
          </div>

          {/* Required Permissions */}
          <div>
            <h3 className="font-semibold mb-3">Required Permissions:</h3>
            <div className="space-y-2">
              {requiredScopes.map((scope, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    {scope.replace('https://graph.microsoft.com/', '')}
                  </Badge>
                  {connectionStatus.scopes?.includes(scope) && (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Footer Actions */}
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {connectionStatus.isConnected && onComplete && (
              <Button onClick={onComplete}>
                Continue
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
