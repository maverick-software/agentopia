/**
 * Cache Integration Utilities
 * 
 * Shared utilities for integrating cache functionality with stores.
 * Provides consistent caching patterns, TTL strategies, and invalidation logic.
 */

import React from 'react';
import { cacheStore } from '../stores';
import { globalEventBus } from '../composition/event-bus';
import { globalLogger as logger } from '../debug/logger';

// ============================================================================
// CACHE TTL STRATEGIES
// ============================================================================

/**
 * Get cache TTL based on data type
 */
export const getCacheTTL = (dataType: string): number => {
  const ttlMap: Record<string, number> = {
    'template': 30 * 60 * 1000,        // 30 minutes - templates change rarely
    'permissions': 15 * 60 * 1000,     // 15 minutes - permissions moderate
    'instance': 5 * 60 * 1000,         // 5 minutes - instances change frequently
    'ui:state': 60 * 60 * 1000,        // 1 hour - UI state stable
    'user:prefs': 24 * 60 * 60 * 1000, // 24 hours - user prefs very stable
    'metadata': 20 * 60 * 1000,        // 20 minutes - metadata moderate
    'hierarchy': 45 * 60 * 1000,       // 45 minutes - hierarchies semi-static
  };
  
  return ttlMap[dataType] || 10 * 60 * 1000; // Default 10 minutes
};

/**
 * Get cache priority based on data type
 */
export const getCachePriority = (dataType: string): 'low' | 'medium' | 'high' => {
  const priorityMap: Record<string, 'low' | 'medium' | 'high'> = {
    'template': 'high',
    'permissions': 'medium',
    'instance': 'low',
    'ui:state': 'low',
    'user:prefs': 'low',
    'metadata': 'high',
    'hierarchy': 'high',
  };
  
  return priorityMap[dataType] || 'medium';
};

// ============================================================================
// CACHE KEY GENERATION
// ============================================================================

/**
 * Generate consistent cache keys for different data types
 */
export const createCacheKey = {
  template: (templateId: string, suffix?: string) => 
    `template:${templateId}${suffix ? `:${suffix}` : ''}`,
    
  templateMetadata: (templateId: string) => 
    `template:${templateId}:metadata`,
    
  templateHierarchy: (templateId: string) => 
    `template:${templateId}:hierarchy`,
    
  instance: (instanceId: string, suffix?: string) => 
    `instance:${instanceId}${suffix ? `:${suffix}` : ''}`,
    
  instanceProgress: (instanceId: string) => 
    `instance:${instanceId}:progress`,
    
  permissions: (userId: string, clientId?: string) => 
    `permissions:${userId}${clientId ? `:client:${clientId}` : ''}`,
    
  userPreferences: (userId: string) => 
    `user:preferences:${userId}`,
    
  uiState: (scope: string) => 
    `ui:state:${scope}`,
    
  clientData: (clientId: string, dataType: string) => 
    `client:${clientId}:${dataType}`,
};

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Get data from cache with automatic fallback
 */
export const getCached = async <T>(
  key: string,
  fallbackFn: () => Promise<T>,
  options?: {
    dataType?: string;
    skipCache?: boolean;
    forceRefresh?: boolean;
  }
): Promise<T> => {
  const { dataType = 'default', skipCache = false, forceRefresh = false } = options || {};
  
  // Skip cache if requested
  if (skipCache || forceRefresh) {
    const data = await fallbackFn();
    if (!skipCache) {
      setCached(key, data, { dataType });
    }
    return data;
  }
  
  // Check cache first
  const cached = cacheStore.getState().get(key);
  if (cached !== null) {
    return cached as T;
  }
  
  // Fetch from fallback and cache
  const data = await fallbackFn();
  setCached(key, data, { dataType });
  
  return data;
};

/**
 * Set data in cache with appropriate options
 */
export const setCached = <T>(
  key: string,
  data: T,
  options?: {
    dataType?: string;
    ttl?: number;
    priority?: 'low' | 'medium' | 'high';
  }
): void => {
  const { dataType = 'default', ttl, priority } = options || {};
  
  const cacheOptions = {
    ttl: ttl || getCacheTTL(dataType),
    priority: priority || getCachePriority(dataType),
  };
  
  cacheStore.getState().set(key, data, cacheOptions);
};

/**
 * Delete specific cache entry
 */
export const deleteCached = (key: string): void => {
  cacheStore.getState().delete(key);
};

