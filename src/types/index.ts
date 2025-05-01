export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentId?: string | null;
  userId?: string | null;
  agentName?: string | null;
  userName?: string | null;
  userAvatar?: string | null;
  metadata?: any;
} 