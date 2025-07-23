import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGmailConnection } from '@/hooks/useGmailIntegration';
import { 
  Shield, 
  Key, 
  Globe, 
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Loader2,
  Info
} from 'lucide-react';

interface IntegrationSetupModalProps {
  integration: any;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function IntegrationSetupModal({ 
  integration, 
  isOpen, 
  onClose, 
  onComplete 
}: IntegrationSetupModalProps) {
  const [activeTab, setActiveTab] = useState('setup');
  const [authMethod, setAuthMethod] = useState<'oauth' | 'api_key' | 'custom'>('oauth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Gmail OAuth hook
  const { connection: gmailConnection, initiateOAuth: gmailInitiateOAuth } = useGmailConnection();
  
  // Form state
  const [formData, setFormData] = useState({
    connection_name: '',
    api_key: '',
    client_id: '',
    client_secret: '',
    custom_config: {}
  });

  // Reset state when modal is closed
  const resetModalState = () => {
    setActiveTab('setup');
    setAuthMethod('oauth');
    setLoading(false);
    setError(null);
    setSuccess(false);
    setSuccessMessage('');
    setFormData({
      connection_name: '',
      api_key: '',
      client_id: '',
      client_secret: '',
      custom_config: {}
    });
  };

  // Handle modal close with state reset
  const handleClose = () => {
    resetModalState();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Simulate API call for non-Gmail integrations
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // For now, just show success
      setSuccess(true);
      
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthFlow = async () => {
    setLoading(true);
    setError(null);

    try {
      // Handle Gmail OAuth specifically
      if (integration.name === 'Gmail') {
        // Always initiate Gmail OAuth flow to allow multiple accounts
        await gmailInitiateOAuth();
        
        // OAuth flow completed successfully (popup was closed after success)
        setSuccess(true);
        setSuccessMessage('Gmail connected successfully!');
        
        // Show success message briefly then close modal
        setTimeout(() => {
          onComplete();
          handleClose();
        }, 1500);
      } else {
        // For other integrations, simulate OAuth flow
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // For now, just show success
        setSuccess(true);
        
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    } catch (err) {
      // Handle errors (user cancelled, timeout, etc.)
      const errorMessage = err instanceof Error ? err.message : 'OAuth flow failed';
      if (!errorMessage.includes('cancelled')) {
        setError(errorMessage);
      }
      setLoading(false);
    }
  };

  if (!integration) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <div className="p-2 bg-gray-800 rounded-lg">
              <Globe className="h-5 w-5 text-blue-400" />
            </div>
            Setup {integration.name}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure your {integration.name} integration to connect with your agents.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800">
            <TabsTrigger value="setup" className="text-gray-300">
              Setup
            </TabsTrigger>
            <TabsTrigger value="info" className="text-gray-300">
              Info
            </TabsTrigger>
            <TabsTrigger value="docs" className="text-gray-300">
              Documentation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-4">
            {success ? (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  Integration Connected Successfully!
                </h3>
                <p className="text-gray-400">
                  {successMessage || `Your ${integration.name} integration is now ready to use.`}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Authentication Method</CardTitle>
                    <CardDescription className="text-gray-400">
                      Choose how you want to authenticate with {integration.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      <div 
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                          authMethod === 'oauth' 
                            ? 'border-blue-500 bg-blue-500/10' 
                            : 'border-gray-700 bg-gray-800'
                        }`}
                        onClick={() => setAuthMethod('oauth')}
                      >
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-blue-400" />
                          <div>
                            <h4 className="font-medium text-white">OAuth 2.0</h4>
                            <p className="text-sm text-gray-400">
                              Secure authentication flow (Recommended)
                            </p>
                          </div>
                          <Badge variant="secondary" className="ml-auto">
                            Recommended
                          </Badge>
                        </div>
                      </div>

                      <div 
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                          authMethod === 'api_key' 
                            ? 'border-blue-500 bg-blue-500/10' 
                            : 'border-gray-700 bg-gray-800'
                        }`}
                        onClick={() => setAuthMethod('api_key')}
                      >
                        <div className="flex items-center gap-3">
                          <Key className="h-5 w-5 text-yellow-400" />
                          <div>
                            <h4 className="font-medium text-white">API Key</h4>
                            <p className="text-sm text-gray-400">
                              Direct API key authentication
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {error && (
                      <Alert className="bg-red-900/20 border-red-500/20">
                        <AlertCircle className="h-4 w-4 text-red-400" />
                        <AlertDescription className="text-red-400">
                          {error}
                        </AlertDescription>
                      </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="connection_name" className="text-white">
                          Connection Name
                        </Label>
                        <Input
                          id="connection_name"
                          value={formData.connection_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, connection_name: e.target.value }))}
                          placeholder="My Gmail Connection"
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>

                      {authMethod === 'oauth' ? (
                        <Button
                          type="button"
                          onClick={handleOAuthFlow}
                          disabled={loading || success}
                          className={`w-full ${success ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                          {success ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Success!
                            </>
                          ) : loading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <Shield className="h-4 w-4 mr-2" />
                              Connect with OAuth
                            </>
                          )}
                        </Button>
                      ) : (
                        <>
                          <div>
                            <Label htmlFor="api_key" className="text-white">
                              API Key
                            </Label>
                            <Input
                              id="api_key"
                              type="password"
                              value={formData.api_key}
                              onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                              placeholder="Enter your API key"
                              className="bg-gray-800 border-gray-700 text-white"
                            />
                          </div>
                          
                          <Button
                            type="submit"
                            disabled={loading || !formData.api_key.trim()}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                          >
                            {loading ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              <>
                                <Key className="h-4 w-4 mr-2" />
                                Connect with API Key
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="info" className="space-y-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">About {integration.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-400">
                  {integration.description}
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-white mb-2">Status</h4>
                    <Badge className={integration.status === 'available' ? 'bg-green-600' : 'bg-yellow-600'}>
                      {integration.status}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-medium text-white mb-2">Category</h4>
                    <Badge variant="secondary">
                      {integration.category_id}
                    </Badge>
                  </div>
                </div>

                {integration.is_popular && (
                  <div className="flex items-center gap-2 p-3 bg-blue-600/10 rounded-lg border border-blue-500/20">
                    <Info className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-blue-400">
                      This is a popular integration used by many users.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs" className="space-y-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Documentation</CardTitle>
                <CardDescription className="text-gray-400">
                  Learn how to use {integration.name} integration effectively.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3 bg-gray-700 rounded-lg">
                    <h4 className="font-medium text-white mb-2">Getting Started</h4>
                    <p className="text-sm text-gray-400">
                      Follow the setup process to connect your {integration.name} account.
                    </p>
                  </div>
                  
                  <div className="p-3 bg-gray-700 rounded-lg">
                    <h4 className="font-medium text-white mb-2">Configuration</h4>
                    <p className="text-sm text-gray-400">
                      Configure your integration settings and assign it to your agents.
                    </p>
                  </div>
                </div>

                {integration.documentation_url && (
                  <Button
                    variant="outline"
                    className="w-full border-gray-700 text-gray-300 hover:bg-gray-800"
                    onClick={() => window.open(integration.documentation_url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Official Documentation
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 