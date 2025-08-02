import { Database } from './database.types'; // Import generated types

// Export specific table types using Supabase helpers
export type Agent = Database['public']['Tables']['agents']['Row'];
export type Datastore = Database['public']['Tables']['datastores']['Row'];
export type AgentDiscordConnection = Database['public']['Tables']['agent_discord_connections']['Row'];

// Keep existing Message type if needed
export interface Message {
  role: 'user' | 'assistant' | 'thinking';
  content: string;
  timestamp: Date;
  agentId?: string | null;
  userId?: string | null;
  agentName?: string | null;
  userName?: string | null;
  userAvatar?: string | null;
  metadata?: any;
  // AI processing details
  aiProcessDetails?: {
    steps: Array<{
      state: string;
      label: string;
      duration?: number;
      details?: string;
      response?: string;
      toolCall?: string;
      toolResult?: any;
      completed: boolean;
    }>;
    totalDuration?: number;
    toolsUsed?: string[];
  };
} 