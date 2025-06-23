-- Migration: Add get_user_global_role_names SQL helper function

CREATE OR REPLACE FUNCTION public.get_user_global_role_names(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT array_agg(r.name)
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
      AND ur.client_id IS NULL -- Global roles
      AND r.role_type = 'GLOBAL';
$$;

COMMENT ON FUNCTION public.get_user_global_role_names(UUID) IS 'Returns an array of global role names for a given user.';

-- RAISE NOTICE 'Function get_user_global_role_names created successfully.'; 