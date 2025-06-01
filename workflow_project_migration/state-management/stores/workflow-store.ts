/**
 * Workflow Store Implementation
 * 
 * Manages workflow templates, instances, and builder state with comprehensive
 * debug integration, performance monitoring, and caching support.
 */

import { createDomainStore } from '../core/store-debug';
import { 
  getCached, 
  setCached, 
  createCacheKey, 
  invalidateTemplate
} from '../cache/cache-integration';
import { globalEventBus } from '../composition/event-bus';
import type { 
  WorkflowState, 
  WorkflowInstance,
  WorkflowBuilderState,
  TemplateMetadata,
  CompleteTemplate,
  InstanceProgress,
  StepData,
  StateCreator
} from '../core/types';

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialWorkflowState: WorkflowState = {
  // Base state properties
  loading: false,
  error: null,
  lastUpdated: null,
  
  // Templates management
  templates: {
    metadata: {},
    hierarchies: {},
    loading: new Set(),
  },
  
  // Instances management
  instances: {
    active: {},
    progress: {},
    stepData: {},
  },
  
  // Builder state
  builder: {
    activeLevel: 'template',
    selectedItem: null,
    expandedItems: new Set(),
    isDirty: false,
    saveStatus: 'idle',
    dragState: null,
    clipboard: null,
    undoStack: [],
    redoStack: [],
  },
};

// ============================================================================
// STORE CREATOR
// ============================================================================

