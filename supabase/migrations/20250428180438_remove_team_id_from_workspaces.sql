-- === CONSOLIDATED WORKSPACE REFACTOR MIGRATION ===

-- Step 1: Rename original chat_rooms table
ALTER TABLE IF EXISTS public.chat_rooms RENAME TO workspaces;

-- Step 2: Rename room_id column in chat_channels
ALTER TABLE public.chat_channels
RENAME COLUMN room_id TO workspace_id;

-- Step 3: Drop the old team_id column from workspaces (if it ever existed)
-- Note: Original chat_rooms didn't have team_id, so this is just cleanup.
ALTER TABLE public.workspaces
DROP COLUMN IF EXISTS team_id;

-- Step 4: Ensure owner_user_id exists and is NOT NULL on workspaces
-- Assuming owner_user_id was correctly created on the original chat_rooms table.
-- Add constraint if it doesn't exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'owner_user_id'
    AND constraint_name = 'workspaces_owner_user_id_fkey'
  )
  THEN
     ALTER TABLE public.workspaces
     ADD CONSTRAINT workspaces_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;
-- Set NOT NULL (safe since no existing rows)
ALTER TABLE public.workspaces
ALTER COLUMN owner_user_id SET NOT NULL;

-- Step 5: Create the workspace_members table
CREATE TABLE public.workspace_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id uuid NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    team_id uuid NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NULL DEFAULT 'member', -- e.g., 'moderator', 'member'
    added_by_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT check_one_member_type CHECK (num_nonnulls(agent_id, team_id, user_id) = 1),
    CONSTRAINT unique_workspace_agent UNIQUE (workspace_id, agent_id),
    CONSTRAINT unique_workspace_team UNIQUE (workspace_id, team_id),
    CONSTRAINT unique_workspace_user UNIQUE (workspace_id, user_id)
);
CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_agent_id ON public.workspace_members(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_workspace_members_team_id ON public.workspace_members(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_workspace_members_user_id ON public.workspace_members(user_id) WHERE user_id IS NOT NULL;

-- Step 6: Define Helper Function is_workspace_member
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS
$$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = p_workspace_id AND wm.user_id = p_user_id
    UNION ALL
    SELECT 1 FROM public.workspace_members wm_teams JOIN public.user_team_memberships utm ON wm_teams.team_id = utm.team_id WHERE wm_teams.workspace_id = p_workspace_id AND utm.user_id = p_user_id
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;

-- Step 7: Define Helper Function can_manage_workspace_members
CREATE OR REPLACE FUNCTION public.can_manage_workspace_members(p_workspace_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS
$$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.id = p_workspace_id AND w.owner_user_id = p_user_id
    UNION ALL
    SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = p_workspace_id AND wm.user_id = p_user_id AND wm.role = 'moderator'
  );
$$;
GRANT EXECUTE ON FUNCTION public.can_manage_workspace_members(uuid, uuid) TO authenticated;

-- Step 8: Define/Update RLS for workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.workspaces;
DROP POLICY IF EXISTS "Allow select for owner or member" ON public.workspaces;
DROP POLICY IF EXISTS "Allow update for owner only" ON public.workspaces;
DROP POLICY IF EXISTS "Allow delete for owner only" ON public.workspaces;
CREATE POLICY "Allow insert for authenticated users" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow select for owner or member" ON public.workspaces FOR SELECT TO authenticated USING (auth.uid() = owner_user_id OR public.is_workspace_member(id, auth.uid()));
CREATE POLICY "Allow update for owner only" ON public.workspaces FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Allow delete for owner only" ON public.workspaces FOR DELETE TO authenticated USING (auth.uid() = owner_user_id);

-- Step 9: Define/Update RLS for workspace_members
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Allow insert for workspace managers" ON public.workspace_members;
DROP POLICY IF EXISTS "Allow update for workspace managers" ON public.workspace_members;
DROP POLICY IF EXISTS "Allow delete for workspace managers" ON public.workspace_members;
CREATE POLICY "Allow select for workspace members" ON public.workspace_members FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Allow insert for workspace managers" ON public.workspace_members FOR INSERT TO authenticated WITH CHECK (public.can_manage_workspace_members(workspace_id, auth.uid()));
CREATE POLICY "Allow update for workspace managers" ON public.workspace_members FOR UPDATE TO authenticated USING (public.can_manage_workspace_members(workspace_id, auth.uid())) WITH CHECK (public.can_manage_workspace_members(workspace_id, auth.uid()));
CREATE POLICY "Allow delete for workspace managers" ON public.workspace_members FOR DELETE TO authenticated USING (public.can_manage_workspace_members(workspace_id, auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO supabase_admin;
GRANT SELECT ON public.workspace_members TO authenticated;

-- Step 10: Define/Update RLS for chat_channels
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow room members to view channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow room owner to create channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow room owner to update channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow room owner to delete channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow workspace members to view channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow workspace owner to create channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow workspace owner to update channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow workspace owner to delete channels" ON public.chat_channels;
CREATE POLICY "Allow workspace members to view channels" ON public.chat_channels FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Allow workspace owner to create channels" ON public.chat_channels FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = chat_channels.workspace_id AND w.owner_user_id = auth.uid()));
CREATE POLICY "Allow workspace owner to update channels" ON public.chat_channels FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = chat_channels.workspace_id AND w.owner_user_id = auth.uid()));
CREATE POLICY "Allow workspace owner to delete channels" ON public.chat_channels FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = chat_channels.workspace_id AND w.owner_user_id = auth.uid()));

-- Step 11: Define/Update RLS for chat_messages
-- Helper function to get workspace_id from channel_id
CREATE OR REPLACE FUNCTION public.get_workspace_id_for_channel(p_channel_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT workspace_id FROM chat_channels WHERE id = p_channel_id; $$;
GRANT EXECUTE ON FUNCTION public.get_workspace_id_for_channel(uuid) TO authenticated;
-- Drop old policies
DROP POLICY IF EXISTS "Allow room members to read channel messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow room members to insert channel messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Disallow updates to channel messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow room owner to delete channel messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow workspace members to read channel messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow workspace members to insert channel messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow workspace managers to delete channel messages" ON public.chat_messages;
-- Create new policies
CREATE POLICY "Allow workspace members to read channel messages" ON public.chat_messages FOR SELECT TO authenticated USING (public.is_workspace_member(public.get_workspace_id_for_channel(channel_id), auth.uid()));
CREATE POLICY "Allow workspace members to insert channel messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(public.get_workspace_id_for_channel(channel_id), auth.uid()) AND ((sender_user_id IS NOT NULL AND sender_user_id = auth.uid()) OR sender_agent_id IS NOT NULL));
CREATE POLICY "Disallow updates to channel messages" ON public.chat_messages FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Allow workspace managers to delete channel messages" ON public.chat_messages FOR DELETE TO authenticated USING (public.can_manage_workspace_members(public.get_workspace_id_for_channel(channel_id), auth.uid()));
