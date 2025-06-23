import React from 'react';
import { Control } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { AlertCircle, Save } from 'lucide-react';

export interface TemplateHeaderProps {
  control: Control<any>;
  isDirty: boolean;
  isLoading: boolean;
  ProtectedLink: React.FC<{ to: string; children: React.ReactNode; className?: string }>;
}

export const TemplateHeader: React.FC<TemplateHeaderProps> = ({
  control,
  isDirty,
  isLoading,
  ProtectedLink
}) => {
  return (
    <div className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">T</span>
            </div>
            <FormField
              control={control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <FormControl>
                    <Input
                      {...field}
                      className="text-lg font-semibold border-none shadow-none p-0 h-auto bg-transparent text-foreground"
                      placeholder="Template Name"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {isDirty && (
              <div className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs">Unsaved changes</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProtectedLink to="/admin/project-templates">
            <Button variant="outline" type="button">Cancel</Button>
          </ProtectedLink>
          <Button 
            type="submit" 
            disabled={isLoading || !isDirty}
            className={isDirty ? "bg-primary hover:bg-primary/90" : ""}
          >
            {isLoading ? 'Saving...' : 'Save'}
            {isDirty && !isLoading && <Save className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}; 