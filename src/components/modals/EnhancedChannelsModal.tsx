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
  Trash2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGmailConnection } from '@/hooks/useGmailIntegration';
import { useIntegrationsByClassification } from '@/hooks/useIntegrations';
import { AgentIntegrationsManager } from '@/components/agent-edit/AgentIntegrationsManager';
import { toast } from 'react-hot-toast';

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
  const { connection: gmailConnection, initiateOAuth: gmailInitiateOAuth } = useGmailConnection();
  const { integrations } = useIntegrationsByClassification('channel');
  
  // UI state
  const [activeTab, setActiveTab] = useState('connected');
  const [connectingService, setConnectingService] = useState<string | null>(null);
  const [setupService, setSetupService] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  
  // Setup form state
  const [connectionName, setConnectionName] = useState('');

  // Available channel services that users can connect
  const CHANNEL_SERVICES = [
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Send and receive emails through your Gmail account',
      icon: Mail,
      type: 'oauth',
      gradient: 'from-red-500 to-orange-500',
      setupInstructions: 'Connect your Gmail account using secure OAuth authentication'
    },
    {
      id: 'discord',
      name: 'Discord',
      description: 'Interact with Discord servers and manage bot communications',
      icon: MessageCircle,
      type: 'oauth',
      gradient: 'from-indigo-500 to-purple-500',
      setupInstructions: 'Connect your Discord account (coming soon)'
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Send messages to Slack channels and manage workspace communications',
      icon: Slack,
      type: 'oauth',
      gradient: 'from-green-500 to-teal-500',
      setupInstructions: 'Connect your Slack workspace (coming soon)'
    }
  ];

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

  const getServiceStatus = (serviceId: string) => {
    // Check if this service is connected
    if (serviceId === 'gmail') {
      return gmailConnection ? 'connected' : 'available';
    }
    return 'coming_soon';
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
              {/* Use the existing AgentIntegrationsManager for connected channels */}
              <div className="min-h-[300px]">
                <AgentIntegrationsManager
                  agentId={agentId}
                  category="channel"
                  title=""
                  description=""
                />
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