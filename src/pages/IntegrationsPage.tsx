import React, { useEffect, useState } from 'react';
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
  Mail
} from 'lucide-react';
import { useIntegrationCategories, useIntegrationsByCategory } from '@/hooks/useIntegrations';
import { Link, useLocation } from 'react-router-dom';
import { useConnections } from '@/hooks/useConnections';
import { IntegrationSetupModal } from '@/components/integrations/IntegrationSetupModal';
import { useGmailConnection } from '@/hooks/useGmailIntegration';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const location = useLocation();
  
  const { categories, loading: categoriesLoading } = useIntegrationCategories();
  const { integrations, loading: integrationsLoading } = useIntegrationsByCategory(
    selectedCategory === 'all' ? undefined : selectedCategory
  );
  const { connections: unifiedConnections, loading: unifiedLoading, refetch: refetchConnections } = useConnections({ includeRevoked: false });
  const { connections: gmailConnections } = useGmailConnection();

  // Override integration status - Gmail, SendGrid, Mailgun and Web Search providers are available
  const getEffectiveStatus = (integration: any) => {
    // Gmail is available
    if (integration.name === 'Gmail') {
      return 'available';
    }
    
    // SendGrid is available
    if (integration.name === 'SendGrid') {
      return 'available';
    }
    
    // Mailgun is available
    if (integration.name === 'Mailgun') {
      return 'available';
    }
    
    // Unified Web Search integration is available
    if (integration.name === 'Web Search') {
      return 'available';
    }
    
    // Legacy web search providers are deprecated (but keep them available for existing connections)
    if (['Serper API', 'SerpAPI', 'Brave Search API'].includes(integration.name)) {
      return 'deprecated';
    }
    // Pinecone & GetZep API key integrations are available
    if (['Pinecone', 'GetZep'].includes(integration.name)) {
      return 'available';
    }
    
    // Everything else is coming soon
    return 'coming_soon';
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
      default:
        return Settings;
    }
  };

  const filteredIntegrations = integrations.filter(integration => {
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
      case 'SendGrid':
        return 'sendgrid';
      case 'Mailgun':
        return 'mailgun';
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

  // Ensure modal does not persist when navigating between routes
  useEffect(() => {
    setShowSetupModal(false);
    setSelectedIntegration(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, location.hash]);

  if (categoriesLoading || integrationsLoading || unifiedLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Integrations</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
    <div className="flex-1 space-y-6 p-4 pt-6">
      {/* Header */}
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Integrations</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              {unifiedConnections.length} connected
            </span>
          </div>
        </div>
        
        <p className="text-muted-foreground text-sm">
          Connect your favorite tools and services to power your AI agents with external capabilities.
        </p>
      </div>

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
            {/* Integration Cards Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredIntegrations.map((integration) => {
                const IconComponent = getIconComponent(integration.icon_name || 'Settings');
                const isConnected = isIntegrationConnected(integration.name);
                const statusIcon = getConnectionStatusIcon(isConnected ? 'connected' : 'disconnected');
                const effectiveStatus = getEffectiveStatus(integration);
                const isComingSoon = effectiveStatus === 'coming_soon';
                
                return (
                  <Card 
                    key={integration.id} 
                    className={`bg-card border-border transition-colors ${
                      isComingSoon ? 'opacity-60' : 'hover:border-muted-foreground'
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${
                            isComingSoon ? 'bg-muted/50' : 'bg-muted'
                          }`}>
                            <IconComponent className={`h-5 w-5 ${
                              isComingSoon ? 'text-muted-foreground' : 'text-primary'
                            }`} />
                          </div>
                          <div>
                            <CardTitle className={`text-lg font-semibold ${
                              isComingSoon ? 'text-muted-foreground' : 'text-card-foreground'
                            }`}>
                              {integration.name}
                            </CardTitle>
                            {integration.is_popular && !isComingSoon && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                Popular
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {!isComingSoon && statusIcon}
                          <Badge className={getStatusColor(effectiveStatus)}>
                            {getStatusText(effectiveStatus)}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <p className={`text-sm line-clamp-3 ${
                        isComingSoon ? 'text-muted-foreground/50' : 'text-muted-foreground'
                      }`}>
                        {integration.description}
                      </p>
                      
                      {isConnected && !isComingSoon && (
                        <div className="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
                          <Check className="h-4 w-4" />
                          <span>
                            Connected
                            {integration.name === 'Gmail' && gmailConnections.length > 1 && 
                              ` (${gmailConnections.length} accounts)`
                            }
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-2">
                        {isConnected && !isComingSoon ? (
                          <div className="flex w-full gap-2">
                            {/* Add Another Account when already connected (Gmail only) */}
                            {integration.name === 'Gmail' ? (
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
                            {/* Manage should navigate to Credentials page */}
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
                      
                      {integration.documentation_url && !isComingSoon && (
                        <div className="pt-2 border-t border-border">
                          <a 
                            href={integration.documentation_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:text-primary/80 flex items-center"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View Documentation
                          </a>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            
            {filteredIntegrations.length === 0 && (
              <div className="text-center py-8">
                <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No integrations found matching your search.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Integration Setup Modal */}
      {selectedIntegration && (
        <IntegrationSetupModal
          integration={selectedIntegration}
          isOpen={showSetupModal}
          onClose={() => {
            // Ensure modal does not auto-reopen after navigation
            setShowSetupModal(false);
            setSelectedIntegration(null);
          }}
          onComplete={handleSetupComplete}
        />
      )}
    </div>
  );
} 