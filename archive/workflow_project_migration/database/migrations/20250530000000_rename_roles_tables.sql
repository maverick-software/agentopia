-- Migration to rename client_defined_roles to client_roles and team_member_assigned_roles to team_roles

-- 1. Start a transaction to ensure all or nothing
BEGIN;

-- 2. Rename tables
ALTER TABLE IF EXISTS public.client_defined_roles RENAME TO client_roles;
ALTER TABLE IF EXISTS public.team_member_assigned_roles RENAME TO team_roles;

-- 3. Rename column in team_roles
ALTER TABLE public.team_roles RENAME COLUMN client_defined_role_id TO client_role_id;

-- 4. Update foreign key constraints in team_roles
ALTER TABLE public.team_roles
DROP CONSTRAINT IF EXISTS team_member_assigned_roles_client_defined_role_id_fkey,
ADD CONSTRAINT team_roles_client_role_id_fkey 
  FOREIGN KEY (client_role_id) REFERENCES public.client_roles(id) ON DELETE CASCADE;

-- 5. Update or recreate RLS policies
DROP POLICY IF EXISTS "ClientRoles: Allow delete by authorized users" ON public.client_roles;
DROP POLICY IF EXISTS "ClientRoles: Allow insert by authorized users" ON public.client_roles;
DROP POLICY IF EXISTS "ClientRoles: Allow select for client members and admins" ON public.client_roles;
DROP POLICY IF EXISTS "ClientRoles: Allow update by authorized users" ON public.client_roles;

DROP POLICY IF EXISTS "AssignedRoles: Allow delete by authorized users" ON public.team_roles;
DROP POLICY IF EXISTS "AssignedRoles: Allow insert by authorized users" ON public.team_roles;
DROP POLICY IF EXISTS "AssignedRoles: Allow select for client members and admins" ON public.team_roles;

-- Recreate policies with updated references
CREATE POLICY "ClientRoles: Allow insert by authorized users" 
ON public.client_roles
FOR INSERT
WITH CHECK (
    public.is_owner_of_client(auth.uid(), client_id) OR
    public.user_has_client_permission(auth.uid(), client_id, 'client.roles.create')
);

CREATE POLICY "ClientRoles: Allow select for client members and admins" 
ON public.client_roles
FOR SELECT
USING (
    (EXISTS (SELECT 1 FROM public.team_members tm_check WHERE tm_check.client_id = public.client_roles.client_id AND tm_check.auth_user_id = auth.uid() AND tm_check.status = 'ACTIVE')) OR
    public.is_owner_of_client(auth.uid(), public.client_roles.client_id) OR
    public.is_super_admin(auth.uid()) OR 
    public.is_developer(auth.uid()) OR 
    public.is_support_rep(auth.uid())
);

CREATE POLICY "ClientRoles: Allow update by authorized users" 
ON public.client_roles
FOR UPDATE
USING (
    public.is_owner_of_client(auth.uid(), client_id) OR
    public.user_has_client_permission(auth.uid(), client_id, 'client.roles.edit')
)
WITH CHECK (
    public.is_owner_of_client(auth.uid(), client_id) OR
    public.user_has_client_permission(auth.uid(), client_id, 'client.roles.edit')
);

CREATE POLICY "ClientRoles: Allow delete by authorized users" 
ON public.client_roles
FOR DELETE
USING (
    public.is_owner_of_client(auth.uid(), client_id) OR
    public.user_has_client_permission(auth.uid(), client_id, 'client.roles.delete')
);

CREATE POLICY "TeamRoles: Allow insert by authorized users" 
ON public.team_roles
FOR INSERT
WITH CHECK (
    public.is_owner_of_client(auth.uid(), client_id) OR
    public.user_has_client_permission(auth.uid(), client_id, 'client.team.assign_role')
);

CREATE POLICY "TeamRoles: Allow select for client members and admins" 
ON public.team_roles
FOR SELECT
USING (
    (EXISTS (SELECT 1 FROM public.team_members tm_check WHERE tm_check.client_id = public.team_roles.client_id AND tm_check.auth_user_id = auth.uid() AND tm_check.status = 'ACTIVE')) OR
    public.is_owner_of_client(auth.uid(), public.team_roles.client_id) OR
    public.is_super_admin(auth.uid()) OR 
    public.is_developer(auth.uid()) OR 
    public.is_support_rep(auth.uid())
);

CREATE POLICY "TeamRoles: Allow delete by authorized users" 
ON public.team_roles
FOR DELETE
USING (
    public.is_owner_of_client(auth.uid(), client_id) OR
    public.user_has_client_permission(auth.uid(), client_id, 'client.team.unassign_role')
);

-- 6. Update helper functions
CREATE OR REPLACE FUNCTION public.user_has_client_permission(user_id UUID, target_client_id UUID, permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER 
AS $$
DECLARE
    has_perm BOOLEAN := FALSE;
    usr_global_role public.global_user_role;
    client_owner_user_id UUID;
BEGIN
    -- 1. Get user's global role
    SELECT global_role INTO usr_global_role FROM public.profiles WHERE auth_user_id = user_id;

    -- 2. SUPER_ADMIN and DEVELOPER have all permissions implicitly
    IF usr_global_role = 'SUPER_ADMIN' OR usr_global_role = 'DEVELOPER' THEN
        RETURN TRUE;
    END IF;

    -- 3. Check if user is the designated owner of the client account
    SELECT owner_auth_user_id INTO client_owner_user_id FROM public.clients WHERE id = target_client_id;
    IF client_owner_user_id IS NOT NULL AND client_owner_user_id = user_id THEN
        RETURN TRUE; -- Client owner effectively has all permissions for their client
    END IF;

    -- 4. If not owner, check team membership and assigned client roles
    IF EXISTS (
        SELECT 1 
        FROM public.team_members tm 
        WHERE tm.auth_user_id = user_id 
        AND tm.client_id = target_client_id 
        AND tm.status = 'ACTIVE'
    ) THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.team_roles tr
            JOIN public.client_roles cr ON tr.client_role_id = cr.id
            WHERE tr.team_member_auth_user_id = user_id 
            AND tr.client_id = target_client_id 
            AND cr.permissions @> jsonb_build_array(permission_key)::jsonb
        ) INTO has_perm;
        IF has_perm THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    RETURN FALSE; -- Default to no permission if none of the above conditions met
END;
$$;

-- 7. Commit the transaction
COMMIT; 