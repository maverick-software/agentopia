import { AlertCircle, CheckCircle2, Pause, Square, XCircle } from 'lucide-react';

export const TOTAL_STEPS = 5;

export function canProceedToNext(currentStep: number, formData: { name: string; task_type: 'scheduled' | 'event_based'; description: string; event_trigger_type: string; cron_expression: string; selected_tools: string[]; }) {
  switch (currentStep) {
    case 1:
      return formData.name.trim().length > 0 && !!formData.task_type;
    case 2:
      return formData.description.trim().length > 0;
    case 3:
      return formData.task_type === 'event_based' ? !!formData.event_trigger_type : !!formData.cron_expression;
    case 4:
      return formData.selected_tools.length > 0;
    case 5:
      return true;
    default:
      return false;
  }
}

export function getStepTitle(currentStep: number, taskType: 'scheduled' | 'event_based') {
  switch (currentStep) {
    case 1: return 'Name Your Task';
    case 2: return 'Describe Your Task';
    case 3: return taskType === 'scheduled' ? 'Set Schedule' : 'Choose Event Trigger';
    case 4: return 'Select Tools';
    case 5: return 'Optional Settings';
    default: return 'Create Task';
  }
}

export function getStepDescription(currentStep: number, taskType: 'scheduled' | 'event_based') {
  switch (currentStep) {
    case 1: return 'Give your task a clear, descriptive name';
    case 2: return 'Explain what this task should accomplish';
    case 3: return taskType === 'scheduled' ? 'When should this task run?' : 'What should trigger this task?';
    case 4: return 'Which tools can this task use?';
    case 5: return 'Set limits and date ranges (optional)';
    default: return '';
  }
}

export function getStatusIcon(status: string) {
  switch (status) {
    case 'active': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'paused': return <Pause className="h-4 w-4 text-yellow-500" />;
    case 'completed': return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
    case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'cancelled': return <Square className="h-4 w-4 text-gray-500" />;
    default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
  }
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 border-green-200';
    case 'paused': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'failed': return 'bg-red-100 text-red-800 border-red-200';
    case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function formatNextRun(nextRunAt?: string) {
  if (!nextRunAt) return 'Not scheduled';
  return new Date(nextRunAt).toLocaleString();
}
