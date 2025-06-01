// Unified Workflow Hook
// Provides React integration for the unified workflow service with feature flag support

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  unifiedWorkflowService, 
  templateService, 
  flowService,
  migrationUtils,
  type UnifiedWorkflowTemplate,
  type UnifiedWorkflowStage,
  type UnifiedWorkflowTask,
  type UnifiedWorkflowStep,
  type UnifiedWorkflowElement,
  type ProjectTemplate,
  type ProjectFlow,
  type CreateWorkflowTemplateRequest,
  type TemplateFilters
} from '@/services';

interface UseUnifiedWorkflowOptions {
  autoFetch?: boolean;
  filters?: TemplateFilters;
}

interface UseUnifiedWorkflowReturn {
  // Data
  templates: UnifiedWorkflowTemplate[];
  loading: boolean;
  error: string | null;
  
  // Actions
  createTemplate: (data: CreateWorkflowTemplateRequest) => Promise<UnifiedWorkflowTemplate>;
  updateTemplate: (id: string, data: any) => Promise<UnifiedWorkflowTemplate>;
  deleteTemplate: (id: string, deletedBy: string) => Promise<void>;
  getTemplate: (id: string) => Promise<UnifiedWorkflowTemplate | null>;
  refetch: () => Promise<void>;
  
  // Hierarchy Management Actions
  deleteStage: (id: string, deletedBy: string) => Promise<void>;
  deleteTask: (id: string, deletedBy: string) => Promise<void>;
  deleteStep: (id: string, deletedBy: string) => Promise<void>;
  deleteElement: (id: string, deletedBy: string) => Promise<void>;
  updateElement: (id: string, data: Partial<UnifiedWorkflowElement>, updatedBy: string) => Promise<UnifiedWorkflowElement>;
  
  // Migration utilities
  isUsingUnifiedService: boolean;
  migrationMode: 'unified' | 'compatibility';
}

