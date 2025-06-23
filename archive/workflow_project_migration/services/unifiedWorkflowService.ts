// Unified Workflow Service - Core Implementation
// Handles all workflow CRUD operations, execution tracking, and project integration

import { supabase } from '@/lib/supabase';
import type { 
  UnifiedWorkflowTemplate,
  UnifiedWorkflowStage,
  UnifiedWorkflowTask,
  UnifiedWorkflowStep,
  UnifiedWorkflowElement,
  UnifiedWorkflowInstance,
  UnifiedWorkflowStepData,
  CreateWorkflowTemplateRequest,
  UpdateWorkflowTemplateRequest,
  CreateStageRequest,
  CreateTaskRequest,
  CreateStepRequest,
  CreateElementRequest,
  TemplateFilters,
  WorkflowExecutionContext,
  ProgressUpdate,
  StepDataSubmission,
  TemplateAnalytics,
  InstanceAnalytics,
  UsageMetrics,
  WorkflowInstanceWithProgress,
  ValidationResult,
  PermissionCheck,
  ElementType
} from '@/types/unified-workflow';

export class UnifiedWorkflowService {
  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  async createTemplate(data: CreateWorkflowTemplateRequest): Promise<UnifiedWorkflowTemplate> {
    try {
      // Validate input data
      const validatedData = await this.validateTemplateData(data);
      
      // Create template with transaction
      const { data: template, error } = await supabase
        .from('unified_workflow_templates')
        .insert({
          name: validatedData.name,
          description: validatedData.description,
          template_type: validatedData.template_type,
          icon: validatedData.icon,
          color: validatedData.color,
          category: validatedData.category,
          tags: validatedData.tags,
          requires_products_services: validatedData.requires_products_services ?? false,
          auto_create_project: validatedData.auto_create_project ?? true,
          estimated_duration_minutes: validatedData.estimated_duration_minutes,
          client_visible: validatedData.client_visible ?? true,
          client_description: validatedData.client_description,
          is_active: true,
          is_published: false,
          version: 1,
          created_by: validatedData.created_by,
          updated_by: validatedData.created_by
        })
        .select()
        .single();

      if (error) throw error;

      // Create default structure if needed
      if (validatedData.template_type === 'flow_based' && validatedData.create_default_structure) {
        await this.createDefaultFlowStructure(template.id, validatedData.created_by);
      }

      // Log creation
      await this.logTemplateActivity(template.id, 'created', validatedData.created_by);

      return template;
    } catch (error: any) {
      console.error('Error creating template:', error);
      throw new Error(`Failed to create template: ${error.message}`);
    }
  }

