-- Migration: Migrate roles from public.users.role to public.profiles.global_role

DO $$
DECLARE
    user_record RECORD;
    target_profile_global_role public.global_user_role;
    profile_full_name TEXT;
BEGIN
    RAISE NOTICE 'Starting migration of roles from public.users_backup_20250520 to public.profiles...';

    FOR user_record IN SELECT id, email, role FROM public.users_backup_20250520 LOOP
        RAISE NOTICE 'Processing user_id: %, email: %, old_role: %', user_record.id, user_record.email, user_record.role;

        -- Determine the new global_role based on the mapping
        CASE user_record.role
            WHEN 'admin' THEN
                target_profile_global_role := 'SUPER_ADMIN';
            WHEN 'developer' THEN
                target_profile_global_role := 'DEVELOPER';
            WHEN 'project_manager' THEN
                target_profile_global_role := 'CLIENT';
            WHEN 'designer' THEN
                target_profile_global_role := 'CLIENT';
            ELSE
                target_profile_global_role := 'CLIENT'; -- Default for NULL or other roles
        END CASE;
        RAISE NOTICE 'Mapped to new global_role: %', target_profile_global_role;

        -- Determine full_name for profile (use email as placeholder if no other name is available)
        -- Assuming public.users doesn't have a full_name column, we'll use email for now.
        -- If public.profiles already has a full_name, we won't overwrite it unless it's empty.
        profile_full_name := COALESCE(user_record.email, 'User ' || user_record.id::text);


        -- Upsert into public.profiles
        INSERT INTO public.profiles (auth_user_id, global_role, full_name, updated_at)
        VALUES (user_record.id, target_profile_global_role, profile_full_name, now())
        ON CONFLICT (auth_user_id) DO UPDATE SET
            global_role = EXCLUDED.global_role,
            full_name = CASE
                            WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = '' THEN EXCLUDED.full_name
                            ELSE public.profiles.full_name
                        END,
            updated_at = now()
        WHERE public.profiles.global_role IS DISTINCT FROM EXCLUDED.global_role OR
              (public.profiles.full_name IS NULL OR public.profiles.full_name = ''); -- Only update if role changes or full_name was empty

        RAISE NOTICE 'Upserted profile for auth_user_id: % with global_role: %', user_record.id, target_profile_global_role;

    END LOOP;

    RAISE NOTICE 'Role migration to public.profiles complete.';
END $$; 