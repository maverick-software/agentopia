/**
 * UI State Management Hooks
 * 
 * Specialized hooks for global UI state, user preferences, theming, modal management,
 * notification handling, and UI component state. Provides high-level abstractions for
 * common UI patterns and ensures optimal performance through selective subscriptions.
 */

import { useCallback, useMemo } from 'react';
import { useStore } from './use-store';
import { uiStore } from '../stores';
import type { GlobalUIState, UserPreferences, UIState, Modal, Notification } from '../core/types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Global UI state return type
 */
export interface UseUIReturn {
  theme: string;
  sidebarOpen: boolean;
  isLoading: boolean;
  modals: Modal[];
  notifications: Notification[];
  setTheme: (theme: string) => void;
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
  showModal: (modal: Modal) => void;
  hideModal: () => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

/**
 * Modal management return type
 */
export interface UseModalReturn {
  current: Modal | null;
  stack: Modal[];
  show: (modal: Modal) => void;
  hide: () => void;
  hideAll: () => void;
  isVisible: (id?: string) => boolean;
}

/**
 * Notification management return type
 */
export interface UseNotificationsReturn {
  notifications: Notification[];
  add: (notification: Omit<Notification, 'id'>) => void;
  remove: (id: string) => void;
  clear: () => void;
  unreadCount: number;
  hasUnread: boolean;
}

/**
 * User preferences return type
 */
export interface UseUserPreferencesReturn {
  preferences: UserPreferences;
  update: (updates: Partial<UserPreferences>) => Promise<void>;
  reset: () => Promise<void>;
  isLoading: boolean;
  theme: string;
  sidebarCollapsed: boolean;
  notifications: UserPreferences['notifications'];
}

/**
 * Theme management return type
 */
export interface UseThemeReturn {
  theme: string;
  setTheme: (theme: string) => void;
  toggleTheme: () => void;
  isDark: boolean;
  isLight: boolean;
  availableThemes: string[];
}

/**
 * Sidebar management return type
 */
export interface UseSidebarReturn {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  isCollapsed: boolean;
}

// ============================================================================
// CORE UI STATE HOOK
// ============================================================================

/**
 * Core UI state hook
 * Provides comprehensive global UI state management
 */
export function useUI(): UseUIReturn {
  // Subscribe to specific UI state slices for optimal performance
  const global = useStore(uiStore, (state: UIState) => state.global);
  const isLoading = useStore(uiStore, (state: UIState) => state.global.loading);
  
  // Actions accessed directly from store (not via state selectors)
  const setTheme = useCallback((theme: string): void => {
    uiStore.getState().setTheme(theme);
  }, []);
  
  const toggleSidebar = useCallback((): void => {
    uiStore.getState().toggleSidebar();
  }, []);
  
  const setLoading = useCallback((loading: boolean): void => {
    uiStore.getState().setGlobalLoading(loading);
  }, []);
  
  const showModal = useCallback((modal: Modal): void => {
    uiStore.getState().showModal(modal);
  }, []);
  
  const hideModal = useCallback((): void => {
    uiStore.getState().hideModal();
  }, []);
  
  const addNotification = useCallback((notification: Omit<Notification, 'id'>): void => {
    uiStore.getState().addNotification(notification);
  }, []);
  
  const removeNotification = useCallback((id: string): void => {
    uiStore.getState().removeNotification(id);
  }, []);

  return {
    theme: global.theme,
    sidebarOpen: global.sidebarOpen,
    isLoading,
    modals: global.modals,
    notifications: global.notifications,
    setTheme,
    toggleSidebar,
    setLoading,
    showModal,
    hideModal,
    addNotification,
    removeNotification
  };
}

// ============================================================================
// MODAL MANAGEMENT HOOKS
// ============================================================================

/**
 * Modal management hook
 * Provides comprehensive modal state and operations
 */
export function useModal(): UseModalReturn {
  const modals = useStore(uiStore, (state: UIState) => state.global.modals);
  
  // Actions accessed directly from store
  const show = useCallback((modal: Modal): void => {
    uiStore.getState().showModal(modal);
  }, []);
  
  const hide = useCallback((): void => {
    uiStore.getState().hideModal();
  }, []);
  
  const hideAll = useCallback((): void => {
    uiStore.getState().clearNotifications(); // Close all modals by clearing
  }, []);
  
  // Computed properties
  const current = useMemo(() => {
    return modals.length > 0 ? modals[modals.length - 1] : null;
  }, [modals]);
  
  const isVisible = useCallback((id?: string): boolean => {
    if (!id) return modals.length > 0;
    return modals.some(modal => modal.id === id);
  }, [modals]);

  return {
    current,
    stack: modals,
    show,
    hide,
    hideAll,
    isVisible
  };
}

/**
 * Specific modal hook
 * Optimized for checking a single modal's visibility
 */
export function useModalVisible(modalId: string): boolean {
  return useStore(
    uiStore,
    useCallback((state: UIState) => {
      return state.global.modals.some(modal => modal.id === modalId);
    }, [modalId])
  );
}

// ============================================================================
// NOTIFICATION MANAGEMENT HOOKS
// ============================================================================

/**
 * Notification management hook
 * Provides comprehensive notification state and operations
 */
export function useNotifications(): UseNotificationsReturn {
  const notifications = useStore(uiStore, (state: UIState) => state.global.notifications);
  
  // Actions accessed directly from store
  const add = useCallback((notification: Omit<Notification, 'id'>): void => {
    uiStore.getState().addNotification(notification);
  }, []);
  
  const remove = useCallback((id: string): void => {
    uiStore.getState().removeNotification(id);
  }, []);
  
  const clear = useCallback((): void => {
    uiStore.getState().clearNotifications();
  }, []);
  
  // Computed properties
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);
  
