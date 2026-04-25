import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { SMTP_PROVIDER_PRESETS } from '../../../smtp/types/smtp';
import { EmailRelayFormData } from './constants';

interface ProviderConfigurationFieldsProps {
  formData: EmailRelayFormData;
  selectedSMTPPreset: any;
  onInputChange: (field: keyof EmailRelayFormData, value: string | boolean) => void;
  onSMTPPresetSelect: (preset: any) => void;
}

export function ProviderConfigurationFields({
  formData,
  selectedSMTPPreset,
  onInputChange,
  onSMTPPresetSelect,
}: ProviderConfigurationFieldsProps) {
  if (formData.selected_provider === 'smtp') {
    return (
      <>
        <div>
          <Label htmlFor="smtp_preset">Email Provider Preset (Optional)</Label>
          <Select
            onValueChange={(value) => {
              const preset = SMTP_PROVIDER_PRESETS.find((item) => item.name === value);
              if (preset && preset.name !== 'custom') {
                onSMTPPresetSelect(preset);
              }
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Choose a preset to auto-fill settings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">Custom Configuration</SelectItem>
              {SMTP_PROVIDER_PRESETS.filter((preset) => preset.name !== 'custom').map((preset) => (
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="host">
              SMTP Host <span className="text-red-500">*</span>
            </Label>
            <Input
              id="host"
              value={formData.host}
              onChange={(event) => onInputChange('host', event.target.value)}
              placeholder="smtp.gmail.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="port">
              Port <span className="text-red-500">*</span>
            </Label>
            <Input
              id="port"
              value={formData.port}
              onChange={(event) => onInputChange('port', event.target.value)}
              placeholder="587"
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="username">
              Username <span className="text-red-500">*</span>
            </Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(event) => onInputChange('username', event.target.value)}
              placeholder="your-email@domain.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="password">
              Password <span className="text-red-500">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(event) => onInputChange('password', event.target.value)}
              placeholder="Your SMTP password"
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="from_email">
              From Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="from_email"
              type="email"
              value={formData.from_email}
              onChange={(event) => onInputChange('from_email', event.target.value)}
              placeholder="noreply@yourdomain.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="from_name">From Name (Optional)</Label>
            <Input
              id="from_name"
              value={formData.from_name}
              onChange={(event) => onInputChange('from_name', event.target.value)}
              placeholder="Your App Name"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="reply_to_email">Reply-To Email (Optional)</Label>
          <Input
            id="reply_to_email"
            type="email"
            value={formData.reply_to_email}
            onChange={(event) => onInputChange('reply_to_email', event.target.value)}
            placeholder="support@yourdomain.com"
            className="mt-1"
          />
        </div>
      </>
    );
  }

  if (formData.selected_provider === 'sendgrid') {
    return (
      <>
        <div>
          <Label htmlFor="api_key">
            SendGrid API Key <span className="text-red-500">*</span>
          </Label>
          <Input
            id="api_key"
            type="password"
            value={formData.api_key}
            onChange={(event) => onInputChange('api_key', event.target.value)}
            placeholder="SG.xxxxxxxxxxxxxxxxxxxxxx"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">Your API key with mail.send permissions</p>
        </div>

        <div>
          <Label htmlFor="from_email">
            From Email <span className="text-red-500">*</span>
          </Label>
          <Input
            id="from_email"
            type="email"
            value={formData.from_email}
            onChange={(event) => onInputChange('from_email', event.target.value)}
            placeholder="noreply@yourdomain.com"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">Your verified sender email address</p>
        </div>

        <div>
          <Label htmlFor="from_name">From Name (Optional)</Label>
          <Input
            id="from_name"
            value={formData.from_name}
            onChange={(event) => onInputChange('from_name', event.target.value)}
            placeholder="Your App Name"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">Display name for your emails</p>
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
      </>
    );
  }

  return (
    <>
      <div>
        <Label htmlFor="domain">
          Mailgun Domain <span className="text-red-500">*</span>
        </Label>
        <Input
          id="domain"
          value={formData.domain}
          onChange={(event) => onInputChange('domain', event.target.value)}
          placeholder="mail.yourdomain.com"
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">Your verified Mailgun sending domain</p>
      </div>

      <div>
        <Label htmlFor="api_key">
          Mailgun API Key <span className="text-red-500">*</span>
        </Label>
        <Input
          id="api_key"
          type="password"
          value={formData.api_key}
          onChange={(event) => onInputChange('api_key', event.target.value)}
          placeholder="key-xxxxxxxxxxxxxxxxxxxxxx"
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">Your private API key from Mailgun dashboard</p>
      </div>

      <div>
        <Label htmlFor="region">Region</Label>
        <select
          id="region"
          value={formData.region}
          onChange={(event) => onInputChange('region', event.target.value)}
          className="w-full p-2 mt-1 bg-card border border-border rounded-md text-foreground"
        >
          <option value="US">US (api.mailgun.net)</option>
          <option value="EU">EU (api.eu.mailgun.net)</option>
        </select>
        <p className="text-xs text-muted-foreground mt-1">Select your Mailgun account region</p>
      </div>

      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <ExternalLink className="h-4 w-4" />
        <a
          href="https://app.mailgun.com/app/account/security/api_keys"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground underline"
        >
          Get your Mailgun API key
        </a>
      </div>
    </>
  );
}
