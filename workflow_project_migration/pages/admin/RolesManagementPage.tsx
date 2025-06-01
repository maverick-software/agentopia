import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RequireGlobalRole } from '../../components/auth/RequireRole';
import type { Database } from '../../types/supabase';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Plus, 
  PencilIcon, 
  Trash2, 
  AlertTriangle, 
  Shield, 
  CheckSquare,
  Info,
  BadgeInfo,
  RefreshCw,
  GripVertical
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from "@/components/ui/checkbox";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Helper function to normalize role names for permission strings
const normalizeRoleNameForPermission = (roleName: string): string => {
  return roleName
    .toLowerCase()
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[^a-z0-9_]/g, ''); // Remove any non-alphanumeric characters except underscore
};

// Helper function to get display name for role_type
const getRoleTypeDisplay = (roleType: 'GLOBAL' | 'CLIENT_CONTEXTUAL' | '' | undefined): string => {
  if (!roleType) return 'N/A';
  switch (roleType) {
    case 'GLOBAL':
      return 'Global';
    case 'CLIENT_CONTEXTUAL':
      return 'Client';
    default:
      return roleType; // Fallback, though should not happen with defined types
  }
};

// NEW PERMISSIONS STRUCTURE
const APP_PERMISSIONS = [
  {
    groupName: 'Platform Administration',
    description: 'Permissions related to overall platform management and administration.',
    categories: [
      {
        categoryName: 'Administrative Page Access',
        permissions: [
          { id: 'platform.admin.pages.view.user_management', label: 'View User Management Page (Admin)' },
          { id: 'platform.admin.pages.view.role_management', label: 'View Role Management Page (Admin)' },
          { id: 'platform.admin.pages.view.client_management', label: 'View Client Accounts Page (Admin)' },
          // Consider adding: { id: 'platform.admin.pages.view.system_logs', label: 'View System Logs Page' },
          // Consider adding: { id: 'platform.admin.pages.view.site_settings', label: 'View Site Settings Page' },
        ]
      },
      {
        categoryName: 'Administrative Functions',
        permissions: [
          { id: 'platform.admin.users.manage', label: 'Manage All Platform Users (Create/Edit/Delete)' },
          { id: 'platform.admin.roles.manage_definitions', label: 'Manage All Role Definitions (Global & Client Templates)' },
          { id: 'platform.admin.clients.manage_accounts', label: 'Manage All Client Accounts (Create/Edit/Delete)' },
          { id: 'platform.admin.system.impersonate_clients', label: 'Impersonate Client Users/Admins' },
          // Consider adding: { id: 'platform.admin.system.manage_settings', label: 'Modify Global Site Settings' },
        ]
      }
    ]
  },
  {
    groupName: 'Client Account Context (Permissions within a specific Client Account)',
    description: 'These permissions apply when a user is operating within the context of a specific client account. Relevant for both Client-Specific roles and Global roles overseeing clients.',
    categories: [
      {
        categoryName: 'Client Dashboard Page Access',
        permissions: [
          { id: 'client.context.pages.view.dashboard', label: 'View Client Dashboard Overview' },
          { id: 'client.context.pages.view.users', label: "View Users Page within Assigned Client Account(s)" },
          { id: 'client.context.pages.view.projects', label: "View Projects Page within Assigned Client Account(s)" },
          { id: 'client.context.pages.view.content', label: "View Content Page within Assigned Client Account(s)" },
          { id: 'client.context.pages.view.settings', label: "View Settings Page within Assigned Client Account(s)" },
        ]
      },
      {
        categoryName: 'Client User Management Functions',
        permissions: [
          { id: 'client.context.users.invite', label: "Invite Users to Assigned Client Account(s)" },
          { id: 'client.context.users.manage_members', label: "Manage Members within Assigned Client Account(s) (Edit/Remove)" },
          { id: 'client.context.users.assign_roles', label: "Assign Roles to Members within Assigned Client Account(s)" },
        ]
      },
      {
        categoryName: 'Client Project Management Functions',
        permissions: [
          { id: 'client.context.projects.create', label: "Create Projects within Assigned Client Account(s)" },
          { id: 'client.context.projects.edit', label: "Edit Projects within Assigned Client Account(s)" },
          { id: 'client.context.projects.delete', label: "Delete Projects within Assigned Client Account(s)" },
          { id: 'client.context.projects.manage_all', label: "Manage All Aspects of Projects within Assigned Client Account(s)" },
        ]
      },
      {
        categoryName: 'Client Content Management Functions',
        permissions: [
          { id: 'client.context.content.create', label: "Create Content within Assigned Client Account(s)" },
          { id: 'client.context.content.edit', label: "Edit Content within Assigned Client Account(s)" },
          { id: 'client.context.content.delete', label: "Delete Content within Assigned Client Account(s)" },
          { id: 'client.context.content.publish', label: "Publish Content within Assigned Client Account(s)" },
          { id: 'client.context.content.manage_all', label: "Manage All Aspects of Content within Assigned Client Account(s)" },
        ]
      },
      {
        categoryName: 'Client Settings Functions',
        permissions: [
          { id: 'client.context.settings.manage', label: "Manage Settings within Assigned Client Account(s)" },
        ]
      }
    ]
  }
];

