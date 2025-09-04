import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Plus, Clock, History, CheckCircle2, AlertCircle, Check, Edit2, Trash2 } from 'lucide-react';
import { TaskWizardModal } from '../TaskWizardModal';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { parseCronExpression, formatNextRunTime, getServerTime } from '@/utils/cronUtils';
import { useAgentTaskStatus } from '@/hooks/useAgentTaskStatus';

interface Task {
  id: string;
  title: string;
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
  next_run_at?: string;
  name?: string; // Some tasks use 'name' instead of 'title'
}

// Component to display next run time with server time verification
function NextRunTimeDisplay({ nextRunAt, isOneTime, supabase }: { nextRunAt: string; isOneTime: boolean; supabase: any }) {
  const [timeText, setTimeText] = useState('Loading...');

  useEffect(() => {
    const calculateTimeDisplay = async () => {
      try {
        // Try to get server time for accuracy
        const serverTime = await getServerTime(supabase);
        const nextRun = new Date(nextRunAt);
        const diffMs = nextRun.getTime() - serverTime.getTime();
        
        if (diffMs < 0) {
          setTimeText('Overdue');
          return;
        }
        
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMinutes < 1) setTimeText('Starting soon');
        else if (diffMinutes < 60) setTimeText(`In ${diffMinutes}m`);
        else if (diffHours < 24) setTimeText(`In ${diffHours}h ${diffMinutes % 60}m`);
        else if (diffDays < 7) setTimeText(`In ${diffDays}d ${diffHours % 24}h`);
        else {
          setTimeText(nextRun.toLocaleDateString([], { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }));
        }
      } catch (error) {
        console.warn('Server time failed, using local time');
        // Fallback to local browser time
        const nextRun = new Date(nextRunAt);
        const now = new Date(); 
        const diffMs = nextRun.getTime() - now.getTime();
        
        if (diffMs < 0) {
          setTimeText('Overdue');
        } else {
          setTimeText(formatNextRunTime(nextRunAt, isOneTime));
        }
      }
    };
    
    calculateTimeDisplay();
  }, [nextRunAt, isOneTime, supabase]);

  return <span>Next: {timeText}</span>;
}

interface ScheduleTabProps {
  agentId: string;
  agentData?: any;
  onAgentUpdated?: (updatedData: any) => void;
}

export function ScheduleTab({ agentId, agentData, onAgentUpdated }: ScheduleTabProps) {
  const [showTaskWizard, setShowTaskWizard] = useState(false);
  const [showTaskHistory, setShowTaskHistory] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  
  // Real-time agent task status tracking
  const { runningTasks, isAgentBusy, taskExecutions } = useAgentTaskStatus(agentId);

  const loadTasks = async () => {
    if (!agentId || !user) return;
    
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No authenticated session');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-tasks?agent_id=${agentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Edge Function error:', response.status, errorText);
        throw new Error(`Failed to load tasks: ${response.status}`);
      }

      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [agentId, user]);

  const getStatusIcon = (task: Task) => {
    // Check if this task is currently running
    const isRunning = runningTasks.includes(task.id);
    
    if (isRunning) {
      return <div className="flex items-center space-x-1">
        <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Running</span>
      </div>;
    }
    
    switch (task.status) {
      case 'active': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'paused': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'completed': return <Check className="h-4 w-4 text-blue-500" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleTaskCreated = () => {
    setShowTaskWizard(false);
    setEditingTask(null);
    loadTasks(); // Refresh the task list
    if (onAgentUpdated) {
      onAgentUpdated({ ...agentData });
    }
  };

  const handleEditTask = async (task: Task) => {
    try {
      // Fetch more detailed task information for editing
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No authenticated session');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-tasks?task_id=${task.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Use the detailed task data if available, otherwise fall back to the basic task data
        const detailedTask = data.task || task;
        console.log('Detailed task data:', detailedTask);
        setEditingTask(detailedTask);
      } else {
        // If detailed fetch fails, use the basic task data
        console.warn('Failed to fetch detailed task data, using basic data');
        setEditingTask(task);
      }
    } catch (error) {
      console.error('Error fetching detailed task data:', error);
      // Fall back to basic task data
      setEditingTask(task);
    }
    
    setShowTaskWizard(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;
    
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No authenticated session');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-tasks`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task_id: taskId })
      });

      if (!response.ok) {
        throw new Error(`Failed to delete task: ${response.status}`);
      }

      // Refresh tasks
      loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Schedule & Tasks</h3>
          <p className="text-sm text-muted-foreground">
            Manage automated tasks and scheduling for your agent.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTaskHistory(true)}
            className="flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            History
          </Button>
          <Button
            onClick={() => setShowTaskWizard(true)}
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <Clock className="w-8 h-8 text-muted-foreground animate-spin mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            // No tasks - show empty state
            <div className="text-center py-8">
              <div className="p-4 bg-muted/30 rounded-full inline-block mb-4">
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h4 className="font-medium mb-2">No scheduled tasks yet</h4>
              <p className="text-sm text-muted-foreground">
                Create automated tasks for your agent to execute on schedule
              </p>
            </div>
          ) : (
            // Has tasks - show task list
            <div className="space-y-3">
              <h4 className="font-medium mb-3">Active Tasks ({tasks.length})</h4>
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-lg border-2 transition-all duration-300 hover:shadow-md ${
                    task.status === 'active'
                      ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/20'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {getStatusIcon(task)}
                        <h5 className="font-medium text-sm">{task.title || task.name}</h5>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
                      {(task.schedule_label || task.cron_expression || task.schedule) && (
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            {task.schedule_label || 
                             (task.cron_expression ? 
                               (task.max_executions === 1 ? 
                                 `One-time at ${parseCronExpression(task.cron_expression, task.timezone).replace('Daily at ', '')}` : 
                                 parseCronExpression(task.cron_expression, task.timezone)
                               ) : null) ||
                             task.schedule}
                          </span>
                        </div>
                      )}
                      {task.next_run_at && (
                        <div className="flex items-center space-x-1 text-xs text-blue-600 dark:text-blue-400 mt-1">
                          <Calendar className="h-3 w-3" />
                          <NextRunTimeDisplay nextRunAt={task.next_run_at} isOneTime={task.max_executions === 1} supabase={supabase} />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditTask(task)}
                        className="h-7 px-2"
                        title="Edit task"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTask(task.id)}
                        className="h-7 px-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Wizard Modal */}
      {showTaskWizard && (
        <TaskWizardModal
          isOpen={showTaskWizard}
          onClose={() => {
            setShowTaskWizard(false);
            setEditingTask(null);
          }}
          agentId={agentId}
          agentData={agentData}
          onTaskCreated={handleTaskCreated}
          editingTask={editingTask}
        />
      )}

      {/* Task History Modal would be rendered here */}
      {/* {showTaskHistory && (
        <TaskHistoryModal
          isOpen={showTaskHistory}
          onClose={() => setShowTaskHistory(false)}
          agentId={agentId}
        />
      )} */}
    </div>
  );
}
