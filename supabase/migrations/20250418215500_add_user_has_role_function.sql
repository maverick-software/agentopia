-- Migration: Add user_has_role function

-- Function: Check if a user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(
    user_id uuid,
    role_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Important: Needs elevated privileges to check user_roles for *any* user_id
SET search_path = public
AS $$
DECLARE
    has_role boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1 AND r.name = $2
    ) INTO has_role;
    RETURN has_role;
END;
$$; 