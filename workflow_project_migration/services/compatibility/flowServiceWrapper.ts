// Flow Service Compatibility Wrapper
// Provides backward compatibility for existing project flow functionality

import { unifiedWorkflowService } from '../unifiedWorkflowService';
import type { 
  UnifiedWorkflowTemplate,
  CreateWorkflowTemplateRequest,
  UpdateWorkflowTemplateRequest
} from '@/types/unified-workflow';

// Legacy types for backward compatibility
export interface ProjectFlow {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  estimated_duration_minutes?: number;
  icon?: string;
  color?: string;
  sort_order: number;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  requires_products_services: boolean;
  requires_template_selection: boolean;
  auto_create_project: boolean;
  project_flow_steps?: ProjectFlowStep[];
}

export interface ProjectFlowStep {
  id: string;
  flow_id: string;
  name: string;
  description?: string;
  step_number: number;
  is_required: boolean;
  allow_skip: boolean;
  show_progress: boolean;
  auto_advance: boolean;
  condition_logic: Record<string, any>;
  created_at: string;
  updated_at: string;
  project_flow_elements?: ProjectFlowElement[];
}

export interface ProjectFlowElement {
  id: string;
  step_id: string;
  element_type: string;
  element_key: string;
  label?: string;
  placeholder?: string;
  help_text?: string;
  element_order: number;
  config: Record<string, any>;
  is_required: boolean;
  validation_rules: Record<string, any>;
  condition_logic: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ProjectFlowInstance {
  id: string;
  flow_id: string;
  user_id?: string;
  client_id?: string;
  status: string;
  current_step_id?: string;
  current_step_number?: number;
  completed_steps: number[];
  started_at?: string;
  completed_at?: string;
  last_activity_at: string;
  created_project_id?: string;
  error_message?: string;
  metadata: Record<string, any>;
}

export interface CreateProjectFlowRequest {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  requires_products_services?: boolean;
  auto_create_project?: boolean;
  estimated_duration_minutes?: number;
  created_by_user_id: string;
}

export interface UpdateProjectFlowRequest {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  requires_products_services?: boolean;
  auto_create_project?: boolean;
  estimated_duration_minutes?: number;
  updated_by_user_id: string;
}

export class FlowServiceWrapper {
  // Legacy flow methods that map to unified service
  async createProjectFlow(data: CreateProjectFlowRequest): Promise<ProjectFlow> {
    const unifiedTemplate = await unifiedWorkflowService.createTemplate({
      name: data.name,
      description: data.description,
      template_type: 'flow_based',
      icon: data.icon,
      color: data.color,
      requires_products_services: data.requires_products_services ?? false,
      auto_create_project: data.auto_create_project ?? true,
      estimated_duration_minutes: data.estimated_duration_minutes,
      client_visible: true,
      created_by: data.created_by_user_id,
      create_default_structure: true
    });

    return this.mapUnifiedToLegacyFlow(unifiedTemplate);
  }

  async updateProjectFlow(id: string, data: UpdateProjectFlowRequest): Promise<ProjectFlow> {
    const unifiedTemplate = await unifiedWorkflowService.updateTemplate(id, {
      name: data.name,
      description: data.description,
      icon: data.icon,
      color: data.color,
      requires_products_services: data.requires_products_services,
      auto_create_project: data.auto_create_project,
      estimated_duration_minutes: data.estimated_duration_minutes,
      updated_by: data.updated_by_user_id
    });

    return this.mapUnifiedToLegacyFlow(unifiedTemplate);
  }

  async deleteProjectFlow(id: string, deletedBy: string): Promise<void> {
    await unifiedWorkflowService.deleteTemplate(id, deletedBy);
  }

  async getProjectFlow(id: string): Promise<ProjectFlow | null> {
    const unifiedTemplate = await unifiedWorkflowService.getTemplate(id);
    if (!unifiedTemplate || unifiedTemplate.template_type !== 'flow_based') {
      return null;
    }

    return this.mapUnifiedToLegacyFlow(unifiedTemplate);
  }