const createWorkflowStore: StateCreator<WorkflowState> = (set, get) => ({
  ...initialWorkflowState,

  // ============================================================================
  // TEMPLATE ACTIONS (WITH CACHE INTEGRATION)
  // ============================================================================

  /**
   * Load template metadata with cache integration
   */
  loadTemplateMetadata: async (templateId: string) => {
    const state = get();
    
    // Prevent duplicate loading
    if (state.templates.loading.has(templateId)) {
      return;
    }

    // Check if already loaded in store
    if (state.templates.metadata[templateId]) {
      return state.templates.metadata[templateId];
    }

    set({
      ...state,
      templates: {
        ...state.templates,
        loading: new Set(state.templates.loading).add(templateId),
      },
      loading: true,
      error: null,
    });

    try {
      const cacheKey = createCacheKey.templateMetadata(templateId);
      
      // Use cache-first pattern with fallback
      const metadata = await getCached(
        cacheKey,
        async () => {
          // TODO: Replace with actual API call
          const apiData: TemplateMetadata = {
            id: templateId,
            name: `Template ${templateId}`,
            description: 'Sample template description',
            type: 'standard',
            category: 'general',
            tags: ['sample'],
            stageCount: 1,
            taskCount: 1,
            isActive: true,
            isPublished: true,
            clientVisible: true,
            lastModified: new Date().toISOString(),
            createdBy: 'system',
            version: 1,
          };
          
          return apiData;
        },
        { dataType: 'template' }
      );

      const newState = get();
      const newLoading = new Set(newState.templates.loading);
      newLoading.delete(templateId);

      set({
        ...newState,
        templates: {
          ...newState.templates,
          metadata: {
            ...newState.templates.metadata,
            [templateId]: metadata,
          },
          loading: newLoading,
        },
        loading: newLoading.size > 0,
        lastUpdated: new Date().toISOString(),
      });

      return metadata;
    } catch (error) {
      const newState = get();
      const newLoading = new Set(newState.templates.loading);
      newLoading.delete(templateId);

      set({
        ...newState,
        templates: {
          ...newState.templates,
          loading: newLoading,
        },
        loading: newLoading.size > 0,
        error: error instanceof Error ? error.message : 'Failed to load template metadata',
      });
      throw error;
    }
  },

  /**
   * Load complete template hierarchy with cache integration
   */
  loadTemplateHierarchy: async (templateId: string) => {
    const state = get();
    
    if (state.templates.loading.has(templateId)) {
      return;
    }

    // Check if already loaded in store
    if (state.templates.hierarchies[templateId]) {
      return state.templates.hierarchies[templateId];
    }

    set({
      ...state,
      templates: {
        ...state.templates,
        loading: new Set(state.templates.loading).add(templateId),
      },
      loading: true,
      error: null,
    });

    try {
      const cacheKey = createCacheKey.templateHierarchy(templateId);
      
      // Use cache-first pattern with fallback
      const hierarchy = await getCached(
        cacheKey,
        async () => {
          // TODO: Replace with actual API call
          const apiData: CompleteTemplate = {
            id: templateId,
            name: `Template ${templateId}`,
            description: 'Sample template description',
            type: 'standard',
            category: 'general',
            tags: ['sample'],
            stageCount: 1,
            taskCount: 1,
            isActive: true,
            isPublished: true,
            clientVisible: true,
            lastModified: new Date().toISOString(),
            createdBy: 'system',
            version: 1,
            stages: [],
            settings: {
              requiresProductsServices: false,
              autoCreateProject: true,
            },
          };
          
          return apiData;
        },
        { dataType: 'hierarchy' }
      );

      const newState = get();
      const newLoading = new Set(newState.templates.loading);
      newLoading.delete(templateId);

      set({
        ...newState,
        templates: {
          ...newState.templates,
          hierarchies: {
            ...newState.templates.hierarchies,
            [templateId]: hierarchy,
          },
          loading: newLoading,
        },
        loading: newLoading.size > 0,
        lastUpdated: new Date().toISOString(),
      });

      return hierarchy;
    } catch (error) {
      const newState = get();
      const newLoading = new Set(newState.templates.loading);
      newLoading.delete(templateId);

      set({
        ...newState,
        templates: {
          ...newState.templates,
          loading: newLoading,
        },
        loading: newLoading.size > 0,
        error: error instanceof Error ? error.message : 'Failed to load template hierarchy',
      });
      throw error;
    }
  },

  /**
   * Update template metadata with cache invalidation
   */
  updateTemplateMetadata: async (templateId: string, updates: Partial<TemplateMetadata>) => {
    const state = get();
    
    // Optimistic update
    if (state.templates.metadata[templateId]) {
      const updatedMetadata = {
        ...state.templates.metadata[templateId],
        ...updates,
        lastModified: new Date().toISOString(),
      };

      set({
        ...state,
        templates: {
          ...state.templates,
          metadata: {
            ...state.templates.metadata,
            [templateId]: updatedMetadata,
          },
        },
        lastUpdated: new Date().toISOString(),
      });
    }

    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API call
      
      // Update cache with confirmed data
      const updatedState = get();
      const updatedMetadata = updatedState.templates.metadata[templateId];
      if (updatedMetadata) {
        setCached(
          createCacheKey.templateMetadata(templateId),
          updatedMetadata,
          { dataType: 'template' }
        );
      }

      // Emit event for cache invalidation of related data
      globalEventBus.emit('workflow:template:updated', { 
        templateId, 
        changes: Object.keys(updates) 
      });
      
      return updatedMetadata;
    } catch (error) {
      // Rollback optimistic update - reload from cache or API
      const currentState = get();
      set({
        ...currentState,
        error: error instanceof Error ? error.message : 'Failed to update template',
      });
      
      // Re-load metadata to get correct state - will be handled by next user action
      throw error;
    }
  },

  // ============================================================================
  // INSTANCE ACTIONS
  // ============================================================================

  /**
   * Create new workflow instance
   */
  createInstance: async (templateId: string, instanceData: Partial<WorkflowInstance>) => {
    const state = get();
    
    set({
      ...state,
      loading: true,
      error: null,
    });

    try {
      const instanceId = `instance_${Date.now()}`;
      
      // TODO: Replace with actual API call
      const instance: WorkflowInstance = {
        id: instanceId,
        templateId,
        projectId: instanceData.projectId || undefined,
        clientId: instanceData.clientId || 'default',
        name: instanceData.name || `Instance of ${templateId}`,
        description: instanceData.description || undefined,
        status: 'draft',
        currentStepId: undefined,
        progressPercentage: 0,
        assignedTo: instanceData.assignedTo || undefined,
        startedAt: undefined,
        completedAt: undefined,
        dueDate: instanceData.dueDate || undefined,
        metadata: instanceData.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        updatedBy: 'system',
      };

      const newState = get();
      
      set({
        ...newState,
        instances: {
          ...newState.instances,
          active: {
            ...newState.instances.active,
            [instanceId]: instance,
          },
          progress: {
            ...newState.instances.progress,
            [instanceId]: {
              id: instanceId,
              templateId,
              status: 'draft',
              currentStageId: undefined,
              currentTaskId: undefined,
              currentStepId: undefined,
              progressPercentage: 0,
              completedSteps: [],
              completedTasks: [],
              completedStages: [],
              nextSteps: [],
              blockedSteps: [],
              lastActivity: new Date().toISOString(),
            },
          },
        },
        loading: false,
        lastUpdated: new Date().toISOString(),
      });

      return instance;
    } catch (error) {
      const currentState = get();
      set({
        ...currentState,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to create instance',
      });
      throw error;
    }
  },

  /**
   * Update instance progress
   */
  updateInstanceProgress: (instanceId: string, progress: Partial<InstanceProgress>) => {
    const state = get();
    
    if (state.instances.progress[instanceId]) {
      const updatedProgress = {
        ...state.instances.progress[instanceId],
        ...progress,
      };

      set({
        ...state,
        instances: {
          ...state.instances,
          progress: {
            ...state.instances.progress,
            [instanceId]: updatedProgress,
          },
        },
        lastUpdated: new Date().toISOString(),
      });
    }
  },

  /**
   * Update step data
   */
  updateStepData: (instanceId: string, stepId: string, data: Partial<StepData>) => {
    const state = get();
    
    // Ensure instance step data exists
    const currentInstanceStepData = state.instances.stepData[instanceId] || {};
    
    // Ensure step data exists
    const currentStepData = currentInstanceStepData[stepId] || {
      stepId,
      instanceId,
      formData: {},
      status: 'pending',
      submittedAt: undefined,
      submittedBy: undefined,
      reviewedAt: undefined,
      reviewedBy: undefined,
      approvedAt: undefined,
      approvedBy: undefined,
      rejectedAt: undefined,
      rejectedBy: undefined,
      rejectionReason: undefined,
      metadata: {},
    };

    const updatedStepData = {
      ...currentStepData,
      ...data,
    };

    set({
      ...state,
      instances: {
        ...state.instances,
        stepData: {
          ...state.instances.stepData,
          [instanceId]: {
            ...currentInstanceStepData,
            [stepId]: updatedStepData,
          },
        },
      },
      lastUpdated: new Date().toISOString(),
    });
  },

  // ============================================================================
  // BUILDER ACTIONS
  // ============================================================================

  /**
   * Set active builder level
   */
  setActiveLevel: (level: WorkflowBuilderState['activeLevel']) => {
    const state = get();
    set({
      ...state,
      builder: {
        ...state.builder,
        activeLevel: level,
      },
      lastUpdated: new Date().toISOString(),
    });
  },

  /**
   * Set selected item
   */
  setSelectedItem: (itemId: string | null) => {
    const state = get();
    set({
      ...state,
      builder: {
        ...state.builder,
        selectedItem: itemId,
      },
      lastUpdated: new Date().toISOString(),
    });
  },

  /**
   * Toggle expanded item
   */
  toggleExpandedItem: (itemId: string) => {
    const state = get();
    const newExpandedItems = new Set(state.builder.expandedItems);
    
    if (newExpandedItems.has(itemId)) {
      newExpandedItems.delete(itemId);
    } else {
      newExpandedItems.add(itemId);
    }

    set({
      ...state,
      builder: {
        ...state.builder,
        expandedItems: newExpandedItems,
      },
      lastUpdated: new Date().toISOString(),
    });
  },

  /**
   * Set dirty state
   */
  setDirty: (isDirty: boolean) => {
    const state = get();
    set({
      ...state,
      builder: {
        ...state.builder,
        isDirty,
      },
      lastUpdated: new Date().toISOString(),
    });
  },

  /**
   * Set save status
   */
  setSaveStatus: (status: WorkflowBuilderState['saveStatus']) => {
    const state = get();
    set({
      ...state,
      builder: {
        ...state.builder,
        saveStatus: status,
      },
      lastUpdated: new Date().toISOString(),
    });
  },

  // ============================================================================
  // UTILITY ACTIONS
  // ============================================================================

  /**
   * Reset store to initial state
   */
  reset: () => {
    set({ ...initialWorkflowState });
  },

  /**
   * Clear error state
   */
  clearError: () => {
    const state = get();
    set({
      ...state,
      error: null,
    });
  },
});

