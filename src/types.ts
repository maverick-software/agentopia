export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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