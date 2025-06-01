-- Migration: Delete user admin@webdevflow.com (fd3d4c8e-9f8d-4c3e-b5f0-a2d2c0379f1a)

DO $$
DECLARE
    target_user_id UUID := 'fd3d4c8e-9f8d-4c3e-b5f0-a2d2c0379f1a';
BEGIN
    RAISE NOTICE 'Attempting to delete user ID: % (admin@webdevflow.com)', target_user_id;

    -- Delete from public.users (and backup) first, in case of FKs pointing to it, though auth.users is primary
    -- This might be redundant if auth.users deletion cascades, but explicit deletion is fine.
    DELETE FROM public.users WHERE id = target_user_id;
    RAISE NOTICE 'Deleted from public.users (if existed): %', target_user_id;

    DELETE FROM public.users_backup_20250520 WHERE id = target_user_id;
    RAISE NOTICE 'Deleted from public.users_backup_20250520 (if existed): %', target_user_id;
    
    -- Delete from auth.users. This should cascade to public.profiles.
    -- Supabase's auth admin functions are preferred for user deletion if available
    -- but direct SQL delete from auth.users by ID is also possible for service roles.
    -- Assuming this migration is run by a role with sufficient privileges.
    DELETE FROM auth.users WHERE id = target_user_id;
    RAISE NOTICE 'Deleted from auth.users (if existed): %', target_user_id;
    -- public.profiles deletion should be handled by ON DELETE CASCADE from auth_user_id FK.

    RAISE NOTICE 'Deletion of user ID: % complete.', target_user_id;
END $$;

COMMENT ON SCHEMA public IS 'User admin@webdevflow.com (ID fd3d4c8e-9f8d-4c3e-b5f0-a2d2c0379f1a) has been deleted as part of role system refactoring.'; 