/**
 * Invalidate cache pattern (e.g., "template:123:*")
 */
export const invalidateCachePattern = (pattern: string): void => {
  const regex = new RegExp(pattern.replace('*', '.*'));
  const cache = cacheStore.getState();
  
  Object.keys(cache.entries).forEach(key => {
    if (regex.test(key)) {
      cache.delete(key);
    }
  });
};

// ============================================================================
// CACHE INVALIDATION STRATEGIES
// ============================================================================

/**
 * Invalidate template-related cache
 */
export const invalidateTemplate = (templateId: string): void => {
  const cacheKeys = [
    createCacheKey.template(templateId),
    createCacheKey.templateMetadata(templateId),
    createCacheKey.templateHierarchy(templateId),
    createCacheKey.template(templateId, 'stages'),
    createCacheKey.template(templateId, 'tasks'),
    createCacheKey.template(templateId, 'steps'),
    createCacheKey.template(templateId, 'elements'),
  ];
  
  cacheKeys.forEach(key => deleteCached(key));
  
  // Also invalidate related instances (expensive operation, consider optimization)
  invalidateCachePattern(`instance:*:template:${templateId}`);
  
  // Emit event for other systems
  globalEventBus.emit('cache:template:invalidated', { templateId });
};

/**
 * Invalidate user-related cache
 */
export const invalidateUser = (userId: string): void => {
  invalidateCachePattern(`permissions:${userId}:*`);
  deleteCached(createCacheKey.userPreferences(userId));
  invalidateCachePattern(`user:${userId}:*`);
  
  // Emit event
  globalEventBus.emit('cache:user:invalidated', { userId });
};

/**
 * Invalidate client-related cache
 */
export const invalidateClient = (clientId: string): void => {
  invalidateCachePattern(`client:${clientId}:*`);
  invalidateCachePattern(`permissions:*:client:${clientId}`);
  
  // Emit event
  globalEventBus.emit('cache:client:invalidated', { clientId });
};

/**
 * Invalidate instance-related cache
 */
export const invalidateInstance = (instanceId: string): void => {
  invalidateCachePattern(`instance:${instanceId}:*`);
  
  // Emit event
  globalEventBus.emit('cache:instance:invalidated', { instanceId });
};

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Batch cache operations to prevent excessive re-renders
 */
export const batchCacheOperations = (operations: Array<() => void>): void => {
  // Use React's startTransition if available, otherwise execute normally
  if (typeof window !== 'undefined' && 'startTransition' in React) {
    React.startTransition(() => {
      operations.forEach(op => op());
    });
  } else {
    operations.forEach(op => op());
  }
};

/**
 * Set multiple cache entries at once
 */
export const setCachedBatch = (entries: Array<{
  key: string;
  data: any;
  options?: {
    dataType?: string;
    ttl?: number;
    priority?: 'low' | 'medium' | 'high';
  };
}>): void => {
  batchCacheOperations(
    entries.map(({ key, data, options }) => 
      () => setCached(key, data, options)
    )
  );
};

// ============================================================================
// CACHE WARMING
// ============================================================================

/**
 * Warm cache for specific route/page
 */
export const warmCacheForRoute = async (route: string, context?: {
  userId?: string;
  clientId?: string;
  templateId?: string;
  instanceId?: string;
}): Promise<void> => {
  const { userId, clientId, templateId, instanceId } = context || {};
  
  const warmingOperations: Array<() => Promise<void>> = [];
  
  // Route-specific cache warming
  switch (route) {
    case '/dashboard':
      if (userId) {
        warmingOperations.push(async () => {
          // Pre-load user permissions and preferences
          // These would be loaded by actual store methods
        });
      }
      break;
      
    case '/workflow/:id':
      if (templateId) {
        warmingOperations.push(async () => {
          // Pre-load template metadata and hierarchy
        });
      }
      break;
      
    case '/client/:id':
      if (clientId) {
        warmingOperations.push(async () => {
          // Pre-load client data and related projects
        });
      }
      break;
  }
  
  // Execute warming operations
  await Promise.allSettled(
    warmingOperations.map(op => op())
  );
};

// ============================================================================
// CACHE MONITORING
// ============================================================================

/**
 * Monitor cache memory usage and trigger cleanup if needed
 */
