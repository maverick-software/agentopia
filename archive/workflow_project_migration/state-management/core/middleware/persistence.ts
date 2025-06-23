/**
 * State Persistence Middleware
 * 
 * Provides comprehensive state persistence capabilities with support for multiple
 * storage engines, migration strategies, and performance optimization.
 */

import { StateCreator, StoreMutatorIdentifier, StoreApi } from 'zustand'
import { logger } from '../../debug/logger'
import { performanceMonitor } from '../../debug/performance-monitor'

// ============================================================================
// Types & Interfaces
// ============================================================================

type Write<T, U> = Omit<T, keyof U> & U

export type StorageEngine = 'localStorage' | 'sessionStorage' | 'indexedDB' | 'memory'

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null> | string | null
  setItem: (key: string, value: string) => Promise<void> | void
  removeItem: (key: string) => Promise<void> | void
  clear?: () => Promise<void> | void
}

export interface PersistenceConfig<T = any> {
  // Required
  name: string
  
  // Storage configuration
  storage?: StorageEngine | StorageAdapter
  
  // State management
  partialize?: (state: T) => Partial<T>
  merge?: (persistedState: any, currentState: T) => T
  
  // Migration
  version?: number
  migrate?: (persistedState: any, version: number) => any
  
  // Serialization
  serialize?: (state: any) => string
  deserialize?: (str: string) => any
  
  // Performance
  debounceMs?: number
  skipHydration?: boolean
  
  // Lifecycle hooks
  onRehydrateStorage?: (state: T) => ((state?: T, error?: Error) => void) | void
  onHydrate?: (state: T) => void
  onFinishHydration?: (state: T) => void
  
  // Error handling
  onError?: (error: Error) => void
  
  // Validation
  validate?: (state: any) => boolean
}

export interface PersistenceState {
  _hasHydrated: boolean
  _isHydrating: boolean
  _persistenceError: Error | null
  _lastPersisted: number | null
}

export interface PersistenceAPI {
  rehydrate: () => Promise<void>
  persist: () => Promise<void>
  clearStorage: () => Promise<void>
  getOptions: () => PersistenceConfig
  setOptions: (options: Partial<PersistenceConfig>) => void
  hasHydrated: () => boolean
  isHydrating: () => boolean
  getLastPersisted: () => number | null
}

// ============================================================================
// Storage Adapters
// ============================================================================

const createLocalStorageAdapter = (): StorageAdapter => ({
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key)
    } catch (error) {
      logger.warn('localStorage.getItem failed', { key, error })
      return null
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value)
    } catch (error) {
      logger.error('localStorage.setItem failed', { key, error })
      throw error
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      logger.warn('localStorage.removeItem failed', { key, error })
    }
  },
  clear: () => {
    try {
      localStorage.clear()
    } catch (error) {
      logger.warn('localStorage.clear failed', { error })
    }
  }
})

const createSessionStorageAdapter = (): StorageAdapter => ({
  getItem: (key: string) => {
    try {
      return sessionStorage.getItem(key)
    } catch (error) {
      logger.warn('sessionStorage.getItem failed', { key, error })
      return null
    }
  },
  setItem: (key: string, value: string) => {
    try {
      sessionStorage.setItem(key, value)
    } catch (error) {
      logger.error('sessionStorage.setItem failed', { key, error })
      throw error
    }
  },
  removeItem: (key: string) => {
    try {
      sessionStorage.removeItem(key)
    } catch (error) {
      logger.warn('sessionStorage.removeItem failed', { key, error })
    }
  },
  clear: () => {
    try {
      sessionStorage.clear()
    } catch (error) {
      logger.warn('sessionStorage.clear failed', { error })
    }
  }
})

