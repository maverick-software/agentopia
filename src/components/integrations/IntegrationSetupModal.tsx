import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGmailConnection } from '@/hooks/useGmailIntegration';
import { 
  Shield, 
  Globe, 
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Loader2
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Gmail OAuth hook
  const { connection: gmailConnection, initiateOAuth: gmailInitiateOAuth } = useGmailConnection();
  
  // Form state
  const [formData, setFormData] = useState({
    connection_name: ''
  });

  // Reset state when modal is closed
  const resetModalState = () => {
    setLoading(false);
    setError(null);
    setSuccess(false);
    setSuccessMessage('');
    setFormData({
      connection_name: ''
    });
  };

  // Handle modal close with state reset
  const handleClose = () => {
    resetModalState();
    onClose();
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <div className="p-2 bg-gray-800 rounded-lg">
              <Globe className="h-5 w-5 text-blue-400" />
            </div>
            Setup {integration.name}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Connect your {integration.name} account to enable email management capabilities for your agents.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
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
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Give this connection a name to identify it later
                    </p>
                  </div>

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
                        Connect with Gmail
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* About this integration */}
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <h4 className="font-medium text-white">Agent Tools & Capabilities:</h4>
                    <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                      <li>Send and receive emails through your agents</li>
                      <li>Read and search your email messages</li>
                      <li>Manage email labels and folders</li>
                      <li>Secure OAuth authentication</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Documentation link */}
              {integration.documentation_url && (
                <div className="flex justify-center">
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
      </DialogContent>
    </Dialog>
  );
} 