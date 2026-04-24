import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Eye, 
  ToggleRight,
  Edit3,
  HelpCircle,
} from 'lucide-react';
import { StepEditorProps, TaskStepFormData } from '@/types/tasks';
import { cn } from '@/lib/utils';
import { MediaLibrarySelector } from '@/components/modals/MediaLibrarySelector';
import { AttachmentsPanel } from './step-editor/AttachmentsPanel';
import { FooterPanels } from './step-editor/FooterPanels';
import { AttachedFile } from './step-editor/types';
import { validateStepEditorForm } from './step-editor/validation';

export function StepEditor({
  step,
  isOpen,
  onSave,
  onCancel,
  previousStepResult,
  existingStepNames = []
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
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showGuidelinesHelp, setShowGuidelinesHelp] = useState(false);
  const [showContextHelp, setShowContextHelp] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Initialize form when step changes
  useEffect(() => {
    if (step) {
      setFormData({
        step_name: step.display_name || step.step_name,
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
    setShowValidationErrors(false);
  }, [step, isOpen]);

  // Form validation
  const validateForm = useCallback((): string[] => {
    return validateStepEditorForm({ formData, stepOrder: step?.step_order });
  }, [formData, step]);

  // Handle form submission
  const handleSave = useCallback(async () => {
    const errors = validateForm();
    setValidationErrors(errors);
    setShowValidationErrors(true); // Only show errors when user tries to save
    
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
    setShowValidationErrors(false);
    setShowContextPreview(false);
    onCancel();
  }, [onCancel]);

  // Clear validation errors when user makes changes (with debounce)
  useEffect(() => {
    if (showValidationErrors) {
      const timer = setTimeout(() => {
        // Only clear if user has made some progress on both fields
        const hasStepName = formData.step_name.trim().length > 0;
        const hasInstructions = formData.instructions.trim().length >= 5;
        
        if (hasStepName && hasInstructions) {
          setShowValidationErrors(false);
          setValidationErrors([]);
        }
      }, 1000); // 1 second delay to avoid flashing
      
      return () => clearTimeout(timer);
    }
  }, [formData.step_name, formData.instructions, showValidationErrors]);

  const isEditing = !!step;
  const canShowContextPreview = previousStepResult && formData.include_previous_context;

  // File handling functions
  const handleFileUpload = async (files: File[]) => {
    setIsUploading(true);
    try {
      // TODO: Implement actual file upload to media library
      // For now, simulate the upload
      const newFiles = files.map(file => ({
        id: `temp-${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file)
      }));
      
      setAttachedFiles(prev => [...prev, ...newFiles]);
    } catch (error) {
      console.error('File upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const handleAttachFromLibrary = (libraryFiles: any[]) => {
    const newFiles = libraryFiles.map(file => ({
      id: file.id,
      name: file.name || file.display_name || file.file_name,
      size: file.size || file.file_size || 0,
      type: file.type || file.file_type || '',
      url: file.url || file.file_url
    }));
    
    setAttachedFiles(prev => [...prev, ...newFiles]);
    setShowMediaLibrary(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent 
        className={cn(
          "sm:max-w-[900px] max-h-[85vh] overflow-y-auto",
          "bg-background dark:bg-background border border-border dark:border-border",
          "!rounded-2xl"
        )}
        style={{ borderRadius: '1rem' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {isEditing ? (
              <>
                <Edit3 className="h-5 w-5 text-blue-600" />
                <span>Edit Step {step?.step_order}</span>
              </>
            ) : (
              <span>New Step</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGuidelinesHelp(!showGuidelinesHelp)}
              className="p-1 h-6 w-6 ml-2"
              title="Step Guidelines"
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </Button>
          </DialogTitle>
          
          <DialogDescription>
            {isEditing 
              ? 'Modify the step name, instructions, and context settings.'
              : 'Create a new step with specific instructions for your agent.'
            }
          </DialogDescription>
          
          {/* Guidelines Help Tooltip */}
          {showGuidelinesHelp && (
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 mt-2 rounded-lg">
              <CardContent className="p-3">
                <h4 className="text-sm font-medium text-foreground mb-2 flex items-center">
                  <Edit3 className="h-4 w-4 mr-2 text-blue-600" />
                  Step Guidelines
                </h4>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• Be specific about what the agent should accomplish</li>
                  <li>• Include any necessary context or parameters</li>
                  <li>• Consider what information might be needed from previous steps</li>
                  <li>• Use clear, actionable language</li>
                </ul>
              </CardContent>
            </Card>
          )}
          

        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-3">
          {/* Left Column - Instructions */}
          <div className="space-y-4">
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
                className="text-sm rounded-lg"
                maxLength={100}
              />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  A brief, descriptive name for this step
                </span>
                <span className={cn(
                  "text-muted-foreground",
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
                className="text-sm min-h-[200px] resize-y rounded-lg"
                maxLength={5000}
              />
              <div className="flex justify-end text-xs">
                <span className={cn(
                  "text-muted-foreground",
                  formData.instructions.length > 4000 && "text-yellow-600",
                  formData.instructions.length > 4800 && "text-red-600"
                )}>
                  {formData.instructions.length}/5000
                </span>
              </div>
            </div>

            {/* Include Previous Context - moved below instructions */}
            {(!step || step.step_order > 1) && (
              <div className="flex items-center justify-between p-4 bg-muted/30 dark:bg-muted/30 rounded-lg border border-border dark:border-border">
                <div className="flex items-center space-x-3">
                  <Label className="text-sm font-medium text-foreground">
                    Include Previous Context
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowContextHelp(!showContextHelp)}
                    className="p-1 h-6 w-6"
                    title="Context Help"
                  >
                    <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </Button>
                </div>
                
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setFormData(prev => ({ 
                    ...prev, 
                    include_previous_context: !prev.include_previous_context 
                  }))}
                  className="p-1 h-8 w-14 rounded-full"
                >
                  <div className={cn(
                    "relative inline-flex h-6 w-12 items-center rounded-full transition-colors",
                    formData.include_previous_context 
                      ? "bg-blue-600" 
                      : "bg-gray-300 dark:bg-gray-600"
                  )}>
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        formData.include_previous_context ? "translate-x-7" : "translate-x-1"
                      )}
                    />
                  </div>
                </Button>
              </div>
            )}

            {/* Context Help Tooltip */}
            {showContextHelp && (
              <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 rounded-lg">
                <CardContent className="p-3">
                  <h4 className="text-sm font-medium text-foreground mb-2 flex items-center">
                    <ToggleRight className="h-4 w-4 mr-2 text-green-600" />
                    Previous Context
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    When enabled, this step will receive the output/results from the previous step as additional context. 
                    This is useful when steps need to build upon each other or when the current step needs data from the previous step's execution.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - File Attachments */}
          <div className="space-y-4">
            <AttachmentsPanel
              attachedFiles={attachedFiles}
              isUploading={isUploading}
              isSaving={isSaving}
              onUploadFiles={handleFileUpload}
              onOpenLibrary={() => setShowMediaLibrary(true)}
              onRemoveFile={handleRemoveFile}
              onCancel={handleCancel}
              onSave={handleSave}
              isEditing={isEditing}
            />
          </div>
        </div>

        <FooterPanels
          canShowContextPreview={canShowContextPreview}
          previousStepResult={previousStepResult}
          showContextPreview={showContextPreview}
          onToggleContextPreview={() => setShowContextPreview(!showContextPreview)}
          showValidationErrors={showValidationErrors}
          validationErrors={validationErrors}
        />
      </DialogContent>

      {/* Media Library Selector Modal */}
      {showMediaLibrary && (
        <MediaLibrarySelector
          isOpen={showMediaLibrary}
          onClose={() => setShowMediaLibrary(false)}
          onSelect={handleAttachFromLibrary}
          multiple={true}
          title="Attach Files from Media Library"
          description="Select files from your media library to attach to this step."
        />
      )}
    </Dialog>
  );
}
