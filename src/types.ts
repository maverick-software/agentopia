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
  description: string;
  type: 'pinecone' | 'getzep';
  config: DatastoreConfig;
  created_at?: string;
  updated_at?: string;
}

export interface DatastoreConfig {
  apiKey?: string;
  // Pinecone Serverless
  region?: string;
  host?: string;
  indexName?: string;
  dimensions?: number;
  // GetZep
  projectId?: string;
  collectionName?: string;
}

export interface AgentDatastore {
  id: string;
  agent_id: string;
  datastore_id: string;
  created_at?: string;
}