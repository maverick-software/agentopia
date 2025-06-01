import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { useUnifiedWorkflow } from '@/hooks/useUnifiedWorkflow';
import { toast } from 'sonner';
import { LoadingStateManager } from '@/components/workflow/loading';

const AdminProjectTemplatesListPage: React.FC = () => {
  const {
    templates,
    loading,
    error,
    deleteTemplate,
    refetch,
    isUsingUnifiedService,
    migrationMode
  } = useUnifiedWorkflow({ 
    autoFetch: true,
    filters: { 
      template_type: 'standard',
      is_active: true // Only show active templates (exclude soft-deleted ones)
    }
  });

  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    if (window.confirm(`Are you sure you want to delete the template "${templateName}"? This action cannot be undone and will delete all associated stages and tasks.`)) {
      try {
        // Get current user for deletion tracking
        const user = await import('@/lib/supabase').then(({ supabase }) => supabase.auth.getUser());
        const userId = user.data.user?.id;
        
        if (!userId) {
          toast.error('User not authenticated');
          return;
        }

        await deleteTemplate(templateId, userId);
        toast.success(`Template "${templateName}" deleted successfully.`);
      } catch (err: any) {
        console.error("Error deleting project template:", err);
        toast.error(`Failed to delete template "${templateName}": ${err.message}`);
      }
    }
  };

  // Main content to render when data is available
  const renderContent = () => (
    <div className="p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Project Templates</h1>
          {/* Show migration mode for debugging */}
          <p className="text-sm text-muted-foreground">
            Mode: {migrationMode} {isUsingUnifiedService ? '(Unified Service)' : '(Compatibility Layer)'}
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/project-templates/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Template
          </Link>
        </Button>
      </div>

      {/* Display error message if fetch failed but some data might still be shown */}
      {error && templates.length > 0 && (
          <p className="text-red-500 mb-4">Error refreshing templates: {error}. Displaying last known data.</p>
      )}

      {templates.length === 0 && !loading ? (
        <p>No project templates found. Get started by creating one!</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell className="max-w-sm truncate" title={template.description || ''}>
                    {template.description || '-'}
                  </TableCell>
                  <TableCell>
                    <span className="capitalize">{template.template_type}</span>
                  </TableCell>
                  <TableCell>{new Date(template.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/admin/project-templates/${template.id}/edit`} title="Edit Template">
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Link>
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleDeleteTemplate(template.id, template.name)} 
                      title="Delete Template"
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );

  return (
    <LoadingStateManager
      loading={loading}
      error={error}
      hasData={templates.length > 0}
      skeletonRows={6}
    >
      {renderContent()}
    </LoadingStateManager>
  );
};

export default AdminProjectTemplatesListPage; 