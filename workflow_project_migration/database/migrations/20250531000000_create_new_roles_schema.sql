-- Migration: Create new consolidated roles and user_roles tables

-- Enable pgcrypto extension if not already enabled (for UUID generation)
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

-- Ensure moddatetime function exists for updated_at triggers
-- Moved to the top to ensure availability before trigger creation.
CREATE OR REPLACE FUNCTION extensions.moddatetime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Create the 'roles' table
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    role_type TEXT NOT NULL CHECK (role_type IN ('GLOBAL', 'CLIENT_CONTEXTUAL')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.roles IS 'Stores role definitions, their permissions, and type (global or client-contextual).';
COMMENT ON COLUMN public.roles.name IS 'Internal unique name for the role (e.g., SUPER_ADMIN, CLIENT_EDITOR).';
COMMENT ON COLUMN public.roles.display_name IS 'User-friendly name for UI display (e.g., Super Admin, Client Editor).';
COMMENT ON COLUMN public.roles.permissions IS 'JSONB array of permission strings associated with this role.';
COMMENT ON COLUMN public.roles.role_type IS 'Type of role: GLOBAL (platform-wide) or CLIENT_CONTEXTUAL (specific to a client).';

-- Add trigger for updated_at on roles table
CREATE TRIGGER handle_updated_at
BEFORE UPDATE ON public.roles
FOR EACH ROW
EXECUTE FUNCTION extensions.moddatetime (updated_at);

-- Add indexes to 'roles' table
CREATE INDEX idx_roles_name ON public.roles(name);
CREATE INDEX idx_roles_role_type ON public.roles(role_type);

-- 2. Create the 'user_roles' table (linking table)
CREATE TABLE public.user_roles (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    client_id UUID NULL REFERENCES public.clients(id) ON DELETE CASCADE, -- Explicitly NULL, Nullable for GLOBAL roles
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, role_id, client_id) -- Composite primary key
);

COMMENT ON TABLE public.user_roles IS 'Links users to roles. client_id is NULL for global role assignments.';
COMMENT ON COLUMN public.user_roles.client_id IS 'Client context for the role assignment. NULL if the role is global.';

-- Add indexes to 'user_roles' table
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON public.user_roles(role_id);
CREATE INDEX idx_user_roles_client_id ON public.user_roles(client_id);
CREATE INDEX idx_user_roles_user_client ON public.user_roles(user_id, client_id); -- For efficient lookup of a user's roles for a specific client

-- Log completion comment remains, but RAISE NOTICE statement is removed.
-- RAISE NOTICE 'Migration to create new roles schema completed successfully.'; 