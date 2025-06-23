

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE TYPE "public"."account_tool_environment_status_enum" AS ENUM (
    'inactive',
    'pending_creation',
    'creating',
    'active',
    'error_creation',
    'pending_deletion',
    'deleting',
    'error_deletion',
    'unresponsive',
    'scaling'
);


ALTER TYPE "public"."account_tool_environment_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."account_tool_installation_status_enum" AS ENUM (
    'pending_install',
    'installing',
    'active',
    'error_install',
    'pending_uninstall',
    'uninstalling',
    'uninstalled',
    'error_uninstall',
    'pending_config',
    'stopped',
    'starting',
    'stopping',
    'error_runtime',
    'disabled'
);


ALTER TYPE "public"."account_tool_installation_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."catalog_tool_status_enum" AS ENUM (
    'available',
    'beta',
    'experimental',
    'deprecated',
    'archived'
);


ALTER TYPE "public"."catalog_tool_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."chat_member_type" AS ENUM (
    'user',
    'agent',
    'team'
);


ALTER TYPE "public"."chat_member_type" OWNER TO "postgres";


CREATE TYPE "public"."droplet_status_enum" AS ENUM (
    'pending_creation',
    'creating',
    'active',
    'error_creation',
    'pending_deletion',
    'deleting',
    'deleted',
    'error_deletion',
    'unresponsive'
);


ALTER TYPE "public"."droplet_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."room_member_details" AS (
	"member_entry_id" "uuid",
	"room_id" "uuid",
	"member_type" "text",
	"member_id" "uuid",
	"added_at" timestamp with time zone,
	"member_name" "text",
	"member_avatar_url" "text"
);


ALTER TYPE "public"."room_member_details" OWNER TO "postgres";


CREATE TYPE "public"."tool_installation_status_enum" AS ENUM (
    'pending_install',
    'installing',
    'active',
    'error_install',
    'pending_uninstall',
    'uninstalling',
    'uninstalled',
    'error_uninstall',
    'pending_config',
    'stopped',
    'starting',
    'stopping',
    'error_runtime',
    'disabled'
);


ALTER TYPE "public"."tool_installation_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."tool_packaging_type_enum" AS ENUM (
    'docker_image'
);


ALTER TYPE "public"."tool_packaging_type_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_chat_room_members"("p_room_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    -- Check if user is the chat_room owner
    SELECT 1
    FROM public.chat_rooms w -- Check chat_rooms table
    WHERE w.id = p_room_id AND w.owner_user_id = p_user_id
    UNION ALL
    -- Check if user is a direct member with the 'moderator' role
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = p_room_id 
      AND wm.user_id = p_user_id 
      AND wm.role = 'moderator'
  );
$$;


