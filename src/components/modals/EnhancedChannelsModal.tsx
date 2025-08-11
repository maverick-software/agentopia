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
import { 
  Loader2, 
  Check, 
  MessageSquare,
  Mail,
  MessageCircle,
  Slack,
  Shield,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Plus,
  Settings,
  Trash2,
  Key
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGmailConnection } from '@/hooks/useGmailIntegration';
import { useConnections } from '@/hooks/useConnections';
import { useIntegrationsByClassification } from '@/hooks/useIntegrations';
import { toast } from 'react-hot-toast';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { VaultService } from '@/services/VaultService';

interface EnhancedChannelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

export function EnhancedChannelsModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated
}: EnhancedChannelsModalProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const vaultService = new VaultService(supabase);
  const { connection: gmailConnection, initiateOAuth: gmailInitiateOAuth } = useGmailConnection();
  const { connections, refetch: refetchConnections } = useConnections({ includeRevoked: false });
  const { integrations } = useIntegrationsByClassification('channel');
  
  // UI state
  const [activeTab, setActiveTab] = useState('connected');
  const [connectingService, setConnectingService] = useState<string | null>(null);
  const [setupService, setSetupService] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  
  // Setup form state
  const [connectionName, setConnectionName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [mailgunDomain, setMailgunDomain] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Map DB integrations -> modal service definitions
  const mapIntegrationToService = (integration: { name: string; description?: string }) => {
    const lower = integration.name.toLowerCase();
    const icon = Mail; // default mail icon for channels
    let id = lower;
    let gradient = 'from-zinc-500 to-zinc-600';
    let type: 'oauth' | 'api_key' | 'coming_soon' = 'coming_soon';

    if (lower.includes('gmail')) {
      id = 'gmail';
      gradient = 'from-red-500 to-orange-500';
      type = 'oauth';
    } else if (lower.includes('sendgrid')) {
      id = 'sendgrid';
      gradient = 'from-blue-500 to-indigo-500';
      type = 'api_key';
    } else if (lower.includes('mailgun')) {
      id = 'mailgun';
      gradient = 'from-rose-500 to-pink-500';
      type = 'api_key';
    } else if (lower.includes('discord')) {
      id = 'discord';
      gradient = 'from-indigo-500 to-purple-500';
      type = 'coming_soon';
    } else if (lower.includes('slack')) {
      id = 'slack';
      gradient = 'from-green-500 to-teal-500';
      type = 'coming_soon';
    }

    return {
      id,
      name: integration.name,
      description: integration.description || '',
      icon,
      type,
      gradient
    } as const;
  };

  const handleMailgunSetup = async () => {
    if (!user) return;
    setConnectingService('mailgun');
    setError(null);
    try {
      if (!apiKey.trim()) { setError('API key is required'); return; }
      if (!mailgunDomain.trim()) { setError('Domain is required'); return; }

      const { data: mgProvider, error: providerError } = await supabase
        .from('oauth_providers')
        .select('id')
        .eq('name', 'mailgun')
        .single();
      if (providerError || !mgProvider) throw providerError || new Error('Mailgun provider missing');

      const { data: conn, error: connError } = await supabase
        .from('user_oauth_connections')
        .insert({
          user_id: user.id,
          oauth_provider_id: mgProvider.id,
          connection_name: connectionName || 'Mailgun Connection',
          credential_type: 'api_key',
          connection_status: 'active',
          vault_access_token_id: apiKey, // TODO: replace with Vault ID
          external_username: mailgunDomain,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();
      if (connError) throw connError;

      // Optional: upsert configuration record if table exists
      await supabase
        .from('mailgun_configurations')
        .upsert({
          user_id: user.id,
          user_oauth_connection_id: conn.id,
          domain: mailgunDomain,
          region: 'us',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      await refetchConnections();
      setSaved(true);
      setSetupService(null);
      setActiveTab('connected');
      setApiKey('');
      setMailgunDomain('');
      setConnectionName('');
    } catch (e: any) {
      console.error('Mailgun setup error:', e);
      setError(e?.message || 'Failed to connect Mailgun');
    } finally {
      setConnectingService(null);
    }
  };

  const CHANNEL_SERVICES = integrations
    .filter(i => i.status === 'available')
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name))
    .map(mapIntegrationToService);

  // Clear saved state after 3 seconds
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const handleOAuthSetup = async (serviceId: string) => {
    if (serviceId !== 'gmail') {
      toast.info(`${serviceId} integration coming soon! 🚀`);
      return;
    }

    setConnectingService(serviceId);
    try {
      console.log('Initiating Gmail OAuth flow');
      await gmailInitiateOAuth();
      
      // Refresh connections to get the latest data
      await refetchConnections();
      
      toast.success('Gmail connected successfully! 🎉');
      setSaved(true);
      setSetupService(null);
      
      // Switch to connected tab to show the new connection
      setActiveTab('connected');
      
    } catch (error: any) {
      console.error('OAuth flow error:', error);
      if (!error.message?.includes('cancelled')) {
        toast.error('Failed to connect Gmail');
      }
    } finally {
      setConnectingService(null);
    }
  };

  const handleSendGridSetup = async () => {
    if (!user) return;
    
    setConnectingService('sendgrid');
    setError(null);
    
    try {
      // Validate inputs
      if (!apiKey.trim()) {
        setError('API key is required');
        return;
      }
      if (!fromEmail.trim()) {
        setError('From email is required');
        return;
      }
      
      // Store API key in vault
      const vaultKeyId = await vaultService.createSecret(
        `sendgrid_api_key_${user.id}`,
        apiKey,
        'SendGrid API key'
      );
      
      // Create or update SendGrid configuration
      const { error: configError } = await supabase
        .from('sendgrid_configurations')
        .upsert({
          user_id: user.id,
          api_key_vault_id: apiKey, // For now, storing the raw key
          from_email: fromEmail,
          from_name: fromName || null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
      
      if (configError) throw configError;
      
      // Resolve provider id and create connection record
      const { data: sgProvider, error: providerError } = await supabase
        .from('oauth_providers')
        .select('id')
        .eq('name', 'sendgrid')
        .single();
      if (providerError || !sgProvider) throw providerError || new Error('SendGrid provider missing');

      const { error: connError } = await supabase
        .from('user_oauth_connections')
        .insert({
          user_id: user.id,
          oauth_provider_id: sgProvider.id,
          connection_name: connectionName || 'SendGrid Connection',
          credential_type: 'api_key',
          connection_status: 'active',
          vault_access_token_id: apiKey, // TODO: replace with Vault ID
          external_username: fromEmail || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (connError) throw connError;
      
      // Refresh connections
      await refetchConnections();
      
      toast.success('SendGrid connected successfully! 📧');
      setSaved(true);
      setSetupService(null);
      setActiveTab('connected');
      
      // Reset form
      setApiKey('');
      setFromEmail('');
      setFromName('');
      setConnectionName('');
      
    } catch (error: any) {
      console.error('SendGrid setup error:', error);
      setError(error.message || 'Failed to connect SendGrid');
    } finally {
      setConnectingService(null);
    }
  };

  const getServiceStatus = (serviceId: string) => {
    // Check if this service is connected using centralized connections
    if (serviceId === 'gmail') {
      const gmailConnected = connections.some(c => 
        c.provider_name === 'gmail' && 
        c.connection_status === 'active'
      );
      return gmailConnected ? 'connected' : 'available';
    }
    
    if (serviceId === 'sendgrid') {
      const sendgridConnected = connections.some(c => 
        c.provider_name === 'sendgrid' && 
        c.connection_status === 'active'
      );
      return sendgridConnected ? 'connected' : 'available';
    }
    if (serviceId === 'mailgun') {
      const mailgunConnected = connections.some(c => 
        c.provider_name === 'mailgun' &&
        c.connection_status === 'active'
      );
      return mailgunConnected ? 'connected' : 'available';
    }
    
    return 'coming_soon';
  };

  const renderConnectedChannels = () => {
    // Filter connections for channels only
    const channelConnections = connections.filter(c => 
      (c.provider_name === 'gmail' || c.provider_name === 'sendgrid' || c.provider_name === 'mailgun') && 
      c.connection_status === 'active'
    );

    if (channelConnections.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Settings className="h-12 w-12 text-muted-foreground opacity-50" />
          <div className="text-center">
            <p className="text-muted-foreground font-medium">No channels connected</p>
            <p className="text-sm text-muted-foreground mt-1">Add a channel to get started</p>
          </div>
          <Button
            onClick={() => setActiveTab('available')}
            className="mt-4"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Channel
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
            Add Channel
          </Button>
        </div>
        
        {channelConnections.map((connection) => {
          const isSendGrid = connection.provider_name === 'sendgrid';
          const isMailgun = connection.provider_name === 'mailgun';
          const gradient = isSendGrid
            ? 'from-blue-500 to-indigo-500'
            : isMailgun
            ? 'from-rose-500 to-pink-500'
            : 'from-red-500 to-orange-500';
          const name = isSendGrid ? 'SendGrid' : isMailgun ? 'Mailgun' : 'Gmail';
          
          return (
            <div
              key={connection.id}
              className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
            >
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                  <Mail className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-medium">{name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {connection.external_username || connection.connection_name || 'Connected'}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                Connected
              </Badge>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSetupFlow = (service: any) => {
    if (service.type === 'oauth') {
      return (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <span>OAuth 2.0 Authentication</span>
            </CardTitle>
            <CardDescription>
              Secure authentication flow to connect your {service.name} account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="connection_name">
                Connection Name (Optional)
              </Label>
              <Input
                id="connection_name"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder={`My ${service.name} Connection`}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Give this connection a name to identify it later
              </p>
            </div>

            <Button
              onClick={() => handleOAuthSetup(service.id)}
              disabled={connectingService === service.id}
              className={`w-full bg-gradient-to-r ${service.gradient} hover:opacity-90 text-white`}
            >
              {connectingService === service.id ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Connect with {service.name}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (service.type === 'api_key' && service.id === 'sendgrid') {
      return (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="h-5 w-5 text-blue-500" />
              <span>SendGrid API Configuration</span>
            </CardTitle>
            <CardDescription>
              Configure your SendGrid API key and email settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div>
              <Label htmlFor="api_key">
                SendGrid API Key <span className="text-red-500">*</span>
              </Label>
              <Input
                id="api_key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="SG.xxxxxxxxxxxxxxxxxxxxxx"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your SendGrid API key with mail.send permissions
              </p>
            </div>

            <div>
              <Label htmlFor="from_email">
                From Email Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="from_email"
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@yourdomain.com"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The email address that will appear as the sender
              </p>
            </div>

            <div>
              <Label htmlFor="from_name">
                From Name (Optional)
              </Label>
              <Input
                id="from_name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your Company Name"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The name that will appear as the sender
              </p>
            </div>

            <div>
              <Label htmlFor="connection_name_sg">
                Connection Name (Optional)
              </Label>
              <Input
                id="connection_name_sg"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder="My SendGrid Connection"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Give this connection a name to identify it later
              </p>
            </div>

            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <ExternalLink className="h-4 w-4" />
              <a 
                href="https://app.sendgrid.com/settings/api_keys" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-foreground underline"
              >
                Get your SendGrid API key
              </a>
            </div>

            <Button
              onClick={handleSendGridSetup}
              disabled={connectingService === 'sendgrid'}
              className={`w-full bg-gradient-to-r ${service.gradient} hover:opacity-90 text-white`}
            >
              {connectingService === 'sendgrid' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Connect SendGrid
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (service.type === 'api_key' && service.id === 'mailgun') {
      return (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="h-5 w-5 text-pink-500" />
              <span>Mailgun API Configuration</span>
            </CardTitle>
            <CardDescription>
              Configure your Mailgun API key and domain
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div>
              <Label htmlFor="mg_domain">Mailgun Domain <span className="text-red-500">*</span></Label>
              <Input id="mg_domain" value={mailgunDomain} onChange={(e) => setMailgunDomain(e.target.value)} placeholder="mail.yourdomain.com" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="mg_api_key">Mailgun API Key <span className="text-red-500">*</span></Label>
              <Input id="mg_api_key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="key-xxxxxxxxxxxxxxxxxxxx" className="mt-1" />
            </div>
            <Button
              onClick={handleMailgunSetup}
              disabled={connectingService === 'mailgun'}
              className={`w-full bg-gradient-to-r ${service.gradient} hover:opacity-90 text-white`}
            >
              {connectingService === 'mailgun' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Connect Mailgun
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  const renderAvailableServices = () => {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">
          Choose communication channels to connect to your agent:
        </div>
        
        <div className="space-y-3">
          {CHANNEL_SERVICES.map((service) => {
            const Icon = service.icon;
            const status = getServiceStatus(service.id);
            const isConnected = status === 'connected';
            const isSetupMode = setupService === service.id;
            
            if (isSetupMode) {
              return (
                <div key={service.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${service.gradient} flex items-center justify-center`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium">{service.name}</h3>
                        <p className="text-sm text-muted-foreground">Setting up connection...</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSetupService(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                  {renderSetupFlow(service)}
                </div>
              );
            }
            
            return (
              <div
                key={service.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                  isConnected
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                    : 'border-border hover:border-border hover:bg-accent/50'
                }`}
              >
                <div className="flex items-center space-x-3 flex-1">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${service.gradient} flex items-center justify-center`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium">{service.name}</h3>
                      {isConnected && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                          Connected
                        </Badge>
                      )}
                      {status === 'coming_soon' && (
                        <Badge variant="outline" className="text-xs">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {isConnected ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : status === 'coming_soon' ? (
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  ) : (
                   <Button
                      onClick={() => setSetupService(service.id)}
                      size="sm"
                      className={`bg-gradient-to-r ${service.gradient} hover:opacity-90 text-white`}
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
            💬 Channels
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Connect communication channels and manage permissions for your agent.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="connected">Connected Channels</TabsTrigger>
              <TabsTrigger value="available">Add New Channel</TabsTrigger>
            </TabsList>
            
            <TabsContent value="connected" className="mt-6">
              <div className="min-h-[300px]">
                {renderConnectedChannels()}
              </div>
            </TabsContent>
            
            <TabsContent value="available" className="mt-6">
              <div className="min-h-[300px]">
                {renderAvailableServices()}
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