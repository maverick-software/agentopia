# Agentopia Database Schema

This document provides an overview of the database schema for the Agentopia project, primarily based on the visual schema diagram provided (`DATABASE_SCHEMA.png`).

**Note:** This representation might differ slightly from the state defined purely by applied migrations. RLS policies are generally not shown in the diagram.

## Core Tables

### `auth.users`
Standard Supabase authentication table.
*   **Key Columns:**
    *   `id` (uuid, PK)
    *   (Other standard columns)

### `public.user_profiles`
Stores additional user profile information.
*   **(Diagram vs. Migrations Note:** Name is `user_profiles` in diagram, `profiles` in migrations. Column differences exist.)*
*   **Key Columns (from Diagram):**
    *   `id` (uuid, PK, FK -> `auth.users.id`)
    *   `username` (text)
    *   `full_name` (text)
    *   `avatar_url` (text)
    *   `updated_at` (timestamptz)
*   **Relationships:** One-to-one with `auth.users`.

### `public.roles`
Defines application roles.
*   **Key Columns:**
    *   `id` (uuid, PK)
    *   `name` (text, Unique)
    *   `description` (text)
    *   `created_at` (timestamptz)

### `public.user_roles`
Links users to their roles.
*   **(Diagram vs. Migrations Note:** This join table is in the diagram. Migrations put `role_id` directly on `profiles`.)*
*   **Key Columns:**
    *   `user_id` (uuid, PK, FK -> `auth.users.id`)
    *   `role_id` (uuid, PK, FK -> `roles.id`)
    *   `created_at` (timestamptz)

### `public.teams`
Represents teams.
*   **Key Columns:**
    *   `id` (uuid, PK)
    *   `name` (text, Not Null)
    *   `description` (text)
    *   `owner_user_id` (uuid, FK -> `auth.users.id`)
    *   `created_at` (timestamptz)
    *   `updated_at` (timestamptz)

### `public.team_members`
Links **Agents** to Teams and defines their role/reporting structure within the team.
*   **(Diagram vs. Migrations Note:** Significant column differences exist. This description aligns with the intent that this table is for **Agents**, adjusted from the diagram which included a `user_id`.)*
*   **Key Columns (Adjusted from Diagram):**
    *   `id` (uuid, PK)
    *   `team_id` (uuid, FK -> `teams.id`, Not Null)
    *   `agent_id` (uuid, FK -> `agents.id`, Not Null) // Assuming agent link is mandatory
    *   `team_role` (text): Role within the team.
    *   `team_role_description` (text)
    *   `reports_to_agent_id` (uuid, Nullable, FK -> `agents.id`)
    *   `joined_at` (timestamptz)

### `public.user_team_memberships`
Tracks user membership in teams.
*   **(Note:** Potential redundancy with `team_members` noted in diagram and migrations.)*
*   **Key Columns:**
    *   `id` (uuid, PK)
    *   `user_id` (uuid, FK -> `auth.users.id`, Not Null)
    *   `team_id` (uuid, FK -> `teams.id`, Not Null)
    *   `joined_at` (timestamptz, Not Null)

## Agent Related Tables

### `public.agents`
Stores configuration for individual AI agents.
*   **(Diagram vs. Migrations Note:** Column differences exist. This reflects the functionally required schema.)*
*   **Key Columns (Corrected):**
    *   `id` (uuid, PK)
    *   `user_id` (uuid, FK -> `auth.users.id`)
    *   `name` (text)
    *   `description` (text)
    *   `system_instructions` (text)
    *   `assistant_instructions` (text)
    *   `discord_channel` (text)
    *   `discord_bot_key` (text) // (Vault?)
    *   `discord_bot_token_id` (text) // (Vault?)
    *   `discord_user_id` (text)
    *   `active` (boolean, DEFAULT false) // Functionally required
    *   `created_at`, `updated_at` (timestamptz)

