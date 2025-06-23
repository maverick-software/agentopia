// Template Service Compatibility Wrapper
// Provides backward compatibility for existing project template functionality

import { unifiedWorkflowService } from '../unifiedWorkflowService';
import type { 
  UnifiedWorkflowTemplate,
  CreateWorkflowTemplateRequest,
  UpdateWorkflowTemplateRequest
} from '@/types/unified-workflow';

// Legacy types for backward compatibility
export interface ProjectTemplate {
  id: string;
  name: string;
  description?: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  project_template_stages?: ProjectTemplateStage[];
}

export interface ProjectTemplateStage {
  id: string;
  template_id: string;
  name: string;
  description?: string;
  order: number;
  created_at: string;
  updated_at: string;
  project_template_tasks?: ProjectTemplateTask[];
}

export interface ProjectTemplateTask {
  id: string;
  stage_id: string;
  name: string;
  description?: string;
  order: number;
  assigned_to_user_id?: string;
  estimated_duration_minutes?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectTemplateRequest {
  name: string;
  description?: string;
  created_by_user_id: string;
}

export interface UpdateProjectTemplateRequest {
  name?: string;
  description?: string;
  updated_by_user_id: string;
}

export class TemplateServiceWrapper {
  // Legacy template methods that map to unified service
  async createProjectTemplate(data: CreateProjectTemplateRequest): Promise<ProjectTemplate> {
    const unifiedTemplate = await unifiedWorkflowService.createTemplate({
      name: data.name,
      description: data.description,
      template_type: 'standard',
      client_visible: true,
      created_by: data.created_by_user_id
    });

    return this.mapUnifiedToLegacyTemplate(unifiedTemplate);
  }

  async updateProjectTemplate(id: string, data: UpdateProjectTemplateRequest): Promise<ProjectTemplate> {
    const unifiedTemplate = await unifiedWorkflowService.updateTemplate(id, {
      name: data.name,
      description: data.description,
      updated_by: data.updated_by_user_id
    });

    return this.mapUnifiedToLegacyTemplate(unifiedTemplate);
  }

  async deleteProjectTemplate(id: string, deletedBy: string): Promise<void> {
    await unifiedWorkflowService.deleteTemplate(id, deletedBy);
  }

  async getProjectTemplate(id: string): Promise<ProjectTemplate | null> {
    const unifiedTemplate = await unifiedWorkflowService.getTemplate(id);
    if (!unifiedTemplate || unifiedTemplate.template_type !== 'standard') {
      return null;
    }

    return this.mapUnifiedToLegacyTemplate(unifiedTemplate);
  }

  async getProjectTemplates(): Promise<ProjectTemplate[]> {
    const unifiedTemplates = await unifiedWorkflowService.getTemplates({
      template_type: 'standard',
      is_active: true
    });

    return unifiedTemplates.map(template => this.mapUnifiedToLegacyTemplate(template));
  }

  async getProjectTemplateWithStagesAndTasks(id: string): Promise<ProjectTemplate | null> {
    const unifiedTemplate = await unifiedWorkflowService.getTemplate(id);
    if (!unifiedTemplate || unifiedTemplate.template_type !== 'standard') {
      return null;
    }

    return this.mapUnifiedToLegacyTemplateWithHierarchy(unifiedTemplate);
  }

  // Stage management methods
  async createProjectTemplateStage(templateId: string, data: {
    name: string;
    description?: string;
    order?: number;
    created_by: string;
  }): Promise<ProjectTemplateStage> {
    const unifiedStage = await unifiedWorkflowService.createStage(templateId, {
      name: data.name,
      description: data.description,
      stage_order: data.order,
      created_by: data.created_by
    });

    return this.mapUnifiedToLegacyStage(unifiedStage);
  }

  async updateProjectTemplateStage(id: string, data: {
    name?: string;
    description?: string;
    order?: number;
    updated_by: string;
  }): Promise<ProjectTemplateStage> {
    // Note: Update methods would need to be added to unified service
    // For now, this is a placeholder
    throw new Error('Stage update not yet implemented in unified service');
  }

  // Task management methods
  async createProjectTemplateTask(stageId: string, data: {
    name: string;
    description?: string;
    order?: number;
    assigned_to_user_id?: string;
    estimated_duration_minutes?: number;
    created_by: string;
  }): Promise<ProjectTemplateTask> {
    const unifiedTask = await unifiedWorkflowService.createTask(stageId, {
      name: data.name,
      description: data.description,
      task_order: data.order,
      assigned_to: data.assigned_to_user_id,
      estimated_duration_minutes: data.estimated_duration_minutes,
      created_by: data.created_by
    });

    return this.mapUnifiedToLegacyTask(unifiedTask);
  }

  // Mapping functions
  private mapUnifiedToLegacyTemplate(unified: UnifiedWorkflowTemplate): ProjectTemplate {
    return {
      id: unified.id,
      name: unified.name,
      description: unified.description,
      created_by_user_id: unified.created_by,
      created_at: unified.created_at,
      updated_at: unified.updated_at
    };
  }

  private mapUnifiedToLegacyTemplateWithHierarchy(unified: UnifiedWorkflowTemplate): ProjectTemplate {
    return {
      id: unified.id,
      name: unified.name,
      description: unified.description,
      created_by_user_id: unified.created_by,
      created_at: unified.created_at,
      updated_at: unified.updated_at,
      project_template_stages: unified.unified_workflow_stages?.map(stage => ({
        id: stage.id,
        template_id: stage.template_id,
        name: stage.name,
        description: stage.description,
        order: stage.stage_order,
        created_at: stage.created_at,
        updated_at: stage.updated_at,
        project_template_tasks: stage.unified_workflow_tasks?.map(task => ({
          id: task.id,
          stage_id: task.stage_id,
          name: task.name,
          description: task.description,
          order: task.task_order,
          assigned_to_user_id: task.assigned_to,
          estimated_duration_minutes: task.estimated_duration_minutes,
          created_at: task.created_at,
          updated_at: task.updated_at
        })) || []
      })) || []
    };
  }

  private mapUnifiedToLegacyStage(unified: any): ProjectTemplateStage {
    return {
      id: unified.id,
      template_id: unified.template_id,
      name: unified.name,
      description: unified.description,
      order: unified.stage_order,
      created_at: unified.created_at,
      updated_at: unified.updated_at
    };
  }

  private mapUnifiedToLegacyTask(unified: any): ProjectTemplateTask {
    return {
      id: unified.id,
      stage_id: unified.stage_id,
      name: unified.name,
      description: unified.description,
      order: unified.task_order,
      assigned_to_user_id: unified.assigned_to,
      estimated_duration_minutes: unified.estimated_duration_minutes,
      created_at: unified.created_at,
      updated_at: unified.updated_at
    };
  }
}

// Export singleton instance for backward compatibility
export const templateService = new TemplateServiceWrapper();
export const projectTemplateService = templateService; // Legacy alias 