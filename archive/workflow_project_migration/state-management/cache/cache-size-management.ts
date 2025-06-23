/**
 * Cache Size Management Utilities
 * 
 * Comprehensive cache size monitoring, validation, and cleanup utilities
 * to prevent cache overflow and maintain optimal memory usage.
 */

import { cacheStore } from '../stores';
import { globalEventBus } from '../composition/event-bus';
import { globalLogger as logger } from '../debug/logger';
import { setupCacheEventListeners } from './cache-integration';

// ============================================================================
// CACHE SIZE LIMITS & CONFIGURATION
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

// ============================================================================
// SIZE MONITORING & VALIDATION
// ============================================================================

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
  Object.entries(cache.getMetricsByType()).forEach(([dataType, typeMetrics]) => {
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
 * Validate cache entry size before adding
 */
export const validateCacheEntrySize = (
  key: string,
  data: any,
  dataType: string
): { valid: boolean; reason?: string; size: number } => {
  const dataSize = JSON.stringify(data).length * 2; // Rough size estimate
  const maxSize = getCacheMaxSize(dataType);
  const cache = cacheStore.getState();
  const typeMetrics = cache.getMetricsByType()[dataType] || { memoryUsage: 0, entryCount: 0 };
  
  // Check individual data type limits
  if (typeMetrics.memoryUsage + dataSize > maxSize) {
    return {
      valid: false,
      reason: `Would exceed ${dataType} cache size limit (${(typeMetrics.memoryUsage + dataSize) / 1024 / 1024}MB > ${maxSize / 1024 / 1024}MB)`,
      size: dataSize
    };
  }
  
  // Check global limits
  const globalMetrics = cache.getMetrics();
  if (globalMetrics.memoryUsage + dataSize > GLOBAL_CACHE_LIMITS.TOTAL_MEMORY_LIMIT) {
    return {
      valid: false,
      reason: `Would exceed global memory limit (${(globalMetrics.memoryUsage + dataSize) / 1024 / 1024}MB > ${GLOBAL_CACHE_LIMITS.TOTAL_MEMORY_LIMIT / 1024 / 1024}MB)`,
      size: dataSize
    };
  }
  
  return { valid: true, size: dataSize };
};

// ============================================================================
// INTELLIGENT CLEANUP
// ============================================================================

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
  expiredKeys.forEach(key => {
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
    lowPriorityKeys.forEach(([key, entry]) => {
      memoryFreed += entry.size || 0;
      cache.delete(key);
      cleanedEntries++;
    });
    actions.push(`Removed ${lowPriorityKeys.length} low-priority entries`);
  }
  
  // 3. Remove least recently used entries if still critical
  if (currentMetrics.memoryUsage > GLOBAL_CACHE_LIMITS.CRITICAL_THRESHOLD) {
    const lruKeys = cache.getLeastRecentlyUsed(GLOBAL_CACHE_LIMITS.CLEANUP_BATCH_SIZE);
    lruKeys.forEach(key => {
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
 * Emergency cache cleanup for critical memory situations
 */
export const performEmergencyCleanup = (): {
  cleanedEntries: number;
  memoryFreed: number;
  actions: string[];
} => {
  logger.warn('Performing emergency cache cleanup due to critical memory usage');
  
  // Aggressive cleanup - 50% reduction
  return performIntelligentCleanup(0.5);
};

// ============================================================================
// AUTOMATIC MONITORING & CLEANUP
// ============================================================================

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

// ============================================================================
// SIZE-VALIDATED CACHE OPERATIONS
// ============================================================================

/**
 * Set cache entry with size validation and automatic cleanup
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
    const validation = validateCacheEntrySize(key, data, dataType);
    
    if (!validation.valid) {
      logger.warn('Cache set rejected - size validation failed', {
        key,
        dataType,
        reason: validation.reason,
        size: validation.size
      });
      
      // Try intelligent cleanup and retry
      const cleanup = performIntelligentCleanup(0.2);
      if (cleanup.memoryFreed >= validation.size) {
        logger.info('Cleanup successful - retrying cache set', { 
          key, 
          memoryFreed: cleanup.memoryFreed 
        });
        // Retry validation after cleanup
        const retryValidation = validateCacheEntrySize(key, data, dataType);
        if (!retryValidation.valid) {
          return false;
        }
      } else {
        return false;
      }
    }
  }
  
  // Proceed with normal cache set using the imported function
  const { setCached } = require('./cache-integration');
  setCached(key, data, { dataType, ttl, priority });
  return true;
};

/**
 * Get comprehensive cache size report
 */
export const getCacheSizeReport = () => {
  const cache = cacheStore.getState();
  const metrics = cache.getMetrics();
  const sizeCheck = checkCacheSizeLimits();
  const typeMetrics = cache.getMetricsByType();
  
  return {
    overall: {
      status: sizeCheck.status,
      totalMemory: metrics.memoryUsage,
      totalEntries: metrics.totalEntries,
      memoryLimit: GLOBAL_CACHE_LIMITS.TOTAL_MEMORY_LIMIT,
      entryLimit: GLOBAL_CACHE_LIMITS.MAX_TOTAL_ENTRIES,
      memoryUsagePercent: (metrics.memoryUsage / GLOBAL_CACHE_LIMITS.TOTAL_MEMORY_LIMIT) * 100,
      recommendations: sizeCheck.recommendations
    },
    byDataType: Object.entries(typeMetrics).map(([dataType, metrics]) => ({
      dataType,
      memoryUsage: metrics.memoryUsage,
      entryCount: metrics.entryCount,
      maxMemory: getCacheMaxSize(dataType),
      maxEntries: getCacheMaxEntries(dataType),
      memoryUsagePercent: (metrics.memoryUsage / getCacheMaxSize(dataType)) * 100,
      entryUsagePercent: (metrics.entryCount / getCacheMaxEntries(dataType)) * 100
    })),
    limits: GLOBAL_CACHE_LIMITS
  };
}; 