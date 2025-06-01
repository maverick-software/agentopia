-- Comprehensive RLS Policy Drops (formerly 20250531000250_drop_old_rls_policies.sql)
-- Drop RLS policies from client_roles (formerly client_defined_roles)
ALTER TABLE public.client_roles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ClientRoles: Allow insert by authorized users" ON public.client_roles;
DROP POLICY IF EXISTS "ClientRoles: Allow select for client members and admins" ON public.client_roles;
DROP POLICY IF EXISTS "ClientRoles: Allow update by authorized users" ON public.client_roles;
DROP POLICY IF EXISTS "ClientRoles: Allow delete by authorized users" ON public.client_roles;

-- Drop RLS policies from team_roles (formerly team_member_assigned_roles)
ALTER TABLE public.team_roles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "TeamRoles: Allow insert by authorized users" ON public.team_roles;
DROP POLICY IF EXISTS "TeamRoles: Allow select for client members and admins" ON public.team_roles;
DROP POLICY IF EXISTS "TeamRoles: Allow delete by authorized users" ON public.team_roles;

-- Drop other policies on team_roles that might exist from older migrations (as per NOTICE logs)
DROP POLICY IF EXISTS "AssignedRoles: Allow delete by authorized users" ON public.team_roles;
DROP POLICY IF EXISTS "AssignedRoles: Allow insert by authorized users" ON public.team_roles;

-- Drop RLS policies from team_members
ALTER TABLE public.team_members DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "TeamMembers: Allow insert by authorized users" ON public.team_members;
DROP POLICY IF EXISTS "TeamMembers: Allow select for client members and admins" ON public.team_members;
DROP POLICY IF EXISTS "TeamMembers: Allow update by authorized users and admins" ON public.team_members;
DROP POLICY IF EXISTS "TeamMembers: Allow delete by authorized users and admins" ON public.team_members;

-- Drop RLS policies from profiles (from 20250520000700_enable_rls_and_initial_policies.sql)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles: Admins/Support can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: SuperAdmins/Developers can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: SuperAdmins/Developers can delete any profile" ON public.profiles;
-- Note: "Profiles: Enable read access for own user" and "Profiles: Enable update access for own user" do not use is_super_admin

-- Drop RLS policies from clients (from 20250520000700_enable_rls_and_initial_policies.sql)
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients: Admins/Support can read all client records" ON public.clients;
DROP POLICY IF EXISTS "Clients: SuperAdmins/Developers can create client records" ON public.clients;
DROP POLICY IF EXISTS "Clients: SuperAdmins/Developers can update any client record" ON public.clients;
DROP POLICY IF EXISTS "Clients: SuperAdmins/Developers can delete client records" ON public.clients;
DROP POLICY IF EXISTS "Clients: Owners can read their own client record" ON public.clients; -- Uses is_client_role
DROP POLICY IF EXISTS "Clients: Owners can update their own client record" ON public.clients; -- Uses is_client_role

-- Re-enable RLS on all affected tables
ALTER TABLE public.client_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Original content of 20250531000003_update_triggers_and_drop_old_helpers.sql continues below
-- Migration: Update on_auth_user_created_set_profile trigger and drop old role-related SQL helper functions

-- 1. Drop old SQL helper functions (now after comprehensive RLS drops)
DROP FUNCTION IF EXISTS public.get_user_global_role(UUID);
DROP FUNCTION IF EXISTS public.is_super_admin(UUID);
DROP FUNCTION IF EXISTS public.is_developer(UUID);
DROP FUNCTION IF EXISTS public.is_support_rep(UUID);
DROP FUNCTION IF EXISTS public.is_client_role(UUID);
DROP FUNCTION IF EXISTS public.user_has_client_permission(UUID, UUID, TEXT);

-- 2. Update the on_auth_user_created_set_profile function and its trigger

-- Drop existing trigger and function first to ensure a clean update
DROP TRIGGER IF EXISTS on_auth_user_created_set_profile ON auth.users;
DROP FUNCTION IF EXISTS public.on_auth_user_created_set_profile();

CREATE OR REPLACE FUNCTION public.on_auth_user_created_set_profile()
RETURNS TRIGGER AS $$
DECLARE
    profile_full_name TEXT;
    target_role_name_from_meta TEXT;
    target_role_name_to_assign TEXT;
    target_role_id UUID;
    default_global_role_name TEXT := 'CLIENT_USER'; -- New default global role for signups
BEGIN
    -- Determine full_name from metadata or fallback to email
    IF NEW.raw_user_meta_data ? 'full_name' AND 
       NEW.raw_user_meta_data->>'full_name' IS NOT NULL AND 
       TRIM(NEW.raw_user_meta_data->>'full_name') <> '' THEN
        profile_full_name := TRIM(NEW.raw_user_meta_data->>'full_name');
    ELSE
        profile_full_name := NEW.email;
    END IF;

    -- Insert into public.profiles (no longer includes global_role column)
    INSERT INTO public.profiles (auth_user_id, email, full_name, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        profile_full_name,
        now()
    );

    -- Determine the target global role for the new user
    target_role_name_from_meta := NEW.raw_user_meta_data->>'initial_global_role_name';

    IF target_role_name_from_meta IS NOT NULL THEN
        -- Check if the provided role name exists as a GLOBAL role
        SELECT id, name INTO target_role_id, target_role_name_to_assign
        FROM public.roles
        WHERE name = target_role_name_from_meta AND role_type = 'GLOBAL'
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE WARNING 'Invalid initial_global_role_name provided in user metadata: "%". Defaulting to %.', target_role_name_from_meta, default_global_role_name;
            target_role_name_to_assign := default_global_role_name;
            target_role_id := NULL; -- Will trigger fetching default role ID below
        END IF;
    ELSE
        target_role_name_to_assign := default_global_role_name;
    END IF;

    -- If target_role_id is not yet set (i.e., default or invalid override), get the ID of the role to assign.
    IF target_role_id IS NULL THEN
        SELECT id INTO target_role_id
        FROM public.roles
        WHERE name = target_role_name_to_assign AND role_type = 'GLOBAL'
        LIMIT 1;
        
        IF NOT FOUND THEN
            -- This is a critical setup error: the system relies on this default role existing.
            RAISE EXCEPTION 'Target global role "%" not found in public.roles table. Cannot assign role to new user %.', target_role_name_to_assign, NEW.id;
            RETURN NULL; -- Stop processing if the role cannot be found.
        END IF;
    END IF;

    -- Assign the determined global role to the new user in public.user_roles
    INSERT INTO public.user_roles (user_id, role_id, client_id)
    VALUES (
        NEW.id,
        target_role_id,
        NULL -- Global roles have a NULL client_id
    );

    RAISE NOTICE 'Assigned global role "%" (ID: %) to new user %.', target_role_name_to_assign, target_role_id, NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger on auth.users
CREATE TRIGGER on_auth_user_created_set_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.on_auth_user_created_set_profile();

COMMENT ON FUNCTION public.on_auth_user_created_set_profile() IS 'Handles new user entries in auth.users. Populates public.profiles (omitting global_role). Assigns a default global role (e.g., CLIENT_USER) or a specified valid global role from raw_user_meta_data->>''initial_global_role_name'' into public.user_roles.'; 