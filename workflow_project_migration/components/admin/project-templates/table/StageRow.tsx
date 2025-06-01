import React, { useState } from 'react';
import { Control } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormControl, FormField } from '@/components/ui/form';
import { ChevronDown, ChevronRight, PlusCircle, Trash2 } from 'lucide-react';
import { TaskRow } from './TaskRow';

export interface StageRowProps {
  stage: any;
  stageIndex: number;
  control: Control<any>;
  onRemove: () => void;
  onAddTask: () => void;
  taskFields: any[];
  removeTask: (index: number) => void;
}

export const StageRow: React.FC<StageRowProps> = ({ 
  stage, 
  stageIndex, 
  control, 
  onRemove, 
  onAddTask, 
  taskFields, 
  removeTask
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditingName, setIsEditingName] = useState(!stage.name);
  const [newTaskIds] = useState<Set<string>>(new Set());

  const handleAddTask = () => {
    onAddTask();
  };

  const handleRemoveTask = (taskIndex: number) => {
    removeTask(taskIndex);
  };

  return (
    <>
      {/* Stage Header Row */}
      <tr className="bg-muted/30 border-b border-border">
        <td colSpan={6} className="py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 w-6 p-0"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
              {isEditingName ? (
                <FormField
                  control={control}
                  name={`stages.${stageIndex}.name`}
                  render={({ field }) => (
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        placeholder="Stage name"
                        className="text-sm font-medium border-none shadow-none p-0 h-auto bg-transparent"
                        autoFocus
                        onBlur={() => {
                          if (field.value && field.value.trim()) {
                            setIsEditingName(false);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && field.value && field.value.trim()) {
                            setIsEditingName(false);
                          }
                          if (e.key === 'Escape') {
                            setIsEditingName(false);
                          }
                        }}
                      />
                    </FormControl>
                  )}
                />
              ) : (
                <span 
                  className="text-sm font-medium cursor-pointer hover:text-primary transition-colors duration-200"
                  onClick={() => setIsEditingName(true)}
                >
                  {stage.name || 'Untitled Stage'}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                ({taskFields.length} task{taskFields.length !== 1 ? 's' : ''})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddTask}
                className="h-6 px-2 text-xs"
              >
                <PlusCircle className="h-3 w-3 mr-1" />
                Add task
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </td>
      </tr>
      
      {/* Tasks */}
      {isExpanded && taskFields.map((taskField, taskIndex) => {
        const isNewTask = newTaskIds.has(taskField.id);
        return (
          <TaskRow
            key={taskField.id}
            task={taskField}
            taskIndex={taskIndex}
            stageIndex={stageIndex}
            control={control}
            onRemove={() => handleRemoveTask(taskIndex)}
            isNewTask={isNewTask}
          />
        );
      })}
      
      {/* Empty state for stage with no tasks */}
      {isExpanded && taskFields.length === 0 && (
        <tr>
          <td colSpan={6} className="py-6 px-4 text-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm">No tasks in this stage</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTask}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add first task
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}; 