### `public.agent_discord_connections`
Tracks connection details and status for agents, specifically per Discord Server (Guild).
*   **(Diagram vs. Migrations Note:** Diagram includes `channel_id` which is deprecated/incorrect for this table's purpose. Migrations correctly implemented `guild_id`. This description uses `guild_id`.)*
*   **Key Columns (Corrected):**
    *   `id` (uuid, PK)
    *   `agent_id` (uuid, FK -> `agents.id`)
    *   `guild_id` (text, Not Null) // Discord Server ID
    *   `is_enabled` (boolean)
    *   `discord_app_id` (text)
    *   `discord_public_key` (text)
    *   `inactivity_timeout_ms` (integer)
    *   `worker_status` (text)
    *   `created_at` (timestamptz)

### `public.datastores`
Represents collections of data for RAG.
*   **Key Columns:**
    *   `id` (uuid, PK)
    *   `user_id` (uuid, FK -> `auth.users.id`)
    *   `name` (text)
    *   `description` (text)
    *   `type` (text)
    *   `config` (jsonb)
    *   `similarity_metric` (text)
    *   `similarity_threshold` (float4)
    *   `max_results` (integer)
    *   `created_at`, `updated_at` (timestamptz)

### `public.agent_datastores`
Join table linking agents to datastores.
*   **Key Columns:**
    *   `id` (uuid, PK) // Diagram shows own PK
    *   `agent_id` (uuid, FK -> `agents.id`)
    *   `datastore_id` (uuid, FK -> `datastores.id`)
    *   `created_at` (timestamptz)

## Chat Room Tables

### `public.chat_rooms`
Top-level containers for chat.
*   **Key Columns:**
    *   `id` (uuid, PK)
    *   `name` (text, Not Null)
    *   `owner_user_id` (uuid, FK -> `auth.users.id`, Not Null)
    *   `created_at` (timestamptz)

### `public.chat_channels`
Individual channels within a chat room.
*   **Key Columns:**
    *   `id` (uuid, PK)
    *   `room_id` (uuid, FK -> `chat_rooms.id`, Not Null)
    *   `name` (text, Not Null)
    *   `topic` (text)
    *   `created_at` (timestamptz, Not Null)
    *   `last_message_at` (timestamptz)

### `public.chat_room_members`
Links users, agents, or teams as members of a chat room.
*   **Key Columns:**
    *   `id` (uuid, PK)
    *   `room_id` (uuid, FK -> `chat_rooms.id`, Not Null)
    *   `member_type` (text, Check('user', 'agent', 'team'))
    *   `member_id` (uuid, Not Null): Refers to `auth.users.id`, `agents.id`, or `teams.id` based on `member_type`.
    *   `added_at` (timestamptz)

### `public.chat_messages`
Stores individual messages within a chat channel.
*   **Key Columns:**
    *   `id` (uuid, PK)
    *   `channel_id` (uuid, FK -> `chat_channels.id`, Not Null)
    *   `sender_user_id` (uuid, Nullable, FK -> `auth.users.id`)
    *   `sender_agent_id` (uuid, Nullable, FK -> `agents.id`)
    *   `content` (text, Not Null)
    *   `metadata` (jsonb)
    *   `embedding` (vector(1536))
    *   `created_at` (timestamptz, Not Null)

## Other Tables (From Diagram)

### `public.mcp_configurations`
Configuration for the Multi-Cloud Proxy feature.
*   **Key Columns:**
    *   `id` (uuid, PK)
    *   `agent_id` (uuid, FK -> `agents.id`)
    *   `is_enabled` (boolean)
    *   `created_at`, `updated_at` (timestamptz)

### `public.mcp_servers`
Defines available backend servers for MCP.
*   **Key Columns:**
    *   `id` (uuid, PK)
    *   `config_id` (uuid, FK -> `mcp_configurations.id`)
    *   `name` (varchar)
    *   `endpoint_url` (text)
    *   `vault_api_key_id` (uuid) // Diagram name
    *   `timeout_ms` (integer)
    *   `max_retries` (integer)
    *   `retry_backoff_ms` (integer)
    *   `priority` (integer)
    *   `is_active` (boolean)
    *   `capabilities` (jsonb)
    *   `created_at`, `updated_at` (timestamptz)

### `public.user_secrets`
Links users to secrets, likely stored in a vault.
*   **(Diagram vs. Migrations Note:** Table not shown connected in the main diagram provided, but migrations exist.)*
*   **Key Columns (from Migrations):**
    *   `id` (uuid, PK)
    *   `user_id` (uuid, FK -> `auth.users.id`)
    *   `vault_id` (text)
    *   `vault_item_id` (text)
    *   `created_at`, `updated_at` (timestamptz) 