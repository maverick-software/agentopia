import { useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProviderFormDialog } from './ProviderFormDialog';
import { ProvidersListCard } from './ProvidersListCard';
import { useAdminIntegrationManagement } from './useAdminIntegrationManagement';

export function AdminIntegrationManagement() {
  const {
    loading,
    searchTerm,
    statusFilter,
    isAddDialogOpen,
    isEditDialogOpen,
    isDeleteDialogOpen,
    selectedProvider,
    formData,
    saving,
    filteredProviders,
    setSearchTerm,
    setStatusFilter,
    setIsAddDialogOpen,
    setIsEditDialogOpen,
    setIsDeleteDialogOpen,
    setSelectedProvider,
    setFormData,
    fetchProviders,
    resetForm,
    handleEdit,
    handleDelete,
    handleSubmit,
  } = useAdminIntegrationManagement();

  useEffect(() => {
    fetchProviders();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
          <span className="text-muted-foreground">Loading OAuth providers...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search integrations..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10 bg-input border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 bg-input border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <Button
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => {
            resetForm();
            setIsAddDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add OAuth Provider
        </Button>
      </div>

      <ProvidersListCard
        providers={filteredProviders}
        onEdit={handleEdit}
        onDelete={(provider) => {
          setSelectedProvider(provider);
          setIsDeleteDialogOpen(true);
        }}
      />

      <ProviderFormDialog
        open={isAddDialogOpen}
        title="Add New OAuth Provider"
        description="Create a new OAuth provider configuration for user authentication."
        submitLabel="Create OAuth Provider"
        saving={saving}
        formData={formData}
        onOpenChange={setIsAddDialogOpen}
        onFormDataChange={(updater) => setFormData((prev) => updater(prev))}
        onSubmit={async (event) => {
          event.preventDefault();
          await handleSubmit();
        }}
      />

      <ProviderFormDialog
        open={isEditDialogOpen}
        title="Edit OAuth Provider"
        description="Update the OAuth provider configuration."
        submitLabel="Update OAuth Provider"
        saving={saving}
        formData={formData}
        onOpenChange={setIsEditDialogOpen}
        onFormDataChange={(updater) => setFormData((prev) => updater(prev))}
        onSubmit={async (event) => {
          event.preventDefault();
          await handleSubmit();
        }}
      />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete OAuth Provider</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedProvider?.display_name}"? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
