-- Migration script to create the 'teams' table

-- Create the teams table
CREATE TABLE public.teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (char_length(name) > 0), -- Ensure name is not empty
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add comments to the table and columns
COMMENT ON TABLE public.teams IS 'Stores information about agent teams.';
COMMENT ON COLUMN public.teams.id IS 'Unique identifier for the team.';
COMMENT ON COLUMN public.teams.name IS 'Display name of the team.';
COMMENT ON COLUMN public.teams.description IS 'Optional description of the team''s purpose or focus.';
COMMENT ON COLUMN public.teams.created_at IS 'Timestamp when the team was created.';
COMMENT ON COLUMN public.teams.updated_at IS 'Timestamp when the team was last updated.';

-- Optional: Enable RLS (Row Level Security)
-- We will define specific policies later in the checklist
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Optional: Create a trigger to automatically update 'updated_at' timestamp
-- This ensures 'updated_at' reflects the last modification time
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER handle_team_update
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
