import { supabase } from '@/lib/supabase';
import type { 
  ProjectFlow, 
  ProjectFlowStep, 
  ProjectFlowElement,
  ProjectFlowInstance,
  ProjectFlowStepData 
} from '@/types/project-flows';

// Database table names
const TABLE_PROJECT_FLOWS = 'project_flows';
const TABLE_PROJECT_FLOW_STEPS = 'project_flow_steps';
const TABLE_PROJECT_FLOW_ELEMENTS = 'project_flow_elements';
const TABLE_PROJECT_FLOW_INSTANCES = 'project_flow_instances';
const TABLE_PROJECT_FLOW_STEP_DATA = 'project_flow_step_data';

// Extended types for API responses with relationships
export type ProjectFlowWithDetails = ProjectFlow & {
  project_flow_steps: (ProjectFlowStep & {
    project_flow_elements: ProjectFlowElement[];
  })[];
  created_by_user?: {
    id: string;
    name?: string;
    email?: string;
  };
  step_count?: number;
  usage_count?: number;
};

export type ProjectFlowListItem = ProjectFlow & {
  created_by_user?: {
    id: string;
    name?: string;
    email?: string;
  };
  step_count?: number;
  usage_count?: number;
};

// Helper to handle Supabase errors
const handleSupabaseError = (error: any, contextMessage: string) => {
  if (error) {
    console.error(contextMessage, error);
    throw new Error(`${contextMessage}: ${error.message}`);
  }
};

// Helper to get current user
const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('User not authenticated');
  }
  return user;
};

