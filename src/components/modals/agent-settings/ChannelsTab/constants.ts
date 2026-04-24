import { Mail, MessageSquare, Phone } from 'lucide-react';
import type { ChannelSettings, ProviderOption } from './types';

export const CHANNEL_PROVIDER_MAP: Record<string, string[]> = {
  email: ['smtp', 'smtp_server'],
  sms: ['twilio', 'aws_sns'],
  slack: ['slack'],
  discord: ['discord'],
  telegram: ['telegram'],
  whatsapp: ['whatsapp_business'],
};

export const CHANNEL_DISABLE_PROVIDER_MAP: Record<string, string[]> = {
  email: ['smtp'],
  sms: ['twilio', 'aws_sns'],
  slack: ['slack'],
  discord: ['discord'],
  telegram: ['telegram'],
  whatsapp: ['whatsapp_business'],
};

export const EMAIL_PROVIDERS: ProviderOption[] = [
  { id: 'smtp', name: 'SMTP', description: 'Generic SMTP server', requiresApiKey: true, requiresOAuth: false, authType: 'api_key' },
];

export const SMS_PROVIDERS: ProviderOption[] = [
  { id: 'twilio', name: 'Twilio', description: 'Twilio SMS service', requiresApiKey: true, requiresOAuth: false, authType: 'api_key' },
  { id: 'aws_sns', name: 'AWS SNS', description: 'Amazon Simple Notification Service', requiresApiKey: true, requiresOAuth: false, authType: 'api_key' },
];

export const DEFAULT_CHANNEL_SETTINGS: ChannelSettings = {
  email_enabled: false,
  sms_enabled: false,
  slack_enabled: false,
  discord_enabled: false,
  telegram_enabled: false,
  whatsapp_enabled: false,
};

export const CHANNEL_META = [
  { id: 'email_enabled', name: 'Email', description: 'Send and receive emails through various providers', icon: Mail, requiresAuth: 'API or OAuth', type: 'email' },
  { id: 'sms_enabled', name: 'SMS', description: 'Send and receive text messages', icon: Phone, requiresAuth: 'API', type: 'sms' },
  { id: 'slack_enabled', name: 'Slack', description: 'Interact in Slack channels and direct messages', icon: MessageSquare, requiresAuth: 'OAuth', type: 'slack', disabled: true },
  { id: 'discord_enabled', name: 'Discord', description: 'Respond to mentions in Discord servers', icon: MessageSquare, requiresAuth: 'Bot Token', type: 'discord', disabled: true },
  { id: 'telegram_enabled', name: 'Telegram', description: 'Chat with users on Telegram', icon: MessageSquare, requiresAuth: 'Bot Token', type: 'telegram', disabled: true },
  { id: 'whatsapp_enabled', name: 'WhatsApp', description: 'Send and receive WhatsApp messages', icon: MessageSquare, requiresAuth: 'API', type: 'whatsapp', disabled: true },
] as const;
