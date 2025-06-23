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
  UserPlus, 
  PencilIcon, 
  Trash2, 
  AlertTriangle, 
  UserCog, 
  MailIcon, 
  BadgeInfo
} from 'lucide-react';

// Define structure for roles fetched from DB
interface RoleOption {
  id: string;
  name: string;
  display_name: string;
}

interface Profile {
  auth_user_id: string; 
  email: string | null;
  full_name: string | null;
  globalRoleNames?: string[];
}

interface NewUserForm {
  email: string;
  fullName: string;
  password: string;
  globalRoleName: string;
}

interface EditUserForm {
  fullName: string;
  globalRoleName: string;
}

// This component contains all the logic and JSX for user management.
const UserManagementPageContent = () => {
  const { user: adminUser, signUp } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [globalRolesList, setGlobalRolesList] = useState<RoleOption[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null);
  
  const [editForm, setEditForm] = useState<EditUserForm>({ fullName: '', globalRoleName: '' });
  const [newUserForm, setNewUserForm] = useState<NewUserForm>({
    email: '',
    fullName: '',
    password: '',
    globalRoleName: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchGlobalRoles = async () => {
      try {
        const { data, error } = await supabase
          .from('roles') 
          .select('id, name, display_name')
          .eq('role_type', 'GLOBAL');

        if (error) {
          console.error('Error fetching global roles:', error);
          toast.error('Failed to load global roles for selection.');
          setGlobalRolesList([]);
          return;
        }

        if (Array.isArray(data)) {
          const allGlobalRoles: RoleOption[] = data.map((item: any) => ({
            id: String(item?.id || ''),
            name: String(item?.name || ''),
            display_name: String(item?.display_name || ''),
          })).filter(role => role.id && role.name);

          const teamDropdownRoles = ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER', 'SUPPORT_REP', 'TEAM_MEMBER', 'SITE_MANAGER'];
          const filteredDropdownRoles = allGlobalRoles.filter(role => teamDropdownRoles.includes(role.name));

          setGlobalRolesList(filteredDropdownRoles);

          if (filteredDropdownRoles.length > 0) {
            const defaultRole = filteredDropdownRoles.find(r => r.name === 'TEAM_MEMBER') ||
                                filteredDropdownRoles.find(r => r.name === 'SUPPORT_REP') || 
                                filteredDropdownRoles[0];
            if (defaultRole) {
              setNewUserForm(prev => ({ ...prev, globalRoleName: defaultRole.name }));
            }
          } else {
             setNewUserForm(prev => ({ ...prev, globalRoleName: '' }));
          }
        } else {
          console.warn('Fetched global roles data is not an array:', data);
          setGlobalRolesList([]); 
        }
      } catch (e: any) { 
        console.error('Exception fetching global roles:', e);
        toast.error('Failed to load global roles for selection.');
        setGlobalRolesList([]);
      }
    };
    fetchGlobalRoles();
  }, []);

  const fetchProfiles = async () => {
    setLoadingProfiles(true);
    setError(null);
    try {
      const { data: profilesData, error: fetchProfilesError } = await supabase
        .from('profiles')
        .select('auth_user_id, full_name, email');

      if (fetchProfilesError) throw fetchProfilesError;
      if (!profilesData) {
        setProfiles([]);
        setLoadingProfiles(false);
        return;
      }

      const profilesWithRoles = await Promise.all(
        profilesData.map(async (profile) => {
          if (!profile.auth_user_id) {
            console.warn('Profile found with missing auth_user_id:', profile);
            return { ...profile, globalRoleNames: [] };
          }
          const { data: roleNamesData, error: roleNamesError } = await supabase
            .rpc('get_user_global_role_names', { p_user_id: profile.auth_user_id }) as { data: string[] | null; error: any };
          
          if (roleNamesError) {
            console.error('Error fetching global roles for user ' + profile.auth_user_id + ':', roleNamesError);
            return { ...profile, globalRoleNames: [] };
          }
          return { ...profile, globalRoleNames: roleNamesData || [] };
        })
      );
      
      const displayableTeamRoleNames = ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER', 'SUPPORT_REP', 'TEAM_MEMBER', 'SITE_MANAGER'];
      const teamMemberProfilesToDisplay = profilesWithRoles.filter(p =>
        p.globalRoleNames && p.globalRoleNames.some(roleName => displayableTeamRoleNames.includes(roleName))
      );

      setProfiles(teamMemberProfilesToDisplay as Profile[]);
    } catch (e: any) {
      console.error('Error fetching profiles:', e);
      setError('Failed to load user profiles.');
      setProfiles([]);
      toast.error('Failed to load user profiles');
    } finally {
      setLoadingProfiles(false);
    }
  };

  useEffect(() => {
    if (adminUser?.globalRoleNames?.includes('SUPER_ADMIN') || adminUser?.globalRoleNames?.includes('DEVELOPER')) {
      fetchProfiles();
    }
  }, [adminUser]);

  const handleAddUser = async () => {
    setIsSubmitting(true);
    try {
      if (!newUserForm.email || !newUserForm.password || !newUserForm.globalRoleName) {
        throw new Error('Please fill in all required fields');
      }
      
      const userDataPayload: { [key: string]: any } = {};
      if (newUserForm.fullName) {
        userDataPayload.full_name = newUserForm.fullName.trim();
      }

      const { user: newAuthUser, error: signUpError } = await signUp(
        newUserForm.email.trim(), 
        newUserForm.password, 
        newUserForm.globalRoleName,
        userDataPayload,
        { preventSessionOverride: true }
      );

      if (signUpError) {
        throw signUpError;
      }
      
      toast.success('User created successfully');
      setIsAddDialogOpen(false);
      setNewUserForm({
        email: '',
        fullName: '',
        password: '',
        globalRoleName: globalRolesList.find(r => r.name === 'TEAM_MEMBER')?.name || globalRolesList[0]?.name || ''
      });
      fetchProfiles();
    } catch (e: any) {
      console.error('Error creating user:', e);
      const errorMessage = e instanceof Error ? e.message : 'Failed to create user';
      toast.error('Failed to create user: ' + errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    setIsSubmitting(true);
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('update_user_global_role', { 
          p_user_id: editingUser.auth_user_id, 
          p_new_role_name: editForm.globalRoleName 
        });

      if (rpcError) throw rpcError;

      if (editingUser.full_name !== editForm.fullName) {
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({ full_name: editForm.fullName.trim() })
          .eq('auth_user_id', editingUser.auth_user_id);
        if (profileUpdateError) {
          console.error('Error updating profile full_name:', profileUpdateError);
          toast.error('Role updated, but failed to update full name: ' + profileUpdateError.message);
        } else {
          toast.success('User details and role updated successfully');
        }
      } else {
        toast.success('User role updated successfully');
      }
      
      setIsEditDialogOpen(false);
      fetchProfiles();
    } catch (e: any) {
      console.error('Error updating user:', e);
      toast.error('Failed to update user: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsSubmitting(true);
    try {
      if (deletingUser.auth_user_id === adminUser?.id) {
        toast.error("You cannot delete your own account.");
        setIsDeleteDialogOpen(false);
        return;
      }

      const { error } = await supabase.functions.invoke('admin-delete-user', {
        body: { user_id: deletingUser.auth_user_id },
      });

      if (error) throw error;
      
      toast.success('User deleted successfully');
      setIsDeleteDialogOpen(false);
      fetchProfiles();
    } catch (e: any) {
      console.error('Error deleting user:', e);
      toast.error('Failed to delete user: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (profile: Profile) => {
    setEditingUser(profile);
    setEditForm({
      fullName: profile.full_name || '',
      globalRoleName: profile.globalRoleNames?.[0] || ''
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (profile: Profile) => {
    setDeletingUser(profile);
    setIsDeleteDialogOpen(true);
  };
  
  // JSX for the page content (modals, table, etc.)
  return (
    <div className="p-4 md:p-8 space-y-8 bg-background text-foreground min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Management</h1>
          <p className="text-muted-foreground">Manage your team members and their roles.</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account. You'll need to provide an email, password, and role.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                  placeholder="user@example.com"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="fullName" className="text-right">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  value={newUserForm.fullName}
                  onChange={(e) => setNewUserForm({...newUserForm, fullName: e.target.value})}
                  placeholder="John Doe"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="password" className="text-right">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                  placeholder="••••••••"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">
                  Role
                </Label>
                <Select 
                  value={newUserForm.globalRoleName}
                  onValueChange={(value) => setNewUserForm({...newUserForm, globalRoleName: value})}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                          {globalRolesList.map(role => (
                        <SelectItem key={role.id} value={role.name}>{role.display_name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddUser} disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            View and manage all users in the system. You can edit their details or change their roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-destructive/15 p-4 rounded-md mb-4 flex items-center text-destructive">
              <AlertTriangle className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}
          
          {loadingProfiles ? (
            <div className="py-10 text-center text-muted-foreground">
              Loading users...
            </div>
          ) : profiles.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No users found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => {
                  const displayRoleNames = profile.globalRoleNames
                    ?.map(roleName => {
                      const roleDetail = globalRolesList.find(r => r.name === roleName);
                      return roleDetail ? roleDetail.display_name : roleName;
                    })
                    .join(', ');

                  return (
                    <TableRow key={profile.auth_user_id}>
                      <TableCell className="font-medium">
                        {profile.full_name || 'Unnamed User'}
                      </TableCell>
                      <TableCell>{profile.email || 'No email'}</TableCell>
                      <TableCell>
                        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                          {displayRoleNames || 'No roles'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => openEditDialog(profile)}
                            disabled={profile.auth_user_id === adminUser?.id}>
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => openDeleteDialog(profile)}
                            disabled={profile.auth_user_id === adminUser?.id}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Edit the user's details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fullName" className="text-right">
                Full Name
              </Label>
              <Input
                id="fullName"
                value={editForm.fullName}
                onChange={(e) => setEditForm({...editForm, fullName: e.target.value})}
                placeholder="John Doe"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <Select 
                value={editForm.globalRoleName}
                onValueChange={(value) => setEditForm({...editForm, globalRoleName: value})}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                        {globalRolesList.map(role => (
                      <SelectItem key={role.id} value={role.name}>{role.display_name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditUser} disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isSubmitting}>
              {isSubmitting ? 'Deleting...' : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// The UserManagementPage component now primarily handles role-based access control.
export const UserManagementPage = () => {
  return (
    <RequireGlobalRole allowedRoles={['SUPER_ADMIN', 'DEVELOPER']}>
      <UserManagementPageContent />
    </RequireGlobalRole>
  );
}; 