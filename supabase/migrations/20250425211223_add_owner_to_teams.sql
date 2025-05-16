-- Migration script to add owner tracking to the 'teams' table

-- Add the owner_user_id column
ALTER TABLE public.teams
ADD COLUMN owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Set the default owner for existing teams (if any) to a specific admin or placeholder if needed
-- Or make it NOT NULL and require it during creation moving forward.
-- For simplicity, we'll allow it to be NULL for now, assuming new teams will have it set.

-- Add comment for the new column
COMMENT ON COLUMN public.teams.owner_user_id IS 'The user (from auth.users) who originally created the team.';
