/**
 * UI Store Implementation
 * 
 * Manages global UI state and user preferences with persistence,
 * debug integration, and performance monitoring.
 */

import { createUIStore } from '../core/store-debug';
import { createBuilderActions } from './ui-store-builder';
import type { 
  UIState, 
  GlobalUIState,
  UserPreferences,
  StateCreator
} from '../core/types';

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialUIState: UIState = {
  // Base state properties
  loading: false,
  error: null,
  lastUpdated: null,
  
  // Global UI state
  global: {
    sidebarCollapsed: false,
    theme: 'light',
    notifications: [],
    modals: {
      active: null,
      stack: [],
    },
    toasts: [],
    loading: {
      global: false,
      operations: new Set(),
    },
  },
  
  // User preferences (persisted)
  preferences: {
    theme: 'light',
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'MM/dd/yyyy',
    timeFormat: '12h',
    sidebarCollapsed: false,
    compactMode: false,
    showTooltips: true,
    autoSave: true,
    notifications: {
      email: true,
      push: true,
      inApp: true,
    },
    workflowBuilder: {
      autoExpand: true,
      showGrid: true,
      snapToGrid: false,
      defaultView: 'hierarchy',
    },
  },
  
  // Workflow builder UI state
  builder: {
    activeLevel: 'template',
    selectedItem: null,
    expandedItems: new Set(),
    isDirty: false,
    saveStatus: 'idle',
    dragState: null,
    clipboard: null,
    undoStack: [],
    redoStack: [],
  },
};

// ============================================================================
// STORE CREATOR
// ============================================================================

