export function getProviderCategoryName(providerName: string): string {
  const categoryMap: Record<string, string> = {
    gmail: 'Messaging & Communication',
    smtp: 'Messaging & Communication',
    sendgrid: 'Messaging & Communication',
    mailgun: 'Messaging & Communication',
    serper_api: 'API Integrations',
    serpapi: 'API Integrations',
    brave_search: 'API Integrations',
    pinecone: 'Database Connectors',
    getzep: 'Database Connectors',
    digitalocean: 'Cloud Services',
    discord: 'Messaging & Communication',
    zapier: 'Automation & Workflows',
    'microsoft-teams': 'Communication',
    'microsoft-outlook': 'Productivity',
    'microsoft-onedrive': 'Storage',
  };

  return categoryMap[providerName] || 'API Integrations';
}

export function getProviderDescription(providerName: string): string {
  const descriptionMap: Record<string, string> = {
    gmail:
      'Send, receive, and manage Gmail emails with comprehensive tools for email automation',
    smtp:
      'Send emails through SMTP servers with custom configurations and templates',
    sendgrid:
      'Professional email delivery service with advanced analytics and templates',
    mailgun:
      'Powerful email API for sending, receiving and tracking emails programmatically',
    serper_api:
      'Google Search API with fast, reliable results. Perfect for web search, news, images, and location-based queries. Offers 1000 free searches per month.',
    serpapi:
      'Comprehensive search API supporting Google, Bing, Yahoo and Baidu. Advanced features include device simulation and multiple search engines.',
    brave_search:
      'Privacy-focused search API from Brave. No tracking, independent index, and high monthly quota. Perfect for privacy-conscious applications.',
    pinecone:
      'Vector database for AI applications with fast similarity search and real-time updates',
    getzep:
      'Memory store for AI assistants with conversation history and semantic search',
    digitalocean: 'Cloud infrastructure platform for deploying and scaling applications',
    discord: 'Interact with Discord servers and manage bot communications',
    zapier:
      'Connect with Zapier workflows to automate tasks across thousands of apps',
    'microsoft-teams':
      'Send messages, create meetings, and collaborate in Microsoft Teams channels and chats',
    'microsoft-outlook':
      'Send emails, manage calendar events, and access contacts in Microsoft Outlook',
    'microsoft-onedrive':
      'Upload, download, share, and manage files in Microsoft OneDrive',
  };

  return descriptionMap[providerName] || `Integration for ${providerName}`;
}

export function getProviderIcon(providerName: string): string {
  const iconMap: Record<string, string> = {
    gmail: 'Mail',
    smtp: 'Mail',
    sendgrid: 'Mail',
    mailgun: 'Mail',
    serper_api: 'Search',
    serpapi: 'Search',
    brave_search: 'Search',
    pinecone: 'Database',
    getzep: 'Database',
    digitalocean: 'Cloud',
    discord: 'MessageSquare',
    zapier: 'Zap',
    'microsoft-teams': 'MessageSquare',
    'microsoft-outlook': 'Mail',
    'microsoft-onedrive': 'Cloud',
  };

  return iconMap[providerName] || 'Globe';
}

export function isPopularProvider(providerName: string): boolean {
  const popularProviders = [
    'gmail',
    'serper_api',
    'brave_search',
    'serpapi',
    'discord',
    'zapier',
    'microsoft-teams',
    'microsoft-outlook',
    'microsoft-onedrive',
  ];
  return popularProviders.includes(providerName);
}

export function getProviderDocumentationUrl(providerName: string): string | undefined {
  const docMap: Record<string, string> = {
    gmail: 'https://developers.google.com/gmail/api',
    serper_api: 'https://serper.dev/api-key',
    serpapi: 'https://serpapi.com/search-api',
    brave_search: 'https://api.search.brave.com/app/documentation',
    sendgrid: 'https://docs.sendgrid.com/',
    mailgun: 'https://documentation.mailgun.com/',
    pinecone: 'https://docs.pinecone.io/',
    getzep: 'https://docs.getzep.com/',
    digitalocean: 'https://docs.digitalocean.com/reference/api/',
    discord: 'https://discord.com/developers/docs',
    zapier: 'https://zapier.com/developer',
    'microsoft-teams':
      'https://docs.microsoft.com/en-us/graph/api/resources/teams-api-overview',
    'microsoft-outlook':
      'https://docs.microsoft.com/en-us/graph/api/resources/mail-api-overview',
    'microsoft-onedrive':
      'https://docs.microsoft.com/en-us/graph/api/resources/onedrive',
  };

  return docMap[providerName];
}

export function getProviderClassification(providerName: string): 'tool' | 'channel' {
  const channelProviders = [
    'gmail',
    'smtp',
    'sendgrid',
    'mailgun',
    'discord',
    'microsoft-teams',
    'microsoft-outlook',
  ];
  return channelProviders.includes(providerName) ? 'channel' : 'tool';
}
