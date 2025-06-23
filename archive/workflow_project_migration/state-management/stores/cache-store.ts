/**
 * Cache Store Implementation
 * 
 * Meta-store that manages cache configurations, monitors cache health,
 * and provides cache metrics for the unified cache integration system.
 */

import { createCacheStore } from '../core/store-debug';
import { 
  getCached, 
  setCached, 
  createCacheKey
} from '../cache/cache-integration';
import { globalEventBus } from '../composition/event-bus';
import type { 
  CacheState,
  CacheMetrics,
  CacheConfig,
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
  
  // Cache metrics
  metrics: {
    totalSize: 0,
    hitRate: 0,
    missRate: 0,
    evictionCount: 0,
    totalRequests: 0,
    averageResponseTime: 0,
  },
  
  // Cache health status
  status: 'healthy',
  
  // Last cleanup timestamp
  lastCleanup: null,
  
  // Cache configurations for different data types
  config: {
    'user:prefs': {
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      maxSize: 1000,
      storage: 'local',
      serialize: true,
      compress: false,
    },
    'permissions': {
      ttl: 15 * 60 * 1000, // 15 minutes
      maxSize: 500,
      storage: 'memory',
      serialize: true,
      compress: false,
    },
    'templates': {
      ttl: 30 * 60 * 1000, // 30 minutes
      maxSize: 200,
      storage: 'memory',
      serialize: true,
      compress: true,
    },
    'instances': {
      ttl: 5 * 60 * 1000, // 5 minutes
      maxSize: 1000,
      storage: 'session',
      serialize: true,
      compress: false,
    },
    'ui:state': {
      ttl: 60 * 60 * 1000, // 1 hour
      maxSize: 100,
      storage: 'memory',
      serialize: true,
      compress: false,
    },
  },
};

// ============================================================================
// STORE CREATOR
// ============================================================================

