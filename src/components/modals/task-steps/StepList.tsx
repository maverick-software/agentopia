import React, { useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { StepCard } from './StepCard';
import { Button } from '@/components/ui/button';
import { Plus, ListOrdered } from 'lucide-react';
import { StepListProps } from '@/types/tasks';
import { cn } from '@/lib/utils';

export function StepList({
  steps,
  editingStep,
  draggedStep,
  validationErrors,
  onStepUpdate,
  onStepDelete,
  onStepEdit,
  onStepReorder,
  onDragStart,
  onDragEnd
}: StepListProps) {

  // Handle drag end
  const handleDragEnd = useCallback((result: DropResult) => {
    onDragEnd();
    
    if (!result.destination) return;
    
    const fromIndex = result.source.index;
    const toIndex = result.destination.index;
    
    if (fromIndex === toIndex) return;
    
    onStepReorder(fromIndex, toIndex);
  }, [onStepReorder, onDragEnd]);

  // Handle drag start
  const handleDragStart = useCallback((start: any) => {
    const stepId = start.draggableId;
    onDragStart(stepId);
  }, [onDragStart]);

  // Empty state
  if (steps.length === 0) {
    return (
      <div className="text-center py-12 px-6">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-4">
          <ListOrdered className="h-8 w-8 text-purple-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          No Steps Added Yet
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
          Break down your task into sequential steps. Each step can have its own instructions and optionally receive context from the previous step.
        </p>
        <Button
          onClick={() => onStepEdit('new')}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add First Step
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Steps header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ListOrdered className="h-5 w-5 text-purple-600" />
          <h4 className="font-medium text-gray-900 dark:text-gray-100">
            Task Steps ({steps.length})
          </h4>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStepEdit('new')}
          className="text-purple-600 border-purple-200 hover:bg-purple-50"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Step
        </Button>
      </div>

      {/* Drag and drop step list */}
      <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
        <Droppable droppableId="steps-list" type="STEP">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={cn(
                "space-y-3 min-h-[100px] p-2 rounded-lg transition-colors",
                snapshot.isDraggingOver && "bg-blue-50 border-2 border-dashed border-blue-300"
              )}
            >
              {steps.map((step, index) => (
                <Draggable
                  key={step.id}
                  draggableId={step.id}
                  index={index}
                  isDragDisabled={editingStep !== null}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={cn(
                        "transition-transform duration-200",
                        snapshot.isDragging && "z-50"
                      )}
                    >
                      <StepCard
                        step={step}
                        isEditing={editingStep === step.id}
                        isDragging={snapshot.isDragging}
                        validationErrors={validationErrors[step.id] || []}
                        onEdit={() => onStepEdit(step.id)}
                        onSave={(updates) => onStepUpdate(step.id, updates)}
                        onCancel={() => onStepEdit(null)}
                        onDelete={() => onStepDelete(step.id)}
                        onContextToggle={(enabled) => 
                          onStepUpdate(step.id, { include_previous_context: enabled })
                        }
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              
              {/* Drop zone indicator */}
              {snapshot.isDraggingOver && (
                <div className="border-2 border-dashed border-blue-400 bg-blue-100/50 rounded-lg p-4 text-center">
                  <p className="text-sm text-blue-600 font-medium">
                    Drop step here to reorder
                  </p>
                </div>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Validation summary */}
      {Object.keys(validationErrors).length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <ListOrdered className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-800 mb-1">
                Step Validation Issues
              </p>
              <p className="text-xs text-yellow-700">
                {Object.keys(validationErrors).length} step(s) need attention before the task can be saved.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Steps summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Total Steps: {steps.length}</span>
          <span>
            Context Enabled: {steps.filter(s => s.include_previous_context).length}
          </span>
        </div>
      </div>
    </div>
  );
}
