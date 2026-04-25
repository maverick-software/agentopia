import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  getDummyIntegrations,
  getAllDummyIntegrations,
} from './helpers/dummyData';
import {
  getProviderCategoryName,
  getProviderDescription,
  getProviderDocumentationUrl,
  getProviderIcon,
  isPopularProvider,
} from './helpers/providerMetadata';
import { Integration } from './types';

export function useIntegrationsByCategory(categoryId?: string) {
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
          setIntegrations(
            categoryId ? getDummyIntegrations(categoryId) : getAllDummyIntegrations(),
          );
          return;
        }

        const { data: categoriesData } = await supabase
          .from('integration_categories')
          .select('id, name')
          .eq('is_active', true);

        const categoryMap = new Map(categoriesData?.map((cat) => [cat.name, cat.id]) || []);
        const transformed = (providers || [])
          .map((provider: any, index: number) => {
            const categoryName = getProviderCategoryName(provider.name);
            const actualCategoryId = categoryMap.get(categoryName);

            if (categoryId && actualCategoryId !== categoryId) {
              return null;
            }

            return {
              id: provider.id,
              category_id: actualCategoryId || categoryMap.get('API Integrations') || 'unknown',
              name: provider.display_name,
              description: getProviderDescription(provider.name),
              icon_name: getProviderIcon(provider.name),
              status: provider.is_enabled ? 'available' : 'coming_soon',
              agent_classification: 'tool',
              is_popular: isPopularProvider(provider.name),
              documentation_url: getProviderDocumentationUrl(provider.name),
              display_order: index + 1,
            } as Integration;
          })
          .filter(Boolean) as Integration[];

        setIntegrations(transformed);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch integrations');
        setIntegrations(
          categoryId ? getDummyIntegrations(categoryId) : getAllDummyIntegrations(),
        );
      } finally {
        setLoading(false);
      }
    }

    fetchIntegrations();
  }, [categoryId]);

  return { integrations, loading, error };
}
