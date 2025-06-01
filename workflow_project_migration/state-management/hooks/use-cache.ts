/**
 * Cache Management Hooks
 * 
 * Specialized hooks for cache operations, metrics monitoring, and invalidation
 * patterns. Provides high-level abstractions for common cache management tasks.
 */

import { useCallback, useMemo } from 'react';
import { useStore } from './use-store';
import { cacheStore } from '../stores';
import { 
  getCached, 
  setCached, 
  deleteCached, 
  invalidateByPattern, 
  getCacheMetrics,
  getCacheHealth 
} from '../cache/cache-integration';
import type { CacheMetrics } from '../core/types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Core cache operations return type
 */
export interface UseCacheReturn {
  get: <T>(key: string) => T | null;
  set: <T>(key: string, value: T, ttl?: number) => void;
  delete: (key: string) => void;
  clear: (pattern?: string) => void;
  metrics: CacheMetrics;
  health: 'healthy' | 'degraded' | 'error';
}

/**
 * Cache metrics monitoring return type
 */
export interface UseCacheMetricsReturn {
  hitRate: number;
  missRate: number;
  totalSize: number;
  entryCount: number;
  averageAccessTime: number;
  lastCleanup: Date | null;
  memoryUsage: number;
  isHealthy: boolean;
  recommendations: string[];
}

/**
 * Cache invalidation patterns return type
 */
export interface UseCacheInvalidationReturn {
  invalidateUser: (userId: string) => void;
  invalidateTemplate: (templateId: string) => void;
  invalidateClient: (clientId: string) => void;
  invalidatePermissions: (userId?: string) => void;
  invalidateUI: () => void;
  invalidateAll: () => void;
  invalidateByPattern: (pattern: string) => void;
}

/**
 * Cache warming operations return type
 */
export interface UseCacheWarmingReturn {
  warmUserData: (userId: string) => Promise<void>;
  warmTemplateData: (templateId: string) => Promise<void>;
  warmClientData: (clientId: string) => Promise<void>;
  warmCommonData: () => Promise<void>;
  isWarming: boolean;
  warmingProgress: number;
}

// ============================================================================
// CORE CACHE HOOK
// ============================================================================

/**
 * Core cache operations hook
 * Provides basic cache operations with integrated metrics and health monitoring
 */
export function useCache(): UseCacheReturn {
  // Subscribe to cache metrics for health status
  const metrics = useStore(cacheStore, state => state.metrics);
  const health = useStore(cacheStore, state => state.status);

  const get = useCallback(<T>(key: string): T | null => {
    return getCached<T>(key);
  }, []);

  const set = useCallback(<T>(key: string, value: T, ttl?: number): void => {
    setCached(key, value, ttl);
  }, []);

  const deleteKey = useCallback((key: string): void => {
    deleteCached(key);
  }, []);

  const clear = useCallback((pattern?: string): void => {
    if (pattern) {
      invalidateByPattern(pattern);
    } else {
      // Clear all cache entries
      invalidateByPattern('*');
    }
  }, []);

  return {
    get,
    set,
    delete: deleteKey,
    clear,
    metrics,
    health
  };
}

// ============================================================================
// CACHE METRICS HOOK
// ============================================================================

/**
 * Cache metrics monitoring hook
 * Provides detailed cache performance and health information
 */
export function useCacheMetrics(): UseCacheMetricsReturn {
  const metrics = useStore(cacheStore, state => state.metrics);
  
  const processedMetrics = useMemo(() => {
    const currentMetrics = getCacheMetrics();
    const health = getCacheHealth();
    
    return {
      hitRate: currentMetrics.hitRate,
      missRate: 1 - currentMetrics.hitRate,
      totalSize: currentMetrics.totalSize,
      entryCount: currentMetrics.entryCount,
      averageAccessTime: currentMetrics.averageAccessTime,
      lastCleanup: currentMetrics.lastCleanup ? new Date(currentMetrics.lastCleanup) : null,
      memoryUsage: currentMetrics.memoryUsage,
      isHealthy: health.status === 'healthy',
      recommendations: health.recommendations
    };
  }, [metrics]);

  return processedMetrics;
}

// ============================================================================
// CACHE INVALIDATION HOOK
// ============================================================================

/**
 * Cache invalidation patterns hook
 * Provides semantic methods for invalidating cache by domain patterns
 */
export function useCacheInvalidation(): UseCacheInvalidationReturn {
  const invalidateUser = useCallback((userId: string): void => {
    invalidateByPattern(`user:${userId}:*`);
    invalidateByPattern(`permissions:${userId}:*`);
  }, []);

  const invalidateTemplate = useCallback((templateId: string): void => {
    invalidateByPattern(`template:${templateId}:*`);
    invalidateByPattern(`hierarchy:${templateId}:*`);
  }, []);

  const invalidateClient = useCallback((clientId: string): void => {
    invalidateByPattern(`client:${clientId}:*`);
    invalidateByPattern(`permissions:*:${clientId}`);
  }, []);

  const invalidatePermissions = useCallback((userId?: string): void => {
    if (userId) {
      invalidateByPattern(`permissions:${userId}:*`);
    } else {
      invalidateByPattern('permissions:*');
    }
  }, []);

  const invalidateUI = useCallback((): void => {
    invalidateByPattern('ui:*');
    invalidateByPattern('preferences:*');
  }, []);

  const invalidateAll = useCallback((): void => {
    invalidateByPattern('*');
  }, []);

  const invalidateByPatternWrapper = useCallback((pattern: string): void => {
    invalidateByPattern(pattern);
  }, []);

  return {
    invalidateUser,
    invalidateTemplate,
    invalidateClient,
    invalidatePermissions,
    invalidateUI,
    invalidateAll,
    invalidateByPattern: invalidateByPatternWrapper
  };
}