// ============================================================================
// STORE INSTANCE
// ============================================================================

/**
 * Workflow store with debug integration and performance monitoring
 */
export const useWorkflowStore = createDomainStore(
  'workflow',
  createWorkflowStore,
  {
    debug: {
      enabled: true,
      enableLogging: true,
      enablePerformanceMonitoring: true,
      enableStateInspection: true,
      logCategory: 'workflow',
      performanceCategory: 'state-update',
      logLevel: 'info',
    },
  }
);

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Get template metadata by ID
 */
export const selectTemplateMetadata = (templateId: string) => (state: WorkflowState) =>
  state.templates.metadata[templateId] || null;

/**
 * Get template hierarchy by ID
 */
export const selectTemplateHierarchy = (templateId: string) => (state: WorkflowState) =>
  state.templates.hierarchies[templateId] || null;

/**
 * Get active instance by ID
 */
export const selectActiveInstance = (instanceId: string) => (state: WorkflowState) =>
  state.instances.active[instanceId] || null;

/**
 * Get instance progress by ID
 */
export const selectInstanceProgress = (instanceId: string) => (state: WorkflowState) =>
  state.instances.progress[instanceId] || null;

/**
 * Get step data by instance and step ID
 */
export const selectStepData = (instanceId: string, stepId: string) => (state: WorkflowState) =>
  state.instances.stepData[instanceId]?.[stepId] || null;

/**
 * Get all templates metadata
 */
export const selectAllTemplatesMetadata = (state: WorkflowState) =>
  Object.values(state.templates.metadata);

/**
 * Get loading templates
 */
export const selectLoadingTemplates = (state: WorkflowState) =>
  Array.from(state.templates.loading);

/**
 * Get builder state
 */
export const selectBuilderState = (state: WorkflowState) => state.builder;

/**
 * Check if template is loading
 */
export const selectIsTemplateLoading = (templateId: string) => (state: WorkflowState) =>
  state.templates.loading.has(templateId); 