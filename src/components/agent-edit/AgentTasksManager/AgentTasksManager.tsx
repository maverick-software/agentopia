import { useEffect, useState } from 'react';
import { Loader2, Plus, Settings } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DEFAULT_TASK_FORM_DATA, AgentTask, AgentTasksManagerProps, TaskFormData } from './types';
import { TaskForm } from './TaskForm';
import { TaskList } from './TaskList';
import { TOTAL_STEPS } from './taskUtils';

export const AgentTasksManager: React.FC<AgentTasksManagerProps> = ({ agentId, availableTools }) => {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<AgentTask | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<TaskFormData>(DEFAULT_TASK_FORM_DATA);
  const supabase = useSupabaseClient();

  useEffect(() => {
    fetchTasks();
  }, [agentId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error('No authenticated session');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-tasks?agent_id=${agentId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(DEFAULT_TASK_FORM_DATA);
    setCurrentStep(1);
  };

  const getAccessToken = async () => (await supabase.auth.getSession()).data.session?.access_token;

  const handleCreateTask = async () => {
    try {
      setSaving(true);
      const { error } = await supabase.functions.invoke('agent-tasks', {
        body: {
          agent_id: agentId,
          ...formData,
          instructions: formData.description,
          selected_tools: formData.selected_tools,
        },
        headers: { 'Content-Type': 'application/json' },
      });
      if (error) throw new Error(error.message || 'Failed to create task');
      toast.success('Task created successfully');
      setShowCreateDialog(false);
      resetForm();
      fetchTasks();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTask = async (task: AgentTask) => {
    try {
      setSaving(true);
      const response = await fetch(`/functions/v1/agent-tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${await getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...formData, instructions: formData.description }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update task');
      }
      toast.success('Task updated successfully');
      setEditingTask(null);
      resetForm();
      fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      const response = await fetch(`/functions/v1/agent-tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${await getAccessToken()}` },
      });
      if (!response.ok) throw new Error('Failed to delete task');
      toast.success('Task deleted successfully');
      fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };

  const handleToggleTaskStatus = async (task: AgentTask) => {
    const newStatus = task.status === 'active' ? 'paused' : 'active';
    try {
      const response = await fetch(`/functions/v1/agent-tasks/${task.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${await getAccessToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error('Failed to update task status');
      toast.success(`Task ${newStatus === 'active' ? 'activated' : 'paused'}`);
      fetchTasks();
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error('Failed to update task status');
    }
  };

  const handleRunTaskNow = async (taskId: string) => {
    try {
      const { error } = await supabase.functions.invoke('task-executor', {
        body: { action: 'execute_task', task_id: taskId, trigger_type: 'manual', trigger_data: {} },
        headers: { 'Content-Type': 'application/json' },
      });
      if (error) throw new Error(error.message || 'Failed to execute task');
      toast.success('Task executed successfully');
      fetchTasks();
    } catch (error) {
      console.error('Error executing task:', error);
      toast.error('Failed to execute task');
    }
  };

  const startEditing = (task: AgentTask) => {
    setFormData({
      name: task.name,
      description: task.instructions || task.description || '',
      task_type: task.task_type,
      instructions: task.instructions,
      selected_tools: task.selected_tools,
      cron_expression: task.cron_expression || '',
      timezone: task.timezone,
      event_trigger_type: task.event_trigger_type || '',
      event_trigger_config: task.event_trigger_config || {},
      max_executions: task.max_executions,
      start_date: task.start_date ? task.start_date.split('T')[0] : '',
      end_date: task.end_date ? task.end_date.split('T')[0] : '',
    });
    setCurrentStep(TOTAL_STEPS);
    setEditingTask(task);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Tasks</CardTitle>
          <CardDescription>Manage scheduled and event-based tasks for this agent</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Tasks</CardTitle>
            <CardDescription>Manage scheduled and event-based tasks for this agent</CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Task</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>Create a scheduled or event-based task for your agent</DialogDescription>
              </DialogHeader>
              <TaskForm
                agentId={agentId}
                formData={formData}
                currentStep={currentStep}
                saving={saving}
                isEditing={false}
                onChange={setFormData}
                onPrevStep={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                onNextStep={() => setCurrentStep((prev) => Math.min(TOTAL_STEPS, prev + 1))}
                onSubmit={handleCreateTask}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }} disabled={saving}>Cancel</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No tasks configured</p>
            <p className="mb-4">Create your first task to automate agent actions</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Task
            </Button>
          </div>
        ) : (
          <TaskList
            tasks={tasks}
            availableTools={availableTools}
            expandedTask={expandedTask}
            onExpandTask={setExpandedTask}
            onRunNow={handleRunTaskNow}
            onToggleStatus={handleToggleTaskStatus}
            onEdit={startEditing}
            onDelete={handleDeleteTask}
          />
        )}

        <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
              <DialogDescription>Update the task configuration</DialogDescription>
            </DialogHeader>
            <TaskForm
              agentId={agentId}
              formData={formData}
              currentStep={currentStep}
              saving={saving}
              isEditing
              onChange={setFormData}
              onPrevStep={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
              onNextStep={() => setCurrentStep((prev) => Math.min(TOTAL_STEPS, prev + 1))}
              onSubmit={() => editingTask && handleUpdateTask(editingTask)}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditingTask(null); resetForm(); }} disabled={saving}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
