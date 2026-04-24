import { AlertCircle, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddTemplateForm } from './components/AddTemplateForm';
import { DeployTemplateDialog } from './components/DeployTemplateDialog';
import { OneClickDeploymentDialog } from './components/OneClickDeploymentDialog';
import { ServersTab } from './components/ServersTab';
import { StatsCards } from './components/StatsCards';
import { TemplateDetailsDialog } from './components/TemplateDetailsDialog';
import { TemplatesTab } from './components/TemplatesTab';
import { useAdminMCPMarketplaceManagement } from './hooks/useAdminMCPMarketplaceManagement';

export default function AdminMCPMarketplaceManagement() {
  const {
    servers,
    loading,
    stats,
    error,
    activeTab,
    searchTerm,
    categoryFilter,
    selectedTemplate,
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
  } = useAdminMCPMarketplaceManagement();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCP Template Management</h1>
          <p className="text-muted-foreground">Manage MCP server templates and deploy them to droplets</p>
        </div>
        <div className="flex gap-2">
          {error && (
            <Badge variant="destructive" className="mr-2">
              <AlertCircle className="w-3 h-3 mr-1" />
              {error.message}
            </Badge>
          )}
          <Button onClick={() => setIsAddTemplateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Template
          </Button>
        </div>
      </div>

      <StatsCards stats={stats} loading={loading} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="servers">Deployed Servers</TabsTrigger>
          <TabsTrigger value="connections">Active Connections</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <TemplatesTab
            loading={loading.templates}
            searchTerm={searchTerm}
            categoryFilter={categoryFilter}
            categories={categories}
            filteredTemplates={filteredTemplates}
            onSearchTermChange={setSearchTerm}
            onCategoryFilterChange={setCategoryFilter}
            onViewDetails={openTemplateDetails}
            onToggleVerification={(templateId, isVerified) => void toggleVerification(templateId, isVerified)}
            onDeleteTemplate={(templateId) => void deleteTemplate(templateId)}
            onOneClickDeploy={handleOneClickDeploy}
            onManualDeploy={(template) => void openDeployDialog(template)}
          />
        </TabsContent>

        <TabsContent value="servers">
          <ServersTab
            loading={loading.servers}
            servers={servers}
            onBrowseTemplates={() => setActiveTab('templates')}
            onSelectServer={() => {}}
            onStopServer={(serverId) => void adminMCPService.stopMCPServer(serverId)}
            onStartServer={(serverId) => void adminMCPService.startMCPServer(serverId)}
            onDeleteServer={(serverId) => void adminMCPService.deleteMCPServer(serverId)}
          />
        </TabsContent>

        <TabsContent value="connections">
          <div className="text-center py-8 text-muted-foreground">Connection monitoring coming soon...</div>
        </TabsContent>
      </Tabs>

      <TemplateDetailsDialog template={selectedTemplate} open={isTemplateDetailsOpen} onOpenChange={setIsTemplateDetailsOpen} />

      <Dialog open={isAddTemplateOpen} onOpenChange={setIsAddTemplateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New MCP Template</DialogTitle>
          </DialogHeader>
          <AddTemplateForm onSubmit={(data) => void addTemplate(data)} onCancel={() => setIsAddTemplateOpen(false)} />
        </DialogContent>
      </Dialog>

      <DeployTemplateDialog
        open={isDeployDialogOpen}
        template={selectedTemplate}
        droplets={availableDroplets}
        selectedDropletId={selectedDropletId}
        loading={loading.deployment}
        onOpenChange={setIsDeployDialogOpen}
        onDropletChange={setSelectedDropletId}
        onDeploy={() => void deployTemplate()}
      />

      <OneClickDeploymentDialog
        open={isOneClickDialogOpen}
        template={oneClickTemplate}
        onOpenChange={setIsOneClickDialogOpen}
        onDeploymentComplete={handleDeploymentComplete}
        onDeploymentError={(errorMessage) => console.error('Deployment failed:', errorMessage)}
      />
    </div>
  );
}
