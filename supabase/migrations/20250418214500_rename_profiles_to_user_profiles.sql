-- Migration: Rename profiles table to user_profiles

-- Rename the table
ALTER TABLE public.profiles RENAME TO user_profiles;

-- Update comments (Optional but good practice)
COMMENT ON TABLE public.user_profiles IS 'Stores public profile information for users, linked to auth.users';
-- Note: Foreign key constraints, indexes, and triggers associated with the table are typically renamed automatically by PostgreSQL.
-- The RLS policies associated with public.profiles will also be automatically associated with user_profiles.
-- The handle_new_user function referencing public.profiles in its INSERT statement also needs to be updated.

-- Update the handle_new_user function to reference the new table name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Use the new table name here
  INSERT INTO public.user_profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$;

-- No change needed for the trigger itself, as it calls the function by name. 