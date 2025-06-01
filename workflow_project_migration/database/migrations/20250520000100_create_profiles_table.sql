-- Migration: Create profiles table and its updated_at trigger

-- Assuming auth.users.id is type UUID
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT, -- Can be sourced from auth.users or an override
    full_name TEXT,
    avatar_url TEXT,
    global_role public.global_user_role NOT NULL, -- Uses ENUM from previous migration
    default_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL, -- For CLIENT role users, their primary client
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Generic trigger function to update 'updated_at' timestamp
-- This function can be defined once and reused across multiple tables.
-- Using CREATE OR REPLACE ensures it's idempotent if this migration runs after another that also defines it.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles table
CREATE TRIGGER on_profiles_updated
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at(); 