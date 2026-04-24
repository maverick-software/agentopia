import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

declare global {
  interface Window {
    __agentopiaConversations?: Array<{ conversation_id: string; title?: string }>;
  }
}

interface TaskFormProps {
  showNewTaskForm: boolean;
  editingTaskId: string | null;
  newTaskTitle: string;
  newTaskDescription: string;
  newTaskPriority: 'low' | 'medium' | 'high';
  scheduleMode: 'one_time' | 'recurring';
  oneTimeDate: string;
  oneTimeTime: string;
  recurringStartDate: string;
  recurringEndDate: string;
  recurringTime: string;
  recurringCadence: 'daily' | 'weekly' | 'monthly';
  targetConversationId: string;
  onShow: (show: boolean) => void;
  onChange: {
    title: (value: string) => void;
    description: (value: string) => void;
    priority: (value: 'low' | 'medium' | 'high') => void;
    mode: (value: 'one_time' | 'recurring') => void;
    oneTimeDate: (value: string) => void;
    oneTimeTime: (value: string) => void;
    recurringStartDate: (value: string) => void;
    recurringEndDate: (value: string) => void;
    recurringTime: (value: string) => void;
    recurringCadence: (value: 'daily' | 'weekly' | 'monthly') => void;
    conversationId: (value: string) => void;
  };
  onSave: () => void;
}

