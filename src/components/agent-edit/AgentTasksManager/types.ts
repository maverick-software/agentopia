import { FileUp, Mail, MessageSquare, User, Webhook } from 'lucide-react';

export interface AgentTask {
  id: string;
  agent_id: string;
  user_id: string;
  name: string;
  description?: string;
  task_type: 'scheduled' | 'event_based';
  status: 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
  instructions: string;
  selected_tools: string[];
  cron_expression?: string;
  timezone: string;
  next_run_at?: string;
  last_run_at?: string;
  event_trigger_type?: string;
  event_trigger_config: any;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  max_executions?: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentTasksManagerProps {
  agentId: string;
  availableTools: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

export interface TaskFormData {
  name: string;
  description: string;
  task_type: 'scheduled' | 'event_based';
  instructions: string;
  selected_tools: string[];
  cron_expression: string;
  timezone: string;
  event_trigger_type: string;
  event_trigger_config: Record<string, unknown>;
  max_executions?: number;
  start_date: string;
  end_date: string;
}

export const DEFAULT_TASK_FORM_DATA: TaskFormData = {
  name: '',
  description: '',
  task_type: 'scheduled',
  instructions: '',
  selected_tools: [],
  cron_expression: '',
  timezone: 'UTC',
  event_trigger_type: '',
  event_trigger_config: {},
  max_executions: undefined,
  start_date: '',
  end_date: '',
};

export const EVENT_TRIGGER_TYPES = [
  { value: 'email_received', label: 'When I get a new email', icon: Mail },
  { value: 'integration_webhook', label: 'When a webhook is received', icon: Webhook },
  { value: 'agent_mentioned', label: 'When I am mentioned', icon: User },
  { value: 'file_uploaded', label: 'When a file is uploaded', icon: FileUp },
  { value: 'workspace_message', label: 'When there is a new workspace message', icon: MessageSquare },
];
