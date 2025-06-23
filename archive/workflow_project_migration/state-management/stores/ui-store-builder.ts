/**
 * UI Store Builder Actions
 * 
 * Workflow builder-specific UI actions separated from main UI store
 * to maintain file size compliance (under 500 lines).
 */

import type { 
  UIState,
  WorkflowBuilderState,
} from '../core/types';

// ============================================================================
// WORKFLOW BUILDER UI ACTIONS
// ============================================================================

/**
 * Workflow builder UI actions factory
 */
export const createBuilderActions = (set: any, get: any) => ({
  /**
   * Set active builder level
   */
  setBuilderActiveLevel: (level: WorkflowBuilderState['activeLevel']) => {
    set((draft: UIState) => {
      draft.builder.activeLevel = level;
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Set selected builder item
   */
  setBuilderSelectedItem: (itemId: string | null) => {
    set((draft: UIState) => {
      draft.builder.selectedItem = itemId;
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Toggle expanded builder item
   */
  toggleBuilderExpandedItem: (itemId: string) => {
    set((draft: UIState) => {
      if (draft.builder.expandedItems.has(itemId)) {
        draft.builder.expandedItems.delete(itemId);
      } else {
        draft.builder.expandedItems.add(itemId);
      }
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Set builder dirty state
   */
  setBuilderDirty: (isDirty: boolean) => {
    set((draft: UIState) => {
      draft.builder.isDirty = isDirty;
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Set builder save status
   */
  setBuilderSaveStatus: (status: WorkflowBuilderState['saveStatus']) => {
    set((draft: UIState) => {
      draft.builder.saveStatus = status;
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Set builder drag state
   */
  setBuilderDragState: (dragState: WorkflowBuilderState['dragState']) => {
    set((draft: UIState) => {
      draft.builder.dragState = dragState;
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Set builder clipboard
   */
  setBuilderClipboard: (clipboard: WorkflowBuilderState['clipboard']) => {
    set((draft: UIState) => {
      draft.builder.clipboard = clipboard;
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Add to builder undo stack
   */
  addBuilderUndoAction: (action: WorkflowBuilderState['undoStack'][0]) => {
    set((draft: UIState) => {
      draft.builder.undoStack.push(action);
      
      // Limit undo stack size
      if (draft.builder.undoStack.length > 50) {
        draft.builder.undoStack.shift();
      }
      
      // Clear redo stack when new action is added
      draft.builder.redoStack = [];
      
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Undo last builder action
   */
  undoBuilderAction: () => {
    set((draft: UIState) => {
      const action = draft.builder.undoStack.pop();
      if (action) {
        draft.builder.redoStack.push(action);
        draft.lastUpdated = Date.now();
      }
    });
  },

  /**
   * Redo last builder action
   */
  redoBuilderAction: () => {
    set((draft: UIState) => {
      const action = draft.builder.redoStack.pop();
      if (action) {
        draft.builder.undoStack.push(action);
        draft.lastUpdated = Date.now();
      }
    });
  },

  /**
   * Clear builder undo/redo stacks
   */
  clearBuilderHistory: () => {
    set((draft: UIState) => {
      draft.builder.undoStack = [];
      draft.builder.redoStack = [];
      draft.lastUpdated = Date.now();
    });
  },
});

// ============================================================================
// BUILDER SELECTORS
// ============================================================================

/**
 * Get workflow builder state
 */
export const selectBuilderState = (state: UIState) => state.builder;

/**
 * Get builder preferences
 */
export const selectBuilderPreferences = (state: UIState) => state.preferences.workflowBuilder;

/**
 * Check if builder has unsaved changes
 */
export const selectBuilderHasUnsavedChanges = (state: UIState) => state.builder.isDirty;

/**
 * Check if builder can undo
 */
export const selectBuilderCanUndo = (state: UIState) => state.builder.undoStack.length > 0;

/**
 * Check if builder can redo
 */
export const selectBuilderCanRedo = (state: UIState) => state.builder.redoStack.length > 0; 