import React from 'react';
import { Control } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { StageRow } from './StageRow';

export interface TemplateTableProps {
  control: Control<any>;
  stageFields: any[];
  removeStage: (index: number) => void;
  appendStage: (stage: any) => void;
  addTaskToStage: (stageIndex: number) => void;
  getTaskFields: (stageIndex: number) => any[];
  removeTaskFromStage: (stageIndex: number, taskIndex: number) => void;
}

export const TemplateTable: React.FC<TemplateTableProps> = ({
  control,
  stageFields,
  removeStage,
  appendStage,
  addTaskToStage,
  getTaskFields,
  removeTaskFromStage
}) => {
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted border-b border-border">
          <tr>
            <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Name
            </th>
            <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Assignee
            </th>
            <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Due date
            </th>
            <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Priority
            </th>
            <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Estimated Hours
            </th>
            <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {stageFields.map((stageField, stageIndex) => (
            <StageRow
              key={stageField.id}
              stage={stageField}
              stageIndex={stageIndex}
              control={control}
              onRemove={() => removeStage(stageIndex)}
              onAddTask={() => addTaskToStage(stageIndex)}
              taskFields={getTaskFields(stageIndex)}
              removeTask={(taskIndex) => removeTaskFromStage(stageIndex, taskIndex)}
            />
          ))}
          {stageFields.length === 0 && (
            <tr>
              <td colSpan={6} className="py-12 px-4 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-3">
                  <div className="text-sm">No stages yet</div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => appendStage({ 
                      name: 'New Stage', 
                      description: '', 
                      order: 0, 
                      tasks: [] 
                    })}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add your first stage
                  </Button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}; 