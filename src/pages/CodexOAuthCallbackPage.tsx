import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function CodexOAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const completeOAuth = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const oauthError = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (oauthError) throw new Error(errorDescription || oauthError);
        if (!code || !state) throw new Error('OpenAI Codex did not return an authorization code and state');

        const { data, error: functionError } = await supabase.functions.invoke('codex-oauth', {
          body: { action: 'callback', code, state },
        });
        if (functionError) throw functionError;
        if (!data?.success) throw new Error(data?.error || 'Failed to complete Codex OAuth');

        setSuccess(true);
        toast.success('OpenAI Codex connected');
        setTimeout(() => navigate('/credentials'), 2500);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to complete Codex OAuth';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    completeOAuth();
  }, [navigate, searchParams]);

  return (
    <div className="container mx-auto py-12 max-w-2xl">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">OpenAI Codex Connection</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          {loading && (
            <div className="flex flex-col items-center gap-4">
              <RefreshCw className="w-12 h-12 animate-spin text-blue-600" />
              <div>
                <h3 className="text-lg font-medium">Connecting Codex...</h3>
                <p className="text-muted-foreground">Please wait while we finish your ChatGPT authorization.</p>
              </div>
            </div>
          )}
          {success && !loading && (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
              <div>
                <h3 className="text-lg font-medium text-green-800">Successfully Connected</h3>
                <p className="text-muted-foreground">Redirecting back to credentials...</p>
              </div>
            </div>
          )}
          {error && !loading && (
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="w-12 h-12 text-red-600" />
              <div>
                <h3 className="text-lg font-medium text-red-800">Connection Failed</h3>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => navigate('/credentials')}>Return to Credentials</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
