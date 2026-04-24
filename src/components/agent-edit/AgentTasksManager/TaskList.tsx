import { Calendar, ChevronDown, ChevronRight, Clock, Edit, Pause, Play, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AgentTask } from './types';
import { EVENT_TRIGGER_TYPES } from './types';
import { formatNextRun, getStatusColor, getStatusIcon } from './taskUtils';

interface TaskListProps {
  tasks: AgentTask[];
  availableTools: Array<{ id: string; name: string; description?: string }>;
  expandedTask: string | null;
  onExpandTask: (taskId: string | null) => void;
  onRunNow: (taskId: string) => void;
  onToggleStatus: (task: AgentTask) => void;
  onEdit: (task: AgentTask) => void;
  onDelete: (taskId: string) => void;
}

export function TaskList({
  tasks,
  availableTools,
  expandedTask,
  onExpandTask,
  onRunNow,
  onToggleStatus,
  onEdit,
  onDelete,
}: TaskListProps) {
  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <div key={task.id} className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => onExpandTask(expandedTask === task.id ? null : task.id)}>
                {expandedTask === task.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{task.name}</h4>
                  <Badge variant="outline" className={getStatusColor(task.status)}>{getStatusIcon(task.status)}{task.status}</Badge>
                  <Badge variant="secondary">
                    {task.task_type === 'scheduled' ? <Clock className="h-3 w-3 mr-1" /> : <Calendar className="h-3 w-3 mr-1" />}
                    {task.task_type === 'scheduled' ? 'Scheduled' : 'Event-based'}
                  </Badge>
                </div>
                {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onRunNow(task.id)} disabled={task.status !== 'active'}><Play className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => onToggleStatus(task)}>
                {task.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onEdit(task)}><Edit className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => onDelete(task.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>

          {expandedTask === task.id && (
            <div className="mt-4 pt-4 border-t space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Instructions:</span>
                  <p className="text-muted-foreground mt-1">{task.instructions}</p>
                </div>
                <div>
                  <span className="font-medium">Statistics:</span>
                  <div className="text-muted-foreground mt-1">
                    <p>Total: {task.total_executions}</p>
                    <p>Successful: {task.successful_executions}</p>
                    <p>Failed: {task.failed_executions}</p>
                  </div>
                </div>
                {task.task_type === 'scheduled' && (
                  <div>
                    <span className="font-medium">Schedule:</span>
                    <div className="text-muted-foreground mt-1">
                      <p>Expression: {task.cron_expression}</p>
                      <p>Next run: {formatNextRun(task.next_run_at)}</p>
                      <p>Timezone: {task.timezone}</p>
                    </div>
                  </div>
                )}
                {task.task_type === 'event_based' && (
                  <div>
                    <span className="font-medium">Event Trigger:</span>
                    <p className="text-muted-foreground mt-1">{EVENT_TRIGGER_TYPES.find((t) => t.value === task.event_trigger_type)?.label}</p>
                  </div>
                )}
                <div>
                  <span className="font-medium">Tools:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {task.selected_tools.map((toolId) => {
                      const tool = availableTools.find((t) => t.id === toolId);
                      return tool ? <Badge key={toolId} variant="secondary" className="text-xs">{tool.name}</Badge> : null;
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
