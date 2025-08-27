import { IntegrationSetupRegistry } from '../types/IntegrationSetup';
import { DiscordSetupModal } from '../../discord/components/DiscordSetupModal';
import { DigitalOceanSetupModal } from '../../digitalocean/components/DigitalOceanSetupModal';
import { GmailSetupModal } from '../../gmail/components/GmailSetupModal';
import { WebSearchSetupModal } from '../../web-search/components/WebSearchSetupModal';
import { SendGridSetupModal } from '../../sendgrid/components/SendGridSetupModal';
import { MailgunSetupModal } from '../../mailgun/components/MailgunSetupModal';
import { SMTPSetupModal } from '../../smtp/components/SMTPSetupModal';
import { EmailRelaySetupModal } from '../../email-relay/components/EmailRelaySetupModal';

/**
 * Registry of all integration setup components
 * Each integration should register its setup component here
 */
export const integrationSetupRegistry: IntegrationSetupRegistry = {
  // Gmail - OAuth-based email integration
  'Gmail': {
    component: GmailSetupModal,
    credentialType: 'oauth',
    defaultScopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify'
    ],
    capabilities: [
      { key: 'send_email', label: 'Send and receive emails' },
      { key: 'read_email', label: 'Read and search email messages' },
      { key: 'manage_labels', label: 'Manage email labels and folders' },
      { key: 'oauth_auth', label: 'Secure OAuth authentication' }
    ]
  },

  // Web Search - API key-based search integration  
  'Web Search': {
    component: WebSearchSetupModal,
    credentialType: 'api_key',
    defaultScopes: ['web_search', 'news_search', 'image_search', 'local_search'],
    capabilities: [
      { key: 'web_search', label: 'Search the web for information' },
      { key: 'news_search', label: 'Search for news articles' },
      { key: 'image_search', label: 'Search for images' },
      { key: 'local_search', label: 'Search for local business information' }
    ]
  },

  // Email Relay - Unified email provider integration
  'Email Relay': {
    component: EmailRelaySetupModal,
    credentialType: 'api_key', // Can be api_key or smtp_config depending on provider
    defaultScopes: ['send_email', 'email_templates', 'email_stats'],
    capabilities: [
      { key: 'send_email', label: 'Send transactional and marketing emails' },
      { key: 'email_templates', label: 'Use email templates and branding' },
      { key: 'email_stats', label: 'Track email delivery and engagement' },
      { key: 'email_validation', label: 'Email validation and verification' }
    ]
  },

  // SendGrid - API key-based email sending
  'SendGrid': {
    component: SendGridSetupModal,
    credentialType: 'api_key',
    defaultScopes: ['send_email', 'templates', 'analytics'],
    capabilities: [
      { key: 'send_email', label: 'Send transactional emails' },
      { key: 'templates', label: 'Use email templates' },
      { key: 'analytics', label: 'Email delivery analytics' }
    ]
  },

  // Mailgun - API key-based email service
  'Mailgun': {
    component: MailgunSetupModal,
    credentialType: 'api_key', 
    defaultScopes: ['send_email', 'validate', 'stats', 'suppressions'],
    capabilities: [
      { key: 'send_email', label: 'Send and receive emails' },
      { key: 'validate', label: 'Email validation' },
      { key: 'stats', label: 'Delivery statistics' },
      { key: 'suppressions', label: 'Suppression list management' }
    ]
  },

  // Discord - Custom bot setup
  'Discord': {
    component: DiscordSetupModal,
    credentialType: 'custom',
    defaultScopes: ['bot', 'messages.read', 'messages.write', 'guilds'],
    capabilities: [
      { key: 'bot', label: 'Discord bot functionality' },
      { key: 'messages.read', label: 'Read messages in Discord servers' },
      { key: 'messages.write', label: 'Send messages to Discord channels' },
      { key: 'guilds', label: 'Access Discord server information' }
    ]
  },

  // DigitalOcean - API key-based cloud management
  'DigitalOcean': {
    component: DigitalOceanSetupModal,
    credentialType: 'api_key',
    defaultScopes: ['droplet:read', 'droplet:create', 'droplet:delete', 'image:read', 'region:read', 'size:read'],
    capabilities: [
      { key: 'droplet:read', label: 'View droplets and infrastructure' },
      { key: 'droplet:create', label: 'Create new droplets' },
      { key: 'droplet:delete', label: 'Delete droplets' },
      { key: 'image:read', label: 'View available images' },
      { key: 'region:read', label: 'View available regions' },
      { key: 'size:read', label: 'View available droplet sizes' }
    ]
  },

  // SMTP - SMTP server configuration
  'SMTP': {
    component: SMTPSetupModal,
    credentialType: 'smtp_config',
    defaultScopes: ['send_email'],
    capabilities: [
      { key: 'send_email', label: 'Send emails through SMTP server' },
      { key: 'custom_from', label: 'Custom from addresses and names' },
      { key: 'reply_to', label: 'Reply-to email configuration' },
      { key: 'secure_credentials', label: 'Secure credential management' }
    ]
  }
};

/**
 * Get setup component for an integration
 */
export function getIntegrationSetupComponent(integrationName: string) {
  const entry = integrationSetupRegistry[integrationName];
  if (!entry) {
    throw new Error(`No setup component registered for integration: ${integrationName}`);
  }
  
  return entry.component;
}

/**
 * Get integration capabilities
 */
export function getIntegrationCapabilities(integrationName: string) {
  const entry = integrationSetupRegistry[integrationName];
  return entry?.capabilities || [];
}

/**
 * Get integration default scopes
 */
export function getIntegrationDefaultScopes(integrationName: string) {
  const entry = integrationSetupRegistry[integrationName];
  return entry?.defaultScopes || [];
}

/**
 * Get integration credential type
 */
export function getIntegrationCredentialType(integrationName: string) {
  const entry = integrationSetupRegistry[integrationName];
  return entry?.credentialType || 'oauth';
}
