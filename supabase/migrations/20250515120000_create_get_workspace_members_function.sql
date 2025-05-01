-- Function to get workspace members with joined details

CREATE OR REPLACE FUNCTION public.get_workspace_members_with_details(p_workspace_id uuid)
RETURNS TABLE (
    id uuid,
    role text,
    created_at timestamptz,
    workspace_id uuid,
    user_id uuid,
    agent_id uuid,
    team_id uuid,
    user_profile jsonb, -- Nested user profile data
    agent jsonb, -- Nested agent data
    team jsonb -- Nested team data
)
LANGUAGE sql
STABLE -- Indicates the function doesn't modify the database
SECURITY DEFINER -- Use definer security to ensure access to underlying tables
SET search_path = public
AS $$
  SELECT
    wm.id,
    wm.role,
    wm.created_at,
    wm.workspace_id,
    wm.user_id,
    wm.agent_id,
    wm.team_id,
    -- Construct JSON object for user profile if user_id is not null
    CASE WHEN wm.user_id IS NOT NULL THEN
      jsonb_build_object(
          'full_name', up.full_name,
          'avatar_url', up.avatar_url
      )
    ELSE NULL END AS user_profile,
    -- Construct JSON object for agent if agent_id is not null
    CASE WHEN wm.agent_id IS NOT NULL THEN
      jsonb_build_object(
          'name', a.name
      )
    ELSE NULL END AS agent,
    -- Construct JSON object for team if team_id is not null
    CASE WHEN wm.team_id IS NOT NULL THEN
      jsonb_build_object(
          'name', t.name
      )
    ELSE NULL END AS team
  FROM
    public.workspace_members wm
    LEFT JOIN public.user_profiles up ON wm.user_id = up.id
    LEFT JOIN public.agents a ON wm.agent_id = a.id
    LEFT JOIN public.teams t ON wm.team_id = t.id
  WHERE
    wm.workspace_id = p_workspace_id;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_workspace_members_with_details(uuid) TO authenticated; 