// Define types for role management
interface RoleDefinition { 
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  permissions: string[];
  role_type: 'GLOBAL' | 'CLIENT_CONTEXTUAL';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface Client {
  id: string;
  name: string;
}

interface RoleForm {
  name: string;
  display_name: string;
  description: string;
  permissions: string[];
  role_type: 'GLOBAL' | 'CLIENT_CONTEXTUAL' | undefined;
}

// Sortable Table Row Component
interface SortableTableRowProps {
  role: RoleDefinition;
  onEdit: (role: RoleDefinition) => void;
  onDelete: (role: RoleDefinition) => void;
}

const SortableTableRow: React.FC<SortableTableRowProps> = ({ role, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: role.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
  };

  const isGlobal = role.role_type === 'GLOBAL';

  return (
    <TableRow 
      ref={setNodeRef} 
      style={style} 
      className={isDragging ? 'bg-muted/50' : ''}
    >
      <TableCell className="w-8">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted/50 rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {isGlobal ? (
            <Shield className="h-4 w-4 text-blue-600" />
          ) : (
            <BadgeInfo className="h-4 w-4 text-green-600" />
          )}
          {role.display_name}
        </div>
      </TableCell>
      <TableCell>{role.description || 'No description'}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1.5 max-w-xs">
          {role.permissions && role.permissions.length > 0 ? (
            <span className="text-xs font-medium px-2 py-1 bg-muted rounded">
              {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">No permissions</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onEdit(role)}>
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => onDelete(role)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export const RolesManagementPage: React.FC = () => {
  const { user: adminUser, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loadingRoles, setLoadingRoles] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for managing roles
  const [isAddPlatformDialogOpen, setIsAddPlatformDialogOpen] = useState(false);
  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [deletingRole, setDeletingRole] = useState<RoleDefinition | null>(null);
  const [roleFormKey, setRoleFormKey] = useState(0); // New state for re-mounting the form
  
  // Form states for add/edit
  const [roleForm, setRoleForm] = useState<RoleForm>({
    name: '',
    display_name: '',
    description: '',
    permissions: [],
    role_type: undefined,
  });

  // Loading state for form submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchRoles = async () => {
    setLoadingRoles(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('roles')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      
      if (data) {
        const transformedRoles: RoleDefinition[] = data.map(role => {
          const currentRole = role as any;
          
          return {
            id: currentRole.id,
            name: currentRole.name,
            display_name: currentRole.display_name,
            description: currentRole.description,
            permissions: Array.isArray(currentRole.permissions) 
              ? (currentRole.permissions as string[]) 
              : currentRole.permissions 
                ? (typeof currentRole.permissions === 'string' 
                  ? JSON.parse(currentRole.permissions) 
                  : [])
                : [],
            role_type: currentRole.role_type as 'GLOBAL' | 'CLIENT_CONTEXTUAL',
            sort_order: currentRole.sort_order || 999999,
            created_at: currentRole.created_at,
            updated_at: currentRole.updated_at
          }
        });
        setRoles(transformedRoles);
      } else {
        setRoles([]);
      }
    } catch (e: any) {
      console.error('Error fetching platform roles:', e);
      setError('Failed to load platform roles.');
      setRoles([]);
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => {
    if (adminUser?.globalRoleNames?.includes('SUPER_ADMIN') || adminUser?.globalRoleNames?.includes('DEVELOPER')) {
        fetchRoles();
    }
  }, [adminUser]);

  // Handle drag end for reordering
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const activeRole = roles.find(role => role.id === active.id);
    const overRole = roles.find(role => role.id === over.id);

    if (!activeRole || !overRole || activeRole.role_type !== overRole.role_type) {
      return;
    }

    const roleType = activeRole.role_type;
    const rolesByType = roles.filter(role => role.role_type === roleType);
    const otherRoles = roles.filter(role => role.role_type !== roleType);

    const oldIndex = rolesByType.findIndex(role => role.id === active.id);
    const newIndex = rolesByType.findIndex(role => role.id === over.id);

    const reorderedRoles = arrayMove(rolesByType, oldIndex, newIndex);
    
    // Update sort_order for the reordered roles
    const updatedRoles = reorderedRoles.map((role, index) => ({
      ...role,
      sort_order: index + 1
    }));

    // Combine with other role type
    const allRoles = [...otherRoles, ...updatedRoles].sort((a, b) => {
      if (a.role_type !== b.role_type) {
        return a.role_type === 'GLOBAL' ? -1 : 1;
      }
      return a.sort_order - b.sort_order;
    });

    setRoles(allRoles);

    // Update database
    try {
      const updates = updatedRoles.map(role => ({
        id: role.id,
        sort_order: role.sort_order
      }));

      for (const update of updates) {
        await supabase
          .from('roles')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }
    } catch (error) {
      console.error('Error updating sort order:', error);
      toast.error('Failed to save new order');
      // Revert on error
      fetchRoles();
    }
  };

  // Handle add role
  const handleAddRole = async () => {
    setIsSubmitting(true);
    try {
      // Validate form
      if (!roleForm.name || !roleForm.display_name) {
        throw new Error('Please fill in the required fields');
      }
      
      // Create the role in Supabase
      const { data, error: addError } = await supabase
        .from('roles')
        .insert({
          name: roleForm.name,
          display_name: roleForm.display_name,
          description: roleForm.description || null,
          permissions: roleForm.permissions,
          role_type: roleForm.role_type as 'GLOBAL' | 'CLIENT_CONTEXTUAL',
        })
        .select()
        .single();
        
      if (addError) throw addError;
      
      toast.success('Role created successfully');
      setIsAddPlatformDialogOpen(false);
      setIsAddClientDialogOpen(false);
      
      // Reset form
      setRoleForm({
        name: '',
        display_name: '',
        description: '',
        permissions: [],
        role_type: undefined,
      });
      
      // Refresh the roles list
      fetchRoles();
    } catch (e: any) {
      console.error('Error creating role:', e);
      toast.error(`Failed to create role: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit role
  const handleEditRole = async () => {
    if (!editingRole) return;
    
    setIsSubmitting(true);
    try {
      // Update the role in Supabase
      const { error: updateError } = await supabase
        .from('roles')
        .update({
          display_name: roleForm.display_name,
          description: roleForm.description || null,
          permissions: roleForm.permissions,
          role_type: roleForm.role_type as 'GLOBAL' | 'CLIENT_CONTEXTUAL',
          updated_at: new Date().toISOString()
        })
        .eq('id', editingRole.id);

      if (updateError) throw updateError;
      
      toast.success('Role updated successfully');
      setIsEditDialogOpen(false);
      fetchRoles();
    } catch (e: any) {
      console.error('Error updating role:', e);
      toast.error(`Failed to update role: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete role
  const handleDeleteRole = async () => {
    if (!deletingRole) return;
    
    setIsSubmitting(true);
    try {
      // Delete the role
      const { error: deleteError } = await supabase
        .from('roles')
        .delete()
        .eq('id', deletingRole.id);

      if (deleteError) throw deleteError;
      
      toast.success('Role deleted successfully');
      setIsDeleteDialogOpen(false);
      fetchRoles();
    } catch (e: any) {
      console.error('Error deleting role:', e);
      toast.error(`Failed to delete role: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler for checkboxes in permissions
  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    if (checked) {
      setRoleForm(prev => ({
        ...prev,
        permissions: [...prev.permissions, permissionId]
      }));
    } else {
      setRoleForm(prev => ({
        ...prev,
        permissions: prev.permissions.filter(id => id !== permissionId)
      }));
    }
  };

  // Open Add Dialog
  const openAddPlatformDialog = () => {
    setRoleForm({
      name: '',
      display_name: '',
      description: '',
      permissions: [], // Start with no permissions
      role_type: 'GLOBAL', // Preset to GLOBAL for platform roles
    });
    setRoleFormKey(prevKey => prevKey + 1); // Increment key to force re-mount
    setIsAddPlatformDialogOpen(true);
  };

  const openAddClientDialog = () => {
    setRoleForm({
      name: '',
      display_name: '',
      description: '',
      permissions: [], // Start with no permissions
      role_type: 'CLIENT_CONTEXTUAL', // Preset to CLIENT_CONTEXTUAL for client roles
    });
    setRoleFormKey(prevKey => prevKey + 1); // Increment key to force re-mount
    setIsAddClientDialogOpen(true);
  };

  // Open edit role dialog
  const openEditDialog = (role: RoleDefinition) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      display_name: role.display_name,
      description: role.description || '',
      permissions: Array.isArray(role.permissions) ? role.permissions : [], 
      role_type: role.role_type,
    });
    setIsEditDialogOpen(true);
  };

  // Open delete role dialog
  const openDeleteDialog = (role: RoleDefinition) => {
    setDeletingRole(role);
    setIsDeleteDialogOpen(true);
  };

  if (authLoading) {
    return null; // Or a loading spinner component
  }

  if (!adminUser || !adminUser.globalRoleNames || !adminUser.globalRoleNames.some(role => ['SUPER_ADMIN', 'DEVELOPER'].includes(role))) {
    return <div className="p-8 text-center">Access Denied: You do not have permission to view this page.</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-8 bg-background text-foreground min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Role Management</h1>
          <p className="text-muted-foreground">Create and manage platform-level and client-specific roles and permissions.</p>
        </div>
      </div>
      
      <div className="space-y-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {loadingRoles ? (
          <div className="py-10 text-center text-muted-foreground">
            Loading roles...
          </div>
        ) : roles.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            No roles found.
          </div>
        ) : (
          <div className="space-y-8">
            {/* Platform Roles Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-foreground">Platform Roles</h3>
                  <span className="text-sm text-muted-foreground">
                    ({roles.filter(role => role.role_type === 'GLOBAL').length} role{roles.filter(role => role.role_type === 'GLOBAL').length !== 1 ? 's' : ''})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={openAddPlatformDialog} 
                    disabled={!adminUser}
                    className="h-9 w-9"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchRoles} 
                    disabled={loadingRoles}
                    className="h-9 w-9"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingRoles ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                System-wide administrative roles with platform-level permissions. These roles manage overall application functionality and user access.
              </p>
              {roles.filter(role => role.role_type === 'GLOBAL').length === 0 ? (
                <div className="py-6 text-center text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No platform roles found.</p>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-blue-50 dark:bg-blue-900/20">
                          <TableHead className="w-8"></TableHead>
                          <TableHead className="w-64">Role Name</TableHead>
                          <TableHead className="w-80">Description</TableHead>
                          <TableHead className="w-32">Permissions</TableHead>
                          <TableHead className="w-28 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <SortableContext
                          items={roles.filter(role => role.role_type === 'GLOBAL').map(role => role.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {roles
                            .filter(role => role.role_type === 'GLOBAL')
                            .map((role) => (
                              <SortableTableRow key={role.id} role={role} onEdit={openEditDialog} onDelete={openDeleteDialog} />
                            ))}
                        </SortableContext>
                      </TableBody>
                    </Table>
                  </DndContext>
                </div>
              )}
            </div>

            {/* Client Roles Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BadgeInfo className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold text-foreground">Client Roles</h3>
                  <span className="text-sm text-muted-foreground">
                    ({roles.filter(role => role.role_type === 'CLIENT_CONTEXTUAL').length} role{roles.filter(role => role.role_type === 'CLIENT_CONTEXTUAL').length !== 1 ? 's' : ''})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={openAddClientDialog} 
                    disabled={!adminUser}
                    className="h-9 w-9"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchRoles} 
                    disabled={loadingRoles}
                    className="h-9 w-9"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingRoles ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Role templates designed for client team members. These roles are assigned to users within specific client account contexts.
              </p>
              {roles.filter(role => role.role_type === 'CLIENT_CONTEXTUAL').length === 0 ? (
                <div className="py-6 text-center text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">
                  <BadgeInfo className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No client roles found.</p>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-green-50 dark:bg-green-900/20">
                          <TableHead className="w-8"></TableHead>
                          <TableHead className="w-64">Role Name</TableHead>
                          <TableHead className="w-80">Description</TableHead>
                          <TableHead className="w-32">Permissions</TableHead>
                          <TableHead className="w-28 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <SortableContext
                          items={roles.filter(role => role.role_type === 'CLIENT_CONTEXTUAL').map(role => role.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {roles
                            .filter(role => role.role_type === 'CLIENT_CONTEXTUAL')
                            .map((role) => (
                              <SortableTableRow key={role.id} role={role} onEdit={openEditDialog} onDelete={openDeleteDialog} />
                            ))}
                        </SortableContext>
                      </TableBody>
                    </Table>
                  </DndContext>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-sm text-muted-foreground text-center pt-4 border-t">
          {roles.length} role{roles.length !== 1 ? 's' : ''} in total 
          ({roles.filter(role => role.role_type === 'GLOBAL').length} platform, {roles.filter(role => role.role_type === 'CLIENT_CONTEXTUAL').length} client)
        </div>
      </div>

      {/* Add Platform Role Dialog */}
      <Dialog open={isAddPlatformDialogOpen} onOpenChange={setIsAddPlatformDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl">Add New Platform Role</DialogTitle>
            <DialogDescription>
              Define the details and permissions for a new platform role with system-wide administrative access. The slug will be automatically generated from the role name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3 sm:gap-4">
              <Label htmlFor="platform-display-name" className="sm:text-right font-medium">
                Role Name
              </Label>
              <Input
                id="platform-display-name"
                value={roleForm.display_name}
                onChange={(e) => {
                  const displayName = e.target.value;
                  setRoleForm({
                    ...roleForm, 
                    display_name: displayName,
                    name: normalizeRoleNameForPermission(displayName)
                  });
                }}
                placeholder="e.g., Site Administrator"
                className="col-span-1 sm:col-span-3"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-3 sm:gap-4">
              <Label htmlFor="platform-description" className="sm:text-right font-medium pt-1 sm:pt-2">
                Description
              </Label>
              <Textarea
                id="platform-description"
                value={roleForm.description}
                onChange={(e) => setRoleForm({...roleForm, description: e.target.value})}
                placeholder="Brief description of this platform role's responsibilities"
                className="col-span-1 sm:col-span-3 h-24"
              />
            </div>
            
            <div className="col-span-1 sm:col-span-4 mt-4 pt-6 border-t">
              <h3 className="text-xl font-semibold mb-4 text-foreground">Platform Administration Permissions</h3>
              <div className="space-y-8">
                {APP_PERMISSIONS
                  .filter(group => group.groupName === 'Platform Administration')
                  .map((group) => (
                  <Card key={group.groupName}>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg">{group.groupName}</CardTitle>
                      {group.description && 
                        <CardDescription className="pt-1 text-sm">{group.description}</CardDescription>}
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {group.categories.map((category) => (
                        <div key={category.categoryName} className="pt-3">
                          <h5 className="text-md font-medium mb-3 pb-2 border-b">{category.categoryName}</h5>
                          <div className="space-y-3">
                            {category.permissions.map((permission) => (
                              <div key={permission.id} className="flex items-start space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                                <Checkbox 
                                  id={`platform-add-${permission.id}`}
                                  checked={roleForm.permissions.includes(permission.id)} 
                                  onCheckedChange={(checked) => handlePermissionChange(permission.id, !!checked)}
                                  className="mt-0.5 shrink-0 border-neutral-600 data-[state=checked]:bg-neutral-800 data-[state=checked]:text-neutral-100 focus-visible:ring-1 focus-visible:ring-neutral-500 focus-visible:ring-offset-0"
                                />
                                <label
                                  htmlFor={`platform-add-${permission.id}`}
                                  className="text-sm font-normal leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-grow"
                                >
                                  {permission.label}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-8">
            <Button variant="outline" onClick={() => setIsAddPlatformDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddRole} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Platform Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Client Role Dialog */}
      <Dialog open={isAddClientDialogOpen} onOpenChange={setIsAddClientDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl">Add New Client Role</DialogTitle>
            <DialogDescription>
              Define the details and permissions for a new client role template for team members within specific client accounts. The slug will be automatically generated from the role name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3 sm:gap-4">
              <Label htmlFor="client-display-name" className="sm:text-right font-medium">
                Role Name
              </Label>
              <Input
                id="client-display-name"
                value={roleForm.display_name}
                onChange={(e) => {
                  const displayName = e.target.value;
                  setRoleForm({
                    ...roleForm, 
                    display_name: displayName,
                    name: normalizeRoleNameForPermission(displayName)
                  });
                }}
                placeholder="e.g., Content Editor"
                className="col-span-1 sm:col-span-3"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-3 sm:gap-4">
              <Label htmlFor="client-description" className="sm:text-right font-medium pt-1 sm:pt-2">
                Description
              </Label>
              <Textarea
                id="client-description"
                value={roleForm.description}
                onChange={(e) => setRoleForm({...roleForm, description: e.target.value})}
                placeholder="Brief description of this client role's responsibilities"
                className="col-span-1 sm:col-span-3 h-24"
              />
            </div>
            
            <div className="col-span-1 sm:col-span-4 mt-4 pt-6 border-t">
              <h3 className="text-xl font-semibold mb-4 text-foreground">Client Account Permissions</h3>
              <div className="space-y-8">
                {APP_PERMISSIONS
                  .filter(group => group.groupName === 'Client Account Context (Permissions within a specific Client Account)')
                  .map((group) => (
                  <Card key={group.groupName}>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg">Client Account Context</CardTitle>
                      {group.description && 
                        <CardDescription className="pt-1 text-sm">{group.description}</CardDescription>}
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {group.categories.map((category) => (
                        <div key={category.categoryName} className="pt-3">
                          <h5 className="text-md font-medium mb-3 pb-2 border-b">{category.categoryName}</h5>
                          <div className="space-y-3">
                            {category.permissions.map((permission) => (
                              <div key={permission.id} className="flex items-start space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                                <Checkbox 
                                  id={`client-add-${permission.id}`}
                                  checked={roleForm.permissions.includes(permission.id)} 
                                  onCheckedChange={(checked) => handlePermissionChange(permission.id, !!checked)}
                                  className="mt-0.5 shrink-0 border-neutral-600 data-[state=checked]:bg-neutral-800 data-[state=checked]:text-neutral-100 focus-visible:ring-1 focus-visible:ring-neutral-500 focus-visible:ring-offset-0"
                                />
                                <label
                                  htmlFor={`client-add-${permission.id}`}
                                  className="text-sm font-normal leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-grow"
                                >
                                  {permission.label}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-8">
            <Button variant="outline" onClick={() => setIsAddClientDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddRole} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Client Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => {
        setIsEditDialogOpen(isOpen);
        if (!isOpen) {
          setEditingRole(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl">Edit Role</DialogTitle>
            <DialogDescription>
              Update the role's name, description, type, and permissions. The slug is automatically generated from the role name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3 sm:gap-4">
              <Label htmlFor="edit-role-type" className="sm:text-right font-medium">Role Type</Label>
              <div className="col-span-1 sm:col-span-3">
                <Select
                  value={roleForm.role_type}
                  onValueChange={(value: 'GLOBAL' | 'CLIENT_CONTEXTUAL') => {
                    setRoleForm(prev => {
                      let filteredPermissions = prev.permissions;
                      if (value === 'GLOBAL') {
                        filteredPermissions = prev.permissions.filter(p => p.startsWith('platform.admin.'));
                      } else if (value === 'CLIENT_CONTEXTUAL') {
                        filteredPermissions = prev.permissions.filter(p => p.startsWith('client.context.'));
                      }
                      return {
                        ...prev,
                        role_type: value,
                        permissions: filteredPermissions
                      };
                    });
                  }}
                >
                  <SelectTrigger id="edit-role-type">
                    <SelectValue placeholder="Select role type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GLOBAL">{getRoleTypeDisplay('GLOBAL')}</SelectItem>
                    <SelectItem value="CLIENT_CONTEXTUAL">{getRoleTypeDisplay('CLIENT_CONTEXTUAL')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3 sm:gap-4">
              <Label htmlFor="edit-display-name" className="sm:text-right font-medium">
                Role Name
              </Label>
              <Input
                id="edit-display-name"
                value={roleForm.display_name}
                onChange={(e) => {
                  const displayName = e.target.value;
                  setRoleForm({
                    ...roleForm, 
                    display_name: displayName,
                    name: normalizeRoleNameForPermission(displayName)
                  });
                }}
                className="col-span-1 sm:col-span-3"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3 sm:gap-4">
              <Label className="sm:text-right font-medium text-muted-foreground">
                Slug (Auto-generated)
              </Label>
              <div className="col-span-1 sm:col-span-3 px-3 py-2 bg-muted/30 border border-muted rounded-md text-sm text-muted-foreground font-mono">
                {roleForm.name || 'will-be-generated'}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-3 sm:gap-4">
              <Label htmlFor="edit-description" className="sm:text-right font-medium pt-1 sm:pt-2">
                Description
              </Label>
              <Textarea
                id="edit-description"
                value={roleForm.description}
                onChange={(e) => setRoleForm({...roleForm, description: e.target.value})}
                className="col-span-1 sm:col-span-3 h-24"
              />
            </div>
            
            <div className="col-span-1 sm:col-span-4 mt-4 pt-6 border-t">
              <h3 className="text-xl font-semibold mb-4 text-foreground">Permissions</h3>
              {roleForm.role_type ? (
                <div className="space-y-8">
                  {APP_PERMISSIONS
                    .filter(group =>
                      (roleForm.role_type === 'GLOBAL' && group.groupName === 'Platform Administration') ||
                      (roleForm.role_type === 'CLIENT_CONTEXTUAL' && group.groupName === 'Client Account Context (Permissions within a specific Client Account)')
                    )
                    .map((group, groupIndex) => (
                    <Card key={group.groupName} className={`${groupIndex > 0 ? 'mt-6' : ''}`}>
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg">{group.groupName}</CardTitle>
                        {group.description && 
                          <CardDescription className="pt-1 text-sm">{group.description}</CardDescription>}
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {group.categories.map((category) => (
                          <div key={category.categoryName} className="pt-3">
                            <h5 className="text-md font-medium mb-3 pb-2 border-b">{category.categoryName}</h5>
                            <div className="space-y-3">
                              {category.permissions.map((permission) => (
                                <div key={permission.id} className="flex items-start space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                                  <Checkbox 
                                    id={`edit-${permission.id}`}
                                    checked={roleForm.permissions.includes(permission.id)} 
                                    onCheckedChange={(checked) => handlePermissionChange(permission.id, !!checked)}
                                    className="mt-0.5 shrink-0 border-neutral-600 data-[state=checked]:bg-neutral-800 data-[state=checked]:text-neutral-100 focus-visible:ring-1 focus-visible:ring-neutral-500 focus-visible:ring-offset-0"
                                  />
                                  <label
                                    htmlFor={`edit-${permission.id}`}
                                    className="text-sm font-normal leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-grow"
                                  >
                                    {permission.label}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Please select a Role Type to see available permissions.</p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-8">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditRole} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this role? <br />
              <strong className="block mt-1">{deletingRole?.display_name} ({getRoleTypeDisplay(deletingRole?.role_type)})</strong>
              Any users assigned to this role will lose these permissions. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {deletingRole && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Confirm Deletion Details</AlertTitle>
                <AlertDescription>
                  <p><span className="font-semibold">Role:</span> {deletingRole.display_name}</p>
                  <p><span className="font-semibold">Type:</span> {getRoleTypeDisplay(deletingRole.role_type)}</p>
                  <p className="mt-2 text-xs"><span className="font-semibold">Description:</span> {deletingRole.description || 'No description'}</p>
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteRole} disabled={isSubmitting}>
              {isSubmitting ? 'Deleting...' : 'Delete Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}