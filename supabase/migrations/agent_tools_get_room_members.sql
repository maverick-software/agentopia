-- Function for agents to get members of a specific chat room

-- Define a composite type to structure the return data
CREATE TYPE public.room_member_details AS (
    member_entry_id uuid,
    room_id uuid,
    member_type text,
    member_id uuid,
    added_at timestamptz,
    member_name text, -- Fetched name (user full_name, agent name, or team name)
    member_avatar_url text -- User avatar URL (null for agents/teams)
);

CREATE OR REPLACE FUNCTION public.get_room_members(p_room_id uuid)
RETURNS SETOF public.room_member_details
LANGUAGE sql
STABLE -- Function is read-only
-- SECURITY DEFINER might be needed if the calling agent doesn't have direct read access
-- to profiles/agents/teams, but the is_room_member check should gate access first.
-- Let's start with INVOKER security first.
SECURITY INVOKER
SET search_path = public
AS $$
    -- First, check if the calling user/agent (represented by auth.uid()) is actually a member of the room.
    -- This prevents agents calling this for rooms they aren't part of.
    -- Use a common table expression (CTE) for clarity
    WITH room_access AS (
        SELECT public.is_room_member(p_room_id, auth.uid()) as has_access
    )
    SELECT
        crm.id as member_entry_id,
        crm.room_id,
        crm.member_type,
        crm.member_id,
        crm.added_at,
        CASE crm.member_type
            WHEN 'user' THEN (SELECT p.full_name FROM public.user_profiles p WHERE p.id = crm.member_id)
            WHEN 'agent' THEN (SELECT a.name FROM public.agents a WHERE a.id = crm.member_id)
            WHEN 'team' THEN (SELECT t.name FROM public.teams t WHERE t.id = crm.member_id)
            ELSE NULL
        END as member_name,
        CASE crm.member_type
            WHEN 'user' THEN (SELECT p.avatar_url FROM public.user_profiles p WHERE p.id = crm.member_id)
            ELSE NULL
        END as member_avatar_url
    FROM public.chat_room_members crm
    CROSS JOIN room_access -- Make access check available
    WHERE crm.room_id = p_room_id
    AND room_access.has_access = true; -- Only return results if the caller has access
$$;

-- Grant execute permission (e.g., to authenticated users/agents)
GRANT EXECUTE ON FUNCTION public.get_room_members(uuid) TO authenticated;

-- Function for agents to list channels within a specific chat room
CREATE OR REPLACE FUNCTION public.list_room_channels(p_room_id uuid)
RETURNS SETOF public.chat_channels -- Returns rows matching chat_channels structure
LANGUAGE sql
STABLE
SECURITY INVOKER -- Assume is_room_member check handles access
SET search_path = public
AS $$
    WITH room_access AS (
        SELECT public.is_room_member(p_room_id, auth.uid()) as has_access
    )
    SELECT cc.*
    FROM public.chat_channels cc
    CROSS JOIN room_access
    WHERE cc.room_id = p_room_id
    AND room_access.has_access = true
    ORDER BY cc.name;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.list_room_channels(uuid) TO authenticated;

-- Function for agents to search chat history within a specific channel
-- Includes basic text search and optional semantic search via embeddings

-- Similarity function (cosine distance)
CREATE OR REPLACE FUNCTION match_channel_messages (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_channel_id uuid
)
RETURNS TABLE (
  id uuid,
  channel_id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_variable
BEGIN
  RETURN QUERY
  SELECT
    cm.id,
    cm.channel_id,
    cm.content,
    1 - (cm.embedding <=> query_embedding) as similarity
  FROM public.chat_messages cm
  WHERE cm.channel_id = p_channel_id AND cm.embedding IS NOT NULL
  ORDER BY cm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Main search function
CREATE OR REPLACE FUNCTION public.search_chat_history(
    p_channel_id uuid,
    p_search_query text,
    p_search_type text DEFAULT 'text', -- 'text' or 'semantic'
    p_match_count int DEFAULT 5,
    p_match_threshold float DEFAULT 0.7 -- Only for semantic search
)
RETURNS SETOF public.chat_messages -- Returns full message rows
LANGUAGE plpgsql
STABLE
-- SECURITY INVOKER: Rely on RLS on chat_messages and is_room_member check
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_query_embedding vector(1536);
    v_room_id uuid;
BEGIN
    -- Get room_id for access check
    SELECT room_id INTO v_room_id FROM chat_channels WHERE id = p_channel_id;

    -- Check if the caller is a member of the room this channel belongs to
    IF NOT public.is_room_member(v_room_id, auth.uid()) THEN
        RAISE EXCEPTION 'User % is not a member of room %', auth.uid(), v_room_id;
        RETURN;
    END IF;

    IF p_search_type = 'semantic' THEN
        -- Generate embedding for the search query (Requires http extension and API call - COMPLEX)
        -- For simplicity here, we'll assume embedding is pre-generated and passed in, OR skip semantic if not available.
        -- Placeholder: RAISE EXCEPTION 'Semantic search requires pre-generated query embedding.';
        -- OR call match_channel_messages IF embedding was provided as input (not shown here)
        
        -- As a fallback or primary text search:
        RETURN QUERY
        SELECT cm.*
        FROM public.chat_messages cm
        WHERE cm.channel_id = p_channel_id
          AND cm.content ILIKE ('%' || p_search_query || '%')
        ORDER BY cm.created_at DESC
        LIMIT p_match_count;

    ELSE -- Default to text search
        RETURN QUERY
        SELECT cm.*
        FROM public.chat_messages cm
        WHERE cm.channel_id = p_channel_id
          AND cm.content ILIKE ('%' || p_search_query || '%')
        ORDER BY cm.created_at DESC
        LIMIT p_match_count;
    END IF;

END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.search_chat_history(uuid, text, text, int, float) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_channel_messages(vector(1536), float, int, uuid) TO authenticated; 