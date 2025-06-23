/**
 * Domain Stores Module
 * 
 * Exports all domain-specific stores with their types and utilities.
 * These stores are built using the unified state management system
 * with debug integration and performance monitoring.
 */

// ============================================================================
// Workflow Store Exports
// ============================================================================

export {
  // Store hook and instance
  useWorkflowStore,
  workflowStore,
  
  // Store types
  type WorkflowState,
  type WorkflowActions,
  type WorkflowSelectors,
  
  // Domain types
  type WorkflowTemplate,
  type WorkflowInstance,
  type WorkflowStage,
  type WorkflowTask,
  type WorkflowStep,
  type WorkflowElement,
  type WorkflowMetadata,
  type WorkflowProgress,
  type WorkflowBuilderState,
  type WorkflowValidation,
} from './workflow-store'

// ============================================================================
// Auth Store Exports
// ============================================================================

export {
  // Store hook and instance
  useAuthStore,
  authStore,
  
  // Store types
  type AuthState,
  type AuthActions,
  type AuthSelectors,
  
  // Domain types
  type User,
  type UserProfile,
  type UserSession,
  type UserPermissions,
  type UserRole,
  type ClientContext,
  type FeatureFlags,
  type AuthConfig,
  type SessionRefreshResult,
} from './auth-store'

// ============================================================================
// UI Store Exports
// ============================================================================

export {
  // Store hook and instance
  useUIStore,
  uiStore,
  
  // Store types
  type UIState,
  type UIActions,
  type UISelectors,
  
  // Domain types
  type UserPreferences,
  type NotificationState,
  type ToastMessage,
  type ModalState,
  type LoadingState,
  type ThemeConfig,
  type SidebarState,
  type UndoRedoState,
} from './ui-store'

// ============================================================================
// UI Builder Store Exports
// ============================================================================

export {
  // Store hook and instance
  useUIBuilderStore,
  uiBuilderStore,
  
  // Store types
  type UIBuilderState,
  type UIBuilderActions,
  type UIBuilderSelectors,
  
  // Domain types
  type BuilderMode,
  type BuilderSelection,
  type BuilderClipboard,
  type BuilderHistory,
  type BuilderValidation,
  type BuilderPreview,
} from './ui-store-builder'

// ============================================================================
// Cache Store Exports
// ============================================================================

export {
  // Store hook and instance
  useCacheStore,
  cacheStore,
  
  // Store types
  type CacheState,
  type CacheActions,
  type CacheSelectors,
  
  // Domain types
  type CacheEntry,
  type CacheMetrics,
  type CacheConfig,
  type CacheStats,
  type EvictionStrategy,
  type CacheLayer,
  type CacheImportExport,
} from './cache-store'

// ============================================================================
// Store Utilities
// ============================================================================

/**
 * Initialize all domain stores with debug integration
 */
export function initializeDomainStores(options: {
  enableDebug?: boolean
  enablePerformanceMonitoring?: boolean
  enableEventIntegration?: boolean
} = {}) {
  const {
    enableDebug = process.env.NODE_ENV === 'development',
    enablePerformanceMonitoring = true,
    enableEventIntegration = true
  } = options

  // Register stores with global coordinator if composition is enabled
  if (enableEventIntegration) {
    try {
      const { registerStore } = require('../composition/store-coordinator')
      
      registerStore('workflow', workflowStore)
      registerStore('auth', authStore)
      registerStore('ui', uiStore)
      registerStore('ui-builder', uiBuilderStore)
      registerStore('cache', cacheStore)
      
      console.log('✅ Domain stores registered with coordinator')
    } catch (error) {
      console.warn('⚠️ Could not register stores with coordinator:', error)
    }
  }

  return {
    stores: {
      workflow: workflowStore,
      auth: authStore,
      ui: uiStore,
      uiBuilder: uiBuilderStore,
      cache: cacheStore
    },
    hooks: {
      useWorkflowStore,
      useAuthStore,
      useUIStore,
      useUIBuilderStore,
      useCacheStore
    },
    options: {
      enableDebug,
      enablePerformanceMonitoring,
      enableEventIntegration
    }
  }
}

/**
 * Get all store states for debugging
 */
export function getAllStoreStates() {
  return {
    workflow: workflowStore.getState(),
    auth: authStore.getState(),
    ui: uiStore.getState(),
    uiBuilder: uiBuilderStore.getState(),
    cache: cacheStore.getState(),
    timestamp: Date.now()
  }
}

/**
 * Reset all stores to initial state (development only)
 */
export function resetAllStores() {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('resetAllStores is only available in development mode')
    return
  }

  // Reset each store to its initial state
  workflowStore.setState(workflowStore.getInitialState?.() || {})
  authStore.setState(authStore.getInitialState?.() || {})
  uiStore.setState(uiStore.getInitialState?.() || {})
  uiBuilderStore.setState(uiBuilderStore.getInitialState?.() || {})
  cacheStore.setState(cacheStore.getInitialState?.() || {})

  console.log('🔄 All stores reset to initial state')
}

/**
 * Subscribe to all store changes for debugging
 */
export function subscribeToAllStores(callback: (storeName: string, state: any) => void) {
  const unsubscribers = [
    workflowStore.subscribe((state) => callback('workflow', state)),
    authStore.subscribe((state) => callback('auth', state)),
    uiStore.subscribe((state) => callback('ui', state)),
    uiBuilderStore.subscribe((state) => callback('ui-builder', state)),
    cacheStore.subscribe((state) => callback('cache', state))
  ]

  return () => {
    unsubscribers.forEach(unsub => unsub())
  }
}

// ============================================================================
// Store Composition Helpers
// ============================================================================

/**
 * Create a composed store provider that includes all domain stores
 */
export function createDomainStoreProvider() {
  try {
    const { createMultiStoreProvider } = require('../composition/context-providers')
    
    return createMultiStoreProvider({
      stores: {
        workflow: {
          name: 'workflow',
          initialState: workflowStore.getState(),
          actions: () => ({}) // Actions are already in the store
        },
        auth: {
          name: 'auth',
          initialState: authStore.getState(),
          actions: () => ({})
        },
        ui: {
          name: 'ui',
          initialState: uiStore.getState(),
          actions: () => ({})
        },
        cache: {
          name: 'cache',
          initialState: cacheStore.getState(),
          actions: () => ({})
        }
      },
      options: {
        enableCoordination: true,
        enableEventIntegration: true,
        storeName: 'domain-stores',
        autoCleanup: true
      }
    })
  } catch (error) {
    console.warn('⚠️ Could not create domain store provider:', error)
    return null
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Store instances
  stores: {
    workflow: workflowStore,
    auth: authStore,
    ui: uiStore,
    uiBuilder: uiBuilderStore,
    cache: cacheStore
  },
  
  // Store hooks
  hooks: {
    useWorkflowStore,
    useAuthStore,
    useUIStore,
    useUIBuilderStore,
    useCacheStore
  },
  
  // Utilities
  initializeDomainStores,
  getAllStoreStates,
  resetAllStores,
  subscribeToAllStores,
  createDomainStoreProvider
} 