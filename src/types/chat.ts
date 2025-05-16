// src/types/chat.ts

// Based on the schema defined in /database/README.md

export type MemberType = 'user' | 'agent' | 'team';

export interface ChatRoom {
  id: string; // uuid
  name: string;
  owner_user_id: string; // uuid
  created_at: string; // timestamptz
  // Add related entities if needed when fetching (e.g., channels, members)
}

export interface ChatChannel {
  id: string; // uuid
  room_id: string; // uuid
  name: string;
  topic?: string | null;
  created_at: string; // timestamptz
  last_message_at?: string | null; // timestamptz
}

export interface ChatRoomMember {
  id: string; // uuid
  room_id: string; // uuid
  member_type: MemberType;
  member_id: string; // uuid (references user, agent, or team based on member_type)
  added_at: string; // timestamptz
  // Potentially include fetched member details (e.g., name, avatar) later
  user?: { id: string; full_name?: string | null; avatar_url?: string | null };
  agent?: { id: string; name?: string | null };
  team?: { id: string; name?: string | null };
}

export interface ChatMessage {
  id: string; // uuid
  channel_id: string; // uuid
  sender_user_id?: string | null; // uuid
  sender_agent_id?: string | null; // uuid
  content: string;
  metadata?: Record<string, any> | null; // jsonb
  embedding?: number[] | null; // vector(1536) - Representing as number array, adjust if needed
  created_at: string; // timestamptz

  // Fields added/mapped in frontend logic 
  role: 'user' | 'assistant';
  timestamp: Date;
  agentId?: string | null; // Consistent agent identifier
  userId?: string | null; // Consistent user identifier (might be same as sender_user_id)
  agentName?: string | null;
  userName?: string | null;
  userAvatar?: string | null;

  // Keep original sender details if needed for other purposes
  // sender_user?: { id: string; full_name?: string | null; avatar_url?: string | null };
  // sender_agent?: { id: string; name?: string | null };
} 