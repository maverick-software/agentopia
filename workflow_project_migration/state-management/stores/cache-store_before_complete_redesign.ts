/**
 * Cache Store Implementation
 * 
 * Manages application-wide caching with LRU, TTL, and multi-level storage
 * support with comprehensive debug integration and performance monitoring.
 */

import { createCacheStore } from '../core/store-debug';
import type { 
  CacheState, 
  CacheEntry,
  CacheConfig,
  CacheStats,
  StateCreator
} from '../core/types';

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialCacheState: CacheState = {
  // Base state properties
  loading: false,
  error: null,
  lastUpdated: null,
  
  // Cache-specific state
  entries: {},
  metadata: {},
  stats: {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
    lastCleanup: Date.now(),
  },
  config: {
    maxSize: 100 * 1024 * 1024, // 100MB
    maxEntries: 10000,
    defaultTTL: 30 * 60 * 1000, // 30 minutes
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
    enablePersistence: true,
    persistenceKey: 'catalyst-cache',
  },
};

// ============================================================================
// STORE CREATOR
// ============================================================================

const createCacheStoreImpl: StateCreator<CacheState> = (set, get) => ({
  ...initialCacheState,

  // ============================================================================
  // CACHE OPERATIONS
  // ============================================================================

  /**
   * Get cache entry by key
   */
  get: (key: string) => {
    const state = get();
    const entry = state.entries[key];
    
    if (!entry) {
      // Cache miss
      set((draft) => {
        draft.stats.misses++;
        draft.lastUpdated = Date.now();
      });
      return null;
    }

    // Check if entry is expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      // Remove expired entry
      set((draft) => {
        delete draft.entries[key];
        delete draft.metadata[key];
        draft.stats.misses++;
        draft.stats.evictions++;
        draft.stats.totalSize -= entry.size;
        draft.lastUpdated = Date.now();
      });
      return null;
    }

    // Cache hit - update access time
    set((draft) => {
      if (draft.entries[key]) {
        draft.entries[key].lastAccessed = Date.now();
        draft.entries[key].accessCount++;
        draft.stats.hits++;
        draft.lastUpdated = Date.now();
      }
    });

    return entry.data;
  },

  /**
   * Set cache entry
   */
  set: (key: string, data: any, options?: { ttl?: number; priority?: 'low' | 'medium' | 'high' }) => {
    const state = get();
    const now = Date.now();
    const ttl = options?.ttl || state.config.defaultTTL;
    const priority = options?.priority || 'medium';
    
    // Calculate entry size (rough estimate)
    const size = JSON.stringify(data).length * 2; // Rough UTF-16 size estimate
    
    const entry: CacheEntry = {
      key,
      data,
      size,
      createdAt: now,
      lastAccessed: now,
      expiresAt: ttl > 0 ? now + ttl : null,
      accessCount: 0,
      priority,
    };

    set((draft) => {
      // Remove existing entry if it exists
      if (draft.entries[key]) {
        draft.stats.totalSize -= draft.entries[key].size;
      }

      // Add new entry
      draft.entries[key] = entry;
      draft.metadata[key] = {
        key,
        size,
        createdAt: now,
        lastAccessed: now,
        expiresAt: entry.expiresAt,
        priority,
      };
      
      draft.stats.totalSize += size;
      draft.lastUpdated = now;
    });

    // Check if cleanup is needed
    const newState = get();
    if (newState.stats.totalSize > newState.config.maxSize || 
        Object.keys(newState.entries).length > newState.config.maxEntries) {
      newState.cleanup();
    }
  },

  /**
   * Delete cache entry
   */
  delete: (key: string) => {
    set((draft) => {
      const entry = draft.entries[key];
      if (entry) {
        delete draft.entries[key];
        delete draft.metadata[key];
        draft.stats.totalSize -= entry.size;
        draft.stats.evictions++;
        draft.lastUpdated = Date.now();
      }
    });
  },

  /**
   * Check if key exists in cache
   */
  has: (key: string) => {
    const state = get();
    const entry = state.entries[key];
    
    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      // Remove expired entry
      state.delete(key);
      return false;
    }

    return true;
  },

  /**
   * Clear all cache entries
   */
  clear: () => {
    set((draft) => {
      draft.entries = {};
      draft.metadata = {};
      draft.stats.totalSize = 0;
      draft.stats.evictions += Object.keys(draft.entries).length;
      draft.lastUpdated = Date.now();
    });
  },

  /**
   * Get cache keys
   */
  keys: () => {
    const state = get();
    return Object.keys(state.entries);
  },

  /**
   * Get cache size
   */
  size: () => {
    const state = get();
    return Object.keys(state.entries).length;
  },

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * Cleanup expired and least recently used entries
   */
  cleanup: () => {
    const state = get();
    const now = Date.now();
    const entries = Object.values(state.entries);
    
    // Find expired entries
    const expiredKeys = entries
      .filter(entry => entry.expiresAt && entry.expiresAt < now)
      .map(entry => entry.key);

    // Remove expired entries
    set((draft) => {
      expiredKeys.forEach(key => {
        const entry = draft.entries[key];
        if (entry) {
          delete draft.entries[key];
          delete draft.metadata[key];
          draft.stats.totalSize -= entry.size;
          draft.stats.evictions++;
        }
      });
    });

    // Check if we still need to evict more entries
    const newState = get();
    if (newState.stats.totalSize > newState.config.maxSize || 
        Object.keys(newState.entries).length > newState.config.maxEntries) {
      
      // Sort by LRU (least recently used first) and priority
      const sortedEntries = Object.values(newState.entries).sort((a, b) => {
        // First sort by priority (low priority first)
        const priorityOrder = { low: 0, medium: 1, high: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        
        // Then by last accessed time (oldest first)
        return a.lastAccessed - b.lastAccessed;
      });

      // Calculate how many entries to remove
      const targetSize = newState.config.maxSize * 0.8; // Remove to 80% capacity
      const targetEntries = newState.config.maxEntries * 0.8;
      
      let currentSize = newState.stats.totalSize;
      let currentEntries = Object.keys(newState.entries).length;
      const keysToRemove: string[] = [];

      for (const entry of sortedEntries) {
        if (currentSize <= targetSize && currentEntries <= targetEntries) {
          break;
        }
        
        keysToRemove.push(entry.key);
        currentSize -= entry.size;
        currentEntries--;
      }

      // Remove selected entries
      set((draft) => {
        keysToRemove.forEach(key => {
          const entry = draft.entries[key];
          if (entry) {
            delete draft.entries[key];
            delete draft.metadata[key];
            draft.stats.totalSize -= entry.size;
            draft.stats.evictions++;
          }
        });
        draft.stats.lastCleanup = now;
        draft.lastUpdated = now;
      });
    }
  },

  /**
   * Update cache configuration
   */
  updateConfig: (updates: Partial<CacheConfig>) => {
    set((draft) => {
      Object.assign(draft.config, updates);
      draft.lastUpdated = Date.now();
    });

    // Trigger cleanup if new limits are exceeded
    const state = get();
    if (state.stats.totalSize > state.config.maxSize || 
        Object.keys(state.entries).length > state.config.maxEntries) {
      state.cleanup();
    }
  },

  /**
   * Get cache statistics
   */
  getStats: () => {
    const state = get();
    const hitRate = state.stats.hits + state.stats.misses > 0 
      ? state.stats.hits / (state.stats.hits + state.stats.misses) 
      : 0;

    return {
      ...state.stats,
      hitRate,
      entryCount: Object.keys(state.entries).length,
      averageEntrySize: Object.keys(state.entries).length > 0 
        ? state.stats.totalSize / Object.keys(state.entries).length 
        : 0,
    };
  },

  /**
   * Reset cache statistics
   */
  resetStats: () => {
    set((draft) => {
      draft.stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        totalSize: draft.stats.totalSize, // Keep current size
        lastCleanup: Date.now(),
      };
      draft.lastUpdated = Date.now();
    });
  },

  // ============================================================================
  // UTILITY ACTIONS
  // ============================================================================

  /**
   * Reset store to initial state
   */
  reset: () => {
    set(() => ({ ...initialCacheState }));
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
   * Export cache data for persistence
   */
  export: () => {
    const state = get();
    return {
      entries: state.entries,
      metadata: state.metadata,
      stats: state.stats,
      exportedAt: Date.now(),
    };
  },

  /**
   * Import cache data from persistence
   */
  import: (data: ReturnType<CacheState['export']>) => {
    const now = Date.now();
    
    set((draft) => {
      // Filter out expired entries during import
      Object.entries(data.entries).forEach(([key, entry]) => {
        if (!entry.expiresAt || entry.expiresAt > now) {
          draft.entries[key] = entry;
          draft.metadata[key] = data.metadata[key];
        }
      });
      
      // Recalculate total size
      draft.stats.totalSize = Object.values(draft.entries)
        .reduce((total, entry) => total + entry.size, 0);
      
      draft.lastUpdated = now;
    });

    // Cleanup if necessary
    const state = get();
    if (state.stats.totalSize > state.config.maxSize || 
        Object.keys(state.entries).length > state.config.maxEntries) {
      state.cleanup();
    }
  },
});

