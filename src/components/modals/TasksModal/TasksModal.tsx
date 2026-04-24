import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Loader2, Plus, Target } from 'lucide-react';
import { TaskForm } from './TaskForm';
import { TaskList } from './TaskList';
import { TasksModalProps } from './types';
import { useTasksModal } from './useTasksModal';

export function TasksModal({ isOpen, onClose, agentId, agentData, onAgentUpdated }: TasksModalProps) {
  const tasksModal = useTasksModal({
    isOpen,
    agentId,
    agentData,
    onAgentUpdated,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center">🎯 Scheduled Tasks</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create and manage recurring or one-time tasks for this agent.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Task scheduler</h3>
              <Button variant="outline" size="sm" onClick={() => tasksModal.setShowNewTaskForm(true)} className="text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Add Task
              </Button>
            </div>

            <TaskForm
              visible={tasksModal.showNewTaskForm}
              editingTaskId={tasksModal.editingTaskId}
              newTaskTitle={tasksModal.newTaskTitle}
              newTaskDescription={tasksModal.newTaskDescription}
              newTaskPriority={tasksModal.newTaskPriority}
              scheduleMode={tasksModal.scheduleMode}
              targetConversationId={tasksModal.targetConversationId}
              oneTimeDate={tasksModal.oneTimeDate}
              oneTimeTime={tasksModal.oneTimeTime}
              recurringStartDate={tasksModal.recurringStartDate}
              recurringEndDate={tasksModal.recurringEndDate}
              recurringTime={tasksModal.recurringTime}
              recurringCadence={tasksModal.recurringCadence}
              onVisibleChange={tasksModal.setShowNewTaskForm}
              onNewTaskTitleChange={tasksModal.setNewTaskTitle}
              onNewTaskDescriptionChange={tasksModal.setNewTaskDescription}
              onNewTaskPriorityChange={tasksModal.setNewTaskPriority}
              onScheduleModeChange={tasksModal.setScheduleMode}
              onTargetConversationIdChange={tasksModal.setTargetConversationId}
              onOneTimeDateChange={tasksModal.setOneTimeDate}
              onOneTimeTimeChange={tasksModal.setOneTimeTime}
              onRecurringStartDateChange={tasksModal.setRecurringStartDate}
              onRecurringEndDateChange={tasksModal.setRecurringEndDate}
              onRecurringTimeChange={tasksModal.setRecurringTime}
              onRecurringCadenceChange={tasksModal.setRecurringCadence}
              onSubmit={tasksModal.handleAddTask}
            />

            {tasksModal.tasks.length > 0 && (
              <TaskList
                tasks={tasksModal.tasks}
                onEditTask={tasksModal.beginEditTask}
                onRunTaskNow={tasksModal.runTaskNow}
                onDeleteTask={tasksModal.handleDeleteTask}
              />
            )}

            {tasksModal.tasks.length === 0 && !tasksModal.showNewTaskForm && (
              <div className="text-center p-8 border border-dashed border-border rounded-lg">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-2">No scheduled tasks yet</p>
                <p className="text-sm text-muted-foreground">Create a one-time or recurring task above</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
          <Button variant="outline" onClick={onClose} disabled={tasksModal.loading}>
            Close
          </Button>
          <Button onClick={tasksModal.handleSave} disabled={tasksModal.loading} className="min-w-[120px]">
            {tasksModal.loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : tasksModal.saved ? (
              <Check className="mr-2 h-4 w-4" />
            ) : null}
            {tasksModal.loading ? 'Working...' : tasksModal.saved ? 'Saved!' : 'Refresh'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
