import { Integration, IntegrationCategory } from '../types';

export function getDummyCategories(): IntegrationCategory[] {
  return [
    {
      id: 'api',
      name: 'API Integrations',
      description: 'Connect to external APIs and services',
      icon_name: 'Globe',
      display_order: 1,
      total_integrations: 3,
      available_integrations: 3,
      user_connected_integrations: 2,
    },
    {
      id: 'database',
      name: 'Database Connectors',
      description: 'Connect to various database systems',
      icon_name: 'Database',
      display_order: 2,
      total_integrations: 3,
      available_integrations: 3,
      user_connected_integrations: 1,
    },
    {
      id: 'authentication',
      name: 'Authentication',
      description: 'Secure authentication and authorization',
      icon_name: 'Shield',
      display_order: 3,
      total_integrations: 3,
      available_integrations: 2,
      user_connected_integrations: 1,
    },
    {
      id: 'messaging',
      name: 'Messaging & Communication',
      description: 'Communication and messaging platforms',
      icon_name: 'MessageSquare',
      display_order: 4,
      total_integrations: 3,
      available_integrations: 3,
      user_connected_integrations: 2,
    },
    {
      id: 'cloud',
      name: 'Cloud Services',
      description: 'Cloud platforms and services',
      icon_name: 'Cloud',
      display_order: 5,
      total_integrations: 3,
      available_integrations: 2,
      user_connected_integrations: 1,
    },
    {
      id: 'automation',
      name: 'Automation & Workflows',
      description: 'Workflow automation and triggers',
      icon_name: 'Zap',
      display_order: 6,
      total_integrations: 3,
      available_integrations: 3,
      user_connected_integrations: 2,
    },
  ];
}

export function getAllDummyIntegrations(): Integration[] {
  const categories = getDummyCategories();
  return categories.flatMap((category) => getDummyIntegrations(category.id));
}

export function getDummyIntegrationsByClassification(
  classification: 'tool' | 'channel',
): Integration[] {
  const channelIntegrations: Integration[] = [
    {
      id: 'slack',
      category_id: 'messaging',
      name: 'Slack',
      description: 'Send messages to Slack channels and manage workspace communications',
      icon_name: 'MessageSquare',
      status: 'available',
      is_popular: true,
      display_order: 2,
    },
    {
      id: 'discord',
      category_id: 'messaging',
      name: 'Discord',
      description: 'Interact with Discord servers and manage bot communications',
      icon_name: 'MessageSquare',
      status: 'available',
      is_popular: true,
      display_order: 3,
    },
  ];

  const toolIntegrations: Integration[] = [
    {
      id: 'serper-api',
      category_id: 'api',
      name: 'Serper API',
      description:
        'Google Search API with fast, reliable results. Perfect for web search, news, images, and location-based queries. Offers 1000 free searches per month.',
      icon_name: 'Search',
      status: 'available',
      is_popular: true,
      display_order: 1,
    },
    {
      id: 'serpapi',
      category_id: 'api',
      name: 'SerpAPI',
      description:
        'Comprehensive search API supporting Google, Bing, Yahoo and Baidu. Advanced features include device simulation and multiple search engines.',
      icon_name: 'Search',
      status: 'available',
      is_popular: true,
      display_order: 2,
    },
    {
      id: 'brave-search-api',
      category_id: 'api',
      name: 'Brave Search API',
      description:
        'Privacy-focused search API from Brave. No tracking, independent index, and high monthly quota. Perfect for privacy-conscious applications.',
      icon_name: 'Search',
      status: 'available',
      is_popular: true,
      display_order: 3,
    },
  ];

  return classification === 'channel' ? channelIntegrations : toolIntegrations;
}

export function getDummyIntegrations(categoryId: string): Integration[] {
  const allIntegrations: Record<string, Integration[]> = {
    api: [
      {
        id: 'rest-api',
        category_id: 'api',
        name: 'REST API',
        description: 'Connect to RESTful web services',
        icon_name: 'Globe',
        status: 'available',
        is_popular: true,
        display_order: 1,
      },
      {
        id: 'graphql',
        category_id: 'api',
        name: 'GraphQL',
        description: 'Query APIs with GraphQL',
        icon_name: 'Globe',
        status: 'available',
        is_popular: true,
        display_order: 2,
      },
    ],
    database: [
      {
        id: 'postgresql',
        category_id: 'database',
        name: 'PostgreSQL',
        description: 'Connect to PostgreSQL databases',
        icon_name: 'Database',
        status: 'available',
        is_popular: true,
        display_order: 1,
      },
      {
        id: 'mongodb',
        category_id: 'database',
        name: 'MongoDB',
        description: 'Connect to MongoDB collections',
        icon_name: 'Database',
        status: 'available',
        is_popular: true,
        display_order: 2,
      },
    ],
    messaging: [
      {
        id: 'discord',
        category_id: 'messaging',
        name: 'Discord',
        description: 'Interact with Discord servers and manage bot communications',
        icon_name: 'MessageSquare',
        status: 'available',
        is_popular: true,
        display_order: 1,
      },
    ],
  };

  return allIntegrations[categoryId] || [];
}
