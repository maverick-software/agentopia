import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Mail, 
  Loader2, 
  AlertCircle,
  Key
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { IntegrationSetupProps } from '../../_shared/types/IntegrationSetup';
import { VaultService } from '../../_shared';
import { useFormModalState } from '../../../hooks/useModalState';
import {
  EMAIL_PROVIDERS,
  EmailRelayFormData,
  INITIAL_EMAIL_RELAY_FORM_DATA,
  getEmailRelayValidationError,
  getProviderScopes,
  isEmailRelayFormValid,
} from './emailRelaySetup/constants';
import { ProviderConfigurationFields } from './emailRelaySetup/ProviderConfigurationFields';
import { EmailRelayCapabilitiesCard } from './emailRelaySetup/CapabilitiesCard';

/**
 * Email Relay Integration Setup Modal
 * Handles email provider selection and configuration
 */
export function EmailRelaySetupModal({
  integration,
  isOpen,
  onClose,
  onSuccess,
  onError,
  user,
  supabase
}: IntegrationSetupProps) {
  const [loading, setLoading] = useState(false);
  const [selectedSMTPPreset, setSelectedSMTPPreset] = useState<any>(null);
  
  // Use protected form state that persists across tab switches
  const {
    formData,
    errors,
    updateFormField,
    setFieldError,
    clearErrors
  } = useFormModalState<EmailRelayFormData>(
    INITIAL_EMAIL_RELAY_FORM_DATA,
    {
      preserveOnHidden: true,
      preserveOnBlur: true,
      onCleanup: () => {
        console.log('[EmailRelaySetupModal] Form state cleaned up');
        setSelectedSMTPPreset(null);
      }
    }
  );

  // Component lifecycle debugging (commented out for production)
  // useEffect(() => {
  //   if (isOpen) console.log('[EmailRelaySetupModal] Modal opened');
  // }, [isOpen]);

  const handleInputChange = (field: keyof EmailRelayFormData, value: string | boolean) => {
    updateFormField(field, value);
  };

  const handleSMTPPresetSelect = (preset: any) => {
    setSelectedSMTPPreset(preset);
    updateFormField('host', preset.host);
    updateFormField('port', preset.port.toString());
    updateFormField('secure', preset.secure);
    if (!formData.connection_name) {
      updateFormField('connection_name', preset.displayName);
    }
  };

  // Memoized form validation to prevent infinite re-renders
  const isFormValid = useMemo(() => {
    return isEmailRelayFormValid(formData);
  }, [formData]);

  const validateForm = () => {
    const error = getEmailRelayValidationError(formData);
    if (error) {
      setFieldError('connection_name', error);
      return false;
    }
    return true;
  };

  const handleEmailRelaySetup = async () => {
    if (!user || !validateForm()) return;

    setLoading(true);
    clearErrors();

    try {
      const selectedProvider = EMAIL_PROVIDERS.find(p => p.id === formData.selected_provider);
      if (!selectedProvider) {
        throw new Error('Invalid email provider selected');
      }

      // Get OAuth provider for the selected email provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', formData.selected_provider)
        .single();

      if (providerError) {
        throw new Error(`${selectedProvider.name} provider not found: ${providerError.message}`);
      }

      // Store credentials securely in vault
      const vaultService = new VaultService(supabase);
      let vaultKeyId: string;
      let metadata: Record<string, any> = {
        provider: formData.selected_provider,
        provider_name: selectedProvider.name
      };

      // Handle different provider configurations
      switch (formData.selected_provider) {
        case 'smtp':
          const smtpSecretName = `smtp_password_${user.id}_${Date.now()}`;
          vaultKeyId = await vaultService.createSecret(
            smtpSecretName,
            formData.password,
            `SMTP password for ${formData.connection_name || 'SMTP Connection'} - Created: ${new Date().toISOString()}`
          );
          metadata = {
            ...metadata,
            host: formData.host,
            port: parseInt(formData.port),
            secure: formData.secure,
            from_email: formData.from_email,
            from_name: formData.from_name,
            reply_to_email: formData.reply_to_email,
            provider_preset: selectedSMTPPreset?.name || 'custom'
          };
          break;

        case 'sendgrid':
          const sendgridSecretName = `sendgrid_api_key_${user.id}_${Date.now()}`;
          vaultKeyId = await vaultService.createSecret(
            sendgridSecretName,
            formData.api_key,
            `SendGrid API key for ${formData.connection_name || 'SendGrid Connection'} - Created: ${new Date().toISOString()}`
          );
          metadata = {
            ...metadata,
            from_email: formData.from_email,
            from_name: formData.from_name
          };
          break;

        case 'mailgun':
          const mailgunSecretName = `mailgun_api_key_${user.id}_${Date.now()}`;
          vaultKeyId = await vaultService.createSecret(
            mailgunSecretName,
            formData.api_key,
            `Mailgun API key for ${formData.connection_name || 'Mailgun Connection'} - Created: ${new Date().toISOString()}`
          );
          metadata = {
            ...metadata,
            domain: formData.domain,
            region: formData.region
          };
          break;

        default:
          throw new Error('Invalid provider configuration');
      }

      console.log(`✅ ${selectedProvider.name} credentials securely stored in vault: ${vaultKeyId}`);

      // Create connection record
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: formData.selected_provider === 'smtp' ? formData.username : 
                             formData.selected_provider === 'sendgrid' ? formData.from_email : 
                             formData.domain,
          connection_name: formData.connection_name || `${selectedProvider.name} Connection`,
          encrypted_access_token: null, // Credentials are in vault
          vault_access_token_id: vaultKeyId,
          scopes_granted: getProviderScopes(formData.selected_provider),
          connection_status: 'active',
          credential_type: selectedProvider.credentialType,
          connection_metadata: metadata
        })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(`Failed to create connection: ${insertError.message}`);
      }

      // Success! Call onSuccess callback
      onSuccess({
        connection_id: connectionData.id,
        connection_name: connectionData.connection_name,
        provider_name: formData.selected_provider,
        external_username: connectionData.external_username,
        scopes_granted: connectionData.scopes_granted
      });

      toast.success(`${selectedProvider.name} connected successfully! 🎉`);
      
      // Reset form fields individually to preserve modal state behavior
      Object.entries(INITIAL_EMAIL_RELAY_FORM_DATA).forEach(([field, value]) => {
        updateFormField(field as keyof EmailRelayFormData, value as string | boolean);
      });
      setSelectedSMTPPreset(null);
      clearErrors();
      
      onClose();

    } catch (err: any) {
      console.error('Error setting up Email Relay integration:', err);
      const errorMessage = err.message || 'Failed to setup Email Relay integration';
      setFieldError('connection_name', errorMessage);
      onError(errorMessage);
      toast.error('Failed to setup Email Relay');
    } finally {
      setLoading(false);
    }
  };

  const selectedProvider = EMAIL_PROVIDERS.find(p => p.id === formData.selected_provider);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
          <Mail className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Setup Email Relay</h2>
          <p className="text-muted-foreground">Choose an email provider and configure your connection</p>
        </div>
      </div>

      {/* Email Provider Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5 text-blue-500" />
            <span>Email Provider Configuration</span>
          </CardTitle>
          <CardDescription>
            Choose an email service provider and configure your settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errors.connection_name && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.connection_name}</AlertDescription>
            </Alert>
          )}

          {/* Provider Selection */}
          <div>
            <Label htmlFor="provider_select">
              Email Provider <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={formData.selected_provider} 
              onValueChange={(value) => handleInputChange('selected_provider', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose your email provider" />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_PROVIDERS.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedProvider?.description}
            </p>
          </div>

          <div>
            <Label htmlFor="connection_name">
              Connection Name (Optional)
            </Label>
            <Input
              id="connection_name"
              value={formData.connection_name}
              onChange={(e) => handleInputChange('connection_name', e.target.value)}
              placeholder={`My ${selectedProvider?.name} Connection`}
              className="mt-1"
            />
          </div>

          <ProviderConfigurationFields
            formData={formData}
            selectedSMTPPreset={selectedSMTPPreset}
            onInputChange={handleInputChange}
            onSMTPPresetSelect={handleSMTPPresetSelect}
          />

          {selectedProvider && (
            <Button
              onClick={handleEmailRelaySetup}
              disabled={loading || !isFormValid}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Connect {selectedProvider.name}
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      <EmailRelayCapabilitiesCard />
    </div>
  );
}