export const projectFlowService = {
  // 1. Get all project flows with basic information
  async getProjectFlows(): Promise<ProjectFlowListItem[]> {
    const { data, error } = await supabase
      .from(TABLE_PROJECT_FLOWS)
      .select(`
        *,
        step_count:project_flow_steps(count),
        usage_count:project_flow_instances(count)
      `)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    handleSupabaseError(error, 'Error fetching project flows');
    
    // Transform the count aggregations and get user info separately
    const transformedFlows = (data || []).map(flow => ({
      ...flow,
      step_count: Array.isArray(flow.step_count) ? flow.step_count.length : flow.step_count?.[0]?.count || 0,
      usage_count: Array.isArray(flow.usage_count) ? flow.usage_count.length : flow.usage_count?.[0]?.count || 0,
    }));

    // Get user information separately if needed
    // For now, we'll return flows without user details to avoid the relationship issue
    return transformedFlows;
  },

  // 2. Get a single project flow by ID with all details
  async getProjectFlowById(flowId: string): Promise<ProjectFlowWithDetails | null> {
    const { data, error } = await supabase
      .from(TABLE_PROJECT_FLOWS)
      .select(`
        *,
        project_flow_steps!flow_id (
          *,
          project_flow_elements!step_id (
            *
          )
        )
      `)
      .eq('id', flowId)
      .single();

    handleSupabaseError(error, `Error fetching project flow with ID ${flowId}`);

    if (data) {
      // Sort steps by step_number and elements by element_order
      if (data.project_flow_steps) {
        data.project_flow_steps.sort((a: any, b: any) => a.step_number - b.step_number);
        
        data.project_flow_steps.forEach((step: any) => {
          if (step.project_flow_elements) {
            step.project_flow_elements.sort((a: any, b: any) => a.element_order - b.element_order);
          }
        });
      }
    }

    return data as unknown as ProjectFlowWithDetails | null;
  },

  // 3. Create a new project flow
  async createProjectFlow(flowData: Partial<ProjectFlow>): Promise<ProjectFlow> {
    const user = await getCurrentUser();
    
    const { data: newFlow, error } = await supabase
      .from(TABLE_PROJECT_FLOWS)
      .insert({
        ...flowData,
        created_by_user_id: user.id
      })
      .select()
      .single();

    handleSupabaseError(error, 'Error creating project flow');
    if (!newFlow) throw new Error('Failed to create project flow, no data returned');

    return newFlow as ProjectFlow;
  },

  // 4. Update an existing project flow
  async updateProjectFlow(flowId: string, updates: Partial<ProjectFlow>): Promise<ProjectFlow> {
    const { data: updatedFlow, error } = await supabase
      .from(TABLE_PROJECT_FLOWS)
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', flowId)
      .select()
      .single();

    handleSupabaseError(error, `Error updating project flow with ID ${flowId}`);
    if (!updatedFlow) throw new Error('Failed to update project flow, no data returned');

    return updatedFlow as ProjectFlow;
  },

  // 5. Toggle flow active status
  async toggleFlowStatus(flowId: string, isActive: boolean): Promise<ProjectFlow> {
    return this.updateProjectFlow(flowId, { is_active: isActive });
  },

  // 6. Delete a project flow (cascades to steps, elements, instances, and step data)
  async deleteProjectFlow(flowId: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE_PROJECT_FLOWS)
      .delete()
      .eq('id', flowId);

    handleSupabaseError(error, `Error deleting project flow with ID ${flowId}`);
  },

  // 7. Get project flow usage statistics
  async getFlowUsageStats(flowId: string): Promise<{
    totalInstances: number;
    completedInstances: number;
    averageCompletionTime: number | null;
    popularSteps: string[];
  }> {
    // Get instance statistics
    const { data: instances, error: instancesError } = await supabase
      .from(TABLE_PROJECT_FLOW_INSTANCES)
      .select('status, started_at, completed_at')
      .eq('flow_id', flowId);

    handleSupabaseError(instancesError, `Error fetching usage stats for flow ${flowId}`);

    const totalInstances = instances?.length || 0;
    const completedInstances = instances?.filter(i => i.status === 'completed').length || 0;
    
    // Calculate average completion time for completed instances
    let averageCompletionTime: number | null = null;
    const completedWithTimes = instances?.filter(i => 
      i.status === 'completed' && i.started_at && i.completed_at
    ) || [];
    
    if (completedWithTimes.length > 0) {
      const totalTime = completedWithTimes.reduce((sum, instance) => {
        const start = new Date(instance.started_at!).getTime();
        const end = new Date(instance.completed_at!).getTime();
        return sum + (end - start);
      }, 0);
      averageCompletionTime = Math.round(totalTime / completedWithTimes.length / 1000 / 60); // in minutes
    }

    return {
      totalInstances,
      completedInstances,
      averageCompletionTime,
      popularSteps: [] // TODO: Implement step popularity analysis
    };
  },

  // 8. Duplicate a project flow
  async duplicateProjectFlow(flowId: string, newName: string): Promise<ProjectFlow> {
    const originalFlow = await this.getProjectFlowById(flowId);
    if (!originalFlow) {
      throw new Error(`Project flow with ID ${flowId} not found`);
    }

    // Create new flow with updated name
    const { project_flow_steps, created_by_user, ...flowData } = originalFlow;
    const newFlow = await this.createProjectFlow({
      ...flowData,
      name: newName,
      is_active: false // Start duplicated flows as inactive
    });

    // If there are steps, duplicate them and their elements
    if (project_flow_steps && project_flow_steps.length > 0) {
      for (const step of project_flow_steps) {
        const { project_flow_elements, id, flow_id, ...stepData } = step;
        
        const { data: newStep, error: stepError } = await supabase
          .from(TABLE_PROJECT_FLOW_STEPS)
          .insert({
            ...stepData,
            flow_id: newFlow.id
          })
          .select()
          .single();

        handleSupabaseError(stepError, `Error duplicating step '${step.name}'`);

        // Duplicate elements if they exist
        if (project_flow_elements && project_flow_elements.length > 0) {
          const elementsToInsert = project_flow_elements.map(element => {
            const { id, step_id, ...elementData } = element;
            return {
              ...elementData,
              step_id: newStep.id
            };
          });

          const { error: elementsError } = await supabase
            .from(TABLE_PROJECT_FLOW_ELEMENTS)
            .insert(elementsToInsert);

          handleSupabaseError(elementsError, `Error duplicating elements for step '${step.name}'`);
        }
      }
    }

    return newFlow;
  },

  // 9. Reorder flows
  async reorderFlows(flowUpdates: { id: string; sort_order: number }[]): Promise<void> {
    // Update multiple flows in a batch
    const updates = flowUpdates.map(update => 
      supabase
        .from(TABLE_PROJECT_FLOWS)
        .update({ sort_order: update.sort_order })
        .eq('id', update.id)
    );

    const results = await Promise.all(updates);
    
    // Check for any errors
    results.forEach((result, index) => {
      if (result.error) {
        throw new Error(`Error updating sort order for flow ${flowUpdates[index].id}: ${result.error.message}`);
      }
    });
  },

  // 10. Save flow steps and elements (for flow builder)
  async saveFlowStepsAndElements(flowId: string, steps: any[]): Promise<void> {
    try {
      console.log('Saving flow steps and elements for flow:', flowId);
      console.log('Steps to save:', steps);

      // Delete all existing steps for this flow - this will cascade delete elements
      // due to the foreign key constraint with ON DELETE CASCADE
      const { error: deleteError } = await supabase
        .from(TABLE_PROJECT_FLOW_STEPS)
        .delete()
        .eq('flow_id', flowId);

      if (deleteError) {
        console.error('Error deleting existing steps:', deleteError);
        throw new Error(`Error deleting existing steps: ${deleteError.message}`);
      }

      // If no steps to insert, we're done
      if (!steps || steps.length === 0) {
        console.log('No steps to insert');
        return;
      }

      // Insert new steps
      const stepsToInsert = steps.map(step => ({
        flow_id: flowId,
        name: step.name,
        description: step.description || null,
        step_number: step.step_number,
        is_required: step.is_required,
        allow_skip: step.allow_skip || false,
        show_progress: step.show_progress !== false,
        auto_advance: step.auto_advance || false,
        condition_logic: step.condition_logic || {}
      }));

      console.log('Inserting steps:', stepsToInsert);

      const { data: insertedSteps, error: stepsError } = await supabase
        .from(TABLE_PROJECT_FLOW_STEPS)
        .insert(stepsToInsert)
        .select('id, step_number');

      if (stepsError) {
        console.error('Error inserting steps:', stepsError);
        throw new Error(`Error inserting steps: ${stepsError.message}`);
      }

      console.log('Inserted steps:', insertedSteps);

      // Create a mapping from step_number to new step ID
      const stepIdMapping = new Map();
      insertedSteps?.forEach(insertedStep => {
        stepIdMapping.set(insertedStep.step_number, insertedStep.id);
      });

      // Insert elements for each step
      const elementsToInsert: any[] = [];
      for (const step of steps) {
        const newStepId = stepIdMapping.get(step.step_number);
        if (newStepId && step.elements && step.elements.length > 0) {
          step.elements.forEach((element: any, index: number) => {
            // Ensure element_order starts from 1 and is sequential
            const elementOrder = element.element_order > 0 ? element.element_order : index + 1;
            
            elementsToInsert.push({
              step_id: newStepId,
              element_type: element.element_type,
              element_key: element.element_key,
              label: element.label || null,
              placeholder: element.placeholder || null,
              help_text: element.help_text || null,
              element_order: elementOrder,
              config: element.config || {},
              is_required: element.is_required,
              validation_rules: element.validation_rules || {},
              condition_logic: element.condition_logic || {}
            });
          });
        }
      }

      console.log('Elements to insert:', elementsToInsert);

      if (elementsToInsert.length > 0) {
        const { error: elementsError } = await supabase
          .from(TABLE_PROJECT_FLOW_ELEMENTS)
          .insert(elementsToInsert);

        if (elementsError) {
          console.error('Error inserting elements:', elementsError);
          throw new Error(`Error inserting elements: ${elementsError.message}`);
        }
      }

      console.log('Successfully saved flow steps and elements');

    } catch (error: any) {
      console.error('Error saving flow steps and elements:', error);
      throw new Error(`Failed to save flow steps and elements: ${error.message}`);
    }
  }
}; 