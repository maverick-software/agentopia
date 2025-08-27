import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { IntegrationSetupProps } from '../../_shared/types/IntegrationSetup';

/**
 * SendGrid Integration Setup Modal - Stub Implementation
 * TODO: Implement proper SendGrid API key setup
 */
export function SendGridSetupModal({
  integration,
  isOpen,
  onClose,
  onError
}: IntegrationSetupProps) {

  if (!isOpen) return null;

  // For now, show a coming soon message
  const handleComingSoon = () => {
    onError('SendGrid integration setup is being migrated to the new modular system. Please use the existing setup flow for now.');
    onClose();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SendGrid Integration</CardTitle>
          <CardDescription>
            Email delivery and marketing automation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>SendGrid integration is being updated.</strong></p>
                <p>Please use the existing SendGrid setup flow in the integrations page for now.</p>
                <p>The new modular setup experience will be available soon.</p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="flex justify-end mt-4">
            <button
              onClick={handleComingSoon}
              className="px-4 py-2 text-sm bg-muted hover:bg-muted/80 text-foreground rounded-md transition-colors"
            >
              Use Existing Setup
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
