ALTER TABLE public.profiles
DROP COLUMN IF EXISTS global_role;

COMMENT ON TABLE public.profiles IS 'User profile information. global_role column removed after migration to user_roles table.'; 