import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Save, 
  X, 
  AlertCircle, 
  Eye, 
  ToggleLeft, 
  ToggleRight,
  Edit3,
  Plus,
  Loader2
} from 'lucide-react';
import { StepEditorProps, TaskStepFormData } from '@/types/tasks';
import { cn } from '@/lib/utils';

export function StepEditor({
  step,
  isOpen,
  onSave,
  onCancel,
  previousStepResult
}: StepEditorProps) {
  
  // Form state
  const [formData, setFormData] = useState<TaskStepFormData>({
    step_name: '',
    instructions: '',
    include_previous_context: false
  });
  
  // UI state
  const [showContextPreview, setShowContextPreview] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when step changes
  useEffect(() => {
    if (step) {
      setFormData({
        step_name: step.step_name,
        instructions: step.instructions,
        include_previous_context: step.include_previous_context
      });
    } else {
      // New step defaults
      setFormData({
        step_name: '',
        instructions: '',
        include_previous_context: false
      });
    }
    setValidationErrors([]);
  }, [step, isOpen]);

  // Form validation
  const validateForm = useCallback((): string[] => {
    const errors: string[] = [];
    
    if (!formData.step_name.trim()) {
      errors.push('Step name is required');
    } else if (formData.step_name.length > 100) {
      errors.push('Step name must be 100 characters or less');
    }
    
    if (!formData.instructions.trim()) {
      errors.push('Instructions are required');
    } else if (formData.instructions.trim().length < 10) {
      errors.push('Instructions must be at least 10 characters');
    } else if (formData.instructions.length > 5000) {
      errors.push('Instructions must be 5000 characters or less');
    }
    
    // Context validation - can't enable context for first step
    if (formData.include_previous_context && step?.step_order === 1) {
      errors.push('First step cannot include previous context');
    }
    
    return errors;
  }, [formData, step]);

  // Handle form submission
  const handleSave = useCallback(async () => {
    const errors = validateForm();
    setValidationErrors(errors);
    
    if (errors.length > 0) {
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave({
        step_name: formData.step_name.trim(),
        instructions: formData.instructions.trim(),
        include_previous_context: formData.include_previous_context
      });
    } catch (err) {
      console.error('Failed to save step:', err);
    } finally {
      setIsSaving(false);
    }
  }, [formData, validateForm, onSave]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setValidationErrors([]);
    setShowContextPreview(false);
    onCancel();
  }, [onCancel]);

  // Real-time validation
  useEffect(() => {
    if (formData.step_name || formData.instructions) {
      const errors = validateForm();
      setValidationErrors(errors);
    }
  }, [formData, validateForm]);

  const isEditing = !!step;
  const canShowContextPreview = previousStepResult && formData.include_previous_context;

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {isEditing ? (
              <>
                <Edit3 className="h-5 w-5 text-blue-600" />
                <span>Edit Step {step?.step_order}</span>
              </>
            ) : (
              <>
                <Plus className="h-5 w-5 text-green-600" />
                <span>Add New Step</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Modify the step name, instructions, and context settings.'
              : 'Create a new step with specific instructions for your agent.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step name field */}
          <div className="space-y-2">
            <Label htmlFor="step_name" className="text-sm font-medium">
              Step Name *
            </Label>
            <Input
              id="step_name"
              value={formData.step_name}
              onChange={(e) => setFormData(prev => ({ ...prev, step_name: e.target.value }))}
              placeholder="e.g., Send welcome email, Process user data..."
              className="text-sm"
              maxLength={100}
            />
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">
                A brief, descriptive name for this step
              </span>
              <span className={cn(
                "text-gray-400",
                formData.step_name.length > 80 && "text-yellow-600",
                formData.step_name.length > 95 && "text-red-600"
              )}>
                {formData.step_name.length}/100
              </span>
            </div>
          </div>

          {/* Instructions field */}
          <div className="space-y-2">
            <Label htmlFor="instructions" className="text-sm font-medium">
              Instructions *
            </Label>
            <Textarea
              id="instructions"
              value={formData.instructions}
              onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
              placeholder="Provide detailed instructions for what the agent should do in this step..."
              className="text-sm min-h-[120px] resize-none"
              maxLength={5000}
            />
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">
                Clear, specific instructions help ensure successful execution
              </span>
              <span className={cn(
                "text-gray-400",
                formData.instructions.length > 4000 && "text-yellow-600",
                formData.instructions.length > 4800 && "text-red-600"
              )}>
                {formData.instructions.length}/5000
              </span>
            </div>
          </div>

          {/* Context toggle (only show if not first step) */}
          {(!step || step.step_order > 1) && (
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Label className="text-sm font-medium text-gray-800">
                        Include Previous Context
                      </Label>
                      {formData.include_previous_context && (
                        <Badge variant="secondary" className="text-xs">
                          Enabled
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">
                      Pass the results from the previous step to this step as additional context
                    </p>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      include_previous_context: !prev.include_previous_context 
                    }))}
                    className="p-2"
                  >
                    {formData.include_previous_context ? (
                      <ToggleRight className="h-6 w-6 text-blue-600" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-gray-400" />
                    )}
                  </Button>
                </div>

                {/* Context preview */}
                {canShowContextPreview && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-medium text-gray-700">
                        Previous Step Result Preview
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowContextPreview(!showContextPreview)}
                        className="h-6 px-2 text-xs"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {showContextPreview ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                    
                    {showContextPreview && (
                      <div className="bg-white border border-blue-200 rounded p-3 max-h-32 overflow-y-auto">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                          {JSON.stringify(previousStepResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800 mb-2">
                      Please fix the following issues:
                    </p>
                    <ul className="space-y-1">
                      {validationErrors.map((error, index) => (
                        <li key={index} className="text-xs text-red-700 flex items-start">
                          <span className="mr-2">•</span>
                          <span>{error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Guidelines */}
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-4">
              <h4 className="text-sm font-medium text-gray-800 mb-2 flex items-center">
                <Edit3 className="h-4 w-4 mr-2 text-gray-600" />
                Step Guidelines
              </h4>
              <ul className="space-y-1 text-xs text-gray-600">
                <li>• Be specific about what the agent should accomplish</li>
                <li>• Include any necessary context or parameters</li>
                <li>• Consider what information might be needed from previous steps</li>
                <li>• Use clear, actionable language</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={validationErrors.length > 0 || isSaving}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEditing ? 'Update Step' : 'Add Step'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