export const monitorCacheMemory = (): void => {
  const cache = cacheStore.getState();
  const stats = cache.stats;
  
  const maxMemory = 50 * 1024 * 1024; // 50MB
  const warningThreshold = 0.8; // 80% of max
  
  if (stats.totalSize > maxMemory * warningThreshold) {
    console.warn('🚨 Cache memory usage high:', {
      totalSize: `${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`,
      maxSize: `${(maxMemory / 1024 / 1024).toFixed(2)}MB`,
      usage: `${((stats.totalSize / maxMemory) * 100).toFixed(1)}%`,
      entryCount: Object.keys(cache.entries).length,
    });
    
    if (stats.totalSize > maxMemory) {
      // Trigger aggressive cleanup
      cache.cleanup();
      console.log('🧹 Cache cleanup performed');
    }
  }
};

/**
 * Get cache performance metrics
 */
export const getCacheMetrics = () => {
  const cache = cacheStore.getState();
  const stats = cache.stats;
  
  const totalRequests = stats.hits + stats.misses;
  const hitRate = totalRequests > 0 ? (stats.hits / totalRequests) * 100 : 0;
  
  return {
    hitRate: Number(hitRate.toFixed(2)),
    totalRequests,
    hits: stats.hits,
    misses: stats.misses,
    evictions: stats.evictions,
    totalSize: stats.totalSize,
    entryCount: Object.keys(cache.entries).length,
    sizeMB: Number((stats.totalSize / 1024 / 1024).toFixed(2)),
  };
};

// ============================================================================
// EVENT LISTENERS SETUP
// ============================================================================

/**
 * Set up cache invalidation event listeners
 */
export const setupCacheEventListeners = (): (() => void) => {
  const listeners = [
    globalEventBus.on('workflow:template:updated', (event: any) => {
      invalidateTemplate(event.templateId);
    }),
    
    globalEventBus.on('auth:permissions:changed', (event: any) => {
      invalidateUser(event.userId);
    }),
    
    globalEventBus.on('auth:logout', (event: any) => {
      invalidateUser(event.userId);
    }),
    
    globalEventBus.on('ui:theme:changed', (event: any) => {
      if (event.userId) {
        // Update cached preferences
        const key = createCacheKey.userPreferences(event.userId);
        const cached = cacheStore.getState().get(key);
        if (cached) {
          setCached(key, { ...cached, theme: event.theme }, { dataType: 'user:prefs' });
        }
      }
    }),
    
    globalEventBus.on('workflow:instance:updated', (event: any) => {
      invalidateInstance(event.instanceId);
    }),
    
    globalEventBus.on('client:data:changed', (event: any) => {
      invalidateClient(event.clientId);
    }),
  ];
  
  // Return cleanup function
  return () => {
    listeners.forEach(cleanup => cleanup());
  };
};

// ============================================================================
// CACHE SIZE MANAGEMENT & LIMITS
// ============================================================================

/**
 * Maximum cache size configuration per data type (in bytes)
 */
export const getCacheMaxSize = (dataType: string): number => {
  const maxSizeMap: Record<string, number> = {
    'template': 10 * 1024 * 1024,        // 10MB - templates can be large with hierarchies
    'permissions': 2 * 1024 * 1024,      // 2MB - permissions are relatively small
    'instance': 5 * 1024 * 1024,         // 5MB - instances moderate size but many
    'ui:state': 1 * 1024 * 1024,         // 1MB - UI state should be minimal
    'user:prefs': 512 * 1024,            // 512KB - user preferences small
    'metadata': 3 * 1024 * 1024,         // 3MB - metadata moderate size
    'hierarchy': 8 * 1024 * 1024,        // 8MB - hierarchies can be complex
  };
  
  return maxSizeMap[dataType] || 2 * 1024 * 1024; // Default 2MB
};

/**
 * Maximum number of entries per data type
 */
export const getCacheMaxEntries = (dataType: string): number => {
  const maxEntriesMap: Record<string, number> = {
    'template': 200,        // 200 templates max (should be sufficient)
    'permissions': 100,     // 100 permission sets (multiple users/clients)
    'instance': 500,        // 500 instances (frequently accessed)
    'ui:state': 50,         // 50 UI state entries (per user/scope)
    'user:prefs': 100,      // 100 user preference sets
    'metadata': 300,        // 300 metadata entries
    'hierarchy': 150,       // 150 hierarchies (can be large)
  };
  
  return maxEntriesMap[dataType] || 100; // Default 100 entries
};

/**
 * Global cache size limits
 */