  async getProjectFlows(): Promise<ProjectFlow[]> {
    const unifiedTemplates = await unifiedWorkflowService.getTemplates({
      template_type: 'flow_based',
      is_active: true
    });

    return unifiedTemplates.map(template => this.mapUnifiedToLegacyFlow(template));
  }

  async getProjectFlowWithStepsAndElements(id: string): Promise<ProjectFlow | null> {
    const unifiedTemplate = await unifiedWorkflowService.getTemplate(id);
    if (!unifiedTemplate || unifiedTemplate.template_type !== 'flow_based') {
      return null;
    }

    return this.mapUnifiedToLegacyFlowWithHierarchy(unifiedTemplate);
  }

  // Step management methods
  async createProjectFlowStep(flowId: string, data: {
    name: string;
    description?: string;
    step_number?: number;
    is_required?: boolean;
    allow_skip?: boolean;
    show_progress?: boolean;
    auto_advance?: boolean;
    created_by: string;
  }): Promise<ProjectFlowStep> {
    // Get the default task for this flow
    const template = await unifiedWorkflowService.getTemplate(flowId);
    if (!template || !template.unified_workflow_stages?.[0]?.unified_workflow_tasks?.[0]) {
      throw new Error('Flow structure not found');
    }

    const taskId = template.unified_workflow_stages[0].unified_workflow_tasks[0].id;

    const unifiedStep = await unifiedWorkflowService.createStep(taskId, {
      name: data.name,
      description: data.description,
      step_order: data.step_number,
      is_required: data.is_required,
      allow_skip: data.allow_skip,
      show_progress: data.show_progress,
      auto_advance: data.auto_advance,
      created_by: data.created_by
    });

    return this.mapUnifiedToLegacyStep(unifiedStep, flowId, data.step_number || 1);
  }

  // Element management methods
  async createProjectFlowElement(stepId: string, data: {
    element_type: string;
    element_key: string;
    label?: string;
    placeholder?: string;
    help_text?: string;
    element_order?: number;
    config?: Record<string, any>;
    is_required?: boolean;
    validation_rules?: Record<string, any>;
    condition_logic?: Record<string, any>;
    created_by: string;
  }): Promise<ProjectFlowElement> {
    const unifiedElement = await unifiedWorkflowService.createElement(stepId, {
      element_type: data.element_type,
      element_key: data.element_key,
      label: data.label,
      placeholder: data.placeholder,
      help_text: data.help_text,
      element_order: data.element_order,
      config: data.config,
      is_required: data.is_required,
      validation_rules: data.validation_rules,
      condition_logic: data.condition_logic,
      created_by: data.created_by
    });

    return this.mapUnifiedToLegacyElement(unifiedElement);
  }

  // Instance management methods
  async createProjectFlowInstance(flowId: string, data: {
    user_id?: string;
    client_id?: string;
    created_by: string;
  }): Promise<ProjectFlowInstance> {
    const template = await unifiedWorkflowService.getTemplate(flowId);
    if (!template) throw new Error('Flow not found');

    const unifiedInstance = await unifiedWorkflowService.createInstance(flowId, {
      name: `Instance of ${template.name}`,
      description: 'Flow instance created via compatibility layer',
      client_id: data.client_id,
      assigned_to: data.user_id,
      created_by: data.created_by
    });

    return this.mapUnifiedToLegacyInstance(unifiedInstance);
  }

  // Mapping functions
  private mapUnifiedToLegacyFlow(unified: UnifiedWorkflowTemplate): ProjectFlow {
    return {
      id: unified.id,
      name: unified.name,
      description: unified.description,
      is_active: unified.is_active,
      estimated_duration_minutes: unified.estimated_duration_minutes,
      icon: unified.icon,
      color: unified.color,
      sort_order: 0, // Default sort order
      created_by_user_id: unified.created_by,
      created_at: unified.created_at,
      updated_at: unified.updated_at,
      requires_products_services: unified.requires_products_services,
      requires_template_selection: true, // Default for flow-based
      auto_create_project: unified.auto_create_project
    };
  }

