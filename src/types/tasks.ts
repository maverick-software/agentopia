export interface Task {
  id: string;
  user_id: string;
  agent_id: string;
  title: string;
  description: string;
  task_type: 'scheduled' | 'event_based';
  status: 'active' | 'paused' | 'completed' | 'failed';
  cron_expression?: string;
  scheduled_at?: string;
  start_date?: string;
  end_date?: string;
  max_executions?: number;
  execution_count: number;
  timezone: string;
  target_conversation_id?: string;
  schedule_label?: string;
  schedule?: string;
  next_run_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskFormData {
  scheduleMode: 'one_time' | 'recurring';
  oneTimeDate: string;
  oneTimeTime: string;
  recurringStartDate: string;
  recurringEndDate: string;
  recurringTime: string;
  everyInterval: number;
  everyUnit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  newTaskDescription: string;
  newTaskTitle: string;
  targetConversationId: string;
  selectedTimezone: string;
}

export interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData: { name?: string };
  onAgentUpdated?: (updatedData: any) => void;
}