export const GLOBAL_CACHE_LIMITS = {
  TOTAL_MEMORY_LIMIT: 50 * 1024 * 1024,    // 50MB total memory limit
  WARNING_THRESHOLD: 40 * 1024 * 1024,      // 40MB warning threshold (80%)
  CRITICAL_THRESHOLD: 45 * 1024 * 1024,     // 45MB critical threshold (90%)
  MAX_TOTAL_ENTRIES: 2000,                   // 2000 total entries across all caches
  CLEANUP_BATCH_SIZE: 50,                    // Clean up 50 entries at a time
  MEMORY_CHECK_INTERVAL: 30 * 1000,         // Check memory every 30 seconds
};

/**
 * Check if cache is approaching size limits
 */
export const checkCacheSizeLimits = (): {
  status: 'healthy' | 'warning' | 'critical';
  totalMemory: number;
  totalEntries: number;
  recommendations: string[];
} => {
  const cache = cacheStore.getState();
  const metrics = cache.getMetrics();
  
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  const recommendations: string[] = [];
  
  // Check total memory usage
  if (metrics.memoryUsage >= GLOBAL_CACHE_LIMITS.CRITICAL_THRESHOLD) {
    status = 'critical';
    recommendations.push('CRITICAL: Memory usage exceeds 90% limit. Immediate cleanup required.');
    recommendations.push('Consider reducing cache TTLs or clearing non-essential caches.');
  } else if (metrics.memoryUsage >= GLOBAL_CACHE_LIMITS.WARNING_THRESHOLD) {
    status = 'warning';
    recommendations.push('WARNING: Memory usage exceeds 80% limit. Consider cleanup.');
    recommendations.push('Review cache priorities and remove low-priority entries.');
  }
  
  // Check total entries
  if (metrics.totalEntries >= GLOBAL_CACHE_LIMITS.MAX_TOTAL_ENTRIES * 0.9) {
    if (status !== 'critical') status = 'warning';
    recommendations.push('High number of cache entries. Consider cleanup of old entries.');
  }
  
  // Check individual data type limits
  Object.entries(cache.getMetricsByType()).forEach(([dataType, typeMetrics]: [string, any]) => {
    const maxSize = getCacheMaxSize(dataType);
    const maxEntries = getCacheMaxEntries(dataType);
    
    if (typeMetrics.memoryUsage >= maxSize * 0.9) {
      recommendations.push(`${dataType} cache approaching size limit (${(typeMetrics.memoryUsage / 1024 / 1024).toFixed(1)}MB/${(maxSize / 1024 / 1024).toFixed(1)}MB)`);
    }
    
    if (typeMetrics.entryCount >= maxEntries * 0.9) {
      recommendations.push(`${dataType} cache approaching entry limit (${typeMetrics.entryCount}/${maxEntries} entries)`);
    }
  });
  
  return {
    status,
    totalMemory: metrics.memoryUsage,
    totalEntries: metrics.totalEntries,
    recommendations
  };
};

/**
 * Perform intelligent cache cleanup based on priorities and usage
 */
export const performIntelligentCleanup = (targetReduction: number = 0.2): {
  cleanedEntries: number;
  memoryFreed: number;
  actions: string[];
} => {
  const cache = cacheStore.getState();
  const actions: string[] = [];
  let cleanedEntries = 0;
  let memoryFreed = 0;
  
  // 1. Remove expired entries first
  const expiredKeys = cache.getExpiredKeys();
  expiredKeys.forEach((key: string) => {
    const entry = cache.entries[key];
    if (entry) {
      memoryFreed += entry.size || 0;
      cache.delete(key);
      cleanedEntries++;
    }
  });
  actions.push(`Removed ${expiredKeys.length} expired entries`);
  
  // 2. Remove low-priority entries if still need more space
  const currentMetrics = cache.getMetrics();
  if (currentMetrics.memoryUsage > GLOBAL_CACHE_LIMITS.WARNING_THRESHOLD) {
    const lowPriorityKeys = cache.getEntriesByPriority('low').slice(0, GLOBAL_CACHE_LIMITS.CLEANUP_BATCH_SIZE);
    lowPriorityKeys.forEach(([key, entry]: [string, any]) => {
      memoryFreed += entry.size || 0;
      cache.delete(key);
      cleanedEntries++;
    });
    actions.push(`Removed ${lowPriorityKeys.length} low-priority entries`);
  }
  
  // 3. Remove least recently used entries if still critical
  if (currentMetrics.memoryUsage > GLOBAL_CACHE_LIMITS.CRITICAL_THRESHOLD) {
    const lruKeys = cache.getLeastRecentlyUsed(GLOBAL_CACHE_LIMITS.CLEANUP_BATCH_SIZE);
    lruKeys.forEach((key: string) => {
      const entry = cache.entries[key];
      if (entry) {
        memoryFreed += entry.size || 0;
        cache.delete(key);
        cleanedEntries++;
      }
    });
    actions.push(`Removed ${lruKeys.length} least recently used entries`);
  }
  
  // Emit cleanup event
  globalEventBus.emit('cache:cleanup:completed', {
    cleanedEntries,
    memoryFreed,
    actions,
    newMemoryUsage: cache.getMetrics().memoryUsage
  });
  
  return { cleanedEntries, memoryFreed, actions };
};

