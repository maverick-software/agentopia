-- Migration: Drop old triggers and functions related to syncing auth.users with public.users.role

-- Drop the trigger that might be calling handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the trigger that might be calling handle_auth_user_sync
DROP TRIGGER IF EXISTS sync_auth_users ON auth.users;

-- Drop the functions
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_auth_user_sync();

COMMENT ON SCHEMA public IS 'Dropped old user sync triggers (on_auth_user_created, sync_auth_users on auth.users) and their handler functions (public.handle_new_user, public.handle_auth_user_sync) as part of refactoring user roles to public.profiles.'; 