export function TaskForm(props: TaskFormProps) {
  const { showNewTaskForm, editingTaskId, newTaskTitle, newTaskDescription, newTaskPriority, scheduleMode, oneTimeDate, oneTimeTime, recurringStartDate, recurringEndDate, recurringTime, recurringCadence, targetConversationId, onShow, onChange, onSave } = props;
  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Task scheduler</h3>
        <Button variant="outline" size="sm" onClick={() => onShow(true)} className="text-xs"><Plus className="h-3 w-3 mr-1" />Add Task</Button>
      </div>
      {showNewTaskForm && (
        <div className="p-4 border border-border rounded-lg bg-card space-y-3">
          <h4 className="font-medium text-sm">Add New Scheduled Task</h4>
          <Input placeholder="Task title" value={newTaskTitle} onChange={(e) => onChange.title(e.target.value)} />
          <Textarea placeholder="Task instructions / description..." value={newTaskDescription} onChange={(e) => onChange.description(e.target.value)} className="min-h-[60px] resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <select value={newTaskPriority} onChange={(e) => onChange.priority(e.target.value as 'low' | 'medium' | 'high')} className="w-full mt-1 p-2 border rounded-md text-sm bg-card text-foreground border-border"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
            <select value={scheduleMode} onChange={(e) => onChange.mode(e.target.value as 'one_time' | 'recurring')} className="w-full mt-1 p-2 border rounded-md text-sm bg-card text-foreground border-border"><option value="one_time">One-time</option><option value="recurring">Recurring</option></select>
          </div>
          <select value={targetConversationId} onChange={(e) => onChange.conversationId(e.target.value)} className="w-full mt-1 p-2 border rounded-md text-sm bg-card text-foreground border-border">
            <option value="">Auto-create new conversation</option>
            {(Array.isArray(window.__agentopiaConversations) ? window.__agentopiaConversations : []).map((c) => (
              <option key={c.conversation_id} value={c.conversation_id}>{c.title || 'Conversation'}</option>
            ))}
          </select>
          {scheduleMode === 'one_time' ? (
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" value={oneTimeDate} onChange={(e) => onChange.oneTimeDate(e.target.value)} />
              <Input type="time" value={oneTimeTime} onChange={(e) => onChange.oneTimeTime(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Input type="date" value={recurringStartDate} onChange={(e) => onChange.recurringStartDate(e.target.value)} />
                <Input type="date" value={recurringEndDate} onChange={(e) => onChange.recurringEndDate(e.target.value)} />
                <Input type="time" value={recurringTime} onChange={(e) => onChange.recurringTime(e.target.value)} />
              </div>
              <select value={recurringCadence} onChange={(e) => onChange.recurringCadence(e.target.value as 'daily' | 'weekly' | 'monthly')} className="w-full mt-1 p-2 border rounded-md text-sm bg-card text-foreground border-border">
                <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
              </select>
            </div>
          )}
          <div className="flex space-x-2">
            <Button onClick={onSave} size="sm" disabled={!newTaskTitle.trim()}>{editingTaskId ? 'Save Changes' : (<span className="inline-flex items-center"><Plus className="h-3 w-3 mr-1" />Add Task</span>)}</Button>
            <Button variant="outline" size="sm" onClick={() => onShow(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </>
  );
}

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { RecurringCadence, ScheduleMode } from './types';

interface TaskFormProps {
  visible: boolean;
  editingTaskId: string | null;
  newTaskTitle: string;
  newTaskDescription: string;
  newTaskPriority: 'low' | 'medium' | 'high';
  scheduleMode: ScheduleMode;
  targetConversationId: string;
  oneTimeDate: string;
  oneTimeTime: string;
  recurringStartDate: string;
  recurringEndDate: string;
  recurringTime: string;
  recurringCadence: RecurringCadence;
  onVisibleChange: (visible: boolean) => void;
  onNewTaskTitleChange: (value: string) => void;
  onNewTaskDescriptionChange: (value: string) => void;
  onNewTaskPriorityChange: (value: 'low' | 'medium' | 'high') => void;
  onScheduleModeChange: (value: ScheduleMode) => void;
  onTargetConversationIdChange: (value: string) => void;
  onOneTimeDateChange: (value: string) => void;
  onOneTimeTimeChange: (value: string) => void;
  onRecurringStartDateChange: (value: string) => void;
  onRecurringEndDateChange: (value: string) => void;
  onRecurringTimeChange: (value: string) => void;
  onRecurringCadenceChange: (value: RecurringCadence) => void;
  onSubmit: () => void;
}

export function TaskForm(props: TaskFormProps) {
  const {
    visible,
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
    onVisibleChange,
    onNewTaskTitleChange,
    onNewTaskDescriptionChange,
    onNewTaskPriorityChange,
    onScheduleModeChange,
    onTargetConversationIdChange,
    onOneTimeDateChange,
    onOneTimeTimeChange,
    onRecurringStartDateChange,
    onRecurringEndDateChange,
    onRecurringTimeChange,
    onRecurringCadenceChange,
    onSubmit,
  } = props;

  if (!visible) return null;

  return (
    <div className="p-4 border border-border rounded-lg bg-card space-y-3">
      <h4 className="font-medium text-sm">Add New Scheduled Task</h4>
      <div className="space-y-3">
        <Input placeholder="Task title" value={newTaskTitle} onChange={(event) => onNewTaskTitleChange(event.target.value)} />
        <Textarea
          placeholder="Task instructions / description..."
          value={newTaskDescription}
          onChange={(event) => onNewTaskDescriptionChange(event.target.value)}
          className="min-h-[60px] resize-none"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Priority</label>
            <select
              value={newTaskPriority}
              onChange={(event) => onNewTaskPriorityChange(event.target.value as 'low' | 'medium' | 'high')}
              className="w-full mt-1 p-2 border rounded-md text-sm bg-card text-foreground border-border"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Mode</label>
            <select
              value={scheduleMode}
              onChange={(event) => onScheduleModeChange(event.target.value as ScheduleMode)}
              className="w-full mt-1 p-2 border rounded-md text-sm bg-card text-foreground border-border"
            >
              <option value="one_time">One-time</option>
              <option value="recurring">Recurring</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Execute in conversation</label>
          <select
            value={targetConversationId}
            onChange={(event) => onTargetConversationIdChange(event.target.value)}
            className="w-full mt-1 p-2 border rounded-md text-sm bg-card text-foreground border-border"
          >
            <option value="">Auto-create new conversation</option>
            {(Array.isArray(window.__agentopiaConversations) ? window.__agentopiaConversations : []).map((conversation: any) => (
              <option key={conversation.conversation_id} value={conversation.conversation_id}>
                {conversation.title || 'Conversation'}
              </option>
            ))}
          </select>
        </div>

        {scheduleMode === 'one_time' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Run date</label>
              <Input type="date" value={oneTimeDate} onChange={(event) => onOneTimeDateChange(event.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Run time</label>
              <Input type="time" value={oneTimeTime} onChange={(event) => onOneTimeTimeChange(event.target.value)} className="mt-1" />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Start date</label>
                <Input
                  type="date"
                  value={recurringStartDate}
                  onChange={(event) => onRecurringStartDateChange(event.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">End date (optional)</label>
                <Input type="date" value={recurringEndDate} onChange={(event) => onRecurringEndDateChange(event.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Time of day</label>
                <Input type="time" value={recurringTime} onChange={(event) => onRecurringTimeChange(event.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cadence</label>
              <select
                value={recurringCadence}
                onChange={(event) => onRecurringCadenceChange(event.target.value as RecurringCadence)}
                className="w-full mt-1 p-2 border rounded-md text-sm bg-card text-foreground border-border"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly (based on start date weekday)</option>
                <option value="monthly">Monthly (based on start date day)</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex space-x-2">
          <Button onClick={onSubmit} size="sm" disabled={!newTaskTitle.trim()}>
            {editingTaskId ? (
              'Save Changes'
            ) : (
              <span className="inline-flex items-center">
                <Plus className="h-3 w-3 mr-1" />
                Add Task
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onVisibleChange(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
