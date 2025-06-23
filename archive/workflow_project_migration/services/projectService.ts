import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import { unifiedWorkflowService } from './unifiedWorkflowService';

// Types for project-related operations
export type ProjectPayload = Omit<Database['public']['Tables']['projects']['Insert'], 'id' | 'created_at' | 'updated_at'> & { id?: string };
export type ProjectStagePayload = Omit<Database['public']['Tables']['project_stages']['Insert'], 'id' | 'created_at' | 'updated_at'> & { id?: string };
export type ProjectTaskPayload = Omit<Database['public']['Tables']['project_tasks']['Insert'], 'id' | 'created_at' | 'updated_at'> & { id?: string };
export type ProjectMemberPayload = Omit<Database['public']['Tables']['project_members']['Insert'], 'id' | 'created_at' | 'updated_at'> & { id?: string };

// Project member role enum type
export type ProjectMemberRole = 'PROJECT_LEAD' | 'PROJECT_EDITOR' | 'PROJECT_VIEWER';

// Full type for a project with its stages, tasks, and members (for reading)
export type ProjectWithDetails = Database['public']['Tables']['projects']['Row'] & {
  project_stages: (Database['public']['Tables']['project_stages']['Row'] & {
    project_tasks: Database['public']['Tables']['project_tasks']['Row'][];
  })[];
  project_members: Database['public']['Tables']['project_members']['Row'][];
};

// Table name constants
const TABLE_PROJECTS = 'projects';
const TABLE_PROJECT_STAGES = 'project_stages';
const TABLE_PROJECT_TASKS = 'project_tasks';
const TABLE_PROJECT_MEMBERS = 'project_members';

// Helper to handle Supabase errors
const handleSupabaseError = (error: any, contextMessage: string) => {
  if (error) {
    console.error(contextMessage, error);
    throw new Error(`${contextMessage}: ${error.message}`);
  }
};

