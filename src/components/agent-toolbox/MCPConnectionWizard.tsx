import React, { useMemo, useState } from 'react';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { UserMCPService } from '@/lib/services/userMCPService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const MCPConnectionWizard: React.FC<{
  agentId: string;
  serverId: string;
  serverName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ agentId, serverId, serverName, isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<'configure' | 'test' | 'confirm'>('configure');
  const [config, setConfig] = useState({ timeout: 30000, retryAttempts: 3, enableLogging: false });
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const userMCPService = useMemo(() => new UserMCPService(), []);

  const handleTest = async () => {
    try {
      setLoading(true);
      setStep('test');
      const result = await userMCPService.testServerConnection(serverId, config);
      setTestResult(result);
      if (result.success) setStep('confirm');
    } catch (error: any) {
      setTestResult({ success: false, error: error.message });
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      await userMCPService.connectAgent(agentId, serverId, config);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to connect agent:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect to {serverName}</DialogTitle>
        </DialogHeader>

        {step === 'configure' && (
          <div className="space-y-4">
            <div>
              <Label>Connection Timeout (ms)</Label>
              <Input
                type="number"
                value={config.timeout}
                onChange={(e) => setConfig((prev) => ({ ...prev, timeout: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
            <div>
              <Label>Retry Attempts</Label>
              <Input
                type="number"
                value={config.retryAttempts}
                onChange={(e) => setConfig((prev) => ({ ...prev, retryAttempts: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.enableLogging}
                onChange={(e) => setConfig((prev) => ({ ...prev, enableLogging: e.target.checked }))}
              />
              <Label>Enable debug logging</Label>
            </div>
            <Button onClick={handleTest} disabled={loading} className="w-full">
              Test Connection
            </Button>
          </div>
        )}

        {step === 'test' && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Testing connection to {serverName}...</p>
          </div>
        )}

        {step === 'confirm' && testResult && (
          <div className="space-y-4">
            {testResult.success ? (
              <div className="text-center">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-semibold">Connection Test Successful</h3>
                <p className="text-sm text-muted-foreground">Latency: {testResult.latency}ms</p>
                {testResult.capabilities && (
                  <div className="mt-4">
                    <Label>Available Capabilities:</Label>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {testResult.capabilities.map((cap: string, index: number) => (
                        <Badge key={index} variant="outline">
                          {cap}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                <h3 className="font-semibold">Connection Test Failed</h3>
                <p className="text-sm text-muted-foreground">{testResult.error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('configure')}>
                Back
              </Button>
              {testResult.success && (
                <Button onClick={handleConnect} disabled={loading} className="flex-1">
                  Connect Agent
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
