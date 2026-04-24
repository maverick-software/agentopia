import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { IntegrationSetupModal } from '@/components/integrations/IntegrationSetupModal';
import { useConnections, useIntegrationCategories, useIntegrationsByCategory } from '@/integrations/_shared';
import { IntegrationsListPanel } from './IntegrationsListPanel';
import { IntegrationDetailsPanel } from './IntegrationDetailsPanel';
import { usePipedreamApps } from '@/integrations/pipedream';
import {
  getEffectiveStatus,
  HIDDEN_INTEGRATIONS,
  providerNameForIntegration,
} from './integrationUtils';

export function IntegrationsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const modalClosedByUserRef = React.useRef(false);
  const location = useLocation();
  const isMobile = useIsMobile();

  const { categories, loading: categoriesLoading } = useIntegrationCategories();
  const { integrations, loading: integrationsLoading } = useIntegrationsByCategory(
    selectedCategory === 'all' ? undefined : selectedCategory,
  );
  const {
    connections: unifiedConnections,
    loading: unifiedLoading,
    refetch: refetchConnections,
  } = useConnections({ includeRevoked: false });
  const {
    apps: pipedreamApps,
    accounts: pipedreamAccounts,
    loading: pipedreamLoading,
  } = usePipedreamApps(searchTerm);

  const processedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const providerParam = searchParams.get('provider');

    if (providerParam && providerParam !== processedUrlRef.current && integrations.length > 0) {
      const integration = integrations.find((item) => {
        const providerName = providerNameForIntegration(item.name);
        return (
          providerName === providerParam ||
          item.name.toLowerCase().replace(/\s+/g, '-') === providerParam
        );
      });

      if (integration) {
        processedUrlRef.current = providerParam;
        setSelectedIntegration(integration);
        setShowSetupModal(true);

        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('provider');
        window.history.replaceState({}, '', newUrl.toString());
      }
    }

    if (!providerParam) {
      processedUrlRef.current = null;
    }
  }, [location.search, integrations]);

  const handleClearCache = async () => {
    if (!user?.id) {
      toast.error('Unable to clear cache: missing user information');
      return;
    }

    setClearingCache(true);
    try {
      const { data, error } = await supabase.functions.invoke('invalidate-agent-tool-cache', {
        body: { user_id: user.id },
      });

      if (error) {
        toast.error('Failed to clear tool cache');
        return;
      }

      if (data?.success) {
        toast.success(`Tool cache cleared! (${data.tools_count} tools refreshed)`);
        refetchConnections();
      } else {
        toast.error(data?.error || 'Failed to clear cache');
      }
    } catch {
      toast.error('Failed to clear tool cache');
    } finally {
      setClearingCache(false);
    }
  };

  const pipedreamCatalogItems = selectedCategory === 'all'
    ? pipedreamApps.map((app) => ({
      id: `pipedream:${app.name_slug}`,
      category_id: 'pipedream',
      name: app.name,
      description: app.description || `Connect ${app.name} through Pipedream MCP`,
      icon_name: 'Zap',
      status: 'available',
      agent_classification: 'tool',
      is_popular: Boolean(app.featured_weight && app.featured_weight > 0),
      documentation_url: `https://pipedream.com/apps/${app.name_slug}`,
      display_order: 1000 - (app.featured_weight || 0),
      is_pipedream_app: true,
      pipedream_app_slug: app.name_slug,
      pipedream_app_name: app.name,
      pipedream_app_icon_url: app.img_src,
    }))
    : [];

  const filteredNativeIntegrations = integrations.filter((integration) => {
    if (HIDDEN_INTEGRATIONS.includes(integration.name)) {
      return false;
    }

    const matchesSearch =
      integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      integration.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const effectiveStatus = getEffectiveStatus(integration);
    const isNotDisabled = effectiveStatus === 'available' || effectiveStatus === 'beta';

    return matchesSearch && isNotDisabled;
  });
  const filteredIntegrations = [...filteredNativeIntegrations, ...pipedreamCatalogItems];

  const isIntegrationConnected = (integrationName: string) => {
    const pipedreamItem = selectedIntegration?.name === integrationName && selectedIntegration?.is_pipedream_app
      ? selectedIntegration
      : null;
    if (pipedreamItem) {
      return pipedreamAccounts.some(
        (account) => account.app_slug === pipedreamItem.pipedream_app_slug && account.healthy && !account.dead,
      );
    }

    const provider = providerNameForIntegration(integrationName);
    if (!provider) return false;

    if (provider === 'web_search') {
      const webSearchProviders = ['serper_api', 'serpapi', 'brave_search'];
      return unifiedConnections.some(
        (connection) =>
          webSearchProviders.includes(connection.provider_name) &&
          connection.connection_status === 'active',
      );
    }

    return unifiedConnections.some(
      (connection) =>
        connection.provider_name === provider && connection.connection_status === 'active',
    );
  };

  const getConnectionCount = (integrationName: string) => {
    const pipedreamItem = selectedIntegration?.name === integrationName && selectedIntegration?.is_pipedream_app
      ? selectedIntegration
      : null;
    if (pipedreamItem) {
      return pipedreamAccounts.filter(
        (account) => account.app_slug === pipedreamItem.pipedream_app_slug && account.healthy && !account.dead,
      ).length;
    }

    const provider = providerNameForIntegration(integrationName);
    if (!provider) return 0;

    return unifiedConnections.filter(
      (connection) =>
        connection.provider_name === provider && connection.connection_status === 'active',
    ).length;
  };

  if (categoriesLoading || integrationsLoading || unifiedLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Integrations</h2>
        </div>
        <div className="animate-pulse space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex-1 px-24 py-6">
        <div className="flex h-[calc(100vh-4rem)] gap-6 justify-center">
          <IntegrationsListPanel
            isMobile={isMobile}
            clearingCache={clearingCache}
            onClearCache={handleClearCache}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            categories={categories}
            integrations={integrations}
            filteredIntegrations={filteredIntegrations}
            pipedreamLoading={pipedreamLoading}
            selectedIntegration={selectedIntegration}
            onSelectIntegration={setSelectedIntegration}
          />

          <IntegrationDetailsPanel
            selectedIntegration={selectedIntegration}
            setSelectedIntegration={setSelectedIntegration}
            unifiedConnections={unifiedConnections}
            pipedreamAccounts={pipedreamAccounts}
            isIntegrationConnected={isIntegrationConnected}
            getConnectionCount={getConnectionCount}
            onAddCredentials={(integration: any) => {
              setSelectedIntegration(integration);
              setShowSetupModal(true);
            }}
          />
        </div>
      </div>

      <IntegrationSetupModal
        integration={selectedIntegration}
        isOpen={showSetupModal && !!selectedIntegration}
        onClose={() => {
          modalClosedByUserRef.current = true;
          setShowSetupModal(false);
          setSelectedIntegration(null);
        }}
        onComplete={() => {
          setShowSetupModal(false);
          setSelectedIntegration(null);
          refetchConnections();
        }}
      />
    </div>
  );
}