const createIndexedDBAdapter = (dbName = 'zustand-storage'): StorageAdapter => {
  let db: IDBDatabase | null = null

  const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      if (db) {
        resolve(db)
        return
      }

      const request = indexedDB.open(dbName, 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        db = request.result
        resolve(db)
      }
      
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains('keyval')) {
          database.createObjectStore('keyval')
        }
      }
    })
  }

  return {
    getItem: async (key: string) => {
      try {
        const database = await initDB()
        const transaction = database.transaction(['keyval'], 'readonly')
        const store = transaction.objectStore('keyval')
        
        return new Promise((resolve, reject) => {
          const request = store.get(key)
          request.onerror = () => reject(request.error)
          request.onsuccess = () => resolve(request.result || null)
        })
      } catch (error) {
        logger.warn('IndexedDB.getItem failed', { key, error })
        return null
      }
    },
    
    setItem: async (key: string, value: string) => {
      try {
        const database = await initDB()
        const transaction = database.transaction(['keyval'], 'readwrite')
        const store = transaction.objectStore('keyval')
        
        return new Promise<void>((resolve, reject) => {
          const request = store.put(value, key)
          request.onerror = () => reject(request.error)
          request.onsuccess = () => resolve()
        })
      } catch (error) {
        logger.error('IndexedDB.setItem failed', { key, error })
        throw error
      }
    },
    
    removeItem: async (key: string) => {
      try {
        const database = await initDB()
        const transaction = database.transaction(['keyval'], 'readwrite')
        const store = transaction.objectStore('keyval')
        
        return new Promise<void>((resolve, reject) => {
          const request = store.delete(key)
          request.onerror = () => reject(request.error)
          request.onsuccess = () => resolve()
        })
      } catch (error) {
        logger.warn('IndexedDB.removeItem failed', { key, error })
      }
    },
    
    clear: async () => {
      try {
        const database = await initDB()
        const transaction = database.transaction(['keyval'], 'readwrite')
        const store = transaction.objectStore('keyval')
        
        return new Promise<void>((resolve, reject) => {
          const request = store.clear()
          request.onerror = () => reject(request.error)
          request.onsuccess = () => resolve()
        })
      } catch (error) {
        logger.warn('IndexedDB.clear failed', { error })
      }
    }
  }
}

const createMemoryAdapter = (): StorageAdapter => {
  const storage = new Map<string, string>()
  
  return {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
    clear: () => {
      storage.clear()
    }
  }
}

// ============================================================================
// Storage Factory
// ============================================================================

const createStorageAdapter = (storage: StorageEngine | StorageAdapter): StorageAdapter => {
  if (typeof storage === 'object') {
    return storage
  }

  switch (storage) {
    case 'localStorage':
      return createLocalStorageAdapter()
    case 'sessionStorage':
      return createSessionStorageAdapter()
    case 'indexedDB':
      return createIndexedDBAdapter()
    case 'memory':
      return createMemoryAdapter()
    default:
      logger.warn('Unknown storage engine, falling back to localStorage', { storage })
      return createLocalStorageAdapter()
  }
}

// ============================================================================
// Persistence Implementation
// ============================================================================

type PersistImpl = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  stateCreator: StateCreator<T & PersistenceState, Mps, Mcs>,
  options: PersistenceConfig<T>
) => StateCreator<T & PersistenceState & PersistenceAPI, Mps, [['persist', unknown], ...Mcs]>

type PersistStoreMutators = [['persist', unknown]]

declare module 'zustand/vanilla' {
  interface StoreMutators<S, A> {
    persist: Write<S, StoreApi<S & PersistenceState & PersistenceAPI>>
  }
}

// ============================================================================
// Main Persistence Middleware
// ============================================================================

