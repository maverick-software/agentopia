ALTER TABLE public.workflow_templates
DROP CONSTRAINT IF EXISTS workflow_templates_created_by_fkey;

ALTER TABLE public.workflow_templates
ADD CONSTRAINT workflow_templates_created_by_auth_users_fkey
FOREIGN KEY (created_by)
REFERENCES auth.users(id)
ON DELETE SET NULL;
