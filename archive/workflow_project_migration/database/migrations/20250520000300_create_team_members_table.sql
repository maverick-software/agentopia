-- Migration: Create team_members table and its updated_at trigger

CREATE TABLE public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    invited_by_auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- User who sent the invite
    status public.team_member_status NOT NULL DEFAULT 'PENDING', -- Uses ENUM from earlier migration
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (auth_user_id, client_id) -- A user can only be a team member of a specific client once
);

-- The public.handle_updated_at() function is assumed to be created by a previous migration (e.g., profiles table migration).
CREATE TRIGGER on_team_members_updated
BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at(); 