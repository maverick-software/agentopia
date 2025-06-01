-- Migration: Setup RLS policies for new roles system and create helper functions

-- Helper function to get all role IDs for a user (global and for a specific client)
-- This function is not directly used by RLS below but can be useful for application logic.
CREATE OR REPLACE FUNCTION get_user_role_ids(p_user_id UUID, p_client_id UUID DEFAULT NULL)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT role_id
    FROM public.user_roles
    WHERE user_id = p_user_id
      AND (client_id = p_client_id OR client_id IS NULL); -- Matches specific client OR global roles
$$;

-- Core helper function to check if a user has a specific permission
CREATE OR REPLACE FUNCTION check_user_has_permission(
    p_user_id UUID,
    p_permission_key TEXT,
    p_client_id UUID DEFAULT NULL -- Optional: If checking a client-contextual permission
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER -- Must be definer to query roles table freely
AS $$
DECLARE
    v_has_permission BOOLEAN := FALSE;
    v_role_record RECORD;
BEGIN
    FOR v_role_record IN
        SELECT r.permissions
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id
          AND (
                (r.role_type = 'GLOBAL' AND ur.client_id IS NULL) OR 
                (r.role_type = 'CLIENT_CONTEXTUAL' AND ur.client_id = p_client_id AND p_client_id IS NOT NULL)
              )
    LOOP
        -- Check for direct wildcard like 'platform.*' or 'client.*'
        IF v_role_record.permissions @> '["platform.*"]'::jsonb AND p_permission_key LIKE 'platform.%' THEN
            RETURN TRUE;
        END IF;
        IF v_role_record.permissions @> '["client.*"]'::jsonb AND p_permission_key LIKE 'client.%' AND p_client_id IS NOT NULL THEN
            RETURN TRUE;
        END IF;
        -- Check for specific dynamic assign_role wildcard like 'client.users.assign_role.*'
        IF v_role_record.permissions @> '["client.users.assign_role.*"]'::jsonb AND p_permission_key LIKE 'client.users.assign_role.%' AND p_client_id IS NOT NULL THEN
            RETURN TRUE;
        END IF;

        -- Check for the exact permission key
        IF v_role_record.permissions @> jsonb_build_array(p_permission_key) THEN
            RETURN TRUE;
        END IF;
    END LOOP;

    RETURN FALSE;
END;
$$;
COMMENT ON FUNCTION check_user_has_permission(UUID, TEXT, UUID) IS 'Checks if a user has a specific permission, considering global roles and client-contextual roles if client_id is provided. Handles wildcards.';

-- RLS for 'roles' table
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read role definitions" ON public.roles;
CREATE POLICY "Allow authenticated users to read role definitions"
    ON public.roles FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow platform admins to manage roles" ON public.roles;
CREATE POLICY "Allow platform admins to manage roles"
    ON public.roles FOR ALL
    USING (check_user_has_permission(auth.uid(), 'platform.roles.manage'))
    WITH CHECK (check_user_has_permission(auth.uid(), 'platform.roles.manage'));

-- RLS for 'user_roles' table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own role assignments" ON public.user_roles;
CREATE POLICY "Users can view their own role assignments"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Platform admins can view all role assignments" ON public.user_roles;
CREATE POLICY "Platform admins can view all role assignments"
    ON public.user_roles FOR SELECT
    USING (check_user_has_permission(auth.uid(), 'platform.users.view_assignments'));

DROP POLICY IF EXISTS "Client managers can view role assignments for their client" ON public.user_roles;
CREATE POLICY "Client managers can view role assignments for their client"
    ON public.user_roles FOR SELECT
    USING (
        user_roles.client_id IS NOT NULL AND
        check_user_has_permission(auth.uid(), 'client.users.view_assignments', user_roles.client_id)
    );

DROP POLICY IF EXISTS "Allow platform admins to assign/unassign global roles" ON public.user_roles;
CREATE POLICY "Allow platform admins to assign/unassign global roles"
    ON public.user_roles FOR ALL
    USING (
        client_id IS NULL AND
        check_user_has_permission(auth.uid(), 'platform.users.assign_global_role')
    )
    WITH CHECK (
        client_id IS NULL AND
        check_user_has_permission(auth.uid(), 'platform.users.assign_global_role')
    );

DROP POLICY IF EXISTS "Allow authorized users to assign/unassign client roles" ON public.user_roles;
CREATE POLICY "Allow authorized users to assign/unassign client roles"
    ON public.user_roles FOR ALL
    USING (
        client_id IS NOT NULL AND
        (
            check_user_has_permission(auth.uid(), 'client.users.assign_any_role', client_id) OR
            EXISTS ( 
                SELECT 1
                FROM public.roles r_target
                WHERE r_target.id = user_roles.role_id 
                AND check_user_has_permission(auth.uid(), 'client.users.assign_role.' || r_target.name, user_roles.client_id)
            ) OR
             check_user_has_permission(auth.uid(), 'client.users.assign_role.*', client_id)
        )
    )
    WITH CHECK (
         client_id IS NOT NULL AND
        (
            check_user_has_permission(auth.uid(), 'client.users.assign_any_role', client_id) OR
            EXISTS (
                SELECT 1
                FROM public.roles r_target
                WHERE r_target.id = user_roles.role_id 
                AND check_user_has_permission(auth.uid(), 'client.users.assign_role.' || r_target.name, user_roles.client_id)
            ) OR
            check_user_has_permission(auth.uid(), 'client.users.assign_role.*', client_id)
        )
    );


-- RLS for 'profiles' table (Update to remove reliance on profiles.global_role)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and update their own profile" ON public.profiles;
CREATE POLICY "Users can view and update their own profile"
    ON public.profiles FOR ALL
    USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Platform admins can view all profiles" ON public.profiles;
CREATE POLICY "Platform admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (check_user_has_permission(auth.uid(), 'platform.users.view'));


-- RLS for 'clients' table
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins and support can view all clients" ON public.clients;
CREATE POLICY "Platform admins and support can view all clients"
    ON public.clients FOR SELECT
    USING (
        check_user_has_permission(auth.uid(), 'platform.clients.view_all')
    );

DROP POLICY IF EXISTS "Users can view clients they are associated with" ON public.clients;
CREATE POLICY "Users can view clients they are associated with"
    ON public.clients FOR SELECT
    USING (EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.client_id = public.clients.id
    ));

DROP POLICY IF EXISTS "Platform admins can manage clients" ON public.clients;
CREATE POLICY "Platform admins can manage clients"
    ON public.clients FOR ALL
    USING (check_user_has_permission(auth.uid(), 'platform.clients.manage'))
    WITH CHECK (check_user_has_permission(auth.uid(), 'platform.clients.manage'));

DROP POLICY IF EXISTS "Authorized client users can update their client" ON public.clients;
CREATE POLICY "Authorized client users can update their client"
    ON public.clients FOR UPDATE
    USING (check_user_has_permission(auth.uid(), 'client.edit', public.clients.id))
    WITH CHECK (check_user_has_permission(auth.uid(), 'client.edit', public.clients.id));

-- RAISE NOTICE 'RLS policies and helper functions for new roles system set up successfully.'; 