import { TaskStep } from '@/types/tasks';

export interface TaskWizardEditingTask {
  id: string;
  title: string;
  name?: string;
  description: string;
  status: string;
  schedule_label?: string;
  cron_expression?: string;
  schedule?: string;
  start_date?: string;
  end_date?: string;
  max_executions?: number;
  timezone?: string;
  task_type?: string;
  instructions?: string;
  conversation_id?: string;
}

export interface TaskWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData: { name?: string };
  onTaskCreated: () => void;
  editingTask?: TaskWizardEditingTask | null;
}

export type ScheduleMode = 'one_time' | 'recurring';
export type EveryUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

export interface TaskWizardFormState {
  currentStep: number;
  scheduleMode: ScheduleMode;
  oneTimeDate: string;
  oneTimeTime: string;
  recurringStartDate: string;
  recurringEndDate: string;
  recurringTime: string;
  everyInterval: number;
  everyUnit: EveryUnit;
  newTaskTitle: string;
  targetConversationId: string;
  selectedTimezone: string;
  taskSteps: TaskStep[];
}