  const hasUnread = useMemo(() => {
    return unreadCount > 0;
  }, [unreadCount]);

  return {
    notifications,
    add,
    remove,
    clear,
    unreadCount,
    hasUnread
  };
}

/**
 * Toast notification hook
 * Simplified interface for showing toast messages
 */
export function useToast() {
  const add = useCallback((notification: Omit<Notification, 'id'>): void => {
    uiStore.getState().addNotification(notification);
  }, []);
  
  return {
    success: useCallback((message: string) => {
      add({ 
        type: 'success', 
        title: 'Success',
        message,
        timestamp: Date.now(),
        read: false
      });
    }, [add]),
    
    error: useCallback((message: string) => {
      add({ 
        type: 'error', 
        title: 'Error',
        message,
        timestamp: Date.now(),
        read: false
      });
    }, [add]),
    
    warning: useCallback((message: string) => {
      add({ 
        type: 'warning', 
        title: 'Warning',
        message,
        timestamp: Date.now(),
        read: false
      });
    }, [add]),
    
    info: useCallback((message: string) => {
      add({ 
        type: 'info', 
        title: 'Info',
        message,
        timestamp: Date.now(),
        read: false
      });
    }, [add])
  };
}

// ============================================================================
// USER PREFERENCES HOOKS
// ============================================================================

/**
 * User preferences hook
 * Manages user-specific preferences with cache integration
 */
export function useUserPreferences(): UseUserPreferencesReturn {
  const preferences = useStore(uiStore, (state: UIState) => state.preferences);
  const isLoading = useStore(uiStore, (state: UIState) => state.global.loading);
  
  // Actions accessed directly from store
  const update = useCallback(async (updates: Partial<UserPreferences>): Promise<void> => {
    await uiStore.getState().updateUserPreferences(updates);
  }, []);
  
  const reset = useCallback(async (): Promise<void> => {
    await uiStore.getState().resetPreferences();
  }, []);

  return {
    preferences,
    update,
    reset,
    isLoading,
    theme: preferences.theme,
    sidebarCollapsed: preferences.ui.sidebarCollapsed,
    notifications: preferences.notifications
  };
}

