import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  ArrowRight, 
  Save, 
  CheckCircle, 
  AlertCircle,
  Clock,
  User,
  Workflow
} from 'lucide-react';
import { toast } from 'sonner';
import { projectFlowService, type ProjectFlowWithDetails } from '@/services/projectFlowService';
import { supabase } from '@/lib/supabase';
import { ElementManager } from '@/lib/flow-elements/ElementManager';

// Simple client type for this component
interface Client {
  id: string;
  name: string;
  contact_email?: string;
  business_name?: string;
  primary_contact_name?: string;
}

// Flow execution state types
interface FlowExecutionState {
  // Flow data
  flow: ProjectFlowWithDetails | null;
  client: Client | null;
  
  // Navigation state
  currentStepIndex: number;
  totalSteps: number;
  
  // Data collection
  stepData: Record<string, Record<string, any>>; // stepId -> elementKey -> value
  stepErrors: Record<string, Record<string, string[]>>; // stepId -> elementKey -> errors
  stepValidation: Record<string, boolean>; // stepId -> isValid
  
  // UI state
  isLoading: boolean;
  isSaving: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  error: string | null;
}

// Step renderer component
interface StepRendererProps {
  step: any;
  stepData: Record<string, any>;
  stepErrors: Record<string, string[]>;
  onDataChange: (elementKey: string, value: any) => void;
  onValidationChange: (elementKey: string, errors: string[]) => void;
  disabled?: boolean;
}