export const persist: PersistImpl = (stateCreator, options) => (set, get, store) => {
  const {
    name,
    storage = 'localStorage',
    partialize = (state) => state,
    merge = (persistedState, currentState) => ({ ...currentState, ...persistedState }),
    version = 0,
    migrate,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    debounceMs = 100,
    skipHydration = false,
    onRehydrateStorage,
    onHydrate,
    onFinishHydration,
    onError,
    validate = () => true
  } = options

  let config = { ...options }
  const storageAdapter = createStorageAdapter(storage)
  let debounceTimer: NodeJS.Timeout | null = null

  // Initialize persistence state
  const persistenceState: PersistenceState = {
    _hasHydrated: false,
    _isHydrating: false,
    _persistenceError: null,
    _lastPersisted: null
  }

  // Create the base state
  const baseState = stateCreator(
    (...args) => {
      set(...args)
      // Trigger persistence after state update
      if (debounceMs > 0) {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => persistState(), debounceMs)
      } else {
        persistState()
      }
    },
    get,
    store
  )

  // Persistence functions
  const persistState = async (): Promise<void> => {
    try {
      const startTime = performance.now()
      const currentState = get()
      const stateToPersist = partialize(currentState)
      
      const serializedState = serialize({
        state: stateToPersist,
        version
      })

      await storageAdapter.setItem(name, serializedState)
      
      // Update persistence metadata
      set({ _lastPersisted: Date.now() } as any)

      // Record performance
      const duration = performance.now() - startTime
      performanceMonitor.recordMetric('persistence_write_time', duration)
      
      if (config.onFinishHydration) {
        logger.debug('State persisted successfully', { 
          name, 
          duration,
          size: serializedState.length 
        })
      }

    } catch (error) {
      const persistError = error as Error
      set({ _persistenceError: persistError } as any)
      
      logger.error('Failed to persist state', { 
        name, 
        error: persistError.message,
        stack: persistError.stack 
      })
      
      if (onError) {
        onError(persistError)
      }
    }
  }

  const rehydrateState = async (): Promise<void> => {
    if (get()._isHydrating) return

    try {
      set({ _isHydrating: true } as any)
      
      if (onHydrate) {
        onHydrate(get())
      }

      const startTime = performance.now()
      const serializedState = await storageAdapter.getItem(name)
      
      if (!serializedState) {
        set({ 
          _hasHydrated: true, 
          _isHydrating: false,
          _persistenceError: null 
        } as any)
        return
      }

      const persistedData = deserialize(serializedState)
      
      // Validate persisted data
      if (!validate(persistedData)) {
        throw new Error('Persisted state validation failed')
      }

      let { state: persistedState, version: persistedVersion = 0 } = persistedData

      // Handle migration
      if (migrate && persistedVersion !== version) {
        logger.info('Migrating persisted state', { 
          from: persistedVersion, 
          to: version 
        })
        persistedState = migrate(persistedState, persistedVersion)
      }

      // Merge with current state
      const currentState = get()
      const mergedState = merge(persistedState, currentState)

      set({
        ...mergedState,
        _hasHydrated: true,
        _isHydrating: false,
        _persistenceError: null,
        _lastPersisted: Date.now()
      } as any)

      // Record performance
      const duration = performance.now() - startTime
      performanceMonitor.recordMetric('persistence_read_time', duration)
      
      logger.debug('State rehydrated successfully', { 
        name, 
        duration,
        migrated: persistedVersion !== version 
      })

      if (onFinishHydration) {
        onFinishHydration(get())
      }

    } catch (error) {
      const rehydrateError = error as Error
      set({ 
        _hasHydrated: true, 
        _isHydrating: false,
        _persistenceError: rehydrateError 
      } as any)
      
      logger.error('Failed to rehydrate state', { 
        name, 
        error: rehydrateError.message,
        stack: rehydrateError.stack 
      })
      
      if (onError) {
        onError(rehydrateError)
      }
    }
  }

  // API functions
  const api: PersistenceAPI = {
    rehydrate: rehydrateState,
    persist: persistState,
    clearStorage: async () => {
      try {
        await storageAdapter.removeItem(name)
        set({ 
          _hasHydrated: false,
          _lastPersisted: null,
          _persistenceError: null 
        } as any)
        logger.debug('Storage cleared', { name })
      } catch (error) {
        logger.error('Failed to clear storage', { name, error })
        throw error
      }
    },
    getOptions: () => config,
    setOptions: (newOptions) => {
      config = { ...config, ...newOptions }
    },
    hasHydrated: () => get()._hasHydrated,
    isHydrating: () => get()._isHydrating,
    getLastPersisted: () => get()._lastPersisted
  }

  // Initialize hydration
  if (!skipHydration) {
    rehydrateState()
  }

  // Setup rehydration callback
  if (onRehydrateStorage) {
    const callback = onRehydrateStorage(get())
    if (callback) {
      // Store callback for later use
      store.persist = { ...api, onRehydrateCallback: callback }
    }
  }

  return {
    ...baseState,
    ...persistenceState,
    ...api
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a persistence configuration with sensible defaults
 */
export const createPersistenceConfig = <T>(
  name: string,
  overrides: Partial<PersistenceConfig<T>> = {}
): PersistenceConfig<T> => {
  return {
    name,
    storage: 'localStorage',
    version: 1,
    debounceMs: 100,
    skipHydration: false,
    validate: (state) => typeof state === 'object' && state !== null,
    onError: (error) => {
      logger.error('Persistence error', { name, error: error.message })
    },
    ...overrides
  }
}

/**
 * Create a selective persistence configuration
 */
export const createSelectivePersistence = <T>(
  name: string,
  fields: (keyof T)[],
  overrides: Partial<PersistenceConfig<T>> = {}
): PersistenceConfig<T> => {
  return createPersistenceConfig(name, {
    partialize: (state) => {
      const result: Partial<T> = {}
      fields.forEach(field => {
        if (field in state) {
          result[field] = state[field]
        }
      })
      return result
    },
    ...overrides
  })
}

/**
 * Create a temporary persistence configuration (sessionStorage)
 */
export const createTemporaryPersistence = <T>(
  name: string,
  overrides: Partial<PersistenceConfig<T>> = {}
): PersistenceConfig<T> => {
  return createPersistenceConfig(name, {
    storage: 'sessionStorage',
    ...overrides
  })
}

/**
 * Create a large data persistence configuration (IndexedDB)
 */
export const createLargeDataPersistence = <T>(
  name: string,
  overrides: Partial<PersistenceConfig<T>> = {}
): PersistenceConfig<T> => {
  return createPersistenceConfig(name, {
    storage: 'indexedDB',
    debounceMs: 500, // Longer debounce for large data
    ...overrides
  })
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
} 