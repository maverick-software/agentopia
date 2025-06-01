import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  ChevronDown,
  ChevronRight,
  Layers,
  Edit2,
  Plus,
  Check,
  X,
  Trash2
} from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import type { 
  UnifiedWorkflowStage, 
  UnifiedWorkflowTask, 
  UnifiedWorkflowStep, 
  UnifiedWorkflowElement 
} from '@/types/unified-workflow';
import { DescriptionToggle } from '@/components/workflow/description';

type HierarchyLevel = 'template' | 'stage' | 'task' | 'step' | 'element';

interface StageCardProps {
  stage: UnifiedWorkflowStage;
  tasks: UnifiedWorkflowTask[];
  steps: UnifiedWorkflowStep[];
  elements: UnifiedWorkflowElement[];
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onTaskSelect: (taskId: string) => void;
  onStepSelect: (stepId: string) => void;
  onElementSelect: (elementId: string) => void;
  selectedItemId: string | null;
  activeLevel: HierarchyLevel;
  expandedItems: Set<string>;
  TaskCard: React.ComponentType<any>;
  StepCard: React.ComponentType<any>;
  onStageUpdate?: (stageId: string, updates: Partial<UnifiedWorkflowStage>) => void;
  onStageDelete?: (stageId: string) => void;
  onAddTask?: (stageId: string) => void;
  onAddStep?: (taskId: string) => void;
  onToggleTaskExpansion?: (taskId: string) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<UnifiedWorkflowTask>) => void;
  onTaskDelete?: (taskId: string) => void;
  onStepUpdate?: (stepId: string, updates: Partial<UnifiedWorkflowStep>) => void;
  onStepDelete?: (stepId: string) => void;
  CollapsibleTaskCard: React.ComponentType<any>;
}

export const StageCard: React.FC<StageCardProps> = ({
  stage,
  tasks,
  steps,
  elements,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  onTaskSelect,
  onStepSelect,
  onElementSelect,
  selectedItemId,
  activeLevel,
  expandedItems,
  TaskCard,
  StepCard,
  onStageUpdate,
  onStageDelete,
  onAddTask,
  onAddStep,
  onToggleTaskExpansion,
  onTaskUpdate,
  onTaskDelete,
  onStepUpdate,
  onStepDelete,
  CollapsibleTaskCard
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(stage.name);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(stage.description || '');

  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stage.id}`,
  });

  const stageTasks = tasks.filter(task => task.stage_id === stage.id);

  const handleNameSave = () => {
    if (editedName.trim() && editedName !== stage.name && onStageUpdate) {
      onStageUpdate(stage.id, { name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setEditedName(stage.name);
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
    if (onStageUpdate) {
      onStageUpdate(stage.id, { description });
    }
  };

  const handleDescriptionEdit = () => {
    setEditedDescription(stage.description || '');
    setIsEditingDescription(true);
  };

  const handleDescriptionSave = () => {
    if (onStageUpdate) {
      onStageUpdate(stage.id, { description: editedDescription.trim() });
    }
    setIsEditingDescription(false);
  };

  const handleDescriptionCancel = () => {
    setEditedDescription(stage.description || '');
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
      className={`transition-all group ${
        isSelected && activeLevel === 'stage' ? 'ring-2 ring-primary' : ''
      } ${isOver ? 'ring-2 ring-green-500 bg-green-50/50' : ''}`}
    >
      <CardHeader 
        className="cursor-pointer"
        onClick={(e) => {
          // Clicking anywhere on the header toggles the card
          onToggle();
          // Also select the card
          onSelect();
        }}
      >
        <CardTitle className="flex items-center justify-between">
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
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <Layers className="h-4 w-4 text-muted-foreground" />
            {isEditingName ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  className="h-8 text-lg font-semibold"
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
                  <span 
                    className="cursor-pointer hover:text-primary transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingName(true);
                    }}
                  >
                    {stage.name}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {onStageDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(
                    `Delete stage "${stage.name}"?\n\nThis will permanently delete:\n• The stage\n• All ${stageTasks.length} tasks in this stage\n• All steps in those tasks\n• All elements in those steps\n\nThis action cannot be undone.`
                  )) {
                    onStageDelete(stage.id);
                  }
                }}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                title="Delete Stage"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardTitle>
        
        {/* Description area - separate from title */}
        {!isEditingDescription && (
          <div className="px-4 pb-2 -mt-4">
            {stage.description ? (
              <div 
                className="text-xs text-muted-foreground/80 cursor-pointer hover:text-foreground transition-colors ml-6"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDescriptionEdit();
                }}
              >
                {stage.description}
              </div>
            ) : (
              <div 
                className="text-xs text-muted-foreground/50 italic cursor-pointer hover:text-muted-foreground transition-colors ml-6"
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
              placeholder="Add a stage description..."
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
      
      {isExpanded && (
        <CardContent>
          <div className="space-y-4">
            {/* Tasks Section */}
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Tasks</span>
              {onAddTask && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddTask(stage.id)}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Task
                </Button>
              )}
            </div>

            {stageTasks.length > 0 ? (
              stageTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  steps={steps.filter(step => step.task_id === task.id)}
                  elements={elements}
                  isExpanded={expandedItems.has(task.id)}
                  isSelected={selectedItemId === task.id && activeLevel === 'task'}
                  onToggle={() => onToggleTaskExpansion?.(task.id)}
                  onSelect={() => onTaskSelect(task.id)}
                  onStepSelect={onStepSelect}
                  onElementSelect={onElementSelect}
                  selectedItemId={selectedItemId}
                  activeLevel={activeLevel}
                  StepCard={StepCard}
                  onAddStep={onAddStep}
                  onTaskUpdate={onTaskUpdate}
                  onTaskDelete={onTaskDelete}
                  onStepUpdate={onStepUpdate}
                  onStepDelete={onStepDelete}
                />
              ))
            ) : (
              <div className="p-4 border-2 border-dashed border-muted-foreground/20 rounded-lg text-center text-sm text-muted-foreground">
                <p className="mb-2">No tasks in this stage yet.</p>
                {onAddTask && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddTask(stage.id)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add First Task
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