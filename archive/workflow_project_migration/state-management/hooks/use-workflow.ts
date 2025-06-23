/**
 * Workflow Management Hooks
 * 
 * Specialized hooks for workflow template and instance management, builder state,
 * and hierarchical template data. Provides high-level abstractions for common
 * workflow patterns with performance optimization and cache integration.
 */

import { useCallback, useMemo } from 'react';
import { useStore } from './use-store';
import { workflowStore } from '../stores';
import type { 
  WorkflowState, 
  WorkflowInstance, 
  TemplateMetadata, 
  CompleteTemplate, 
  InstanceProgress, 
  StepData,
  WorkflowBuilderState,
  WorkflowStage,
  WorkflowTask,
  WorkflowStep,
  WorkflowElement
} from '../core/types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Create instance data interface
 */
export interface CreateInstanceData {
  name: string;
  description?: string;
  projectId?: string;
  clientId: string;
  assignedTo?: string;
  dueDate?: string;
  metadata?: Record<string, any>;
}

/**
 * Template filters interface
 */
export interface TemplateFilters {
  type?: 'standard' | 'flow_based' | 'hybrid';
  category?: string;
  tags?: string[];
  isActive?: boolean;
  isPublished?: boolean;
  clientVisible?: boolean;
}

/**
 * Core workflow state return type
 */
export interface UseWorkflowReturn {
  templates: Record<string, TemplateMetadata>;
  instances: Record<string, WorkflowInstance>;
  progress: Record<string, InstanceProgress>;
  isLoading: boolean;
  error: string | null;
  loadTemplate: (id: string) => Promise<CompleteTemplate>;
  createInstance: (templateId: string, data: CreateInstanceData) => Promise<WorkflowInstance>;
  updateInstance: (id: string, data: Partial<WorkflowInstance>) => Promise<void>;
  updateProgress: (instanceId: string, progress: Partial<InstanceProgress>) => void;
  refreshTemplates: () => Promise<void>;
}

/**
 * Template metadata return type
 */
export interface UseTemplateMetadataReturn {
  templates: TemplateMetadata[];
  filteredTemplates: TemplateMetadata[];
  isLoading: boolean;
  error: string | null;
  getTemplate: (id: string) => TemplateMetadata | null;
  refresh: () => Promise<void>;
}

/**
 * Template hierarchy return type
 */
