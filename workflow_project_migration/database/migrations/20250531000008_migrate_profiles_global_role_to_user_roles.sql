-- Migration to populate user_roles from profiles.global_role

DO $$
DECLARE
    profile_record RECORD;
    v_role_id UUID;
BEGIN
    FOR profile_record IN
        SELECT auth_user_id, global_role FROM public.profiles WHERE global_role IS NOT NULL
    LOOP
        -- Find the corresponding role_id in the new roles table
        -- Assuming global_role values (e.g., 'SUPER_ADMIN', 'CLIENT') match 'name' in the 'roles' table for GLOBAL types
        SELECT id INTO v_role_id
        FROM public.roles
        WHERE name = profile_record.global_role::TEXT AND role_type = 'GLOBAL'
        LIMIT 1;

        IF v_role_id IS NOT NULL THEN
            -- Insert into user_roles, avoiding duplicates if a user somehow already has a global role assigned
            INSERT INTO public.user_roles (user_id, role_id, client_id) -- id column will use its default value
            VALUES (profile_record.auth_user_id, v_role_id, NULL)
            -- ON CONFLICT for partial indexes is more complex. 
            -- unique_global_user_role is on (user_id, role_id) WHERE client_id IS NULL.
            -- So, a conflict would be on these specific columns under this condition.
            ON CONFLICT (user_id, role_id) WHERE client_id IS NULL DO NOTHING;
        ELSE
            RAISE WARNING 'No corresponding global role found in roles table for profile.global_role: %', profile_record.global_role;
        END IF;
    END LOOP;
END;
$$; 