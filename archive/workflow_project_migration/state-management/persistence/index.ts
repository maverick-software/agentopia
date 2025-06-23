/**
 * State Persistence Module
 * 
 * Comprehensive state persistence utilities for Zustand stores with support
 * for multiple storage engines, migration strategies, and performance optimization.
 */

// ============================================================================
// Advanced Persistence Middleware
// ============================================================================

export {
  // Main persistence middleware
  persist,
  
  // Utility functions
  createPersistenceConfig,
  createSelectivePersistence,
  createTemporaryPersistence,
  createLargeDataPersistence,
  
  // Types
  type PersistenceConfig,
  type PersistenceState,
  type PersistenceAPI,
  type StorageAdapter,
  type StorageEngine
} from '../core/middleware/persistence'

// ============================================================================
// Persistence Utilities
// ============================================================================

/**
 * Create a persistence configuration for user preferences
 */
export const createUserPreferencesPersistence = <T>(
  userId: string,
  overrides: Partial<PersistenceConfig<T>> = {}
): PersistenceConfig<T> => {
  return createPersistenceConfig(`user-preferences-${userId}`, {
    storage: 'localStorage',
    version: 1,
    debounceMs: 300, // Longer debounce for preferences
    validate: (state) => typeof state === 'object' && state !== null,
    ...overrides
  })
}

/**
 * Create a persistence configuration for session data
 */
export const createSessionPersistence = <T>(
  sessionId: string,
  overrides: Partial<PersistenceConfig<T>> = {}
): PersistenceConfig<T> => {
  return createTemporaryPersistence(`session-${sessionId}`, {
    debounceMs: 50, // Fast updates for session data
    ...overrides
  })
}

/**
 * Create a persistence configuration for workflow data
 */
export const createWorkflowPersistence = <T>(
  workflowId: string,
  overrides: Partial<PersistenceConfig<T>> = {}
): PersistenceConfig<T> => {
  return createLargeDataPersistence(`workflow-${workflowId}`, {
    version: 1,
    debounceMs: 1000, // Slower updates for large workflow data
    validate: (state) => {
      return typeof state === 'object' && 
             state !== null && 
             'id' in state && 
             'status' in state
    },
    ...overrides
  })
}

/**
 * Create a persistence configuration for cache data
 */
export const createCachePersistence = <T>(
  cacheKey: string,
  overrides: Partial<PersistenceConfig<T>> = {}
): PersistenceConfig<T> => {
  return createPersistenceConfig(`cache-${cacheKey}`, {
    storage: 'indexedDB', // Use IndexedDB for large cache data
    version: 1,
    debounceMs: 200,
    validate: (state) => {
      return typeof state === 'object' && 
             state !== null && 
             'entries' in state
    },
    ...overrides
  })
}

// ============================================================================
// Migration Utilities
// ============================================================================

/**
 * Create a migration function for version upgrades
 */
export const createMigration = <T>(
  migrations: Record<number, (state: any) => any>
) => {
  return (persistedState: any, version: number): T => {
    let currentState = persistedState
    const targetVersion = Math.max(...Object.keys(migrations).map(Number))
    
    for (let v = version; v < targetVersion; v++) {
      const migration = migrations[v + 1]
      if (migration) {
        currentState = migration(currentState)
      }
    }
    
    return currentState
  }
}

/**
 * Common migration patterns
 */
export const migrationPatterns = {
  /**
   * Add a new field with default value
   */
  addField: <T>(fieldName: keyof T, defaultValue: T[keyof T]) => 
    (state: any): any => ({
      ...state,
      [fieldName]: state[fieldName] ?? defaultValue
    }),

  /**
   * Remove a field
   */
  removeField: <T>(fieldName: keyof T) => 
    (state: any): any => {
      const { [fieldName]: removed, ...rest } = state
      return rest
    },

  /**
   * Rename a field
   */
  renameField: <T>(oldName: string, newName: keyof T) => 
    (state: any): any => {
      if (oldName in state) {
        const { [oldName]: value, ...rest } = state
        return { ...rest, [newName]: value }
      }
      return state
    },

  /**
   * Transform field value
   */
  transformField: <T>(fieldName: keyof T, transform: (value: any) => any) => 
    (state: any): any => ({
      ...state,
      [fieldName]: fieldName in state ? transform(state[fieldName]) : state[fieldName]
    }),

  /**
   * Restructure nested object
   */
  restructure: <T>(transform: (state: any) => any) => transform
}

// ============================================================================
// Storage Utilities
// ============================================================================

/**
 * Check if a storage engine is available
 */
export const isStorageAvailable = (storage: StorageEngine): boolean => {
  try {
    switch (storage) {
      case 'localStorage':
        return typeof localStorage !== 'undefined'
      case 'sessionStorage':
        return typeof sessionStorage !== 'undefined'
      case 'indexedDB':
        return typeof indexedDB !== 'undefined'
      case 'memory':
        return true
      default:
        return false
    }
  } catch {
    return false
  }
}

/**
 * Get storage capacity information
 */
export const getStorageInfo = async (storage: StorageEngine): Promise<{
  available: boolean
  quota?: number
  usage?: number
  remaining?: number
}> => {
  if (!isStorageAvailable(storage)) {
    return { available: false }
  }

  try {
    if (storage === 'indexedDB' && 'storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      return {
        available: true,
        quota: estimate.quota,
        usage: estimate.usage,
        remaining: estimate.quota && estimate.usage ? estimate.quota - estimate.usage : undefined
      }
    }

    // For localStorage/sessionStorage, we can't get exact quota
    // but we can estimate based on typical browser limits
    if (storage === 'localStorage' || storage === 'sessionStorage') {
      return {
        available: true,
        quota: 5 * 1024 * 1024, // Typical 5MB limit
        usage: undefined,
        remaining: undefined
      }
    }

    return { available: true }
  } catch {
    return { available: false }
  }
}

/**
 * Clear all persisted data for a specific prefix
 */
export const clearPersistedData = async (
  prefix: string,
  storage: StorageEngine = 'localStorage'
): Promise<void> => {
  if (!isStorageAvailable(storage)) {
    throw new Error(`Storage ${storage} is not available`)
  }

  try {
    switch (storage) {
      case 'localStorage':
        Object.keys(localStorage)
          .filter(key => key.startsWith(prefix))
          .forEach(key => localStorage.removeItem(key))
        break

      case 'sessionStorage':
        Object.keys(sessionStorage)
          .filter(key => key.startsWith(prefix))
          .forEach(key => sessionStorage.removeItem(key))
        break

      case 'indexedDB':
        // For IndexedDB, we'd need to open the database and clear specific keys
        // This is more complex and would require the specific adapter
        throw new Error('IndexedDB prefix clearing not implemented')

      case 'memory':
        // Memory storage is handled by individual adapters
        break
    }
  } catch (error) {
    throw new Error(`Failed to clear persisted data: ${error}`)
  }
}

// ============================================================================
// Export Types
// ============================================================================

export type {
  PersistenceConfig,
  PersistenceState,
  PersistenceAPI,
  StorageAdapter,
  StorageEngine
} from '../core/middleware/persistence' 