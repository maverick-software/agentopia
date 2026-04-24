export function getProviderCategoryName(providerName: string): string {
  const categoryMap: Record<string, string> = {
    smtp: 'Messaging & Communication',
    serper_api: 'API Integrations',
    serpapi: 'API Integrations',
    brave_search: 'API Integrations',
    pinecone: 'Database Connectors',
    discord: 'Messaging & Communication',
    zapier: 'Automation & Workflows',
  };

  return categoryMap[providerName] || 'API Integrations';
}

export function getProviderDescription(providerName: string): string {
  const descriptionMap: Record<string, string> = {
    smtp:
      'Send emails through SMTP servers with custom configurations and templates',
    serper_api:
      'Google Search API with fast, reliable results. Perfect for web search, news, images, and location-based queries. Offers 1000 free searches per month.',
    serpapi:
      'Comprehensive search API supporting Google, Bing, Yahoo and Baidu. Advanced features include device simulation and multiple search engines.',
    brave_search:
      'Privacy-focused search API from Brave. No tracking, independent index, and high monthly quota. Perfect for privacy-conscious applications.',
    pinecone:
      'Vector database for AI applications with fast similarity search and real-time updates',
    discord: 'Interact with Discord servers and manage bot communications',
    zapier:
      'Connect with Zapier workflows to automate tasks across thousands of apps',
  };

  return descriptionMap[providerName] || `Integration for ${providerName}`;
}

export function getProviderIcon(providerName: string): string {
  const iconMap: Record<string, string> = {
    smtp: 'Mail',
    serper_api: 'Search',
    serpapi: 'Search',
    brave_search: 'Search',
    pinecone: 'Database',
    discord: 'MessageSquare',
    zapier: 'Zap',
  };

  return iconMap[providerName] || 'Globe';
}

export function isPopularProvider(providerName: string): boolean {
  const popularProviders = [
    'serper_api',
    'brave_search',
    'serpapi',
    'discord',
    'zapier',
  ];
  return popularProviders.includes(providerName);
}

export function getProviderDocumentationUrl(providerName: string): string | undefined {
  const docMap: Record<string, string> = {
    serper_api: 'https://serper.dev/api-key',
    serpapi: 'https://serpapi.com/search-api',
    brave_search: 'https://api.search.brave.com/app/documentation',
    pinecone: 'https://docs.pinecone.io/',
    discord: 'https://discord.com/developers/docs',
    zapier: 'https://zapier.com/developer',
  };

  return docMap[providerName];
}

export function getProviderClassification(providerName: string): 'tool' | 'channel' {
  const channelProviders = [
    'smtp',
    'discord',
  ];
  return channelProviders.includes(providerName) ? 'channel' : 'tool';
}