/**
 * Specific preference hook
 * Optimized for accessing a single preference value
 */
export function usePreference<K extends keyof UserPreferences>(
  key: K
): UserPreferences[K] {
  return useStore(
    uiStore,
    useCallback((state: UIState) => state.preferences[key], [key])
  );
}

// ============================================================================
// THEME MANAGEMENT HOOKS
// ============================================================================

/**
 * Theme management hook
 * Provides theme state and operations with system preference support
 */
export function useTheme(): UseThemeReturn {
  const theme = useStore(uiStore, (state: UIState) => state.global.theme);
  
  // Actions accessed directly from store
  const setTheme = useCallback((newTheme: string): void => {
    uiStore.getState().setTheme(newTheme);
  }, []);
  
  const toggleTheme = useCallback((): void => {
    const currentTheme = uiStore.getState().global.theme;
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }, [setTheme]);
  
  // Computed properties
  const isDark = useMemo(() => theme === 'dark', [theme]);
  const isLight = useMemo(() => theme === 'light', [theme]);
  const availableThemes = useMemo(() => ['light', 'dark', 'system'], []);

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark,
    isLight,
    availableThemes
  };
}

/**
 * System theme detection hook
 * Provides system theme preference detection
 */
export function useSystemTheme(): {
  systemTheme: 'light' | 'dark';
  isSystemDark: boolean;
  matchesSystem: boolean;
} {
  const currentTheme = useStore(uiStore, (state: UIState) => state.global.theme);
  
  // Detect system theme preference
  const systemTheme = useMemo(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }, []);
  
  const isSystemDark = useMemo(() => systemTheme === 'dark', [systemTheme]);
  const matchesSystem = useMemo(() => {
    return currentTheme === 'system' || currentTheme === systemTheme;
  }, [currentTheme, systemTheme]);

  return {
    systemTheme,
    isSystemDark,
    matchesSystem
  };
}

// ============================================================================
// SIDEBAR MANAGEMENT HOOKS
// ============================================================================

/**
 * Sidebar management hook
 * Provides sidebar state and operations
 */
export function useSidebar(): UseSidebarReturn {
  const sidebarOpen = useStore(uiStore, (state: UIState) => state.global.sidebarOpen);
  const sidebarCollapsed = useStore(uiStore, (state: UIState) => state.preferences.ui.sidebarCollapsed);
  
  // Actions accessed directly from store
  const toggle = useCallback((): void => {
    uiStore.getState().toggleSidebar();
  }, []);
  
  const open = useCallback((): void => {
    if (!sidebarOpen) {
      uiStore.getState().toggleSidebar();
    }
  }, [sidebarOpen]);
  
  const close = useCallback((): void => {
    if (sidebarOpen) {
      uiStore.getState().toggleSidebar();
    }
  }, [sidebarOpen]);

  return {
    isOpen: sidebarOpen,
    toggle,
    open,
    close,
    isCollapsed: sidebarCollapsed
  };
}

// ============================================================================
// LOADING STATE HOOKS
// ============================================================================

/**
 * Global loading state hook
 * Provides global loading state management
 */
export function useLoading(): {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
} {
  const isLoading = useStore(uiStore, (state: UIState) => state.global.loading);
  
  const setLoading = useCallback((loading: boolean): void => {
    uiStore.getState().setGlobalLoading(loading);
  }, []);

  return {
    isLoading,
    setLoading
  };
}

/**
 * Loading state hook with automatic cleanup
 * Automatically sets loading to false when component unmounts
 */
export function useLoadingWithCleanup(): {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
} {
  const { isLoading, setLoading } = useLoading();
  
  // Auto-cleanup loading state on unmount using useEffect
  const setLoadingWithCleanup = useCallback((loading: boolean): void => {
    setLoading(loading);
  }, [setLoading]);

  return {
    isLoading,
    setLoading: setLoadingWithCleanup
  };
} 