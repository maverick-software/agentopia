import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Check, 
  Target,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Users,
  FileText,
  Zap,
  Star,
  Archive
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

interface TasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
  openWizardOnOpen?: boolean;
}

interface Task {
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

// Simple helpers to build cron and next run
function buildCronExpression(cadence: 'daily'|'weekly'|'monthly', hour: number, minute: number, anchorDate: Date): string {
  const m = `${minute}`;
  const h = `${hour}`;
  if (cadence === 'daily') return `${m} ${h} * * *`;
  if (cadence === 'weekly') {
    const dow = anchorDate.getDay(); // 0-6 (Sun-Sat)
    return `${m} ${h} * * ${dow}`;
  }
  // monthly
  const dom = anchorDate.getDate();
  return `${m} ${h} ${dom} * *`;
}

function computeNextRunAt(cadence: 'daily'|'weekly'|'monthly', startDate: Date, hour: number, minute: number): Date {
  const tzStart = new Date(startDate);
  tzStart.setHours(hour, minute, 0, 0);
  const now = new Date();
  if (cadence === 'daily') {
    if (tzStart > now) return tzStart;
    const d = new Date(tzStart);
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (cadence === 'weekly') {
    let d = new Date(tzStart);
    while (d <= now) {
      d.setDate(d.getDate() + 7);
    }
    return d;
  }
  // monthly
  let d = new Date(tzStart);
  while (d <= now) {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

function parseCronToLabel(cron: string, startDateIso?: string | null): { label: string, cadence: 'daily'|'weekly'|'monthly', time: string } | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [m, h, dom, _mon, dow] = parts;
  const mm = Number(m);
  const hh = Number(h);
  const time = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  if (dom === '*' && dow === '*') {
    return { label: `Daily at ${time}` , cadence: 'daily', time };
  }
  if (dow !== '*') {
    const anchor = startDateIso ? new Date(startDateIso) : new Date();
    const weekday = anchor.toLocaleDateString(undefined, { weekday: 'long' });
    return { label: `Weekly on ${weekday} at ${time}`, cadence: 'weekly', time };
  }
  if (dom !== '*') {
    const anchor = startDateIso ? new Date(startDateIso) : new Date();
    const day = anchor.getDate();
    return { label: `Monthly on day ${day} at ${time}`, cadence: 'monthly', time };
  }
  return null;
}

export function TasksModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated,
  openWizardOnOpen
}: TasksModalProps) {
  const { user } = useAuth();
  
  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  
  // New task form
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  // Removed priority; keep internal default only for backward compatibility mapping
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [scheduleMode, setScheduleMode] = useState<'one_time'|'recurring'>('one_time');
  const [oneTimeDate, setOneTimeDate] = useState(''); // yyyy-mm-dd
  const [oneTimeTime, setOneTimeTime] = useState(''); // HH:MM
  const [recurringStartDate, setRecurringStartDate] = useState('');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [recurringTime, setRecurringTime] = useState('');
  const [recurringCadence, setRecurringCadence] = useState<'daily'|'weekly'|'monthly'>('daily');
  const [everyInterval, setEveryInterval] = useState<number>(1);
  const [everyUnit, setEveryUnit] = useState<'minute'|'hour'|'day'|'week'|'month'|'year'>('day');
  const [selectedTimezone, setSelectedTimezone] = useState<string>(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
  });

  // Timezone helpers
  const formatTimezoneLabel = (tz: string): string => {
    try {
      return tz.split('/').map((p) => p.replace(/_/g, ' ')).join(' / ');
    } catch {
      return tz;
    }
  };
  const getSupportedTimezones = (): string[] => {
    const fallback = ['UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London','Europe/Berlin','Asia/Tokyo','Asia/Kolkata','Australia/Sydney'];
    // @ts-ignore
    if (typeof (Intl as any).supportedValuesOf === 'function') {
      try { return (Intl as any).supportedValuesOf('timeZone') as string[]; } catch { return fallback; }
    }
    return fallback;
  };

