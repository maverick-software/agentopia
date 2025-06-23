// Unified Workflow Architecture - Type Definitions
// Generated from unified workflow database schema

export interface UnifiedWorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  template_type: 'standard' | 'flow_based' | 'hybrid';
  icon?: string;
  color?: string;
  category?: string;
  tags?: string[];
  requires_products_services: boolean;
  auto_create_project: boolean;
  estimated_duration_minutes?: number;
  client_visible: boolean;
  client_description?: string;
  is_active: boolean;
  is_published: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  
  // Nested relationships
  unified_workflow_stages?: UnifiedWorkflowStage[];
}

export interface UnifiedWorkflowStage {
  id: string;
  template_id: string;
  name: string;
  description?: string;
  stage_order: number;
  is_required: boolean;
  allow_skip: boolean;
  auto_advance: boolean;
  client_visible: boolean;
  client_description?: string;
  condition_logic: Record<string, any>;
  icon?: string;
  color?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  
  // Nested relationships
  unified_workflow_tasks?: UnifiedWorkflowTask[];
}

export interface UnifiedWorkflowTask {
  id: string;
  stage_id: string;
  name: string;
  description?: string;
  task_order: number;
  task_type: 'standard' | 'approval' | 'review' | 'automated';
  is_required: boolean;
  allow_skip: boolean;
  auto_advance: boolean;
  assigned_to?: string;
  estimated_duration_minutes?: number;
  due_date_offset_days?: number;
  client_visible: boolean;
  client_description?: string;
  condition_logic: Record<string, any>;
  depends_on_task_ids: string[];
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  
  // Nested relationships
  unified_workflow_steps?: UnifiedWorkflowStep[];
}

export interface UnifiedWorkflowStep {
  id: string;
  task_id: string;
  name: string;
  description?: string;
  step_order: number;
  step_type: 'form' | 'approval' | 'review' | 'automated' | 'conditional';
  is_required: boolean;
  allow_skip: boolean;
  auto_advance: boolean;
  show_progress: boolean;
  allow_back_navigation: boolean;
  save_progress: boolean;
  client_visible: boolean;
  client_description?: string;
  condition_logic: Record<string, any>;
  validation_rules: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  
  // Nested relationships
  unified_workflow_elements?: UnifiedWorkflowElement[];
}

