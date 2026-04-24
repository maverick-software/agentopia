import type { Message } from '@/types';
import type { Database } from '@/types/database.types';

export type Agent = Database['public']['Tables']['agents']['Row'];

export interface MessageListProps {
  messages: Message[];
  agent: Agent | null;
  user: any;
  thinkingMessageIndex: number | null;
  formatMarkdown: (content: string) => string;
  currentProcessingDetails?: any;
  onShowProcessModal?: (messageDetails?: any) => void;
  onShowDebugModal?: (processingDetails: any) => void;
  aiState?: any;
  currentTool?: any;
  processSteps?: any[];
  onCanvasSendMessage?: (message: string, artifactId: string) => Promise<void>;
  onRetryToolWithInput?: (message: Message, userInputs: Record<string, any>) => Promise<void>;
}

export interface ChatStarterScreenProps {
  agent: Agent | null;
  user?: any;
}