  const toUtcIsoForTimezone = (dateStr: string, timeStr: string, tz: string): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm] = timeStr.split(':').map(Number);
    // Build a UTC date from components (treating them as UTC)
    const asUtc = new Date(Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0));
    // Find what that UTC time looks like in the target timezone, then adjust by the diff
    const tzDate = new Date(asUtc.toLocaleString('en-US', { timeZone: tz }));
    const offsetMs = asUtc.getTime() - tzDate.getTime();
    const target = new Date(asUtc.getTime() + offsetMs);
    return target.toISOString();
  };
  const [targetConversationId, setTargetConversationId] = useState<string>('');

  // Build cron from a simple "every N [unit]" pattern using the first-run anchor
  const buildCronFromEvery = (
    firstDateISO: string,
    interval: number,
    unit: 'minute'|'hour'|'day'|'week'|'month'|'year'
  ): string => {
    const d = new Date(firstDateISO);
    const mm = d.getUTCMinutes();
    const hh = d.getUTCHours();
    const dom = d.getUTCDate();
    const mon = d.getUTCMonth() + 1; // 1-12
    const dow = d.getUTCDay(); // 0-6
    const iv = Math.max(1, interval);
    const pad = (n: number) => `${n}`;

    switch (unit) {
      case 'minute':
        return `*/${iv} * * * *`;
      case 'hour':
        return `${pad(mm)} */${iv} * * *`;
      case 'day':
        return `${pad(mm)} ${pad(hh)} */${iv} * *`;
      case 'week':
        // Cron does not support every N weeks natively; approximate as weekly on selected weekday
        return `${pad(mm)} ${pad(hh)} * * ${dow}`;
      case 'month':
        return `${pad(mm)} ${pad(hh)} ${pad(dom)} */${iv} *`;
      case 'year':
        // No year field; pin to specific month/day
        return `${pad(mm)} ${pad(hh)} ${pad(dom)} ${pad(mon)} *`;
    }
  };

  // Hydrate basic every-structure from a cron pattern when editing
  const hydrateRecurrenceFromCron = (cron: string) => {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return;
    const [m, h, dom, mon, dow] = parts;
    const num = (s: string) => parseInt(s, 10);
    if (/^\*\/(\d+)$/.test(m) && h === '*' && dom === '*' && mon === '*' && dow === '*') {
      setEveryUnit('minute');
      setEveryInterval(Math.max(1, num(m.split('/')[1])));
      return;
    }
    if (/^\d+$/.test(m) && /^\*\/(\d+)$/.test(h) && dom === '*' && mon === '*' && dow === '*') {
      setEveryUnit('hour');
      setEveryInterval(Math.max(1, num(h.split('/')[1])));
      return;
    }
    if (/^\d+$/.test(m) && /^\d+$/.test(h) && /^\*\/(\d+)$/.test(dom) && mon === '*' && dow === '*') {
      setEveryUnit('day');
      setEveryInterval(Math.max(1, num(dom.split('/')[1])));
      return;
    }
    if (/^\d+$/.test(m) && /^\d+$/.test(h) && dom === '*' && mon === '*' && /^\d$/.test(dow)) {
      setEveryUnit('week');
      setEveryInterval(1);
      return;
    }
    if (/^\d+$/.test(m) && /^\d+$/.test(h) && /^\d+$/.test(dom) && /^\*\/(\d+)$/.test(mon) && dow === '*') {
      setEveryUnit('month');
      setEveryInterval(Math.max(1, num(mon.split('/')[1])));
      return;
    }
    if (/^\d+$/.test(m) && /^\d+$/.test(h) && /^\d+$/.test(dom) && /^\d+$/.test(mon) && dow === '*') {
      setEveryUnit('year');
      setEveryInterval(1);
      return;
    }
  };

  // Load tasks from DB
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
        priority: (row.event_trigger_config?.priority as 'low'|'medium'|'high') || 'medium',
        status: row.status,
        schedule: row.cron_expression || row.next_run_at || '',
        created_at: row.created_at,
        cron_expression: row.cron_expression,
        timezone: row.timezone,
        next_run_at: row.next_run_at,
        start_date: row.start_date,
        end_date: row.end_date,
        schedule_label: row.max_executions === 1 && row.next_run_at
          ? `Runs once at ${new Date(row.next_run_at).toLocaleString()}`
          : (row.cron_expression ? (parseCronToLabel(row.cron_expression, row.start_date)?.label || row.cron_expression) : ''),
      }));
      setTasks(mapped);
    } catch (e: any) {
      console.error('Failed to load tasks', e);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [user?.id, agentId]);

  useEffect(() => {
    if (isOpen) {
      setSaved(false);
      loadTasks();
      // Reset view to list by default; optionally open wizard on demand
      const shouldOpenWizard = !!openWizardOnOpen;
      setShowNewTaskForm(shouldOpenWizard);
      if (shouldOpenWizard) setCurrentStep(1);
      // Lightweight fetch to populate conversation selector
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
          (window as any).__agentopiaConversations = data || [];
        } catch {}
      })();
    }
  }, [isOpen, agentData, loadTasks]);

  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const handleAddTask = useCallback(async () => {
    if (!newTaskTitle.trim() || !user?.id) return;
    try {
      setLoading(true);
      const timezone = selectedTimezone || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

      let cron_expression: string | null = null;
      let next_run_at: string | null = null;
      let max_executions: number | null = null;
      let start_date: string | null = null;
      let end_date: string | null = null;

      if (scheduleMode === 'one_time') {
        if (!oneTimeDate || !oneTimeTime) {
          toast.error('Please provide a date and time');
          setLoading(false);
          return;
        }
        const [hStr, mStr] = oneTimeTime.split(':');
        const h = parseInt(hStr, 10) || 0;
        const m = parseInt(mStr, 10) || 0;
        // Use a harmless cron; executor uses next_run_at then will complete due to max_executions=1
        cron_expression = '* * * * *';
        const runAtUtcIso = toUtcIsoForTimezone(oneTimeDate, oneTimeTime, timezone);
        next_run_at = runAtUtcIso;
        max_executions = 1;
        start_date = runAtUtcIso;
      } else {
        // recurring
        if (!recurringStartDate || !recurringTime) {
          toast.error('Please provide start date and time');
          setLoading(false);
          return;
        }
        // First intended occurrence in selected timezone (to UTC ISO)
        const firstIso = toUtcIsoForTimezone(recurringStartDate, recurringTime, timezone);
        // Build cron from step-3 recurrence selection
        cron_expression = buildCronFromEvery(firstIso, everyInterval, everyUnit);
        const nowUtcMs = Date.now();
        // If first run is in the past, roll forward one interval in tz
        let firstDate = new Date(firstIso);
        while (firstDate.getTime() <= nowUtcMs) {
          if (everyUnit === 'day') {
            const d2 = new Date(firstDate);
            d2.setUTCDate(d2.getUTCDate() + 1);
            firstDate = d2;
          } else if (everyUnit === 'week') {
            const d2 = new Date(firstDate);
            d2.setUTCDate(d2.getUTCDate() + 7);
            firstDate = d2;
          } else {
            const d2 = new Date(firstDate);
            d2.setUTCMonth(d2.getUTCMonth() + 1);
            firstDate = d2;
          }
        }
        next_run_at = firstDate.toISOString();
        // Store start_date as midnight in selected tz converted to UTC
        start_date = toUtcIsoForTimezone(recurringStartDate, '00:00', timezone);
        end_date = recurringEndDate ? new Date(`${recurringEndDate}T23:59:59`).toISOString() : null;
      }

      const payload: any = {
        agent_id: agentId,
        user_id: user.id,
        name: newTaskTitle.trim(),
        description: newTaskDescription.trim() || null,
        task_type: 'scheduled',
      status: 'active',
        instructions: newTaskDescription.trim() || newTaskTitle.trim(),
        cron_expression,
        timezone,
        next_run_at,
        start_date,
        end_date,
        max_executions,
        event_trigger_config: {
          mode: scheduleMode,
          every_interval: scheduleMode==='recurring' ? everyInterval : undefined,
          every_unit: scheduleMode==='recurring' ? everyUnit : undefined
        },
        conversation_id: targetConversationId || null,
      };

      let error: any = null;
      if (editingTaskId) {
        const resp = await supabase.from('agent_tasks').update(payload).eq('id', editingTaskId);
        error = resp.error;
      } else {
        const resp = await supabase.from('agent_tasks').insert(payload);
        error = resp.error;
      }
      if (error) throw error;
      toast.success('Task added! 📝');
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
      await loadTasks();
    } catch (e: any) {
      console.error('Add task failed', e);
      toast.error(e?.message || 'Failed to add task');
    } finally {
      setLoading(false);
    }
  }, [newTaskTitle, newTaskDescription, newTaskPriority, user?.id, agentId, scheduleMode, oneTimeDate, oneTimeTime, recurringStartDate, recurringEndDate, recurringTime, recurringCadence, loadTasks, editingTaskId]);

  const handleToggleTaskStatus = async (taskId: string) => {
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;
    const next = t.status === 'active' ? 'paused' : 'active';
    try {
      await supabase.from('agent_tasks').update({ status: next }).eq('id', taskId);
      setTasks(prev => prev.map(task => task.id === taskId ? { ...task, status: next } : task));
    } catch (e: any) {
      console.error('Toggle status failed', e);
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await supabase.from('agent_tasks').delete().eq('id', taskId);
      setTasks(prev => prev.filter(task => task.id !== taskId));
      toast.success('Task removed');
    } catch (e: any) {
      console.error('Delete task failed', e);
      toast.error('Failed to remove task');
    }
  };

  const runTaskNow = async (taskId: string) => {
    try {
      setLoading(true);
      const { data: result, error } = await supabase.functions.invoke('task-executor', {
        body: { action: 'execute_task', task_id: taskId, trigger_type: 'manual' }
      });
      if (error) throw error;
      toast.success('Task executed');
      console.log('Task execution result:', result);
      // If a conversation was created/used, make it active and refresh chat view
      const convoId = (result as any)?.conversation_id;
      if (convoId) {
        try {
          localStorage.setItem(`agent_${agentId}_conversation_id`, convoId);
          // Ensure the conversation exists/visible under RLS and bump last_active using update-or-insert
          const base: any = {
            agent_id: agentId,
            user_id: user!.id,
            title: newTaskTitle?.trim() ? newTaskTitle.trim() : 'Conversation',
            status: 'active',
            last_active: new Date().toISOString(),
          };
          const upd = await supabase
            .from('conversation_sessions')
            .update(base)
            .eq('conversation_id', convoId)
            .select('conversation_id');
          if (!upd || !upd.data || upd.data.length === 0) {
            await supabase
              .from('conversation_sessions')
              .insert({ conversation_id: convoId, ...base });
          }
        } catch {}
        // Best-effort: dispatch a custom event to let chat page react
        window.dispatchEvent(new CustomEvent('agentopia:conversation:activated', { detail: { agentId, conversationId: convoId } }));
      }
    } catch (e: any) {
      console.error('Execute task failed', e);
      toast.error('Task execution failed');
    } finally {
      setLoading(false);
    }
  };

  // Begin edit of existing task
  const beginEditTask = (task: Task) => {
    setShowNewTaskForm(true);
    setEditingTaskId(task.id);
    setNewTaskTitle(task.title);
    setNewTaskDescription(task.description);
    setSelectedTimezone(task.timezone || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'));
    // infer mode
    if (task.next_run_at && (!task.cron_expression || task.cron_expression === '* * * * *')) {
      setScheduleMode('one_time');
      const d = new Date(task.next_run_at);
      setOneTimeDate(d.toISOString().slice(0,10));
      setOneTimeTime(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);
    } else {
      setScheduleMode('recurring');
      const start = task.start_date ? new Date(task.start_date) : new Date();
      setRecurringStartDate(start.toISOString().slice(0,10));
      setRecurringEndDate(task.end_date ? new Date(task.end_date).toISOString().slice(0,10) : '');
      const parsed = task.cron_expression ? parseCronToLabel(task.cron_expression, task.start_date) : null;
      setRecurringTime(parsed?.time || '09:00');
      if (task.cron_expression) hydrateRecurrenceFromCron(task.cron_expression);
    }
    setCurrentStep(1);
  };

  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    setLoading(true);
    try {
      await loadTasks();
      toast.success('Tasks refreshed');
      setSaved(true);
      if (onAgentUpdated) {
        onAgentUpdated({ tasks });
      }
    } catch (error: any) {
      console.error('Error updating tasks:', error);
      toast.error('Failed to refresh tasks');
    } finally {
      setLoading(false);
    }
  }, [agentId, user, onAgentUpdated, tasks, loadTasks]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800';
      case 'low': return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'paused': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'completed': return <Check className="h-4 w-4 text-blue-500" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const hasChanges = () => true;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0">
        <>
          {!showNewTaskForm && (
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle className="text-xl font-semibold flex items-center">
                🎯 Scheduled Tasks
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Create and manage recurring or one-time tasks for this agent.
              </DialogDescription>
            </DialogHeader>
          )}
          <div className="px-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                {!showNewTaskForm && (
                  <h3 className="text-sm font-medium">Task scheduler</h3>
                )}
                {!showNewTaskForm && (
                  <Button
                    onClick={() => { setShowNewTaskForm(true); setCurrentStep(1); }}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0 shadow-lg text-sm px-4 py-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    ✨ Add Task
                  </Button>
                )}
              </div>

              {showNewTaskForm && (
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 via-purple-50 to-cyan-50 dark:from-blue-950/30 dark:via-purple-950/30 dark:to-cyan-950/30 border border-blue-200 dark:border-blue-800">
                {/* Header with gradient */}
                <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                  <h4 className="font-semibold text-lg flex items-center">
                    <span className="mr-2">🪄</span> Schedule Task
                  </h4>
                  <p className="text-blue-100 text-sm mt-1">Create automated tasks for your agent</p>
                </div>
                
                {/* Modern Step Indicator */}
                <div className="px-6 py-4 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    {[
                      { num: 1, label: 'Type', icon: '⚡', color: 'text-blue-600' },
                      { num: 2, label: 'Schedule', icon: '📅', color: 'text-green-600' },
                      ...(scheduleMode === 'recurring' ? [{ num: 3, label: 'Recurrence', icon: '🔄', color: 'text-orange-600' }] : []),
                      { num: 4, label: 'Instructions', icon: '📝', color: 'text-purple-600' },
                      { num: 5, label: 'Title', icon: '🏷️', color: 'text-pink-600' },
                      { num: 6, label: 'Conversation', icon: '💬', color: 'text-cyan-600' }
                    ].map((step, index) => {
                      const adjustedStepNum = scheduleMode === 'recurring' ? step.num : (step.num > 3 ? step.num - 1 : step.num);
                      const isActive = currentStep === adjustedStepNum;
                      const isCompleted = currentStep > adjustedStepNum;
                      
                      return (
                        <div key={step.num} className="flex items-center">
                          <div className={`
                            flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300
                            ${isActive 
                              ? `${step.color} bg-white border-current shadow-lg scale-110` 
                              : isCompleted 
                                ? 'bg-green-500 border-green-500 text-white' 
                                : 'bg-gray-100 border-gray-300 text-gray-400'
                            }
                          `}>
                            {isCompleted ? '✓' : step.icon}
                          </div>
                          <div className="ml-2">
                            <div className={`text-xs font-medium ${isActive ? step.color : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                              {step.label}
                            </div>
                          </div>
                          {index < ([
                            { num: 1, label: 'Type', icon: '⚡', color: 'text-blue-600' },
                            { num: 2, label: 'Schedule', icon: '📅', color: 'text-green-600' },
                            ...(scheduleMode === 'recurring' ? [{ num: 3, label: 'Recurrence', icon: '🔄', color: 'text-orange-600' }] : []),
                            { num: 4, label: 'Instructions', icon: '📝', color: 'text-purple-600' },
                            { num: 5, label: 'Title', icon: '🏷️', color: 'text-pink-600' },
                            { num: 6, label: 'Conversation', icon: '💬', color: 'text-cyan-600' }
                          ].length - 1) && (
                            <div className={`w-8 h-0.5 mx-2 ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Content Area */}
                <div className="px-6 py-6 space-y-6">

                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                        Choose Your Task Type
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Select whether this task runs once or repeats on a schedule
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setScheduleMode('one_time')}
                        className={`
                          group relative p-6 rounded-xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg
                          ${scheduleMode === 'one_time' 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 shadow-lg' 
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300'
                          }
                        `}
                      >
                        <div className="text-center">
                          <div className="text-3xl mb-3">⚡</div>
                          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">One-time</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Run once at a specific time</p>
                        </div>
                        {scheduleMode === 'one_time' && (
                          <div className="absolute top-2 right-2">
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">✓</span>
                            </div>
                          </div>
                        )}
                      </button>
                      
                      <button
                        onClick={() => setScheduleMode('recurring')}
                        className={`
                          group relative p-6 rounded-xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg
                          ${scheduleMode === 'recurring' 
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/50 shadow-lg' 
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300'
                          }
                        `}
                      >
                        <div className="text-center">
                          <div className="text-3xl mb-3">🔄</div>
                          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Recurring</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Repeat on a schedule</p>
                        </div>
                        {scheduleMode === 'recurring' && (
                          <div className="absolute top-2 right-2">
                            <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">✓</span>
                            </div>
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                        📅 Set Your Schedule
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Choose when this task should {scheduleMode === 'one_time' ? 'run' : 'start running'}
                      </p>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-green-200 dark:border-green-800 shadow-sm">
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="space-y-2">
                          <label className="flex items-center text-sm font-medium text-green-700 dark:text-green-400">
                            <span className="mr-2">📅</span> {scheduleMode === 'one_time' ? 'Date' : 'Start date'}
                          </label>
                  <Input
                            type="date" 
                            value={scheduleMode==='one_time'? oneTimeDate : recurringStartDate} 
                            onChange={(e) => (scheduleMode==='one_time'? setOneTimeDate : setRecurringStartDate)(e.target.value)} 
                            className="border-green-300 dark:border-green-700 focus:border-green-500 dark:focus:border-green-500" 
                          />
                        </div>
                        {scheduleMode === 'recurring' && (
                          <div className="space-y-2">
                            <label className="flex items-center text-sm font-medium text-green-700 dark:text-green-400">
                              <span className="mr-2">🏁</span> End date (optional)
                            </label>
                            <Input 
                              type="date" 
                              value={recurringEndDate} 
                              onChange={(e) => setRecurringEndDate(e.target.value)} 
                              className="border-green-300 dark:border-green-700 focus:border-green-500 dark:focus:border-green-500" 
                            />
                    </div>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        <label className="flex items-center text-sm font-medium text-green-700 dark:text-green-400">
                          <span className="mr-2">🕐</span> Select a time:
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs text-gray-600 dark:text-gray-400">Time</label>
                            <Input 
                              type="time" 
                              value={scheduleMode==='one_time'? oneTimeTime : recurringTime} 
                              onChange={(e) => (scheduleMode==='one_time'? setOneTimeTime : setRecurringTime)(e.target.value)} 
                              className="border-green-300 dark:border-green-700 focus:border-green-500 dark:focus:border-green-500" 
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs text-gray-600 dark:text-gray-400">Timezone</label>
                      <select
                              value={selectedTimezone}
                              onChange={(e) => setSelectedTimezone(e.target.value)}
                              className="w-full p-2 border border-green-300 dark:border-green-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-green-500 dark:focus:border-green-500 focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800"
                            >
                              {getSupportedTimezones().map(tz => (
                                <option key={tz} value={tz}>{formatTimezoneLabel(tz)}</option>
                              ))}
                      </select>
                    </div>
                  </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 3 && scheduleMode==='recurring' && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                        🔄 Set Recurrence
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        How often should this task repeat?
                      </p>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-orange-200 dark:border-orange-800 shadow-sm">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="flex items-center text-sm font-medium text-orange-700 dark:text-orange-400">
                            <span className="mr-2">🔢</span> Every
                          </label>
                          <Input 
                            type="number" 
                            min={1} 
                            value={everyInterval} 
                            onChange={(e) => setEveryInterval(Math.max(1, parseInt(e.target.value || '1', 10)))} 
                            className="border-orange-300 dark:border-orange-700 focus:border-orange-500 dark:focus:border-orange-500" 
                          />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <label className="flex items-center text-sm font-medium text-orange-700 dark:text-orange-400">
                            <span className="mr-2">⏰</span> Time unit
                          </label>
                    <select
                            value={everyUnit}
                            onChange={(e) => setEveryUnit(e.target.value as any)}
                            className="w-full p-2 border border-orange-300 dark:border-orange-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-orange-500 dark:focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-800"
                          >
                            <option value="minute">Minute(s)</option>
                            <option value="hour">Hour(s)</option>
                            <option value="day">Day(s)</option>
                            <option value="week">Week(s)</option>
                            <option value="month">Month(s)</option>
                            <option value="year">Year(s)</option>
                    </select>
                  </div>
                      </div>
                      <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                        <p className="text-xs text-orange-700 dark:text-orange-400 flex items-center">
                          <span className="mr-2">💡</span>
                          For weeks and years, intervals greater than 1 are approximated due to cron limits.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                        📝 Task Instructions
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Tell your agent exactly what you want it to do
                      </p>
                      </div>
                    
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-purple-200 dark:border-purple-800 shadow-sm">
                      <label className="flex items-center text-sm font-medium text-purple-700 dark:text-purple-400 mb-3">
                        <span className="mr-2">💭</span> Instructions
                      </label>
                      <Textarea 
                        placeholder="Be specific about what you want the agent to do. For example: 'Search for the latest AI news and summarize the top 3 articles' or 'Check our company's social media engagement and provide a brief report.'" 
                        value={newTaskDescription} 
                        onChange={(e) => setNewTaskDescription(e.target.value)} 
                        className="min-h-[120px] resize-none border-purple-300 dark:border-purple-700 focus:border-purple-500 dark:focus:border-purple-500 bg-purple-50/30 dark:bg-purple-950/20" 
                      />
                      <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                        <p className="text-xs text-purple-700 dark:text-purple-400 flex items-center">
                          <span className="mr-2">✨</span>
                          Clear instructions help your agent perform tasks more effectively
                        </p>
                      </div>
                    </div>
                        </div>
                )}

                {currentStep === 5 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                        🏷️ Name Your Task
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Give your task a memorable title
                      </p>
                        </div>
                    
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-pink-200 dark:border-pink-800 shadow-sm">
                      <label className="flex items-center text-sm font-medium text-pink-700 dark:text-pink-400 mb-3">
                        <span className="mr-2">✍️</span> Task Title
                      </label>
                      <Input 
                        placeholder="e.g., Daily Market Research, Weekly Social Media Check" 
                        value={newTaskTitle} 
                        onChange={(e) => setNewTaskTitle(e.target.value)} 
                        className="border-pink-300 dark:border-pink-700 focus:border-pink-500 dark:focus:border-pink-500 bg-pink-50/30 dark:bg-pink-950/20"
                      />
                      <div className="mt-3 p-3 bg-pink-50 dark:bg-pink-950/30 rounded-lg border border-pink-200 dark:border-pink-800">
                        <p className="text-xs text-pink-700 dark:text-pink-400 flex items-center">
                          <span className="mr-2">💡</span>
                          Choose a title that makes it easy to identify this task later
                        </p>
                        </div>
                      </div>
                  </div>
                )}

                {currentStep === 6 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                        💬 Choose Conversation
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Where should the task results be sent?
                      </p>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-cyan-200 dark:border-cyan-800 shadow-sm">
                      <label className="flex items-center text-sm font-medium text-cyan-700 dark:text-cyan-400 mb-3">
                        <span className="mr-2">🗨️</span> Conversation destination
                      </label>
                        <select
                        value={targetConversationId}
                        onChange={(e) => setTargetConversationId(e.target.value)}
                        className="w-full p-3 border border-cyan-300 dark:border-cyan-700 rounded-lg text-sm bg-cyan-50/30 dark:bg-cyan-950/20 text-gray-800 dark:text-gray-200 focus:border-cyan-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:focus:ring-cyan-800"
                      >
                        <option value="">✨ Create a new conversation</option>
                        {(Array.isArray(window.__agentopiaConversations) ? window.__agentopiaConversations : []).map((c: any) => (
                          <option key={c.conversation_id} value={c.conversation_id}>💬 {c.title || 'Conversation'}</option>
                        ))}
                        </select>
                      <div className="mt-3 p-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-lg border border-cyan-200 dark:border-cyan-800">
                        <p className="text-xs text-cyan-700 dark:text-cyan-400 flex items-center">
                          <span className="mr-2">🎯</span>
                          {targetConversationId ? 'Task results will be added to the selected conversation' : 'A new conversation will be created for this task'}
                        </p>
                      </div>
                    </div>
                  </div>
                  )}

                {/* Modern Navigation Footer */}
                <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => { setShowNewTaskForm(false); setCurrentStep(1); }}
                        className="border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        ❌ Cancel
                    </Button>
                      {currentStep > 1 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                          onClick={() => {
                            const prev = (scheduleMode === 'one_time' && currentStep === 4) ? 2 : currentStep - 1;
                            setCurrentStep(prev);
                          }}
                          className="border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                        >
                          ← Back
                    </Button>
                      )}
                    </div>
                    <div className="flex space-x-3">
                      {currentStep < (scheduleMode==='recurring' ? 7 : 6) && (
                        <Button 
                          size="sm" 
                          onClick={() => {
                            let next = currentStep + 1;
                            if (scheduleMode === 'one_time' && currentStep === 2) next = 4; // skip recurrence
                            setCurrentStep(next);
                          }} 
                          disabled={
                            (currentStep===1 && !scheduleMode) ||
                            (currentStep===2 && ((scheduleMode==='one_time' && (!oneTimeDate || !oneTimeTime)) || (scheduleMode==='recurring' && (!recurringStartDate || !recurringTime)))) ||
                            (currentStep===3 && scheduleMode==='recurring' && (!everyInterval || everyInterval < 1)) ||
                            (currentStep===4 && !newTaskDescription.trim()) ||
                            (currentStep===5 && !newTaskTitle.trim())
                          }
                          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0 shadow-lg"
                        >
                          Next → ✨
                        </Button>
                      )}
                      {currentStep === (scheduleMode==='recurring' ? 7 : 6) && (
                        <Button 
                          size="sm" 
                          onClick={handleAddTask} 
                          disabled={!newTaskTitle.trim() || !newTaskDescription.trim()}
                          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0 shadow-lg"
                        >
                          🚀 Save and Exit
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              )}

              {/* Task List (only when not in wizard) */}
              {!showNewTaskForm && (
                <>
                  {tasks.length > 0 ? (
                    <div className="space-y-2">
                                            {tasks.map(task => (
                        <div
                          key={task.id}
                          className={`p-6 rounded-xl border-2 transition-all duration-300 hover:shadow-lg ${
                            task.status === 'active'
                              ? 'border-green-300 dark:border-green-700 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 shadow-md'
                              : 'border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800'
                          }`}
                        >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {getStatusIcon(task.status)}
                        <h4 className="font-medium text-sm">{task.title}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
                      {(task.schedule_label || task.cron_expression || task.schedule) && (
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{task.schedule_label || task.cron_expression || task.schedule}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => beginEditTask(task)}
                        className="h-9 px-3 border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-all duration-200"
                        title="Edit Task"
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runTaskNow(task.id)}
                        className="h-9 px-3 border-green-300 dark:border-green-600 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/50 transition-all duration-200"
                        title="Run Task Now"
                      >
                        <Zap className="h-3 w-3 mr-1" />
                        Run
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTask(task.id)}
                        className="h-9 px-3 border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-all duration-200"
                        title="Delete Task"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl flex flex-col items-center justify-center bg-gradient-to-br from-blue-50/50 via-purple-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-cyan-950/20">
                      <div className="text-6xl mb-4">🎯</div>
                      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No tasks yet</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6 max-w-md">
                        Create your first automated task to have your agent work on a schedule
                      </p>
                      <Button 
                        onClick={() => { setShowNewTaskForm(true); setCurrentStep(1); }}
                        className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0 shadow-lg px-8 py-3"
                      >
                        <Plus className="h-4 w-4 mr-2" /> ✨ Create Your First Task
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {!showNewTaskForm && (
            <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Close
              </Button>
            </DialogFooter>
          )}
        </>
      </DialogContent>
    </Dialog>
  );
}
 