ALTER FUNCTION "public"."can_manage_chat_room_members"("p_room_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_workspace_members"("p_workspace_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.id = p_workspace_id AND w.owner_user_id = p_user_id
    UNION ALL
    SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = p_workspace_id AND wm.user_id = p_user_id AND wm.role = 'moderator' -- Or other managing roles
  );
$$;


ALTER FUNCTION "public"."can_manage_workspace_members"("p_workspace_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_chat_messages_with_details"("p_channel_id" "uuid") RETURNS TABLE("id" "uuid", "channel_id" "uuid", "sender_user_id" "uuid", "sender_agent_id" "uuid", "content" "text", "metadata" "jsonb", "embedding" "public"."vector", "created_at" timestamp with time zone, "user_profile" "jsonb", "agent" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_chat_messages_with_details"("p_channel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_claim"("claim_name" "text") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> claim_name;
$$;


ALTER FUNCTION "public"."get_my_claim"("claim_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_my_claim"("claim_name" "text") IS 'Retrieves a specific text claim from the current session''s JWT claims.';



CREATE OR REPLACE FUNCTION "public"."get_room_id_for_channel"("p_channel_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT room_id
  FROM chat_channels
  WHERE id = p_channel_id;
$$;


ALTER FUNCTION "public"."get_room_id_for_channel"("p_channel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_room_members"("p_room_id" "uuid") RETURNS SETOF "public"."room_member_details"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_room_members"("p_room_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_team_id_for_channel"("p_channel_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_room_id uuid;
  v_team_id uuid;
BEGIN
  -- Get room_id from channel
  SELECT room_id INTO v_room_id
  FROM public.chat_channels
  WHERE id = p_channel_id;

  -- Get team_id from room
  IF v_room_id IS NOT NULL THEN
    SELECT team_id INTO v_team_id
    FROM public.chat_rooms
    WHERE id = v_room_id;
  END IF;

  RETURN v_team_id;
END;
$$;


ALTER FUNCTION "public"."get_team_id_for_channel"("p_channel_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "context_window_size" integer DEFAULT 20 NOT NULL,
    "context_window_token_limit" integer DEFAULT 8000 NOT NULL,
    CONSTRAINT "chat_rooms_name_check" CHECK (("char_length"("name") > 0))
);

ALTER TABLE ONLY "public"."workspaces" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


COMMENT ON TABLE "public"."workspaces" IS 'Top-level container for chat channels and members, similar to a Discord server.';



COMMENT ON COLUMN "public"."workspaces"."id" IS 'Unique identifier for the chat room.';



COMMENT ON COLUMN "public"."workspaces"."name" IS 'User-defined name for the chat room.';



COMMENT ON COLUMN "public"."workspaces"."owner_user_id" IS 'The user who created and owns the chat room.';



COMMENT ON COLUMN "public"."workspaces"."created_at" IS 'Timestamp when the chat room was created.';



COMMENT ON COLUMN "public"."workspaces"."context_window_size" IS 'Maximum number of recent messages to include in the context for agents in this workspace.';



COMMENT ON COLUMN "public"."workspaces"."context_window_token_limit" IS 'Maximum number of tokens allowed in the context window sent to agents.';



CREATE OR REPLACE FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid") RETURNS SETOF "public"."workspaces"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT cr.*
  FROM public.chat_rooms cr
  WHERE public.is_room_member(cr.id, p_user_id); -- Filter rooms using the helper
$$;


ALTER FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_workspace_id_for_channel"("p_channel_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id
  FROM public.chat_channels
  WHERE id = p_channel_id;
  RETURN v_workspace_id;
END;
$$;


ALTER FUNCTION "public"."get_workspace_id_for_channel"("p_channel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_workspace_members_with_details"("p_workspace_id" "uuid") RETURNS TABLE("id" "uuid", "role" "text", "created_at" timestamp with time zone, "workspace_id" "uuid", "user_id" "uuid", "agent_id" "uuid", "team_id" "uuid", "user_profile" "jsonb", "agent" "jsonb", "team" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_workspace_members_with_details"("p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Use the new table name here
  INSERT INTO public.user_profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_key_generation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'extensions', 'public'
    AS $$
DECLARE
  generated_key_bytes bytea;
  generated_key_base64 text;
BEGIN
  -- Generate 32 random bytes using pgcrypto from the extensions schema
  generated_key_bytes := extensions.gen_random_bytes(32);

  -- Encode the bytes as base64 for text storage
  generated_key_base64 := encode(generated_key_bytes, 'base64');

  -- Insert the key into the user_secrets table
  INSERT INTO public.user_secrets (user_id, encryption_key)
  VALUES (NEW.id, generated_key_base64);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_key_generation"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user_key_generation"() IS 'Trigger function to generate a unique encryption key (using pgcrypto from extensions schema) and store it.';



CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_agent_owner"("agent_id_to_check" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM agents
    WHERE id = agent_id_to_check AND user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_agent_owner"("agent_id_to_check" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_chat_room_member"("p_room_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    -- Check if user is a direct member
    SELECT 1
    FROM public.workspace_members wm -- Use workspace_members table
    WHERE wm.workspace_id = p_room_id AND wm.user_id = p_user_id
    UNION ALL
    -- Check if user is a member of a team that is a member of the workspace
    SELECT 1
    FROM public.workspace_members wm_teams -- Use workspace_members table
    JOIN public.user_team_memberships utm ON wm_teams.team_id = utm.team_id
    WHERE wm_teams.workspace_id = p_room_id AND utm.user_id = p_user_id
    -- TODO: Consider if agent ownership implies membership? For now, no.
  );
$$;


ALTER FUNCTION "public"."is_chat_room_member"("p_room_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_global_admin"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id AND r.name = 'admin'
  ) INTO is_admin;
  RETURN is_admin;
END;
$$;


ALTER FUNCTION "public"."is_global_admin"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_room_member"("p_room_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT EXISTS (
        -- Direct user membership
        SELECT 1
        FROM chat_room_members crm_user
        WHERE crm_user.room_id = p_room_id
          AND crm_user.member_type = 'user'
          AND crm_user.member_id = p_user_id

        UNION ALL

        -- Team membership (user is in a team via user_team_memberships, and that team is in chat_room_members)
        SELECT 1
        FROM chat_room_members crm_team
        JOIN user_team_memberships utm ON crm_team.member_id = utm.team_id -- Join based on team_id
        WHERE crm_team.room_id = p_room_id
          AND crm_team.member_type = 'team' -- Ensure we are looking at a team membership in the room
          AND utm.user_id = p_user_id -- Check if the calling user is in that team
    );
$$;


ALTER FUNCTION "public"."is_room_member"("p_room_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_admin_or_pm"("p_team_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  is_admin_or_pm boolean;
BEGIN
  -- Check if the user owns an agent in the team with role 'project_manager' (or potentially 'admin')
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.agents a ON tm.agent_id = a.id
    WHERE tm.team_id = p_team_id
      AND a.user_id = p_user_id
      AND tm.team_role IN ('project_manager') -- Add 'admin' here if you define such a team role
  ) INTO is_admin_or_pm;
  RETURN is_admin_or_pm;
END;
$$;


ALTER FUNCTION "public"."is_team_admin_or_pm"("p_team_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_member"("p_team_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  is_member boolean;
BEGIN
  -- Check if the user owns any agent that is part of the team
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.agents a ON tm.agent_id = a.id
    WHERE tm.team_id = p_team_id AND a.user_id = p_user_id
  ) INTO is_member;
  RETURN is_member;
END;
$$;


ALTER FUNCTION "public"."is_team_member"("p_team_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_owner"("p_team_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  is_owner boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.teams t
    WHERE t.id = p_team_id AND t.owner_user_id = p_user_id
  ) INTO is_owner;
  RETURN is_owner;
END;
$$;


ALTER FUNCTION "public"."is_team_owner"("p_team_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_workspace_member"("p_workspace_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    -- Check if user is directly a member
    SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = p_workspace_id AND wm.user_id = p_user_id
    UNION ALL
    -- Check if user is a member of a team that is a member of the workspace
    SELECT 1 
    FROM public.workspace_members wm_teams 
    JOIN public.user_team_memberships utm ON wm_teams.team_id = utm.team_id 
    WHERE wm_teams.workspace_id = p_workspace_id AND utm.user_id = p_user_id
    UNION ALL
    -- Check if user is the owner of the workspace (owners should implicitly be members for RLS checks)
    SELECT 1 
    FROM public.workspaces w
    WHERE w.id = p_workspace_id AND w.owner_user_id = p_user_id
  );
$$;


ALTER FUNCTION "public"."is_workspace_member"("p_workspace_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_workspace_owner"("p_workspace_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT owner_user_id INTO v_owner_id
  FROM public.workspaces
  WHERE id = p_workspace_id;
  RETURN v_owner_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."is_workspace_owner"("p_workspace_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "topic" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_at" timestamp with time zone,
    CONSTRAINT "chat_channels_name_check" CHECK (("char_length"("name") > 0))
);

ALTER TABLE ONLY "public"."chat_channels" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_channels" OWNER TO "postgres";


COMMENT ON TABLE "public"."chat_channels" IS 'Represents individual channels within a chat room, similar to Discord channels.';



COMMENT ON COLUMN "public"."chat_channels"."id" IS 'Unique identifier for the channel.';



COMMENT ON COLUMN "public"."chat_channels"."workspace_id" IS 'The chat room this channel belongs to.';



COMMENT ON COLUMN "public"."chat_channels"."name" IS 'Name of the channel (e.g., #general, #random).';



COMMENT ON COLUMN "public"."chat_channels"."topic" IS 'Optional topic description for the channel.';



COMMENT ON COLUMN "public"."chat_channels"."created_at" IS 'Timestamp when the channel was created.';



COMMENT ON COLUMN "public"."chat_channels"."last_message_at" IS 'Timestamp of the last message sent in this channel (for sorting).';



CREATE OR REPLACE FUNCTION "public"."list_room_channels"("p_room_id" "uuid") RETURNS SETOF "public"."chat_channels"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."list_room_channels"("p_room_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_channel_messages"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_channel_id" "uuid") RETURNS TABLE("id" "uuid", "channel_id" "uuid", "content" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."match_channel_messages"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_channel_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid",
    "sender_agent_id" "uuid",
    "sender_user_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "embedding" "public"."vector"(1536),
    "metadata" "jsonb",
    CONSTRAINT "chat_messages_content_check" CHECK (("char_length"("content") > 0)),
    CONSTRAINT "chk_sender_not_null" CHECK ((("sender_agent_id" IS NOT NULL) OR ("sender_user_id" IS NOT NULL)))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."chat_messages" IS 'Stores individual messages within chat sessions.';



COMMENT ON COLUMN "public"."chat_messages"."id" IS 'Unique identifier for the message.';



COMMENT ON COLUMN "public"."chat_messages"."channel_id" IS 'The chat session this message belongs to.';



COMMENT ON COLUMN "public"."chat_messages"."sender_agent_id" IS 'The agent that sent the message (if applicable).';



COMMENT ON COLUMN "public"."chat_messages"."sender_user_id" IS 'The user that sent the message (if applicable).';



COMMENT ON COLUMN "public"."chat_messages"."content" IS 'The textual content of the message.';



COMMENT ON COLUMN "public"."chat_messages"."created_at" IS 'Timestamp when the message was created.';



COMMENT ON COLUMN "public"."chat_messages"."embedding" IS 'Vector embedding of the message content.';



COMMENT ON COLUMN "public"."chat_messages"."metadata" IS 'JSONB field for storing arbitrary metadata, e.g., mentions.';



CREATE OR REPLACE FUNCTION "public"."search_chat_history"("p_channel_id" "uuid", "p_search_query" "text", "p_search_type" "text" DEFAULT 'text'::"text", "p_match_count" integer DEFAULT 5, "p_match_threshold" double precision DEFAULT 0.7) RETURNS SETOF "public"."chat_messages"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."search_chat_history"("p_channel_id" "uuid", "p_search_query" "text", "p_search_type" "text", "p_match_count" integer, "p_match_threshold" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_team_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.owner_user_id = auth.uid();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_team_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_channel_last_message_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE public.chat_channels
    SET last_message_at = NEW.created_at
    WHERE id = NEW.channel_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_channel_last_message_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_worker_status"("connection_id_in" "uuid", "new_status_in" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.agent_discord_connections
  SET worker_status = new_status_in
  WHERE id = connection_id_in;
END;
$$;


ALTER FUNCTION "public"."update_worker_status"("connection_id_in" "uuid", "new_status_in" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_role"("user_id" "uuid", "role_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
    has_role boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1 AND r.name = $2
    ) INTO has_role;
    RETURN has_role;
END;
$_$;


ALTER FUNCTION "public"."user_has_role"("user_id" "uuid", "role_name" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."account_tool_environment_active_tools" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_tool_environment_id" "uuid" NOT NULL,
    "tool_catalog_id" "uuid" NOT NULL,
    "status" "public"."account_tool_installation_status_enum" DEFAULT 'pending_install'::"public"."account_tool_installation_status_enum" NOT NULL,
    "version_to_install" "text" DEFAULT 'latest'::"text" NOT NULL,
    "actual_installed_version" "text",
    "config_values" "jsonb" DEFAULT '{}'::"jsonb",
    "runtime_details" "jsonb" DEFAULT '{}'::"jsonb",
    "error_message" "text",
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."account_tool_environment_active_tools" OWNER TO "postgres";


COMMENT ON TABLE "public"."account_tool_environment_active_tools" IS 'Tracks tools that are installed or active on a user account''s shared tool environment.';



COMMENT ON COLUMN "public"."account_tool_environment_active_tools"."account_tool_environment_id" IS 'The ID of the account tool environment.';



COMMENT ON COLUMN "public"."account_tool_environment_active_tools"."tool_catalog_id" IS 'The ID of the tool from the tool catalog.';



COMMENT ON COLUMN "public"."account_tool_environment_active_tools"."status" IS 'The current status of the tool installation.';



COMMENT ON COLUMN "public"."account_tool_environment_active_tools"."version_to_install" IS 'The version of the tool to install.';



COMMENT ON COLUMN "public"."account_tool_environment_active_tools"."actual_installed_version" IS 'The actual installed version of the tool.';



COMMENT ON COLUMN "public"."account_tool_environment_active_tools"."config_values" IS 'The configuration values for the tool.';



COMMENT ON COLUMN "public"."account_tool_environment_active_tools"."runtime_details" IS 'Runtime details for the tool.';



COMMENT ON COLUMN "public"."account_tool_environment_active_tools"."error_message" IS 'Error message related to the tool installation.';



COMMENT ON COLUMN "public"."account_tool_environment_active_tools"."enabled" IS 'Indicates whether the tool is enabled.';



COMMENT ON COLUMN "public"."account_tool_environment_active_tools"."created_at" IS 'Timestamp when the tool installation record was created.';



COMMENT ON COLUMN "public"."account_tool_environment_active_tools"."updated_at" IS 'Timestamp when the tool installation record was last updated.';



CREATE TABLE IF NOT EXISTS "public"."account_tool_environments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "do_droplet_id" bigint,
    "ip_address" "inet",
    "status" "public"."account_tool_environment_status_enum" DEFAULT 'inactive'::"public"."account_tool_environment_status_enum" NOT NULL,
    "region_slug" "text" NOT NULL,
    "size_slug" "text" NOT NULL,
    "image_slug" "text" NOT NULL,
    "last_heartbeat_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."account_tool_environments" OWNER TO "postgres";


COMMENT ON TABLE "public"."account_tool_environments" IS 'Stores information about shared DigitalOcean Droplets provisioned for a user account''s tool environment.';



COMMENT ON COLUMN "public"."account_tool_environments"."user_id" IS 'The user account this tool environment belongs to.';



COMMENT ON COLUMN "public"."account_tool_environments"."do_droplet_id" IS 'The DigitalOcean ID of the provisioned droplet.';



COMMENT ON COLUMN "public"."account_tool_environments"."status" IS 'The current status of the account tool environment.';



COMMENT ON COLUMN "public"."account_tool_environments"."last_heartbeat_at" IS 'Timestamp of the last successful contact from the DTMA on this environment.';



CREATE TABLE IF NOT EXISTS "public"."agent_datastores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "datastore_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_datastores" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_datastores" IS 'Junction table connecting agents to their associated datastores';



CREATE TABLE IF NOT EXISTS "public"."agent_discord_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "guild_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "discord_app_id" "text" NOT NULL,
    "inactivity_timeout_minutes" integer DEFAULT 10,
    "worker_status" "text" DEFAULT 'inactive'::"text",
    "discord_public_key" "text" NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL
);

ALTER TABLE ONLY "public"."agent_discord_connections" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_discord_connections" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_discord_connections" IS 'Stores the specific Discord channels an agent is connected to.';



COMMENT ON COLUMN "public"."agent_discord_connections"."guild_id" IS 'Discord Server ID the agent connection is linked to (can be NULL initially).';



CREATE TABLE IF NOT EXISTS "public"."agent_droplet_tools" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_droplet_id" "uuid" NOT NULL,
    "tool_catalog_id" "uuid" NOT NULL,
    "version_to_install" "text" NOT NULL,
    "actual_installed_version" "text",
    "status" "public"."tool_installation_status_enum" DEFAULT 'pending_install'::"public"."tool_installation_status_enum" NOT NULL,
    "config_values" "jsonb" DEFAULT '{}'::"jsonb",
    "runtime_details" "jsonb" DEFAULT '{}'::"jsonb",
    "error_message" "text",
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_droplet_tools" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_droplets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "do_droplet_id" bigint,
    "ip_address" "inet",
    "status" "public"."droplet_status_enum" DEFAULT 'pending_creation'::"public"."droplet_status_enum" NOT NULL,
    "region_slug" "text" NOT NULL,
    "size_slug" "text" NOT NULL,
    "image_slug" "text" NOT NULL,
    "do_created_at" timestamp with time zone,
    "last_heartbeat_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "tags" "text"[],
    "configuration" "jsonb",
    "dtma_auth_token" "text",
    "dtma_last_known_version" "text",
    "dtma_last_reported_status" "jsonb"
);


ALTER TABLE "public"."agent_droplets" OWNER TO "postgres";


COMMENT ON COLUMN "public"."agent_droplets"."name" IS 'The name of the droplet assigned during creation, usually includes agent ID.';



COMMENT ON COLUMN "public"."agent_droplets"."tags" IS 'Tags applied to the droplet in DigitalOcean, also stored for reference.';



COMMENT ON COLUMN "public"."agent_droplets"."configuration" IS 'Configuration used to provision the droplet (region, size, image, etc.).';



COMMENT ON COLUMN "public"."agent_droplets"."dtma_auth_token" IS 'Secure authentication token for the Droplet Tool Management Agent to communicate with the backend.';



COMMENT ON COLUMN "public"."agent_droplets"."dtma_last_known_version" IS 'Last reported version of the DTMA software running on the droplet.';



COMMENT ON COLUMN "public"."agent_droplets"."dtma_last_reported_status" IS 'Last reported detailed status payload from the DTMA heartbeat.';



CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "discord_channel" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "discord_bot_key" "text",
    "system_instructions" "text",
    "assistant_instructions" "text",
    "discord_bot_token_encrypted" "text",
    "discord_user_id" "text",
    "discord_bot_token_id" "text",
    "active" boolean DEFAULT false,
    "personality" "text",
    "avatar_url" "text"
);

ALTER TABLE ONLY "public"."agents" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."agents" OWNER TO "postgres";


COMMENT ON COLUMN "public"."agents"."discord_bot_token_encrypted" IS 'Stores the Discord bot token, encrypted server-side.';



COMMENT ON COLUMN "public"."agents"."active" IS 'Indicates if the agent is generally considered active/enabled by the user.';



CREATE TABLE IF NOT EXISTS "public"."datastores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "type" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "similarity_metric" "text" DEFAULT 'cosine'::"text",
    "similarity_threshold" double precision DEFAULT 0.7,
    "max_results" integer DEFAULT 5,
    CONSTRAINT "datastores_max_results_check" CHECK (("max_results" > 0)),
    CONSTRAINT "datastores_similarity_metric_check" CHECK (("similarity_metric" = ANY (ARRAY['cosine'::"text", 'euclidean'::"text", 'dot'::"text"]))),
    CONSTRAINT "datastores_similarity_threshold_check" CHECK ((("similarity_threshold" >= (0)::double precision) AND ("similarity_threshold" <= (1)::double precision))),
    CONSTRAINT "datastores_type_check" CHECK (("type" = ANY (ARRAY['pinecone'::"text", 'getzep'::"text"])))
);


ALTER TABLE "public"."datastores" OWNER TO "postgres";


COMMENT ON TABLE "public"."datastores" IS 'Stores configuration for vector and knowledge graph datastores';



COMMENT ON COLUMN "public"."datastores"."similarity_metric" IS 'Similarity metric to use for vector search (cosine, euclidean, dot)';



COMMENT ON COLUMN "public"."datastores"."similarity_threshold" IS 'Minimum similarity score threshold (0-1)';



COMMENT ON COLUMN "public"."datastores"."max_results" IS 'Maximum number of results to return from similarity search';



CREATE TABLE IF NOT EXISTS "public"."mcp_configurations" (
    "id" integer NOT NULL,
    "agent_id" "uuid",
    "is_enabled" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."mcp_configurations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mcp_configurations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mcp_configurations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mcp_configurations_id_seq" OWNED BY "public"."mcp_configurations"."id";



CREATE TABLE IF NOT EXISTS "public"."mcp_servers" (
    "id" integer NOT NULL,
    "config_id" integer,
    "name" character varying(255) NOT NULL,
    "endpoint_url" "text" NOT NULL,
    "vault_api_key_id" "uuid",
    "timeout_ms" integer DEFAULT 5000,
    "max_retries" integer DEFAULT 3,
    "retry_backoff_ms" integer DEFAULT 1000,
    "priority" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "capabilities" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_servers_max_retries_check" CHECK (("max_retries" >= 0)),
    CONSTRAINT "mcp_servers_retry_backoff_ms_check" CHECK (("retry_backoff_ms" >= 0)),
    CONSTRAINT "mcp_servers_timeout_ms_check" CHECK (("timeout_ms" >= 0))
);


ALTER TABLE "public"."mcp_servers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mcp_servers_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mcp_servers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mcp_servers_id_seq" OWNED BY "public"."mcp_servers"."id";



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "mobile" "text",
    "company_name" "text",
    "title" "text",
    "usage_reason" "jsonb",
    "hopes_goals" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."roles" IS 'Stores user roles (e.g., admin, user)';



COMMENT ON COLUMN "public"."roles"."name" IS 'Unique name of the role';



CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "team_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "team_role" "text",
    "team_role_description" "text",
    "reports_to_agent_id" "uuid",
    "reports_to_user" boolean DEFAULT false NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_one_report_target" CHECK (((("reports_to_agent_id" IS NOT NULL) AND ("reports_to_user" = false)) OR (("reports_to_agent_id" IS NULL) AND ("reports_to_user" = true)) OR (("reports_to_agent_id" IS NULL) AND ("reports_to_user" = false)))),
    CONSTRAINT "chk_reports_to_not_self" CHECK (("agent_id" <> "reports_to_agent_id")),
    CONSTRAINT "team_members_team_role_check" CHECK (("char_length"("team_role") > 0))
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."team_members" IS 'Links Agents to Teams and defines their role/reporting structure within the team.';



COMMENT ON COLUMN "public"."team_members"."team_id" IS 'Foreign key referencing the team.';



COMMENT ON COLUMN "public"."team_members"."agent_id" IS 'The agent who is a member of the team.';



COMMENT ON COLUMN "public"."team_members"."team_role" IS 'The role of the agent within the team.';



COMMENT ON COLUMN "public"."team_members"."team_role_description" IS 'User-defined description of the agent''s specific duties on this team.';



COMMENT ON COLUMN "public"."team_members"."reports_to_agent_id" IS 'Optional: The agent this team member reports to.';



COMMENT ON COLUMN "public"."team_members"."reports_to_user" IS 'Indicates if this agent reports directly to the user for this team.';



COMMENT ON COLUMN "public"."team_members"."joined_at" IS 'Timestamp when the agent joined the team.';



CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_user_id" "uuid",
    CONSTRAINT "teams_name_check" CHECK (("char_length"("name") > 0))
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


COMMENT ON TABLE "public"."teams" IS 'Stores information about agent teams.';



COMMENT ON COLUMN "public"."teams"."id" IS 'Unique identifier for the team.';



COMMENT ON COLUMN "public"."teams"."name" IS 'Display name of the team.';



COMMENT ON COLUMN "public"."teams"."description" IS 'Optional description of the team''s purpose or focus.';



COMMENT ON COLUMN "public"."teams"."created_at" IS 'Timestamp when the team was created.';



COMMENT ON COLUMN "public"."teams"."updated_at" IS 'Timestamp when the team was last updated.';



COMMENT ON COLUMN "public"."teams"."owner_user_id" IS 'The user (from auth.users) who originally created the team.';



CREATE TABLE IF NOT EXISTS "public"."tool_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tool_name" "text" NOT NULL,
    "description" "text",
    "developer_org_name" "text",
    "categories" "text"[],
    "icon_url" "text",
    "documentation_url" "text",
    "packaging_type" "public"."tool_packaging_type_enum" DEFAULT 'docker_image'::"public"."tool_packaging_type_enum" NOT NULL,
    "package_identifier" "text" NOT NULL,
    "version_info" "jsonb" DEFAULT '{"default_version": "latest", "available_versions": ["latest"]}'::"jsonb" NOT NULL,
    "default_config_template" "jsonb" DEFAULT '{}'::"jsonb",
    "required_secrets_schema" "jsonb" DEFAULT '[]'::"jsonb",
    "resource_requirements" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "public"."catalog_tool_status_enum" DEFAULT 'available'::"public"."catalog_tool_status_enum" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tool_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "full_name" "text",
    "avatar_url" "text",
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_profiles" IS 'Stores public profile information for users, linked to auth.users';



COMMENT ON COLUMN "public"."user_profiles"."id" IS 'References auth.users.id';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_roles" IS 'Links users to their assigned roles.';



CREATE TABLE IF NOT EXISTS "public"."user_secrets" (
    "user_id" "uuid" NOT NULL,
    "encryption_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."user_secrets" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_secrets" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_secrets" IS 'Stores per-user encryption keys for sensitive data like bot tokens.';



COMMENT ON COLUMN "public"."user_secrets"."user_id" IS 'Foreign key referencing the user in auth.users.';



COMMENT ON COLUMN "public"."user_secrets"."encryption_key" IS 'Base64 encoded 32-byte encryption key specific to the user.';



CREATE TABLE IF NOT EXISTS "public"."user_team_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_team_memberships" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_team_memberships" IS 'Associates users with teams.';



COMMENT ON COLUMN "public"."user_team_memberships"."user_id" IS 'Foreign key referencing the user.';



COMMENT ON COLUMN "public"."user_team_memberships"."team_id" IS 'Foreign key referencing the team.';



COMMENT ON COLUMN "public"."user_team_memberships"."joined_at" IS 'Timestamp when the user joined the team.';



CREATE TABLE IF NOT EXISTS "public"."workspace_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "agent_id" "uuid",
    "team_id" "uuid",
    "user_id" "uuid",
    "role" "text" DEFAULT 'member'::"text",
    "added_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_one_member_type" CHECK (("num_nonnulls"("agent_id", "team_id", "user_id") = 1))
);

ALTER TABLE ONLY "public"."workspace_members" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_members" OWNER TO "postgres";


ALTER TABLE ONLY "public"."mcp_configurations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mcp_configurations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mcp_servers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mcp_servers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."account_tool_environment_active_tools"
    ADD CONSTRAINT "account_tool_environment_active_tools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."account_tool_environments"
    ADD CONSTRAINT "account_tool_environments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."account_tool_environments"
    ADD CONSTRAINT "account_tool_environments_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."agent_datastores"
    ADD CONSTRAINT "agent_datastores_agent_id_datastore_id_key" UNIQUE ("agent_id", "datastore_id");



ALTER TABLE ONLY "public"."agent_datastores"
    ADD CONSTRAINT "agent_datastores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_discord_connections"
    ADD CONSTRAINT "agent_discord_connections_agent_id_unique" UNIQUE ("agent_id");



ALTER TABLE ONLY "public"."agent_discord_connections"
    ADD CONSTRAINT "agent_discord_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_droplet_tools"
    ADD CONSTRAINT "agent_droplet_tools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_droplets"
    ADD CONSTRAINT "agent_droplets_agent_id_key" UNIQUE ("agent_id");



ALTER TABLE ONLY "public"."agent_droplets"
    ADD CONSTRAINT "agent_droplets_do_droplet_id_key" UNIQUE ("do_droplet_id");



ALTER TABLE ONLY "public"."agent_droplets"
    ADD CONSTRAINT "agent_droplets_dtma_auth_token_key" UNIQUE ("dtma_auth_token");



ALTER TABLE ONLY "public"."agent_droplets"
    ADD CONSTRAINT "agent_droplets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_channels"
    ADD CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."datastores"
    ADD CONSTRAINT "datastores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mcp_configurations"
    ADD CONSTRAINT "mcp_configurations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mcp_servers"
    ADD CONSTRAINT "mcp_servers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("team_id", "agent_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tool_catalog"
    ADD CONSTRAINT "tool_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tool_catalog"
    ADD CONSTRAINT "tool_catalog_tool_name_key" UNIQUE ("tool_name");



ALTER TABLE ONLY "public"."user_team_memberships"
    ADD CONSTRAINT "unique_user_team_membership" UNIQUE ("user_id", "team_id");



COMMENT ON CONSTRAINT "unique_user_team_membership" ON "public"."user_team_memberships" IS 'Ensures a user cannot be added multiple times to the same team.';



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "unique_workspace_agent" UNIQUE ("workspace_id", "agent_id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "unique_workspace_team" UNIQUE ("workspace_id", "team_id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "unique_workspace_user" UNIQUE ("workspace_id", "user_id");



ALTER TABLE ONLY "public"."account_tool_environment_active_tools"
    ADD CONSTRAINT "uq_account_env_tool" UNIQUE ("account_tool_environment_id", "tool_catalog_id");



ALTER TABLE ONLY "public"."account_tool_environments"
    ADD CONSTRAINT "uq_do_droplet_id" UNIQUE ("do_droplet_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id");



ALTER TABLE ONLY "public"."user_secrets"
    ADD CONSTRAINT "user_secrets_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_team_memberships"
    ADD CONSTRAINT "user_team_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_agent_datastores_agent_id" ON "public"."agent_datastores" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_datastores_datastore_id" ON "public"."agent_datastores" USING "btree" ("datastore_id");



CREATE INDEX "idx_agent_discord_connections_agent_id" ON "public"."agent_discord_connections" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_discord_connections_guild_id" ON "public"."agent_discord_connections" USING "btree" ("guild_id");



CREATE INDEX "idx_agent_droplet_tools_agent_droplet_id" ON "public"."agent_droplet_tools" USING "btree" ("agent_droplet_id");



CREATE INDEX "idx_agent_droplet_tools_status" ON "public"."agent_droplet_tools" USING "btree" ("status");



CREATE INDEX "idx_agent_droplet_tools_tool_catalog_id" ON "public"."agent_droplet_tools" USING "btree" ("tool_catalog_id");



CREATE INDEX "idx_agent_droplets_agent_id" ON "public"."agent_droplets" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_droplets_do_droplet_id" ON "public"."agent_droplets" USING "btree" ("do_droplet_id");



CREATE INDEX "idx_agent_droplets_status" ON "public"."agent_droplets" USING "btree" ("status");



CREATE INDEX "idx_agents_created_at" ON "public"."agents" USING "btree" ("created_at");



CREATE INDEX "idx_agents_user_id" ON "public"."agents" USING "btree" ("user_id");



CREATE INDEX "idx_ate_status" ON "public"."account_tool_environments" USING "btree" ("status");



CREATE INDEX "idx_ate_user_id" ON "public"."account_tool_environments" USING "btree" ("user_id");



CREATE INDEX "idx_ateat_account_tool_environment_id" ON "public"."account_tool_environment_active_tools" USING "btree" ("account_tool_environment_id");



CREATE INDEX "idx_ateat_status" ON "public"."account_tool_environment_active_tools" USING "btree" ("status");



CREATE INDEX "idx_ateat_tool_catalog_id" ON "public"."account_tool_environment_active_tools" USING "btree" ("tool_catalog_id");



CREATE INDEX "idx_chat_channels_last_message_at" ON "public"."chat_channels" USING "btree" ("last_message_at" DESC NULLS LAST);



CREATE INDEX "idx_chat_channels_room_id" ON "public"."chat_channels" USING "btree" ("workspace_id");



CREATE INDEX "idx_chat_messages_channel_id_created_at" ON "public"."chat_messages" USING "btree" ("channel_id", "created_at");



CREATE INDEX "idx_chat_messages_sender_agent_id" ON "public"."chat_messages" USING "btree" ("sender_agent_id");



CREATE INDEX "idx_chat_messages_sender_user_id" ON "public"."chat_messages" USING "btree" ("sender_user_id");



CREATE INDEX "idx_chat_rooms_owner_user_id" ON "public"."workspaces" USING "btree" ("owner_user_id");



CREATE INDEX "idx_datastores_type" ON "public"."datastores" USING "btree" ("type");



CREATE INDEX "idx_datastores_user_id" ON "public"."datastores" USING "btree" ("user_id");



CREATE INDEX "idx_mcp_configurations_agent_id" ON "public"."mcp_configurations" USING "btree" ("agent_id");



CREATE INDEX "idx_mcp_servers_config_id" ON "public"."mcp_servers" USING "btree" ("config_id");



CREATE INDEX "idx_team_members_agent_id" ON "public"."team_members" USING "btree" ("agent_id");



CREATE INDEX "idx_team_members_reports_to_agent_id" ON "public"."team_members" USING "btree" ("reports_to_agent_id");



CREATE INDEX "idx_team_members_team_id" ON "public"."team_members" USING "btree" ("team_id");



CREATE INDEX "idx_tool_catalog_categories" ON "public"."tool_catalog" USING "gin" ("categories");



CREATE INDEX "idx_tool_catalog_status" ON "public"."tool_catalog" USING "btree" ("status");



CREATE INDEX "idx_user_team_memberships_team_id" ON "public"."user_team_memberships" USING "btree" ("team_id");



CREATE INDEX "idx_user_team_memberships_user_id" ON "public"."user_team_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_workspace_members_agent_id" ON "public"."workspace_members" USING "btree" ("agent_id") WHERE ("agent_id" IS NOT NULL);



CREATE INDEX "idx_workspace_members_team_id" ON "public"."workspace_members" USING "btree" ("team_id") WHERE ("team_id" IS NOT NULL);



CREATE INDEX "idx_workspace_members_user_id" ON "public"."workspace_members" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_workspace_members_workspace_id" ON "public"."workspace_members" USING "btree" ("workspace_id");



CREATE OR REPLACE TRIGGER "handle_team_update" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "on_profile_update" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_user_secrets_update" BEFORE UPDATE ON "public"."user_secrets" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_account_tool_environment_active_tools_updated_at" BEFORE UPDATE ON "public"."account_tool_environment_active_tools" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_account_tool_environments_updated_at" BEFORE UPDATE ON "public"."account_tool_environments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_agent_droplet_tools_timestamp" BEFORE UPDATE ON "public"."agent_droplet_tools" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_agent_droplets_timestamp" BEFORE UPDATE ON "public"."agent_droplets" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_tool_catalog_timestamp" BEFORE UPDATE ON "public"."tool_catalog" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_set_team_owner" BEFORE INSERT ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."set_team_owner"();



CREATE OR REPLACE TRIGGER "trigger_update_channel_last_message_at" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_channel_last_message_at"();



CREATE OR REPLACE TRIGGER "update_agents_updated_at" BEFORE UPDATE ON "public"."agents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_datastores_updated_at" BEFORE UPDATE ON "public"."datastores" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_mcp_configurations_updated_at" BEFORE UPDATE ON "public"."mcp_configurations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_mcp_servers_updated_at" BEFORE UPDATE ON "public"."mcp_servers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."account_tool_environment_active_tools"
    ADD CONSTRAINT "account_tool_environment_activ_account_tool_environment_id_fkey" FOREIGN KEY ("account_tool_environment_id") REFERENCES "public"."account_tool_environments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."account_tool_environment_active_tools"
    ADD CONSTRAINT "account_tool_environment_active_tools_tool_catalog_id_fkey" FOREIGN KEY ("tool_catalog_id") REFERENCES "public"."tool_catalog"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."account_tool_environments"
    ADD CONSTRAINT "account_tool_environments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_datastores"
    ADD CONSTRAINT "agent_datastores_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_datastores"
    ADD CONSTRAINT "agent_datastores_datastore_id_fkey" FOREIGN KEY ("datastore_id") REFERENCES "public"."datastores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_discord_connections"
    ADD CONSTRAINT "agent_discord_connections_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_droplet_tools"
    ADD CONSTRAINT "agent_droplet_tools_agent_droplet_id_fkey" FOREIGN KEY ("agent_droplet_id") REFERENCES "public"."agent_droplets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_droplet_tools"
    ADD CONSTRAINT "agent_droplet_tools_tool_catalog_id_fkey" FOREIGN KEY ("tool_catalog_id") REFERENCES "public"."tool_catalog"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."agent_droplets"
    ADD CONSTRAINT "agent_droplets_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_channels"
    ADD CONSTRAINT "chat_channels_room_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_agent_id_fkey" FOREIGN KEY ("sender_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "chat_rooms_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."datastores"
    ADD CONSTRAINT "datastores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."mcp_configurations"
    ADD CONSTRAINT "mcp_configurations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mcp_servers"
    ADD CONSTRAINT "mcp_servers_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "public"."mcp_configurations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey1" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_reports_to_agent_id_fkey" FOREIGN KEY ("reports_to_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_secrets"
    ADD CONSTRAINT "user_secrets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_team_memberships"
    ADD CONSTRAINT "user_team_memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_team_memberships"
    ADD CONSTRAINT "user_team_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



CREATE POLICY "Allow access to own agent MCP configurations" ON "public"."mcp_configurations" USING ((EXISTS ( SELECT 1
   FROM "public"."agents" "a"
  WHERE (("a"."id" = "mcp_configurations"."agent_id") AND ("a"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."agents" "a"
  WHERE (("a"."id" = "mcp_configurations"."agent_id") AND ("a"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow access to own agent MCP servers" ON "public"."mcp_servers" USING ((EXISTS ( SELECT 1
   FROM ("public"."mcp_configurations" "mc"
     JOIN "public"."agents" "a" ON (("mc"."agent_id" = "a"."id")))
  WHERE (("mc"."id" = "mcp_servers"."config_id") AND ("a"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."mcp_configurations" "mc"
     JOIN "public"."agents" "a" ON (("mc"."agent_id" = "a"."id")))
  WHERE (("mc"."id" = "mcp_servers"."config_id") AND ("a"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow authenticated read access" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access to teams" ON "public"."teams" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to create teams" ON "public"."teams" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow delete access for team owners/admins" ON "public"."team_members" FOR DELETE USING (("public"."user_has_role"("auth"."uid"(), 'admin'::"text") OR "public"."is_team_owner"("team_id", "auth"."uid"())));



CREATE POLICY "Allow delete for owner only" ON "public"."workspaces" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Allow delete for workspace managers" ON "public"."workspace_members" FOR DELETE TO "authenticated" USING ("public"."can_manage_workspace_members"("workspace_id", "auth"."uid"()));



CREATE POLICY "Allow full access to connections for own agents" ON "public"."agent_discord_connections" TO "authenticated" USING ("public"."is_agent_owner"("agent_id")) WITH CHECK ("public"."is_agent_owner"("agent_id"));



CREATE POLICY "Allow individual user CRUD access" ON "public"."user_profiles" TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Allow individual user read access" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow individual user select access" ON "public"."user_secrets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow individual user update access" ON "public"."user_secrets" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow insert access for team owners/admins" ON "public"."team_members" FOR INSERT WITH CHECK (("public"."user_has_role"("auth"."uid"(), 'admin'::"text") OR "public"."is_team_owner"("team_id", "auth"."uid"())));



CREATE POLICY "Allow insert for authenticated users" ON "public"."workspaces" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow insert for workspace managers" ON "public"."workspace_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_workspace_members"("workspace_id", "auth"."uid"()));



CREATE POLICY "Allow members read access on chat_rooms" ON "public"."workspaces" FOR SELECT USING ("public"."is_room_member"("id", "auth"."uid"()));



CREATE POLICY "Allow modify access to own agents" ON "public"."agents" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow owner full access on chat_rooms" ON "public"."workspaces" USING (("auth"."uid"() = "owner_user_id")) WITH CHECK (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Allow owner or global admin to delete teams" ON "public"."teams" FOR DELETE USING ((("auth"."uid"() = "owner_user_id") OR "public"."is_global_admin"("auth"."uid"())));



CREATE POLICY "Allow owner to update their teams" ON "public"."teams" FOR UPDATE USING (("auth"."uid"() = "owner_user_id")) WITH CHECK (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Allow owner to update workspace" ON "public"."workspaces" FOR UPDATE USING (("auth"."uid"() = "owner_user_id")) WITH CHECK (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Allow read access to own agents or if admin" ON "public"."agents" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."user_has_role"("auth"."uid"(), 'admin'::"text")));



CREATE POLICY "Allow read access to team members" ON "public"."team_members" FOR SELECT USING (("public"."user_has_role"("auth"."uid"(), 'admin'::"text") OR "public"."is_team_owner"("team_id", "auth"."uid"()) OR "public"."is_team_member"("team_id", "auth"."uid"())));



CREATE POLICY "Allow room members to insert channel messages" ON "public"."chat_messages" FOR INSERT WITH CHECK (("public"."is_room_member"("public"."get_room_id_for_channel"("channel_id"), "auth"."uid"()) AND ((("sender_user_id" IS NOT NULL) AND ("sender_user_id" = "auth"."uid"())) OR ("sender_agent_id" IS NOT NULL))));



CREATE POLICY "Allow room members to read channel messages" ON "public"."chat_messages" FOR SELECT USING ("public"."is_room_member"("public"."get_room_id_for_channel"("channel_id"), "auth"."uid"()));



CREATE POLICY "Allow room owner to delete channel messages" ON "public"."chat_messages" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."workspaces" "cr"
     JOIN "public"."chat_channels" "cc" ON (("cr"."id" = "cc"."workspace_id")))
  WHERE (("cc"."id" = "chat_messages"."channel_id") AND ("cr"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Allow select for owner or member" ON "public"."workspaces" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "owner_user_id") OR "public"."is_chat_room_member"("id", "auth"."uid"())));



CREATE POLICY "Allow select for workspace members" ON "public"."workspace_members" FOR SELECT TO "authenticated" USING ("public"."is_workspace_member"("workspace_id", "auth"."uid"()));



CREATE POLICY "Allow update access for team owners/admins" ON "public"."team_members" FOR UPDATE USING (("public"."user_has_role"("auth"."uid"(), 'admin'::"text") OR "public"."is_team_owner"("team_id", "auth"."uid"()))) WITH CHECK (("public"."user_has_role"("auth"."uid"(), 'admin'::"text") OR "public"."is_team_owner"("team_id", "auth"."uid"())));



CREATE POLICY "Allow update for owner only" ON "public"."workspaces" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "owner_user_id")) WITH CHECK (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Allow update for workspace managers" ON "public"."workspace_members" FOR UPDATE TO "authenticated" USING ("public"."can_manage_workspace_members"("workspace_id", "auth"."uid"())) WITH CHECK ("public"."can_manage_workspace_members"("workspace_id", "auth"."uid"()));



CREATE POLICY "Allow users to add themselves to teams" ON "public"."user_team_memberships" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to remove themselves from teams" ON "public"."user_team_memberships" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to view own memberships" ON "public"."user_team_memberships" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow workspace members INSERT" ON "public"."chat_channels" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_workspace_member"("workspace_id", "auth"."uid"()));



CREATE POLICY "Allow workspace members SELECT" ON "public"."chat_channels" FOR SELECT TO "authenticated" USING ("public"."is_workspace_member"("workspace_id", "auth"."uid"()));



CREATE POLICY "Allow workspace members to insert messages" ON "public"."chat_messages" FOR INSERT WITH CHECK (("public"."is_workspace_member"("public"."get_workspace_id_for_channel"("channel_id"), "auth"."uid"()) AND ((("sender_user_id" IS NOT NULL) AND ("sender_user_id" = "auth"."uid"())) OR ("sender_agent_id" IS NOT NULL))));



CREATE POLICY "Allow workspace members to read messages" ON "public"."chat_messages" FOR SELECT USING ("public"."is_workspace_member"("public"."get_workspace_id_for_channel"("channel_id"), "auth"."uid"()));



CREATE POLICY "Allow workspace owner DELETE" ON "public"."chat_channels" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."workspaces" "w"
  WHERE (("w"."id" = "chat_channels"."workspace_id") AND ("w"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Allow workspace owner UPDATE" ON "public"."chat_channels" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."workspaces" "w"
  WHERE (("w"."id" = "chat_channels"."workspace_id") AND ("w"."owner_user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workspaces" "w"
  WHERE (("w"."id" = "chat_channels"."workspace_id") AND ("w"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Allow workspace owner to delete messages" ON "public"."chat_messages" FOR DELETE USING ("public"."is_workspace_owner"("public"."get_workspace_id_for_channel"("channel_id"), "auth"."uid"()));



CREATE POLICY "Disallow updates to channel messages" ON "public"."chat_messages" FOR UPDATE USING (false);



CREATE POLICY "Disallow updates to chat messages" ON "public"."chat_messages" FOR UPDATE USING (false);



CREATE POLICY "Service roles can access all account tool environment tools" ON "public"."account_tool_environment_active_tools" USING (("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service roles can access all account tool environments" ON "public"."account_tool_environments" USING (("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 'service_role'::"text"));



CREATE POLICY "Users can create datastores" ON "public"."datastores" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own datastores" ON "public"."datastores" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage own agent datastores" ON "public"."agent_datastores" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."agents"
  WHERE (("agents"."id" = "agent_datastores"."agent_id") AND ("agents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their own account tool environment" ON "public"."account_tool_environments" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage tools on their own account environment" ON "public"."account_tool_environment_active_tools" USING (("auth"."uid"() = ( SELECT "ate"."user_id"
   FROM "public"."account_tool_environments" "ate"
  WHERE ("ate"."id" = "account_tool_environment_active_tools"."account_tool_environment_id")))) WITH CHECK (("auth"."uid"() = ( SELECT "ate"."user_id"
   FROM "public"."account_tool_environments" "ate"
  WHERE ("ate"."id" = "account_tool_environment_active_tools"."account_tool_environment_id"))));



CREATE POLICY "Users can read own datastores" ON "public"."datastores" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own datastores" ON "public"."datastores" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."account_tool_environment_active_tools" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."account_tool_environments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_datastores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_discord_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."datastores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mcp_configurations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mcp_servers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_secrets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_team_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_messages";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_chat_room_members"("p_room_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_chat_room_members"("p_room_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_chat_room_members"("p_room_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_workspace_members"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_workspace_members"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_workspace_members"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_chat_messages_with_details"("p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_chat_messages_with_details"("p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_chat_messages_with_details"("p_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_claim"("claim_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_claim"("claim_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_claim"("claim_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_room_id_for_channel"("p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_room_id_for_channel"("p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_room_id_for_channel"("p_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_room_members"("p_room_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_room_members"("p_room_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_room_members"("p_room_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_team_id_for_channel"("p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_id_for_channel"("p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_id_for_channel"("p_channel_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_workspace_id_for_channel"("p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_workspace_id_for_channel"("p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_workspace_id_for_channel"("p_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_workspace_members_with_details"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_workspace_members_with_details"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_workspace_members_with_details"("p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_key_generation"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_key_generation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_key_generation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_agent_owner"("agent_id_to_check" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_agent_owner"("agent_id_to_check" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_agent_owner"("agent_id_to_check" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_chat_room_member"("p_room_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_chat_room_member"("p_room_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_chat_room_member"("p_room_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_global_admin"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_global_admin"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_global_admin"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_room_member"("p_room_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_room_member"("p_room_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_room_member"("p_room_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_admin_or_pm"("p_team_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_admin_or_pm"("p_team_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_admin_or_pm"("p_team_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_member"("p_team_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_member"("p_team_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_member"("p_team_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_owner"("p_team_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_owner"("p_team_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_owner"("p_team_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_workspace_member"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_workspace_member"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_workspace_member"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_workspace_owner"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_workspace_owner"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_workspace_owner"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON TABLE "public"."chat_channels" TO "anon";
GRANT ALL ON TABLE "public"."chat_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_channels" TO "service_role";



GRANT ALL ON FUNCTION "public"."list_room_channels"("p_room_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_room_channels"("p_room_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_room_channels"("p_room_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_channel_messages"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."match_channel_messages"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_channel_messages"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_channel_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON FUNCTION "public"."search_chat_history"("p_channel_id" "uuid", "p_search_query" "text", "p_search_type" "text", "p_match_count" integer, "p_match_threshold" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."search_chat_history"("p_channel_id" "uuid", "p_search_query" "text", "p_search_type" "text", "p_match_count" integer, "p_match_threshold" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_chat_history"("p_channel_id" "uuid", "p_search_query" "text", "p_search_type" "text", "p_match_count" integer, "p_match_threshold" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_team_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_team_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_team_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_channel_last_message_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_channel_last_message_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_channel_last_message_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_worker_status"("connection_id_in" "uuid", "new_status_in" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_worker_status"("connection_id_in" "uuid", "new_status_in" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_worker_status"("connection_id_in" "uuid", "new_status_in" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_role"("user_id" "uuid", "role_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_role"("user_id" "uuid", "role_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_role"("user_id" "uuid", "role_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";









GRANT ALL ON TABLE "public"."account_tool_environment_active_tools" TO "anon";
GRANT ALL ON TABLE "public"."account_tool_environment_active_tools" TO "authenticated";
GRANT ALL ON TABLE "public"."account_tool_environment_active_tools" TO "service_role";



GRANT ALL ON TABLE "public"."account_tool_environments" TO "anon";
GRANT ALL ON TABLE "public"."account_tool_environments" TO "authenticated";
GRANT ALL ON TABLE "public"."account_tool_environments" TO "service_role";



GRANT ALL ON TABLE "public"."agent_datastores" TO "anon";
GRANT ALL ON TABLE "public"."agent_datastores" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_datastores" TO "service_role";



GRANT ALL ON TABLE "public"."agent_discord_connections" TO "anon";
GRANT ALL ON TABLE "public"."agent_discord_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_discord_connections" TO "service_role";



GRANT ALL ON TABLE "public"."agent_droplet_tools" TO "anon";
GRANT ALL ON TABLE "public"."agent_droplet_tools" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_droplet_tools" TO "service_role";



GRANT ALL ON TABLE "public"."agent_droplets" TO "anon";
GRANT ALL ON TABLE "public"."agent_droplets" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_droplets" TO "service_role";



GRANT ALL ON TABLE "public"."agents" TO "anon";
GRANT ALL ON TABLE "public"."agents" TO "authenticated";
GRANT ALL ON TABLE "public"."agents" TO "service_role";



GRANT ALL ON TABLE "public"."datastores" TO "anon";
GRANT ALL ON TABLE "public"."datastores" TO "authenticated";
GRANT ALL ON TABLE "public"."datastores" TO "service_role";



GRANT ALL ON TABLE "public"."mcp_configurations" TO "anon";
GRANT ALL ON TABLE "public"."mcp_configurations" TO "authenticated";
GRANT ALL ON TABLE "public"."mcp_configurations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mcp_configurations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mcp_configurations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mcp_configurations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mcp_servers" TO "anon";
GRANT ALL ON TABLE "public"."mcp_servers" TO "authenticated";
GRANT ALL ON TABLE "public"."mcp_servers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mcp_servers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mcp_servers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mcp_servers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."tool_catalog" TO "anon";
GRANT ALL ON TABLE "public"."tool_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."tool_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_secrets" TO "anon";
GRANT ALL ON TABLE "public"."user_secrets" TO "authenticated";
GRANT ALL ON TABLE "public"."user_secrets" TO "service_role";



GRANT ALL ON TABLE "public"."user_team_memberships" TO "anon";
GRANT ALL ON TABLE "public"."user_team_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."user_team_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_members" TO "anon";
GRANT ALL ON TABLE "public"."workspace_members" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_members" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."workspace_members" TO "supabase_admin";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
