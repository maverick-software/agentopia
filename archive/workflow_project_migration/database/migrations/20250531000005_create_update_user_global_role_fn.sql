CREATE OR REPLACE FUNCTION public.update_user_global_role(
    p_user_id UUID,
    p_new_role_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- To allow it to modify user_roles
AS $$
DECLARE
    v_new_role_id UUID;
BEGIN
    -- Find the role_id for the new global role
    SELECT id INTO v_new_role_id
    FROM public.roles
    WHERE name = p_new_role_name AND role_type = 'GLOBAL'
    LIMIT 1;

    IF v_new_role_id IS NULL THEN
        RAISE EXCEPTION 'Global role with name % not found.', p_new_role_name;
    END IF;

    -- Remove existing global role(s) for the user
    -- Global roles are those with client_id IS NULL
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id AND client_id IS NULL;

    -- Add the new global role assignment
    INSERT INTO public.user_roles (user_id, role_id, client_id)
    VALUES (p_user_id, v_new_role_id, NULL);

    -- The function doesn't need to return anything explicitly for success,
    -- but an error will be raised if something goes wrong.
END;
$$;

COMMENT ON FUNCTION public.update_user_global_role(UUID, TEXT)
IS 'Updates a user''s global role. It first removes any existing global roles (client_id IS NULL) and then assigns the new one.'; 