export interface UnifiedWorkflowElement {
  id: string;
  step_id: string;
  element_type: string;
  element_key: string;
  element_order: number;
  label?: string;
  placeholder?: string;
  help_text?: string;
  config: Record<string, any>;
  is_required: boolean;
  validation_rules: Record<string, any>;
  condition_logic: Record<string, any>;
  client_visible: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface UnifiedWorkflowInstance {
  id: string;
  template_id: string;
  name: string;
  description?: string;
  project_id?: string;
  client_id?: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled' | 'on_hold';
  current_stage_id?: string;
  current_task_id?: string;
  current_step_id?: string;
  completion_percentage: number;
  started_at?: string;
  completed_at?: string;
  due_date?: string;
  assigned_to?: string;
  assigned_team_id?: string;
  instance_data: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface UnifiedWorkflowStepData {
  id: string;
  instance_id: string;
  step_id: string;
  element_id?: string;
  element_key: string;
  element_value: any;
  data_type?: string;
  is_valid: boolean;
  validation_errors?: string[];
  submitted_at?: string;
  submitted_by?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

// Request/Response types
export interface CreateWorkflowTemplateRequest {
  name: string;
  description?: string;
  template_type: 'standard' | 'flow_based' | 'hybrid';
  icon?: string;
  color?: string;
  category?: string;
  tags?: string[];
  requires_products_services?: boolean;
  auto_create_project?: boolean;
  estimated_duration_minutes?: number;
  client_visible?: boolean;
  client_description?: string;
  created_by: string;
  create_default_structure?: boolean;
}

export interface UpdateWorkflowTemplateRequest {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  category?: string;
  tags?: string[];
  requires_products_services?: boolean;
  auto_create_project?: boolean;
  estimated_duration_minutes?: number;
  client_visible?: boolean;
  client_description?: string;
  is_active?: boolean;
  is_published?: boolean;
  updated_by: string;
}

export interface CreateStageRequest {
  name: string;
  description?: string;
  stage_order?: number;
  is_required?: boolean;
  allow_skip?: boolean;
  auto_advance?: boolean;
  client_visible?: boolean;
  client_description?: string;
  condition_logic?: Record<string, any>;
  icon?: string;
  color?: string;
  created_by: string;
}

export interface CreateTaskRequest {
  name: string;
  description?: string;
  task_order?: number;
  task_type?: 'standard' | 'approval' | 'review' | 'automated';
  is_required?: boolean;
  allow_skip?: boolean;
  auto_advance?: boolean;
  assigned_to?: string;
  estimated_duration_minutes?: number;
  due_date_offset_days?: number;
  client_visible?: boolean;
  client_description?: string;
  condition_logic?: Record<string, any>;
  depends_on_task_ids?: string[];
  created_by: string;
}

export interface CreateStepRequest {
  name: string;
  description?: string;
  step_order?: number;
  step_type?: 'form' | 'approval' | 'review' | 'automated' | 'conditional';
  is_required?: boolean;
  allow_skip?: boolean;
  auto_advance?: boolean;
  show_progress?: boolean;
  allow_back_navigation?: boolean;
  save_progress?: boolean;
  client_visible?: boolean;
  client_description?: string;
  condition_logic?: Record<string, any>;
  validation_rules?: Record<string, any>;
  created_by: string;
}

export interface CreateElementRequest {
  element_type: string;
  element_key: string;
  element_order?: number;
  label?: string;
  placeholder?: string;
  help_text?: string;
  config?: Record<string, any>;
  is_required?: boolean;
  validation_rules?: Record<string, any>;
  condition_logic?: Record<string, any>;
  client_visible?: boolean;
  created_by: string;
}

export interface TemplateFilters {
  template_type?: 'standard' | 'flow_based' | 'hybrid' | ('standard' | 'flow_based' | 'hybrid')[];
  is_active?: boolean;
  is_published?: boolean;
  created_by?: string;
  category?: string;
  tags?: string[];
}

export interface WorkflowExecutionContext {
  name: string;
  description?: string;
  project_id?: string;
  client_id?: string;
  assigned_to?: string;
  due_date?: string;
  instance_data?: Record<string, any>;
  created_by: string;
}

export interface ProgressUpdate {
  current_stage_id?: string;
  current_task_id?: string;
  current_step_id?: string;
  completion_percentage?: number;
  status?: 'draft' | 'active' | 'completed' | 'cancelled' | 'on_hold';
  updated_by: string;
}

export interface StepDataSubmission {
  element_key: string;
  element_value: any;
  data_type?: string;
  submitted_by: string;
}

// Analytics types
export interface TemplateAnalytics {
  template_id: string;
  total_instances: number;
  completed_instances: number;
  average_completion_time_minutes: number;
  completion_rate: number;
  most_common_exit_step?: string;
  usage_by_month: Array<{
    month: string;
    instances_created: number;
    instances_completed: number;
  }>;
}

export interface InstanceAnalytics {
  instance_id: string;
  current_progress: number;
  time_spent_minutes: number;
  steps_completed: number;
  total_steps: number;
  estimated_completion_date?: string;
  bottleneck_steps: Array<{
    step_id: string;
    step_name: string;
    average_time_minutes: number;
  }>;
}

export interface UsageMetrics {
  total_templates: number;
  active_instances: number;
  completed_instances_this_month: number;
  average_template_completion_rate: number;
  most_popular_templates: Array<{
    template_id: string;
    template_name: string;
    usage_count: number;
  }>;
  template_type_distribution: {
    standard: number;
    flow_based: number;
    hybrid: number;
  };
}

// Element type definitions
export type ElementType = 
  // Form Elements
  | 'text_input'
  | 'textarea'
  | 'number_input'
  | 'email_input'
  | 'url_input'
  | 'dropdown'
  | 'radio_group'
  | 'radio_button'
  | 'checkbox'
  | 'checkbox_group'
  | 'date_picker'
  | 'time_picker'
  | 'file_upload'
  | 'rating_scale'
  | 'data_table'
  // Content Elements
  | 'heading'
  | 'paragraph'
  | 'instructions'
  | 'rich_text'
  | 'link'
  | 'divider'
  | 'image'
  | 'image_gallery'
  | 'signature_pad'
  // User Interaction Elements
  | 'button_group'
  | 'progress_indicator'
  | 'notification_banner'
  // Data Collection Elements
  | 'address_input'
  | 'phone_input'
  // Integration Elements
  | 'products_services'
  | 'products_services_selector'
  | 'template_selector'
  | 'client_info'
  | 'client_info_display'
  | 'api_integration'
  // Workflow Control Elements
  | 'conditional_logic'
  | 'required_validation'
  | 'custom_validation'
  // Review Analytics Elements
  | 'summary_page'
  | 'summary_display'
  | 'analytics_display'
  | 'confirmation'
  | 'confirmation_checkbox'
  | 'data_review';

// Utility types
export interface WorkflowInstanceWithProgress extends UnifiedWorkflowInstance {
  template: UnifiedWorkflowTemplate;
  current_stage?: UnifiedWorkflowStage;
  current_task?: UnifiedWorkflowTask;
  current_step?: UnifiedWorkflowStep;
  step_data: UnifiedWorkflowStepData[];
  progress_details: {
    stages_completed: number;
    total_stages: number;
    tasks_completed: number;
    total_tasks: number;
    steps_completed: number;
    total_steps: number;
  };
}

export interface ValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PermissionCheck {
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_execute: boolean;
  reason?: string;
} 