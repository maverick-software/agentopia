ALTER TABLE public.workflow_steps
DROP CONSTRAINT IF EXISTS workflow_steps_completed_by_fkey;

ALTER TABLE public.workflow_steps
ADD CONSTRAINT workflow_steps_completed_by_auth_users_fkey
FOREIGN KEY (completed_by)
REFERENCES auth.users(id)
ON DELETE SET NULL;
