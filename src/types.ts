export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  userId?: string | null;
  agentId?: string | null;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  personality: string;
  active: boolean;
  discord_server?: string;
  discord_channel?: string;
  discord_bot_key?: string;
  system_instructions?: string;
  assistant_instructions?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Datastore {
  id: string;
  name: string;
  description?: string;
  type: 'vector' | 'knowledge' | 'file' | 'pinecone' | 'getzep';
  config?: DatastoreConfig;
  created_at?: string;
}

export interface DatastoreConfig {
  apiKey?: string;
  region?: string;
  host?: string;
  indexName?: string;
  dimensions?: number;
  projectId?: string;
  collectionName?: string;
}

export interface AgentDatastore {
  id: string;
  agent_id: string;
  datastore_id: string;
  created_at?: string;
}

export interface AgentDiscordConnection {
  id?: string;
  agent_id?: string;
  guild_id?: string;
  channel_id?: string | null;
  discord_app_id?: string;
  discord_public_key?: string;
  inactivity_timeout_minutes?: number;
  worker_status?: 'inactive' | 'activating' | 'active' | 'stopping' | 'error';
  interaction_secret?: string;
}

// Ensure this type is defined, perhaps in types.ts or here
// export interface AgentDiscordConnection {
//   id?: string;
//   agent_id?: string;
//   guild_id?: string;
//   channel_id?: string | null;
//   discord_app_id?: string;
//   discord_public_key?: string;
//   inactivity_timeout_minutes?: number;
//   worker_status?: 'inactive' | 'activating' | 'active' | 'stopping' | 'error';
// }

// AgentEdit.tsx modifications done previously

// DiscordConnect.tsx modifications done previously

export interface Profile {
  id: string; // UUID referencing auth.users
  full_name: string;
  mobile?: string | null;
  company_name?: string | null;
  title?: string | null;
  usage_reason?: any | null; // JSONB can be complex, using 'any' for now
  hopes_goals?: string | null;
  created_at?: string; // timestamptz
  updated_at?: string; // timestamptz
}

// New type for Agent Teams
export interface Team {
  id: string; // uuid
  owner_user_id?: string; // uuid, nullable
  name: string; // text
  description?: string | null; // text, nullable
  created_at?: string; // timestamptz
  updated_at?: string; // timestamptz
}

// New type for Team Members (combines Agent info with team-specific details)
export interface TeamMember {
  team_id: string; // uuid
  agent_id: string; // uuid
  team_role?: string | null; // text, e.g., 'project_manager'
  team_role_description?: string | null; // text
  reports_to_agent_id?: string | null; // uuid
  reports_to_user?: boolean | null; // boolean
  joined_at?: string; // timestamptz
  // Include agent details by embedding the Agent type or relevant fields
  agent: Agent; // Embed the full Agent object for convenience
}

// New type for Chat Rooms (Workspaces)
export interface ChatRoom {
  id: string; // uuid, PK
  name: string; // text, Not Null
  owner_user_id: string; // uuid, FK -> auth.users.id, Not Null
  created_at?: string; // timestamptz
  // Add other fields like topic, last_message_at if needed from chat_channels?
  // For now, just the basic room info.
}

// New type for Chat Sessions (Potentially deprecated/replaced by Chat Rooms/Channels?)
export interface ChatSession {
  id: string; // uuid
  team_id: string; // uuid, FK to teams
  session_name?: string | null; // text
  session_summary?: string | null; // text
  session_summary_embedding?: string | null; // vector(1536), Assuming text-embedding-3-small
  created_at?: string; // timestamptz
  updated_at?: string; // timestamptz
}

// New type for Chat Messages
export interface ChatMessage {
  id: string; // uuid
  session_id: string; // uuid, FK to chat_sessions
  sender_user_id?: string | null; // uuid, FK to auth.users
  sender_agent_id?: string | null; // uuid, FK to agents
  content: string; // text
  embedding?: string | null; // vector(1536)
  metadata?: Record<string, any> | null; // jsonb, for mentions, etc.
  created_at?: string; // timestamptz
}