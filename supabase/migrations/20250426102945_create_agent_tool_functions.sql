-- Migration to create Agent Tool database functions

-- Function for agents to get members of a specific chat room

-- Define a composite type to structure the return data
-- Use CREATE TYPE IF NOT EXISTS if supported or handle potential existence
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_member_details') THEN
        CREATE TYPE public.room_member_details AS (
            member_entry_id uuid,
            room_id uuid,
            member_type text,
            member_id uuid,
            added_at timestamptz,
            member_name text, -- Fetched name (user full_name, agent name, or team name)
            member_avatar_url text -- User avatar URL (null for agents/teams)
        );
    END IF;
END$$;


CREATE OR REPLACE FUNCTION public.get_room_members(p_room_id uuid)
RETURNS SETOF public.room_member_details
LANGUAGE sql
STABLE -- Function is read-only
SECURITY INVOKER
SET search_path = public
AS $$
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
    CROSS JOIN room_access
    WHERE crm.room_id = p_room_id
    AND room_access.has_access = true;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_room_members(uuid) TO authenticated;

-- Function for agents to list channels within a specific chat room
CREATE OR REPLACE FUNCTION public.list_room_channels(p_room_id uuid)
RETURNS SETOF public.chat_channels
LANGUAGE sql
STABLE
SECURITY INVOKER
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

-- Similarity function helper (cosine distance)
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
RETURNS SETOF public.chat_messages
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_query_embedding vector(1536);
    v_room_id uuid;
BEGIN
    SELECT room_id INTO v_room_id FROM chat_channels WHERE id = p_channel_id;

    IF NOT public.is_room_member(v_room_id, auth.uid()) THEN
        RAISE EXCEPTION 'User % is not a member of room %', auth.uid(), v_room_id;
        RETURN;
    END IF;

    IF p_search_type = 'semantic' THEN
        -- Semantic search logic needs embedding generation for p_search_query
        -- Placeholder: Fallback to text search for now
        RETURN QUERY
        SELECT cm.*
        FROM public.chat_messages cm
        WHERE cm.channel_id = p_channel_id
          AND cm.content ILIKE ('%' || p_search_query || '%')
        ORDER BY cm.created_at DESC
        LIMIT p_match_count;
    ELSE
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.search_chat_history(uuid, text, text, int, float) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_channel_messages(vector(1536), float, int, uuid) TO authenticated; 