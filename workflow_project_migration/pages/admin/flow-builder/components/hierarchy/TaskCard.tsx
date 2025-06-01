import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Edit2,
  Plus,
  Check,
  X,
  Trash2
} from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import type { 
  UnifiedWorkflowTask, 
  UnifiedWorkflowStep, 
  UnifiedWorkflowElement 
} from '@/types/unified-workflow';
import { StepCard } from './StepCard';
import { DescriptionToggle } from '@/components/workflow/description';

type HierarchyLevel = 'template' | 'stage' | 'task' | 'step' | 'element';

interface TaskCardProps {
  task: UnifiedWorkflowTask;
  steps: UnifiedWorkflowStep[];
  elements: UnifiedWorkflowElement[];
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onStepSelect: (stepId: string) => void;
  onElementSelect: (elementId: string) => void;
  selectedItemId: string | null;
  activeLevel: HierarchyLevel;
  StepCard?: React.ComponentType<any>;
  onTaskUpdate?: (taskId: string, updates: Partial<UnifiedWorkflowTask>) => void;
  onTaskDelete?: (taskId: string) => void;
  onAddStep?: (taskId: string) => void;
  onStepUpdate?: (stepId: string, updates: Partial<UnifiedWorkflowStep>) => void;
  onStepDelete?: (stepId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  steps,
  elements,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  onStepSelect,
  onElementSelect,
  selectedItemId,
  activeLevel,
  StepCard,
  onTaskUpdate,
  onTaskDelete,
  onAddStep,
  onStepUpdate,
  onStepDelete
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(task.name);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(task.description || '');

  const { setNodeRef, isOver } = useDroppable({
    id: `task-${task.id}`,
  });

  const handleNameEdit = () => {
    setEditName(task.name);
    setIsEditingName(true);
  };

  const handleNameSave = () => {
    if (editName.trim() && editName !== task.name && onTaskUpdate) {
      onTaskUpdate(task.id, { name: editName.trim() });
    }
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setEditName(task.name);
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      handleNameCancel();
    }
  };

  const handleDescriptionUpdate = (description: string) => {
    if (onTaskUpdate) {
      onTaskUpdate(task.id, { description });
    }
  };

  const handleDescriptionEdit = () => {
    setEditedDescription(task.description || '');
    setIsEditingDescription(true);
  };

  const handleDescriptionSave = () => {
    if (onTaskUpdate) {
      onTaskUpdate(task.id, { description: editedDescription.trim() });
    }
    setIsEditingDescription(false);
  };

  const handleDescriptionCancel = () => {
    setEditedDescription(task.description || '');
    setIsEditingDescription(false);
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleDescriptionSave();
    } else if (e.key === 'Escape') {
      handleDescriptionCancel();
    }
  };

  return (
    <Card 
      ref={setNodeRef}
      className={`ml-6 transition-all group ${
        isSelected && activeLevel === 'task' ? 'ring-2 ring-primary' : ''
      } ${isOver ? 'ring-2 ring-blue-500 bg-blue-50/50' : ''}`}
    >
      <CardHeader 
        className="cursor-pointer py-3"
        onClick={(e) => {
          // Clicking anywhere on the header toggles the card
          onToggle();
          // Also select the card
          onSelect();
        }}
      >
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2 flex-1">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center justify-center h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                // Arrow always toggles the card state
                onToggle();
              }}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
            <CheckSquare className="h-3 w-3 text-muted-foreground" />
            {isEditingName ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  className="h-8 text-base font-medium"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleNameSave}
                  className="h-8 w-8 p-0"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNameCancel}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <h4 
                    className="text-base font-medium cursor-pointer hover:text-primary transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNameEdit();
                    }}
                  >
                    {task.name}
                  </h4>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {onTaskDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(
                    `Delete task "${task.name}"?\n\nThis will permanently delete:\n• The task\n• All ${steps.length} steps in this task\n• All elements in those steps\n\nThis action cannot be undone.`
                  )) {
                    onTaskDelete(task.id);
                  }
                }}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                title="Delete Task"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardTitle>
        
        {/* Description area - separate from title */}
        {!isEditingDescription && (
          <div className="px-4 pb-2 -mt-4">
            {task.description ? (
              <div 
                className="text-xs text-muted-foreground/80 cursor-pointer hover:text-foreground transition-colors ml-5"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDescriptionEdit();
                }}
              >
                {task.description}
              </div>
            ) : (
              <div 
                className="text-xs text-muted-foreground/50 italic cursor-pointer hover:text-muted-foreground transition-colors ml-5"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDescriptionEdit();
                }}
              >
                Add a description here
              </div>
            )}
          </div>
        )}
        
        {isEditingDescription && (
          <div className="px-4 pb-2 space-y-2">
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              onKeyDown={handleDescriptionKeyDown}
              placeholder="Add a task description..."
              className="min-h-[100px] max-h-[200px] resize-y w-full text-sm"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleDescriptionSave}
                className="h-7"
              >
                <Check className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDescriptionCancel}
                className="h-7"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
              <span className="text-xs text-muted-foreground">
                Ctrl+Enter to save, Esc to cancel
              </span>
            </div>
          </div>
        )}
      </CardHeader>
      
      {isExpanded && StepCard && (
        <CardContent className="py-3">
          <div className="space-y-2">
            {/* Steps Section */}
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-muted-foreground">Steps</span>
              {onAddStep && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddStep(task.id)}
                  className="h-6 text-xs"
                >
                  <Plus className="h-2.5 w-2.5 mr-1" />
                  Add Step
                </Button>
              )}
            </div>

            {steps.length > 0 ? (
              steps.map(step => (
                <StepCard
                  key={step.id}
                  step={step}
                  elements={elements.filter(el => el.step_id === step.id)}
                  isSelected={selectedItemId === step.id && activeLevel === 'step'}
                  onSelect={() => onStepSelect(step.id)}
                  onElementSelect={onElementSelect}
                  selectedElementId={activeLevel === 'element' ? selectedItemId : null}
                  onStepUpdate={onStepUpdate}
                  onStepDelete={onStepDelete}
                />
              ))
            ) : (
              <div className="p-3 border-2 border-dashed border-muted-foreground/20 rounded-lg text-center text-xs text-muted-foreground">
                <p className="mb-2">No steps in this task yet.</p>
                {onAddStep && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddStep(task.id)}
                    className="h-6 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add First Step
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}; 