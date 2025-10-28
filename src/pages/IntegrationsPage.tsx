import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database, 
  Key, 
  Globe, 
  MessageSquare, 
  Shield, 
  Zap, 
  Cloud, 
  GitBranch,
  Settings,
  ExternalLink,
  Plus,
  Search,
  Check,
  Clock,
  AlertCircle,
  ChevronRight,
  Mail,
  Server,
  RefreshCw
} from 'lucide-react';
import { useIntegrationCategories, useIntegrationsByCategory, useConnections } from '@/integrations/_shared';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { IntegrationSetupModal } from '@/components/integrations/IntegrationSetupModal';
import { useGmailConnection } from '@/integrations/gmail';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { ResponsiveGrid } from '@/components/mobile/ResponsiveGrid';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { getPagePadding } from '@/lib/pwaTheme';

const getStatusColor = (status: string) => {
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
};

const getStatusText = (status: string) => {
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
};

const getConnectionStatusIcon = (status: string) => {
  switch (status) {
    case 'connected':
      return <Check className="h-4 w-4 text-green-600 dark:text-green-400" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    default:
      return null;
  }
};

export function IntegrationsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const modalClosedByUserRef = React.useRef(false); // Track if modal was closed by user action
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // Component lifecycle tracking (can be removed in production)
  // React.useEffect(() => {
  //   console.log('[IntegrationsPage] Component mounted');
  //   return () => console.log('[IntegrationsPage] Component unmounting');
  // }, []);
  
  const { categories, loading: categoriesLoading } = useIntegrationCategories();
  const { integrations, loading: integrationsLoading } = useIntegrationsByCategory(
    selectedCategory === 'all' ? undefined : selectedCategory
  );
  const { connections: unifiedConnections, loading: unifiedLoading, refetch: refetchConnections } = useConnections({ includeRevoked: false });
  const { connections: gmailConnections } = useGmailConnection();

  // Handle URL parameters to auto-open specific provider modals
  const processedUrlRef = useRef<string | null>(null);
  
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const providerParam = searchParams.get('provider');
    
    // Only process if we haven't already processed this provider parameter
    if (providerParam && providerParam !== processedUrlRef.current && integrations.length > 0) {
      // Find the integration by provider name
      const integration = integrations.find(int => {
        const providerName = providerNameForIntegration(int.name);
        return providerName === providerParam || int.name.toLowerCase().replace(/\s+/g, '-') === providerParam;
      });
      
      if (integration) {
        console.log('[IntegrationsPage] Auto-opening modal for provider:', providerParam);
        processedUrlRef.current = providerParam; // Mark as processed
        setSelectedIntegration(integration);
        setShowSetupModal(true);
        
        // Clean up URL parameter
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('provider');
        window.history.replaceState({}, '', newUrl.toString());
      }
    }
    
    // Reset processed URL when there's no provider parameter
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
        body: {
          user_id: user.id
        }
      });

      if (error) {
        console.error('Cache clear error:', error);
        toast.error('Failed to clear tool cache');
        return;
      }

      if (data?.success) {
        toast.success(`Tool cache cleared! (${data.tools_count} tools refreshed)`);
        // Refresh connections after clearing cache
        refetchConnections();
      } else {
        toast.error(data?.error || 'Failed to clear cache');
      }
    } catch (error: any) {
      console.error('Cache clear error:', error);
      toast.error('Failed to clear tool cache');
    } finally {
      setClearingCache(false);
    }
  };

  // Use the actual status from the database - no hardcoded overrides
  const getEffectiveStatus = (integration: any) => {
    return integration.status || 'coming_soon';
  };

  const getIconComponent = (iconName: string) => {
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
  };

  // Integrations that should NOT appear in user integrations page
  const hiddenIntegrations = [
    // System-level API keys (managed in Admin Settings → API Keys)
    'OpenAI',
    'Mistral AI',
    'Serper API',
    
    // Internal tools (not external integrations)
    'Contact Management',
    'Conversation Memory',
    'Advanced Reasoning',
    'Temporary Chat Links',
    
    // Not used / deprecated
    'Brave Search API',
    'SerpAPI',
    'OCR.Space',
    'OCR Space',
    'Google',
    'Microsoft'
  ];

  const filteredIntegrations = integrations.filter(integration => {
    // Hide internal tools, system-level, and unused integrations
    if (hiddenIntegrations.includes(integration.name)) {
      return false;
    }
    
    const matchesSearch = integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      integration.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const effectiveStatus = getEffectiveStatus(integration);
    const isNotDisabled = effectiveStatus === 'available' || effectiveStatus === 'beta';
    
    return matchesSearch && isNotDisabled;
  });

  const providerNameForIntegration = (name: string): string | null => {
    switch (name) {
      case 'Gmail':
        return 'gmail';
      case 'SMTP':
        return 'smtp';
      case 'Web Search':
        return 'web_search'; // Unified web search - will check all providers
      case 'Serper API':
        return 'serper_api';
      case 'SerpAPI':
        return 'serpapi';
      case 'Brave Search API':
        return 'brave_search';
      case 'Pinecone':
        return 'pinecone';
      case 'GetZep':
        return 'getzep';
      case 'DigitalOcean':
        return 'digitalocean';
      case 'Discord':
        return 'discord';
      case 'Microsoft Teams':
        return 'microsoft-teams';
      case 'Microsoft Outlook':
        return 'microsoft-outlook';
      case 'Microsoft OneDrive':
        return 'microsoft-onedrive';
      default:
        return null;
    }
  };

  const isIntegrationConnected = (integrationName: string) => {
    const provider = providerNameForIntegration(integrationName);
    if (!provider) return false;
    
    // For unified Web Search, check if any web search provider is connected
    if (provider === 'web_search') {
      const webSearchProviders = ['serper_api', 'serpapi', 'brave_search'];
      return unifiedConnections.some(c => 
        webSearchProviders.includes(c.provider_name) && c.connection_status === 'active'
      );
    }
    
        // Email Relay removed - using direct provider matching now
    
    return unifiedConnections.some(c => c.provider_name === provider && c.connection_status === 'active');
  };

  const handleAddCredentials = (integration: any) => {
    setSelectedIntegration(integration);
    setShowSetupModal(true);
  };

  const handleSetupComplete = () => {
    setShowSetupModal(false);
    setSelectedIntegration(null);
    // Refresh unified connections for live status
    refetchConnections();
  };

  // Protect against soft refresh issues when tabbing away
  const closeModal = () => {
    setShowSetupModal(false);
    setSelectedIntegration(null);
  };
  
  // Modal state protection (no longer needed after AuthContext fix)
  // useModalSoftRefreshProtection(...);

  // Debug modal state changes (can be removed in production)
  // React.useEffect(() => {
  //   console.log('[IntegrationsPage] Modal state:', { showSetupModal, selectedIntegration: selectedIntegration?.name });
  // }, [showSetupModal, selectedIntegration]);

  if (categoriesLoading || integrationsLoading || unifiedLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Integrations</h2>
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-card border-border animate-pulse">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="h-6 w-32 bg-muted rounded"></div>
                  <div className="h-4 w-16 bg-muted rounded"></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full bg-muted rounded mb-2"></div>
                <div className="h-4 w-2/3 bg-muted rounded mb-4"></div>
                <div className="h-8 w-full bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      {isMobile && (
        <MobileHeader
          title="Integrations"
          showMenu={true}
          actions={
            <button
              onClick={handleClearCache}
              disabled={clearingCache}
              className="touch-target p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
              title="Clear cache"
            >
              <RefreshCw className={`w-5 h-5 text-muted-foreground ${clearingCache ? 'animate-spin' : ''}`} />
            </button>
          }
        />
      )}

      <div className={`flex-1 space-y-6 ${getPagePadding(isMobile)}`}>
        {/* Desktop Header */}
        {!isMobile && (
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Integrations</h2>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">
                  {unifiedConnections.length} connected
                </span>
                <button
                  onClick={handleClearCache}
                  disabled={clearingCache}
                  className="p-1.5 hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
                  title="Clear tool cache (refreshes integration tools and schemas)"
                >
                  <RefreshCw className={`h-4 w-4 text-muted-foreground ${clearingCache ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            
            <p className="text-muted-foreground text-sm">
              Connect your favorite tools and services to power your AI agents with external capabilities.
            </p>
          </div>
        )}

      {/* Search and Filter */}
      <div className="flex flex-col space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search integrations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-input border-border text-foreground placeholder-muted-foreground"
          />
        </div>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="bg-card border-border">
            <TabsTrigger value="all" className="text-foreground">
              All ({integrations.length})
            </TabsTrigger>
            {categories.map((category) => {
              const CategoryIcon = getIconComponent(category.icon_name);
              return (
                <TabsTrigger key={category.id} value={category.id} className="text-foreground">
                  <CategoryIcon className="h-4 w-4 mr-2" />
                  {category.name}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={selectedCategory} className="space-y-4">
            {/* Integration Cards Grid - Responsive: 1 col mobile, 2 cols tablet, 3 cols desktop */}
            <ResponsiveGrid type="tools" gap="md">
              {filteredIntegrations.map((integration) => {
                const IconComponent = getIconComponent(integration.icon_name || 'Settings');
                const isConnected = isIntegrationConnected(integration.name);
                const statusIcon = getConnectionStatusIcon(isConnected ? 'connected' : 'disconnected');
                const effectiveStatus = getEffectiveStatus(integration);
                const isComingSoon = effectiveStatus === 'coming_soon';
                
                return (
                  <Card 
                    key={integration.id} 
                    className={`bg-card/50 border-border/50 hover:bg-card transition-colors w-full min-h-[240px] flex flex-col ${
                      isComingSoon ? 'opacity-60' : 'hover:border-muted-foreground'
                    }`}
                  >
                    {/* Header - Fixed Height: 72px (reduced from 80px since no Popular badge) */}
                    <div className="p-6 pb-3 h-[72px] flex-shrink-0">
                      <div className="flex items-start justify-between h-full">
                        <div className="flex items-start space-x-3 min-w-0 flex-1">
                          <div className={`p-2 rounded-lg flex-shrink-0 ${
                            isComingSoon ? 'bg-muted/50' : 'bg-muted'
                          }`}>
                            <IconComponent className={`h-5 w-5 ${
                              isComingSoon ? 'text-muted-foreground' : 'text-primary'
                            }`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className={`text-lg font-semibold leading-tight truncate ${
                              isComingSoon ? 'text-muted-foreground' : 'text-card-foreground'
                            }`}>
                              {integration.name}
                            </h3>
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          <Badge className={getStatusColor(effectiveStatus)}>
                            {getStatusText(effectiveStatus)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    {/* Description - Flexible height with max 3 lines */}
                    <div className="px-6 pb-4 flex-shrink-0">
                      <p 
                        className={`text-sm leading-relaxed overflow-hidden ${
                          isComingSoon ? 'text-muted-foreground/50' : 'text-muted-foreground'
                        }`} 
                        style={{ 
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical'
                        }}
                      >
                        {integration.description || 'Integration description not yet available.'}
                      </p>
                    </div>
                    
                    {/* Spacer for consistent layout */}
                    <div className="px-6 h-7 flex items-center flex-shrink-0">
                      {/* Connection status removed - state is shown through buttons instead */}
                    </div>
                    
                    {/* Flexible spacer to push buttons to bottom */}
                    <div className="flex-1"></div>
                    
                    {/* Button Section - Fixed Height: 40px */}
                    <div className="px-6 h-10 flex items-center flex-shrink-0 mb-2">
                      {isConnected && !isComingSoon ? (
                        <div className="flex w-full gap-2">
                          {(integration.name === 'Gmail' || integration.name === 'Microsoft Outlook') ? (
                            <Button
                              onClick={() => handleAddCredentials(integration)}
                              size="sm"
                              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Another Account
                            </Button>
                          ) : (
                            <span className="flex-1" />
                          )}
                          <Link to="/credentials" className="flex-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full border-border text-foreground hover:bg-accent"
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Manage
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <Button 
                          onClick={() => handleAddCredentials(integration)}
                          className={`w-full ${
                            isComingSoon 
                              ? 'bg-muted hover:bg-muted text-muted-foreground cursor-not-allowed' 
                              : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                          }`}
                          disabled={isComingSoon}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {isComingSoon ? 'Coming Soon' : 'Add Credentials'}
                        </Button>
                      )}
                    </div>
                    
                    {/* Documentation Link - Reduced spacing */}
                    <div className="px-6 border-t border-border h-9 flex items-center flex-shrink-0">
                      {integration.documentation_url && !isComingSoon ? (
                        <a 
                          href={integration.documentation_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:text-primary/80 flex items-center"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Documentation
                        </a>
                      ) : (
                        <div className="h-4"></div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </ResponsiveGrid>
            
            {filteredIntegrations.length === 0 && (
              <div className="text-center py-8">
                <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No integrations found matching your search.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      </div>

      {/* Integration Setup Modal - Always render to preserve state */}
      <IntegrationSetupModal
        integration={selectedIntegration}
        isOpen={showSetupModal && !!selectedIntegration}
        onClose={() => {
          console.log('[IntegrationsPage] Modal onClose called - user action');
          modalClosedByUserRef.current = true;
          setShowSetupModal(false);
          setSelectedIntegration(null);
        }}
        onComplete={handleSetupComplete}
      />
    </div>
  );
} 