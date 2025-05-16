-- Migration script to create the 'team_members' table

-- Create the team_members table (junction table between teams and agents)
CREATE TABLE public.team_members (
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    team_role text CHECK (char_length(team_role) > 0), -- e.g., 'member', 'project_manager', 'user_liaison', 'qa'
    team_role_description text, -- User-defined description of the agent's role on this specific team
    reports_to_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL, -- Agent supervisor within the team
    reports_to_user boolean NOT NULL DEFAULT false, -- Does this agent report directly to the user?
    joined_at timestamp with time zone NOT NULL DEFAULT now(),

    -- Constraints
    PRIMARY KEY (team_id, agent_id), -- Composite primary key
    CONSTRAINT chk_reports_to_not_self CHECK (agent_id <> reports_to_agent_id), -- Agent cannot report to itself
    CONSTRAINT chk_one_report_target CHECK (
        (reports_to_agent_id IS NOT NULL AND reports_to_user = false) -- Reports to agent
        OR (reports_to_agent_id IS NULL AND reports_to_user = true)  -- Reports to user
        OR (reports_to_agent_id IS NULL AND reports_to_user = false) -- Reports to nobody (e.g., top-level manager)
    )
    -- Note: Ensuring only one member reports_to_user=true per team requires a trigger or deferred constraint
    -- Note: Ensuring reports_to_agent_id is within the same team requires a trigger or complex function
);

-- Add comments
COMMENT ON TABLE public.team_members IS 'Associates agents with teams, defining their role and reporting structure within that team.';
COMMENT ON COLUMN public.team_members.team_id IS 'Foreign key referencing the team.';
COMMENT ON COLUMN public.team_members.agent_id IS 'Foreign key referencing the agent.';
COMMENT ON COLUMN public.team_members.team_role IS 'Standardized role of the agent within this team (e.g., project_manager, member).';
COMMENT ON COLUMN public.team_members.team_role_description IS 'User-defined description of the agent''s specific duties on this team.';
COMMENT ON COLUMN public.team_members.reports_to_agent_id IS 'The agent ID of the supervisor within this team, if applicable.';
COMMENT ON COLUMN public.team_members.reports_to_user IS 'Indicates if this agent reports directly to the user for this team.';
COMMENT ON COLUMN public.team_members.joined_at IS 'Timestamp when the agent joined the team.';

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Indexes (consider adding based on query patterns)
CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_agent_id ON public.team_members(agent_id);
CREATE INDEX idx_team_members_reports_to_agent_id ON public.team_members(reports_to_agent_id);

-- Placeholder for the trigger/function to enforce single reports_to_user per team
-- This needs careful implementation due to potential race conditions or complexity.
/*
CREATE OR REPLACE FUNCTION enforce_single_user_report_per_team()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reports_to_user = true THEN
        IF EXISTS (
            SELECT 1
            FROM public.team_members
            WHERE team_id = NEW.team_id
              AND agent_id <> NEW.agent_id
              AND reports_to_user = true
        ) THEN
            RAISE EXCEPTION 'Only one team member can report directly to the user per team.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_enforce_single_user_report
BEFORE INSERT OR UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION enforce_single_user_report_per_team();
*/
