export interface TasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'paused' | 'completed';
  schedule?: string;
  created_at: string;
  cron_expression?: string | null;
  timezone?: string | null;
  next_run_at?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  schedule_label?: string;
  conversation_id?: string | null;
}

export interface TasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'paused' | 'completed';
  schedule?: string;
  created_at: string;
  cron_expression?: string | null;
  timezone?: string | null;
  next_run_at?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  schedule_label?: string;
  conversation_id?: string | null;
}

export type ScheduleMode = 'one_time' | 'recurring';
export type RecurringCadence = 'daily' | 'weekly' | 'monthly';

declare global {
  interface Window {
    __agentopiaConversations?: Array<{ conversation_id: string; title?: string }>;
  }
}
