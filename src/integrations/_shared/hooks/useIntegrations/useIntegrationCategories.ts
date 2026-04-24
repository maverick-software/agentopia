import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getDummyCategories } from './helpers/dummyData';
import { IntegrationCategory } from './types';

export function useIntegrationCategories() {
  const [categories, setCategories] = useState<IntegrationCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: functionData, error: functionError } = await supabase.rpc(
        'get_integration_categories_with_counts',
      );

      if (functionData && !functionError) {
        setCategories(functionData);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('integration_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order')
        .order('name');

      if (queryError) {
        if (queryError.code === '42P01') {
          setCategories(getDummyCategories());
        } else {
          throw queryError;
        }
      } else {
        setCategories(data || []);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch integration categories',
      );
      setCategories(getDummyCategories());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return { categories, loading, error, refetch: fetchCategories };
}
