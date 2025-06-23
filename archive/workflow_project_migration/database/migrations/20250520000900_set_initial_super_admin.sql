-- Migration: Set initial SUPER_ADMIN user

-- This migration attempts to find a user by email in auth.users
-- and then inserts or updates their profile in public.profiles
-- to grant them the SUPER_ADMIN global role.

-- If the user with the specified email does not exist in auth.users,
-- this migration will not create an auth.users entry and will effectively do nothing.

-- If a profile for the user already exists, it will be updated.
-- If not, a new profile will be inserted.

DO $$
DECLARE
    target_user_id UUID;
    admin_email TEXT := '''charles.r.sears@gmail.com'''; -- The email of the user to be made Super Admin
    admin_full_name TEXT := '''Charles R. Sears (Admin)'''; -- Placeholder full name if creating a new profile
BEGIN
    -- Attempt to find the user_id from auth.users based on the email
    SELECT id INTO target_user_id FROM auth.users WHERE email = admin_email;

    -- If the user was found, proceed to upsert their profile
    IF target_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (auth_user_id, global_role, full_name, updated_at)
        VALUES (target_user_id, '''SUPER_ADMIN'''::public.global_user_role, admin_full_name, now())
        ON CONFLICT (auth_user_id) DO UPDATE SET
            global_role = EXCLUDED.global_role,
            full_name = CASE
                            WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = '''''' THEN EXCLUDED.full_name
                            ELSE public.profiles.full_name
                        END, -- Only set full_name if it's currently empty/null
            updated_at = now();

        RAISE NOTICE '''Profile for user % (ID: %) set to SUPER_ADMIN.''', admin_email, target_user_id;
    ELSE
        RAISE WARNING '''User with email % not found in auth.users. No SUPER_ADMIN was set by this script.''', admin_email;
    END IF;
END $$;

-- This also fulfills SOP Step 1.4: Set up initial data (e.g., Super Admin user). 