-- Create the workspace_members table
CREATE TABLE public.workspace_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE, -- Reference chat_rooms initially
    agent_id uuid NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    team_id uuid NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NULL DEFAULT 'member', -- e.g., 'moderator', 'member'
    added_by_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    -- Ensure only one of agent_id, team_id, or user_id is non-null
    CONSTRAINT check_one_member_type CHECK (num_nonnulls(agent_id, team_id, user_id) = 1),

    -- Ensure uniqueness for each member type within a workspace
    CONSTRAINT unique_workspace_agent UNIQUE (workspace_id, agent_id),
    CONSTRAINT unique_workspace_team UNIQUE (workspace_id, team_id),
    CONSTRAINT unique_workspace_user UNIQUE (workspace_id, user_id)
);

-- Add indexes for frequent lookups
CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_agent_id ON public.workspace_members(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_workspace_members_team_id ON public.workspace_members(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_workspace_members_user_id ON public.workspace_members(user_id) WHERE user_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Grant usage to necessary roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO supabase_admin; -- Example, adjust roles as needed
GRANT SELECT ON public.workspace_members TO authenticated;
-- Grant INSERT/DELETE later via RLS based on workspace ownership/role
