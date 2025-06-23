ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_created_by_fkey;

ALTER TABLE public.projects
ADD CONSTRAINT projects_created_by_auth_users_fkey
FOREIGN KEY (created_by)
REFERENCES auth.users(id)
ON DELETE SET NULL;
