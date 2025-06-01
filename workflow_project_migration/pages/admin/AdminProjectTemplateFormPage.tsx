import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, SubmitHandler, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form } from '@/components/ui/form';
import { useUnifiedWorkflow } from '@/hooks/useUnifiedWorkflow';
import type { UnifiedWorkflowTemplate, CreateWorkflowTemplateRequest } from '@/types/unified-workflow';
import { toast } from 'sonner';
import { TemplateHeader } from '@/components/admin/project-templates/form/TemplateHeader';
import { TemplateToolbar } from '@/components/admin/project-templates/form/TemplateToolbar';
import { TemplateDescriptionForm } from '@/components/admin/project-templates/form/TemplateDescriptionForm';
import { TemplateTable } from '@/components/admin/project-templates/table/TemplateTable';


// Zod schema for validation - adapted for unified workflow structure
const taskSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, { message: 'Task name is required.' }).max(100),
  description: z.string().max(500).optional().nullable(),
  default_assignee_role: z.string().max(50).optional().nullable(),
  estimated_duration_hours: z.number().min(0).optional(),
  order: z.number().int().min(0),
  due_date: z.string().optional().nullable(),
  priority: z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH']).optional().nullable(),
});

const stageSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, { message: 'Stage name is required.' }).max(100),
  description: z.string().max(255).optional().nullable(),
  order: z.number().int().min(0),
  tasks: z.array(taskSchema).optional(),
});

const templateFormSchema = z.object({
  name: z.string().min(3, { message: 'Template name must be at least 3 characters.' }).max(100),
  description: z.string().max(500).optional(),
  template_type: z.enum(['standard', 'flow_based', 'hybrid']),
  icon: z.string().optional(),
  color: z.string().optional(),
  category: z.string().optional(),
  requires_products_services: z.boolean(),
  auto_create_project: z.boolean(),
  estimated_duration_minutes: z.number().min(0).optional(),
  client_visible: z.boolean(),
  client_description: z.string().max(500).optional(),
  stages: z.array(stageSchema).optional(),
});

export type TemplateFormValues = z.infer<typeof templateFormSchema>;

