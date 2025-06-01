import { useState, useCallback } from 'react';

// Enhanced Flow Builder types for unified hierarchy
type HierarchyLevel = 'template' | 'stage' | 'task' | 'step' | 'element';

interface UseFlowBuilderStateReturn {
  // UI State
  activeLevel: HierarchyLevel;
  selectedItem: string | null;
  expandedItems: Set<string>;
  isDirty: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  
  // Selection Actions
  selectTemplate: () => void;
  selectStage: (stageId: string) => void;
  selectTask: (taskId: string) => void;
  selectStep: (stepId: string) => void;
  selectElement: (elementId: string) => void;
  
  // Expansion Actions
  toggleStageExpansion: (stageId: string) => void;
  toggleTaskExpansion: (taskId: string) => void;
  expandStage: (stageId: string) => void;
  expandTask: (taskId: string) => void;
  collapseStage: (stageId: string) => void;
  collapseTask: (taskId: string) => void;
  
  // State Management Actions
  markDirty: () => void;
  markClean: () => void;
  setSaveStatus: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
  
  // Utility
  hasUnsavedChanges: () => boolean;
  getSelectedItemType: () => HierarchyLevel | null;
}

interface UseFlowBuilderStateOptions {
  initialActiveLevel?: HierarchyLevel;
  initialSelectedItem?: string | null;
  initialExpandedItems?: string[];
}

/**
 * Hook for managing UI state in the Flow Builder
 * Handles selection, expansion, dirty state, and save status
 */
export const useFlowBuilderState = (
  options: UseFlowBuilderStateOptions = {}
): UseFlowBuilderStateReturn => {
  const {
    initialActiveLevel = 'template',
    initialSelectedItem = null,
    initialExpandedItems = []
  } = options;

  // UI State
  const [activeLevel, setActiveLevel] = useState<HierarchyLevel>(initialActiveLevel);
  const [selectedItem, setSelectedItem] = useState<string | null>(initialSelectedItem);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(
    new Set(initialExpandedItems)
  );
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [saveStatus, setSaveStatusState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Selection Actions
  const selectTemplate = useCallback(() => {
    setActiveLevel('template');
    setSelectedItem(null); // Template doesn't have a specific ID in this context
  }, []);

  const selectStage = useCallback((stageId: string) => {
    setActiveLevel('stage');
    setSelectedItem(stageId);
  }, []);

  const selectTask = useCallback((taskId: string) => {
    setActiveLevel('task');
    setSelectedItem(taskId);
  }, []);

  const selectStep = useCallback((stepId: string) => {
    setActiveLevel('step');
    setSelectedItem(stepId);
  }, []);

  const selectElement = useCallback((elementId: string) => {
    setActiveLevel('element');
    setSelectedItem(elementId);
  }, []);

  // Expansion Actions
  const toggleStageExpansion = useCallback((stageId: string) => {
    setExpandedItems(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(stageId)) {
        newExpanded.delete(stageId);
      } else {
        newExpanded.add(stageId);
      }
      return newExpanded;
    });
  }, []);

  const toggleTaskExpansion = useCallback((taskId: string) => {
    setExpandedItems(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(taskId)) {
        newExpanded.delete(taskId);
      } else {
        newExpanded.add(taskId);
      }
      return newExpanded;
    });
  }, []);

  const expandStage = useCallback((stageId: string) => {
    setExpandedItems(prev => new Set([...prev, stageId]));
  }, []);

  const expandTask = useCallback((taskId: string) => {
    setExpandedItems(prev => new Set([...prev, taskId]));
  }, []);

  const collapseStage = useCallback((stageId: string) => {
    setExpandedItems(prev => {
      const newExpanded = new Set(prev);
      newExpanded.delete(stageId);
      return newExpanded;
    });
  }, []);

  const collapseTask = useCallback((taskId: string) => {
    setExpandedItems(prev => {
      const newExpanded = new Set(prev);
      newExpanded.delete(taskId);
      return newExpanded;
    });
  }, []);

  // State Management Actions
  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  const setSaveStatus = useCallback((status: 'idle' | 'saving' | 'saved' | 'error') => {
    setSaveStatusState(status);
    
    // Auto-reset saved status after 3 seconds
    if (status === 'saved') {
      setTimeout(() => {
        setSaveStatusState('idle');
      }, 3000);
    }
  }, []);

  // Utility Functions
  const hasUnsavedChanges = useCallback(() => {
    return isDirty;
  }, [isDirty]);

  const getSelectedItemType = useCallback(() => {
    return selectedItem ? activeLevel : null;
  }, [selectedItem, activeLevel]);

  return {
    // UI State
    activeLevel,
    selectedItem,
    expandedItems,
    isDirty,
    saveStatus,
    
    // Selection Actions
    selectTemplate,
    selectStage,
    selectTask,
    selectStep,
    selectElement,
    
    // Expansion Actions
    toggleStageExpansion,
    toggleTaskExpansion,
    expandStage,
    expandTask,
    collapseStage,
    collapseTask,
    
    // State Management Actions
    markDirty,
    markClean,
    setSaveStatus,
    
    // Utility
    hasUnsavedChanges,
    getSelectedItemType
  };
}; 