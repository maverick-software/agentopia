-- Function to get chat messages with joined details

CREATE OR REPLACE FUNCTION public.get_chat_messages_with_details(p_channel_id uuid)
RETURNS TABLE (
    id uuid,
    channel_id uuid,
    sender_user_id uuid,
    sender_agent_id uuid,
    content text,
    metadata jsonb,
    embedding vector(1536), -- Assuming pgvector is installed and type exists
    created_at timestamptz,
    user_profile jsonb, -- Nested user profile data
    agent jsonb -- Nested agent data
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cm.id,
    cm.channel_id,
    cm.sender_user_id,
    cm.sender_agent_id,
    cm.content,
    cm.metadata,
    cm.embedding,
    cm.created_at,
    -- Construct JSON object for user profile if sender_user_id is not null
    CASE WHEN cm.sender_user_id IS NOT NULL THEN
      jsonb_build_object(
          'full_name', up.full_name,
          'avatar_url', up.avatar_url
      )
    ELSE NULL END AS user_profile,
    -- Construct JSON object for agent if sender_agent_id is not null
    CASE WHEN cm.sender_agent_id IS NOT NULL THEN
      jsonb_build_object(
          'name', a.name
      )
    ELSE NULL END AS agent
  FROM
    public.chat_messages cm
    LEFT JOIN public.user_profiles up ON cm.sender_user_id = up.id
    LEFT JOIN public.agents a ON cm.sender_agent_id = a.id
  WHERE
    cm.channel_id = p_channel_id
  ORDER BY
    cm.created_at ASC; -- Ensure consistent ordering
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_chat_messages_with_details(uuid) TO authenticated; 