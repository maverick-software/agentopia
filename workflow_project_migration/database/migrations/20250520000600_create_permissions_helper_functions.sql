-- Migration: Create SQL helper functions for permissions system

-- Function to get a user's global role
CREATE OR REPLACE FUNCTION public.get_user_global_role(user_id UUID)
RETURNS public.global_user_role
LANGUAGE sql
STABLE
SECURITY INVOKER -- Can be invoker as it reads from profiles, assuming user can read their own or it's called by definer contexts.
AS $$
    SELECT global_role FROM public.profiles WHERE auth_user_id = user_id;
$$;

-- Function to get a user's profile ID (PK of profiles table)
CREATE OR REPLACE FUNCTION public.get_user_profile_id(user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT id FROM public.profiles WHERE auth_user_id = user_id;
$$;


-- Boolean check functions for global roles
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT public.get_user_global_role(user_id) = 'SUPER_ADMIN';
$$;

CREATE OR REPLACE FUNCTION public.is_developer(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT public.get_user_global_role(user_id) = 'DEVELOPER';
$$;

CREATE OR REPLACE FUNCTION public.is_support_rep(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT public.get_user_global_role(user_id) = 'SUPPORT_REP';
$$;

CREATE OR REPLACE FUNCTION public.is_client_role(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT public.get_user_global_role(user_id) = 'CLIENT';
$$;

-- Function to get a client role user's default client_id
CREATE OR REPLACE FUNCTION public.get_client_default_id(user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY INVOKER -- Similar to get_user_global_role regarding security context.
AS $$
    SELECT default_client_id FROM public.profiles WHERE auth_user_id = user_id;
$$;

-- Function to check if a user is the owner of a specific client
CREATE OR REPLACE FUNCTION public.is_owner_of_client(user_id UUID, target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER -- Reads from clients table, RLS on clients table would apply.
AS $$
    SELECT EXISTS (SELECT 1 FROM public.clients WHERE id = target_client_id AND owner_auth_user_id = user_id);
$$;

-- Function to check if a user is an active team member of a specific client
CREATE OR REPLACE FUNCTION public.is_team_member_of_client(user_id UUID, target_client_id UUID, required_status public.team_member_status DEFAULT 'ACTIVE')
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER -- Needs to see team_members table entries regardless of invoker's direct RLS, to determine membership.
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.team_members tm 
        WHERE tm.auth_user_id = user_id 
        AND tm.client_id = target_client_id 
        AND tm.status = required_status
    );
$$;

-- Core function to check if a user has a specific granular permission for a client
CREATE OR REPLACE FUNCTION public.user_has_client_permission(user_id UUID, target_client_id UUID, permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER -- Must be SECURITY DEFINER to query across tables (profiles, clients, team_members, team_member_assigned_roles, client_defined_roles)
AS $$
DECLARE
    has_perm BOOLEAN := FALSE;
    usr_global_role public.global_user_role;
    client_owner_user_id UUID;
BEGIN
    -- 1. Get user's global role
    SELECT global_role INTO usr_global_role FROM public.profiles WHERE auth_user_id = user_id;

    -- 2. SUPER_ADMIN and DEVELOPER have all permissions implicitly (for any client context they are assessing)
    -- This simplifies RLS checks for them; specific UI controls might still exist.
    IF usr_global_role = 'SUPER_ADMIN' OR usr_global_role = 'DEVELOPER' THEN
        RETURN TRUE;
    END IF;

    -- 3. Check if user is the designated owner of the client account
    SELECT owner_auth_user_id INTO client_owner_user_id FROM public.clients WHERE id = target_client_id;
    IF client_owner_user_id IS NOT NULL AND client_owner_user_id = user_id THEN
        RETURN TRUE; -- Client owner effectively has all permissions for their client
    END IF;

    -- 4. If not owner, check team membership and assigned client-defined roles
    IF EXISTS (
        SELECT 1 
        FROM public.team_members tm 
        WHERE tm.auth_user_id = user_id 
        AND tm.client_id = target_client_id 
        AND tm.status = 'ACTIVE'
    ) THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.team_member_assigned_roles tmar
            JOIN public.client_defined_roles cdr ON tmar.client_defined_role_id = cdr.id
            WHERE tmar.team_member_auth_user_id = user_id 
            AND tmar.client_id = target_client_id 
            AND cdr.permissions @> jsonb_build_array(permission_key)::jsonb
        ) INTO has_perm;
        IF has_perm THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    -- 5. Support Rep special handling: For this function, we assume if a Support Rep is assessing a client,
    -- their specific permissions are handled by their direct RLS policies (often broad read) or UI controls.
    -- This function is primarily for Client owners and Team Members' granular permissions.
    -- If specific granular checks ARE needed for SR here, more logic would be added.

    RETURN FALSE; -- Default to no permission if none of the above conditions met
END;
$$;

-- Function to check if an admin user can perform impersonation
CREATE OR REPLACE FUNCTION public.can_impersonate(admin_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT public.get_user_global_role(admin_user_id) IN ('SUPER_ADMIN', 'DEVELOPER', 'SUPPORT_REP');
$$; 