  async updateTemplate(id: string, data: UpdateWorkflowTemplateRequest): Promise<UnifiedWorkflowTemplate> {
    try {
      // Check permissions
      await this.checkTemplatePermissions(id, data.updated_by, 'update');
      
      // Validate update data
      const validatedData = await this.validateTemplateUpdateData(data);
      
      // Update template
      const { data: template, error } = await supabase
        .from('unified_workflow_templates')
        .update({
          ...validatedData,
          updated_at: new Date().toISOString(),
          updated_by: data.updated_by
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log update
      await this.logTemplateActivity(id, 'updated', data.updated_by);

      return template;
    } catch (error: any) {
      console.error('Error updating template:', error);
      throw new Error(`Failed to update template: ${error.message}`);
    }
  }

  async deleteTemplate(id: string, deletedBy: string): Promise<void> {
    try {
      // Check permissions
      await this.checkTemplatePermissions(id, deletedBy, 'delete');
      
      // Check if template has active instances
      const { data: instances, error: instanceError } = await supabase
        .from('unified_workflow_instances')
        .select('id')
        .eq('template_id', id)
        .eq('status', 'active');

      if (instanceError) throw instanceError;

      if (instances && instances.length > 0) {
        throw new Error('Cannot delete template with active instances');
      }

      // Soft delete by marking as inactive
      const { error } = await supabase
        .from('unified_workflow_templates')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
          updated_by: deletedBy
        })
        .eq('id', id);

      if (error) throw error;

      // Log deletion
      await this.logTemplateActivity(id, 'deleted', deletedBy);
    } catch (error: any) {
      console.error('Error deleting template:', error);
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  }

  async getTemplate(id: string): Promise<UnifiedWorkflowTemplate | null> {
    try {
      // Step 1: Load basic template information first (fast query)
      const { data: template, error: templateError } = await supabase
        .from('unified_workflow_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (templateError && templateError.code !== 'PGRST116') throw templateError;
      if (!template) return null;

      // Step 2: Load stages for this template (fast query)
      const { data: stages, error: stagesError } = await supabase
        .from('unified_workflow_stages')
        .select('*')
        .eq('template_id', id)
        .order('stage_order');

      if (stagesError) throw stagesError;

      // Step 3: Load tasks for all stages (single query with IN clause)
      const stageIds = stages?.map(s => s.id) || [];
      let tasks: any[] = [];
      if (stageIds.length > 0) {
        const { data: tasksData, error: tasksError } = await supabase
          .from('unified_workflow_tasks')
          .select('*')
          .in('stage_id', stageIds)
          .order('task_order');

        if (tasksError) throw tasksError;
        tasks = tasksData || [];
      }

      // Step 4: Load steps for all tasks (single query with IN clause)
      const taskIds = tasks.map(t => t.id);
      let steps: any[] = [];
      if (taskIds.length > 0) {
        const { data: stepsData, error: stepsError } = await supabase
          .from('unified_workflow_steps')
          .select('*')
          .in('task_id', taskIds)
          .order('step_order');

        if (stepsError) throw stepsError;
        steps = stepsData || [];
      }

      // Step 5: Load elements for all steps with timeout protection
      const stepIds = steps.map(s => s.id);
      let elements: any[] = [];
      
      if (stepIds.length > 0) {
        try {
          // If we have many steps, batch the element queries to prevent timeouts
          if (stepIds.length > 20) {
            console.log(`[UnifiedWorkflowService] Loading elements in batches for ${stepIds.length} steps`);
            
            // Process in batches of 10 steps at a time
            const batchSize = 10;
            for (let i = 0; i < stepIds.length; i += batchSize) {
              const batchStepIds = stepIds.slice(i, i + batchSize);
              
              const { data: batchElements, error: batchError } = await supabase
                .from('unified_workflow_elements')
                .select('*')
                .in('step_id', batchStepIds)
                .order('element_order');

              if (batchError) {
                console.warn(`[UnifiedWorkflowService] Error loading elements batch ${i}-${i + batchSize}:`, batchError);
                // Continue with other batches even if one fails
                continue;
              }
              
              if (batchElements) {
                elements.push(...batchElements);
              }
            }
          } else {
            // Load all elements at once for smaller datasets
            const { data: elementsData, error: elementsError } = await supabase
              .from('unified_workflow_elements')
              .select('*')
              .in('step_id', stepIds)
              .order('element_order');

            if (elementsError) {
              // Log the error but don't fail the entire template load
              console.warn(`[UnifiedWorkflowService] Error loading elements for template ${id}:`, elementsError);
              console.warn('Continuing without elements data...');
              elements = [];
            } else {
              elements = elementsData || [];
            }
          }
        } catch (elementError: any) {
          // If elements loading fails completely, log and continue without elements
          console.warn(`[UnifiedWorkflowService] Failed to load elements for template ${id}:`, elementError);
          console.warn('Template will be loaded without element data');
          elements = [];
        }
      }

      // Step 6: Reconstruct the nested structure
      // Add elements to steps
      const stepsWithElements = steps.map(step => ({
        ...step,
        unified_workflow_elements: elements.filter(e => e.step_id === step.id)
      }));

      // Add steps to tasks
      const tasksWithSteps = tasks.map(task => ({
        ...task,
        unified_workflow_steps: stepsWithElements.filter(s => s.task_id === task.id)
      }));

      // Add tasks to stages
      const stagesWithTasks = (stages || []).map(stage => ({
        ...stage,
        unified_workflow_tasks: tasksWithSteps.filter(t => t.stage_id === stage.id)
      }));

      // Add stages to template
      const templateWithHierarchy: UnifiedWorkflowTemplate = {
        ...template,
        unified_workflow_stages: stagesWithTasks
      };

      console.log(`[UnifiedWorkflowService] Template loaded successfully: ${template.name}`, {
        stages: stagesWithTasks.length,
        tasks: tasksWithSteps.length,
        steps: stepsWithElements.length,
        elements: elements.length
      });

      return templateWithHierarchy;
    } catch (error: any) {
      console.error('Error fetching template:', error);
      
      // Provide more specific error messages
      if (error.code === '57014') {
        throw new Error(`Database timeout while loading template. The template may have too much data. Please try again or contact support.`);
      } else if (error.code === 'PGRST116') {
        throw new Error(`Template with ID ${id} not found.`);
      } else {
        throw new Error(`Failed to fetch template: ${error.message}`);
      }
    }
  }

  async getTemplates(filters?: TemplateFilters): Promise<UnifiedWorkflowTemplate[]> {
    try {
      let query = supabase
        .from('unified_workflow_templates')
        .select(`
          *,
          unified_workflow_stages (count)
        `);

      // Apply filters
      if (filters?.template_type) {
        if (Array.isArray(filters.template_type)) {
          query = query.in('template_type', filters.template_type);
        } else {
          query = query.eq('template_type', filters.template_type);
        }
      }
      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }
      if (filters?.is_published !== undefined) {
        query = query.eq('is_published', filters.is_published);
      }
      if (filters?.created_by) {
        query = query.eq('created_by', filters.created_by);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.tags && filters.tags.length > 0) {
        query = query.overlaps('tags', filters.tags);
      }

      // Apply sorting
      query = query.order('updated_at', { ascending: false });

      const { data: templates, error } = await query;

      if (error) throw error;

      return templates || [];
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }
  }

  // ============================================================================
  // HIERARCHY MANAGEMENT
  // ============================================================================

  async createStage(templateId: string, data: CreateStageRequest): Promise<UnifiedWorkflowStage> {
    try {
      // Validate template exists and permissions
      const template = await this.getTemplate(templateId);
      if (!template) throw new Error('Template not found');
      
      await this.checkTemplatePermissions(templateId, data.created_by, 'update');
      
      // Get next stage order
      const nextOrder = await this.getNextStageOrder(templateId);
      
      const { data: stage, error } = await supabase
        .from('unified_workflow_stages')
        .insert({
          template_id: templateId,
          name: data.name,
          description: data.description,
          stage_order: data.stage_order || nextOrder,
          is_required: data.is_required ?? true,
          allow_skip: data.allow_skip ?? false,
          auto_advance: data.auto_advance ?? false,
          client_visible: data.client_visible ?? true,
          client_description: data.client_description,
          condition_logic: data.condition_logic || {},
          icon: data.icon,
          color: data.color,
          created_by: data.created_by,
          updated_by: data.created_by
        })
        .select()
        .single();

      if (error) throw error;

      // Update template timestamp
      await this.touchTemplate(templateId, data.created_by);

      return stage;
    } catch (error: any) {
      console.error('Error creating stage:', error);
      throw new Error(`Failed to create stage: ${error.message}`);
    }
  }

  async updateStage(id: string, data: Partial<UnifiedWorkflowStage>, updatedBy: string): Promise<UnifiedWorkflowStage> {
    try {
      // Validate stage exists and permissions
      const existingStage = await this.getStage(id);
      if (!existingStage) throw new Error('Stage not found');
      
      await this.checkTemplatePermissions(existingStage.template_id, updatedBy, 'update');
      
      // Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString(),
        updated_by: updatedBy
      };

      // Only update provided fields
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.stage_order !== undefined) updateData.stage_order = data.stage_order;
      if (data.is_required !== undefined) updateData.is_required = data.is_required;
      if (data.allow_skip !== undefined) updateData.allow_skip = data.allow_skip;
      if (data.auto_advance !== undefined) updateData.auto_advance = data.auto_advance;
      if (data.client_visible !== undefined) updateData.client_visible = data.client_visible;
      if (data.client_description !== undefined) updateData.client_description = data.client_description;
      if (data.condition_logic !== undefined) updateData.condition_logic = data.condition_logic;
      if (data.icon !== undefined) updateData.icon = data.icon;
      if (data.color !== undefined) updateData.color = data.color;

      const { data: stage, error } = await supabase
        .from('unified_workflow_stages')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update template timestamp
      await this.touchTemplate(existingStage.template_id, updatedBy);

      return stage;
    } catch (error: any) {
      console.error('Error updating stage:', error);
      throw new Error(`Failed to update stage: ${error.message}`);
    }
  }

  async deleteStage(id: string, deletedBy: string): Promise<void> {
    try {
      // Get stage and validate it exists
      const stage = await this.getStage(id);
      if (!stage) throw new Error('Stage not found');

      // Check permissions via template
      await this.checkTemplatePermissions(stage.template_id, deletedBy, 'delete');

      // Check if stage has active workflow instances
      const { data: instances, error: instanceError } = await supabase
        .from('unified_workflow_instances')
        .select('id')
        .eq('template_id', stage.template_id)
        .eq('status', 'active');

      if (instanceError) throw instanceError;

      if (instances && instances.length > 0) {
        throw new Error('Cannot delete stage from template with active instances');
      }

      // Hard delete - database CASCADE will handle child records (tasks, steps, elements)
      const { error } = await supabase
        .from('unified_workflow_stages')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update template timestamp
      await this.touchTemplate(stage.template_id, deletedBy);

      // Log deletion
      await this.logTemplateActivity(stage.template_id, `stage_deleted:${stage.name}`, deletedBy);
    } catch (error: any) {
      console.error('Error deleting stage:', error);
      throw new Error(`Failed to delete stage: ${error.message}`);
    }
  }

  async createTask(stageId: string, data: CreateTaskRequest): Promise<UnifiedWorkflowTask> {
    try {
      // Validate stage exists and permissions
      const stage = await this.getStage(stageId);
      if (!stage) throw new Error('Stage not found');
      
      await this.checkTemplatePermissions(stage.template_id, data.created_by, 'update');
      
      // Get next task order
      const nextOrder = await this.getNextTaskOrder(stageId);
      
      const { data: task, error } = await supabase
        .from('unified_workflow_tasks')
        .insert({
          stage_id: stageId,
          name: data.name,
          description: data.description,
          task_order: data.task_order || nextOrder,
          task_type: data.task_type || 'standard',
          is_required: data.is_required ?? true,
          allow_skip: data.allow_skip ?? false,
          auto_advance: data.auto_advance ?? false,
          assigned_to: data.assigned_to,
          estimated_duration_minutes: data.estimated_duration_minutes,
          due_date_offset_days: data.due_date_offset_days,
          client_visible: data.client_visible ?? false,
          client_description: data.client_description,
          condition_logic: data.condition_logic || {},
          depends_on_task_ids: data.depends_on_task_ids || [],
          created_by: data.created_by,
          updated_by: data.created_by
        })
        .select()
        .single();

      if (error) throw error;

      // Update template timestamp
      await this.touchTemplate(stage.template_id, data.created_by);

      return task;
    } catch (error: any) {
      console.error('Error creating task:', error);
      throw new Error(`Failed to create task: ${error.message}`);
    }
  }

  async updateTask(id: string, data: Partial<UnifiedWorkflowTask>, updatedBy: string): Promise<UnifiedWorkflowTask> {
    try {
      // Validate task exists and permissions
      const existingTask = await this.getTask(id);
      if (!existingTask) throw new Error('Task not found');
      
      const stage = await this.getStage(existingTask.stage_id);
      if (!stage) throw new Error('Stage not found');
      
      await this.checkTemplatePermissions(stage.template_id, updatedBy, 'update');
      
      // Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString(),
        updated_by: updatedBy
      };

      // Only update provided fields
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.task_order !== undefined) updateData.task_order = data.task_order;
      if (data.task_type !== undefined) updateData.task_type = data.task_type;
      if (data.assigned_to !== undefined) updateData.assigned_to = data.assigned_to;
      if (data.is_required !== undefined) updateData.is_required = data.is_required;
      if (data.allow_skip !== undefined) updateData.allow_skip = data.allow_skip;
      if (data.auto_advance !== undefined) updateData.auto_advance = data.auto_advance;
      if (data.estimated_duration_minutes !== undefined) updateData.estimated_duration_minutes = data.estimated_duration_minutes;
      if (data.due_date_offset_days !== undefined) updateData.due_date_offset_days = data.due_date_offset_days;
      if (data.client_visible !== undefined) updateData.client_visible = data.client_visible;
      if (data.client_description !== undefined) updateData.client_description = data.client_description;
      if (data.condition_logic !== undefined) updateData.condition_logic = data.condition_logic;
      if (data.depends_on_task_ids !== undefined) updateData.depends_on_task_ids = data.depends_on_task_ids;

      const { data: task, error } = await supabase
        .from('unified_workflow_tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update template timestamp
      await this.touchTemplate(stage.template_id, updatedBy);

      return task;
    } catch (error: any) {
      console.error('Error updating task:', error);
      throw new Error(`Failed to update task: ${error.message}`);
    }
  }

  async deleteTask(id: string, deletedBy: string): Promise<void> {
    try {
      // Get task and validate it exists
      const task = await this.getTask(id);
      if (!task) throw new Error('Task not found');

      // Get stage to access template for permissions
      const stage = await this.getStage(task.stage_id);
      if (!stage) throw new Error('Stage not found');

      // Check permissions via template
      await this.checkTemplatePermissions(stage.template_id, deletedBy, 'delete');

      // Check if task's template has active workflow instances
      const { data: instances, error: instanceError } = await supabase
        .from('unified_workflow_instances')
        .select('id')
        .eq('template_id', stage.template_id)
        .eq('status', 'active');

      if (instanceError) throw instanceError;

      if (instances && instances.length > 0) {
        throw new Error('Cannot delete task from template with active instances');
      }

      // Hard delete - database CASCADE will handle child records (steps, elements)
      const { error } = await supabase
        .from('unified_workflow_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update template timestamp
      await this.touchTemplate(stage.template_id, deletedBy);

      // Log deletion
      await this.logTemplateActivity(stage.template_id, `task_deleted:${task.name}`, deletedBy);
    } catch (error: any) {
      console.error('Error deleting task:', error);
      throw new Error(`Failed to delete task: ${error.message}`);
    }
  }

  async createStep(taskId: string, data: CreateStepRequest): Promise<UnifiedWorkflowStep> {
    try {
      // Validate task exists and permissions
      const task = await this.getTask(taskId);
      if (!task) throw new Error('Task not found');
      
      const stage = await this.getStage(task.stage_id);
      if (!stage) throw new Error('Stage not found');
      
      await this.checkTemplatePermissions(stage.template_id, data.created_by, 'update');
      
      // Get next step order
      const nextOrder = await this.getNextStepOrder(taskId);
      
      const { data: step, error } = await supabase
        .from('unified_workflow_steps')
        .insert({
          task_id: taskId,
          name: data.name,
          description: data.description,
          step_order: data.step_order || nextOrder,
          step_type: data.step_type || 'form',
          is_required: data.is_required ?? true,
          allow_skip: data.allow_skip ?? false,
          auto_advance: data.auto_advance ?? false,
          show_progress: data.show_progress ?? true,
          allow_back_navigation: data.allow_back_navigation ?? true,
          save_progress: data.save_progress ?? true,
          client_visible: data.client_visible ?? true,
          client_description: data.client_description,
          condition_logic: data.condition_logic || {},
          validation_rules: data.validation_rules || {},
          created_by: data.created_by,
          updated_by: data.created_by
        })
        .select()
        .single();

      if (error) throw error;

      // Update template timestamp
      await this.touchTemplate(stage.template_id, data.created_by);

      return step;
    } catch (error: any) {
      console.error('Error creating step:', error);
      throw new Error(`Failed to create step: ${error.message}`);
    }
  }

  async updateStep(id: string, data: Partial<UnifiedWorkflowStep>, updatedBy: string): Promise<UnifiedWorkflowStep> {
    try {
      // Validate step exists and permissions
      const existingStep = await this.getStep(id);
      if (!existingStep) throw new Error('Step not found');
      
      const task = await this.getTask(existingStep.task_id);
      if (!task) throw new Error('Task not found');
      
      const stage = await this.getStage(task.stage_id);
      if (!stage) throw new Error('Stage not found');
      
      await this.checkTemplatePermissions(stage.template_id, updatedBy, 'update');
      
      // Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString(),
        updated_by: updatedBy
      };

      // Only update provided fields
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.step_order !== undefined) updateData.step_order = data.step_order;
      if (data.step_type !== undefined) updateData.step_type = data.step_type;
      if (data.is_required !== undefined) updateData.is_required = data.is_required;
      if (data.allow_skip !== undefined) updateData.allow_skip = data.allow_skip;
      if (data.auto_advance !== undefined) updateData.auto_advance = data.auto_advance;
      if (data.show_progress !== undefined) updateData.show_progress = data.show_progress;
      if (data.allow_back_navigation !== undefined) updateData.allow_back_navigation = data.allow_back_navigation;
      if (data.save_progress !== undefined) updateData.save_progress = data.save_progress;
      if (data.client_visible !== undefined) updateData.client_visible = data.client_visible;
      if (data.client_description !== undefined) updateData.client_description = data.client_description;
      if (data.condition_logic !== undefined) updateData.condition_logic = data.condition_logic;
      if (data.validation_rules !== undefined) updateData.validation_rules = data.validation_rules;

      const { data: step, error } = await supabase
        .from('unified_workflow_steps')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update template timestamp
      await this.touchTemplate(stage.template_id, updatedBy);

      return step;
    } catch (error: any) {
      console.error('Error updating step:', error);
      throw new Error(`Failed to update step: ${error.message}`);
    }
  }

  async deleteStep(id: string, deletedBy: string): Promise<void> {
    try {
      // Get step and validate it exists
      const step = await this.getStep(id);
      if (!step) throw new Error('Step not found');

      // Get task and stage to access template for permissions
      const task = await this.getTask(step.task_id);
      if (!task) throw new Error('Task not found');

      const stage = await this.getStage(task.stage_id);
      if (!stage) throw new Error('Stage not found');

      // Check permissions via template
      await this.checkTemplatePermissions(stage.template_id, deletedBy, 'delete');

      // Check if step's template has active workflow instances
      const { data: instances, error: instanceError } = await supabase
        .from('unified_workflow_instances')
        .select('id')
        .eq('template_id', stage.template_id)
        .eq('status', 'active');

      if (instanceError) throw instanceError;

      if (instances && instances.length > 0) {
        throw new Error('Cannot delete step from template with active instances');
      }

      // Hard delete - database CASCADE will handle child records (elements)
      const { error } = await supabase
        .from('unified_workflow_steps')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update template timestamp
      await this.touchTemplate(stage.template_id, deletedBy);

      // Log deletion
      await this.logTemplateActivity(stage.template_id, `step_deleted:${step.name}`, deletedBy);
    } catch (error: any) {
      console.error('Error deleting step:', error);
      throw new Error(`Failed to delete step: ${error.message}`);
    }
  }

  async createElement(stepId: string, data: CreateElementRequest): Promise<UnifiedWorkflowElement> {
    try {
      // Get step with related task, stage, and template data in a single query
      const { data: stepData, error: stepError } = await supabase
        .from('unified_workflow_steps')
        .select(`
          *,
          unified_workflow_tasks!inner (
            *,
            unified_workflow_stages!inner (
              *,
              template_id
            )
          )
        `)
        .eq('id', stepId)
        .single();

      if (stepError || !stepData) throw new Error('Step not found');
      
      const task = stepData.unified_workflow_tasks;
      const stage = task.unified_workflow_stages;
      const templateId = stage.template_id;
      
      // Check permissions
      await this.checkTemplatePermissions(templateId, data.created_by, 'update');
      
      // Validate element type
      if (!this.isValidElementType(data.element_type)) {
        throw new Error(`Invalid element type: ${data.element_type}`);
      }
      
      // Use timestamp-based ordering to avoid database timeouts
      const timestampOrder = Math.floor(Date.now() % 100000);
      
      const { data: element, error } = await supabase
        .from('unified_workflow_elements')
        .insert({
          step_id: stepId,
          element_type: data.element_type,
          element_key: data.element_key,
          element_order: data.element_order || timestampOrder,
          label: data.label,
          placeholder: data.placeholder,
          help_text: data.help_text,
          config: data.config || {},
          is_required: data.is_required ?? false,
          validation_rules: data.validation_rules || {},
          condition_logic: data.condition_logic || {},
          client_visible: data.client_visible ?? true,
          created_by: data.created_by,
          updated_by: data.created_by
        })
        .select()
        .single();

      if (error) throw error;

      // Update template timestamp (non-blocking)
      this.touchTemplate(templateId, data.created_by).catch(err => 
        console.warn('Failed to update template timestamp:', err)
      );

      return element;
    } catch (error: any) {
      console.error('Error creating element:', error);
      throw new Error(`Failed to create element: ${error.message}`);
    }
  }

  async updateElement(id: string, data: Partial<UnifiedWorkflowElement>, updatedBy: string): Promise<UnifiedWorkflowElement> {
    try {
      // Get element with related step, task, stage, and template data in a single query
      const { data: elementData, error: elementError } = await supabase
        .from('unified_workflow_elements')
        .select(`
          *,
          unified_workflow_steps!inner (
            *,
            unified_workflow_tasks!inner (
              *,
              unified_workflow_stages!inner (
                *,
                template_id
              )
            )
          )
        `)
        .eq('id', id)
        .single();

      if (elementError || !elementData) throw new Error('Element not found');
      
      const step = elementData.unified_workflow_steps;
      const task = step.unified_workflow_tasks;
      const stage = task.unified_workflow_stages;
      const templateId = stage.template_id;
      
      // Check permissions
      await this.checkTemplatePermissions(templateId, updatedBy, 'update');
      
      // Validate element type if being updated
      if (data.element_type && !this.isValidElementType(data.element_type)) {
        throw new Error(`Invalid element type: ${data.element_type}`);
      }
      
      // Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString(),
        updated_by: updatedBy
      };

      // Only update provided fields
      if (data.element_type !== undefined) updateData.element_type = data.element_type;
      if (data.element_key !== undefined) updateData.element_key = data.element_key;
      if (data.element_order !== undefined) updateData.element_order = data.element_order;
      if (data.label !== undefined) updateData.label = data.label;
      if (data.placeholder !== undefined) updateData.placeholder = data.placeholder;
      if (data.help_text !== undefined) updateData.help_text = data.help_text;
      if (data.config !== undefined) updateData.config = data.config;
      if (data.is_required !== undefined) updateData.is_required = data.is_required;
      if (data.validation_rules !== undefined) updateData.validation_rules = data.validation_rules;
      if (data.condition_logic !== undefined) updateData.condition_logic = data.condition_logic;
      if (data.client_visible !== undefined) updateData.client_visible = data.client_visible;

      const { data: element, error } = await supabase
        .from('unified_workflow_elements')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update template timestamp
      await this.touchTemplate(templateId, updatedBy);

      return element;
    } catch (error: any) {
      console.error('Error updating element:', error);
      throw new Error(`Failed to update element: ${error.message}`);
    }
  }

  async deleteElement(id: string, deletedBy: string): Promise<void> {
    try {
      // Get element with related step, task, stage, and template data in a single query
      const { data: elementData, error: elementError } = await supabase
        .from('unified_workflow_elements')
        .select(`
          *,
          unified_workflow_steps!inner (
            *,
            unified_workflow_tasks!inner (
              *,
              unified_workflow_stages!inner (
                *,
                template_id
              )
            )
          )
        `)
        .eq('id', id)
        .single();

      if (elementError || !elementData) throw new Error('Element not found');
      
      const step = elementData.unified_workflow_steps;
      const task = step.unified_workflow_tasks;
      const stage = task.unified_workflow_stages;
      const templateId = stage.template_id;
      
      // Check permissions
      await this.checkTemplatePermissions(templateId, deletedBy, 'delete');

      // Check if element's template has active workflow instances
      const { data: instances, error: instanceError } = await supabase
        .from('unified_workflow_instances')
        .select('id')
        .eq('template_id', templateId)
        .eq('status', 'active');

      if (instanceError) throw instanceError;

      if (instances && instances.length > 0) {
        throw new Error('Cannot delete element from template with active instances');
      }

      // Hard delete - no child records to CASCADE
      const { error } = await supabase
        .from('unified_workflow_elements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update template timestamp
      await this.touchTemplate(templateId, deletedBy);

      // Log deletion
      await this.logTemplateActivity(templateId, `element_deleted:${elementData.label || elementData.element_key}`, deletedBy);
    } catch (error: any) {
      console.error('Error deleting element:', error);
      throw new Error(`Failed to delete element: ${error.message}`);
    }
  }

  // ============================================================================
  // INSTANCE MANAGEMENT
  // ============================================================================

  async createInstance(templateId: string, context: WorkflowExecutionContext): Promise<UnifiedWorkflowInstance> {
    try {
      // Validate template exists and is published
      const template = await this.getTemplate(templateId);
      if (!template) throw new Error('Template not found');
      if (!template.is_published) throw new Error('Template is not published');

      const { data: instance, error } = await supabase
        .from('unified_workflow_instances')
        .insert({
          template_id: templateId,
          name: context.name,
          description: context.description,
          project_id: context.project_id,
          client_id: context.client_id,
          status: 'draft',
          completion_percentage: 0,
          assigned_to: context.assigned_to,
          due_date: context.due_date,
          instance_data: context.instance_data || {},
          created_by: context.created_by,
          updated_by: context.created_by
        })
        .select()
        .single();

      if (error) throw error;

      return instance;
    } catch (error: any) {
      console.error('Error creating instance:', error);
      throw new Error(`Failed to create instance: ${error.message}`);
    }
  }

  async updateInstanceProgress(instanceId: string, progress: ProgressUpdate): Promise<UnifiedWorkflowInstance> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
        updated_by: progress.updated_by
      };

      if (progress.current_stage_id !== undefined) updateData.current_stage_id = progress.current_stage_id;
      if (progress.current_task_id !== undefined) updateData.current_task_id = progress.current_task_id;
      if (progress.current_step_id !== undefined) updateData.current_step_id = progress.current_step_id;
      if (progress.completion_percentage !== undefined) updateData.completion_percentage = progress.completion_percentage;
      if (progress.status !== undefined) {
        updateData.status = progress.status;
        if (progress.status === 'active' && !updateData.started_at) {
          updateData.started_at = new Date().toISOString();
        }
        if (progress.status === 'completed') {
          updateData.completed_at = new Date().toISOString();
          updateData.completion_percentage = 100;
        }
      }

      const { data: instance, error } = await supabase
        .from('unified_workflow_instances')
        .update(updateData)
        .eq('id', instanceId)
        .select()
        .single();

      if (error) throw error;

      return instance;
    } catch (error: any) {
      console.error('Error updating instance progress:', error);
      throw new Error(`Failed to update instance progress: ${error.message}`);
    }
  }

  async submitStepData(instanceId: string, stepId: string, data: StepDataSubmission): Promise<void> {
    try {
      // Validate instance and step
      const instance = await this.getInstance(instanceId);
      if (!instance) throw new Error('Instance not found');

      const step = await this.getStep(stepId);
      if (!step) throw new Error('Step not found');

      // Upsert step data
      const { error } = await supabase
        .from('unified_workflow_step_data')
        .upsert({
          instance_id: instanceId,
          step_id: stepId,
          element_key: data.element_key,
          element_value: data.element_value,
          data_type: data.data_type,
          is_valid: true, // Will be validated separately
          submitted_at: new Date().toISOString(),
          submitted_by: data.submitted_by,
          created_by: data.submitted_by,
          updated_by: data.submitted_by
        });

      if (error) throw error;

      // Update instance progress if needed
      await this.calculateAndUpdateProgress(instanceId, data.submitted_by);
    } catch (error: any) {
      console.error('Error submitting step data:', error);
      throw new Error(`Failed to submit step data: ${error.message}`);
    }
  }

  async getInstanceWithProgress(id: string): Promise<WorkflowInstanceWithProgress | null> {
    try {
      const { data: instance, error } = await supabase
        .from('unified_workflow_instances')
        .select(`
          *,
          unified_workflow_templates (*),
          unified_workflow_step_data (*)
        `)
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!instance) return null;

      // Get current stage, task, and step details
      const currentStage = instance.current_stage_id 
        ? await this.getStage(instance.current_stage_id)
        : undefined;
      
      const currentTask = instance.current_task_id
        ? await this.getTask(instance.current_task_id)
        : undefined;
      
      const currentStep = instance.current_step_id
        ? await this.getStep(instance.current_step_id)
        : undefined;

      // Calculate progress details
      const progressDetails = await this.calculateProgressDetails(instance.template_id, id);

      return {
        ...instance,
        template: instance.unified_workflow_templates,
        current_stage: currentStage,
        current_task: currentTask,
        current_step: currentStep,
        step_data: instance.unified_workflow_step_data,
        progress_details: progressDetails
      };
    } catch (error: any) {
      console.error('Error fetching instance with progress:', error);
      throw new Error(`Failed to fetch instance with progress: ${error.message}`);
    }
  }

  // ============================================================================
  // ANALYTICS & REPORTING
  // ============================================================================

  async getTemplateAnalytics(templateId: string): Promise<TemplateAnalytics> {
    try {
      // Get basic instance counts
      const { data: instances, error: instanceError } = await supabase
        .from('unified_workflow_instances')
        .select('id, status, started_at, completed_at')
        .eq('template_id', templateId);

      if (instanceError) throw instanceError;

      const totalInstances = instances?.length || 0;
      const completedInstances = instances?.filter(i => i.status === 'completed').length || 0;
      const completionRate = totalInstances > 0 ? (completedInstances / totalInstances) * 100 : 0;

      // Calculate average completion time
      const completedWithTimes = instances?.filter(i => 
        i.status === 'completed' && i.started_at && i.completed_at
      ) || [];
      
      const averageCompletionTime = completedWithTimes.length > 0
        ? completedWithTimes.reduce((sum, instance) => {
            const start = new Date(instance.started_at).getTime();
            const end = new Date(instance.completed_at).getTime();
            return sum + (end - start);
          }, 0) / completedWithTimes.length / (1000 * 60) // Convert to minutes
        : 0;

      // Get usage by month (last 12 months)
      const usageByMonth = await this.getTemplateUsageByMonth(templateId);

      return {
        template_id: templateId,
        total_instances: totalInstances,
        completed_instances: completedInstances,
        average_completion_time_minutes: Math.round(averageCompletionTime),
        completion_rate: Math.round(completionRate * 100) / 100,
        usage_by_month: usageByMonth
      };
    } catch (error: any) {
      console.error('Error fetching template analytics:', error);
      throw new Error(`Failed to fetch template analytics: ${error.message}`);
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async validateTemplateData(data: CreateWorkflowTemplateRequest): Promise<CreateWorkflowTemplateRequest> {
    // Basic validation
    if (!data.name?.trim()) throw new Error('Template name is required');
    if (!data.template_type) throw new Error('Template type is required');
    if (!data.created_by) throw new Error('Created by user is required');

    // Validate template type
    if (!['standard', 'flow_based', 'hybrid'].includes(data.template_type)) {
      throw new Error('Invalid template type');
    }

    // Validate color format if provided
    if (data.color && !/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
      throw new Error('Invalid color format. Use hex format (#RRGGBB)');
    }

    return data;
  }

  private async validateTemplateUpdateData(data: UpdateWorkflowTemplateRequest): Promise<Partial<UnifiedWorkflowTemplate>> {
    const updateData: any = {};

    if (data.name !== undefined) {
      if (!data.name.trim()) throw new Error('Template name cannot be empty');
      updateData.name = data.name.trim();
    }

    if (data.description !== undefined) updateData.description = data.description;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.color !== undefined) {
      if (data.color && !/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
        throw new Error('Invalid color format. Use hex format (#RRGGBB)');
      }
      updateData.color = data.color;
    }
    if (data.category !== undefined) updateData.category = data.category;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.requires_products_services !== undefined) updateData.requires_products_services = data.requires_products_services;
    if (data.auto_create_project !== undefined) updateData.auto_create_project = data.auto_create_project;
    if (data.estimated_duration_minutes !== undefined) updateData.estimated_duration_minutes = data.estimated_duration_minutes;
    if (data.client_visible !== undefined) updateData.client_visible = data.client_visible;
    if (data.client_description !== undefined) updateData.client_description = data.client_description;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.is_published !== undefined) updateData.is_published = data.is_published;

    return updateData;
  }

  private async checkTemplatePermissions(templateId: string, userId: string, action: 'view' | 'update' | 'delete'): Promise<void> {
    const { data: template, error } = await supabase
      .from('unified_workflow_templates')
      .select('created_by')
      .eq('id', templateId)
      .single();

    if (error) throw new Error('Template not found');

    // Check if user is the creator or has admin role
    if (template.created_by !== userId) {
      const { data: userRoles, error: roleError } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', userId);

      if (roleError) throw roleError;

      const hasAdminRole = userRoles?.some(ur => 
        ur.roles?.name === 'SUPER_ADMIN' || ur.roles?.name === 'ADMIN'
      );

      if (!hasAdminRole) {
        throw new Error(`Insufficient permissions to ${action} this template`);
      }
    }
  }

  private async getNextStageOrder(templateId: string): Promise<number> {
    const { data, error } = await supabase
      .from('unified_workflow_stages')
      .select('stage_order')
      .eq('template_id', templateId)
      .order('stage_order', { ascending: false })
      .limit(1);

    if (error) throw error;

    return (data?.[0]?.stage_order || 0) + 1;
  }

  private async getNextTaskOrder(stageId: string): Promise<number> {
    const { data, error } = await supabase
      .from('unified_workflow_tasks')
      .select('task_order')
      .eq('stage_id', stageId)
      .order('task_order', { ascending: false })
      .limit(1);

    if (error) throw error;

    return (data?.[0]?.task_order || 0) + 1;
  }

  private async getNextStepOrder(taskId: string): Promise<number> {
    const { data, error } = await supabase
      .from('unified_workflow_steps')
      .select('step_order')
      .eq('task_id', taskId)
      .order('step_order', { ascending: false })
      .limit(1);

    if (error) throw error;

    return (data?.[0]?.step_order || 0) + 1;
  }

  private async getStage(id: string): Promise<UnifiedWorkflowStage | null> {
    const { data, error } = await supabase
      .from('unified_workflow_stages')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  private async getTask(id: string): Promise<UnifiedWorkflowTask | null> {
    const { data, error } = await supabase
      .from('unified_workflow_tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  private async getStep(id: string): Promise<UnifiedWorkflowStep | null> {
    const { data, error } = await supabase
      .from('unified_workflow_steps')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  private async getInstance(id: string): Promise<UnifiedWorkflowInstance | null> {
    const { data, error } = await supabase
      .from('unified_workflow_instances')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  private isValidElementType(elementType: string): boolean {
    const validTypes: ElementType[] = [
      // Form Elements
      'text_input', 'textarea', 'number_input', 'email_input', 'url_input',
      'dropdown', 'radio_group', 'radio_button', 'checkbox', 'checkbox_group', 'date_picker', 
      'time_picker', 'file_upload', 'rating_scale', 'data_table',
      
      // Content Elements  
      'heading', 'paragraph', 'instructions', 'rich_text', 'link', 'divider', 
      'image', 'image_gallery', 'signature_pad',
      
      // User Interaction Elements
      'button_group', 'progress_indicator', 'notification_banner',
      
      // Data Collection Elements
      'address_input', 'phone_input',
      
      // Integration Elements
      'products_services', 'products_services_selector', 'template_selector', 
      'client_info', 'client_info_display', 'api_integration',
      
      // Workflow Control Elements
      'conditional_logic', 'required_validation', 'custom_validation',
      
      // Review Analytics Elements
      'summary_page', 'summary_display', 'analytics_display', 'confirmation',
      'confirmation_checkbox', 'data_review'
    ];
    return validTypes.includes(elementType as ElementType);
  }

  private async touchTemplate(templateId: string, updatedBy: string): Promise<void> {
    await supabase
      .from('unified_workflow_templates')
      .update({
        updated_at: new Date().toISOString(),
        updated_by: updatedBy
      })
      .eq('id', templateId);
  }

  private async logTemplateActivity(templateId: string, action: string, userId: string): Promise<void> {
    // Log template activity for audit trail
    console.log(`Template ${templateId} ${action} by user ${userId}`);
    // TODO: Implement proper activity logging if needed
  }

  private async createDefaultFlowStructure(templateId: string, createdBy: string): Promise<void> {
    // Create default stage for flow-based templates
    const stage = await this.createStage(templateId, {
      name: 'Flow Execution',
      description: 'Main execution stage for this flow',
      created_by: createdBy
    });

    // Create default task
    const task = await this.createTask(stage.id, {
      name: 'Flow Steps',
      description: 'Container task for flow steps',
      client_visible: true,
      created_by: createdBy
    });

    // Create default step
    await this.createStep(task.id, {
      name: 'Welcome',
      description: 'Welcome step for the flow',
      created_by: createdBy
    });
  }

  private async calculateAndUpdateProgress(instanceId: string, updatedBy: string): Promise<void> {
    // Calculate completion percentage based on submitted step data
    const instance = await this.getInstance(instanceId);
    if (!instance) return;

    const template = await this.getTemplate(instance.template_id);
    if (!template) return;

    // Count total steps and completed steps
    let totalSteps = 0;
    let completedSteps = 0;

    for (const stage of template.unified_workflow_stages || []) {
      for (const task of stage.unified_workflow_tasks || []) {
        for (const step of task.unified_workflow_steps || []) {
          if (step.client_visible) {
            totalSteps++;
            
            // Check if step has data
            const { data: stepData } = await supabase
              .from('unified_workflow_step_data')
              .select('id')
              .eq('instance_id', instanceId)
              .eq('step_id', step.id)
              .limit(1);

            if (stepData && stepData.length > 0) {
              completedSteps++;
            }
          }
        }
      }
    }

    const completionPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    await this.updateInstanceProgress(instanceId, {
      completion_percentage: Math.round(completionPercentage),
      updated_by: updatedBy
    });
  }

  private async calculateProgressDetails(templateId: string, instanceId: string): Promise<any> {
    const template = await this.getTemplate(templateId);
    if (!template) return {};

    let totalStages = 0;
    let totalTasks = 0;
    let totalSteps = 0;
    let completedStages = 0;
    let completedTasks = 0;
    let completedSteps = 0;

    for (const stage of template.unified_workflow_stages || []) {
      totalStages++;
      let stageCompleted = true;

      for (const task of stage.unified_workflow_tasks || []) {
        totalTasks++;
        let taskCompleted = true;

        for (const step of task.unified_workflow_steps || []) {
          if (step.client_visible) {
            totalSteps++;
            
            const { data: stepData } = await supabase
              .from('unified_workflow_step_data')
              .select('id')
              .eq('instance_id', instanceId)
              .eq('step_id', step.id)
              .limit(1);

            if (stepData && stepData.length > 0) {
              completedSteps++;
            } else {
              taskCompleted = false;
              stageCompleted = false;
            }
          }
        }

        if (taskCompleted) completedTasks++;
      }

      if (stageCompleted) completedStages++;
    }

    return {
      stages_completed: completedStages,
      total_stages: totalStages,
      tasks_completed: completedTasks,
      total_tasks: totalTasks,
      steps_completed: completedSteps,
      total_steps: totalSteps
    };
  }

  private async getTemplateUsageByMonth(templateId: string): Promise<Array<{month: string, instances_created: number, instances_completed: number}>> {
    // Get usage data for the last 12 months
    const months = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = date.toISOString().substring(0, 7); // YYYY-MM format
      
      const { data: created } = await supabase
        .from('unified_workflow_instances')
        .select('id')
        .eq('template_id', templateId)
        .gte('created_at', `${monthStr}-01`)
        .lt('created_at', `${monthStr}-32`);

      const { data: completed } = await supabase
        .from('unified_workflow_instances')
        .select('id')
        .eq('template_id', templateId)
        .eq('status', 'completed')
        .gte('completed_at', `${monthStr}-01`)
        .lt('completed_at', `${monthStr}-32`);

      months.push({
        month: monthStr,
        instances_created: created?.length || 0,
        instances_completed: completed?.length || 0
      });
    }

    return months;
  }
}

// Export singleton instance
export const unifiedWorkflowService = new UnifiedWorkflowService(); 