import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

// Types based on Zod schemas in AdminProjectTemplateFormPage.tsx and Supabase schema
// These might need further refinement as actual Supabase types are used.
export type ProjectTemplateTaskPayload = Omit<Database['public']['Tables']['project_template_tasks']['Insert'], 'id' | 'created_at' | 'updated_at' | 'template_stage_id'> & { 
  id?: string; 
  template_stage_id?: string; 
};
export type ProjectTemplateStagePayload = Omit<Database['public']['Tables']['project_template_stages']['Insert'], 'id' | 'created_at' | 'updated_at' | 'template_id'> & { 
  id?: string; 
  template_id?: string; 
  tasks?: ProjectTemplateTaskPayload[]; 
};
export type ProjectTemplatePayload = Omit<Database['public']['Tables']['project_templates']['Insert'], 'id' | 'created_at' | 'updated_at' | 'created_by_user_id'> & { 
  id?: string; 
  created_by_user_id?: string; 
  stages?: ProjectTemplateStagePayload[]; 
};

// Full type for a template with its stages and tasks (for reading)
export type ProjectTemplateWithDetails = Database['public']['Tables']['project_templates']['Row'] & {
  project_template_stages: (Database['public']['Tables']['project_template_stages']['Row'] & {
    project_template_tasks: Database['public']['Tables']['project_template_tasks']['Row'][];
  })[];
};

const TABLE_PROJECT_TEMPLATES = 'project_templates';
const TABLE_PROJECT_TEMPLATE_STAGES = 'project_template_stages';
const TABLE_PROJECT_TEMPLATE_TASKS = 'project_template_tasks';

// Helper to handle Supabase errors
const handleSupabaseError = (error: any, contextMessage: string) => {
  if (error) {
    console.error(contextMessage, error);
    throw new Error(`${contextMessage}: ${error.message}`);
  }
};

