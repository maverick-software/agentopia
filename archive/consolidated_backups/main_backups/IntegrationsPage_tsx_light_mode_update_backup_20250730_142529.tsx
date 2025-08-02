import React, { useState } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { useIntegrationCategories, useIntegrationsByCategory, useUserIntegrations } from '@/hooks/useIntegrations';
import { IntegrationSetupModal } from '@/components/integrations/IntegrationSetupModal';
import { useGmailConnection } from '@/hooks/useGmailIntegration';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'available':
      return 'bg-green-500/20 text-green-300 border-green-500/30';
    case 'beta':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'coming_soon':
      return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    case 'deprecated':
      return 'bg-red-500/20 text-red-300 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
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
      return <Check className="h-4 w-4 text-green-400" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-400" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-400" />;
    default:
      return null;
  }
};

export function IntegrationsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  
  const { categories, loading: categoriesLoading } = useIntegrationCategories();
  const { integrations, loading: integrationsLoading } = useIntegrationsByCategory(
    selectedCategory === 'all' ? undefined : selectedCategory
  );
  const { userIntegrations, loading: userIntegrationsLoading } = useUserIntegrations();
  const { connections: gmailConnections } = useGmailConnection();

  // Override integration status - Gmail and Web Search providers are available
  const getEffectiveStatus = (integration: any) => {
    // Gmail is available
    if (integration.name === 'Gmail') {
      return 'available';
    }
    
    // Web Search providers are available
    if (['Serper API', 'SerpAPI', 'Brave Search API'].includes(integration.name)) {
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
      case 'Cloud':
        return Cloud;
      case 'Zap':
        return Zap;
      default:
        return Settings;
    }
  };

  const filteredIntegrations = integrations.filter(integration =>
    integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    integration.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getUserIntegrationStatus = (integrationId: string) => {
    const userIntegration = userIntegrations.find(ui => ui.integration_id === integrationId);
    return userIntegration?.connection_status || 'disconnected';
  };

  const handleAddCredentials = (integration: any) => {
    setSelectedIntegration(integration);
    setShowSetupModal(true);
  };

  const handleSetupComplete = () => {
    setShowSetupModal(false);
    setSelectedIntegration(null);
    // Refresh user integrations
    window.location.reload();
  };

  if (categoriesLoading || integrationsLoading || userIntegrationsLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-white">Integrations</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-gray-900 border-gray-800 animate-pulse">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="h-6 w-32 bg-gray-700 rounded"></div>
                  <div className="h-4 w-16 bg-gray-700 rounded"></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full bg-gray-700 rounded mb-2"></div>
                <div className="h-4 w-2/3 bg-gray-700 rounded mb-4"></div>
                <div className="h-8 w-full bg-gray-700 rounded"></div>
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
          <h2 className="text-3xl font-bold tracking-tight text-white">Integrations</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">
              {userIntegrations.length} connected
            </span>
          </div>
        </div>
        
        <p className="text-gray-400 text-sm">
          Connect your favorite tools and services to power your AI agents with external capabilities.
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search integrations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
          />
        </div>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="bg-gray-800 border-gray-700">
            <TabsTrigger value="all" className="text-gray-300">
              All ({integrations.length})
            </TabsTrigger>
            {categories.map((category) => {
              const CategoryIcon = getIconComponent(category.icon_name);
              return (
                <TabsTrigger key={category.id} value={category.id} className="text-gray-300">
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
                const userStatus = getUserIntegrationStatus(integration.id);
                const isConnected = userStatus === 'connected';
                const statusIcon = getConnectionStatusIcon(userStatus);
                const effectiveStatus = getEffectiveStatus(integration);
                const isComingSoon = effectiveStatus === 'coming_soon';
                
                return (
                  <Card 
                    key={integration.id} 
                    className={`bg-gray-900 border-gray-800 transition-colors ${
                      isComingSoon ? 'opacity-60' : 'hover:border-gray-700'
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${
                            isComingSoon ? 'bg-gray-800/50' : 'bg-gray-800'
                          }`}>
                            <IconComponent className={`h-5 w-5 ${
                              isComingSoon ? 'text-gray-500' : 'text-blue-400'
                            }`} />
                          </div>
                          <div>
                            <CardTitle className={`text-lg font-semibold ${
                              isComingSoon ? 'text-gray-400' : 'text-white'
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
                        isComingSoon ? 'text-gray-500' : 'text-gray-400'
                      }`}>
                        {integration.description}
                      </p>
                      
                      {isConnected && !isComingSoon && (
                        <div className="flex items-center space-x-2 text-sm text-green-400">
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
                          <>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                              onClick={() => handleAddCredentials(integration)}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Manage
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="border-gray-700 text-gray-300 hover:bg-gray-800"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button 
                            onClick={() => handleAddCredentials(integration)}
                            className={`w-full ${
                              isComingSoon 
                                ? 'bg-gray-700 hover:bg-gray-700 text-gray-500 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                            disabled={isComingSoon}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            {isComingSoon ? 'Coming Soon' : 
                              integration.name === 'Gmail' && isConnected ? 'Add Another Account' : 'Add Credentials'
                            }
                          </Button>
                        )}
                      </div>
                      
                      {integration.documentation_url && !isComingSoon && (
                        <div className="pt-2 border-t border-gray-800">
                          <a 
                            href={integration.documentation_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
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
                <Settings className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No integrations found matching your search.</p>
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
          onClose={() => setShowSetupModal(false)}
          onComplete={handleSetupComplete}
        />
      )}
    </div>
  );
} 