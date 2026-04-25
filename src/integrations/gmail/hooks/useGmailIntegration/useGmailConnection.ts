import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { GmailConnection } from './types';

export function useGmailConnection() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<GmailConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc('get_user_gmail_connections', {
        p_user_id: user.id,
      });

      if (fetchError) throw new Error(fetchError.message);
      if (data && data.length > 0) {
        setConnections(
          data.map((conn: any) => ({
            id: conn.connection_id,
            external_username: conn.external_username,
            scopes_granted: conn.scopes_granted,
            connection_status: conn.connection_status,
            connection_metadata: conn.connection_metadata || {},
            configuration: conn.configuration || {},
          })),
        );
      } else {
        setConnections([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Gmail connections');
    } finally {
      setLoading(false);
    }
  };

  const initiateOAuth = async (): Promise<void> => {
    if (!user) throw new Error('User not authenticated');

    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) throw new Error('No authenticated session');

    const redirectUri = `${window.location.origin}/integrations/gmail/callback`;
    const response = await supabase.functions.invoke('gmail-oauth-initiate', {
      body: {
        redirect_uri: redirectUri,
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify',
        ],
      },
      headers: {
        Authorization: `Bearer ${session.session.access_token}`,
      },
    });

    if (response.error) {
      if (response.data?.details) {
        throw new Error(
          'Gmail OAuth is not configured. Please contact your administrator to set up Google OAuth credentials.',
        );
      }
      throw new Error(response.error.message || 'Failed to initiate OAuth flow');
    }

    const { auth_url, state } = response.data;
    if (!auth_url) throw new Error('No authorization URL received from server');

    sessionStorage.setItem('gmail_oauth_state', state);
    const popup = window.open(
      auth_url,
      'gmail-oauth',
      'width=600,height=700,scrollbars=yes,resizable=yes',
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      throw new Error(
        'Popup blocked! Please allow popups for this site and try again. You can also try opening this page in a new tab instead of using a popup.',
      );
    }

    return new Promise((resolve, reject) => {
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'GMAIL_OAUTH_SUCCESS') {
          window.removeEventListener('message', handleMessage);
          clearInterval(checkClosed);
          clearTimeout(timeout);
          fetchConnections()
            .then(() => resolve())
            .catch(() => resolve());
        } else if (event.data.type === 'GMAIL_OAUTH_ERROR') {
          window.removeEventListener('message', handleMessage);
          clearInterval(checkClosed);
          clearTimeout(timeout);
          reject(new Error(event.data.data.error || 'OAuth flow failed'));
        }
      };

      window.addEventListener('message', handleMessage);
      const checkClosed = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          clearTimeout(timeout);
          window.removeEventListener('message', handleMessage);
          await new Promise((r) => setTimeout(r, 1000));

          try {
            const { data } = await supabase.rpc('get_user_gmail_connections', {
              p_user_id: user.id,
            });
            if (data && data.length > 0) {
              await fetchConnections();
              resolve();
            } else {
              reject(new Error('OAuth flow was cancelled or failed'));
            }
          } catch {
            reject(new Error('Failed to verify connection'));
          }
        }
      }, 1000);

      const timeout = setTimeout(() => {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        popup?.close();
        reject(new Error('OAuth flow timed out'));
      }, 300000);
    });
  };

  const handleOAuthCallback = async (code: string, state: string): Promise<void> => {
    const storedState = sessionStorage.getItem('gmail_oauth_state');
    if (!storedState || storedState !== state) throw new Error('Invalid state parameter');

    const stateData = JSON.parse(atob(state));
    const codeVerifier = stateData.code_verifier;
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) throw new Error('No authenticated session');

    const response = await supabase.functions.invoke('gmail-oauth', {
      body: {
        code,
        state,
        redirect_uri: `${window.location.origin}/integrations/gmail/callback`,
        code_verifier: codeVerifier,
      },
      headers: {
        Authorization: `Bearer ${session.session.access_token}`,
      },
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to complete OAuth flow');
    }

    sessionStorage.removeItem('gmail_oauth_state');
    await fetchConnections();
  };

  const disconnectGmail = async (connectionId: string): Promise<void> => {
    try {
      const { error: updateError } = await supabase
        .from('user_integration_credentials')
        .update({ connection_status: 'disconnected' })
        .eq('id', connectionId);
      if (updateError) throw new Error(updateError.message);
      await fetchConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Gmail');
      throw err;
    }
  };

  useEffect(() => {
    if (user) {
      fetchConnections();
    }
  }, [user]);

  return {
    connections,
    connection: connections.length > 0 ? connections[0] : null,
    loading,
    error,
    initiateOAuth,
    handleOAuthCallback,
    disconnectGmail,
    refetch: fetchConnections,
  };
}