export const projectTemplateService = {
  // 1. Get all project templates (basic info)
  async getProjectTemplates(): Promise<Database['public']['Tables']['project_templates']['Row'][]> {
    const { data, error } = await supabase
      .from(TABLE_PROJECT_TEMPLATES)
      .select('*')
      .order('name', { ascending: true });
    handleSupabaseError(error, 'Error fetching project templates');
    return data || [];
  },

  // 2. Get a single project template by ID with all its stages and tasks
  async getProjectTemplateById(templateId: string): Promise<ProjectTemplateWithDetails | null> {
    const { data, error } = await supabase
      .from(TABLE_PROJECT_TEMPLATES)
      .select(`
        *,
        ${TABLE_PROJECT_TEMPLATE_STAGES}!template_id (
          *,
          ${TABLE_PROJECT_TEMPLATE_TASKS}!template_stage_id (
            *
          )
        )
      `)
      .eq('id', templateId)
      .single();
    
    handleSupabaseError(error, `Error fetching project template with ID ${templateId}`);
    
    // Sort stages and tasks by order in JavaScript since nested ordering is complex in PostgREST
    if (data) {
      // Sort stages by order
      if (data.project_template_stages) {
        data.project_template_stages.sort((a: any, b: any) => a.order - b.order);
        
        // Sort tasks within each stage by order
        data.project_template_stages.forEach((stage: any) => {
          if (stage.project_template_tasks) {
            stage.project_template_tasks.sort((a: any, b: any) => a.order - b.order);
          }
        });
      }
    }
    
    return data as unknown as ProjectTemplateWithDetails | null;
  },

  // 3. Delete a project template by ID (cascades should handle stages and tasks)
  async deleteProjectTemplate(templateId: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE_PROJECT_TEMPLATES)
      .delete()
      .eq('id', templateId);
    handleSupabaseError(error, `Error deleting project template with ID ${templateId}`);
  },

  // 4. Create a new project template with its stages and tasks
  async createProjectTemplate(templateData: ProjectTemplatePayload): Promise<ProjectTemplateWithDetails> {
    const { stages, ...templateFields } = templateData;
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated to create project template');

    // 1. Create the main template entry
    const { data: newTemplate, error: templateError } = await supabase
      .from(TABLE_PROJECT_TEMPLATES)
      .insert({ ...templateFields, created_by_user_id: user.id })
      .select()
      .single();
    handleSupabaseError(templateError, 'Error creating project template');
    if (!newTemplate) throw new Error('Failed to create project template, no data returned.');

    // 2. Create stages and their tasks, if any
    const createdStages = [];
    if (stages && stages.length > 0) {
      for (const stagePayload of stages) {
        const { tasks, ...stageFields } = stagePayload;
        const { data: newStage, error: stageError } = await supabase
          .from(TABLE_PROJECT_TEMPLATE_STAGES)
          .insert({ ...stageFields, template_id: newTemplate.id })
          .select()
          .single();
        handleSupabaseError(stageError, `Error creating stage '${stageFields.name}'`);
        if (!newStage) throw new Error(`Failed to create stage '${stageFields.name}', no data returned.`);

        const createdTasks = [];
        if (tasks && tasks.length > 0) {
          for (const taskPayload of tasks) {
            const { data: newTask, error: taskError } = await supabase
              .from(TABLE_PROJECT_TEMPLATE_TASKS)
              .insert({ ...taskPayload, template_stage_id: newStage.id })
              .select()
              .single();
            handleSupabaseError(taskError, `Error creating task '${taskPayload.name}' for stage '${newStage.name}'`);
            if (!newTask) throw new Error(`Failed to create task '${taskPayload.name}', no data returned.`);
            createdTasks.push(newTask);
          }
        }
        createdStages.push({ ...newStage, [TABLE_PROJECT_TEMPLATE_TASKS]: createdTasks });
      }
    }
    return { ...newTemplate, [TABLE_PROJECT_TEMPLATE_STAGES]: createdStages } as unknown as ProjectTemplateWithDetails;
  },

  // 5. Update an existing project template, its stages, and tasks
  // This is complex: involves updating template, and for stages/tasks:
  // - updating existing ones
  // - deleting ones not in the payload
  // - creating new ones
  async updateProjectTemplate(templateId: string, templateData: ProjectTemplatePayload): Promise<ProjectTemplateWithDetails> {
    const { stages: payloadStages, ...templateFields } = templateData;

    // 1. Update the main template entry
    const { data: updatedTemplate, error: templateError } = await supabase
      .from(TABLE_PROJECT_TEMPLATES)
      .update(templateFields)
      .eq('id', templateId)
      .select()
      .single();
    handleSupabaseError(templateError, `Error updating project template with ID ${templateId}`);
    if (!updatedTemplate) throw new Error('Failed to update project template, no data returned.');

    // --- Stage and Task Management --- 
    // Get current stages and tasks for comparison
    const { data: currentFullTemplate, error: fetchError } = await supabase
      .from(TABLE_PROJECT_TEMPLATES)
      .select(`id, ${TABLE_PROJECT_TEMPLATE_STAGES} (id, ${TABLE_PROJECT_TEMPLATE_TASKS} (id))`) 
      .eq('id', templateId)
      .single();
    handleSupabaseError(fetchError, 'Error fetching current stages/tasks for update.');

    const currentStages = currentFullTemplate?.project_template_stages || [];
    const finalStagesData = [];

    // Iterate over payload stages
    if (payloadStages) {
      for (const stagePayload of payloadStages) {
        const { tasks: payloadTasks, ...stageFields } = stagePayload;
        let stageResponse;

        if (stagePayload.id) { // Existing stage - Update it
          const { data, error } = await supabase
            .from(TABLE_PROJECT_TEMPLATE_STAGES)
            .update(stageFields)
            .eq('id', stagePayload.id)
            .eq('template_id', templateId) // Ensure it belongs to this template
            .select()
            .single();
          handleSupabaseError(error, `Error updating stage ID ${stagePayload.id}`);
          stageResponse = data;
        } else { // New stage - Create it
          const { data, error } = await supabase
            .from(TABLE_PROJECT_TEMPLATE_STAGES)
            .insert({ ...stageFields, template_id: templateId })
            .select()
            .single();
          handleSupabaseError(error, `Error creating new stage '${stageFields.name}'`);
          stageResponse = data;
        }
        if (!stageResponse) throw new Error(`Failed to process stage '${stageFields.name}'`);

        // --- Task Management for this stage ---
        const currentStageTasks = currentStages.find(cs => cs.id === stageResponse!.id)?.project_template_tasks || [];
        const finalTasksData = [];
        if (payloadTasks) {
          for (const taskPayload of payloadTasks) {
            let taskResponse;
            if (taskPayload.id) { // Existing task - Update
              const {data, error} = await supabase.from(TABLE_PROJECT_TEMPLATE_TASKS).update(taskPayload).eq('id', taskPayload.id).eq('template_stage_id', stageResponse.id).select().single();
              handleSupabaseError(error, `Error updating task ID ${taskPayload.id}`);
              taskResponse = data;
            } else { // New task - Create
              const {data, error} = await supabase.from(TABLE_PROJECT_TEMPLATE_TASKS).insert({...taskPayload, template_stage_id: stageResponse.id}).select().single();
              handleSupabaseError(error, `Error creating new task '${taskPayload.name}'`);
              taskResponse = data;
            }
            if(taskResponse) finalTasksData.push(taskResponse);
          }
        }
        // Delete tasks that were present in DB but not in payload for this stage
        const payloadTaskIds = payloadTasks?.map(pt => pt.id).filter(id => id) || [];
        const tasksToDelete = currentStageTasks.filter(ct => !payloadTaskIds.includes(ct.id));
        if (tasksToDelete.length > 0) {
          const { error: deleteTaskError } = await supabase.from(TABLE_PROJECT_TEMPLATE_TASKS).delete().in('id', tasksToDelete.map(t => t.id));
          handleSupabaseError(deleteTaskError, 'Error deleting old tasks');
        }
        finalStagesData.push({ ...stageResponse, [TABLE_PROJECT_TEMPLATE_TASKS]: finalTasksData });
      }
    }
    
    // Delete stages that were present in DB but not in payload
    const payloadStageIds = payloadStages?.map(ps => ps.id).filter(id => id) || [];
    const stagesToDelete = currentStages.filter(cs => !payloadStageIds.includes(cs.id));
    if (stagesToDelete.length > 0) {
      const { error: deleteStageError } = await supabase.from(TABLE_PROJECT_TEMPLATE_STAGES).delete().in('id', stagesToDelete.map(s => s.id));
      // This will also cascade delete tasks associated with these stages due to FK constraint ON DELETE CASCADE
      handleSupabaseError(deleteStageError, 'Error deleting old stages');
    }
    
    return { ...updatedTemplate, [TABLE_PROJECT_TEMPLATE_STAGES]: finalStagesData } as unknown as ProjectTemplateWithDetails;
  },
}; 