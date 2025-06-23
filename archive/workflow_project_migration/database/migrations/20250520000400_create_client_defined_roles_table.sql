-- Migration: Create client_defined_roles table and its updated_at trigger

CREATE TABLE public.client_defined_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    role_name TEXT NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of permission strings
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (client_id, role_name) -- Role names must be unique within a client
);

-- The public.handle_updated_at() function is assumed to be created by a previous migration.
CREATE TRIGGER on_client_defined_roles_updated
BEFORE UPDATE ON public.client_defined_roles
FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at(); 