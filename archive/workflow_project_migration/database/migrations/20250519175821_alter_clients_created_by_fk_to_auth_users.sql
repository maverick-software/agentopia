ALTER TABLE public.clients
DROP CONSTRAINT IF EXISTS clients_created_by_fkey;

ALTER TABLE public.clients
ADD CONSTRAINT clients_created_by_auth_users_fkey
FOREIGN KEY (created_by)
REFERENCES auth.users(id)
ON DELETE SET NULL;