// ============================================================================
// STORE INSTANCE
// ============================================================================

/**
 * Cache store with debug integration and performance monitoring
 */
export const useCacheStore = createCacheStore(
  'cache',
  createCacheStoreImpl,
  {
    debug: {
      enabled: true,
      enableLogging: true,
      enablePerformanceMonitoring: true,
      enableStateInspection: true,
      logCategory: 'cache',
      performanceCategory: 'cache-operation',
      logLevel: 'debug',
    },
  }
);

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Get cache entry by key
 */
export const selectCacheEntry = (key: string) => (state: CacheState) =>
  state.entries[key] || null;

/**
 * Get cache metadata by key
 */
export const selectCacheMetadata = (key: string) => (state: CacheState) =>
  state.metadata[key] || null;

/**
 * Get cache statistics
 */
export const selectCacheStats = (state: CacheState) => {
  const hitRate = state.stats.hits + state.stats.misses > 0 
    ? state.stats.hits / (state.stats.hits + state.stats.misses) 
    : 0;

  return {
    ...state.stats,
    hitRate,
    entryCount: Object.keys(state.entries).length,
    averageEntrySize: Object.keys(state.entries).length > 0 
      ? state.stats.totalSize / Object.keys(state.entries).length 
      : 0,
  };
};

/**
 * Get cache configuration
 */
export const selectCacheConfig = (state: CacheState) => state.config;

/**
 * Get all cache keys
 */
export const selectCacheKeys = (state: CacheState) => Object.keys(state.entries);

/**
 * Get cache size
 */
export const selectCacheSize = (state: CacheState) => Object.keys(state.entries).length;

/**
 * Check if cache has key
 */
export const selectCacheHasKey = (key: string) => (state: CacheState) => {
  const entry = state.entries[key];
  if (!entry) return false;
  
  // Check if expired
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    return false;
  }
  
  return true;
};

/**
 * Get cache hit rate
 */
export const selectCacheHitRate = (state: CacheState) => {
  const total = state.stats.hits + state.stats.misses;
  return total > 0 ? state.stats.hits / total : 0;
}; 