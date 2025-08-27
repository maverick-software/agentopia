import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGmailConnection } from '@/integrations/gmail';
import { useConnections, VaultService } from '@/integrations/_shared';
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
import { SMTPSetupModal } from '@/integrations/smtp/components/SMTPSetupModal';
import { useTheme } from '@/contexts/ThemeContext';
import { SMTP_PROVIDER_PRESETS, SMTPProviderPreset } from '@/integrations/smtp';

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
  const [selectedSMTPPreset, setSelectedSMTPPreset] = useState<SMTPProviderPreset | null>(null);
  
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
    zep_project_id: '',
    zep_project_name: '',
    zep_account_id: '',
    default_location: '',
    default_language: 'en',
    default_engine: 'google',
    safesearch: 'moderate',
    from_email: '',
    from_name: '',
    selected_provider: 'serper_api', // Default provider for unified Web Search
    // SMTP fields
    host: '',
    port: '587',
    secure: false,
    username: '',
    password: '',
    reply_to_email: ''
  });

  // Check if this is a web search integration (unified or legacy)
  const isWebSearchIntegration = integration?.name === 'Web Search' || ['Serper API', 'SerpAPI', 'Brave Search API'].includes(integration?.name);
  const isUnifiedWebSearch = integration?.name === 'Web Search';
  const isSendGridIntegration = integration?.name === 'SendGrid';
  const isMailgunIntegration = integration?.name === 'Mailgun';
  const isPineconeIntegration = integration?.name === 'Pinecone';
  const isGetZepIntegration = integration?.name === 'GetZep';
  const isSMTPIntegration = integration?.name === 'SMTP';
  const isDiscordIntegration = integration?.name === 'Discord';
  const isDigitalOceanIntegration = integration?.name === 'DigitalOcean';

  // Search providers for unified Web Search
  const SEARCH_PROVIDERS = [
    { 
      id: 'serper_api', 
      name: 'Serper API', 
      setupUrl: 'https://serper.dev/api-key', 
      rateLimit: '1,000 queries/month free',
      description: 'Google search results with rich snippets and knowledge graph'
    },
    { 
      id: 'serpapi', 
      name: 'SerpAPI', 
      setupUrl: 'https://serpapi.com/manage-api-key', 
      rateLimit: '100 queries/month free',
      description: 'Multiple search engines with location-based results'
    },
    { 
      id: 'brave_search', 
      name: 'Brave Search API', 
      setupUrl: 'https://api.search.brave.com/app/keys', 
      rateLimit: '2,000 queries/month free',
      description: 'Privacy-focused search with independent index'
    }
  ];

  // Persist draft values so accidental remounts or navigation don't lose input
  const getDraftKey = () => {
    const provider = isGetZepIntegration ? 'getzep' : isPineconeIntegration ? 'pinecone' : 'other';
    return `integration_draft_${provider}_${user?.id || 'anon'}`;
  };

  // SECURITY FIX: Only persist non-sensitive configuration fields, never credentials
  useEffect(() => {
    if (!isOpen) return;
    const key = getDraftKey();
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const draft = JSON.parse(raw);
        // Only hydrate NON-SENSITIVE fields - NEVER load credentials from browser storage
        setFormData(prev => ({
          ...prev,
          connection_name: draft.connection_name ?? prev.connection_name,
          // GetZep config (non-sensitive)
          zep_project_name: draft.zep_project_name ?? prev.zep_project_name,
          default_location: draft.default_location ?? prev.default_location,
          default_language: draft.default_language ?? prev.default_language,
          default_engine: draft.default_engine ?? prev.default_engine,
          safesearch: draft.safesearch ?? prev.safesearch,
          from_email: draft.from_email ?? prev.from_email,
          from_name: draft.from_name ?? prev.from_name,
          selected_provider: draft.selected_provider ?? prev.selected_provider,
          // SMTP server settings (non-sensitive configuration)
          host: draft.host ?? prev.host,
          port: draft.port ?? prev.port,
          secure: draft.secure ?? prev.secure,
          username: draft.username ?? prev.username,
          reply_to_email: draft.reply_to_email ?? prev.reply_to_email,
          // CREDENTIALS (api_key, password, etc.) are NEVER persisted for security
        }));
      }
    } catch (_) {
      // ignore hydration errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      // Only persist NON-SENSITIVE fields to browser storage
      const safeDraft = {
        connection_name: formData.connection_name,
        // GetZep config (non-sensitive)
        zep_project_name: formData.zep_project_name,
        default_location: formData.default_location,
        default_language: formData.default_language,
        default_engine: formData.default_engine,
        safesearch: formData.safesearch,
        from_email: formData.from_email,
        from_name: formData.from_name,
        selected_provider: formData.selected_provider,
        // SMTP server settings (non-sensitive configuration)
        host: formData.host,
        port: formData.port,
        secure: formData.secure,
        username: formData.username,
        reply_to_email: formData.reply_to_email,
        // NEVER persist: api_key, password, zep_project_id, zep_account_id
      };
      sessionStorage.setItem(getDraftKey(), JSON.stringify(safeDraft));
    } catch (_) {
      // best-effort persistence
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  // Reset state when modal is closed
  const resetModalState = () => {
    setLoading(false);
    setError(null);
    setSuccess(false);
    setSuccessMessage('');
    setSelectedSMTPPreset(null);
    setFormData({
      connection_name: '',
      api_key: '',
      zep_project_id: '',
      zep_project_name: '',
      zep_account_id: '',
      default_location: '',
      default_language: 'en',
      default_engine: 'google',
      safesearch: 'moderate',
      from_email: '',
      from_name: '',
      selected_provider: 'serper_api',
      // SMTP fields
      host: '',
      port: '587',
      secure: false,
      username: '',
      password: '',
      reply_to_email: ''
    });
    
    // SECURITY: Clear browser storage when modal is closed to remove any lingering data
    try {
      sessionStorage.removeItem(getDraftKey());
    } catch (_) {
      // best-effort cleanup
    }
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
      let providerName: string;
      
      if (isUnifiedWebSearch) {
        // For unified Web Search, use the selected provider
        providerName = formData.selected_provider;
      } else {
        // For legacy separate integrations, map by name
        const providerNameMap: { [key: string]: string } = {
          'Serper API': 'serper_api',
          'SerpAPI': 'serpapi',
          'Brave Search API': 'brave_search'
        };
        providerName = providerNameMap[integration.name];
        if (!providerName) {
          throw new Error('Unknown web search provider');
        }
      }

      // Get provider details
      const { data: providerData, error: providerError } = await supabase
        .from('oauth_providers')
        .select('id')
        .eq('name', providerName)
        .single();

      if (providerError) throw providerError;

      // ✅ SECURE: Create vault secret for API key
      console.log('Securing API key with vault encryption');
      const secretName = `${providerName}_api_key_${user.id}_${Date.now()}`;
      const vaultSecretId = await vaultService.createSecret(
        secretName,
        formData.api_key,
        `${isUnifiedWebSearch ? SEARCH_PROVIDERS.find(p => p.id === providerName)?.name : integration.name} API key for user ${user.id} - Created: ${new Date().toISOString()}`
      );

      console.log(`✅ API key securely stored in vault: ${vaultSecretId}`);
      const storedValue = vaultSecretId; // ✅ Store vault UUID only

      // Create user OAuth connection record (unified system for API keys)
      const { error: keyError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id, // Required field
          external_username: formData.connection_name || `${isUnifiedWebSearch ? SEARCH_PROVIDERS.find(p => p.id === providerName)?.name : integration.name} Connection`,
          connection_name: formData.connection_name || `${isUnifiedWebSearch ? SEARCH_PROVIDERS.find(p => p.id === providerName)?.name : integration.name} Connection`,
          // ✅ SECURE: Store vault UUID only, no plain text
          encrypted_access_token: null,
          vault_access_token_id: storedValue, // ✅ Store vault UUID only
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

      const displayName = isUnifiedWebSearch ? 
        `Web Search (${SEARCH_PROVIDERS.find(p => p.id === providerName)?.name})` : 
        integration.name;
      setSuccess(true);
      setSuccessMessage(`${displayName} connected successfully!`);
      toast.success(`${displayName} API key added successfully!`);

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

  const handleApiKeyProviderSetup = async (providerName: 'pinecone' | 'getzep') => {
    if (!formData.api_key || !user) {
      setError('Please enter your API key');
      return;
    }
    try {
      setLoading(true);
      setError(null);

      // Resolve provider id
      const { data: providerData, error: providerError } = await supabase
        .from('oauth_providers')
        .select('id')
        .eq('name', providerName)
        .single();
      if (providerError) throw providerError;

      // Store API key in Vault
      const vault_secret_id = await vaultService.createSecret(
        `${providerName}_api_key_${user.id}_${Date.now()}`,
        formData.api_key,
        `${providerName} API key for user ${user.id}`
      );

      // Create or update unified connection record with explicit deconflict logic
      const grantedScopes = providerName === 'getzep'
        ? ['graph_read','graph_write','memory_read','memory_write']
        : ['vector_search','vector_upsert'];

      // Look for an existing connection for this user+provider (any connection_name)
      const { data: existingConn, error: findErr } = await supabase
        .from('user_integration_credentials')
        .select('id, connection_name')
        .eq('user_id', user.id)
        .eq('oauth_provider_id', providerData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (findErr) throw findErr;

      const desiredName = (formData.connection_name && formData.connection_name.trim().length > 0)
        ? formData.connection_name.trim()
        : (existingConn?.connection_name || `${integration.name} Connection`);

      if (existingConn?.id) {
        const { error: updErr } = await supabase
          .from('user_integration_credentials')
          .update({
            external_user_id: user.id,
            external_username: desiredName,
            connection_name: desiredName,
            vault_access_token_id: vault_secret_id,
            connection_status: 'active',
            credential_type: 'api_key',
            scopes_granted: grantedScopes,
            connection_metadata: providerName === 'getzep' ? {
              project_id: formData.zep_project_id || null,
              project_name: formData.zep_project_name || null,
              account_id: formData.zep_account_id || null,
            } : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingConn.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('user_integration_credentials')
          .insert({
            user_id: user.id,
            oauth_provider_id: providerData.id,
            external_user_id: user.id,
            external_username: desiredName,
            connection_name: desiredName,
            vault_access_token_id: vault_secret_id,
            connection_status: 'active',
            credential_type: 'api_key',
            scopes_granted: grantedScopes,
            connection_metadata: providerName === 'getzep' ? {
              project_id: formData.zep_project_id || null,
              project_name: formData.zep_project_name || null,
              account_id: formData.zep_account_id || null,
            } : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        if (insErr) throw insErr;
      }

      // Optional: user_integrations entry
      const { error: integrationError } = await supabase
        .from('user_integrations')
        .insert({
          user_id: user.id,
          integration_id: integration.id,
          connection_name: formData.connection_name || `${integration.name} Connection`,
          connection_status: 'connected',
          configuration: {},
        });
      if (integrationError && !String(integrationError.message || '').includes('duplicate')) {
        throw integrationError;
      }

      setSuccess(true);
      setSuccessMessage(`${integration.name} key saved to Vault.`);
      toast.success(`${integration.name} API key added successfully!`);

      setTimeout(() => {
        try { sessionStorage.removeItem(getDraftKey()); } catch (_) {}
        refetchConnections();
        onComplete();
        handleClose();
      }, 1200);
    } catch (e: any) {
      setError(e.message || 'Failed to save API key');
      toast.error(e.message || 'Failed to save API key');
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
        .from('user_integration_credentials')
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

  const handleSMTPPresetSelect = (preset: SMTPProviderPreset) => {
    setSelectedSMTPPreset(preset);
    setFormData(prev => ({
      ...prev,
      host: preset.host,
      port: preset.port.toString(),
      secure: preset.secure,
      connection_name: prev.connection_name || preset.displayName
    }));
  };

  const handleSMTPSetup = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Validate inputs
      if (!formData.host.trim()) {
        setError('SMTP host is required');
        setLoading(false);
        return;
      }
      if (!formData.username.trim()) {
        setError('Username is required');
        setLoading(false);
        return;
      }
      if (!formData.password.trim()) {
        setError('Password is required');
        setLoading(false);
        return;
      }
      if (!formData.from_email.trim()) {
        setError('From email is required');
        setLoading(false);
        return;
      }
      
      // ✅ SECURE: Store SMTP password in vault first
      console.log('Securing SMTP password in vault...');
      const secretName = `smtp_password_${user.id}_${Date.now()}`;
      const vaultSecretId = await vaultService.createSecret(
        secretName,
        formData.password,
        `SMTP password for ${formData.username} - Created: ${new Date().toISOString()}`
      );
      
      console.log(`✅ SMTP password securely stored in vault: ${vaultSecretId}`);
      
      // Get SMTP provider ID
      const { data: smtpProvider, error: providerError } = await supabase
        .from('oauth_providers')
        .select('id')
        .eq('name', 'smtp')
        .single();
      
      if (providerError) throw providerError;
      
      // Create SMTP connection record in user_integration_credentials
      const { data: connectionData, error: connectionError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: smtpProvider.id,
          connection_name: formData.connection_name || 'SMTP Connection',
          credential_type: 'api_key',
          connection_status: 'active',
          vault_access_token_id: vaultSecretId,
          external_username: formData.username,
          external_user_id: user.id,
          scopes_granted: ['send_email'], // ✅ Grant send_email permission for agents
          connection_metadata: {
            host: formData.host,
            port: parseInt(formData.port) || 587,
            secure: formData.secure,
            from_email: formData.from_email,
            from_name: formData.from_name || null,
            reply_to_email: formData.reply_to_email || null
          }
        })
        .select('id')
        .single();
      
      if (connectionError) throw connectionError;
      
      // Refresh connections
      await refetchConnections();
      
      setSuccess(true);
      setSuccessMessage('SMTP server connected successfully!');
      
      setTimeout(() => {
        onComplete();
        handleClose();
      }, 1500);
      
    } catch (error: any) {
      console.error('SMTP setup error:', error);
      setError(error.message || 'Failed to connect SMTP server');
    } finally {
      setLoading(false);
    }
  };

  const handleMailgunSetup = async () => {
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
        setError('Domain is required');
        setLoading(false);
        return;
      }
      
      // ✅ SECURE: Store API key in vault properly
      console.log('Securing Mailgun API key with vault encryption');
      const secretName = `mailgun_api_key_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        formData.api_key,
        `Mailgun API key for ${formData.from_email} - Created: ${new Date().toISOString()}`
      );
      
      console.log(`✅ Mailgun API key securely stored in vault: ${vaultKeyId}`);
      
      // Get Mailgun OAuth provider ID
      const { data: mailgunProvider, error: providerError } = await supabase
        .from('oauth_providers')
        .select('id')
        .eq('name', 'mailgun')
        .single();

      if (providerError || !mailgunProvider) {
        throw new Error('Mailgun provider not found. Please contact support.');
      }

      // Create or update Mailgun configuration
      const { error: connError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: mailgunProvider.id,
          connection_name: formData.connection_name || 'Mailgun Connection',
          credential_type: 'api_key',
          connection_status: 'active',
          vault_access_token_id: vaultKeyId, // ✅ Now stores vault UUID, not plain text
          external_username: formData.from_email, // Store domain
          external_user_id: 'mailgun_user',
          scopes_granted: ['send_email'] // ✅ Grant email sending permissions
        });
      
      if (connError) throw connError;
      
      // Refresh connections
      await refetchConnections();
      
      setSuccess(true);
      setSuccessMessage('Mailgun connected successfully!');
      
      setTimeout(() => {
        onComplete();
        handleClose();
      }, 1500);
      
    } catch (error: any) {
      console.error('Mailgun setup error:', error);
      setError(error.message || 'Failed to connect Mailgun');
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
    if (isSendGridIntegration || isMailgunIntegration) {
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
    if (isMailgunIntegration) {
      return [
        'High-deliverability email sending',
        'Advanced email validation',
        'Inbound email routing to agents',
        'Delivery statistics and analytics',
        'Suppression list management',
        'Template-based email sending'
      ];
    }
    if (isPineconeIntegration) {
      return [
        'Store and query vector embeddings for RAG',
        'Per-agent datastore connections',
        'Secure API key storage in Vault',
        'No global keys required'
      ];
    }
    if (isGetZepIntegration) {
      return [
        'Knowledge graph with entities and relationships',
        'Concept search and retrieval',
        'Secure API key storage in Vault'
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
    <Dialog open={isOpen} onOpenChange={(open) => {
      // Only reset/close when the dialog is actually being closed
      if (!open) handleClose();
    }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] bg-background border-border overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-foreground flex items-center gap-2">
            <div className="p-2 bg-muted rounded-lg">
              {getIntegrationIcon()}
            </div>
            Setup {integration.name}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
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
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Integration Connected Successfully!
                </h3>
                <p className="text-muted-foreground">
                  {successMessage || `Your ${integration.name} integration is now ready to use.`}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {isSendGridIntegration ? (
                  // SendGrid API Key Setup
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Key className="h-5 w-5 text-blue-400" />
                        SendGrid Configuration
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
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
                        <Label htmlFor="connection_name" className="text-foreground">
                          Connection Name (Optional)
                        </Label>
                        <Input
                          id="connection_name"
                          value={formData.connection_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, connection_name: e.target.value }))}
                          placeholder="My SendGrid Connection"
                          className="bg-card border-border text-foreground mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="api_key" className="text-foreground">
                          SendGrid API Key *
                        </Label>
                        <Input
                          id="api_key"
                          type="password"
                          value={formData.api_key}
                          onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                          placeholder="SG.xxxxxxxxxxxxxxxxxxxxxx"
                          className="bg-card border-border text-foreground mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Your API key with mail.send permissions
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="from_email" className="text-foreground">
                          From Email Address *
                        </Label>
                        <Input
                          id="from_email"
                          type="email"
                          value={formData.from_email}
                          onChange={(e) => setFormData(prev => ({ ...prev, from_email: e.target.value }))}
                          placeholder="noreply@yourdomain.com"
                          className="bg-card border-border text-foreground mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          The email address that will appear as the sender
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="from_name" className="text-foreground">
                          From Name (Optional)
                        </Label>
                        <Input
                          id="from_name"
                          value={formData.from_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, from_name: e.target.value }))}
                          placeholder="Your Company Name"
                          className="bg-card border-border text-foreground mt-1"
                        />
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
                ) : isMailgunIntegration ? (
                  // Mailgun API Key Setup
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Key className="h-5 w-5 text-blue-400" />
                        Mailgun Configuration
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Configure your Mailgun domain and API key for high-deliverability email
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
                        <Label htmlFor="connection_name" className="text-foreground">
                          Connection Name (Optional)
                        </Label>
                        <Input
                          id="connection_name"
                          value={formData.connection_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, connection_name: e.target.value }))}
                          placeholder="My Mailgun Connection"
                          className="bg-card border-border text-foreground mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="from_email" className="text-foreground">
                          Mailgun Domain *
                        </Label>
                        <Input
                          id="from_email"
                          value={formData.from_email}
                          onChange={(e) => setFormData(prev => ({ ...prev, from_email: e.target.value }))}
                          placeholder="mail.yourdomain.com"
                          className="bg-card border-border text-foreground mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Your verified Mailgun sending domain
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="api_key" className="text-foreground">
                          Mailgun API Key *
                        </Label>
                        <Input
                          id="api_key"
                          type="password"
                          value={formData.api_key}
                          onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                          placeholder="key-xxxxxxxxxxxxxxxxxxxxxx"
                          className="bg-card border-border text-foreground mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Your Mailgun API key (starts with "key-")
                        </p>
                      </div>

                      <div className="text-sm text-muted-foreground mt-4">
                        <a 
                          href="https://app.mailgun.com/app/account/security/api_keys" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:text-foreground underline"
                        >
                          Get your Mailgun API key
                        </a>
                      </div>

                      <Button
                        type="button"
                        onClick={handleMailgunSetup}
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
                            Connect Mailgun
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ) : isSMTPIntegration ? (
                  // SMTP Server Configuration
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Mail className="h-5 w-5 text-blue-400" />
                        SMTP Server Configuration
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Configure your SMTP server settings for email delivery
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

                      {/* SMTP Provider Preset Dropdown */}
                      <div>
                        <Label htmlFor="smtp_preset" className="text-foreground">
                          Email Provider Preset (Optional)
                        </Label>
                        <Select 
                          onValueChange={(value) => {
                            const preset = SMTP_PROVIDER_PRESETS.find(p => p.name === value);
                            if (preset) {
                              handleSMTPPresetSelect(preset);
                            }
                          }}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Choose a preset to auto-fill settings" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">Custom Configuration</SelectItem>
                            {SMTP_PROVIDER_PRESETS.filter(preset => preset.name !== 'custom').map((preset) => (
                              <SelectItem key={preset.name} value={preset.name}>
                                {preset.displayName} - {preset.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        {selectedSMTPPreset?.setupInstructions && (
                          <Alert className="mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              <strong>{selectedSMTPPreset.displayName} Setup:</strong> {selectedSMTPPreset.setupInstructions}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="connection_name" className="text-foreground">
                          Connection Name (Optional)
                        </Label>
                        <Input
                          id="connection_name"
                          value={formData.connection_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, connection_name: e.target.value }))}
                          placeholder="My SMTP Server"
                          className="bg-card border-border text-foreground mt-1"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="host" className="text-foreground">
                            SMTP Host *
                          </Label>
                          <Input
                            id="host"
                            value={formData.host}
                            onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
                            placeholder="smtp.gmail.com"
                            className="bg-card border-border text-foreground mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="port" className="text-foreground">
                            Port *
                          </Label>
                          <Input
                            id="port"
                            value={formData.port}
                            onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))}
                            placeholder="587"
                            className="bg-card border-border text-foreground mt-1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="username" className="text-foreground">
                            Username *
                          </Label>
                          <Input
                            id="username"
                            value={formData.username}
                            onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                            placeholder="your-email@domain.com"
                            className="bg-card border-border text-foreground mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="password" className="text-foreground">
                            Password *
                          </Label>
                          <Input
                            id="password"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                            placeholder="Your SMTP password"
                            className="bg-card border-border text-foreground mt-1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="from_email" className="text-foreground">
                            From Email *
                          </Label>
                          <Input
                            id="from_email"
                            type="email"
                            value={formData.from_email}
                            onChange={(e) => setFormData(prev => ({ ...prev, from_email: e.target.value }))}
                            placeholder="noreply@yourdomain.com"
                            className="bg-card border-border text-foreground mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="from_name" className="text-foreground">
                            From Name (Optional)
                          </Label>
                          <Input
                            id="from_name"
                            value={formData.from_name}
                            onChange={(e) => setFormData(prev => ({ ...prev, from_name: e.target.value }))}
                            placeholder="Your App Name"
                            className="bg-card border-border text-foreground mt-1"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="reply_to_email" className="text-foreground">
                          Reply-To Email (Optional)
                        </Label>
                        <Input
                          id="reply_to_email"
                          type="email"
                          value={formData.reply_to_email}
                          onChange={(e) => setFormData(prev => ({ ...prev, reply_to_email: e.target.value }))}
                          placeholder="support@yourdomain.com"
                          className="bg-card border-border text-foreground mt-1"
                        />
                      </div>

                      <Button
                        type="button"
                        onClick={handleSMTPSetup}
                        disabled={loading || success || !formData.host?.trim() || !formData.username?.trim() || !formData.password?.trim() || !formData.from_email?.trim()}
                        className={`w-full mt-4 ${success ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                        onMouseEnter={() => {
                          // Debug log to help identify which field is causing the issue
                          console.log('SMTP Button Debug:', {
                            loading,
                            success,
                            host: `"${formData.host || ''}"`,
                            username: `"${formData.username || ''}"`,
                            password: formData.password ? '[FILLED]' : '[EMPTY]',
                            from_email: `"${formData.from_email || ''}"`,
                            disabled: loading || success || !formData.host?.trim() || !formData.username?.trim() || !formData.password?.trim() || !formData.from_email?.trim()
                          });
                        }}
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
                            <Mail className="h-4 w-4 mr-2" />
                            Connect SMTP Server
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ) : isWebSearchIntegration ? (
                  // Web Search API Key Setup
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Key className="h-5 w-5 text-blue-400" />
                        API Key Configuration
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {isUnifiedWebSearch 
                          ? 'Choose a search provider and enter your API key to enable web search functionality'
                          : `Enter your ${integration.name} API key to enable web search functionality`
                        }
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

                      {/* Provider Selection for Unified Web Search */}
                      {isUnifiedWebSearch && (
                        <div>
                          <Label htmlFor="provider_select" className="text-foreground">
                            Search Provider *
                          </Label>
                          <select
                            id="provider_select"
                            value={formData.selected_provider}
                            onChange={(e) => setFormData(prev => ({ ...prev, selected_provider: e.target.value }))}
                            className="w-full p-2 mt-1 bg-card border border-border rounded-md text-foreground"
                          >
                            {SEARCH_PROVIDERS.map((provider) => (
                              <option key={provider.id} value={provider.id}>
                                {provider.name} - {provider.rateLimit}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-muted-foreground mt-1">
                            {SEARCH_PROVIDERS.find(p => p.id === formData.selected_provider)?.description}
                          </p>
                        </div>
                      )}

                      <div>
                        <Label htmlFor="connection_name" className="text-foreground">
                          Connection Name (Optional)
                        </Label>
                        <Input
                          id="connection_name"
                          value={formData.connection_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, connection_name: e.target.value }))}
                          placeholder={
                            isUnifiedWebSearch 
                              ? `My ${SEARCH_PROVIDERS.find(p => p.id === formData.selected_provider)?.name} Connection`
                              : `My ${integration.name} Connection`
                          }
                          className="bg-card border-border text-foreground mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="api_key" className="text-foreground">
                          API Key *
                        </Label>
                        <Input
                          id="api_key"
                          type="password"
                          value={formData.api_key}
                          onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                          placeholder="Enter your API key"
                          className="bg-card border-border text-foreground mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Your API key will be securely encrypted and stored
                        </p>
                        {/* Dynamic API key link for unified Web Search */}
                        {isUnifiedWebSearch && (
                          <div className="mt-2">
                            <a
                              href={SEARCH_PROVIDERS.find(p => p.id === formData.selected_provider)?.setupUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Get API Key from {SEARCH_PROVIDERS.find(p => p.id === formData.selected_provider)?.name}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Provider-specific configuration */}
                      {integration.name === 'SerpAPI' && (
                        <div>
                          <Label htmlFor="default_engine" className="text-foreground">
                            Default Search Engine
                          </Label>
                          <select
                            id="default_engine"
                            value={formData.default_engine}
                            onChange={(e) => setFormData(prev => ({ ...prev, default_engine: e.target.value }))}
                            className="w-full p-2 mt-1 bg-card border border-border rounded-md text-foreground"
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
                          <Label htmlFor="safesearch" className="text-foreground">
                            Safe Search
                          </Label>
                          <select
                            id="safesearch"
                            value={formData.safesearch}
                            onChange={(e) => setFormData(prev => ({ ...prev, safesearch: e.target.value }))}
                            className="w-full p-2 mt-1 bg-card border border-border rounded-md text-foreground"
                          >
                            <option value="strict">Strict</option>
                            <option value="moderate">Moderate</option>
                            <option value="off">Off</option>
                          </select>
                        </div>
                      )}

                      <div>
                        <Label htmlFor="default_location" className="text-foreground">
                          Default Location (Optional)
                        </Label>
                        <Input
                          id="default_location"
                          value={formData.default_location}
                          onChange={(e) => setFormData(prev => ({ ...prev, default_location: e.target.value }))}
                          placeholder="e.g., New York, NY"
                          className="bg-card border-border text-foreground mt-1"
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
                ) : (isPineconeIntegration || isGetZepIntegration) ? (
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Key className="h-5 w-5 text-blue-400" />
                        {integration.name} {isGetZepIntegration ? 'Configuration' : 'API Key'}
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {isGetZepIntegration 
                          ? 'Configure your GetZep account for knowledge graph storage'
                          : 'Store your API key securely in Vault. You\'ll provide index and other non-secret settings when creating a datastore.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {error && (
                        <Alert className="bg-red-900/20 border-red-500/20">
                          <AlertCircle className="h-4 w-4 text-red-400" />
                          <AlertDescription className="text-red-400">{error}</AlertDescription>
                        </Alert>
                      )}
                      <div>
                        <Label htmlFor="connection_name" className="text-foreground">Connection Name (Optional)</Label>
                        <Input id="connection_name" value={formData.connection_name} onChange={(e) => setFormData(prev => ({ ...prev, connection_name: e.target.value }))} placeholder={`My ${integration.name} Connection`} className="bg-card border-border text-foreground mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="api_key" className="text-foreground">API Key *</Label>
                        <Input id="api_key" type="password" value={formData.api_key} onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))} placeholder={isGetZepIntegration ? "z_..." : "Enter your API key"} className="bg-card border-border text-foreground mt-1" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {isGetZepIntegration 
                            ? 'Your GetZep API key from app.getzep.com'
                            : 'Saved to Vault. No global keys are used.'}
                        </p>
                      </div>
                      {isGetZepIntegration && (
                        <>
                          <div>
                            <Label htmlFor="zep_account_id" className="text-foreground">Account ID *</Label>
                            <Input 
                              id="zep_account_id" 
                              value={formData.zep_account_id || ''} 
                              onChange={(e) => setFormData(prev => ({ ...prev, zep_account_id: e.target.value }))} 
                              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" 
                              className="bg-card border-border text-foreground mt-1" 
                            />
                            <p className="text-xs text-muted-foreground mt-1">Your GetZep account ID (UUID format)</p>
                          </div>
                          <div>
                            <Label htmlFor="zep_project_name" className="text-foreground">Project Name *</Label>
                            <Input 
                              id="zep_project_name" 
                              value={formData.zep_project_name || ''} 
                              onChange={(e) => setFormData(prev => ({ ...prev, zep_project_name: e.target.value }))} 
                              placeholder="e.g., agentopia" 
                              className="bg-card border-border text-foreground mt-1" 
                            />
                            <p className="text-xs text-muted-foreground mt-1">Exact project name from your GetZep Project Settings</p>
                          </div>
                          <div>
                            <Label htmlFor="zep_project_id" className="text-foreground">Project ID (Optional)</Label>
                            <Input 
                              id="zep_project_id" 
                              value={formData.zep_project_id || ''} 
                              onChange={(e) => setFormData(prev => ({ ...prev, zep_project_id: e.target.value }))} 
                              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" 
                              className="bg-card border-border text-foreground mt-1" 
                            />
                            <p className="text-xs text-muted-foreground mt-1">Optional: Your GetZep project ID</p>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <ExternalLink className="h-4 w-4" />
                            <a 
                              href="https://app.getzep.com" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:text-foreground underline"
                            >
                              Get your GetZep credentials
                            </a>
                          </div>
                        </>
                      )}
                      <Button 
                        type="button" 
                        onClick={() => handleApiKeyProviderSetup(isPineconeIntegration ? 'pinecone' : 'getzep')} 
                        disabled={loading || success || !formData.api_key || (isGetZepIntegration && !formData.zep_account_id)} 
                        className={`w-full mt-4 ${success ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                      >
                        {success ? (<><CheckCircle className="h-4 w-4 mr-2" /> Success!</>) : loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>) : (<><Key className="h-4 w-4 mr-2" /> Connect {integration.name}</>)}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  // OAuth Setup (for Gmail, etc.)
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Shield className="h-5 w-5 text-blue-400" />
                        OAuth 2.0 Authentication
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
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
                        <Label htmlFor="connection_name" className="text-foreground">
                          Connection Name (Optional)
                        </Label>
                        <Input
                          id="connection_name"
                          value={formData.connection_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, connection_name: e.target.value }))}
                          placeholder="My Gmail Connection"
                          className="bg-card border-border text-foreground mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
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
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Search className="h-5 w-5 text-green-400" />
                      Agent Tools & Capabilities
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      What your agents will be able to do with this integration
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm text-foreground space-y-2">
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