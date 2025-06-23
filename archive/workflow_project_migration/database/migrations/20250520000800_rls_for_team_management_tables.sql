-- Migration: Add RLS policies for team management tables
-- (team_members, client_defined_roles, team_member_assigned_roles)

-- Assumes RLS is already enabled on these tables from a previous migration.

-- RLS Policies for public.team_members

-- Client owners and authorized team members can invite (create) new team members.
-- The actual creation might be handled by an Edge Function which would also check permissions.
-- This RLS policy is a safeguard at the DB level.
CREATE POLICY "TeamMembers: Allow insert by authorized users" 
ON public.team_members
FOR INSERT
WITH CHECK (
    public.is_owner_of_client(auth.uid(), client_id) OR 
    public.user_has_client_permission(auth.uid(), client_id, 'client.team.invite')
);

-- Members of the same client, client owners, and Admins/Support can view team members.
CREATE POLICY "TeamMembers: Allow select for client members and admins" 
ON public.team_members
FOR SELECT
USING (
    (EXISTS (SELECT 1 FROM public.team_members tm_check WHERE tm_check.client_id = public.team_members.client_id AND tm_check.auth_user_id = auth.uid() AND tm_check.status = 'ACTIVE')) OR 
    public.is_owner_of_client(auth.uid(), public.team_members.client_id) OR
    public.is_super_admin(auth.uid()) OR 
    public.is_developer(auth.uid()) OR 
    public.is_support_rep(auth.uid())
);

-- Client owners and authorized team members can update team member status or details.
-- Admins/Support might also update status for support reasons (e.g., deactivating a user).
CREATE POLICY "TeamMembers: Allow update by authorized users and admins" 
ON public.team_members
FOR UPDATE
USING (
    public.is_owner_of_client(auth.uid(), client_id) OR 
    public.user_has_client_permission(auth.uid(), client_id, 'client.team.manage') OR
    ( (public.is_super_admin(auth.uid()) OR public.is_developer(auth.uid()) OR public.is_support_rep(auth.uid())) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid())) -- Ensure admin is valid
)
WITH CHECK (
    public.is_owner_of_client(auth.uid(), client_id) OR 
    public.user_has_client_permission(auth.uid(), client_id, 'client.team.manage') OR
    ( (public.is_super_admin(auth.uid()) OR public.is_developer(auth.uid()) OR public.is_support_rep(auth.uid())) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid()))
);

-- Client owners and authorized team members can remove team members.
-- Admins/Support might also remove for support/admin reasons.
CREATE POLICY "TeamMembers: Allow delete by authorized users and admins" 
ON public.team_members
FOR DELETE
USING (
    public.is_owner_of_client(auth.uid(), client_id) OR 
    public.user_has_client_permission(auth.uid(), client_id, 'client.team.remove') OR
    public.is_super_admin(auth.uid()) OR 
    public.is_developer(auth.uid()) OR 
    public.is_support_rep(auth.uid())
);

-- RLS Policies for public.client_defined_roles

-- Client owners or TMs with 'client.roles.manage' can create roles for their client.
CREATE POLICY "ClientRoles: Allow insert by authorized users" 
ON public.client_defined_roles
FOR INSERT
WITH CHECK (
    public.is_owner_of_client(auth.uid(), client_id) OR
    public.user_has_client_permission(auth.uid(), client_id, 'client.roles.create')
);

-- Client owners, TMs of that client, and Admins/Support can view roles defined for a client.
CREATE POLICY "ClientRoles: Allow select for client members and admins" 
ON public.client_defined_roles
FOR SELECT
USING (
    (EXISTS (SELECT 1 FROM public.team_members tm_check WHERE tm_check.client_id = public.client_defined_roles.client_id AND tm_check.auth_user_id = auth.uid() AND tm_check.status = 'ACTIVE')) OR
    public.is_owner_of_client(auth.uid(), public.client_defined_roles.client_id) OR
    public.is_super_admin(auth.uid()) OR 
    public.is_developer(auth.uid()) OR 
    public.is_support_rep(auth.uid())
);

-- Client owners or TMs with 'client.roles.manage' can update roles for their client.
CREATE POLICY "ClientRoles: Allow update by authorized users" 
ON public.client_defined_roles
FOR UPDATE
USING (
    public.is_owner_of_client(auth.uid(), client_id) OR
    public.user_has_client_permission(auth.uid(), client_id, 'client.roles.edit')
)
WITH CHECK (
    public.is_owner_of_client(auth.uid(), client_id) OR
    public.user_has_client_permission(auth.uid(), client_id, 'client.roles.edit')
);

-- Client owners or TMs with 'client.roles.manage' can delete roles for their client.
CREATE POLICY "ClientRoles: Allow delete by authorized users" 
ON public.client_defined_roles
FOR DELETE
USING (
    public.is_owner_of_client(auth.uid(), client_id) OR
    public.user_has_client_permission(auth.uid(), client_id, 'client.roles.delete')
);

-- RLS Policies for public.team_member_assigned_roles (Join Table)

-- Client owners or TMs with 'client.team.manage_roles' (or similar) can assign/unassign roles.
CREATE POLICY "AssignedRoles: Allow insert by authorized users" 
ON public.team_member_assigned_roles
FOR INSERT
WITH CHECK (
    public.is_owner_of_client(auth.uid(), client_id) OR
    public.user_has_client_permission(auth.uid(), client_id, 'client.team.assign_role')
);

-- Users who can view team members and roles of a client should be able to see the assignments.
-- This is often implicitly handled by queries joining these tables, but a direct SELECT policy is good.
CREATE POLICY "AssignedRoles: Allow select for client members and admins" 
ON public.team_member_assigned_roles
FOR SELECT
USING (
    (EXISTS (SELECT 1 FROM public.team_members tm_check WHERE tm_check.client_id = public.team_member_assigned_roles.client_id AND tm_check.auth_user_id = auth.uid() AND tm_check.status = 'ACTIVE')) OR
    public.is_owner_of_client(auth.uid(), public.team_member_assigned_roles.client_id) OR
    public.is_super_admin(auth.uid()) OR 
    public.is_developer(auth.uid()) OR 
    public.is_support_rep(auth.uid())
);

-- Client owners or TMs with 'client.team.manage_roles' can delete (unassign) roles.
CREATE POLICY "AssignedRoles: Allow delete by authorized users" 
ON public.team_member_assigned_roles
FOR DELETE
USING (
    public.is_owner_of_client(auth.uid(), client_id) OR
    public.user_has_client_permission(auth.uid(), client_id, 'client.team.unassign_role')
);

-- Note: Permission keys like 'client.team.invite', 'client.team.manage', 'client.roles.create',
-- 'client.team.assign_role' are examples and should match the actual keys defined in your
-- GranularPermissionsMatrix.md and used in client_defined_roles.permissions JSONB array. 