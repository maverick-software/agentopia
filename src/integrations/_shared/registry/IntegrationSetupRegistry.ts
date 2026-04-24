import { IntegrationSetupRegistry } from '../types/IntegrationSetup';
import { DiscordSetupModal } from '../../discord/components/DiscordSetupModal';
import { WebSearchSetupModal } from '../../web-search/components/WebSearchSetupModal';
import { SMTPSetupModal } from '../../smtp/components/SMTPSetupModal';
import { EmailRelaySetupModal } from '../../email-relay/components/EmailRelaySetupModal';
import { PineconeSetupModal } from '../../pinecone/components/PineconeSetupModal';
import { SerperAPISetupModal } from '../../serper-api/components/SerperAPISetupModal';
import { SerpAPISetupModal } from '../../serpapi/components/SerpAPISetupModal';
import { BraveSearchSetupModal } from '../../brave-search/components/BraveSearchSetupModal';
import { MistralOCRSetupModal } from '../../mistral-ocr/components/MistralOCRSetupModal';
import { PipedreamSetupModal } from '../../pipedream/components/PipedreamSetupModal';

/**
 * Registry of all integration setup components
 * Each integration should register its setup component here
 */
export const integrationSetupRegistry: IntegrationSetupRegistry = {
  // Pipedream Connect - primary MCP provider for 3,000+ apps
  'Pipedream': {
    component: PipedreamSetupModal,
    credentialType: 'oauth',
    defaultScopes: ['pipedream_mcp'],
    capabilities: [
      { key: 'pipedream_mcp', label: 'Expose connected app actions as MCP tools' },
      { key: 'managed_auth', label: 'Managed OAuth and API key credential refresh' },
      { key: 'app_catalog', label: 'Search 3,000+ Pipedream-supported apps' }
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
    credentialType: 'api_key', // All email providers use api_key credential type
    defaultScopes: ['send_email', 'email_templates', 'email_stats'],
    capabilities: [
      { key: 'send_email', label: 'Send transactional and marketing emails' },
      { key: 'email_templates', label: 'Use email templates and branding' },
      { key: 'email_stats', label: 'Track email delivery and engagement' },
      { key: 'email_validation', label: 'Email validation and verification' }
    ]
  },

  // Discord - Custom bot setup
  'Discord': {
    component: DiscordSetupModal,
    credentialType: 'oauth',
    defaultScopes: ['bot', 'messages.read', 'messages.write', 'guilds'],
    capabilities: [
      { key: 'bot', label: 'Discord bot functionality' },
      { key: 'messages.read', label: 'Read messages in Discord servers' },
      { key: 'messages.write', label: 'Send messages to Discord channels' },
      { key: 'guilds', label: 'Access Discord server information' }
    ]
  },

  // SMTP - SMTP server configuration
  'SMTP': {
    component: SMTPSetupModal,
    credentialType: 'api_key',
    defaultScopes: ['send_email'],
    capabilities: [
      { key: 'send_email', label: 'Send emails through SMTP server' },
      { key: 'custom_from', label: 'Custom from addresses and names' },
      { key: 'reply_to', label: 'Reply-to email configuration' },
      { key: 'secure_credentials', label: 'Secure credential management' }
    ]
  },

  // Pinecone - Vector database for AI memory
  'Pinecone': {
    component: PineconeSetupModal,
    credentialType: 'api_key',
    defaultScopes: ['vector_search', 'vector_upsert', 'vector_delete', 'index_stats'],
    capabilities: [
      { key: 'vector_search', label: 'Store and retrieve vector embeddings' },
      { key: 'semantic_search', label: 'Semantic similarity search' },
      { key: 'memory_storage', label: 'Long-term memory storage' },
      { key: 'context_aware', label: 'Context-aware responses' }
    ]
  },

  // Serper API - Fast Google search results
  'Serper API': {
    component: SerperAPISetupModal,
    credentialType: 'api_key',
    defaultScopes: ['web_search', 'news_search', 'image_search', 'local_search'],
    capabilities: [
      { key: 'web_search', label: 'Fast Google web search' },
      { key: 'news_search', label: 'News search and monitoring' },
      { key: 'image_search', label: 'Image search capabilities' },
      { key: 'local_search', label: 'Local business search' }
    ]
  },

  // SerpAPI - Comprehensive search engine results
  'SerpAPI': {
    component: SerpAPISetupModal,
    credentialType: 'api_key',
    defaultScopes: ['web_search', 'news_search', 'image_search', 'video_search', 'shopping_search'],
    capabilities: [
      { key: 'multi_engine_search', label: 'Multi-engine web search' },
      { key: 'news_search', label: 'News and article search' },
      { key: 'media_search', label: 'Image and video search' },
      { key: 'shopping_search', label: 'Shopping and product search' }
    ]
  },

  // Brave Search API - Privacy-focused search
  'Brave Search API': {
    component: BraveSearchSetupModal,
    credentialType: 'api_key',
    defaultScopes: ['web_search', 'news_search', 'image_search'],
    capabilities: [
      { key: 'privacy_search', label: 'Privacy-focused web search' },
      { key: 'news_search', label: 'News search without tracking' },
      { key: 'image_search', label: 'Image search capabilities' },
      { key: 'independent_results', label: 'Independent search results' }
    ]
  },

  // Mistral AI - Advanced AI-powered document processing
  'Mistral AI': {
    component: MistralOCRSetupModal,
    credentialType: 'api_key',
    defaultScopes: ['ocr', 'document_processing'],
    capabilities: [
      { key: 'high_accuracy_ocr', label: 'High-accuracy OCR with AI models' },
      { key: 'multi_page_processing', label: 'Multi-page document processing' },
      { key: 'structured_output', label: 'Structured data extraction' },
      { key: 'image_extraction', label: 'Extract images from documents' },
      { key: 'markdown_output', label: 'Markdown-formatted text output' },
      { key: 'bbox_annotation', label: 'Bounding box annotations' },
      { key: 'document_annotation', label: 'Document-level annotations' }
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