export function useUnifiedWorkflow(options: UseUnifiedWorkflowOptions = {}): UseUnifiedWorkflowReturn {
  const { autoFetch = true, filters } = options;
  
  const [templates, setTemplates] = useState<UnifiedWorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isUsingUnifiedService = migrationUtils.isUsingUnifiedService();
  const migrationMode = isUsingUnifiedService ? 'unified' : 'compatibility';

  // Memoize filters to prevent infinite loops
  const memoizedFilters = useMemo(() => filters, [JSON.stringify(filters)]);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (isUsingUnifiedService) {
        // Use new unified service
        const data = await unifiedWorkflowService.getTemplates(memoizedFilters);
        setTemplates(data);
      } else {
        // Use compatibility layer - combine templates and flows
        const [templateData, flowData] = await Promise.all([
          templateService.getProjectTemplates(),
          flowService.getProjectFlows()
        ]);
        
        // Convert legacy data to unified format
        const combinedData: UnifiedWorkflowTemplate[] = [
          ...templateData.map(mapLegacyTemplateToUnified),
          ...flowData.map(mapLegacyFlowToUnified)
        ];
        
        // Apply filters if provided
        const filteredData = applyFiltersToLegacyData(combinedData, memoizedFilters);
        setTemplates(filteredData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch templates');
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  }, [memoizedFilters, isUsingUnifiedService]);

  const createTemplate = useCallback(async (data: CreateWorkflowTemplateRequest): Promise<UnifiedWorkflowTemplate> => {
    try {
      setError(null);
      
      if (isUsingUnifiedService) {
        const template = await unifiedWorkflowService.createTemplate(data);
        await fetchTemplates(); // Refresh list
        return template;
      } else {
        // Use compatibility layer based on template type
        if (data.template_type === 'standard') {
          const legacyTemplate = await templateService.createProjectTemplate({
            name: data.name,
            description: data.description,
            created_by_user_id: data.created_by
          });
          const unifiedTemplate = mapLegacyTemplateToUnified(legacyTemplate);
          await fetchTemplates(); // Refresh list
          return unifiedTemplate;
        } else {
          const legacyFlow = await flowService.createProjectFlow({
            name: data.name,
            description: data.description,
            icon: data.icon,
            color: data.color,
            requires_products_services: data.requires_products_services,
            auto_create_project: data.auto_create_project,
            estimated_duration_minutes: data.estimated_duration_minutes,
            created_by_user_id: data.created_by
          });
          const unifiedTemplate = mapLegacyFlowToUnified(legacyFlow);
          await fetchTemplates(); // Refresh list
          return unifiedTemplate;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create template');
      throw err;
    }
  }, [isUsingUnifiedService, fetchTemplates]);

  const updateTemplate = useCallback(async (id: string, data: any): Promise<UnifiedWorkflowTemplate> => {
    try {
      setError(null);
      
      if (isUsingUnifiedService) {
        const template = await unifiedWorkflowService.updateTemplate(id, data);
        await fetchTemplates(); // Refresh list
        return template;
      } else {
        // Determine if this is a template or flow based on existing data
        const existing = templates.find(t => t.id === id);
        if (!existing) throw new Error('Template not found');
        
        if (existing.template_type === 'standard') {
          const legacyTemplate = await templateService.updateProjectTemplate(id, {
            name: data.name,
            description: data.description,
            updated_by_user_id: data.updated_by
          });
          const unifiedTemplate = mapLegacyTemplateToUnified(legacyTemplate);
          await fetchTemplates(); // Refresh list
          return unifiedTemplate;
        } else {
          const legacyFlow = await flowService.updateProjectFlow(id, {
            name: data.name,
            description: data.description,
            icon: data.icon,
            color: data.color,
            requires_products_services: data.requires_products_services,
            auto_create_project: data.auto_create_project,
            estimated_duration_minutes: data.estimated_duration_minutes,
            updated_by_user_id: data.updated_by
          });
          const unifiedTemplate = mapLegacyFlowToUnified(legacyFlow);
          await fetchTemplates(); // Refresh list
          return unifiedTemplate;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update template');
      throw err;
    }
  }, [isUsingUnifiedService, fetchTemplates, templates]);

  const deleteTemplate = useCallback(async (id: string, deletedBy: string): Promise<void> => {
    try {
      setError(null);
      
      if (isUsingUnifiedService) {
        await unifiedWorkflowService.deleteTemplate(id, deletedBy);
      } else {
        // Determine if this is a template or flow based on existing data
        const existing = templates.find(t => t.id === id);
        if (!existing) throw new Error('Template not found');
        
        if (existing.template_type === 'standard') {
          await templateService.deleteProjectTemplate(id, deletedBy);
        } else {
          await flowService.deleteProjectFlow(id, deletedBy);
        }
      }
      
      await fetchTemplates(); // Refresh list
    } catch (err: any) {
      setError(err.message || 'Failed to delete template');
      throw err;
    }
  }, [isUsingUnifiedService, fetchTemplates, templates]);

  const getTemplate = useCallback(async (id: string): Promise<UnifiedWorkflowTemplate | null> => {
    try {
      setError(null);
      
      if (isUsingUnifiedService) {
        return await unifiedWorkflowService.getTemplate(id);
      } else {
        // Try both template and flow services with full hierarchy
        const [legacyTemplate, legacyFlowWithHierarchy] = await Promise.all([
          templateService.getProjectTemplate(id).catch(() => null),
          flowService.getProjectFlowWithStepsAndElements(id).catch(() => null)
        ]);
        
        if (legacyTemplate) {
          return mapLegacyTemplateToUnified(legacyTemplate);
        } else if (legacyFlowWithHierarchy) {
          return mapLegacyFlowWithHierarchyToUnified(legacyFlowWithHierarchy);
        }
        
        return null;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get template');
      return null;
    }
  }, [isUsingUnifiedService]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchTemplates();
    }
  }, [autoFetch, fetchTemplates]);

  return {
    // Data
    templates,
    loading,
    error,
    
    // Actions
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
    refetch: fetchTemplates,
    
    // Hierarchy Management Actions
    deleteStage: async (id: string, deletedBy: string) => {
      try {
        setError(null);
        
        if (isUsingUnifiedService) {
          await unifiedWorkflowService.deleteStage(id, deletedBy);
        } else {
          // For compatibility mode, stage deletion not supported in legacy system
          throw new Error('Stage deletion not supported in compatibility mode. Please upgrade to unified workflow system.');
        }
        
        await fetchTemplates(); // Refresh list
      } catch (err: any) {
        setError(err.message || 'Failed to delete stage');
        throw err;
      }
    },
    deleteTask: async (id: string, deletedBy: string) => {
      try {
        setError(null);
        
        if (isUsingUnifiedService) {
          await unifiedWorkflowService.deleteTask(id, deletedBy);
        } else {
          // For compatibility mode, task deletion not supported in legacy system
          throw new Error('Task deletion not supported in compatibility mode. Please upgrade to unified workflow system.');
        }
        
        await fetchTemplates(); // Refresh list
      } catch (err: any) {
        setError(err.message || 'Failed to delete task');
        throw err;
      }
    },
    deleteStep: async (id: string, deletedBy: string) => {
      try {
        setError(null);
        
        if (isUsingUnifiedService) {
          await unifiedWorkflowService.deleteStep(id, deletedBy);
        } else {
          // For compatibility mode, step deletion not supported in legacy system
          throw new Error('Step deletion not supported in compatibility mode. Please upgrade to unified workflow system.');
        }
        
        await fetchTemplates(); // Refresh list
      } catch (err: any) {
        setError(err.message || 'Failed to delete step');
        throw err;
      }
    },
    deleteElement: async (id: string, deletedBy: string) => {
      try {
        setError(null);
        
        if (isUsingUnifiedService) {
          await unifiedWorkflowService.deleteElement(id, deletedBy);
        } else {
          // For compatibility mode, element deletion not supported in legacy system
          throw new Error('Element deletion not supported in compatibility mode. Please upgrade to unified workflow system.');
        }
        
        await fetchTemplates(); // Refresh list
      } catch (err: any) {
        setError(err.message || 'Failed to delete element');
        throw err;
      }
    },
    updateElement: async (id: string, data: Partial<UnifiedWorkflowElement>, updatedBy: string) => {
      try {
        setError(null);
        
        if (isUsingUnifiedService) {
          const element = await unifiedWorkflowService.updateElement(id, data, updatedBy);
          await fetchTemplates(); // Refresh list
          return element;
        } else {
          // For compatibility mode, element updates not supported in legacy system
          throw new Error('Element updates not supported in compatibility mode. Please upgrade to unified workflow system.');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to update element');
        throw err;
      }
    },
    
    // Migration utilities
    isUsingUnifiedService,
    migrationMode
  };
}

// Helper functions for legacy data mapping
function mapLegacyTemplateToUnified(legacy: ProjectTemplate): UnifiedWorkflowTemplate {
  return {
    id: legacy.id,
    name: legacy.name,
    description: legacy.description,
    template_type: 'standard',
    icon: undefined,
    color: undefined,
    category: undefined,
    tags: [],
    requires_products_services: false,
    auto_create_project: true,
    estimated_duration_minutes: undefined,
    client_visible: true,
    client_description: undefined,
    is_active: true,
    is_published: true,
    version: 1,
    created_at: legacy.created_at,
    updated_at: legacy.updated_at,
    created_by: legacy.created_by_user_id,
    updated_by: legacy.created_by_user_id
  };
}

function mapLegacyFlowToUnified(legacy: ProjectFlow): UnifiedWorkflowTemplate {
  return {
    id: legacy.id,
    name: legacy.name,
    description: legacy.description,
    template_type: 'flow_based',
    icon: legacy.icon,
    color: legacy.color,
    category: undefined,
    tags: [],
    requires_products_services: legacy.requires_products_services,
    auto_create_project: legacy.auto_create_project,
    estimated_duration_minutes: legacy.estimated_duration_minutes,
    client_visible: true,
    client_description: undefined,
    is_active: legacy.is_active,
    is_published: legacy.is_active, // Assume active flows are published
    version: 1,
    created_at: legacy.created_at,
    updated_at: legacy.updated_at,
    created_by: legacy.created_by_user_id,
    updated_by: legacy.created_by_user_id
  };
}

function mapLegacyFlowWithHierarchyToUnified(legacy: ProjectFlow): UnifiedWorkflowTemplate {
  // Create the base template
  const template = mapLegacyFlowToUnified(legacy);
  
  // If there are no steps, return the basic template
  if (!legacy.project_flow_steps || legacy.project_flow_steps.length === 0) {
    return template;
  }

  // Create a default stage to contain all the steps
  const defaultStage: UnifiedWorkflowStage = {
    id: `stage-${legacy.id}`,
    template_id: legacy.id,
    name: 'Flow Execution',
    description: 'Main execution stage for this flow',
    stage_order: 0,
    is_required: true,
    allow_skip: false,
    auto_advance: false,
    client_visible: true,
    condition_logic: {},
    created_at: legacy.created_at,
    updated_at: legacy.updated_at,
    created_by: legacy.created_by_user_id,
    updated_by: legacy.created_by_user_id,
    unified_workflow_tasks: []
  };

  // Create a default task to contain all the steps
  const defaultTask: UnifiedWorkflowTask = {
    id: `task-${legacy.id}`,
    stage_id: defaultStage.id,
    name: 'Flow Steps',
    description: 'Container task for flow steps',
    task_order: 0,
    task_type: 'standard',
    is_required: true,
    allow_skip: false,
    auto_advance: false,
    client_visible: true,
    condition_logic: {},
    depends_on_task_ids: [],
    created_at: legacy.created_at,
    updated_at: legacy.updated_at,
    created_by: legacy.created_by_user_id,
    updated_by: legacy.created_by_user_id,
    unified_workflow_steps: []
  };

  // Convert legacy steps to unified steps
  const unifiedSteps: UnifiedWorkflowStep[] = legacy.project_flow_steps.map(legacyStep => ({
    id: legacyStep.id,
    task_id: defaultTask.id,
    name: legacyStep.name,
    description: legacyStep.description,
    step_order: legacyStep.step_number - 1, // Convert to 0-based indexing
    step_type: 'form',
    is_required: legacyStep.is_required,
    allow_skip: legacyStep.allow_skip,
    auto_advance: legacyStep.auto_advance,
    show_progress: legacyStep.show_progress,
    allow_back_navigation: true,
    save_progress: true,
    client_visible: true,
    condition_logic: legacyStep.condition_logic,
    validation_rules: {},
    created_at: legacyStep.created_at,
    updated_at: legacyStep.updated_at,
    created_by: legacy.created_by_user_id,
    updated_by: legacy.created_by_user_id,
    unified_workflow_elements: legacyStep.project_flow_elements?.map(legacyElement => ({
      id: legacyElement.id,
      step_id: legacyStep.id,
      element_type: legacyElement.element_type,
      element_key: legacyElement.element_key,
      element_order: legacyElement.element_order,
      label: legacyElement.label,
      placeholder: legacyElement.placeholder,
      help_text: legacyElement.help_text,
      config: legacyElement.config,
      is_required: legacyElement.is_required,
      validation_rules: legacyElement.validation_rules,
      condition_logic: legacyElement.condition_logic,
      client_visible: true,
      created_at: legacyElement.created_at,
      updated_at: legacyElement.updated_at,
      created_by: legacy.created_by_user_id,
      updated_by: legacy.created_by_user_id
    })) || []
  }));

  // Assemble the hierarchy
  defaultTask.unified_workflow_steps = unifiedSteps;
  defaultStage.unified_workflow_tasks = [defaultTask];
  template.unified_workflow_stages = [defaultStage];

  return template;
}

function applyFiltersToLegacyData(data: UnifiedWorkflowTemplate[], filters?: TemplateFilters): UnifiedWorkflowTemplate[] {
  if (!filters) return data;
  
  return data.filter(template => {
    if (filters.template_type) {
      if (Array.isArray(filters.template_type)) {
        if (!filters.template_type.includes(template.template_type)) return false;
      } else {
        if (template.template_type !== filters.template_type) return false;
      }
    }
    
    if (filters.is_active !== undefined && template.is_active !== filters.is_active) {
      return false;
    }
    
    if (filters.is_published !== undefined && template.is_published !== filters.is_published) {
      return false;
    }
    
    if (filters.created_by && template.created_by !== filters.created_by) {
      return false;
    }
    
    if (filters.category && template.category !== filters.category) {
      return false;
    }
    
    if (filters.tags && filters.tags.length > 0) {
      const hasMatchingTag = filters.tags.some(tag => template.tags?.includes(tag));
      if (!hasMatchingTag) return false;
    }
    
    return true;
  });
} 