const createCacheStoreImpl: StateCreator<CacheState> = (set, get) => ({
  ...initialCacheState,

  // ============================================================================
  // CACHE CONFIGURATION MANAGEMENT
  // ============================================================================

  /**
   * Update cache configuration for a specific data type
   */
  updateCacheConfig: async (dataType: string, config: Partial<CacheConfig>) => {
    const state = get();
    
    const newConfig = {
      ...state.config,
      [dataType]: {
        ...state.config[dataType],
        ...config,
      },
    };

    const newState = {
      ...state,
      config: newConfig,
      lastUpdated: new Date().toISOString(),
    };

    set(newState);

    // Emit event for cache system coordination
    globalEventBus.emit('cache:config:updated', {
      dataType,
      config: newConfig[dataType]
    });

    return newConfig[dataType];
  },

  /**
   * Get cache configuration for a data type
   */
  getCacheConfig: (dataType: string) => {
    const state = get();
    return state.config[dataType] || null;
  },

  // ============================================================================
  // CACHE METRICS & MONITORING
  // ============================================================================

  /**
   * Update cache metrics
   */
  updateMetrics: (metrics: Partial<CacheMetrics>) => {
    const state = get();
    
    const newMetrics = {
      ...state.metrics,
      ...metrics,
    };

    const newState = {
      ...state,
      metrics: newMetrics,
      lastUpdated: new Date().toISOString(),
    };

    set(newState);

    // Update cache health status based on metrics
    const hitRate = newMetrics.hitRate;
    let status: CacheState['status'] = 'healthy';
    
    if (hitRate < 0.3) {
      status = 'degraded';
    } else if (hitRate < 0.1) {
      status = 'error';
    }

    if (status !== state.status) {
      set({
        ...newState,
        status,
      });

      // Emit health status change event
      globalEventBus.emit('cache:health:changed', {
        status,
        metrics: newMetrics
      });
    }
  },

  /**
   * Record cache operation metrics
   */
  recordCacheOperation: (type: 'hit' | 'miss', responseTime: number) => {
    const state = get();
    
    const newTotalRequests = state.metrics.totalRequests + 1;
    const newHits = type === 'hit' ? 1 : 0;
    const newMisses = type === 'miss' ? 1 : 0;
    
    const totalHits = (state.metrics.hitRate * state.metrics.totalRequests) + newHits;
    const totalMisses = (state.metrics.missRate * state.metrics.totalRequests) + newMisses;
    
    const newHitRate = newTotalRequests > 0 ? totalHits / newTotalRequests : 0;
    const newMissRate = newTotalRequests > 0 ? totalMisses / newTotalRequests : 0;
    
    // Calculate new average response time
    const currentAvgTotal = state.metrics.averageResponseTime * state.metrics.totalRequests;
    const newAverageResponseTime = newTotalRequests > 0 
      ? (currentAvgTotal + responseTime) / newTotalRequests 
      : responseTime;

    // Update metrics by calling the updateMetrics method
    const store = get() as any; // Get store instance with methods
    store.updateMetrics({
      hitRate: newHitRate,
      missRate: newMissRate,
      totalRequests: newTotalRequests,
      averageResponseTime: newAverageResponseTime,
    });
  },

  /**
   * Record cache eviction
   */
  recordEviction: (count: number = 1) => {
    const state = get();
    
    // Update metrics by calling the updateMetrics method
    const store = get() as any; // Get store instance with methods
    store.updateMetrics({
      evictionCount: state.metrics.evictionCount + count,
    });
  },

  // ============================================================================
  // CACHE CLEANUP & MAINTENANCE
  // ============================================================================

  /**
   * Trigger cache cleanup across all cache layers
   */
  triggerCleanup: async () => {
    const state = get();
    
    set({
      ...state,
      loading: true,
      error: null,
    });

    try {
      // Emit cleanup event to cache integration system
      globalEventBus.emit('cache:cleanup:requested', {
        timestamp: new Date().toISOString()
      });

      const newState = get();
      set({
        ...newState,
        loading: false,
        lastCleanup: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });

    } catch (error) {
      const currentState = get();
      set({
        ...currentState,
        loading: false,
        error: error instanceof Error ? error.message : 'Cache cleanup failed',
      });
      throw error;
    }
  },

  /**
   * Invalidate cache patterns
   */
  invalidateCachePattern: async (pattern: string) => {
    const state = get();
    
    set({
      ...state,
      loading: true,
      error: null,
    });

    try {
      // Use basic cache pattern invalidation (simplified since we removed invalidatePattern)
      // This would need to be implemented based on your cache integration system
      
      const newState = get();
      set({
        ...newState,
        loading: false,
        lastUpdated: new Date().toISOString(),
      });

      // Emit event for coordination
      globalEventBus.emit('cache:pattern:invalidated', {
        pattern,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const currentState = get();
      set({
        ...currentState,
        loading: false,
        error: error instanceof Error ? error.message : 'Pattern invalidation failed',
      });
      throw error;
    }
  },

  /**
   * Get cache health summary
   */
  getCacheHealth: () => {
    const state = get();
    
    return {
      status: state.status,
      metrics: state.metrics,
      lastCleanup: state.lastCleanup,
      configuredCaches: Object.keys(state.config).length,
      healthScore: state.metrics.hitRate * 100, // Simple health score based on hit rate
    };
  },

  // ============================================================================
  // CACHE WARMING & OPTIMIZATION
  // ============================================================================

  /**
   * Warm cache with commonly used data
   */
  warmCache: async (dataTypes: string[]) => {
    const state = get();
    
    set({
      ...state,
      loading: true,
      error: null,
    });

    try {
      // Emit cache warming event
      globalEventBus.emit('cache:warm:requested', {
        dataTypes,
        timestamp: new Date().toISOString()
      });

      const newState = get();
      set({
        ...newState,
        loading: false,
        lastUpdated: new Date().toISOString(),
      });

    } catch (error) {
      const currentState = get();
      set({
        ...currentState,
        loading: false,
        error: error instanceof Error ? error.message : 'Cache warming failed',
      });
      throw error;
    }
  },

  /**
   * Optimize cache configurations based on usage patterns
   */
  optimizeCacheConfigs: async () => {
    const state = get();
    
    try {
      // Analyze current metrics and adjust configurations
      const optimizations: Record<string, Partial<CacheConfig>> = {};
      
      // Example optimization: Increase TTL for high-hit-rate caches
      if (state.metrics.hitRate > 0.8) {
        for (const [dataType, config] of Object.entries(state.config)) {
          if (config.ttl && config.ttl < 60 * 60 * 1000) { // Less than 1 hour
            optimizations[dataType] = {
              ttl: config.ttl * 1.5, // Increase TTL by 50%
            };
          }
        }
      }

      // Apply optimizations
      for (const [dataType, optimization] of Object.entries(optimizations)) {
        const store = get() as any; // Get store instance with methods
        await store.updateCacheConfig(dataType, optimization);
      }

      // Emit optimization complete event
      globalEventBus.emit('cache:optimization:completed', {
        optimizations,
        timestamp: new Date().toISOString()
      });

      return optimizations;
    } catch (error) {
      const currentState = get();
      set({
        ...currentState,
        error: error instanceof Error ? error.message : 'Cache optimization failed',
      });
      throw error;
    }
  },

  // ============================================================================
  // UTILITY ACTIONS
  // ============================================================================

  /**
   * Reset store to initial state
   */
  reset: () => {
    set({ ...initialCacheState });
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
 * Cache meta-store with debug integration and performance monitoring
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
      performanceCategory: 'state-update',
      logLevel: 'info',
    },
  }
);

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Get cache metrics
 */
export const selectCacheMetrics = (state: CacheState) => state.metrics;

/**
 * Get cache status
 */
export const selectCacheStatus = (state: CacheState) => state.status;

/**
 * Get cache configurations
 */
export const selectCacheConfigs = (state: CacheState) => state.config;

/**
 * Get specific cache config
 */
export const selectCacheConfig = (dataType: string) => (state: CacheState) =>
  state.config[dataType] || null;

/**
 * Get cache health summary
 */
export const selectCacheHealth = (state: CacheState) => ({
  status: state.status,
  metrics: state.metrics,
  lastCleanup: state.lastCleanup,
  configuredCaches: Object.keys(state.config).length,
  healthScore: state.metrics.hitRate * 100,
});

/**
 * Get last cleanup time
 */
export const selectLastCleanup = (state: CacheState) => state.lastCleanup;

/**
 * Check if cache is healthy
 */
export const selectIsCacheHealthy = (state: CacheState) => state.status === 'healthy';

/**
 * Get hit rate percentage
 */
export const selectHitRatePercentage = (state: CacheState) => 
  Math.round(state.metrics.hitRate * 100);

/**
 * Get cache loading state
 */
export const selectCacheLoading = (state: CacheState) => state.loading;

/**
 * Get cache error
 */
export const selectCacheError = (state: CacheState) => state.error; 