export const projectService = {
  // ========== PROJECT OPERATIONS ==========

  // Get all projects for a specific client
  async getProjectsByClient(clientId: string): Promise<Database['public']['Tables']['projects']['Row'][]> {
    const { data, error } = await supabase
      .from(TABLE_PROJECTS)
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    handleSupabaseError(error, `Error fetching projects for client ${clientId}`);
    return data || [];
  },

  // Get a single project by ID with all its stages, tasks, and members
  async getProjectById(projectId: string): Promise<ProjectWithDetails | null> {
    const { data, error } = await supabase
      .from(TABLE_PROJECTS)
      .select(`
        *,
        ${TABLE_PROJECT_STAGES} (
          *,
          ${TABLE_PROJECT_TASKS} (
            *
          )
        ),
        ${TABLE_PROJECT_MEMBERS} (*)
      `)
      .eq('id', projectId)
      .single();
    
    handleSupabaseError(error, `Error fetching project with ID ${projectId}`);
    
    // Sort stages and tasks by order in JavaScript since PostgREST doesn't support nested ordering like this
    if (data) {
      // Sort stages by order
      if (data.project_stages) {
        data.project_stages.sort((a: any, b: any) => a.order - b.order);
        
        // Sort tasks within each stage by order
        data.project_stages.forEach((stage: any) => {
          if (stage.project_tasks) {
            stage.project_tasks.sort((a: any, b: any) => a.order - b.order);
          }
        });
      }
    }
    
    return data as unknown as ProjectWithDetails | null;
  },

  // Create a blank project (without template)
  async createBlankProject(projectData: ProjectPayload): Promise<Database['public']['Tables']['projects']['Row']> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated to create project');

    const { data: newProject, error: projectError } = await supabase
      .from(TABLE_PROJECTS)
      .insert({ ...projectData, created_by_user_id: user.id })
      .select()
      .single();
    handleSupabaseError(projectError, 'Error creating blank project');
    if (!newProject) throw new Error('Failed to create project, no data returned.');

    // Add the creator as a PROJECT_LEAD
    await this.addProjectMember(newProject.id, user.id, 'PROJECT_LEAD');

    return newProject;
  },

  // Create a project from a template using the Supabase RPC function
  async createProjectFromTemplate(
    clientId: string, 
    templateId: string, 
    projectName: string
  ): Promise<Database['public']['Tables']['projects']['Row']> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated to create project from template');

    const { data: projectId, error } = await supabase
      .rpc('create_project_from_template', {
        p_client_id: clientId,
        p_template_id: templateId,
        p_project_name: projectName,
        p_created_by_user_id: user.id
      });

    handleSupabaseError(error, 'Error creating project from template');
    if (!projectId) throw new Error('Failed to create project from template');

    // Fetch the created project
    const { data: project, error: fetchError } = await supabase
      .from(TABLE_PROJECTS)
      .select('*')
      .eq('id', projectId)
      .single();

    handleSupabaseError(fetchError, `Error fetching created project ${projectId}`);
    if (!project) throw new Error('Failed to fetch created project');

    return project;
  },

  // Update a project
  async updateProject(projectId: string, updates: Partial<ProjectPayload>): Promise<Database['public']['Tables']['projects']['Row']> {
    const { data: updatedProject, error } = await supabase
      .from(TABLE_PROJECTS)
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();
    handleSupabaseError(error, `Error updating project with ID ${projectId}`);
    if (!updatedProject) throw new Error('Failed to update project, no data returned.');
    return updatedProject;
  },

  // Delete a project
  async deleteProject(projectId: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE_PROJECTS)
      .delete()
      .eq('id', projectId);
    handleSupabaseError(error, `Error deleting project with ID ${projectId}`);
  },

  // ========== PROJECT STAGE OPERATIONS ==========

  // Get all stages for a project
  async getStagesByProject(projectId: string): Promise<Database['public']['Tables']['project_stages']['Row'][]> {
    const { data, error } = await supabase
      .from(TABLE_PROJECT_STAGES)
      .select('*')
      .eq('project_id', projectId)
      .order('order', { ascending: true });
    handleSupabaseError(error, `Error fetching stages for project ${projectId}`);
    return data || [];
  },

  // Add a stage to a project
  async addStageToProject(projectId: string, stageData: Omit<ProjectStagePayload, 'project_id'>): Promise<Database['public']['Tables']['project_stages']['Row']> {
    const { data: newStage, error } = await supabase
      .from(TABLE_PROJECT_STAGES)
      .insert({ ...stageData, project_id: projectId })
      .select()
      .single();
    handleSupabaseError(error, `Error adding stage to project ${projectId}`);
    if (!newStage) throw new Error('Failed to add stage, no data returned.');
    return newStage;
  },

  // Update a project stage
  async updateProjectStage(stageId: string, updates: Partial<ProjectStagePayload>): Promise<Database['public']['Tables']['project_stages']['Row']> {
    const { data: updatedStage, error } = await supabase
      .from(TABLE_PROJECT_STAGES)
      .update(updates)
      .eq('id', stageId)
      .select()
      .single();
    handleSupabaseError(error, `Error updating stage with ID ${stageId}`);
    if (!updatedStage) throw new Error('Failed to update stage, no data returned.');
    return updatedStage;
  },

  // Delete a project stage
  async deleteProjectStage(stageId: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE_PROJECT_STAGES)
      .delete()
      .eq('id', stageId);
    handleSupabaseError(error, `Error deleting stage with ID ${stageId}`);
  },

  // Reorder project stages
  async reorderProjectStages(projectId: string, orderedStageIds: string[]): Promise<void> {
    for (let i = 0; i < orderedStageIds.length; i++) {
      const { error } = await supabase
        .from(TABLE_PROJECT_STAGES)
        .update({ order: i + 1 })
        .eq('id', orderedStageIds[i])
        .eq('project_id', projectId);
      handleSupabaseError(error, `Error reordering stage ${orderedStageIds[i]}`);
    }
  },

  // ========== PROJECT TASK OPERATIONS ==========

  // Get all tasks for a stage
  async getTasksByStage(projectStageId: string): Promise<Database['public']['Tables']['project_tasks']['Row'][]> {
    const { data, error } = await supabase
      .from(TABLE_PROJECT_TASKS)
      .select('*')
      .eq('project_stage_id', projectStageId)
      .order('order', { ascending: true });
    handleSupabaseError(error, `Error fetching tasks for stage ${projectStageId}`);
    return data || [];
  },

  // Get a single task by ID
  async getTaskById(taskId: string): Promise<Database['public']['Tables']['project_tasks']['Row'] | null> {
    const { data, error } = await supabase
      .from(TABLE_PROJECT_TASKS)
      .select('*')
      .eq('id', taskId)
      .single();
    handleSupabaseError(error, `Error fetching task with ID ${taskId}`);
    return data;
  },

  // Add a task to a project stage
  async addTaskToProjectStage(projectStageId: string, taskData: Omit<ProjectTaskPayload, 'project_stage_id'>): Promise<Database['public']['Tables']['project_tasks']['Row']> {
    const { data: newTask, error } = await supabase
      .from(TABLE_PROJECT_TASKS)
      .insert({ ...taskData, project_stage_id: projectStageId })
      .select()
      .single();
    handleSupabaseError(error, `Error adding task to stage ${projectStageId}`);
    if (!newTask) throw new Error('Failed to add task, no data returned.');
    return newTask;
  },

  // Update a project task
  async updateProjectTask(taskId: string, updates: Partial<ProjectTaskPayload>): Promise<Database['public']['Tables']['project_tasks']['Row']> {
    const { data: updatedTask, error } = await supabase
      .from(TABLE_PROJECT_TASKS)
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();
    handleSupabaseError(error, `Error updating task with ID ${taskId}`);
    if (!updatedTask) throw new Error('Failed to update task, no data returned.');
    return updatedTask;
  },

  // Delete a project task
  async deleteProjectTask(taskId: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE_PROJECT_TASKS)
      .delete()
      .eq('id', taskId);
    handleSupabaseError(error, `Error deleting task with ID ${taskId}`);
  },

  // Update task order within a stage
  async updateTaskOrderInStage(projectStageId: string, orderedTaskIds: string[]): Promise<void> {
    for (let i = 0; i < orderedTaskIds.length; i++) {
      const { error } = await supabase
        .from(TABLE_PROJECT_TASKS)
        .update({ order: i + 1 })
        .eq('id', orderedTaskIds[i])
        .eq('project_stage_id', projectStageId);
      handleSupabaseError(error, `Error reordering task ${orderedTaskIds[i]}`);
    }
  },

  // Move a task to a different stage
  async moveTaskToStage(taskId: string, newProjectStageId: string, newOrder: number): Promise<Database['public']['Tables']['project_tasks']['Row']> {
    const { data: movedTask, error } = await supabase
      .from(TABLE_PROJECT_TASKS)
      .update({ 
        project_stage_id: newProjectStageId, 
        order: newOrder 
      })
      .eq('id', taskId)
      .select()
      .single();
    handleSupabaseError(error, `Error moving task ${taskId} to stage ${newProjectStageId}`);
    if (!movedTask) throw new Error('Failed to move task, no data returned.');
    return movedTask;
  },

  // ========== PROJECT MEMBER OPERATIONS ==========

  // Get all members for a project
  async getProjectMembers(projectId: string): Promise<Database['public']['Tables']['project_members']['Row'][]> {
    const { data, error } = await supabase
      .from(TABLE_PROJECT_MEMBERS)
      .select('*')
      .eq('project_id', projectId);
    handleSupabaseError(error, `Error fetching members for project ${projectId}`);
    return data || [];
  },

  // Add a member to a project
  async addProjectMember(projectId: string, userId: string, role: ProjectMemberRole): Promise<Database['public']['Tables']['project_members']['Row']> {
    const { data: newMember, error } = await supabase
      .from(TABLE_PROJECT_MEMBERS)
      .insert({ 
        project_id: projectId, 
        user_id: userId, 
        role: role 
      })
      .select()
      .single();
    handleSupabaseError(error, `Error adding member to project ${projectId}`);
    if (!newMember) throw new Error('Failed to add project member, no data returned.');
    return newMember;
  },

  // Update a project member's role
  async updateProjectMemberRole(projectMemberId: string, newRole: ProjectMemberRole): Promise<Database['public']['Tables']['project_members']['Row']> {
    const { data: updatedMember, error } = await supabase
      .from(TABLE_PROJECT_MEMBERS)
      .update({ role: newRole })
      .eq('id', projectMemberId)
      .select()
      .single();
    handleSupabaseError(error, `Error updating project member role ${projectMemberId}`);
    if (!updatedMember) throw new Error('Failed to update project member role, no data returned.');
    return updatedMember;
  },

  // Remove a member from a project
  async removeProjectMember(projectMemberId: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE_PROJECT_MEMBERS)
      .delete()
      .eq('id', projectMemberId);
    handleSupabaseError(error, `Error removing project member ${projectMemberId}`);
  },

  // Enhanced project creation from unified workflows
  async createProjectFromUnifiedWorkflow(
    clientId: string,
    templateId: string,
    projectName: string,
    workflowData?: any
  ): Promise<Database['public']['Tables']['projects']['Row']> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated');

    // Get unified template
    const template = await unifiedWorkflowService.getTemplate(templateId);
    if (!template) throw new Error('Template not found');

    // Create project based on template type
    if (template.template_type === 'standard') {
      // Use existing template-based creation
      return this.createProjectFromTemplate(clientId, templateId, projectName);
    } else if (template.template_type === 'flow_based') {
      // Create project from completed workflow instance
      return this.createProjectFromWorkflowInstance(clientId, templateId, projectName, workflowData);
    } else {
      // Handle hybrid workflows
      return this.createProjectFromHybridWorkflow(clientId, templateId, projectName, workflowData);
    }
  },

  // Create project from workflow instance
  async createProjectFromWorkflowInstance(
    clientId: string,
    templateId: string,
    projectName: string,
    instanceData: any
  ): Promise<Database['public']['Tables']['projects']['Row']> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated');

    // Create the project
    const { data: newProject, error: projectError } = await supabase
      .from(TABLE_PROJECTS)
      .insert({
        name: projectName,
        client_id: clientId,
        unified_template_id: templateId,
        workflow_instance_id: instanceData?.instanceId,
        created_by_user_id: user.id,
        status: 'planning',
        current_phase: 'discovery'
      })
      .select()
      .single();

    handleSupabaseError(projectError, 'Error creating project from workflow instance');
    if (!newProject) throw new Error('Failed to create project from workflow instance');

    // Add the creator as a PROJECT_LEAD
    await this.addProjectMember(newProject.id, user.id, 'PROJECT_LEAD');

    // Extract project structure from workflow data if available
    if (instanceData?.projectStructure) {
      await this.createProjectStructureFromWorkflow(newProject.id, instanceData.projectStructure);
    }

    return newProject;
  },

  // Create project from hybrid workflow
  async createProjectFromHybridWorkflow(
    clientId: string,
    templateId: string,
    projectName: string,
    workflowData: any
  ): Promise<Database['public']['Tables']['projects']['Row']> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated');

    // Get the unified template to understand the structure
    const template = await unifiedWorkflowService.getTemplate(templateId);
    if (!template) throw new Error('Template not found');

    // Create the project
    const { data: newProject, error: projectError } = await supabase
      .from(TABLE_PROJECTS)
      .insert({
        name: projectName,
        client_id: clientId,
        unified_template_id: templateId,
        created_by_user_id: user.id,
        status: 'planning',
        current_phase: 'discovery'
      })
      .select()
      .single();

    handleSupabaseError(projectError, 'Error creating project from hybrid workflow');
    if (!newProject) throw new Error('Failed to create project from hybrid workflow');

    // Add the creator as a PROJECT_LEAD
    await this.addProjectMember(newProject.id, user.id, 'PROJECT_LEAD');

    // Create project structure combining template structure with workflow data
    await this.createHybridProjectStructure(newProject.id, template, workflowData);

    return newProject;
  },

  // Helper method to create project structure from workflow data
  async createProjectStructureFromWorkflow(projectId: string, workflowStructure: any): Promise<void> {
    // Implementation for creating project stages/tasks from workflow data
    // This would extract the structure from completed workflow instances
    if (workflowStructure.stages) {
      for (const stageData of workflowStructure.stages) {
        const stage = await this.addStageToProject(projectId, {
          name: stageData.name,
          description: stageData.description,
          order: stageData.order
        });

        if (stageData.tasks) {
          for (const taskData of stageData.tasks) {
            await this.addTaskToProjectStage(stage.id, {
              name: taskData.name,
              description: taskData.description,
              order: taskData.order,
              priority: taskData.priority || 'medium',
              estimated_duration_hours: taskData.estimatedHours
            });
          }
        }
      }
    }
  },

  // Helper method to create hybrid project structure
  async createHybridProjectStructure(projectId: string, template: any, workflowData: any): Promise<void> {
    // Implementation for creating project structure from both template and workflow data
    // This combines the static template structure with dynamic workflow-derived data
    if (template.unified_workflow_stages) {
      for (const templateStage of template.unified_workflow_stages) {
        const stage = await this.addStageToProject(projectId, {
          name: templateStage.name,
          description: templateStage.description,
          order: templateStage.stage_order
        });

        // Create tasks from template
        if (templateStage.unified_workflow_tasks) {
          for (const templateTask of templateStage.unified_workflow_tasks) {
            await this.addTaskToProjectStage(stage.id, {
              name: templateTask.name,
              description: templateTask.description,
              order: templateTask.task_order,
              priority: 'medium',
              estimated_duration_hours: templateTask.estimated_duration_minutes ? 
                Math.ceil(templateTask.estimated_duration_minutes / 60) : null
            });
          }
        }

        // Add any workflow-derived tasks for this stage
        const workflowTasks = workflowData?.stageData?.[templateStage.id]?.additionalTasks;
        if (workflowTasks) {
          for (const workflowTask of workflowTasks) {
            await this.addTaskToProjectStage(stage.id, {
              name: workflowTask.name,
              description: workflowTask.description,
              order: workflowTask.order,
              priority: workflowTask.priority || 'medium',
              estimated_duration_hours: workflowTask.estimatedHours
            });
          }
        }
      }
    }
  },
}; 