const StepRenderer: React.FC<StepRendererProps> = ({
  step,
  stepData,
  stepErrors,
  onDataChange,
  onValidationChange,
  disabled = false
}) => {
  // Safety check: ensure step has elements
  if (!step || !step.project_flow_elements || step.project_flow_elements.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center pb-6 border-b">
          <h2 className="text-2xl font-bold">{step?.name || 'Step'}</h2>
          {step?.description && (
            <p className="text-muted-foreground mt-2">{step.description}</p>
          )}
        </div>
        <div className="space-y-4 max-w-2xl mx-auto">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This step has no elements configured. Please contact your administrator.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step header */}
      <div className="text-center pb-6 border-b">
        <h2 className="text-2xl font-bold">{step.name}</h2>
        {step.description && (
          <p className="text-muted-foreground mt-2">{step.description}</p>
        )}
      </div>
      
      {/* Step elements */}
      <div className="space-y-4 max-w-2xl mx-auto">
        {step.project_flow_elements.map((element: any) => {
          const implementation = ElementManager.get(element.element_type);
          
          if (!implementation) {
            return (
              <Alert key={element.id} variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Element type "{element.element_type}" is not supported.
                </AlertDescription>
              </Alert>
            );
          }
          
          const RuntimeComponent = implementation.RuntimeComponent;
          const elementValue = stepData[element.element_key];
          const elementErrors = stepErrors[element.element_key] || [];
          
          return (
            <div key={element.id}>
              <RuntimeComponent
                element={element}
                value={elementValue}
                onChange={(value) => onDataChange(element.element_key, value)}
                errors={elementErrors}
                disabled={disabled}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Progress indicator component
const ProgressIndicator: React.FC<{
  currentStep: number;
  totalSteps: number;
  completedSteps: Set<number>;
}> = ({ currentStep, totalSteps, completedSteps }) => {
  const progressPercentage = (currentStep / totalSteps) * 100;
  
  return (
    <div className="w-full space-y-3">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Step {currentStep + 1} of {totalSteps}</span>
        <span>{Math.round(progressPercentage)}% complete</span>
      </div>
      <Progress value={progressPercentage} className="w-full" />
      
      {/* Step indicators */}
      <div className="flex justify-between">
        {Array.from({ length: totalSteps }, (_, index) => (
          <div
            key={index}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 ${
              index < currentStep 
                ? 'bg-primary text-primary-foreground border-primary' 
                : index === currentStep
                ? 'bg-background text-primary border-primary'
                : 'bg-muted text-muted-foreground border-muted'
            }`}
          >
            {completedSteps.has(index) ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              index + 1
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const FlowExecutionPage: React.FC = () => {
  const { flowId } = useParams<{ flowId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clientId = searchParams.get('clientId');
  
  const [state, setState] = useState<FlowExecutionState>({
    flow: null,
    client: null,
    currentStepIndex: 0,
    totalSteps: 0,
    stepData: {},
    stepErrors: {},
    stepValidation: {},
    isLoading: true,
    isSaving: false,
    saveStatus: 'idle',
    error: null
  });

  // Simple function to get client data
  const getClient = async (id: string): Promise<Client | null> => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, contact_email, business_name, primary_contact_name')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching client:', error);
      return null;
    }
  };

  // Load flow and client data
  useEffect(() => {
    const loadData = async () => {
      if (!flowId || !clientId) {
        setState(prev => ({ 
          ...prev, 
          error: 'Missing flow ID or client ID',
          isLoading: false 
        }));
        return;
      }

      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        
        const [flowData, clientData] = await Promise.all([
          projectFlowService.getProjectFlowById(flowId),
          getClient(clientId)
        ]);

        if (!flowData) {
          throw new Error('Flow not found');
        }
        
        if (!clientData) {
          throw new Error('Client not found');
        }

        setState(prev => ({
          ...prev,
          flow: flowData,
          client: clientData,
          totalSteps: flowData.project_flow_steps.length,
          isLoading: false
        }));
        
      } catch (error: any) {
        console.error('Error loading flow execution data:', error);
        setState(prev => ({
          ...prev,
          error: error.message || 'Failed to load flow data',
          isLoading: false
        }));
      }
    };

    loadData();
  }, [flowId, clientId]);

  // Handle element data change
  const handleElementDataChange = useCallback((elementKey: string, value: any) => {
    if (!state.flow) return;
    
    const currentStep = state.flow.project_flow_steps[state.currentStepIndex];
    const stepId = currentStep.id;
    
    setState(prev => ({
      ...prev,
      stepData: {
        ...prev.stepData,
        [stepId]: {
          ...prev.stepData[stepId],
          [elementKey]: value
        }
      },
      saveStatus: 'idle' // Mark as needing save
    }));

    // Find the element and validate it
    const element = currentStep.project_flow_elements.find(e => e.element_key === elementKey);
    if (element) {
      validateElement(element, value);
    }
  }, [state.flow, state.currentStepIndex]);

  // Validate individual element
  const validateElement = useCallback((element: any, value: any) => {
    const implementation = ElementManager.get(element.element_type);
    if (!implementation?.validator) return;

    const errors: string[] = [];
    
    // Required field validation
    if (element.is_required && (value === undefined || value === null || value === '')) {
      errors.push('This field is required');
    }

    // Element-specific validation
    if (value !== undefined && value !== null && value !== '') {
      const validationResult = implementation.validator.validateRuntime(value, element.config);
      if (!validationResult.isValid) {
        errors.push(...validationResult.errors);
      }
    }

    const currentStep = state.flow?.project_flow_steps[state.currentStepIndex];
    if (!currentStep) return;

    setState(prev => ({
      ...prev,
      stepErrors: {
        ...prev.stepErrors,
        [currentStep.id]: {
          ...prev.stepErrors[currentStep.id],
          [element.element_key]: errors
        }
      }
    }));
  }, [state.flow, state.currentStepIndex]);

  // Validate current step
  const validateCurrentStep = useCallback(() => {
    if (!state.flow) return false;

    const currentStep = state.flow.project_flow_steps[state.currentStepIndex];
    const stepData = state.stepData[currentStep.id] || {};
    const stepErrors = state.stepErrors[currentStep.id] || {};

    let isValid = true;

    // Validate all elements in the current step
    currentStep.project_flow_elements.forEach(element => {
      const value = stepData[element.element_key];
      const errors = stepErrors[element.element_key] || [];

      // Re-validate element
      validateElement(element, value);

      // Check if element has errors
      if (errors.length > 0) {
        isValid = false;
      }
    });

    setState(prev => ({
      ...prev,
      stepValidation: {
        ...prev.stepValidation,
        [currentStep.id]: isValid
      }
    }));

    return isValid;
  }, [state.flow, state.currentStepIndex, state.stepData, state.stepErrors, validateElement]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (!validateCurrentStep()) {
      toast.error('Please fix the errors before proceeding');
      return;
    }

    if (state.currentStepIndex < state.totalSteps - 1) {
      setState(prev => ({
        ...prev,
        currentStepIndex: prev.currentStepIndex + 1
      }));
    } else {
      // Last step - create project
      handleCreateProject();
    }
  }, [state.currentStepIndex, state.totalSteps, validateCurrentStep]);

  const handlePrevious = useCallback(() => {
    if (state.currentStepIndex > 0) {
      setState(prev => ({
        ...prev,
        currentStepIndex: prev.currentStepIndex - 1
      }));
    }
  }, [state.currentStepIndex]);

  // Create project with collected data
  const handleCreateProject = useCallback(async () => {
    if (!state.flow || !state.client) return;

    try {
      setState(prev => ({ ...prev, isSaving: true }));
      
      // Get current user for project creation
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Authentication required to create project');
      }

      // Build project name from flow data if available, otherwise use flow name
      let projectName = state.flow.name;
      const firstStepData = Object.values(state.stepData)[0];
      if (firstStepData?.project_name) {
        projectName = firstStepData.project_name;
      }

      // Build project description from flow data
      let projectDescription = state.flow.description || '';
      if (firstStepData?.project_description) {
        projectDescription = firstStepData.project_description;
      }

      // Determine template_id if the flow requires template selection
      let templateId = null;
      if (state.flow.requires_template_selection) {
        // Look for template selection in the flow data
        for (const stepData of Object.values(state.stepData)) {
          if (stepData.template_id || stepData.project_template) {
            templateId = stepData.template_id || stepData.project_template;
            break;
          }
        }
      }

      // Create the project record
      const projectData = {
        name: projectName,
        description: projectDescription,
        status: 'Planning', // Default status for new projects
        client_id: state.client.id,
        template_id: templateId,
        created_by_user_id: user.id
      };

      const { data: newProject, error: createError } = await supabase
        .from('projects')
        .insert([projectData])
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // Create a flow instance record to track the execution
      const flowInstanceData = {
        flow_id: state.flow.id,
        user_id: user.id,
        client_id: state.client.id,
        status: 'completed',
        current_step_number: state.totalSteps,
        completed_steps: state.flow.project_flow_steps.map(step => step.id),
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        created_project_id: newProject.id,
        metadata: {
          collected_data: state.stepData,
          execution_summary: {
            total_steps: state.totalSteps,
            completion_time: new Date().toISOString()
          }
        }
      };

      const { error: instanceError } = await supabase
        .from('project_flow_instances')
        .insert([flowInstanceData]);

      if (instanceError) {
        console.warn('Failed to create flow instance record:', instanceError);
        // Don't fail the project creation for this
      }

      toast.success(`Project "${newProject.name}" created successfully!`);
      navigate(`/clients/${state.client.id}?tab=projects&projectId=${newProject.id}`);
      
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast.error(`Failed to create project: ${error.message}`);
    } finally {
      setState(prev => ({ ...prev, isSaving: false }));
    }
  }, [state.flow, state.client, state.stepData, navigate]);

  // Get completed steps
  const completedSteps = new Set(
    Object.entries(state.stepValidation)
      .filter(([_, isValid]) => isValid)
      .map(([stepId, _]) => {
        if (!state.flow) return -1;
        return state.flow.project_flow_steps.findIndex(s => s.id === stepId);
      })
      .filter(index => index !== -1)
  );

  // Loading state
  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Loading project flow...</p>
          <p className="text-sm text-muted-foreground">Preparing your workflow</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
            <Button 
              className="w-full mt-4" 
              variant="outline"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!state.flow || !state.client) {
    return null;
  }

  // Safety check: ensure flow has steps and currentStepIndex is valid
  if (!state.flow.project_flow_steps || state.flow.project_flow_steps.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>This flow has no steps configured.</AlertDescription>
            </Alert>
            <Button 
              className="w-full mt-4" 
              variant="outline"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Safety check: ensure currentStepIndex is valid
  if (state.currentStepIndex >= state.flow.project_flow_steps.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Invalid step index. Please restart the flow.</AlertDescription>
            </Alert>
            <Button 
              className="w-full mt-4" 
              variant="outline"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStep = state.flow.project_flow_steps[state.currentStepIndex];
  const isLastStep = state.currentStepIndex === state.totalSteps - 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Workflow className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold">{state.flow.name}</h1>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{state.client.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {state.flow.estimated_duration_minutes}min
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
            <ProgressIndicator
              currentStep={state.currentStepIndex}
              totalSteps={state.totalSteps}
              completedSteps={completedSteps}
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-6 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-8">
            <StepRenderer
              step={currentStep}
              stepData={state.stepData[currentStep.id] || {}}
              stepErrors={state.stepErrors[currentStep.id] || {}}
              onDataChange={handleElementDataChange}
              onValidationChange={() => {}} // Handled in handleElementDataChange
              disabled={state.isSaving}
            />
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6 max-w-4xl mx-auto">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={state.currentStepIndex === 0 || state.isSaving}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <div className="text-sm text-muted-foreground">
            Step {state.currentStepIndex + 1} of {state.totalSteps}
          </div>

          <Button
            onClick={handleNext}
            disabled={state.isSaving}
          >
            {isLastStep ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Create Project
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}; 