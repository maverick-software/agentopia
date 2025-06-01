import React from 'react';
import { Control } from 'react-hook-form';
import { Textarea } from '@/components/ui/textarea';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export interface TemplateDescriptionFormProps {
  control: Control<any>;
}

export const TemplateDescriptionForm: React.FC<TemplateDescriptionFormProps> = ({
  control
}) => {
  return (
    <div className="mb-6">
      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-foreground">Description</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                value={field.value || ''}
                placeholder="Describe what this template is for and when to use it..."
                className="min-h-[60px] bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}; 