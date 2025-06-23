-- Redefine Primary Key and add UNIQUE constraints for user_roles

-- Drop the existing composite primary key
-- Note: The actual name might vary, adjust if this fails.
-- Default name is usually <tablename>_pkey
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;

-- Add a new surrogate primary key column if it doesn't exist
-- (Original schema did not have a simple PK, so we add it)
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS id UUID DEFAULT extensions.uuid_generate_v4();

-- Ensure the new id column is the primary key
-- This might require a separate step if ADD COLUMN IF NOT EXISTS doesn't allow setting PK directly
-- For now, let's assume we handle this by first adding, then altering.
-- A cleaner way if the table is being effectively rebuilt in terms of PK:
-- (Alternative: if `id` column was added, now make it PK)
-- ALTER TABLE public.user_roles ADD PRIMARY KEY (id); --> This will fail if there are duplicate NULLs from default uuid generation if rows existed before this migration without PK
-- To be safe, let's ensure it's NOT NULL first if making it a PK.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'user_roles' AND constraint_type = 'PRIMARY KEY' AND table_schema = 'public'
    ) THEN
        -- If no PK, and `id` column exists from previous step, make it PK.
        -- First, ensure `id` is not null for existing rows that might have gotten a NULL before default was set.
        -- This is unlikely if the column is added with a default in the same transaction.
        UPDATE public.user_roles SET id = extensions.uuid_generate_v4() WHERE id IS NULL;
        ALTER TABLE public.user_roles ALTER COLUMN id SET NOT NULL;
        ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_surrogate_pkey PRIMARY KEY (id);
    END IF;
END;
$$;


-- Ensure client_id is nullable (it should be from original DDL, but PK might have forced NOT NULL)
ALTER TABLE public.user_roles ALTER COLUMN client_id DROP NOT NULL;

-- Add partial unique index for global roles (user_id, role_id should be unique when client_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS unique_global_user_role 
ON public.user_roles (user_id, role_id) 
WHERE client_id IS NULL;

-- Add partial unique index for client-specific roles (user_id, role_id, client_id should be unique when client_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS unique_client_user_role 
ON public.user_roles (user_id, role_id, client_id) 
WHERE client_id IS NOT NULL;

COMMENT ON TABLE public.user_roles IS 'Links users to roles. client_id is NULL for global role assignments. Uses surrogate PK and partial unique indexes.';
COMMENT ON COLUMN public.user_roles.id IS 'Surrogate primary key for the user_roles table.'; 