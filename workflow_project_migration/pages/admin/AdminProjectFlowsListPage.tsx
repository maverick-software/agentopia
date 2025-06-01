import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  PlusCircle, 
  Edit, 
  Trash2, 
  Copy, 
  Power, 
  PowerOff, 
  Clock, 
  Users, 
  CheckCircle,
  XCircle,
  Workflow 
} from 'lucide-react';
import { useUnifiedWorkflow } from '@/hooks/useUnifiedWorkflow';
import { toast } from 'sonner';

const AdminProjectFlowsListPage: React.FC = () => {
  const {
    templates: flows, // Rename for clarity
    loading,
    error,
    deleteTemplate: deleteFlow,
    refetch,
    isUsingUnifiedService,
    migrationMode
  } = useUnifiedWorkflow({ 
    autoFetch: true,
    filters: { 
      template_type: 'flow_based',
      is_active: true // Only show active flows (exclude soft-deleted ones)
    }
  });

  const handleDeleteFlow = async (flowId: string, flowName: string) => {
    if (window.confirm(
      `Are you sure you want to delete the flow "${flowName}"? This action cannot be undone and will delete all associated steps, elements, and user instances.`
    )) {
      try {
        // Get current user for deletion tracking
        const user = await import('@/lib/supabase').then(({ supabase }) => supabase.auth.getUser());
        const userId = user.data.user?.id;
        
        if (!userId) {
          toast.error('User not authenticated');
          return;
        }

        await deleteFlow(flowId, userId);
        toast.success(`Flow "${flowName}" deleted successfully.`);
      } catch (err: any) {
        console.error("Error deleting project flow:", err);
        toast.error(`Failed to delete flow "${flowName}": ${err.message}`);
      }
    }
  };

  const handleToggleStatus = async (flowId: string, currentStatus: boolean, flowName: string) => {
    try {
      // Note: This functionality will need to be implemented in the unified service
      // For now, show a message that this feature is being migrated
      toast.info(`Status toggle for "${flowName}" is being migrated to the unified workflow system.`);
    } catch (err: any) {
      console.error("Error toggling flow status:", err);
      toast.error(`Failed to ${!currentStatus ? 'activate' : 'deactivate'} flow "${flowName}": ${err.message}`);
    }
  };

  const handleDuplicateFlow = async (flowId: string, flowName: string) => {
    const newName = prompt(`Enter a name for the duplicated flow:`, `${flowName} (Copy)`);
    if (newName && newName.trim()) {
      try {
        // Note: This functionality will need to be implemented in the unified service
        // For now, show a message that this feature is being migrated
        toast.info(`Flow duplication for "${flowName}" is being migrated to the unified workflow system.`);
      } catch (err: any) {
        console.error("Error duplicating project flow:", err);
        toast.error(`Failed to duplicate flow: ${err.message}`);
      }
    }
  };

  const formatDuration = (minutes: number | null): string => {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  const StatusBadge = ({ isActive }: { isActive: boolean }) => (
    <Badge variant={isActive ? "default" : "secondary"} className="gap-1">
      {isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );

  if (loading && flows.length === 0) {
    return <div className="p-4">Loading project flows...</div>;
  }

  if (error && flows.length === 0) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Workflow className="h-6 w-6 text-primary" />
            Project Flows
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage project creation workflows and flow steps
          </p>
          {/* Show migration mode for debugging */}
          <p className="text-xs text-muted-foreground">
            Mode: {migrationMode} {isUsingUnifiedService ? '(Unified Service)' : '(Compatibility Layer)'}
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/project-flows/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Flow
          </Link>
        </Button>
      </div>

      {/* Display error message if fetch failed but some data might still be shown */}
      {error && flows.length > 0 && (
        <p className="text-red-500 mb-4">Error refreshing flows: {error}. Displaying last known data.</p>
      )}

      {flows.length === 0 && !loading ? (
        <div className="text-center py-12">
          <Workflow className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Project Flows Found</h3>
          <p className="text-muted-foreground mb-4">
            Get started by creating your first project flow to guide users through project creation.
          </p>
          <Button asChild>
            <Link to="/admin/project-flows/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Flow
            </Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flows.map((flow) => (
                <TableRow key={flow.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: flow.color || '#3B82F6' }}
                      />
                      <span>{flow.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge isActive={flow.is_active || true} />
                  </TableCell>
                  <TableCell className="max-w-sm truncate" title={flow.description || ''}>
                    {flow.description || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {formatDuration(flow.estimated_duration_minutes || null)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm">
                        {flow.unified_workflow_stages?.reduce((total, stage) => 
                          total + (stage.unified_workflow_tasks?.reduce((taskTotal, task) => 
                            taskTotal + (task.unified_workflow_steps?.length || 0), 0) || 0), 0) || 0}
                      </span>
                      <span className="text-xs text-muted-foreground">steps</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono text-sm">-</span>
                      <span className="text-xs text-muted-foreground">(migrating)</span>
                    </div>
                  </TableCell>
                  <TableCell>{new Date(flow.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/admin/project-flows/${flow.id}/edit`} title="Edit Flow">
                        <Edit className="h-3 w-3" />
                      </Link>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleToggleStatus(flow.id, flow.is_active || true, flow.name)}
                      title={`${flow.is_active ? 'Deactivate' : 'Activate'} Flow`}
                    >
                      {flow.is_active ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDuplicateFlow(flow.id, flow.name)}
                      title="Duplicate Flow"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleDeleteFlow(flow.id, flow.name)} 
                      title="Delete Flow"
                      disabled={loading}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {loading && <p className="mt-4">Refreshing flows...</p>} 
    </div>
  );
};

export default AdminProjectFlowsListPage; 