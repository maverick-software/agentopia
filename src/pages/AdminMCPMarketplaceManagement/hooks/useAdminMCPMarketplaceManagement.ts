import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MCPServerCategory } from '@/lib/mcp/ui-types';
import { mcpService } from '@/lib/services/mcpService';
import { AdminMCPService } from '@/lib/services/adminMCPService';
import type { EnhancedMCPServer } from '@/lib/services/mcpService';
import type { AgentMCPConnection } from '@/lib/services/userMCPService';
import type { AdminMCPTemplate, DashboardStats, DropletSummary, LoadingState } from '../types';

const INITIAL_LOADING: LoadingState = {
  templates: true,
  servers: false,
  connections: false,
  deployment: false,
};

const INITIAL_STATS: DashboardStats = {
  totalTemplates: 0,
  verifiedTemplates: 0,
  totalDeployments: 0,
  activeServers: 0,
  totalConnections: 0,
  errorRate: 0,
};

export function useAdminMCPMarketplaceManagement() {
  const [templates, setTemplates] = useState<AdminMCPTemplate[]>([]);
  const [servers, setServers] = useState<EnhancedMCPServer[]>([]);
  const [connections, setConnections] = useState<AgentMCPConnection[]>([]);
  const [loading, setLoading] = useState<LoadingState>(INITIAL_LOADING);
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [error, setError] = useState<{ message: string; type: string } | null>(null);
  const [activeTab, setActiveTab] = useState('templates');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [selectedTemplate, setSelectedTemplate] = useState<AdminMCPTemplate | null>(null);
  const [selectedServer, setSelectedServer] = useState<EnhancedMCPServer | null>(null);
  const [isTemplateDetailsOpen, setIsTemplateDetailsOpen] = useState(false);
  const [isAddTemplateOpen, setIsAddTemplateOpen] = useState(false);
  const [isDeployDialogOpen, setIsDeployDialogOpen] = useState(false);
  const [isOneClickDialogOpen, setIsOneClickDialogOpen] = useState(false);
  const [oneClickTemplate, setOneClickTemplate] = useState<AdminMCPTemplate | null>(null);

  const [availableDroplets, setAvailableDroplets] = useState<DropletSummary[]>([]);
  const [selectedDropletId, setSelectedDropletId] = useState('');

  const [adminMCPService] = useState(() => new AdminMCPService());

  const loadTemplates = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, templates: true }));
      const marketplaceTemplates = await mcpService.getMarketplaceTemplates();
      const adminTemplates: AdminMCPTemplate[] = marketplaceTemplates.map((template) => ({
        ...template,
        isVerified: template.verified,
        totalDeployments: template.downloads,
        activeDeployments: Math.floor(template.downloads * 0.1),
      }));
      setTemplates(adminTemplates);
    } catch {
      setError({ message: 'Failed to load templates', type: 'templates' });
    } finally {
      setLoading((prev) => ({ ...prev, templates: false }));
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const rawTemplates = await mcpService.getMarketplaceTemplates();
      const totalTemplates = rawTemplates.length;
      const verifiedTemplates = rawTemplates.filter((template) => template.verified).length;
      const dashboardStats = await adminMCPService.getAdminDashboardStats();

      setStats({
        totalTemplates,
        verifiedTemplates,
        totalDeployments: dashboardStats.totalServers || 0,
        activeServers: dashboardStats.runningServers || 0,
        totalConnections: dashboardStats.totalConnections || 0,
        errorRate: Math.round((dashboardStats.errorServers / Math.max(dashboardStats.totalServers, 1)) * 100),
      });
    } catch {
      setError({ message: 'Failed to load statistics', type: 'stats' });
    }
  }, [adminMCPService]);

  const loadMCPServers = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, servers: true }));
      const serversData = await adminMCPService.getAllMCPServers();
      setServers(serversData);
    } catch {
      setError({ message: 'Failed to load MCP servers', type: 'servers' });
    } finally {
      setLoading((prev) => ({ ...prev, servers: false }));
    }
  }, [adminMCPService]);

  const loadConnections = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, connections: true }));
      setConnections([]);
    } catch {
      setError({ message: 'Failed to load connections', type: 'connections' });
    } finally {
      setLoading((prev) => ({ ...prev, connections: false }));
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
    void loadStats();

    if (activeTab === 'servers') {
      void loadMCPServers();
    } else if (activeTab === 'connections') {
      void loadConnections();
    }
  }, [activeTab, loadConnections, loadMCPServers, loadStats, loadTemplates]);

  const toggleVerification = useCallback(
    async (templateId: string, isVerified: boolean) => {
      await mcpService.updateTemplateVerification(templateId, !isVerified);
      await loadTemplates();
      await loadStats();
    },
    [loadStats, loadTemplates],
  );

  const deleteTemplate = useCallback(
    async (templateId: string) => {
      if (!confirm('Are you sure you want to delete this template?')) return;
      await mcpService.deleteTemplate(templateId);
      await loadTemplates();
      await loadStats();
    },
    [loadStats, loadTemplates],
  );

  const addTemplate = useCallback(
    async (templateData: Partial<AdminMCPTemplate>) => {
      await mcpService.createTemplate(templateData);
      await loadTemplates();
      await loadStats();
      setIsAddTemplateOpen(false);
    },
    [loadStats, loadTemplates],
  );

  const loadAvailableDroplets = useCallback(async () => {
    const droplets = await adminMCPService.getAvailableDroplets();
    setAvailableDroplets(droplets);
    setSelectedDropletId(droplets.length > 0 ? droplets[0].id : '');
  }, [adminMCPService]);

  const openDeployDialog = useCallback(
    async (template: AdminMCPTemplate) => {
      setSelectedTemplate(template);
      await loadAvailableDroplets();
      setIsDeployDialogOpen(true);
    },
    [loadAvailableDroplets],
  );

  const deployTemplate = useCallback(async () => {
    if (!selectedTemplate || !selectedDropletId) return;

    try {
      setLoading((prev) => ({ ...prev, deployment: true }));
      const deployment = await adminMCPService.deployMCPServer({
        serverName: `${selectedTemplate.name}-${Date.now()}`,
        serverType: 'mcp_server',
        dockerImage: selectedTemplate.dockerImage,
        transport: 'stdio',
        endpointPath: '/mcp',
        environmentVariables: selectedTemplate.environment || {},
        capabilities: selectedTemplate.requiredCapabilities || ['tools'],
        portMappings: [{ containerPort: 8080, hostPort: 30000 }],
        resourceLimits: {
          memory: selectedTemplate.resourceRequirements.memory,
          cpu: selectedTemplate.resourceRequirements.cpu,
        },
        environmentId: selectedDropletId,
      });

      alert(`Deployment started! Server "${deployment.serverName}" is being deployed.`);
      await loadMCPServers();
      await loadStats();
      setActiveTab('servers');
      setIsDeployDialogOpen(false);
      setSelectedTemplate(null);
    } catch (err) {
      alert(`Failed to deploy template: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading((prev) => ({ ...prev, deployment: false }));
    }
  }, [adminMCPService, loadMCPServers, loadStats, selectedDropletId, selectedTemplate]);

  const handleOneClickDeploy = useCallback((template: AdminMCPTemplate) => {
    setOneClickTemplate(template);
    setIsOneClickDialogOpen(true);
  }, []);

  const handleDeploymentComplete = useCallback(
    () => {
      setIsOneClickDialogOpen(false);
      setOneClickTemplate(null);
      void loadMCPServers();
    },
    [loadMCPServers],
  );

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesSearch =
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [categoryFilter, searchTerm, templates]);

  const categories = useMemo(() => ['all', ...Array.from(new Set(templates.map((template) => template.category)))], [templates]);

  const openTemplateDetails = (template: AdminMCPTemplate) => {
    setSelectedTemplate(template);
    setIsTemplateDetailsOpen(true);
  };

  return {
    templates,
    servers,
    connections,
    loading,
    stats,
    error,
    activeTab,
    searchTerm,
    categoryFilter,
    selectedTemplate,
    selectedServer,
    isTemplateDetailsOpen,
    isAddTemplateOpen,
    isDeployDialogOpen,
    isOneClickDialogOpen,
    oneClickTemplate,
    availableDroplets,
    selectedDropletId,
    filteredTemplates,
    categories,
    adminMCPService,
    setActiveTab,
    setSearchTerm,
    setCategoryFilter,
    setSelectedServer,
    setSelectedTemplate,
    setSelectedDropletId,
    setIsTemplateDetailsOpen,
    setIsAddTemplateOpen,
    setIsDeployDialogOpen,
    setIsOneClickDialogOpen,
    toggleVerification,
    deleteTemplate,
    addTemplate,
    openDeployDialog,
    deployTemplate,
    handleOneClickDeploy,
    handleDeploymentComplete,
    openTemplateDetails,
  };
}
