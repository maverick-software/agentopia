-- Add sort_order column to roles table for drag and drop reordering
ALTER TABLE public.roles 
ADD COLUMN sort_order INTEGER;

-- Set initial sort_order values based on creation order, separated by role_type
-- Global roles start from 1
WITH global_roles AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM public.roles 
  WHERE role_type = 'GLOBAL'
)
UPDATE public.roles 
SET sort_order = global_roles.rn
FROM global_roles
WHERE public.roles.id = global_roles.id;

-- Client contextual roles start from 1
WITH client_roles AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM public.roles 
  WHERE role_type = 'CLIENT_CONTEXTUAL'
)
UPDATE public.roles 
SET sort_order = client_roles.rn
FROM client_roles
WHERE public.roles.id = client_roles.id;

-- Set default for new roles to be added at the end
ALTER TABLE public.roles 
ALTER COLUMN sort_order SET DEFAULT 999999;

-- Add comment
COMMENT ON COLUMN public.roles.sort_order IS 'Display order for drag and drop sorting within each role_type.';
