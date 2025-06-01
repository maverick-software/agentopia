import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { UseHandlersProps } from '../types';
import type { UnifiedWorkflowStage, UnifiedWorkflowTask, UnifiedWorkflowStep } from '@/types/unified-workflow';

export const useHandlers = ({
  elementManager,
  uiState,
  saveManager,
  state,
  isNewTemplate,
  onStateUpdate
}: UseHandlersProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Save functionality
  const handleSave = useCallback(() => {
    saveManager.handleSave({
      template: state.template,
      stages: state.stages,
      tasks: state.tasks,
      steps: state.steps,
      elements: state.elements
    }, isNewTemplate);
  }, [saveManager, state, isNewTemplate]);

  const handleCancel = useCallback(() => {
    if (uiState.isDirty) {
      const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!confirmLeave) return;
    }
    navigate('/admin/project-flows');
  }, [uiState.isDirty, navigate]);

  // Update handlers
  const onStageUpdate = useCallback(async (stageId: string, updates: Partial<UnifiedWorkflowStage>) => {
    if (!user) {
      toast.error('Authentication required');
      return;
    }

    try {
      // If using unified service and template is saved, update in database
      if (state.template?.id && state.template.id !== 'new') {
        const { unifiedWorkflowService } = await import('@/services');
        await unifiedWorkflowService.updateStage(stageId, updates, user.id);
        toast.success('Stage updated');
      }

      // Update local state
      const updatedStages = state.stages.map(stage => 
        stage.id === stageId ? { ...stage, ...updates } : stage
      );
      
      // Update state through onStateUpdate function
      onStateUpdate({ stages: updatedStages });
      uiState.markDirty();
    } catch (error: any) {
      console.error('Error updating stage:', error);
      toast.error(`Failed to update stage: ${error.message}`);
    }
  }, [state, user, onStateUpdate, uiState]);

  const onTaskUpdate = useCallback(async (taskId: string, updates: Partial<UnifiedWorkflowTask>) => {
    if (!user) {
      toast.error('Authentication required');
      return;
    }

    try {
      // If using unified service and template is saved, update in database
      if (state.template?.id && state.template.id !== 'new') {
        const { unifiedWorkflowService } = await import('@/services');
        await unifiedWorkflowService.updateTask(taskId, updates, user.id);
        toast.success('Task updated');
      }

      // Update local state
      const updatedTasks = state.tasks.map(task => 
        task.id === taskId ? { ...task, ...updates } : task
      );
      
      // Update state through onStateUpdate function
      onStateUpdate({ tasks: updatedTasks });
      uiState.markDirty();
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast.error(`Failed to update task: ${error.message}`);
    }
  }, [state, user, onStateUpdate, uiState]);

  const onStepUpdate = useCallback(async (stepId: string, updates: Partial<UnifiedWorkflowStep>) => {
    if (!user) {
      toast.error('Authentication required');
      return;
    }

    try {
      // If using unified service and template is saved, update in database
      if (state.template?.id && state.template.id !== 'new') {
        const { unifiedWorkflowService } = await import('@/services');
        await unifiedWorkflowService.updateStep(stepId, updates, user.id);
        toast.success('Step updated');
      }

      // Update local state
      const updatedSteps = state.steps.map(step => 
        step.id === stepId ? { ...step, ...updates } : step
      );
      
      // Update state through onStateUpdate function
      onStateUpdate({ steps: updatedSteps });
      uiState.markDirty();
    } catch (error: any) {
      console.error('Error updating step:', error);
      toast.error(`Failed to update step: ${error.message}`);
    }
  }, [state, user, onStateUpdate, uiState]);

  // Deletion handlers with optimistic updates
  const onStageDelete = useCallback(async (stageId: string) => {
    if (!user) {
      toast.error('Authentication required');
      return;
    }

    // Store original state for rollback if needed
    const originalStages = state.stages;
    const originalTasks = state.tasks;
    const originalSteps = state.steps;
    const originalElements = state.elements;

    // OPTIMISTIC UPDATE: Update UI immediately
    const updatedStages = state.stages.filter(stage => stage.id !== stageId);
    const updatedTasks = state.tasks.filter(task => task.stage_id !== stageId);
    const taskIdsToRemove = state.tasks.filter(task => task.stage_id === stageId).map(task => task.id);
    const updatedSteps = state.steps.filter(step => !taskIdsToRemove.includes(step.task_id));
    const stepIdsToRemove = state.steps.filter(step => taskIdsToRemove.includes(step.task_id)).map(step => step.id);
    const updatedElements = state.elements.filter(element => !stepIdsToRemove.includes(element.step_id));
    
    // Update state immediately for instant UI feedback
    onStateUpdate({ 
      stages: updatedStages,
      tasks: updatedTasks,
      steps: updatedSteps,
      elements: updatedElements
    });
    uiState.markDirty();

    // Show immediate success feedback
    toast.success('Stage deleted', { duration: 2000 });

    // BACKGROUND DATABASE UPDATE: Handle database operation asynchronously
    try {
      // If using unified service and template is saved, delete from database
      if (state.template?.id && state.template.id !== 'new') {
        const { unifiedWorkflowService } = await import('@/services');
        await unifiedWorkflowService.deleteStage(stageId, user.id);
        
        // Database operation successful - no need to change UI (already updated)
        console.log('Stage deletion confirmed in database');
      }
    } catch (error: any) {
      console.error('Error deleting stage from database:', error);
      
      // ROLLBACK: Revert UI state if database operation failed
      onStateUpdate({ 
        stages: originalStages,
        tasks: originalTasks,
        steps: originalSteps,
        elements: originalElements
      });
      
      // Show error and explain rollback
      toast.error(`Failed to delete stage: ${error.message}. Changes have been reverted.`, { duration: 5000 });
    }
  }, [state, user, onStateUpdate, uiState]);

  const onTaskDelete = useCallback(async (taskId: string) => {
    if (!user) {
      toast.error('Authentication required');
      return;
    }

    // Store original state for rollback if needed
    const originalTasks = state.tasks;
    const originalSteps = state.steps;
    const originalElements = state.elements;

    // OPTIMISTIC UPDATE: Update UI immediately
    const updatedTasks = state.tasks.filter(task => task.id !== taskId);
    const updatedSteps = state.steps.filter(step => step.task_id !== taskId);
    const stepIdsToRemove = state.steps.filter(step => step.task_id === taskId).map(step => step.id);
    const updatedElements = state.elements.filter(element => !stepIdsToRemove.includes(element.step_id));
    
    // Update state immediately for instant UI feedback
    onStateUpdate({ 
      tasks: updatedTasks,
      steps: updatedSteps,
      elements: updatedElements
    });
    uiState.markDirty();

    // Show immediate success feedback
    toast.success('Task deleted', { duration: 2000 });

    // BACKGROUND DATABASE UPDATE: Handle database operation asynchronously
    try {
      // If using unified service and template is saved, delete from database
      if (state.template?.id && state.template.id !== 'new') {
        const { unifiedWorkflowService } = await import('@/services');
        await unifiedWorkflowService.deleteTask(taskId, user.id);
        
        // Database operation successful - no need to change UI (already updated)
        console.log('Task deletion confirmed in database');
      }
    } catch (error: any) {
      console.error('Error deleting task from database:', error);
      
      // ROLLBACK: Revert UI state if database operation failed
      onStateUpdate({ 
        tasks: originalTasks,
        steps: originalSteps,
        elements: originalElements
      });
      
      // Show error and explain rollback
      toast.error(`Failed to delete task: ${error.message}. Changes have been reverted.`, { duration: 5000 });
    }
  }, [state, user, onStateUpdate, uiState]);

  const onStepDelete = useCallback(async (stepId: string) => {
    if (!user) {
      toast.error('Authentication required');
      return;
    }

    // Store original state for rollback if needed
    const originalSteps = state.steps;
    const originalElements = state.elements;

    // OPTIMISTIC UPDATE: Update UI immediately
    const updatedSteps = state.steps.filter(step => step.id !== stepId);
    const updatedElements = state.elements.filter(element => element.step_id !== stepId);
    
    // Update state immediately for instant UI feedback
    onStateUpdate({ 
      steps: updatedSteps,
      elements: updatedElements
    });
    uiState.markDirty();

    // Show immediate success feedback
    toast.success('Step deleted', { duration: 2000 });

    // BACKGROUND DATABASE UPDATE: Handle database operation asynchronously
    try {
      // If using unified service and template is saved, delete from database
      if (state.template?.id && state.template.id !== 'new') {
        const { unifiedWorkflowService } = await import('@/services');
        await unifiedWorkflowService.deleteStep(stepId, user.id);
        
        // Database operation successful - no need to change UI (already updated)
        console.log('Step deletion confirmed in database');
      }
    } catch (error: any) {
      console.error('Error deleting step from database:', error);
      
      // ROLLBACK: Revert UI state if database operation failed
      onStateUpdate({ 
        steps: originalSteps,
        elements: originalElements
      });
      
      // Show error and explain rollback
      toast.error(`Failed to delete step: ${error.message}. Changes have been reverted.`, { duration: 5000 });
    }
  }, [state, user, onStateUpdate, uiState]);

  const onElementDelete = useCallback(async (elementId: string) => {
    if (!user) {
      toast.error('Authentication required');
      return;
    }

    // Store original state for rollback if needed
    const originalElements = state.elements;

    // OPTIMISTIC UPDATE: Update UI immediately
    const updatedElements = state.elements.filter(element => element.id !== elementId);
    
    // Update state immediately for instant UI feedback
    onStateUpdate({ elements: updatedElements });
    uiState.markDirty();

    // Show immediate success feedback
    toast.success('Element deleted', { duration: 2000 });

    // BACKGROUND DATABASE UPDATE: Handle database operation asynchronously
    try {
      // If using unified service and template is saved, delete from database
      if (state.template?.id && state.template.id !== 'new') {
        const { unifiedWorkflowService } = await import('@/services');
        await unifiedWorkflowService.deleteElement(elementId, user.id);
        
        // Database operation successful - no need to change UI (already updated)
        console.log('Element deletion confirmed in database');
      }
    } catch (error: any) {
      console.error('Error deleting element from database:', error);
      
      // ROLLBACK: Revert UI state if database operation failed
      onStateUpdate({ elements: originalElements });
      
      // Show error and explain rollback
      toast.error(`Failed to delete element: ${error.message}. Changes have been reverted.`, { duration: 5000 });
    }
  }, [state, user, onStateUpdate, uiState]);

  return {
    // Drag and drop handlers
    handleDragStart: elementManager.handleDragStart,
    handleDragEnd: elementManager.handleDragEnd,
    
    // Selection handlers
    selectTemplate: uiState.selectTemplate,
    selectStage: uiState.selectStage,
    selectTask: uiState.selectTask,
    selectStep: uiState.selectStep,
    selectElement: uiState.selectElement,
    
    // Expansion handlers
    toggleStageExpansion: uiState.toggleStageExpansion,
    toggleTaskExpansion: uiState.toggleTaskExpansion,
    
    // CRUD operations
    addStage: elementManager.addStage,
    addTask: elementManager.addTask,
    addStep: elementManager.addStep,
    
    // Update handlers
    onStageUpdate,
    onTaskUpdate,
    onStepUpdate,
    
    // Deletion handlers
    onStageDelete,
    onTaskDelete,
    onStepDelete,
    onElementDelete,
    
    // Save/Cancel handlers
    handleSave,
    handleCancel
  };
}; 