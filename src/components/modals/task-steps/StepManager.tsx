import React, { useState, useCallback, useEffect } from 'react';
import { StepList } from './StepList';
import { StepEditor } from './StepEditor';
import { useTaskSteps } from '@/hooks/useTaskSteps';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ListOrdered, 
  Plus, 
  AlertCircle, 
  CheckCircle,
  Loader2
} from 'lucide-react';
import { StepManagerProps, TaskStepFormData } from '@/types/tasks';
import { cn } from '@/lib/utils';

export function StepManager({
  taskId,
  initialSteps = [],
  onStepsChange,
  onValidationChange,
  isEditing = false,
  disabled = false,
  agentId,
  agentName,
  className
}: StepManagerProps) {
  
  // Step management hook
  const {
    steps,
    isLoading,
    error,
    validationErrors,
    isValid,
    addStep,
    updateStep,
    deleteStep,
    reorderSteps
  } = useTaskSteps({
    taskId,
    initialSteps,
    onStepsChange,
    validateSteps: true
  });

  // Local UI state
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [draggedStep, setDraggedStep] = useState<string | null>(null);
  const [showStepEditor, setShowStepEditor] = useState(false);
  const [stepToEdit, setStepToEdit] = useState<any>(null);

  // Notify parent of validation changes
  useEffect(() => {
    onValidationChange?.(isValid && steps.length > 0);
  }, [isValid, steps.length, onValidationChange]);

  // Handle step editing
  const handleStepEdit = useCallback((stepId: string | null) => {
    if (stepId === 'new') {
      setStepToEdit(null);
      setShowStepEditor(true);
    } else if (stepId) {
      const step = steps.find(s => s.id === stepId);
      setStepToEdit(step);
      setShowStepEditor(true);
    } else {
      setEditingStep(null);
      setShowStepEditor(false);
      setStepToEdit(null);
    }
  }, [steps]);

  // Handle step save from editor
  const handleStepSave = useCallback(async (stepData: TaskStepFormData) => {
    try {
      if (stepToEdit) {
        // Update existing step
        await updateStep(stepToEdit.id, stepData);
      } else {
        // Add new step
        await addStep(stepData);
      }
      setShowStepEditor(false);
      setStepToEdit(null);
    } catch (err) {
      console.error('Failed to save step:', err);
    }
  }, [stepToEdit, updateStep, addStep]);

  // Handle step update from inline editing
  const handleStepUpdate = useCallback(async (stepId: string, updates: Partial<TaskStepFormData>) => {
    await updateStep(stepId, updates);
    setEditingStep(null);
  }, [updateStep]);

  // Handle step deletion
  const handleStepDelete = useCallback(async (stepId: string) => {
    if (window.confirm('Are you sure you want to delete this step? This action cannot be undone.')) {
      await deleteStep(stepId);
    }
  }, [deleteStep]);

  // Handle drag operations
  const handleDragStart = useCallback((stepId: string) => {
    setDraggedStep(stepId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedStep(null);
  }, []);

  // Handle step reordering
  const handleStepReorder = useCallback(async (fromIndex: number, toIndex: number) => {
    await reorderSteps(fromIndex, toIndex);
  }, [reorderSteps]);

  if (disabled) {
    return (
      <Card className={cn("opacity-60", className)}>
        <CardHeader>
          <CardTitle className="text-sm flex items-center">
            <ListOrdered className="h-4 w-4 mr-2" />
            Task Steps (Disabled)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Step management is disabled in this context.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                <ListOrdered className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">Task Steps</CardTitle>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Configure sequential steps for {agentName || 'your agent'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Validation status */}
              {steps.length > 0 && (
                <Badge 
                  variant={isValid ? "default" : "destructive"}
                  className="text-xs"
                >
                  {isValid ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Valid
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Issues
                    </>
                  )}
                </Badge>
              )}
              
              {/* Step count */}
              <Badge variant="outline" className="text-xs">
                {steps.length} {steps.length === 1 ? 'step' : 'steps'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {/* Quick stats */}
          {steps.length > 0 && (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">Context Enabled</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {steps.filter(s => s.include_previous_context).length}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Validation Issues</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {Object.keys(validationErrors).length}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Characters</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {steps.reduce((acc, s) => acc + s.instructions.length, 0)}
                </p>
              </div>
            </div>
          )}
          
          {/* Error display */}
          {error && (
            <div className="mt-4 flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700">
                <p className="font-medium mb-1">Error</p>
                <p>{error}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading state */}
      {isLoading && (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center space-x-3">
              <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Loading task steps...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step list */}
      {!isLoading && steps.length > 0 && (
        <StepList
          steps={steps}
          editingStep={editingStep}
          draggedStep={draggedStep}
          validationErrors={validationErrors}
          onStepUpdate={handleStepUpdate}
          onStepDelete={handleStepDelete}
          onStepEdit={handleStepEdit}
          onStepReorder={handleStepReorder}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      )}
      
      {/* Empty state for new tasks */}
      {!isLoading && steps.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-4">
              <ListOrdered className="h-8 w-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No Steps Added Yet
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
              Break down your task into sequential steps. Each step can have its own instructions and optionally receive context from the previous step.
            </p>
            <Button
              onClick={() => handleStepEdit('new')}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First Step
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step Editor Modal */}
      <StepEditor
        step={stepToEdit}
        isOpen={showStepEditor}
        onSave={handleStepSave}
        onCancel={() => {
          setShowStepEditor(false);
          setStepToEdit(null);
        }}
        previousStepResult={
          stepToEdit && stepToEdit.step_order > 1 
            ? steps.find(s => s.step_order === stepToEdit.step_order - 1)?.execution_result
            : undefined
        }
      />

      {/* Help text */}
      {steps.length > 0 && (
        <Card className="bg-blue-50/50 border-blue-200">
          <CardContent className="py-3">
            <div className="flex items-start space-x-2">
              <ListOrdered className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700">
                <p className="font-medium mb-1">💡 Pro Tips:</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li>Drag steps to reorder them</li>
                  <li>Enable context to pass results between steps</li>
                  <li>Use clear, specific instructions for each step</li>
                  <li>Test your workflow with simple steps first</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
