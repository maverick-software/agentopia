-- Migration script to create the 'user_team_memberships' table

CREATE TABLE public.user_team_memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    joined_at timestamp with time zone NOT NULL DEFAULT now(),

    -- Ensure a user can only be added once per team
    CONSTRAINT unique_user_team_membership UNIQUE (user_id, team_id)
);

-- Add comments
COMMENT ON TABLE public.user_team_memberships IS 'Associates users with teams.';
COMMENT ON COLUMN public.user_team_memberships.user_id IS 'Foreign key referencing the user.';
COMMENT ON COLUMN public.user_team_memberships.team_id IS 'Foreign key referencing the team.';
COMMENT ON COLUMN public.user_team_memberships.joined_at IS 'Timestamp when the user joined the team.';
COMMENT ON CONSTRAINT unique_user_team_membership ON public.user_team_memberships IS 'Ensures a user cannot be added multiple times to the same team.';


-- Enable RLS
ALTER TABLE public.user_team_memberships ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_user_team_memberships_user_id ON public.user_team_memberships(user_id);
CREATE INDEX idx_user_team_memberships_team_id ON public.user_team_memberships(team_id); 