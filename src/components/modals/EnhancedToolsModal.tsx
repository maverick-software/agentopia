import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, 
  Check, 
  Search,
  Globe,
  Shield,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Plus,
  Key,
  Zap,
  Settings,
  FileText,
  BarChart3
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useWebSearchConnection } from '@/hooks/useWebSearchIntegration';
import { useIntegrationsByClassification } from '@/hooks/useIntegrations';
import { AgentIntegrationsManager } from '@/components/agent-edit/AgentIntegrationsManager';
import { toast } from 'react-hot-toast';

interface EnhancedToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

export function EnhancedToolsModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated
}: EnhancedToolsModalProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const { connections: webSearchConnections } = useWebSearchConnection();
  const { integrations } = useIntegrationsByClassification('tool');
  
  // UI state
  const [activeTab, setActiveTab] = useState('connected');
  const [connectingService, setConnectingService] = useState<string | null>(null);
  const [setupService, setSetupService] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  
  // Setup form state
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [connectionName, setConnectionName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Available tool services organized by category
  const TOOL_CATEGORIES = [
    {
      id: 'research',
      name: 'Research & Data',
      icon: Search,
      gradient: 'from-blue-500 to-cyan-500',
      tools: [
        {
          id: 'serper_api',
          name: 'Serper API',
          description: 'Fast Google search results with real-time data',
          type: 'api_key',
          setupUrl: 'https://serper.dev',
          rateLimit: '2,500 queries/month free',
          features: ['Web Search', 'News Search', 'Image Search', 'Maps Search']
        },
        {
          id: 'serpapi',
          name: 'SerpAPI',
          description: 'Comprehensive search engine results API',
          type: 'api_key',
          setupUrl: 'https://serpapi.com',
          rateLimit: '100 queries/month free',
          features: ['Google Search', 'Bing Search', 'DuckDuckGo', 'Local Results']
        },
        {
          id: 'brave_search',
          name: 'Brave Search API',
          description: 'Privacy-focused independent search results',
          type: 'api_key',
          setupUrl: 'https://brave.com/search/api',
          rateLimit: '2,000 queries/month free',
          features: ['Web Search', 'Privacy Focused', 'Ad-free Results']
        }
      ]
    },
    {
      id: 'productivity',
      name: 'Productivity & Analysis',
      icon: BarChart3,
      gradient: 'from-green-500 to-emerald-500',
      tools: [
        // We can add more productivity tools here
      ]
    },
    {
      id: 'content',
      name: 'Content & Media',
      icon: FileText,
      gradient: 'from-purple-500 to-pink-500',
      tools: [
        // We can add content tools here
      ]
    }
  ];

  // Clear saved state after 3 seconds
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  // Reset form state
  const resetForm = () => {
    setSelectedProvider('');
    setApiKey('');
    setConnectionName('');
    setError(null);
  };

  const handleApiKeySetup = async (toolId: string) => {
    if (!selectedProvider || !apiKey || !user) {
      setError('Please select a provider and enter an API key');
      return;
    }

    setConnectingService(toolId);
    setError(null);

    try {
      // Get provider configuration
      const { data: providerData, error: providerError } = await supabase
        .from('oauth_providers')
        .select('id')
        .eq('name', selectedProvider)
        .single();

      if (providerError) throw providerError;

      // Encrypt API key using Supabase
      const { data: encryptedKey, error: encryptError } = await supabase
        .rpc('vault_encrypt', { 
          data: apiKey,
          key_name: `${selectedProvider}_api_key_${user.id}_${Date.now()}`
        });

      if (encryptError) throw encryptError;

      // Store connection
      const { error: insertError } = await supabase
        .from('user_oauth_connections')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id, // Required field
          external_username: connectionName || `${selectedProvider} Connection`,
          connection_name: connectionName || `${selectedProvider} Connection`,
          encrypted_access_token: encryptedKey,
          scopes_granted: ['web_search', 'news_search', 'image_search'],
          connection_status: 'active'
        });

      if (insertError) throw insertError;

      const toolName = TOOL_CATEGORIES
        .flatMap(cat => cat.tools)
        .find(tool => tool.id === selectedProvider)?.name || selectedProvider;

      toast.success(`${toolName} connected successfully! 🎉`);
      setSaved(true);
      setSetupService(null);
      resetForm();
      
      // Switch to connected tab to show the new connection
      setActiveTab('connected');
      
    } catch (error: any) {
      console.error('API key setup error:', error);
      setError(error.message || 'Failed to connect tool');
      toast.error('Failed to connect tool');
    } finally {
      setConnectingService(null);
    }
  };

  const getToolStatus = (toolId: string) => {
    // Check if this tool is connected
    const hasConnection = webSearchConnections.some(conn => 
      conn.provider_name === toolId || conn.provider_name === `${toolId}_api`
    );
    return hasConnection ? 'connected' : 'available';
  };

  const renderApiKeySetup = (tool: any) => {
    const availableProviders = TOOL_CATEGORIES
      .find(cat => cat.id === 'research')?.tools || [];

    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5 text-blue-500" />
            <span>API Key Setup</span>
          </CardTitle>
          <CardDescription>
            Enter your API key to connect {tool.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="provider_select">
              Search Provider
            </Label>
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a search provider" />
              </SelectTrigger>
              <SelectContent>
                {availableProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProvider && (
            <>
              <div>
                <Label htmlFor="connection_name">
                  Connection Name (Optional)
                </Label>
                <Input
                  id="connection_name"
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                  placeholder={`My ${availableProviders.find(p => p.id === selectedProvider)?.name} Connection`}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="api_key">
                  API Key
                </Label>
                <Input
                  id="api_key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  className="mt-1"
                />
              </div>

              {availableProviders.find(p => p.id === selectedProvider) && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p><strong>Rate Limit:</strong> {availableProviders.find(p => p.id === selectedProvider)?.rateLimit}</p>
                      <p>
                        <Button variant="link" className="p-0 h-auto" asChild>
                          <a 
                            href={availableProviders.find(p => p.id === selectedProvider)?.setupUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            Get API Key <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={() => handleApiKeySetup(tool.id)}
                disabled={!apiKey || connectingService === tool.id}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white"
              >
                {connectingService === tool.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Connect Tool
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderAvailableTools = () => {
    return (
      <div className="space-y-6">
        <div className="text-sm text-muted-foreground mb-4">
          Choose tools to enhance your agent's capabilities:
        </div>
        
        {TOOL_CATEGORIES.map((category) => {
          if (category.tools.length === 0) return null;
          
          const CategoryIcon = category.icon;
          
          return (
            <div key={category.id} className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${category.gradient} flex items-center justify-center`}>
                  <CategoryIcon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium">{category.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {category.tools.length} tool{category.tools.length !== 1 ? 's' : ''} available
                  </p>
                </div>
              </div>
              
              <div className="ml-11 space-y-3">
                {category.tools.map((tool) => {
                  const status = getToolStatus(tool.id);
                  const isConnected = status === 'connected';
                  const isSetupMode = setupService === tool.id;
                  
                  if (isSetupMode) {
                    return (
                      <div key={tool.id} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium">{tool.name}</h4>
                              <Badge variant="outline" className="text-xs">Setting up...</Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSetupService(null);
                              resetForm();
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                        {renderApiKeySetup(tool)}
                      </div>
                    );
                  }
                  
                  return (
                    <div
                      key={tool.id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                        isConnected
                          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                          : 'border-border hover:border-border hover:bg-accent/50'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium">{tool.name}</h4>
                          {isConnected && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                              Connected
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{tool.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {tool.features.map((feature, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        {isConnected ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <Button
                            onClick={() => setSetupService(tool.id)}
                            size="sm"
                            className={`bg-gradient-to-r ${category.gradient} hover:opacity-90 text-white`}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center">
            ⚡ Tools
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Connect tools and services to expand your agent's capabilities.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="connected">Connected Tools</TabsTrigger>
              <TabsTrigger value="available">Add New Tool</TabsTrigger>
            </TabsList>
            
            <TabsContent value="connected" className="mt-6">
              {/* Use the existing AgentIntegrationsManager for connected tools */}
              <div className="min-h-[300px]">
                <AgentIntegrationsManager
                  agentId={agentId}
                  category="tool"
                  title=""
                  description=""
                />
              </div>
            </TabsContent>
            
            <TabsContent value="available" className="mt-6">
              <div className="min-h-[300px]">
                {renderAvailableTools()}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}