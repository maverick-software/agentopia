import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { buildCronExpression, parseCronToLabel, toUtcIsoForTimezone } from './scheduling';
import { RecurringCadence, ScheduleMode, Task } from './types';

interface UseTasksModalArgs {
  isOpen: boolean;
  agentId: string;
  agentData?: { name?: string };
  onAgentUpdated?: (updatedData: any) => void;
}

export function useTasksModal({ isOpen, agentId, agentData, onAgentUpdated }: UseTasksModalArgs) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('one_time');
  const [oneTimeDate, setOneTimeDate] = useState('');
  const [oneTimeTime, setOneTimeTime] = useState('');
  const [recurringStartDate, setRecurringStartDate] = useState('');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [recurringTime, setRecurringTime] = useState('');
  const [recurringCadence, setRecurringCadence] = useState<RecurringCadence>('daily');
  const [selectedTimezone] = useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  });
  const [targetConversationId, setTargetConversationId] = useState<string>('');

  const loadTasks = useCallback(async () => {
    if (!user?.id || !agentId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('agent_id', agentId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const mapped: Task[] = (data || []).map((row: any) => ({
        id: row.id,
        title: row.name,
        description: row.description || row.instructions || '',
        priority: (row.event_trigger_config?.priority as 'low' | 'medium' | 'high') || 'medium',
        status: row.status,
        schedule: row.cron_expression || row.next_run_at || '',
        created_at: row.created_at,
        cron_expression: row.cron_expression,
        timezone: row.timezone,
        next_run_at: row.next_run_at,
        start_date: row.start_date,
        end_date: row.end_date,
        schedule_label:
          row.max_executions === 1 && row.next_run_at
            ? `Runs once at ${new Date(row.next_run_at).toLocaleString()}`
            : row.cron_expression
              ? parseCronToLabel(row.cron_expression, row.start_date)?.label || row.cron_expression
              : '',
      }));
      setTasks(mapped);
    } catch (error) {
      console.error('Failed to load tasks', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [agentId, user?.id]);

  useEffect(() => {
    if (!isOpen) return;
    setSaved(false);
    loadTasks();
    (async () => {
      try {
        if (!agentId || !user?.id) return;
        const { data } = await supabase
          .from('conversation_sessions')
          .select('conversation_id, title')
          .eq('agent_id', agentId)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('last_active', { ascending: false })
          .limit(50);
        window.__agentopiaConversations = data || [];
      } catch {
        window.__agentopiaConversations = [];
      }
    })();
  }, [agentData, agentId, isOpen, loadTasks, user?.id]);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [saved]);

  const resetForm = () => {
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskPriority('medium');
    setOneTimeDate('');
    setOneTimeTime('');
    setRecurringStartDate('');
    setRecurringEndDate('');
    setRecurringTime('');
    setRecurringCadence('daily');
    setShowNewTaskForm(false);
    setEditingTaskId(null);
    setTargetConversationId('');
  };

  const handleAddTask = useCallback(async () => {
    if (!newTaskTitle.trim() || !user?.id) return;

    try {
      setLoading(true);
      const timezone = selectedTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      let cronExpression: string | null = null;
      let nextRunAt: string | null = null;
      let maxExecutions: number | null = null;
      let startDate: string | null = null;
      let endDate: string | null = null;

      if (scheduleMode === 'one_time') {
        if (!oneTimeDate || !oneTimeTime) {
          toast.error('Please provide a date and time');
          return;
        }
        cronExpression = '* * * * *';
        nextRunAt = toUtcIsoForTimezone(oneTimeDate, oneTimeTime, timezone);
        maxExecutions = 1;
        startDate = nextRunAt;
      } else {
        if (!recurringStartDate || !recurringTime) {
          toast.error('Please provide start date and time');
          return;
        }
        const [hStr, mStr] = recurringTime.split(':');
        const hour = parseInt(hStr, 10) || 0;
        const minute = parseInt(mStr, 10) || 0;
        const anchor = new Date(`${recurringStartDate}T${recurringTime}:00`);
        cronExpression = buildCronExpression(recurringCadence, hour, minute, anchor);
        const firstIso = toUtcIsoForTimezone(recurringStartDate, recurringTime, timezone);
        let firstDate = new Date(firstIso);
        while (firstDate.getTime() <= Date.now()) {
          if (recurringCadence === 'daily') firstDate.setUTCDate(firstDate.getUTCDate() + 1);
          if (recurringCadence === 'weekly') firstDate.setUTCDate(firstDate.getUTCDate() + 7);
          if (recurringCadence === 'monthly') firstDate.setUTCMonth(firstDate.getUTCMonth() + 1);
        }
        nextRunAt = firstDate.toISOString();
        startDate = toUtcIsoForTimezone(recurringStartDate, '00:00', timezone);
        endDate = recurringEndDate ? new Date(`${recurringEndDate}T23:59:59`).toISOString() : null;
      }

      const payload: any = {
        agent_id: agentId,
        user_id: user.id,
        name: newTaskTitle.trim(),
        description: newTaskDescription.trim() || null,
        task_type: 'scheduled',
        status: 'active',
        instructions: newTaskDescription.trim() || newTaskTitle.trim(),
        cron_expression: cronExpression,
        timezone,
        next_run_at: nextRunAt,
        start_date: startDate,
        end_date: endDate,
        max_executions: maxExecutions,
        event_trigger_config: {
          priority: newTaskPriority,
          mode: scheduleMode,
          cadence: scheduleMode === 'recurring' ? recurringCadence : undefined,
        },
        conversation_id: targetConversationId || null,
      };

      if (editingTaskId) {
        const response = await supabase.from('agent_tasks').update(payload).eq('id', editingTaskId);
        if (response.error) throw response.error;
      } else {
        const response = await supabase.from('agent_tasks').insert(payload);
        if (response.error) throw response.error;
      }

      toast.success('Task added! 📝');
      resetForm();
      await loadTasks();
    } catch (error: any) {
      console.error('Add task failed', error);
      toast.error(error?.message || 'Failed to add task');
    } finally {
      setLoading(false);
    }
  }, [
    agentId,
    editingTaskId,
    loadTasks,
    newTaskDescription,
    newTaskPriority,
    newTaskTitle,
    oneTimeDate,
    oneTimeTime,
    recurringCadence,
    recurringEndDate,
    recurringStartDate,
    recurringTime,
    scheduleMode,
    selectedTimezone,
    targetConversationId,
    user?.id,
  ]);

  const handleDeleteTask = async (taskId: string) => {
    try {
      await supabase.from('agent_tasks').delete().eq('id', taskId);
      setTasks((previous) => previous.filter((task) => task.id !== taskId));
      toast.success('Task removed');
    } catch (error) {
      console.error('Delete task failed', error);
      toast.error('Failed to remove task');
    }
  };

  const runTaskNow = async (taskId: string) => {
    try {
      setLoading(true);
      const { data: result, error } = await supabase.functions.invoke('task-executor', {
        body: { action: 'execute_task', task_id: taskId, trigger_type: 'manual' },
      });
      if (error) throw error;
      toast.success('Task executed');

      const conversationId = (result as any)?.conversation_id;
      if (conversationId) {
        try {
          localStorage.setItem(`agent_${agentId}_conversation_id`, conversationId);
          const base: any = {
            agent_id: agentId,
            user_id: user!.id,
            title: newTaskTitle?.trim() ? newTaskTitle.trim() : 'Conversation',
            status: 'active',
            last_active: new Date().toISOString(),
          };
          const updateResult = await supabase
            .from('conversation_sessions')
            .update(base)
            .eq('conversation_id', conversationId)
            .select('conversation_id');
          if (!updateResult?.data || updateResult.data.length === 0) {
            await supabase.from('conversation_sessions').insert({ conversation_id: conversationId, ...base });
          }
        } catch {
          // no-op
        }
        window.dispatchEvent(
          new CustomEvent('agentopia:conversation:activated', {
            detail: { agentId, conversationId },
          }),
        );
      }
    } catch (error) {
      console.error('Execute task failed', error);
      toast.error('Task execution failed');
    } finally {
      setLoading(false);
    }
  };

  const beginEditTask = (task: Task) => {
    setShowNewTaskForm(true);
    setEditingTaskId(task.id);
    setNewTaskTitle(task.title);
    setNewTaskDescription(task.description);
    setNewTaskPriority(task.priority);

    if (task.next_run_at && (!task.cron_expression || task.cron_expression === '* * * * *')) {
      setScheduleMode('one_time');
      const runDate = new Date(task.next_run_at);
      setOneTimeDate(runDate.toISOString().slice(0, 10));
      setOneTimeTime(`${String(runDate.getHours()).padStart(2, '0')}:${String(runDate.getMinutes()).padStart(2, '0')}`);
      return;
    }

    setScheduleMode('recurring');
    const start = task.start_date ? new Date(task.start_date) : new Date();
    setRecurringStartDate(start.toISOString().slice(0, 10));
    setRecurringEndDate(task.end_date ? new Date(task.end_date).toISOString().slice(0, 10) : '');
    const parsed = task.cron_expression ? parseCronToLabel(task.cron_expression, task.start_date) : null;
    setRecurringCadence(parsed?.cadence || 'daily');
    setRecurringTime(parsed?.time || '09:00');
  };

  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    setLoading(true);
    try {
      await loadTasks();
      toast.success('Tasks refreshed');
      setSaved(true);
      onAgentUpdated?.({ tasks });
    } catch (error) {
      console.error('Error updating tasks:', error);
      toast.error('Failed to refresh tasks');
    } finally {
      setLoading(false);
    }
  }, [agentId, loadTasks, onAgentUpdated, tasks, user]);

  return {
    tasks,
    loading,
    saved,
    showNewTaskForm,
    editingTaskId,
    newTaskTitle,
    newTaskDescription,
    newTaskPriority,
    scheduleMode,
    targetConversationId,
    oneTimeDate,
    oneTimeTime,
    recurringStartDate,
    recurringEndDate,
    recurringTime,
    recurringCadence,
    setShowNewTaskForm,
    setNewTaskTitle,
    setNewTaskDescription,
    setNewTaskPriority,
    setScheduleMode,
    setTargetConversationId,
    setOneTimeDate,
    setOneTimeTime,
    setRecurringStartDate,
    setRecurringEndDate,
    setRecurringTime,
    setRecurringCadence,
    handleAddTask,
    beginEditTask,
    runTaskNow,
    handleDeleteTask,
    handleSave,
  };
}
