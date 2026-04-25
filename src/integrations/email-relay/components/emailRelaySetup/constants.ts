import { SMTP_PROVIDER_PRESETS } from '../../../smtp/types/smtp';

export interface EmailRelayProvider {
  id: 'smtp' | 'sendgrid' | 'mailgun';
  name: string;
  setupUrl: string;
  description: string;
  fields: string[];
  credentialType: 'api_key';
}

export interface EmailRelayFormData {
  connection_name: string;
  selected_provider: EmailRelayProvider['id'];
  api_key: string;
  from_email: string;
  from_name: string;
  domain: string;
  region: 'US' | 'EU';
  host: string;
  port: string;
  secure: boolean;
  username: string;
  password: string;
  reply_to_email: string;
  smtp_preset: string;
}

export const EMAIL_PROVIDERS: EmailRelayProvider[] = [
  {
    id: 'smtp',
    name: 'SMTP Server',
    setupUrl: '',
    description: 'Connect to any SMTP server (Gmail, Outlook, Yahoo, etc.)',
    fields: ['host', 'port', 'username', 'password', 'from_email', 'from_name', 'reply_to_email', 'smtp_preset'],
    credentialType: 'api_key',
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    setupUrl: 'https://app.sendgrid.com/settings/api_keys',
    description: 'High-deliverability email service with advanced analytics',
    fields: ['api_key', 'from_email', 'from_name'],
    credentialType: 'api_key',
  },
  {
    id: 'mailgun',
    name: 'Mailgun',
    setupUrl: 'https://app.mailgun.com/app/account/security/api_keys',
    description: 'Powerful email service with validation and routing',
    fields: ['domain', 'api_key', 'region'],
    credentialType: 'api_key',
  },
];

export const INITIAL_EMAIL_RELAY_FORM_DATA: EmailRelayFormData = {
  connection_name: '',
  selected_provider: 'sendgrid',
  api_key: '',
  from_email: '',
  from_name: '',
  domain: '',
  region: 'US',
  host: '',
  port: '587',
  secure: false,
  username: '',
  password: '',
  reply_to_email: '',
  smtp_preset: '',
};

export function isEmailRelayFormValid(formData: EmailRelayFormData): boolean {
  switch (formData.selected_provider) {
    case 'smtp':
      return !!(
        formData.host.trim() &&
        formData.username.trim() &&
        formData.password.trim() &&
        formData.from_email.trim()
      );
    case 'sendgrid':
      return !!(formData.api_key.trim() && formData.from_email.trim());
    case 'mailgun':
      return !!(formData.domain.trim() && formData.api_key.trim());
    default:
      return false;
  }
}

export function getEmailRelayValidationError(formData: EmailRelayFormData): string | null {
  switch (formData.selected_provider) {
    case 'smtp':
      return formData.host.trim() && formData.username.trim() && formData.password.trim() && formData.from_email.trim()
        ? null
        : 'SMTP Host, Username, Password, and From Email are required';
    case 'sendgrid':
      return formData.api_key.trim() && formData.from_email.trim()
        ? null
        : 'SendGrid API Key and From Email are required';
    case 'mailgun':
      return formData.domain.trim() && formData.api_key.trim()
        ? null
        : 'Mailgun Domain and API Key are required';
    default:
      return 'Invalid provider configuration';
  }
}

export function getProviderScopes(provider: EmailRelayProvider['id']): string[] {
  switch (provider) {
    case 'smtp':
      return ['send_email'];
    case 'sendgrid':
      return ['send_email', 'email_templates', 'email_stats'];
    case 'mailgun':
      return ['send_email', 'email_validation', 'email_stats', 'suppression_management'];
    default:
      return ['send_email'];
  }
}

export function findSMTPPresetByName(name: string) {
  return SMTP_PROVIDER_PRESETS.find((preset) => preset.name === name);
}