  private mapUnifiedToLegacyFlowWithHierarchy(unified: UnifiedWorkflowTemplate): ProjectFlow {
    // Extract steps from the unified hierarchy
    const steps = this.extractStepsFromUnified(unified);

    return {
      id: unified.id,
      name: unified.name,
      description: unified.description,
      is_active: unified.is_active,
      estimated_duration_minutes: unified.estimated_duration_minutes,
      icon: unified.icon,
      color: unified.color,
      sort_order: 0,
      created_by_user_id: unified.created_by,
      created_at: unified.created_at,
      updated_at: unified.updated_at,
      requires_products_services: unified.requires_products_services,
      requires_template_selection: true,
      auto_create_project: unified.auto_create_project,
      project_flow_steps: steps
    };
  }

  private extractStepsFromUnified(unified: UnifiedWorkflowTemplate): ProjectFlowStep[] {
    const steps: ProjectFlowStep[] = [];
    let stepNumber = 1;

    // Navigate through the hierarchy to extract steps
    unified.unified_workflow_stages?.forEach(stage => {
      stage.unified_workflow_tasks?.forEach(task => {
        task.unified_workflow_steps?.forEach(step => {
          steps.push({
            id: step.id,
            flow_id: unified.id,
            name: step.name,
            description: step.description,
            step_number: stepNumber++,
            is_required: step.is_required,
            allow_skip: step.allow_skip,
            show_progress: step.show_progress,
            auto_advance: step.auto_advance,
            condition_logic: step.condition_logic,
            created_at: step.created_at,
            updated_at: step.updated_at,
            project_flow_elements: step.unified_workflow_elements?.map(element => ({
              id: element.id,
              step_id: element.step_id,
              element_type: element.element_type,
              element_key: element.element_key,
              label: element.label,
              placeholder: element.placeholder,
              help_text: element.help_text,
              element_order: element.element_order,
              config: element.config,
              is_required: element.is_required,
              validation_rules: element.validation_rules,
              condition_logic: element.condition_logic,
              created_at: element.created_at,
              updated_at: element.updated_at
            })) || []
          });
        });
      });
    });

    return steps;
  }

  private mapUnifiedToLegacyStep(unified: any, flowId: string, stepNumber: number): ProjectFlowStep {
    return {
      id: unified.id,
      flow_id: flowId,
      name: unified.name,
      description: unified.description,
      step_number: stepNumber,
      is_required: unified.is_required,
      allow_skip: unified.allow_skip,
      show_progress: unified.show_progress,
      auto_advance: unified.auto_advance,
      condition_logic: unified.condition_logic,
      created_at: unified.created_at,
      updated_at: unified.updated_at
    };
  }

  private mapUnifiedToLegacyElement(unified: any): ProjectFlowElement {
    return {
      id: unified.id,
      step_id: unified.step_id,
      element_type: unified.element_type,
      element_key: unified.element_key,
      label: unified.label,
      placeholder: unified.placeholder,
      help_text: unified.help_text,
      element_order: unified.element_order,
      config: unified.config,
      is_required: unified.is_required,
      validation_rules: unified.validation_rules,
      condition_logic: unified.condition_logic,
      created_at: unified.created_at,
      updated_at: unified.updated_at
    };
  }

  private mapUnifiedToLegacyInstance(unified: any): ProjectFlowInstance {
    return {
      id: unified.id,
      flow_id: unified.template_id,
      user_id: unified.assigned_to,
      client_id: unified.client_id,
      status: unified.status,
      current_step_id: unified.current_step_id,
      current_step_number: 1, // Would need calculation
      completed_steps: [], // Would need calculation
      started_at: unified.started_at,
      completed_at: unified.completed_at,
      last_activity_at: unified.updated_at,
      created_project_id: unified.project_id,
      metadata: unified.instance_data
    };
  }
}

// Export singleton instance for backward compatibility
export const flowService = new FlowServiceWrapper();
export const projectFlowService = flowService; // Legacy alias 