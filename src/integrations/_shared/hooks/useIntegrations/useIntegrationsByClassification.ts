import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getDummyIntegrationsByClassification } from './helpers/dummyData';
import {
  getProviderCategoryName,
  getProviderClassification,
  getProviderDescription,
  getProviderDocumentationUrl,
  getProviderIcon,
  isPopularProvider,
} from './helpers/providerMetadata';
import { Integration } from './types';

export function useIntegrationsByClassification(classification: 'tool' | 'channel') {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIntegrations() {
      try {
        setLoading(true);
        setError(null);

        const { data: providers, error: queryError } = await supabase
          .from('service_providers')
          .select('*')
          .eq('is_enabled', true)
          .order('name');

        if (queryError) {
          setIntegrations(getDummyIntegrationsByClassification(classification));
          return;
        }

        const { data: categoriesData } = await supabase
          .from('integration_categories')
          .select('id, name')
          .eq('is_active', true);

        const categoryMap = new Map(categoriesData?.map((cat) => [cat.name, cat.id]) || []);
        const transformed = (providers || [])
          .map((provider: any, index: number) => {
            const providerClassification = getProviderClassification(provider.name);
            if (providerClassification !== classification) {
              return null;
            }
            const categoryName = getProviderCategoryName(provider.name);
            const actualCategoryId = categoryMap.get(categoryName);
            return {
              id: provider.id,
              category_id: actualCategoryId || categoryMap.get('API Integrations') || 'unknown',
              name: provider.display_name,
              description: getProviderDescription(provider.name),
              icon_name: getProviderIcon(provider.name),
              status: provider.is_enabled ? 'available' : 'coming_soon',
              agent_classification: providerClassification,
              is_popular: isPopularProvider(provider.name),
              documentation_url: getProviderDocumentationUrl(provider.name),
              display_order: index + 1,
            } as Integration;
          })
          .filter(Boolean) as Integration[];

        if (classification === 'tool' && !transformed.some((integration) => integration.name === 'Pipedream')) {
          transformed.unshift({
            id: 'pipedream',
            category_id: categoryMap.get('Automation & Workflows') || categoryMap.get('API Integrations') || 'unknown',
            name: 'Pipedream',
            description: getProviderDescription('pipedream'),
            icon_name: getProviderIcon('pipedream'),
            status: 'available',
            agent_classification: 'tool',
            is_popular: true,
            documentation_url: getProviderDocumentationUrl('pipedream'),
            display_order: 0,
          });
        }

        setIntegrations(transformed);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch integrations');
        setIntegrations(getDummyIntegrationsByClassification(classification));
      } finally {
        setLoading(false);
      }
    }
    fetchIntegrations();
  }, [classification]);

  return { integrations, loading, error };
}
