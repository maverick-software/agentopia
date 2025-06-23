-- Migration: Update on_auth_user_created_set_profile trigger function
-- to allow setting global_role from auth.users.raw_user_meta_data during signup.

DROP TRIGGER IF EXISTS on_auth_user_created_set_profile ON auth.users; -- Drop existing trigger first
DROP FUNCTION IF EXISTS public.on_auth_user_created_set_profile(); -- Drop existing function

CREATE OR REPLACE FUNCTION public.on_auth_user_created_set_profile()
RETURNS TRIGGER AS $$
DECLARE
    profile_global_role public.global_user_role;
    profile_full_name TEXT;
    metadata_global_role TEXT;
BEGIN
    -- Attempt to get global_role from new user's metadata
    metadata_global_role := NEW.raw_user_meta_data->>'global_role';

    IF metadata_global_role IS NOT NULL THEN
        BEGIN
            -- Attempt to cast the metadata role to our ENUM type
            profile_global_role := metadata_global_role::public.global_user_role;
        EXCEPTION 
            WHEN invalid_text_representation THEN
                RAISE WARNING 'Invalid global_role provided in user metadata: "%". Defaulting to CLIENT.', metadata_global_role;
                profile_global_role := 'CLIENT'; -- Default if metadata role is not a valid ENUM member
            WHEN others THEN -- Catch any other potential errors during casting
                 RAISE WARNING 'Error processing global_role from metadata: %. Defaulting to CLIENT.', SQLERRM;
                profile_global_role := 'CLIENT';
        END;
    ELSE
        profile_global_role := 'CLIENT'; -- Default role if not provided in metadata
    END IF;

    -- Determine full_name: use from metadata if present and not empty, else use email
    IF NEW.raw_user_meta_data ? 'full_name' AND 
       NEW.raw_user_meta_data->>'full_name' IS NOT NULL AND 
       TRIM(NEW.raw_user_meta_data->>'full_name') <> '' THEN
        profile_full_name := TRIM(NEW.raw_user_meta_data->>'full_name');
    ELSE
        profile_full_name := NEW.email; -- Fallback to email if full_name is not in metadata or is empty
    END IF;

    INSERT INTO public.profiles (auth_user_id, email, global_role, full_name, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        profile_global_role,
        profile_full_name,
        now()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created_set_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.on_auth_user_created_set_profile();

COMMENT ON FUNCTION public.on_auth_user_created_set_profile IS 'Handles new user entries in auth.users to populate public.profiles, including setting global_role from raw_user_meta_data if provided and valid, otherwise defaults. Also sets full_name.'; 