/**
 * Set up automatic cache size monitoring and cleanup
 */
export const setupCacheSizeMonitoring = (): (() => void) => {
  const checkAndCleanup = () => {
    const sizeCheck = checkCacheSizeLimits();
    
    if (sizeCheck.status === 'critical') {
      logger.warn('Cache memory critical - performing emergency cleanup', {
        totalMemory: sizeCheck.totalMemory,
        totalEntries: sizeCheck.totalEntries,
        recommendations: sizeCheck.recommendations
      });
      
      performIntelligentCleanup(0.3); // Aggressive cleanup - 30% reduction
      
    } else if (sizeCheck.status === 'warning') {
      logger.info('Cache memory warning - performing preventive cleanup', {
        totalMemory: sizeCheck.totalMemory,
        recommendations: sizeCheck.recommendations
      });
      
      performIntelligentCleanup(0.15); // Moderate cleanup - 15% reduction
    }
    
    // Update cache store with size monitoring data
    cacheStore.getState().updateMetrics({
      memoryStatus: sizeCheck.status,
      memoryUsage: sizeCheck.totalMemory,
      lastSizeCheck: Date.now()
    });
  };
  
  // Run initial check
  checkAndCleanup();
  
  // Set up periodic monitoring
  const interval = setInterval(checkAndCleanup, GLOBAL_CACHE_LIMITS.MEMORY_CHECK_INTERVAL);
  
  // Set up event listeners for cache operations
  const unsubscribeEvents = setupCacheEventListeners();
  
  // Return cleanup function
  return () => {
    clearInterval(interval);
    unsubscribeEvents();
  };
};

/**
 * Force cache size validation on set operations
 */
export const setCachedWithSizeValidation = <T>(
  key: string,
  data: T,
  options?: {
    dataType?: string;
    ttl?: number;
    priority?: 'low' | 'medium' | 'high';
    force?: boolean; // Skip size validation
  }
): boolean => {
  const { dataType = 'default', ttl, priority, force = false } = options || {};
  
  if (!force) {
    // Check if adding this entry would exceed limits
    const dataSize = JSON.stringify(data).length * 2; // Rough size estimate
    const maxSize = getCacheMaxSize(dataType);
    const cache = cacheStore.getState();
    const typeMetrics = cache.getMetricsByType()[dataType] || { memoryUsage: 0, entryCount: 0 };
    
    // Check individual data type limits
    if (typeMetrics.memoryUsage + dataSize > maxSize) {
      logger.warn('Cache set rejected - would exceed data type size limit', {
        key,
        dataType,
        currentSize: typeMetrics.memoryUsage,
        dataSize,
        maxSize
      });
      return false;
    }
    
    // Check global limits
    const globalMetrics = cache.getMetrics();
    if (globalMetrics.memoryUsage + dataSize > GLOBAL_CACHE_LIMITS.TOTAL_MEMORY_LIMIT) {
      logger.warn('Cache set rejected - would exceed global memory limit', {
        key,
        currentMemory: globalMetrics.memoryUsage,
        dataSize,
        limit: GLOBAL_CACHE_LIMITS.TOTAL_MEMORY_LIMIT
      });
      
      // Try intelligent cleanup and retry
      const cleanup = performIntelligentCleanup(0.2);
      if (cleanup.memoryFreed >= dataSize) {
        logger.info('Cleanup successful - retrying cache set', { key, memoryFreed: cleanup.memoryFreed });
        // Proceed with set operation below
      } else {
        return false;
      }
    }
  }
  
  // Proceed with normal cache set
  setCached(key, data, { dataType, ttl, priority });
  return true;
}; 