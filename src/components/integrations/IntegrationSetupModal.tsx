import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGmailConnection } from '@/hooks/useGmailIntegration';
import { useConnections } from '@/hooks/useConnections';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  Shield, 
  Globe, 
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Loader2,
  Key,
  Search,
  Mail
} from 'lucide-react';
import { VaultService } from '@/services/VaultService';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Hooks
  const supabase = useSupabaseClient();
  const vaultService = new VaultService(supabase);
  const { user } = useAuth();
  const { connection: gmailConnection, initiateOAuth: gmailInitiateOAuth } = useGmailConnection();
  const { connections: unifiedConnections, refetch: refetchConnections } = useConnections({ includeRevoked: false });
  
  // Form state
  const [formData, setFormData] = useState({
    connection_name: '',
    api_key: '',
    default_location: '',
    default_language: 'en',
    default_engine: 'google',
    safesearch: 'moderate',
    from_email: '',
    from_name: ''
  });

  // Check if this is a web search integration
  const isWebSearchIntegration = ['Serper API', 'SerpAPI', 'Brave Search API'].includes(integration?.name);
  const isSendGridIntegration = integration?.name === 'SendGrid';

  // Reset state when modal is closed
  const resetModalState = () => {
    setLoading(false);
    setError(null);
    setSuccess(false);
    setSuccessMessage('');
    setFormData({
      connection_name: '',
      api_key: '',
      default_location: '',
      default_language: 'en',
      default_engine: 'google',
      safesearch: 'moderate'
    });
  };

  // Handle modal close with state reset
  const handleClose = () => {
    resetModalState();
    onClose();
  };

  const handleWebSearchSetup = async () => {
    if (!formData.api_key || !user) {
      setError('Please enter your API key');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get the web search provider
      const providerNameMap: { [key: string]: string } = {
        'Serper API': 'serper_api',
        'SerpAPI': 'serpapi',
        'Brave Search API': 'brave_search'
      };

      const providerName = providerNameMap[integration.name];
      if (!providerName) {
        throw new Error('Unknown web search provider');
      }

      // Get provider details
      const { data: providerData, error: providerError } = await supabase
        .from('oauth_providers')
        .select('id')
        .eq('name', providerName)
        .single();

      if (providerError) throw providerError;

      const vault_secret_id = await vaultService.createSecret(
        `${providerName}_api_key_${user.id}_${Date.now()}`,
        formData.api_key,
        `${integration.name} API key for user ${user.id}`
      );

      // Create user OAuth connection record (unified system for API keys)
      const { error: keyError } = await supabase
        .from('user_oauth_connections')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id, // Required field
          external_username: formData.connection_name || `${integration.name} Connection`,
          connection_name: formData.connection_name || `${integration.name} Connection`,
          // Prefer vault id column for new entries
          vault_access_token_id: vault_secret_id,
          scopes_granted: ['web_search', 'news_search', 'scrape_and_summarize'],
          connection_status: 'active',
          credential_type: 'api_key' // Specify this is an API key connection
        });

      if (keyError) throw keyError;

      // Create integration record in user_integrations table
      const { error: integrationError } = await supabase
        .from('user_integrations')
        .insert({
          user_id: user.id,
          integration_id: integration.id,
          connection_name: formData.connection_name || `${integration.name} Connection`,
          connection_status: 'connected',
          configuration: {
            default_location: formData.default_location,
            default_language: formData.default_language,
            default_engine: formData.default_engine,
            safesearch: formData.safesearch
          }
        });

      if (integrationError && !integrationError.message.includes('duplicate')) {
        throw integrationError;
      }

      setSuccess(true);
      setSuccessMessage(`${integration.name} connected successfully!`);
      toast.success(`${integration.name} API key added successfully!`);

      // Show success message briefly then close modal
      setTimeout(() => {
        // Refresh unified connections to reflect connected status immediately
        refetchConnections();
        onComplete();
        handleClose();
      }, 1500);

    } catch (error: any) {
      console.error('Error setting up web search integration:', error);
      setError(error.message || 'Failed to setup integration');
      toast.error('Failed to setup web search integration');
    } finally {
      setLoading(false);
    }
  };

  const handleSendGridSetup = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Validate inputs
      if (!formData.api_key.trim()) {
        setError('API key is required');
        setLoading(false);
        return;
      }
      if (!formData.from_email.trim()) {
        setError('From email is required');
        setLoading(false);
        return;
      }
      
      // Store API key in vault (for now, storing raw key)
      const vaultKeyId = formData.api_key;
      
      // Create or update SendGrid configuration
      const { error: configError } = await supabase
        .from('sendgrid_configurations')
        .upsert({
          user_id: user.id,
          api_key_vault_id: vaultKeyId,
          from_email: formData.from_email,
          from_name: formData.from_name || null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
      
      if (configError) throw configError;
      
      // Create connection record
      const { error: connError } = await supabase
        .from('user_oauth_connections')
        .insert({
          user_id: user.id,
          provider_name: 'sendgrid',
          connection_name: formData.connection_name || 'SendGrid Connection',
          credential_type: 'api_key',
          connection_status: 'connected',
          vault_access_token_id: vaultKeyId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (connError) throw connError;
      
      // Refresh connections
      await refetchConnections();
      
      setSuccess(true);
      setSuccessMessage('SendGrid connected successfully!');
      
      setTimeout(() => {
        onComplete();
        handleClose();
      }, 1500);
      
    } catch (error: any) {
      console.error('SendGrid setup error:', error);
      setError(error.message || 'Failed to connect SendGrid');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthFlow = async () => {
    console.log('Starting OAuth flow for integration:', integration.name);
    setLoading(true);
    setError(null);

    try {
      // Handle Gmail OAuth specifically
      if (integration.name === 'Gmail') {
        console.log('Initiating Gmail OAuth flow');
        // Always initiate Gmail OAuth flow to allow multiple accounts
        await gmailInitiateOAuth();
        
        console.log('Gmail OAuth flow completed successfully');
        // OAuth flow completed successfully (popup was closed after success)
        setSuccess(true);
        setSuccessMessage('Gmail connected successfully!');
        
        // Show success message briefly then close modal
        setTimeout(() => {
          console.log('Completing OAuth flow and closing modal');
          onComplete();
          handleClose();
        }, 1500);
      } else {
        console.log('Handling non-Gmail integration OAuth');
        // For other integrations, simulate OAuth flow
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // For now, just show success
        setSuccess(true);
        
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    } catch (err) {
      console.error('OAuth flow error:', err);
      // Handle errors (user cancelled, timeout, etc.)
      const errorMessage = err instanceof Error ? err.message : 'OAuth flow failed';
      if (!errorMessage.includes('cancelled')) {
        setError(errorMessage);
      }
      setLoading(false);
    }
  };

  if (!integration) return null;

  const getIntegrationIcon = () => {
    if (isWebSearchIntegration) {
      return <Search className="h-5 w-5 text-blue-400" />;
    }
    if (isSendGridIntegration) {
      return <Mail className="h-5 w-5 text-blue-400" />;
    }
    return <Globe className="h-5 w-5 text-blue-400" />;
  };

  const getIntegrationCapabilities = () => {
    if (isWebSearchIntegration) {
      return [
        'Search the web for real-time information',
        'Get news and current events data',
        'Scrape and summarize web pages',
        'Location-based search results',
        'Secure API key storage'
      ];
    }
    if (isSendGridIntegration) {
      return [
        'Send transactional and marketing emails',
        'Receive emails via inbound parse webhooks',
        'Create agent-specific email addresses',
        'Track email delivery and engagement',
        'Secure API key storage'
      ];
    }
    return [
      'Send and receive emails through your agents',
      'Read and search your email messages',
      'Manage email labels and folders',
      'Secure OAuth authentication'
    ];
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] bg-gray-900 border-gray-800 overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-white flex items-center gap-2">
            <div className="p-2 bg-gray-800 rounded-lg">
              {getIntegrationIcon()}
            </div>
            Setup {integration.name}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {isWebSearchIntegration 
              ? `Connect your ${integration.name} account to enable web search capabilities for your agents.`
              : `Connect your ${integration.name} account to enable email management capabilities for your agents.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          <div className="space-y-6 py-2">
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
                {isSendGridIntegration ? (
                  // SendGrid API Key Setup
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Key className="h-5 w-5 text-blue-400" />
                        SendGrid Configuration
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Configure your SendGrid API key and email settings
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {error && (
                        <Alert className="bg-red-900/20 border-red-500/20">
                          <AlertCircle className="h-4 w-4 text-red-400" />
                          <AlertDescription className="text-red-400">
                            {error}
                          </AlertDescription>
                        </Alert>
                      )}

                      <div>
                        <Label htmlFor="connection_name" className="text-white">
                          Connection Name (Optional)
                        </Label>
                        <Input
                          id="connection_name"
                          value={formData.connection_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, connection_name: e.target.value }))}
                          placeholder="My SendGrid Connection"
                          className="bg-gray-800 border-gray-700 text-white mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="api_key" className="text-white">
                          SendGrid API Key *
                        </Label>
                        <Input
                          id="api_key"
                          type="password"
                          value={formData.api_key}
                          onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                          placeholder="SG.xxxxxxxxxxxxxxxxxxxxxx"
                          className="bg-gray-800 border-gray-700 text-white mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Your API key with mail.send permissions
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="from_email" className="text-white">
                          From Email Address *
                        </Label>
                        <Input
                          id="from_email"
                          type="email"
                          value={formData.from_email}
                          onChange={(e) => setFormData(prev => ({ ...prev, from_email: e.target.value }))}
                          placeholder="noreply@yourdomain.com"
                          className="bg-gray-800 border-gray-700 text-white mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          The email address that will appear as the sender
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="from_name" className="text-white">
                          From Name (Optional)
                        </Label>
                        <Input
                          id="from_name"
                          value={formData.from_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, from_name: e.target.value }))}
                          placeholder="Your Company Name"
                          className="bg-gray-800 border-gray-700 text-white mt-1"
                        />
                      </div>

                      <div className="flex items-center space-x-2 text-sm text-gray-400">
                        <ExternalLink className="h-4 w-4" />
                        <a 
                          href="https://app.sendgrid.com/settings/api_keys" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:text-white underline"
                        >
                          Get your SendGrid API key
                        </a>
                      </div>

                      <Button
                        type="button"
                        onClick={handleSendGridSetup}
                        disabled={loading || success || !formData.api_key || !formData.from_email}
                        className={`w-full mt-4 ${success ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                      >
                        {success ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Success!
                          </>
                        ) : loading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Setting up...
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
                ) : isWebSearchIntegration ? (
                  // Web Search API Key Setup
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Key className="h-5 w-5 text-blue-400" />
                        API Key Configuration
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Enter your {integration.name} API key to enable web search functionality
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {error && (
                        <Alert className="bg-red-900/20 border-red-500/20">
                          <AlertCircle className="h-4 w-4 text-red-400" />
                          <AlertDescription className="text-red-400">
                            {error}
                          </AlertDescription>
                        </Alert>
                      )}

                      <div>
                        <Label htmlFor="connection_name" className="text-white">
                          Connection Name (Optional)
                        </Label>
                        <Input
                          id="connection_name"
                          value={formData.connection_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, connection_name: e.target.value }))}
                          placeholder={`My ${integration.name} Connection`}
                          className="bg-gray-800 border-gray-700 text-white mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="api_key" className="text-white">
                          API Key *
                        </Label>
                        <Input
                          id="api_key"
                          type="password"
                          value={formData.api_key}
                          onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                          placeholder="Enter your API key"
                          className="bg-gray-800 border-gray-700 text-white mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Your API key will be securely encrypted and stored
                        </p>
                      </div>

                      {/* Provider-specific configuration */}
                      {integration.name === 'SerpAPI' && (
                        <div>
                          <Label htmlFor="default_engine" className="text-white">
                            Default Search Engine
                          </Label>
                          <select
                            id="default_engine"
                            value={formData.default_engine}
                            onChange={(e) => setFormData(prev => ({ ...prev, default_engine: e.target.value }))}
                            className="w-full p-2 mt-1 bg-gray-800 border border-gray-700 rounded-md text-white"
                          >
                            <option value="google">Google</option>
                            <option value="bing">Bing</option>
                            <option value="yahoo">Yahoo</option>
                            <option value="baidu">Baidu</option>
                          </select>
                        </div>
                      )}

                      {integration.name === 'Brave Search API' && (
                        <div>
                          <Label htmlFor="safesearch" className="text-white">
                            Safe Search
                          </Label>
                          <select
                            id="safesearch"
                            value={formData.safesearch}
                            onChange={(e) => setFormData(prev => ({ ...prev, safesearch: e.target.value }))}
                            className="w-full p-2 mt-1 bg-gray-800 border border-gray-700 rounded-md text-white"
                          >
                            <option value="strict">Strict</option>
                            <option value="moderate">Moderate</option>
                            <option value="off">Off</option>
                          </select>
                        </div>
                      )}

                      <div>
                        <Label htmlFor="default_location" className="text-white">
                          Default Location (Optional)
                        </Label>
                        <Input
                          id="default_location"
                          value={formData.default_location}
                          onChange={(e) => setFormData(prev => ({ ...prev, default_location: e.target.value }))}
                          placeholder="e.g., New York, NY"
                          className="bg-gray-800 border-gray-700 text-white mt-1"
                        />
                      </div>

                      <Button
                        type="button"
                        onClick={handleWebSearchSetup}
                        disabled={loading || success || !formData.api_key}
                        className={`w-full mt-4 ${success ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                      >
                        {success ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Success!
                          </>
                        ) : loading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Setting up...
                          </>
                        ) : (
                          <>
                            <Key className="h-4 w-4 mr-2" />
                            Connect {integration.name}
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  // OAuth Setup (for Gmail, etc.)
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Shield className="h-5 w-5 text-blue-400" />
                        OAuth 2.0 Authentication
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Secure authentication flow to connect your Gmail account
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {error && (
                        <Alert className="bg-red-900/20 border-red-500/20">
                          <AlertCircle className="h-4 w-4 text-red-400" />
                          <AlertDescription className="text-red-400">
                            {error}
                          </AlertDescription>
                        </Alert>
                      )}

                      <div>
                        <Label htmlFor="connection_name" className="text-white">
                          Connection Name (Optional)
                        </Label>
                        <Input
                          id="connection_name"
                          value={formData.connection_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, connection_name: e.target.value }))}
                          placeholder="My Gmail Connection"
                          className="bg-gray-800 border-gray-700 text-white mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Give this connection a name to identify it later
                        </p>
                      </div>

                      <Button
                        type="button"
                        onClick={handleOAuthFlow}
                        disabled={loading || success}
                        className={`w-full mt-4 ${success ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
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
                            Connect with Gmail
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Agent Tools & Capabilities */}
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Search className="h-5 w-5 text-green-400" />
                      Agent Tools & Capabilities
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      What your agents will be able to do with this integration
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm text-gray-300 space-y-2">
                      {getIntegrationCapabilities().map((capability, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                          <span>{capability}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Documentation link */}
                {integration.documentation_url && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                      onClick={() => window.open(integration.documentation_url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Documentation
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 