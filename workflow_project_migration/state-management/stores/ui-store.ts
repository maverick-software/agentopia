/**
 * UI Store Implementation
 * 
 * Manages global UI state and user preferences with comprehensive cache integration,
 * debug integration, and performance monitoring.
 */

import { createUIStore } from '../core/store-debug';
import { createBuilderActions } from './ui-store-builder';
import { 
  getCached, 
  setCached, 
  createCacheKey,
  invalidateUser
} from '../cache/cache-integration';
import { globalEventBus } from '../composition/event-bus';
import type { 
  UIState, 
  GlobalUIState,
  UserPreferences,
  StateCreator,
  Notification,
  Modal,
  Toast
} from '../core/types';

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialUIState: UIState = {
  // Base state properties
  loading: false,
  error: null,
  lastUpdated: null,
  
  // Global UI state - Fixed to match GlobalUIState type
  global: {
    sidebarOpen: false,
    theme: 'light',
    loading: false,
    notifications: [],
    modals: [],
    toasts: [],
  },
  
  // User preferences (persisted) - Fixed to match UserPreferences type
  preferences: {
    theme: 'light',
    language: 'en',
    timezone: 'UTC',
    notifications: {
      email: true,
      browser: true,
      workflowUpdates: true,
      taskAssignments: true,
      deadlineReminders: true,
    },
    workflow: {
      autoSave: true,
      autoSaveInterval: 30,
      showHelpText: true,
      compactView: false,
      recentTemplates: [],
      favoriteTemplates: [],
    },
    ui: {
      sidebarCollapsed: false,
      gridView: false,
      itemsPerPage: 25,
      sortBy: 'name',
      sortOrder: 'asc',
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
   * Toggle sidebar state with cache integration
   */
  toggleSidebar: async () => {
    const state = get();
    const newSidebarOpen = !state.global.sidebarOpen;
    
    // Update UI preferences in cache
    const newUIPrefs = {
      ...state.preferences.ui,
      sidebarCollapsed: !newSidebarOpen,
    };
    
    const newPreferences = {
      ...state.preferences,
      ui: newUIPrefs,
    };

    const newState = {
      ...state,
      global: {
        ...state.global,
        sidebarOpen: newSidebarOpen,
      },
      preferences: newPreferences,
      lastUpdated: new Date().toISOString(),
    };

    set(newState);

    // Cache updated preferences
    setCached(
      createCacheKey.userPreferences('current-user'),
      newPreferences,
      { dataType: 'user:prefs' }
    );

    // Emit event for cache coordination
    globalEventBus.emit('ui:preferences:updated', {
      userId: 'current-user',
      preferences: newPreferences
    });
  },

  /**
   * Set theme with cache integration
   */
  setTheme: async (theme: 'light' | 'dark' | 'system') => {
    const state = get();
    
    const newPreferences = {
      ...state.preferences,
      theme,
    };

    const newState = {
      ...state,
      global: {
        ...state.global,
        theme,
      },
      preferences: newPreferences,
      lastUpdated: new Date().toISOString(),
    };

    set(newState);

    // Cache updated preferences
    setCached(
      createCacheKey.userPreferences('current-user'),
      newPreferences,
      { dataType: 'user:prefs' }
    );

    // Emit event for cache coordination
    globalEventBus.emit('ui:theme:changed', {
      userId: 'current-user',
      theme
    });
  },

  /**
   * Add notification
   */
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const state = get();
    
    const newNotification: Notification = {
      ...notification,
      id: `notification_${Date.now()}`,
      timestamp: Date.now(),
      read: false,
    };

    const newState = {
      ...state,
      global: {
        ...state.global,
        notifications: [...state.global.notifications, newNotification],
      },
      lastUpdated: new Date().toISOString(),
    };

    set(newState);
  },

  /**
   * Remove notification
   */
  removeNotification: (notificationId: string) => {
    const state = get();

    const newState = {
      ...state,
      global: {
        ...state.global,
        notifications: state.global.notifications.filter(
          n => n.id !== notificationId
        ),
      },
      lastUpdated: new Date().toISOString(),
    };

    set(newState);
  },

  /**
   * Clear all notifications
   */
  clearNotifications: () => {
    const state = get();

    const newState = {
      ...state,
      global: {
        ...state.global,
        notifications: [],
      },
      lastUpdated: new Date().toISOString(),
    };

    set(newState);
  },

  /**
   * Show modal
   */
  showModal: (modal: Modal) => {
    const state = get();

    const newState = {
      ...state,
      global: {
        ...state.global,
        modals: [...state.global.modals, modal],
      },
      lastUpdated: new Date().toISOString(),
    };

    set(newState);
  },

  /**
   * Hide modal
   */
  hideModal: (modalId?: string) => {
    const state = get();
    
    let newModals = [...state.global.modals];
    
    if (modalId) {
      // Remove specific modal
      newModals = newModals.filter(modal => modal.id !== modalId);
    } else {
      // Remove the last modal
      newModals.pop();
    }

    const newState = {
      ...state,
      global: {
        ...state.global,
        modals: newModals,
      },
      lastUpdated: new Date().toISOString(),
    };

    set(newState);
  },

  /**
   * Add toast
   */
  addToast: (toast: Omit<Toast, 'id'>) => {
    const state = get();
    
    const newToast: Toast = {
      ...toast,
      id: `toast_${Date.now()}`,
    };

    const newState = {
      ...state,
      global: {
        ...state.global,
        toasts: [...state.global.toasts, newToast],
      },
      lastUpdated: new Date().toISOString(),
    };

    set(newState);
  },

  /**
   * Remove toast
   */
  removeToast: (toastId: string) => {
    const state = get();

    const newState = {
      ...state,
      global: {
        ...state.global,
        toasts: state.global.toasts.filter(t => t.id !== toastId),
      },
      lastUpdated: new Date().toISOString(),
    };

    set(newState);
  },

  /**
   * Set global loading state
   */
  setGlobalLoading: (loading: boolean) => {
    const state = get();

    const newState = {
      ...state,
      global: {
        ...state.global,
        loading,
      },
      lastUpdated: new Date().toISOString(),
    };

    set(newState);
  },

  /**
   * Load user preferences with cache integration
   */
  loadUserPreferences: async (userId: string) => {
    const state = get();
    
    try {
      const cacheKey = createCacheKey.userPreferences(userId);
      
      // Use cache-first pattern
      const preferences = await getCached(
        cacheKey,
        async () => {
          // TODO: Replace with actual API call
          return state.preferences; // Default preferences for now
        },
        { dataType: 'user:prefs' }
      );

      const newState = {
        ...state,
        preferences,
        lastUpdated: new Date().toISOString(),
      };

      set(newState);

      // Emit event for cache coordination
      globalEventBus.emit('ui:preferences:loaded', {
        userId,
        preferences
      });

      return preferences;
    } catch (error) {
      const currentState = get();
      set({
        ...currentState,
        error: error instanceof Error ? error.message : 'Failed to load preferences',
      });
      throw error;
    }
  },

  /**
   * Update user preferences with cache integration
   */
  updateUserPreferences: async (updates: Partial<UserPreferences>) => {
    const state = get();
    
    const newPreferences = {
      ...state.preferences,
      ...updates,
    };

    // Update global state if relevant
    let newGlobal = { ...state.global };
    if (updates.theme) {
      newGlobal.theme = updates.theme;
    }
    if (updates.ui?.sidebarCollapsed !== undefined) {
      newGlobal.sidebarOpen = !updates.ui.sidebarCollapsed;
    }

    const newState = {
      ...state,
      global: newGlobal,
      preferences: newPreferences,
      lastUpdated: new Date().toISOString(),
    };

    set(newState);

    // Cache updated preferences
    setCached(
      createCacheKey.userPreferences('current-user'),
      newPreferences,
      { dataType: 'user:prefs' }
    );

    // Emit event for cache coordination
    globalEventBus.emit('ui:preferences:updated', {
      userId: 'current-user',
      preferences: newPreferences
    });

    return newPreferences;
  },

  /**
   * Reset preferences to defaults
   */
  resetPreferences: () => {
    const state = get();

    const newState = {
      ...state,
      preferences: initialUIState.preferences,
      lastUpdated: new Date().toISOString(),
    };

    set(newState);
  },

  /**
   * Sync preferences from cached state
   */
  syncPreferencesFromCache: async (userId: string) => {
    const state = get();
    
    try {
      const cacheKey = createCacheKey.userPreferences(userId);
      const cachedPreferences = await getCached(
        cacheKey,
        async () => null, // Return null if not in cache
        { dataType: 'user:prefs' }
      );
      
      if (cachedPreferences && typeof cachedPreferences === 'object' && 'theme' in cachedPreferences) {
        // Type-safe access to cached preferences
        const typedPreferences = cachedPreferences as UserPreferences;
        
        // Sync global state with preferences
        const newGlobal = {
          ...state.global,
          theme: typedPreferences.theme,
          sidebarOpen: !typedPreferences.ui.sidebarCollapsed,
        };

        const newState = {
          ...state,
          global: newGlobal,
          preferences: typedPreferences,
          lastUpdated: new Date().toISOString(),
        };

        set(newState);
      }
    } catch (error) {
      console.warn('Failed to sync preferences from cache:', error);
    }
  },

  // ============================================================================
  // BUILDER ACTIONS (from ui-store-builder)
  // ============================================================================
  ...createBuilderActions(set, get),

  // ============================================================================
  // UTILITY ACTIONS
  // ============================================================================

  /**
   * Reset store to initial state
   */
  reset: () => {
    set({ ...initialUIState });
  },

  /**
   * Clear error state
   */
  clearError: () => {
    const state = get();
    set({
      ...state,
      error: null,
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
 * Get sidebar open state
 */
export const selectSidebarOpen = (state: UIState) => state.global.sidebarOpen;

/**
 * Get sidebar collapsed state (from preferences)
 */
export const selectSidebarCollapsed = (state: UIState) => state.preferences.ui.sidebarCollapsed;

/**
 * Get notifications
 */
export const selectNotifications = (state: UIState) => state.global.notifications;

/**
 * Get active modal (last modal in array)
 */
export const selectActiveModal = (state: UIState) => 
  state.global.modals.length > 0 ? state.global.modals[state.global.modals.length - 1] : null;

/**
 * Get all modals
 */
export const selectModals = (state: UIState) => state.global.modals;

/**
 * Get toasts
 */
export const selectToasts = (state: UIState) => state.global.toasts;

/**
 * Get global loading state
 */
export const selectGlobalLoading = (state: UIState) => state.global.loading;

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