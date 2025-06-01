import React, { useState } from 'react';
import { Control } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormControl, FormField } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, User } from 'lucide-react';
import { DatePicker } from '@/components/admin/project-templates/inputs/DatePicker';

export interface TaskRowProps {
  task: any;
  taskIndex: number;
  stageIndex: number;
  control: Control<any>;
  onRemove: () => void;
  isNewTask?: boolean;
}

const PRIORITY_OPTIONS = [
  { value: 'NONE', label: 'None', color: 'text-muted-foreground' },
  { value: 'LOW', label: 'Low', color: 'text-blue-600' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-yellow-600' },
  { value: 'HIGH', label: 'High', color: 'text-red-600' },
];

export const TaskRow: React.FC<TaskRowProps> = ({ 
  task, 
  taskIndex, 
  stageIndex, 
  control, 
  onRemove, 
  isNewTask = false 
}) => {
  const [isEditing, setIsEditing] = useState(isNewTask || !task.name);

  const formatDisplayDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <tr className="border-b border-border hover:bg-muted/50 group transition-colors duration-200">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {/* Static checkbox for visual consistency - functionality added when project is created from template */}
          <div className="w-4 h-4 rounded border border-border bg-muted/20"></div>
          {isEditing ? (
            <FormField
              control={control}
              name={`stages.${stageIndex}.tasks.${taskIndex}.name`}
              render={({ field }) => (
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ''}
                    placeholder="Enter task name..."
                    className="text-sm border-none shadow-none p-0 h-auto bg-transparent text-foreground"
                    autoFocus
                    onBlur={() => {
                      if (field.value && field.value.trim()) {
                        setIsEditing(false);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && field.value && field.value.trim()) {
                        setIsEditing(false);
                      }
                      if (e.key === 'Escape') {
                        setIsEditing(false);
                      }
                    }}
                  />
                </FormControl>
              )}
            />
          ) : (
            <span 
              className="text-sm cursor-pointer hover:text-primary transition-colors duration-200"
              onClick={() => setIsEditing(true)}
            >
              {task.name || 'Untitled Task'}
            </span>
          )}
        </div>
      </td>
      <td className="py-3 px-4">
        <FormField
          control={control}
          name={`stages.${stageIndex}.tasks.${taskIndex}.default_assignee_role`}
          render={({ field }) => (
            <FormControl>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <Input
                  {...field}
                  value={field.value || ''}
                  placeholder="e.g., Developer"
                  className="text-sm border-none shadow-none p-0 h-auto bg-transparent text-muted-foreground placeholder:text-muted-foreground hover:text-foreground focus:text-foreground transition-colors duration-200"
                />
              </div>
            </FormControl>
          )}
        />
      </td>
      <td className="py-3 px-4">
        <FormField
          control={control}
          name={`stages.${stageIndex}.tasks.${taskIndex}.due_date`}
          render={({ field }) => (
            <FormControl>
              <div className="w-40">
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select date"
                  className="text-sm"
                />
              </div>
            </FormControl>
          )}
        />
      </td>
      <td className="py-3 px-4">
        <FormField
          control={control}
          name={`stages.${stageIndex}.tasks.${taskIndex}.priority`}
          render={({ field }) => (
            <FormControl>
              <Select value={field.value || 'NONE'} onValueChange={(value) => field.onChange(value === 'NONE' ? null : value)}>
                <SelectTrigger className="w-24 h-8 text-xs border-none shadow-none bg-transparent">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className={option.color}>{option.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
          )}
        />
      </td>
      <td className="py-3 px-4">
        <FormField
          control={control}
          name={`stages.${stageIndex}.tasks.${taskIndex}.estimated_duration_hours`}
          render={({ field }) => (
            <FormControl>
              <Badge variant="secondary" className="text-xs cursor-pointer">
                <Input
                  {...field}
                  value={field.value || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    field.onChange(value === '' ? null : Number(value));
                  }}
                  placeholder="0"
                  className="w-8 text-xs border-none shadow-none p-0 h-auto bg-transparent text-center"
                  type="number"
                  min="0"
                  step="0.5"
                />
                h
              </Badge>
            </FormControl>
          )}
        />
      </td>
      <td className="py-3 px-4">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}; 