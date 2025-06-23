import { useState, useCallback } from 'react';
import { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { toast } from 'sonner';
import { ElementManager } from '@/lib/flow-elements/ElementManager';
import type { 
  UnifiedWorkflowTemplate, 
  UnifiedWorkflowStage, 
  UnifiedWorkflowTask, 
  UnifiedWorkflowStep, 
  UnifiedWorkflowElement 
} from '@/types/unified-workflow';
import type { AuthUser } from '@/contexts/AuthContext';

// Enhanced Flow Builder types for unified hierarchy
type HierarchyLevel = 'template' | 'stage' | 'task' | 'step' | 'element';

interface TemplateData {
  template: UnifiedWorkflowTemplate | null;
  stages: UnifiedWorkflowStage[];
  tasks: UnifiedWorkflowTask[];
  steps: UnifiedWorkflowStep[];
  elements: UnifiedWorkflowElement[];
}

interface UseElementManagerReturn {
  // CRUD Operations
  addStage: () => Promise<void>;
  addTask: (stageId: string) => Promise<void>;
  addStep: (taskId: string) => Promise<void>;
  addElementToStep: (stepId: string, elementData: any) => Promise<void>;
  
  // Drag and Drop
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  
  // Utility
  isOperationInProgress: boolean;
  lastError: string | null;
  activeId: string | null;
}

interface UseElementManagerOptions {
  templateData: TemplateData;
  isUsingUnifiedService: boolean;
  user: AuthUser | null;
  onStateUpdate: (updates: Partial<TemplateData>) => void;
  onSelectionChange: (activeLevel: HierarchyLevel, selectedItem: string) => void;
  onMarkDirty: () => void;
  onExpandStage: (stageId: string) => void;
}

/**
 * Hook for managing CRUD operations and drag/drop functionality in the Flow Builder
 * Handles stages, tasks, steps, and elements with proper service integration
 */
export const useElementManager = (options: UseElementManagerOptions): UseElementManagerReturn => {
  const {
    templateData,
    isUsingUnifiedService,
    user,
    onStateUpdate,
    onSelectionChange,
    onMarkDirty,
    onExpandStage
  } = options;

  // Operation state
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Helper function to validate authentication
  const validateAuth = () => {
    if (!user) {
      throw new Error('Authentication required');
    }
    return user;
  };

  // CRUD Operations
  const addStage = useCallback(async () => {
    console.log('addStage called', { 
      hasTemplate: !!templateData.template, 
      template: templateData.template,
      stagesCount: templateData.stages.length 
    });
    
    if (!templateData.template) {
      const error = 'Cannot add stage: template not initialized';
      console.error(error);
      toast.error(error);
      setLastError(error);
      return;
    }

    setIsOperationInProgress(true);
    setLastError(null);

    try {
      const currentUser = validateAuth();

      // Create optimistic stage for immediate UI update
      const optimisticStage: UnifiedWorkflowStage = {
        id: crypto.randomUUID(), // Temporary ID for optimistic update
        template_id: templateData.template.id,
        name: `Stage ${templateData.stages.length + 1}`,
        description: '',
        stage_order: templateData.stages.length,
        is_required: true,
        auto_advance: false,
        allow_skip: false,
        client_visible: true,
        condition_logic: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: currentUser.id,
        updated_by: currentUser.id
      };

      // OPTIMISTIC UPDATE: Update UI immediately
      const updatedStages = [...templateData.stages, optimisticStage];
      onStateUpdate({ stages: updatedStages });
      onSelectionChange('stage', optimisticStage.id);
      onExpandStage(optimisticStage.id);

      // Show immediate success feedback
      toast.success('Added new stage', { duration: 2000 });

      // BACKGROUND DATABASE UPDATE: Handle database operation asynchronously
      if (isUsingUnifiedService && templateData.template.id !== 'new') {
        try {
          // Save to database using unified service
          const { unifiedWorkflowService } = await import('@/services');
          
          const savedStage = await unifiedWorkflowService.createStage(templateData.template.id, {
            name: `Stage ${templateData.stages.length + 1}`,
            description: '',
            is_required: true,
            allow_skip: false,
            auto_advance: false,
            client_visible: true,
            condition_logic: {},
            created_by: currentUser.id
          });

          console.log('Stage saved to database:', savedStage);
        
          // Replace optimistic stage with real database stage
          const finalStages = templateData.stages.map(stage => 
            stage.id === optimisticStage.id ? savedStage : stage
          );
          onStateUpdate({ stages: finalStages });
          onSelectionChange('stage', savedStage.id);

          console.log('Stage creation confirmed in database');
        } catch (dbError: any) {
          console.error('Error saving stage to database:', dbError);
          
          // ROLLBACK: Remove optimistic stage if database operation failed
          const rolledBackStages = templateData.stages.filter(stage => stage.id !== optimisticStage.id);
          onStateUpdate({ stages: rolledBackStages });
          
          // Show error and explain rollback
          toast.error(`Failed to save stage: ${dbError.message}. Stage has been removed.`, { duration: 5000 });
        }
      } else {
        // For new templates or compatibility mode, keep the optimistic stage
        onMarkDirty();
      }
    } catch (err: any) {
      console.error('Error adding stage:', err);
      const errorMessage = err.message || 'Failed to add stage';
      toast.error(errorMessage);
      setLastError(errorMessage);
    } finally {
      setIsOperationInProgress(false);
    }
  }, [templateData, isUsingUnifiedService, user, onStateUpdate, onSelectionChange, onMarkDirty, onExpandStage]);

  const addTask = useCallback(async (stageId: string) => {
    setIsOperationInProgress(true);
    setLastError(null);

    try {
      const currentUser = validateAuth();
      const stageTasks = templateData.tasks.filter(task => task.stage_id === stageId);

      // Create optimistic task for immediate UI update
      const optimisticTask: UnifiedWorkflowTask = {
        id: crypto.randomUUID(), // Temporary ID for optimistic update
        stage_id: stageId,
        name: `Task ${stageTasks.length + 1}`,
        description: '',
        task_order: stageTasks.length,
        task_type: 'standard',
        is_required: true,
        allow_skip: false,
        auto_advance: false,
        assigned_to: undefined,
        estimated_duration_minutes: undefined,
        due_date_offset_days: undefined,
        client_visible: true,
        client_description: '',
        condition_logic: {},
        depends_on_task_ids: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: currentUser.id,
        updated_by: currentUser.id
      };

      // OPTIMISTIC UPDATE: Update UI immediately
      const updatedTasks = [...templateData.tasks, optimisticTask];
      onStateUpdate({ tasks: updatedTasks });
      onSelectionChange('task', optimisticTask.id);

      // Show immediate success feedback
      toast.success('Added new task', { duration: 2000 });

      // BACKGROUND DATABASE UPDATE: Handle database operation asynchronously
      if (isUsingUnifiedService && templateData.template?.id && templateData.template.id !== 'new') {
        try {
          // Save to database using unified service
          const { unifiedWorkflowService } = await import('@/services');
          
          const savedTask = await unifiedWorkflowService.createTask(stageId, {
            name: `Task ${stageTasks.length + 1}`,
            description: '',
            task_type: 'standard',
            is_required: true,
            allow_skip: false,
            auto_advance: false,
            client_visible: true,
            condition_logic: {},
            depends_on_task_ids: [],
            created_by: currentUser.id
          });

          console.log('Task saved to database:', savedTask);
          
          // Replace optimistic task with real database task
          const finalTasks = templateData.tasks.map(task => 
            task.id === optimisticTask.id ? savedTask : task
          );
          onStateUpdate({ tasks: finalTasks });
          onSelectionChange('task', savedTask.id);

          console.log('Task creation confirmed in database');
        } catch (dbError: any) {
          console.error('Error saving task to database:', dbError);
          
          // ROLLBACK: Remove optimistic task if database operation failed
          const rolledBackTasks = templateData.tasks.filter(task => task.id !== optimisticTask.id);
          onStateUpdate({ tasks: rolledBackTasks });
          
          // Show error and explain rollback
          toast.error(`Failed to save task: ${dbError.message}. Task has been removed.`, { duration: 5000 });
        }
      } else {
        // For new templates or compatibility mode, keep the optimistic task
        onMarkDirty();
      }
    } catch (err: any) {
      console.error('Error adding task:', err);
      const errorMessage = err.message || 'Failed to add task';
      toast.error(errorMessage);
      setLastError(errorMessage);
    } finally {
      setIsOperationInProgress(false);
    }
  }, [templateData, isUsingUnifiedService, user, onStateUpdate, onSelectionChange, onMarkDirty]);

  const addStep = useCallback(async (taskId: string) => {
    setIsOperationInProgress(true);
    setLastError(null);

    try {
      const currentUser = validateAuth();
      const taskSteps = templateData.steps.filter(step => step.task_id === taskId);

      // Create optimistic step for immediate UI update
      const optimisticStep: UnifiedWorkflowStep = {
        id: crypto.randomUUID(), // Temporary ID for optimistic update
        task_id: taskId,
        name: `Step ${taskSteps.length + 1}`,
        description: '',
        step_order: taskSteps.length,
        step_type: 'form',
        is_required: true,
        allow_skip: false,
        auto_advance: false,
        show_progress: true,
        allow_back_navigation: true,
        save_progress: true,
        client_visible: true,
        client_description: '',
        condition_logic: {},
        validation_rules: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: currentUser.id,
        updated_by: currentUser.id
      };

      // OPTIMISTIC UPDATE: Update UI immediately
      const updatedSteps = [...templateData.steps, optimisticStep];
      onStateUpdate({ steps: updatedSteps });
      onSelectionChange('step', optimisticStep.id);

      // Show immediate success feedback
      toast.success('Added new step', { duration: 2000 });

      // BACKGROUND DATABASE UPDATE: Handle database operation asynchronously
      if (isUsingUnifiedService && templateData.template?.id && templateData.template.id !== 'new') {
        try {
          // Save to database using unified service
          const { unifiedWorkflowService } = await import('@/services');
          
          const savedStep = await unifiedWorkflowService.createStep(taskId, {
            name: `Step ${taskSteps.length + 1}`,
            description: '',
            step_type: 'form',
            is_required: true,
            allow_skip: false,
            auto_advance: false,
            show_progress: true,
            allow_back_navigation: true,
            save_progress: true,
            client_visible: true,
            condition_logic: {},
            validation_rules: {},
            created_by: currentUser.id
          });

          console.log('Step saved to database:', savedStep);
          
          // Replace optimistic step with real database step
          const finalSteps = templateData.steps.map(step => 
            step.id === optimisticStep.id ? savedStep : step
          );
          onStateUpdate({ steps: finalSteps });
          onSelectionChange('step', savedStep.id);

          console.log('Step creation confirmed in database');
        } catch (dbError: any) {
          console.error('Error saving step to database:', dbError);
          
          // ROLLBACK: Remove optimistic step if database operation failed
          const rolledBackSteps = templateData.steps.filter(step => step.id !== optimisticStep.id);
          onStateUpdate({ steps: rolledBackSteps });
          
          // Show error and explain rollback
          toast.error(`Failed to save step: ${dbError.message}. Step has been removed.`, { duration: 5000 });
        }
      } else {
        // For new templates or compatibility mode, keep the optimistic step
        onMarkDirty();
      }
    } catch (err: any) {
      console.error('Error adding step:', err);
      const errorMessage = err.message || 'Failed to add step';
      toast.error(errorMessage);
      setLastError(errorMessage);
    } finally {
      setIsOperationInProgress(false);
    }
  }, [templateData, isUsingUnifiedService, user, onStateUpdate, onSelectionChange, onMarkDirty]);

  const addElementToStep = useCallback(async (stepId: string, elementData: any) => {
    const implementation = ElementManager.get(elementData.elementType);
    
    if (!implementation) {
      toast.error(`Element type "${elementData.elementType}" is not implemented yet.`);
      return;
    }

    setIsOperationInProgress(true);
    setLastError(null);

    try {
      const currentUser = validateAuth();

      // Create optimistic element for immediate UI update
      const stepElements = templateData.elements.filter(el => el.step_id === stepId);
      // Use timestamp + random component to avoid conflicts
      const nextOrder = stepElements.length + Math.floor(Date.now() % 1000);
      
      const optimisticElement: UnifiedWorkflowElement = {
        id: crypto.randomUUID(), // Temporary ID for optimistic update
        step_id: stepId,
        element_type: elementData.elementType,
        element_key: elementData.elementType + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        element_order: nextOrder,
        label: elementData.name || elementData.elementType,
        placeholder: elementData.config?.placeholder || '',
        help_text: '',
        config: elementData.config || {},
        is_required: false,
        validation_rules: {},
        condition_logic: {},
        client_visible: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: currentUser.id,
        updated_by: currentUser.id
      };

      // OPTIMISTIC UPDATE: Update UI immediately
      const updatedElements = [...templateData.elements, optimisticElement];
      onStateUpdate({ elements: updatedElements });
      onSelectionChange('element', optimisticElement.id);

      // Show immediate success feedback
      toast.success(`Added ${elementData.elementType} element`, { duration: 2000 });

      // BACKGROUND DATABASE UPDATE: Handle database operation asynchronously
      if (isUsingUnifiedService && templateData.template?.id && templateData.template.id !== 'new') {
        try {
          // Save to database using unified service without waiting for order calculation
          const { unifiedWorkflowService } = await import('@/services');
          
          const savedElement = await unifiedWorkflowService.createElement(stepId, {
            element_type: elementData.elementType,
            element_key: elementData.elementType + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            label: elementData.name || elementData.elementType,
            placeholder: elementData.config?.placeholder || '',
            help_text: '',
            config: elementData.config || {},
            is_required: false,
            validation_rules: {},
            condition_logic: {},
            client_visible: true,
            created_by: currentUser.id,
            // Don't pass element_order - let the service calculate it automatically
            // This avoids the slow database query that's causing timeouts
          });

          console.log('Element saved to database:', savedElement);
          
          // Replace optimistic element with real database element
          const finalElements = updatedElements.map(el => 
            el.id === optimisticElement.id ? savedElement : el
          );
          onStateUpdate({ elements: finalElements });
          onSelectionChange('element', savedElement.id);

          console.log('Element creation confirmed in database');
        } catch (dbError: any) {
          console.error('Error saving element to database:', dbError);
          
          // ROLLBACK: Remove optimistic element if database operation failed
          const rolledBackElements = templateData.elements.filter(el => el.id !== optimisticElement.id);
          onStateUpdate({ elements: rolledBackElements });
          
          // Show error and explain rollback
          toast.error(`Failed to save element: ${dbError.message}. Element has been removed.`, { duration: 5000 });
        }
      } else {
        // For new templates or compatibility mode, keep the optimistic element
        onMarkDirty();
      }
    } catch (err: any) {
      console.error('Error adding element to step:', err);
      const errorMessage = err.message || 'Failed to add element to step';
      toast.error(errorMessage);
      setLastError(errorMessage);
    } finally {
      setIsOperationInProgress(false);
    }
  }, [templateData, isUsingUnifiedService, user, onStateUpdate, onSelectionChange, onMarkDirty]);

  // Drag and Drop Handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Handle dropping element from palette
    if (active.data.current?.type === 'palette-element') {
      const element = active.data.current.element;
      
      // Only allow dropping on steps - this enforces proper hierarchy
      if (over.id.toString().startsWith('step-')) {
        const stepId = over.id.toString().replace('step-', '');
        await addElementToStep(stepId, element);
        return;
      }
      
      // Show helpful message for invalid drop targets
      if (over.id.toString().startsWith('stage-')) {
        toast.error('Elements can only be added to steps. Please create a task and step first, then drag the element to the step.');
        return;
      }

      if (over.id.toString().startsWith('task-')) {
        toast.error('Elements can only be added to steps. Please create a step in this task first, then drag the element to the step.');
        return;
      }

      // Generic invalid drop target
      toast.error('Elements can only be dropped on steps. Please drag to a step within a task.');
    }
  }, [addElementToStep]);

  return {
    // CRUD Operations
    addStage,
    addTask,
    addStep,
    addElementToStep,
    
    // Drag and Drop
    handleDragStart,
    handleDragEnd,
    
    // Utility
    isOperationInProgress,
    lastError,
    activeId
  };
}; 