const AdminProjectTemplateFormPage: React.FC = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(templateId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTaskIds] = useState<Set<string>>(new Set());

  // Use unified workflow hook
  const {
    getTemplate,
    createTemplate,
    updateTemplate,
    error: hookError,
    isUsingUnifiedService,
    migrationMode
  } = useUnifiedWorkflow({ autoFetch: false });

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: '',
      description: '',
      template_type: 'standard',
      icon: '',
      color: '',
      category: '',
      requires_products_services: false,
      auto_create_project: true,
      estimated_duration_minutes: undefined,
      client_visible: true,
      client_description: '',
      stages: [],
    },
  });

  const { fields: stageFields, append: appendStage, remove: removeStage } = useFieldArray({
    control: form.control,
    name: 'stages',
  });

  // Navigation protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      if (form.formState.isDirty) {
        const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to leave?');
        if (!confirmLeave) {
          window.history.pushState(null, '', window.location.href);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [form.formState.isDirty]);

  const ProtectedLink: React.FC<{ to: string; children: React.ReactNode; className?: string }> = ({ to, children, className }) => {
    const handleClick = (e: React.MouseEvent) => {
      if (form.formState.isDirty) {
        e.preventDefault();
        const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to leave?');
        if (confirmLeave) {
          navigate(to);
        }
      } else {
        navigate(to);
      }
    };

    return (
      <span onClick={handleClick} className={className}>
        {children}
      </span>
    );
  };

  const getTaskFields = (stageIndex: number) => {
    return form.watch(`stages.${stageIndex}.tasks`) || [];
  };

  const addTaskToStage = (stageIndex: number) => {
    const currentTasks = form.getValues(`stages.${stageIndex}.tasks`) || [];
    const newTask = {
      id: crypto.randomUUID(),
      name: '',
      description: '',
      default_assignee_role: '',
      estimated_duration_hours: undefined,
      order: currentTasks.length,
      due_date: undefined,
      priority: 'NONE' as const,
    };
    newTaskIds.add(newTask.id);
    form.setValue(`stages.${stageIndex}.tasks`, [...currentTasks, newTask]);
    form.trigger(`stages.${stageIndex}.tasks`);
  };

  const removeTaskFromStage = (stageIndex: number, taskIndex: number) => {
    const currentTasks = form.getValues(`stages.${stageIndex}.tasks`) || [];
    const updatedTasks = currentTasks.filter((_, index) => index !== taskIndex);
    form.setValue(`stages.${stageIndex}.tasks`, updatedTasks);
    form.trigger(`stages.${stageIndex}.tasks`);
  };

  // Load template data for editing using unified service
  useEffect(() => {
    if (templateId && isEditing) {
      const fetchTemplateData = async () => {
        setLoading(true);
        setError(null);
        try {
          const template = await getTemplate(templateId);
          if (template) {
            // Map unified template to form values
            const formValues: TemplateFormValues = {
              name: template.name,
              description: template.description || '',
              template_type: template.template_type,
              icon: template.icon || '',
              color: template.color || '',
              category: template.category || '',
              requires_products_services: template.requires_products_services,
              auto_create_project: template.auto_create_project,
              estimated_duration_minutes: template.estimated_duration_minutes || undefined,
              client_visible: template.client_visible,
              client_description: template.client_description || '',
              stages: template.unified_workflow_stages?.map((stage) => ({
                id: stage.id,
                name: stage.name,
                description: stage.description || '',
                order: stage.stage_order,
                tasks: stage.unified_workflow_tasks?.map((task) => ({
                  id: task.id,
                  name: task.name,
                  description: task.description || '',
                  default_assignee_role: task.assigned_to || '',
                  estimated_duration_hours: task.estimated_duration_minutes ? 
                    Math.ceil(task.estimated_duration_minutes / 60) : undefined,
                  order: task.task_order,
                  due_date: task.due_date_offset_days ? 
                    new Date(Date.now() + task.due_date_offset_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
                  priority: 'MEDIUM', // Default priority since unified doesn't have this field
                })) || [],
              })) || [],
            };
            form.reset(formValues);
          } else {
            toast.error(`Template with ID ${templateId} not found.`);
            navigate('/admin/project-templates');
          }
        } catch (err: any) {
          console.error("Error fetching template details:", err);
          toast.error(`Failed to fetch template details: ${err.message}`);
          setError(`Failed to load template: ${err.message}`);
        } finally {
          setLoading(false);
        }
      };
      fetchTemplateData();
    }
  }, [templateId, isEditing, getTemplate, form, navigate]);

  const onSubmit: SubmitHandler<TemplateFormValues> = async (data) => {
    setLoading(true);
    setError(null);

    try {
      // Get current user for creation/update tracking
      const user = await import('@/lib/supabase').then(({ supabase }) => supabase.auth.getUser());
      const userId = user.data.user?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      let savedTemplate: UnifiedWorkflowTemplate | null = null;
      
      if (isEditing && templateId) {
        // Update existing template
        const updateData = {
          name: data.name,
          description: data.description,
          template_type: data.template_type,
          icon: data.icon,
          color: data.color,
          category: data.category,
          requires_products_services: data.requires_products_services,
          auto_create_project: data.auto_create_project,
          estimated_duration_minutes: data.estimated_duration_minutes,
          client_visible: data.client_visible,
          client_description: data.client_description,
          updated_by: userId
        };
        
        savedTemplate = await updateTemplate(templateId, updateData);
        toast.success(`Template "${savedTemplate.name}" updated successfully.`);
      } else {
        // Create new template
        const createData: CreateWorkflowTemplateRequest = {
          name: data.name,
          description: data.description,
          template_type: data.template_type,
          icon: data.icon,
          color: data.color,
          category: data.category,
          requires_products_services: data.requires_products_services,
          auto_create_project: data.auto_create_project,
          estimated_duration_minutes: data.estimated_duration_minutes,
          client_visible: data.client_visible,
          client_description: data.client_description,
          created_by: userId,
          create_default_structure: true // This will create basic stage/task structure
        };
        
        savedTemplate = await createTemplate(createData);
        toast.success(`Template "${savedTemplate.name}" created successfully.`);
      }
      
      navigate('/admin/project-templates');
    } catch (err: any) {
      console.error("Error saving template:", err);
      toast.error(`Failed to save template: ${err.message}`);
      setError(`Failed to save template: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading && isEditing && !form.formState.isDirty) {
    return (
      <div className="p-4">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          <span>Loading template details...</span>
          <span className="text-xs text-muted-foreground">
            ({migrationMode} mode)
          </span>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="min-h-screen bg-background">
        <TemplateHeader 
          control={form.control}
          isDirty={form.formState.isDirty}
          isLoading={loading}
          ProtectedLink={ProtectedLink}
        />

        <div className="p-6">
          {/* Show migration mode for debugging */}
          <div className="mb-4 p-2 bg-muted rounded-md text-xs text-muted-foreground">
            Mode: {migrationMode} {isUsingUnifiedService ? '(Unified Service)' : '(Compatibility Layer)'}
            {isEditing ? ` - Editing Template: ${templateId}` : ' - Creating New Template'}
          </div>

          {(error || hookError) && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive">
              Error: {error || hookError}
            </div>
          )}

          <TemplateDescriptionForm control={form.control} />

          <TemplateToolbar 
            onAddStage={() => appendStage({ 
              name: `Stage ${stageFields.length + 1}`, 
              description: '', 
              order: stageFields.length, 
              tasks: [] 
            })}
            stageCount={stageFields.length}
          />

          <TemplateTable 
            control={form.control}
            stageFields={stageFields}
            removeStage={removeStage}
            appendStage={appendStage}
            addTaskToStage={addTaskToStage}
            getTaskFields={getTaskFields}
            removeTaskFromStage={removeTaskFromStage}
          />
        </div>
      </form>
    </Form>
  );
};

export default AdminProjectTemplateFormPage; 