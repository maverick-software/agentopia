import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatTimezoneLabel, getSupportedTimezones } from '@/lib/utils/taskUtils';
import { TaskWizardBody } from './TaskWizardBody';
import { TaskWizardModalProps } from './types';
import { useTaskWizardModal } from './useTaskWizardModal';

export function TaskWizardModal({ isOpen, onClose, agentId, agentData, onTaskCreated, editingTask }: TaskWizardModalProps) {
  const wizard = useTaskWizardModal({
    agentId,
    editingTask,
    onTaskCreated,
    onClose,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto p-0 border-0 bg-transparent">
        <DialogTitle className="sr-only">{editingTask ? 'Edit Task' : 'Schedule Task Wizard'}</DialogTitle>
        <DialogDescription className="sr-only">
          {editingTask ? 'Edit your automated task' : 'Create automated tasks for your agent using this step-by-step wizard'}
        </DialogDescription>
        <TaskWizardBody
          currentStep={wizard.currentStep}
          scheduleMode={wizard.scheduleMode}
          oneTimeDate={wizard.oneTimeDate}
          oneTimeTime={wizard.oneTimeTime}
          recurringStartDate={wizard.recurringStartDate}
          recurringEndDate={wizard.recurringEndDate}
          recurringTime={wizard.recurringTime}
          everyInterval={wizard.everyInterval}
          everyUnit={wizard.everyUnit}
          selectedTimezone={wizard.selectedTimezone}
          targetConversationId={wizard.targetConversationId}
          newTaskTitle={wizard.newTaskTitle}
          taskSteps={wizard.taskSteps}
          editingTask={editingTask}
          agentId={agentId}
          agentName={agentData?.name}
          loading={wizard.loading}
          getSupportedTimezones={getSupportedTimezones}
          formatTimezoneLabel={formatTimezoneLabel}
          setScheduleMode={wizard.setScheduleMode}
          setOneTimeDate={wizard.setOneTimeDate}
          setOneTimeTime={wizard.setOneTimeTime}
          setRecurringStartDate={wizard.setRecurringStartDate}
          setRecurringEndDate={wizard.setRecurringEndDate}
          setRecurringTime={wizard.setRecurringTime}
          setEveryInterval={wizard.setEveryInterval}
          setEveryUnit={wizard.setEveryUnit}
          setSelectedTimezone={wizard.setSelectedTimezone}
          setTaskSteps={wizard.setTaskSteps}
          setStepsValid={wizard.setStepsValid}
          setNewTaskTitle={wizard.setNewTaskTitle}
          setTargetConversationId={wizard.setTargetConversationId}
          onCancel={wizard.handleCancel}
          onBack={wizard.handleBack}
          onNext={wizard.handleNext}
          onSaveTask={wizard.handleSaveTask}
        />
      </DialogContent>
    </Dialog>
  );
}
