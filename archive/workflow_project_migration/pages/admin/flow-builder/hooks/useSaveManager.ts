import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useUnifiedWorkflow } from '@/hooks/useUnifiedWorkflow';
import type { AuthUser } from '@/contexts/AuthContext';
import type { 
  UnifiedWorkflowTemplate, 
  UnifiedWorkflowStage, 
  UnifiedWorkflowTask, 
  UnifiedWorkflowStep, 
  UnifiedWorkflowElement 
} from '@/types/unified-workflow';

interface TemplateData {
  template: UnifiedWorkflowTemplate | null;
  stages: UnifiedWorkflowStage[];
  tasks: UnifiedWorkflowTask[];
  steps: UnifiedWorkflowStep[];
  elements: UnifiedWorkflowElement[];
}

interface UseSaveManagerProps {
  user: AuthUser | null;
  isUsingUnifiedService: boolean;
  onSaveStatusChange: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
  onStateUpdate: (updates: Partial<TemplateData>) => void;
}

export const useSaveManager = ({
  user,
  isUsingUnifiedService,
  onSaveStatusChange,
  onStateUpdate
}: UseSaveManagerProps) => {
  const navigate = useNavigate();
  const { createTemplate, updateTemplate } = useUnifiedWorkflow({ autoFetch: false });

  const saveWorkflowHierarchy = useCallback(async (
    templateId: string, 
    userId: string, 
    templateData: TemplateData
  ) => {
    if (isUsingUnifiedService) {
      // Use unified workflow service
      const { unifiedWorkflowService } = await import('@/services');

      // Save stages
      for (const stage of templateData.stages) {
        if (stage.template_id !== templateId) {
          // This is a new stage that needs to be created
          console.log('Creating stage:', stage.name);
          const savedStage = await unifiedWorkflowService.createStage(templateId, {
            name: stage.name,
            description: stage.description,
            stage_order: stage.stage_order,
            is_required: stage.is_required,
            allow_skip: stage.allow_skip,
            auto_advance: stage.auto_advance,
            client_visible: stage.client_visible,
            client_description: stage.client_description,
            condition_logic: stage.condition_logic,
            icon: stage.icon,
            color: stage.color,
            created_by: userId
          });

          // Update the stage ID in our state and related tasks
          const oldStageId = stage.id;
          const newStageId = savedStage.id;
          
          onStateUpdate({
            stages: templateData.stages.map(s => s.id === oldStageId ? { ...s, id: newStageId, template_id: templateId } : s),
            tasks: templateData.tasks.map(t => t.stage_id === oldStageId ? { ...t, stage_id: newStageId } : t)
          });

          // Save tasks for this stage
          const stageTasks = templateData.tasks.filter(task => task.stage_id === oldStageId);
          for (const task of stageTasks) {
            console.log('Creating task:', task.name);
            const savedTask = await unifiedWorkflowService.createTask(newStageId, {
              name: task.name,
              description: task.description,
              task_order: task.task_order,
              task_type: task.task_type,
              is_required: task.is_required,
              allow_skip: task.allow_skip,
              auto_advance: task.auto_advance,
              assigned_to: task.assigned_to,
              estimated_duration_minutes: task.estimated_duration_minutes,
              due_date_offset_days: task.due_date_offset_days,
              client_visible: task.client_visible,
              client_description: task.client_description,
              condition_logic: task.condition_logic,
              depends_on_task_ids: task.depends_on_task_ids,
              created_by: userId
            });

            // Update the task ID in our state and related steps
            const oldTaskId = task.id;
            const newTaskId = savedTask.id;
            
            onStateUpdate({
              tasks: templateData.tasks.map(t => t.id === oldTaskId ? { ...t, id: newTaskId, stage_id: newStageId } : t),
              steps: templateData.steps.map(s => s.task_id === oldTaskId ? { ...s, task_id: newTaskId } : s)
            });

            // Save steps for this task
            const taskSteps = templateData.steps.filter(step => step.task_id === oldTaskId);
            for (const step of taskSteps) {
              console.log('Creating step:', step.name);
              const savedStep = await unifiedWorkflowService.createStep(newTaskId, {
                name: step.name,
                description: step.description,
                step_order: step.step_order,
                step_type: step.step_type,
                is_required: step.is_required,
                allow_skip: step.allow_skip,
                auto_advance: step.auto_advance,
                show_progress: step.show_progress,
                allow_back_navigation: step.allow_back_navigation,
                save_progress: step.save_progress,
                client_visible: step.client_visible,
                client_description: step.client_description,
                condition_logic: step.condition_logic,
                validation_rules: step.validation_rules,
                created_by: userId
              });

              // Update the step ID in our state and related elements
              const oldStepId = step.id;
              const newStepId = savedStep.id;
              
              onStateUpdate({
                steps: templateData.steps.map(s => s.id === oldStepId ? { ...s, id: newStepId, task_id: newTaskId } : s),
                elements: templateData.elements.map(e => e.step_id === oldStepId ? { ...e, step_id: newStepId } : e)
              });

              // Save elements for this step
              const stepElements = templateData.elements.filter(element => element.step_id === oldStepId);
              for (const element of stepElements) {
                console.log('Creating element:', element.label);
                const savedElement = await unifiedWorkflowService.createElement(newStepId, {
                  element_type: element.element_type,
                  element_key: element.element_key,
                  element_order: element.element_order,
                  label: element.label,
                  placeholder: element.placeholder,
                  help_text: element.help_text,
                  config: element.config,
                  is_required: element.is_required,
                  validation_rules: element.validation_rules,
                  condition_logic: element.condition_logic,
                  client_visible: element.client_visible,
                  created_by: userId
                });

                // Update the element ID in our state
                onStateUpdate({
                  elements: templateData.elements.map(e => e.id === element.id ? { ...e, id: savedElement.id, step_id: newStepId } : e)
                });
              }
            }
          }
        }
      }
    } else {
      // Use compatibility layer - convert to legacy flow format and save
      const { projectFlowService } = await import('@/services/projectFlowService');
      
      // Convert unified hierarchy to legacy flow steps format
      const legacySteps = templateData.steps.map((step, index) => ({
        name: step.name,
        description: step.description || '',
        step_number: index + 1,
        is_required: step.is_required,
        allow_skip: step.allow_skip,
        show_progress: step.show_progress,
        auto_advance: step.auto_advance,
        condition_logic: step.condition_logic,
        elements: templateData.elements
          .filter(element => element.step_id === step.id)
          .map(element => ({
            element_type: element.element_type,
            element_key: element.element_key,
            label: element.label || '',
            placeholder: element.placeholder || '',
            help_text: element.help_text || '',
            element_order: element.element_order,
            config: element.config,
            is_required: element.is_required,
            validation_rules: element.validation_rules,
            condition_logic: element.condition_logic
          }))
      }));

      console.log('Saving legacy flow steps:', legacySteps);
      await projectFlowService.saveFlowStepsAndElements(templateId, legacySteps);
    }
  }, [isUsingUnifiedService, onStateUpdate]);

  const handleSave = useCallback(async (
    templateData: TemplateData,
    isNewTemplate: boolean
  ) => {
    if (!templateData.template) {
      toast.error('No template to save');
      return;
    }

    // Check authentication using context
    if (!user) {
      toast.error('Authentication required to save template');
      return;
    }

    console.log('handleSave called', {
      isNewTemplate,
      template: templateData.template,
      stages: templateData.stages.length,
      tasks: templateData.tasks.length,
      steps: templateData.steps.length,
      elements: templateData.elements.length,
      isUsingUnifiedService
    });

    onSaveStatusChange('saving');

    try {
      let savedTemplateId = templateData.template.id;

      if (isNewTemplate || templateData.template.id === 'new') {
        // Create new template
        const newTemplateData = {
          name: templateData.template.name || 'New Workflow Template',
          description: templateData.template.description || '',
          template_type: templateData.template.template_type || 'flow_based',
          category: templateData.template.category || undefined,
          icon: templateData.template.icon || undefined,
          color: templateData.template.color || undefined,
          client_visible: templateData.template.client_visible ?? true,
          requires_products_services: templateData.template.requires_products_services ?? false,
          auto_create_project: templateData.template.auto_create_project ?? true,
          estimated_duration_minutes: templateData.template.estimated_duration_minutes,
          created_by: user.id,
          create_default_structure: false
        };

        console.log('Creating template with data:', newTemplateData);
        const savedTemplate = await createTemplate(newTemplateData);
        console.log('Template created successfully:', savedTemplate);
        
        savedTemplateId = savedTemplate.id;
        
        onStateUpdate({
          template: { ...savedTemplate },
          stages: templateData.stages.map(stage => ({ ...stage, template_id: savedTemplate.id }))
        });

        toast.success('Template created successfully');
        navigate(`/admin/project-flows/${savedTemplate.id}/edit`);
      } else {
        // Update existing template
        const updateData = {
          name: templateData.template.name,
          description: templateData.template.description,
          template_type: templateData.template.template_type,
          category: templateData.template.category || undefined,
          icon: templateData.template.icon || undefined,
          color: templateData.template.color || undefined,
          client_visible: templateData.template.client_visible,
          requires_products_services: templateData.template.requires_products_services,
          auto_create_project: templateData.template.auto_create_project,
          estimated_duration_minutes: templateData.template.estimated_duration_minutes,
          updated_by: user.id
        };

        console.log('Updating template with data:', updateData);
        const savedTemplate = await updateTemplate(templateData.template.id, updateData);
        console.log('Template updated successfully:', savedTemplate);
        
        onStateUpdate({
          template: savedTemplate
        });

        toast.success('Template updated successfully');
      }

      // Now save the hierarchy (stages, tasks, steps, elements)
      if (templateData.stages.length > 0 || templateData.tasks.length > 0 || templateData.steps.length > 0 || templateData.elements.length > 0) {
        console.log('Saving workflow hierarchy...');
        await saveWorkflowHierarchy(savedTemplateId, user.id, templateData);
        console.log('Workflow hierarchy saved successfully');
      }

      onSaveStatusChange('saved');
    } catch (err: any) {
      console.error('Error saving template:', err);
      onSaveStatusChange('error');
      toast.error(`Failed to save template: ${err.message || 'Unknown error'}`);
    }
  }, [user, createTemplate, updateTemplate, saveWorkflowHierarchy, navigate, onSaveStatusChange, onStateUpdate]);

  return {
    handleSave,
    saveWorkflowHierarchy
  };
}; 