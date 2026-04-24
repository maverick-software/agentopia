import { TaskStepFormData } from '@/types/tasks';

interface ValidateOptions {
  formData: TaskStepFormData;
  stepOrder?: number;
}

export const validateStepEditorForm = ({ formData, stepOrder }: ValidateOptions): string[] => {
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

  if (formData.include_previous_context && stepOrder === 1) {
    errors.push('First step cannot include previous context');
  }

  return errors;
};
