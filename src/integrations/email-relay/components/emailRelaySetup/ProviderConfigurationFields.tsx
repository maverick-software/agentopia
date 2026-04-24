import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';
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
              placeholder="smtp.your-provider.com"
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
  return null;
}
