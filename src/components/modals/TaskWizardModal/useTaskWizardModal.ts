import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { TaskStep } from '@/types/tasks';
import {
  generateCronExpression,
  generateOneTimeCronExpression,
  getDefaultTimezone,
  parseCronForRecurring,
} from '@/lib/utils/taskUtils';
import { EveryUnit, ScheduleMode, TaskWizardEditingTask } from './types';

interface UseTaskWizardModalArgs {
  agentId: string;
  editingTask?: TaskWizardEditingTask | null;
  onTaskCreated: () => void;
  onClose: () => void;
}

export function useTaskWizardModal({ agentId, editingTask, onTaskCreated, onClose }: UseTaskWizardModalArgs) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('one_time');
  const [oneTimeDate, setOneTimeDate] = useState('');
  const [oneTimeTime, setOneTimeTime] = useState('');
  const [recurringStartDate, setRecurringStartDate] = useState('');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [recurringTime, setRecurringTime] = useState('');
  const [everyInterval, setEveryInterval] = useState(1);
  const [everyUnit, setEveryUnit] = useState<EveryUnit>('day');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [targetConversationId, setTargetConversationId] = useState('');
  const [selectedTimezone, setSelectedTimezone] = useState(getDefaultTimezone());
  const [taskSteps, setTaskSteps] = useState<TaskStep[]>([]);
  const [, setStepsValid] = useState(false);
  const supabase = useSupabaseClient();
  const { user } = useAuth();

  const resetForm = () => {
    setCurrentStep(1);
    setScheduleMode('one_time');
    setOneTimeDate('');
    setOneTimeTime('');
    setRecurringStartDate('');
    setRecurringEndDate('');
    setRecurringTime('');
    setEveryInterval(1);
    setEveryUnit('day');
    setNewTaskTitle('');
    setTargetConversationId('');
    setTaskSteps([]);
    setStepsValid(false);
    setSelectedTimezone(getDefaultTimezone());
  };

  const loadExistingTaskSteps = async () => {
    if (!editingTask?.id || !user) return;
    try {
      const { data, error } = await supabase.rpc('get_task_steps_with_context', {
        p_task_id: editingTask.id,
      });
      if (error) {
        console.error('Failed to load task steps:', error);
        return;
      }

      const loadedSteps = (data || []).map((row: any) => ({
        id: row.step_id || row.id,
        task_id: editingTask.id,
        step_order: row.step_order,
        step_name: row.step_name,
        instructions: row.instructions,
        include_previous_context: row.include_previous_context || false,
        context_data: row.context_data || {},
        status: row.status || 'pending',
        execution_result: row.execution_result || {},
        execution_started_at: row.execution_started_at,
        execution_completed_at: row.execution_completed_at,
        error_message: row.error_message,
        retry_count: row.retry_count || 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
        display_name: `Step ${row.step_order}`,
      }));
      setTaskSteps(loadedSteps);
    } catch (error) {
      console.error('Error loading task steps:', error);
    }
  };

  useEffect(() => {
    if (!editingTask) {
      resetForm();
      return;
    }

    setNewTaskTitle(editingTask.name || editingTask.title || '');
    if (editingTask.timezone) setSelectedTimezone(editingTask.timezone);
    if (editingTask.conversation_id) setTargetConversationId(editingTask.conversation_id);
    loadExistingTaskSteps();

    if (editingTask.max_executions === 1) {
      setScheduleMode('one_time');
      if (editingTask.cron_expression) {
        const cronParts = editingTask.cron_expression.split(' ');
        if (cronParts.length === 5) {
          const [minute, hour] = cronParts;
          setOneTimeTime(`${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);
        }
      }
      if (editingTask.start_date) {
        setOneTimeDate(new Date(editingTask.start_date).toISOString().split('T')[0]);
      }
      return;
    }

    setScheduleMode('recurring');
    if (editingTask.cron_expression) {
      const parsed = parseCronForRecurring(editingTask.cron_expression);
      if (parsed) {
        setRecurringTime(parsed.time);
        setEveryInterval(parsed.interval);
        setEveryUnit(parsed.unit);
      } else {
        setEveryInterval(1);
        setEveryUnit('day');
      }
    }
    if (editingTask.start_date) {
      setRecurringStartDate(new Date(editingTask.start_date).toISOString().split('T')[0]);
    }
    if (editingTask.end_date) {
      setRecurringEndDate(new Date(editingTask.end_date).toISOString().split('T')[0]);
    }
  }, [editingTask]);

  const isFormValid = () => {
    if (!newTaskTitle.trim()) return false;
    if (scheduleMode === 'one_time') return Boolean(oneTimeDate && oneTimeTime);
    return Boolean(recurringStartDate && recurringTime && everyInterval >= 1);
  };

  const handleSaveTask = async () => {
    if (!user || !agentId) return;
    setLoading(true);
    try {
      const usingSteps = taskSteps.length > 0;
      const taskData: any = {
        agent_id: agentId,
        name: newTaskTitle,
        description:
          taskSteps.length > 0
            ? `Multi-step workflow: ${taskSteps.map((step) => step.step_name).join(' -> ')}`
            : 'Multi-step task workflow',
        instructions: `Multi-step task with ${taskSteps.length} steps. See task_steps table for detailed instructions.`,
        task_type: 'scheduled',
        timezone: selectedTimezone,
        selected_tools: [],
        event_trigger_type: '',
        event_trigger_config: {},
        target_conversation_id: targetConversationId || null,
        is_multi_step: usingSteps,
        step_count: taskSteps.length,
      };

      if (scheduleMode === 'one_time') {
        taskData.start_date = oneTimeDate;
        taskData.cron_expression = generateOneTimeCronExpression(oneTimeDate, oneTimeTime);
        taskData.max_executions = 1;
      } else {
        taskData.start_date = recurringStartDate;
        taskData.end_date = recurringEndDate || null;
        taskData.cron_expression = generateCronExpression(everyUnit, everyInterval, recurringTime);
      }

      let result;
      let invokeError;
      if (editingTask) {
        const response = await supabase.functions.invoke('agent-tasks', {
          body: { ...taskData, task_id: editingTask.id, action: 'update' },
        });
        result = response.data;
        invokeError = response.error;
      } else {
        const response = await supabase.functions.invoke('agent-tasks', { body: taskData });
        result = response.data;
        invokeError = response.error;
      }

      if (invokeError) {
        throw new Error(invokeError.message || `Failed to ${editingTask ? 'update' : 'create'} task`);
      }

      if (usingSteps && result?.task_id && !editingTask) {
        for (const step of taskSteps) {
          const { error: stepError } = await supabase.rpc('create_task_step', {
            p_task_id: result.task_id,
            p_step_name: step.step_name,
            p_instructions: step.instructions,
            p_include_previous_context: step.include_previous_context,
            p_step_order: step.step_order,
          });
          if (stepError) {
            throw new Error(`Failed to create step "${step.step_name}": ${stepError.message}`);
          }
        }
        toast.success(`Task created with ${taskSteps.length} steps successfully!`);
      } else {
        toast.success(editingTask ? 'Task updated successfully!' : 'Task created successfully!');
      }

      resetForm();
      onTaskCreated();
      onClose();
    } catch (error: any) {
      console.error('Error saving task:', error);
      toast.error(error?.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    let next = currentStep + 1;
    if (scheduleMode === 'one_time' && currentStep === 2) next = 4;
    setCurrentStep(next);
  };

  const handleBack = () => {
    const prev = scheduleMode === 'one_time' && currentStep === 4 ? 2 : currentStep - 1;
    setCurrentStep(prev);
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  return {
    currentStep,
    loading,
    scheduleMode,
    oneTimeDate,
    oneTimeTime,
    recurringStartDate,
    recurringEndDate,
    recurringTime,
    everyInterval,
    everyUnit,
    newTaskTitle,
    targetConversationId,
    selectedTimezone,
    taskSteps,
    setScheduleMode,
    setOneTimeDate,
    setOneTimeTime,
    setRecurringStartDate,
    setRecurringEndDate,
    setRecurringTime,
    setEveryInterval,
    setEveryUnit,
    setSelectedTimezone,
    setTaskSteps,
    setStepsValid,
    setNewTaskTitle,
    setTargetConversationId,
    isFormValid,
    handleSaveTask,
    handleNext,
    handleBack,
    handleCancel,
  };
}
