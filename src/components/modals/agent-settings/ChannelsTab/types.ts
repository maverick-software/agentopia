import type { LucideIcon } from 'lucide-react';

export interface ChannelsTabProps {
  agentId: string;
  agentData?: any;
  onAgentUpdated?: (updatedData: any) => void;
}

export interface ChannelSettings {
  email_enabled: boolean;
  sms_enabled: boolean;
  slack_enabled: boolean;
  discord_enabled: boolean;
  telegram_enabled: boolean;
  whatsapp_enabled: boolean;
}

export interface ProviderOption {
  id: string;
  name: string;
  description: string;
  requiresApiKey: boolean;
  requiresOAuth: boolean;
  authType: 'api_key' | 'oauth' | 'bot_token';
}

export interface CredentialModalState {
  isOpen: boolean;
  channelType: 'email' | 'sms' | null;
  selectedProvider: string;
  availableProviders: ProviderOption[];
  availableCredentials: any[];
}

export interface IntegrationSetupModalState {
  isOpen: boolean;
  providerName: string;
  channelType: 'email' | 'sms' | null;
}

export interface ChannelCardItem {
  id: keyof ChannelSettings;
  name: string;
  description: string;
  icon: LucideIcon;
  enabled: boolean;
  requiresAuth: string;
  providers: string[];
  status: 'configured' | 'not_configured';
  disabled?: boolean;
}
