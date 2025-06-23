import { useState, useCallback } from 'react';

export interface UseDescriptionToggleProps {
  /** Initial description value */
  initialDescription?: string;
  /** Whether the description is initially expanded */
  defaultExpanded?: boolean;
  /** Callback when description is updated */
  onUpdate?: (description: string) => void;
  /** Auto-save delay in milliseconds */
  autoSaveDelay?: number;
}

export interface UseDescriptionToggleReturn {
  /** Current description value */
  description: string;
  /** Whether the description panel is expanded */
  isExpanded: boolean;
  /** Whether the description is currently being edited */
  isEditing: boolean;
  /** Current edit value (may differ from saved description) */
  editValue: string;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Whether the description has content */
  hasDescription: boolean;
  /** Toggle the expanded state */
  toggleExpanded: () => void;
  /** Start editing mode */
  startEditing: () => void;
  /** Save the current edit value */
  saveDescription: () => void;
  /** Cancel editing and revert changes */
  cancelEditing: () => void;
  /** Update the edit value */
  updateEditValue: (value: string) => void;
  /** Set the description directly (for external updates) */
  setDescription: (description: string) => void;
  /** Set the expanded state directly */
  setExpanded: (expanded: boolean) => void;
}

export const useDescriptionToggle = ({
  initialDescription = '',
  defaultExpanded = false,
  onUpdate,
  autoSaveDelay = 1000
}: UseDescriptionToggleProps = {}): UseDescriptionToggleReturn => {
  const [description, setDescriptionState] = useState(initialDescription);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || !!initialDescription);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(initialDescription);

  const hasDescription = !!description.trim();
  const hasUnsavedChanges = editValue.trim() !== description.trim();

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const setExpanded = useCallback((expanded: boolean) => {
    setIsExpanded(expanded);
  }, []);

  const startEditing = useCallback(() => {
    setEditValue(description);
    setIsEditing(true);
  }, [description]);

  const saveDescription = useCallback(() => {
    const trimmedValue = editValue.trim();
    setDescriptionState(trimmedValue);
    setIsEditing(false);
    
    if (onUpdate) {
      onUpdate(trimmedValue);
    }
  }, [editValue, onUpdate]);

  const cancelEditing = useCallback(() => {
    setEditValue(description);
    setIsEditing(false);
  }, [description]);

  const updateEditValue = useCallback((value: string) => {
    setEditValue(value);
  }, []);

  const setDescription = useCallback((newDescription: string) => {
    setDescriptionState(newDescription);
    setEditValue(newDescription);
    // Auto-expand if description is added
    if (newDescription.trim() && !isExpanded) {
      setIsExpanded(true);
    }
  }, [isExpanded]);

  return {
    description,
    isExpanded,
    isEditing,
    editValue,
    hasUnsavedChanges,
    hasDescription,
    toggleExpanded,
    startEditing,
    saveDescription,
    cancelEditing,
    updateEditValue,
    setDescription,
    setExpanded
  };
}; 