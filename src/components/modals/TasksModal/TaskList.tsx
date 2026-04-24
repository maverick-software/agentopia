import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, CheckCircle2, Clock, Edit2, Target, Trash2, Zap, AlertCircle } from 'lucide-react';
import { Task } from './types';

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onRunNow: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

export function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high':
      return 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800';
    case 'low':
      return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800';
    default:
      return 'text-muted-foreground';
  }
}

export function getStatusIcon(status: string) {
  switch (status) {
    case 'active':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'paused':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'completed':
      return <Check className="h-4 w-4 text-blue-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

export function TaskList({ tasks, onEdit, onRunNow, onDelete }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed border-border rounded-lg">
        <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground mb-2">No scheduled tasks yet</p>
        <p className="text-sm text-muted-foreground">Create a one-time or recurring task above</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div key={task.id} className={`p-4 rounded-lg border transition-all ${task.status === 'active' ? 'border-border bg-card' : 'border-muted bg-muted/30'}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                {getStatusIcon(task.status)}
                <h4 className="font-medium text-sm">{task.title}</h4>
                <Badge className={`text-xs px-2 py-0.5 ${getPriorityColor(task.priority)}`}>{task.priority}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
              {(task.schedule_label || task.cron_expression || task.schedule) && (
                <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{task.schedule_label || task.cron_expression || task.schedule}</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-1 ml-4">
              <Button variant="ghost" size="sm" onClick={() => onEdit(task)} className="h-8 w-8 p-0" title="Edit"><Edit2 className="h-3 w-3" /></Button>
              <Button variant="ghost" size="sm" onClick={() => onRunNow(task.id)} className="h-8 w-8 p-0" title="Run now"><Zap className="h-3 w-3" /></Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(task.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Check, CheckCircle2, Clock, Edit2, Trash2, Zap } from 'lucide-react';
import { Task } from './types';

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high':
      return 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800';
    case 'low':
      return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800';
    default:
      return 'text-muted-foreground';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'active':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'paused':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'completed':
      return <Check className="h-4 w-4 text-blue-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

interface TaskListProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onRunTaskNow: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

export function TaskList({ tasks, onEditTask, onRunTaskNow, onDeleteTask }: TaskListProps) {
  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className={`p-4 rounded-lg border transition-all ${
            task.status === 'active' ? 'border-border bg-card' : 'border-muted bg-muted/30'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                {getStatusIcon(task.status)}
                <h4 className="font-medium text-sm">{task.title}</h4>
                <Badge className={`text-xs px-2 py-0.5 ${getPriorityColor(task.priority)}`}>{task.priority}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
              {(task.schedule_label || task.cron_expression || task.schedule) && (
                <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{task.schedule_label || task.cron_expression || task.schedule}</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-1 ml-4">
              <Button variant="ghost" size="sm" onClick={() => onEditTask(task)} className="h-8 w-8 p-0" title="Edit">
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRunTaskNow(task.id)}
                className="h-8 w-8 p-0"
                title="Run now"
              >
                <Zap className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteTask(task.id)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