export interface UseTemplateHierarchyReturn {
  template: CompleteTemplate | null;
  stages: WorkflowStage[];
  tasks: WorkflowTask[];
  steps: WorkflowStep[];
  elements: WorkflowElement[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Workflow builder return type
 */
export interface UseWorkflowBuilderReturn {
  builderState: WorkflowBuilderState;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  setActiveLevel: (level: 'template' | 'stage' | 'task' | 'step' | 'element') => void;
  setSelectedItem: (itemId: string | null) => void;
  toggleExpanded: (itemId: string) => void;
  markDirty: () => void;
  save: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  copy: (item: any) => void;
  paste: () => void;
  cut: (item: any) => void;
}

/**
 * Instance management return type
 */
export interface UseInstanceManagementReturn {
  instances: WorkflowInstance[];
  activeInstances: WorkflowInstance[];
  completedInstances: WorkflowInstance[];
  progress: Record<string, InstanceProgress>;
  isLoading: boolean;
  error: string | null;
  getInstance: (id: string) => WorkflowInstance | null;
  getProgress: (instanceId: string) => InstanceProgress | null;
  updateStepData: (instanceId: string, stepId: string, data: Partial<StepData>) => void;
  submitStep: (instanceId: string, stepId: string) => Promise<void>;
  completeTask: (instanceId: string, taskId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Step data management return type
 */
export interface UseStepDataReturn {
  stepData: Record<string, StepData>;
  getStepData: (stepId: string) => StepData | null;
  updateStepData: (stepId: string, data: Partial<StepData>) => void;
  validateStepData: (stepId: string) => boolean;
  isStepComplete: (stepId: string) => boolean;
  getValidationErrors: (stepId: string) => string[];
}

// ============================================================================
// CORE WORKFLOW HOOKS
// ============================================================================

/**
 * Core workflow hook
 * Provides access to templates, instances, and basic operations
 */
export function useWorkflow(): UseWorkflowReturn {
  const templates = useStore(workflowStore, (state: WorkflowState) => state.templates.metadata);
  const instances = useStore(workflowStore, (state: WorkflowState) => state.instances.active);
  const progress = useStore(workflowStore, (state: WorkflowState) => state.instances.progress);
  const isLoading = useStore(workflowStore, (state: WorkflowState) => state.loading);
  const error = useStore(workflowStore, (state: WorkflowState) => state.error);

  // Actions accessed directly from store
  const loadTemplate = useCallback(async (id: string): Promise<CompleteTemplate> => {
    return await workflowStore.getState().loadTemplate(id);
  }, []);

  const createInstance = useCallback(async (templateId: string, data: CreateInstanceData): Promise<WorkflowInstance> => {
    return await workflowStore.getState().createInstance(templateId, data);
  }, []);

  const updateInstance = useCallback(async (id: string, data: Partial<WorkflowInstance>): Promise<void> => {
    await workflowStore.getState().updateInstance(id, data);
  }, []);

  const updateProgress = useCallback((instanceId: string, progress: Partial<InstanceProgress>): void => {
    workflowStore.getState().updateInstanceProgress(instanceId, progress);
  }, []);

  const refreshTemplates = useCallback(async (): Promise<void> => {
    await workflowStore.getState().loadTemplateMetadata();
  }, []);

  return {
    templates,
    instances,
    progress,
    isLoading,
    error,
    loadTemplate,
    createInstance,
    updateInstance,
    updateProgress,
    refreshTemplates
  };
}

/**
 * Template metadata hook with filtering
 * Provides filtered template lists and metadata operations
 */
export function useTemplateMetadata(filters?: TemplateFilters): UseTemplateMetadataReturn {
  const templatesRecord = useStore(workflowStore, (state: WorkflowState) => state.templates.metadata);
  const isLoading = useStore(workflowStore, (state: WorkflowState) => state.loading);
  const error = useStore(workflowStore, (state: WorkflowState) => state.error);

  const templates = useMemo(() => {
    return Object.values(templatesRecord);
  }, [templatesRecord]);

  const filteredTemplates = useMemo(() => {
    if (!filters) return templates;

    return templates.filter(template => {
      if (filters.type && template.type !== filters.type) return false;
      if (filters.category && template.category !== filters.category) return false;
      if (filters.isActive !== undefined && template.isActive !== filters.isActive) return false;
      if (filters.isPublished !== undefined && template.isPublished !== filters.isPublished) return false;
      if (filters.clientVisible !== undefined && template.clientVisible !== filters.clientVisible) return false;
      if (filters.tags && !filters.tags.some(tag => template.tags.includes(tag))) return false;
      
      return true;
    });
  }, [templates, filters]);

  const getTemplate = useCallback((id: string): TemplateMetadata | null => {
    return templatesRecord[id] || null;
  }, [templatesRecord]);

  const refresh = useCallback(async (): Promise<void> => {
    await workflowStore.getState().loadTemplateMetadata();
  }, []);

  return {
    templates,
    filteredTemplates,
    isLoading,
    error,
    getTemplate,
    refresh
  };
}

/**
 * Template hierarchy hook
 * Provides complete template structure with stages, tasks, steps, and elements
 */
export function useTemplateHierarchy(templateId: string | null): UseTemplateHierarchyReturn {
  const template = useStore(workflowStore, (state: WorkflowState) => 
    templateId ? state.templates.hierarchies[templateId] || null : null
  );
  const isLoading = useStore(workflowStore, (state: WorkflowState) => 
    templateId ? state.templates.loading.has(templateId) : false
  );
  const error = useStore(workflowStore, (state: WorkflowState) => state.error);

  // Extract hierarchical data with memoization
  const stages = useMemo(() => {
    return template?.stages || [];
  }, [template]);

  const tasks = useMemo(() => {
    return stages.flatMap(stage => stage.tasks);
  }, [stages]);

  const steps = useMemo(() => {
    return tasks.flatMap(task => task.steps);
  }, [tasks]);

  const elements = useMemo(() => {
    return steps.flatMap(step => step.elements);
  }, [steps]);

  const refresh = useCallback(async (): Promise<void> => {
    if (templateId) {
      await workflowStore.getState().loadTemplate(templateId);
    }
  }, [templateId]);

  return {
    template,
    stages,
    tasks,
    steps,
    elements,
    isLoading,
    error,
    refresh
  };
}

/**
 * Workflow builder hook
 * Provides builder state management with undo/redo and save functionality
 */
export function useWorkflowBuilder(): UseWorkflowBuilderReturn {
  const builderState = useStore(workflowStore, (state: WorkflowState) => state.builder);

  // Computed properties
  const canUndo = useMemo(() => {
    return builderState.undoStack.length > 0;
  }, [builderState.undoStack]);

  const canRedo = useMemo(() => {
    return builderState.redoStack.length > 0;
  }, [builderState.redoStack]);

  const isDirty = useMemo(() => {
    return builderState.isDirty;
  }, [builderState.isDirty]);

  const saveStatus = useMemo(() => {
    return builderState.saveStatus;
  }, [builderState.saveStatus]);

  // Actions accessed directly from store
  const setActiveLevel = useCallback((level: 'template' | 'stage' | 'task' | 'step' | 'element'): void => {
    workflowStore.getState().setBuilderActiveLevel(level);
  }, []);

  const setSelectedItem = useCallback((itemId: string | null): void => {
    workflowStore.getState().setBuilderSelectedItem(itemId);
  }, []);

  const toggleExpanded = useCallback((itemId: string): void => {
    workflowStore.getState().toggleBuilderExpanded(itemId);
  }, []);

  const markDirty = useCallback((): void => {
    workflowStore.getState().setBuilderDirty(true);
  }, []);

  const save = useCallback(async (): Promise<void> => {
    await workflowStore.getState().saveBuilder();
  }, []);

  const undo = useCallback((): void => {
    workflowStore.getState().builderUndo();
  }, []);

  const redo = useCallback((): void => {
    workflowStore.getState().builderRedo();
  }, []);

  const copy = useCallback((item: any): void => {
    workflowStore.getState().builderCopy(item);
  }, []);

  const paste = useCallback((): void => {
    workflowStore.getState().builderPaste();
  }, []);

  const cut = useCallback((item: any): void => {
    workflowStore.getState().builderCut(item);
  }, []);

  return {
    builderState,
    canUndo,
    canRedo,
    isDirty,
    saveStatus,
    setActiveLevel,
    setSelectedItem,
    toggleExpanded,
    markDirty,
    save,
    undo,
    redo,
    copy,
    paste,
    cut
  };
}

/**
 * Instance management hook
 * Provides instance-focused operations and progress tracking
 */
export function useInstanceManagement(): UseInstanceManagementReturn {
  const instancesRecord = useStore(workflowStore, (state: WorkflowState) => state.instances.active);
  const progress = useStore(workflowStore, (state: WorkflowState) => state.instances.progress);
  const isLoading = useStore(workflowStore, (state: WorkflowState) => state.loading);
  const error = useStore(workflowStore, (state: WorkflowState) => state.error);

  const instances = useMemo(() => {
    return Object.values(instancesRecord);
  }, [instancesRecord]);

  const activeInstances = useMemo(() => {
    return instances.filter(instance => instance.status === 'active');
  }, [instances]);

  const completedInstances = useMemo(() => {
    return instances.filter(instance => instance.status === 'completed');
  }, [instances]);

  const getInstance = useCallback((id: string): WorkflowInstance | null => {
    return instancesRecord[id] || null;
  }, [instancesRecord]);

  const getProgress = useCallback((instanceId: string): InstanceProgress | null => {
    return progress[instanceId] || null;
  }, [progress]);

  const updateStepData = useCallback((instanceId: string, stepId: string, data: Partial<StepData>): void => {
    workflowStore.getState().updateStepData(instanceId, stepId, data);
  }, []);

  const submitStep = useCallback(async (instanceId: string, stepId: string): Promise<void> => {
    await workflowStore.getState().submitStep(instanceId, stepId);
  }, []);

  const completeTask = useCallback(async (instanceId: string, taskId: string): Promise<void> => {
    await workflowStore.getState().completeTask(instanceId, taskId);
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    await workflowStore.getState().loadInstances();
  }, []);

  return {
    instances,
    activeInstances,
    completedInstances,
    progress,
    isLoading,
    error,
    getInstance,
    getProgress,
    updateStepData,
    submitStep,
    completeTask,
    refresh
  };
}

/**
 * Step data hook for specific instance
 * Provides step data management and validation for a workflow instance
 */
export function useStepData(instanceId: string): UseStepDataReturn {
  const stepData = useStore(workflowStore, (state: WorkflowState) => 
    state.instances.stepData[instanceId] || {}
  );

  const getStepData = useCallback((stepId: string): StepData | null => {
    return stepData[stepId] || null;
  }, [stepData]);

  const updateStepData = useCallback((stepId: string, data: Partial<StepData>): void => {
    workflowStore.getState().updateStepData(instanceId, stepId, data);
  }, [instanceId]);

  const validateStepData = useCallback((stepId: string): boolean => {
    const data = stepData[stepId];
    return data ? data.isValid : false;
  }, [stepData]);

  const isStepComplete = useCallback((stepId: string): boolean => {
    const data = stepData[stepId];
    return data ? !!data.submittedAt : false;
  }, [stepData]);

  const getValidationErrors = useCallback((stepId: string): string[] => {
    const data = stepData[stepId];
    return data ? data.validationErrors : [];
  }, [stepData]);

  return {
    stepData,
    getStepData,
    updateStepData,
    validateStepData,
    isStepComplete,
    getValidationErrors
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Template status hook
 * Quick access to template status information
 */
export function useTemplateStatus(templateId: string): {
  isActive: boolean;
  isPublished: boolean;
  isLoading: boolean;
  clientVisible: boolean;
} {
  const template = useStore(workflowStore, (state: WorkflowState) => 
    state.templates.metadata[templateId]
  );
  const isLoading = useStore(workflowStore, (state: WorkflowState) => 
    state.templates.loading.has(templateId)
  );

  return {
    isActive: template?.isActive || false,
    isPublished: template?.isPublished || false,
    isLoading,
    clientVisible: template?.clientVisible || false
  };
}

/**
 * Instance status hook
 * Quick access to instance status and progress
 */
export function useInstanceStatus(instanceId: string): {
  status: WorkflowInstance['status'] | null;
  progress: number;
  isLoading: boolean;
  currentStage: string | null;
  currentTask: string | null;
  currentStep: string | null;
} {
  const instance = useStore(workflowStore, (state: WorkflowState) => 
    state.instances.active[instanceId]
  );
  const progressData = useStore(workflowStore, (state: WorkflowState) => 
    state.instances.progress[instanceId]
  );
  const isLoading = useStore(workflowStore, (state: WorkflowState) => state.loading);

  return {
    status: instance?.status || null,
    progress: instance?.progressPercentage || 0,
    isLoading,
    currentStage: progressData?.currentStageId || null,
    currentTask: progressData?.currentTaskId || null,
    currentStep: progressData?.currentStepId || null
  };
} 