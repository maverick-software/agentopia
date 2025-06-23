// Project Flows System - TypeScript Interfaces
// Generated from database schema implementation

export interface ProjectFlow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  estimated_duration_minutes: number | null;
  icon: string | null; // UI icon name (e.g., 'globe', 'smartphone', 'briefcase')
  color: string | null; // Hex color for flow cards
  sort_order: number;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  
  // Flow configuration
  requires_products_services: boolean;
  requires_template_selection: boolean;
  auto_create_project: boolean;
}

export interface ProjectFlowStep {
  id: string;
  flow_id: string;
  name: string;
  description: string | null;
  step_number: number;
  is_required: boolean;
  
  // Step behavior
  allow_skip: boolean;
  show_progress: boolean;
  auto_advance: boolean;
  
  // Conditional logic
  condition_logic: Record<string, any>;
  
  created_at: string;
  updated_at: string;
}

export type ProjectFlowElementType = 
  // Form Elements
  | 'text_input' | 'textarea' | 'number_input' | 'email_input' | 'url_input'
  | 'dropdown' | 'radio_group' | 'checkbox_group' | 'date_picker' | 'file_upload'
  // Content Elements
  | 'heading' | 'paragraph' | 'instructions' | 'link' | 'divider' | 'image'
  // Integration Elements
  | 'products_services_selector' | 'template_selector' | 'client_info_display'
  // Validation Elements
  | 'confirmation_checkbox' | 'signature_pad'
  // Review Elements
  | 'summary_display' | 'data_review'
  // AI Elements (Future)
  | 'ai_project_analysis' | 'ai_recommendation' | 'ai_form_prefill' | 'ai_template_suggestion';

export interface ProjectFlowElement {
  id: string;
  step_id: string;
  element_type: ProjectFlowElementType;
  element_key: string; // Unique key for data binding
  label: string | null;
  placeholder: string | null;
  help_text: string | null;
  element_order: number;
  
  // Element configuration (varies by type)
  config: Record<string, any>;
  
  // Validation
  is_required: boolean;
  validation_rules: Record<string, any>;
  
  // Conditional display
  condition_logic: Record<string, any>;
  
  created_at: string;
  updated_at: string;
}

export type ProjectFlowInstanceStatus = 'in_progress' | 'completed' | 'abandoned' | 'error';

export interface ProjectFlowInstance {
  id: string;
  flow_id: string;
  user_id: string;
  client_id: string;
  
  // Flow execution state
  status: ProjectFlowInstanceStatus;
  current_step_id: string | null;
  current_step_number: number;
  
  // Completion tracking
  completed_steps: string[]; // Array of completed step IDs
  started_at: string;
  completed_at: string | null;
  last_activity_at: string;
  
  // Result tracking
  created_project_id: string | null;
  error_message: string | null;
  
  // Metadata
  metadata: Record<string, any>;
}

export type ProjectFlowDataType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'file';

export interface ProjectFlowStepData {
  id: string;
  instance_id: string;
  step_id: string;
  element_key: string; // References element_key from ProjectFlowElement
  
  // Data storage
  data_value: any; // Flexible JSON storage
  data_type: ProjectFlowDataType;
  
  // Validation status
  is_valid: boolean;
  validation_errors: string[];
  
  created_at: string;
  updated_at: string;
}

// Extended interfaces with relationships for UI components

export interface ProjectFlowWithSteps extends ProjectFlow {
  steps: ProjectFlowStepWithElements[];
}

export interface ProjectFlowStepWithElements extends ProjectFlowStep {
  elements: ProjectFlowElement[];
}

export interface ProjectFlowInstanceWithData extends ProjectFlowInstance {
  flow: ProjectFlow;
  current_step: ProjectFlowStep | null;
  step_data: ProjectFlowStepData[];
}

// Configuration interfaces for different element types

export interface TextInputConfig {
  max_length?: number;
  min_length?: number;
  pattern?: string;
}

export interface DropdownConfig {
  options: Array<{
    label: string;
    value: string;
  }>;
  multiple?: boolean;
}

export interface RadioGroupConfig {
  options: Array<{
    label: string;
    value: string;
    description?: string;
  }>;
}

export interface CheckboxGroupConfig {
  options: Array<{
    label: string;
    value: string;
    description?: string;
  }>;
  min_selections?: number;
  max_selections?: number;
}

export interface FileUploadConfig {
  allowed_types?: string[];
  max_file_size?: number; // in bytes
  multiple?: boolean;
}

export interface ProductsServicesSelectorConfig {
  allow_multiple?: boolean;
  required_category?: string;
}

export interface TemplateSelectorConfig {
  filter_by_client?: boolean;
  required_template_type?: string;
}

export interface AIElementConfig {
  prompt_template?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

// Union type for all element configurations
export type ElementConfig = 
  | TextInputConfig
  | DropdownConfig
  | RadioGroupConfig
  | CheckboxGroupConfig
  | FileUploadConfig
  | ProductsServicesSelectorConfig
  | TemplateSelectorConfig
  | AIElementConfig
  | Record<string, any>; // Fallback for custom configurations

// Flow builder interfaces for admin UI

export interface FlowBuilderStep {
  id: string;
  name: string;
  description?: string;
  elements: FlowBuilderElement[];
  isExpanded?: boolean;
}

export interface FlowBuilderElement {
  id: string;
  type: ProjectFlowElementType;
  label: string;
  config: ElementConfig;
  validation: {
    required: boolean;
    rules: Record<string, any>;
  };
  isSelected?: boolean;
}

export interface FlowBuilderState {
  flow: Partial<ProjectFlow>;
  steps: FlowBuilderStep[];
  currentStepId?: string;
  isDirty: boolean;
}

// Flow execution interfaces for user-facing UI

export interface FlowExecutionState {
  instance: ProjectFlowInstanceWithData;
  currentStep: ProjectFlowStepWithElements | null;
  isLoading: boolean;
  error: string | null;
  canProceed: boolean;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
}

export interface StepSubmissionData {
  [element_key: string]: {
    value: any;
    type: ProjectFlowDataType;
  };
}

// API response interfaces

export interface CreateFlowResponse {
  flow: ProjectFlow;
  success: boolean;
  error?: string;
}

export interface StartFlowResponse {
  instance: ProjectFlowInstance;
  first_step: ProjectFlowStepWithElements;
  success: boolean;
  error?: string;
}

export interface SubmitStepResponse {
  instance: ProjectFlowInstance;
  next_step: ProjectFlowStepWithElements | null;
  is_complete: boolean;
  created_project_id?: string;
  success: boolean;
  error?: string;
}

// Validation interfaces

export interface ValidationRule {
  type: 'required' | 'min_length' | 'max_length' | 'pattern' | 'min' | 'max' | 'email' | 'url' | 'custom';
  value?: any;
  message: string;
}

export interface ValidationResult {
  is_valid: boolean;
  errors: string[];
}

export interface StepValidationResult {
  is_valid: boolean;
  element_errors: Record<string, string[]>;
  can_proceed: boolean;
} 