// ============================================================================
// CACHE WARMING HOOK
// ============================================================================

/**
 * Cache warming operations hook
 * Provides methods for proactively loading commonly accessed data
 */
export function useCacheWarming(): UseCacheWarmingReturn {
  const isWarming = useStore(cacheStore, state => 
    state.config && Object.values(state.config).some(config => config.isWarming)
  );

  const warmingProgress = useStore(cacheStore, state => {
    if (!state.config) return 0;
    const configs = Object.values(state.config);
    const warmingConfigs = configs.filter(config => config.isWarming);
    if (warmingConfigs.length === 0) return 0;
    
    const totalProgress = warmingConfigs.reduce((sum, config) => 
      sum + (config.warmingProgress || 0), 0
    );
    return totalProgress / warmingConfigs.length;
  });

  const warmUserData = useCallback(async (userId: string): Promise<void> => {
    // Warm user-related cache entries
    const warmingTasks = [
      // User profile data
      `user:${userId}:profile`,
      // User permissions
      `permissions:${userId}:global`,
      `permissions:${userId}:clients`,
      // User preferences
      `preferences:${userId}:ui`,
      `preferences:${userId}:notifications`
    ];

    // Simulate cache warming (in real implementation, would load from API)
    for (const key of warmingTasks) {
      // This would typically involve API calls to populate cache
      setCached(key, { warmed: true, timestamp: Date.now() });
    }
  }, []);

  const warmTemplateData = useCallback(async (templateId: string): Promise<void> => {
    // Warm template-related cache entries
    const warmingTasks = [
      // Template metadata
      `template:${templateId}:metadata`,
      // Template hierarchy
      `hierarchy:${templateId}:full`,
      // Template stages/tasks
      `template:${templateId}:stages`,
      `template:${templateId}:tasks`
    ];

    for (const key of warmingTasks) {
      setCached(key, { warmed: true, timestamp: Date.now() });
    }
  }, []);

  const warmClientData = useCallback(async (clientId: string): Promise<void> => {
    // Warm client-related cache entries
    const warmingTasks = [
      // Client information
      `client:${clientId}:info`,
      // Client permissions
      `permissions:*:${clientId}`,
      // Client templates
      `client:${clientId}:templates`
    ];

    for (const key of warmingTasks) {
      setCached(key, { warmed: true, timestamp: Date.now() });
    }
  }, []);

  const warmCommonData = useCallback(async (): Promise<void> => {
    // Warm commonly accessed data
    const warmingTasks = [
      // Global UI state
      'ui:theme:current',
      'ui:sidebar:state',
      // Common templates
      'templates:featured',
      'templates:recent',
      // System configuration
      'config:global',
      'config:features'
    ];

    for (const key of warmingTasks) {
      setCached(key, { warmed: true, timestamp: Date.now() });
    }
  }, []);

  return {
    warmUserData,
    warmTemplateData,
    warmClientData,
    warmCommonData,
    isWarming,
    warmingProgress
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Cache entry monitoring hook
 * Monitors specific cache entries for changes and health
 */
export function useCacheEntry<T>(key: string): {
  value: T | null;
  isHit: boolean;
  lastAccessed: Date | null;
  size: number;
  ttl: number | null;
} {
  const value = getCached<T>(key);
  const metrics = useCacheMetrics();
  
  // This would typically come from more detailed cache metadata
  const entryInfo = useMemo(() => ({
    value,
    isHit: value !== null,
    lastAccessed: new Date(), // Simplified - would track actual access time
    size: value ? JSON.stringify(value).length : 0, // Simplified size calculation
    ttl: null as number | null // Would come from cache configuration
  }), [value]);

  return entryInfo;
}

/**
 * Cache health monitoring hook
 * Provides real-time cache health status and alerts
 */
export function useCacheHealth(): {
  status: 'healthy' | 'degraded' | 'error';
  issues: string[];
  recommendations: string[];
  metrics: {
    hitRate: number;
    memoryUsage: number;
    averageResponseTime: number;
  };
} {
  const health = getCacheHealth();
  const metrics = useCacheMetrics();

  return useMemo(() => ({
    status: health.status,
    issues: health.issues,
    recommendations: health.recommendations,
    metrics: {
      hitRate: metrics.hitRate,
      memoryUsage: metrics.memoryUsage,
      averageResponseTime: metrics.averageAccessTime
    }
  }), [health, metrics]);
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  UseCacheReturn,
  UseCacheMetricsReturn,
  UseCacheInvalidationReturn,
  UseCacheWarmingReturn
}; 