import {
  Cloud,
  Database,
  Globe,
  Mail,
  MessageSquare,
  Search,
  Server,
  Settings,
  Shield,
  Zap,
} from 'lucide-react';

export const HIDDEN_INTEGRATIONS = [
  'Anthropic',
  'Azure Document Intelligence',
  'ClickSend SMS',
  'DigitalOcean',
  'GetZep',
  'Gmail',
  'Mailgun',
  'Microsoft OneDrive',
  'Microsoft Outlook',
  'Microsoft Teams',
  'OneDrive',
  'Outlook',
  'SendGrid',
  'Teams',
  'OpenAI',
  'Mistral AI',
  'Serper API',
  'Contact Management',
  'Conversation Memory',
  'Advanced Reasoning',
  'Temporary Chat Links',
  'Brave Search API',
  'SerpAPI',
  'OCR.Space',
  'OCR Space',
  'Google',
  'Microsoft',
];

export function getStatusColor(status: string) {
  switch (status) {
    case 'available':
      return 'bg-green-500/20 text-green-600 dark:text-green-300 border-green-500/30';
    case 'beta':
      return 'bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30';
    case 'coming_soon':
      return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-300 border-yellow-500/30';
    case 'deprecated':
      return 'bg-red-500/20 text-red-600 dark:text-red-300 border-red-500/30';
    default:
      return 'bg-muted/20 text-muted-foreground border-border';
  }
}

export function getStatusText(status: string) {
  switch (status) {
    case 'available':
      return 'Available';
    case 'beta':
      return 'Beta';
    case 'coming_soon':
      return 'Coming Soon';
    case 'deprecated':
      return 'Deprecated';
    default:
      return 'Unknown';
  }
}

export function getEffectiveStatus(integration: any) {
  return integration.status || 'coming_soon';
}

export function getIconComponent(iconName: string) {
  switch (iconName) {
    case 'Globe':
      return Globe;
    case 'Database':
      return Database;
    case 'Shield':
      return Shield;
    case 'MessageSquare':
      return MessageSquare;
    case 'Mail':
      return Mail;
    case 'Cloud':
      return Cloud;
    case 'Zap':
      return Zap;
    case 'Search':
      return Search;
    case 'Server':
      return Server;
    default:
      return Settings;
  }
}

export function providerNameForIntegration(name: string): string | null {
  switch (name) {
    case 'SMTP':
      return 'smtp';
    case 'Web Search':
      return 'web_search';
    case 'Serper API':
      return 'serper_api';
    case 'SerpAPI':
      return 'serpapi';
    case 'Brave Search API':
      return 'brave_search';
    case 'Pinecone':
      return 'pinecone';
    case 'Discord':
      return 'discord';
    case 'Pipedream':
      return 'pipedream';
    default:
      return null;
  }
}