const createUIStoreImpl: StateCreator<UIState> = (set, get) => ({
  ...initialUIState,

  // ============================================================================
  // GLOBAL UI ACTIONS
  // ============================================================================

  /**
   * Toggle sidebar collapsed state
   */
  toggleSidebar: () => {
    set((draft) => {
      draft.global.sidebarCollapsed = !draft.global.sidebarCollapsed;
      draft.preferences.sidebarCollapsed = draft.global.sidebarCollapsed;
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Set theme
   */
  setTheme: (theme: 'light' | 'dark' | 'system') => {
    set((draft) => {
      draft.global.theme = theme;
      draft.preferences.theme = theme;
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Add notification
   */
  addNotification: (notification: Omit<GlobalUIState['notifications'][0], 'id' | 'timestamp'>) => {
    set((draft) => {
      const newNotification = {
        ...notification,
        id: `notification_${Date.now()}`,
        timestamp: Date.now(),
      };
      draft.global.notifications.push(newNotification);
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Remove notification
   */
  removeNotification: (notificationId: string) => {
    set((draft) => {
      draft.global.notifications = draft.global.notifications.filter(
        n => n.id !== notificationId
      );
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Clear all notifications
   */
  clearNotifications: () => {
    set((draft) => {
      draft.global.notifications = [];
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Show modal
   */
  showModal: (modalId: string, props?: Record<string, any>) => {
    set((draft) => {
      const modal = { id: modalId, props: props || {} };
      
      // Add to stack if there's already an active modal
      if (draft.global.modals.active) {
        draft.global.modals.stack.push(draft.global.modals.active);
      }
      
      draft.global.modals.active = modal;
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Hide modal
   */
  hideModal: () => {
    set((draft) => {
      // Pop from stack if available
      if (draft.global.modals.stack.length > 0) {
        draft.global.modals.active = draft.global.modals.stack.pop() || null;
      } else {
        draft.global.modals.active = null;
      }
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Add toast
   */
  addToast: (toast: Omit<GlobalUIState['toasts'][0], 'id' | 'timestamp'>) => {
    set((draft) => {
      const newToast = {
        ...toast,
        id: `toast_${Date.now()}`,
        timestamp: Date.now(),
      };
      draft.global.toasts.push(newToast);
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Remove toast
   */
  removeToast: (toastId: string) => {
    set((draft) => {
      draft.global.toasts = draft.global.toasts.filter(t => t.id !== toastId);
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Set global loading
   */
  setGlobalLoading: (loading: boolean) => {
    set((draft) => {
      draft.global.loading.global = loading;
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Add loading operation
   */
  addLoadingOperation: (operationId: string) => {
    set((draft) => {
      draft.global.loading.operations.add(operationId);
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Remove loading operation
   */
  removeLoadingOperation: (operationId: string) => {
    set((draft) => {
      draft.global.loading.operations.delete(operationId);
      draft.lastUpdated = Date.now();
    });
  },

  // ============================================================================
  // PREFERENCES ACTIONS
  // ============================================================================

  /**
   * Update user preferences
   */
  updatePreferences: (updates: Partial<UserPreferences>) => {
    set((draft) => {
      Object.assign(draft.preferences, updates);
      
      // Sync certain preferences with global state
      if (updates.theme) {
        draft.global.theme = updates.theme;
      }
      if (updates.sidebarCollapsed !== undefined) {
        draft.global.sidebarCollapsed = updates.sidebarCollapsed;
      }
      
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Reset preferences to defaults
   */
  resetPreferences: () => {
    set((draft) => {
      draft.preferences = { ...initialUIState.preferences };
      
      // Sync with global state
      draft.global.theme = draft.preferences.theme;
      draft.global.sidebarCollapsed = draft.preferences.sidebarCollapsed;
      
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Update workflow builder preferences
   */
  updateBuilderPreferences: (updates: Partial<UserPreferences['workflowBuilder']>) => {
    set((draft) => {
      Object.assign(draft.preferences.workflowBuilder, updates);
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Update notification preferences
   */
  updateNotificationPreferences: (updates: Partial<UserPreferences['notifications']>) => {
    set((draft) => {
      Object.assign(draft.preferences.notifications, updates);
      draft.lastUpdated = Date.now();
    });
  },

  // ============================================================================
  // WORKFLOW BUILDER UI ACTIONS (IMPORTED)
  // ============================================================================

  ...createBuilderActions(set, get),

  // ============================================================================
  // UTILITY ACTIONS
  // ============================================================================

  /**
   * Reset store to initial state
   */
  reset: () => {
    set(() => ({ ...initialUIState }));
  },

  /**
   * Clear error state
   */
  clearError: () => {
    set((draft) => {
      draft.error = null;
    });
  },

  /**
   * Initialize from persisted preferences
   */
  initializeFromPreferences: () => {
    const state = get();
    set((draft) => {
      // Sync preferences with global state
      draft.global.theme = state.preferences.theme;
      draft.global.sidebarCollapsed = state.preferences.sidebarCollapsed;
      draft.lastUpdated = Date.now();
    });
  },
});

// ============================================================================
// STORE INSTANCE
// ============================================================================

/**
 * UI store with persistence, debug integration, and performance monitoring
 */
export const useUIStore = createUIStore(
  'ui',
  createUIStoreImpl,
  {
    persist: {
      name: 'catalyst-ui-preferences',
      storage: 'localStorage',
      // Only persist preferences, not transient UI state
      partialize: (state) => ({
        preferences: state.preferences,
      }),
    },
    debug: {
      enabled: true,
      enableLogging: true,
      enablePerformanceMonitoring: true,
      enableStateInspection: true,
      logCategory: 'ui',
      performanceCategory: 'state-update',
      logLevel: 'debug',
    },
  }
);

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Get global UI state
 */
export const selectGlobalUI = (state: UIState) => state.global;

/**
 * Get user preferences
 */
export const selectUserPreferences = (state: UIState) => state.preferences;

/**
 * Get current theme
 */
export const selectTheme = (state: UIState) => state.global.theme;

/**
 * Get sidebar collapsed state
 */
export const selectSidebarCollapsed = (state: UIState) => state.global.sidebarCollapsed;

/**
 * Get notifications
 */
export const selectNotifications = (state: UIState) => state.global.notifications;

/**
 * Get active modal
 */
export const selectActiveModal = (state: UIState) => state.global.modals.active;

/**
 * Get toasts
 */
export const selectToasts = (state: UIState) => state.global.toasts;

/**
 * Get global loading state
 */
export const selectGlobalLoading = (state: UIState) => state.global.loading.global;

/**
 * Get loading operations
 */
export const selectLoadingOperations = (state: UIState) => 
  Array.from(state.global.loading.operations);

/**
 * Check if any operations are loading
 */
export const selectIsAnyOperationLoading = (state: UIState) => 
  state.global.loading.operations.size > 0;

/**
 * Get notification preferences
 */
export const selectNotificationPreferences = (state: UIState) => state.preferences.notifications;

// Re-export builder selectors for convenience
export {
  selectBuilderState,
  selectBuilderPreferences,
  selectBuilderHasUnsavedChanges,
  selectBuilderCanUndo,
  selectBuilderCanRedo,
} from './ui-store-builder'; 