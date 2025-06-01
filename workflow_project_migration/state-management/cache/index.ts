/**
 * Cache System Index
 * 
 * Unified export for the complete cache management system including
 * core cache manager, strategies, and utility functions.
 */

// ============================================================================
// Core Cache Manager
// ============================================================================

export {
  BaseCache,
  CacheEntryImpl,
  type CacheConfig,
  type CacheStrategy,
  type CacheManager,
  type CacheOptions,
  type CacheStats,
  type EvictionPolicy,
  type StorageType
} from './cache-manager'

// ============================================================================
// Cache Strategies
// ============================================================================

export {
  LRUCache,
  createLRUCache,
  TTLCache,
  createTTLCache,
  MemoryCache,
  createMemoryCache,
  createCache,
  CachePresets,
  getCacheRecommendation
} from './strategies'

// ============================================================================
// Unified Cache Factory with Domain-Specific Configurations
// ============================================================================

import { createCache, CachePresets } from './strategies'
import type { CacheStrategy, CacheConfig } from './cache-manager'

/**
 * Domain-specific cache configurations for the unified state management library
 */
export const DomainCaches = {
  /**
   * Template metadata cache - frequently accessed, medium-lived
   */
  templateMetadata: () => createCache('lru', {
    ...CachePresets.fastAccess(500),
    defaultTTL: 30 * 60 * 1000, // 30 minutes
    enableLogging: false
  }),

  /**
   * Workflow instance cache - session-based with TTL
   */
  workflowInstances: () => createCache('hybrid', {
    ...CachePresets.balanced(200, 60), // 1 hour TTL
    enableLogging: false
  }),

  /**
   * User permissions cache - critical data with moderate TTL
   */
  userPermissions: () => createCache('ttl', {
    ...CachePresets.session(15), // 15 minutes
    maxSize: 100,
    enableLogging: false
  }),

  /**
   * UI state cache - fast access, no TTL
   */
  uiState: () => createCache('lru', {
    ...CachePresets.fastAccess(100),
    defaultTTL: 0, // No expiration
    enableLogging: false
  }),

  /**
   * API response cache - memory-efficient for large responses
   */
  apiResponses: () => createCache('memory', {
    ...CachePresets.memoryEfficient(25), // 25MB
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    enableLogging: false
  }),

  /**
   * File/asset cache - large data with size constraints
   */
  assets: () => createCache('memory', {
    ...CachePresets.memoryEfficient(100), // 100MB
    defaultTTL: 60 * 60 * 1000, // 1 hour
    maxSize: 50,
    enableLogging: false
  }),

  /**
   * Development cache - extensive logging and short TTL
   */
  development: () => createCache('hybrid', {
    ...CachePresets.development(),
    enableLogging: true
  })
}

/**
 * Cache manager for coordinating multiple domain caches
 */
export class CacheCoordinator {
  private caches = new Map<string, any>()
  private metrics = {
    totalHits: 0,
    totalMisses: 0,
    totalEvictions: 0,
    lastReset: Date.now()
  }

  /**
   * Register a cache with a domain name
   */
  public registerCache<T>(domain: string, cache: any): void {
    this.caches.set(domain, cache)
  }

  /**
   * Get a cache by domain name
   */
  public getCache<T>(domain: string): any | null {
    return this.caches.get(domain) || null
  }

  /**
   * Get or create a domain-specific cache
   */
  public getDomainCache<T>(domain: keyof typeof DomainCaches): any {
    let cache = this.caches.get(domain)
    if (!cache) {
      cache = DomainCaches[domain]()
      this.caches.set(domain, cache)
    }
    return cache
  }

  /**
   * Clear all caches
   */
  public clearAll(): void {
    for (const cache of this.caches.values()) {
      if (cache && typeof cache.clear === 'function') {
        cache.clear()
      }
    }
  }

  /**
   * Get aggregated statistics from all caches
   */
  public getAggregatedStats(): {
    totalCaches: number
    totalEntries: number
    totalMemoryUsage: number
    averageHitRate: number
    cacheStats: Record<string, any>
  } {
    let totalEntries = 0
    let totalMemoryUsage = 0
    let totalHitRate = 0
    let validCaches = 0
    const cacheStats: Record<string, any> = {}

    for (const [domain, cache] of this.caches.entries()) {
      if (cache && typeof cache.getStats === 'function') {
        const stats = cache.getStats()
        cacheStats[domain] = stats
        
        totalEntries += stats.size || 0
        totalMemoryUsage += stats.memoryUsage || 0
        
        if (typeof stats.hitRate === 'number' && !isNaN(stats.hitRate)) {
          totalHitRate += stats.hitRate
          validCaches++
        }
      }
    }

    return {
      totalCaches: this.caches.size,
      totalEntries,
      totalMemoryUsage,
      averageHitRate: validCaches > 0 ? totalHitRate / validCaches : 0,
      cacheStats
    }
  }

  /**
   * Cleanup all caches
   */
  public cleanupAll(): void {
    for (const cache of this.caches.values()) {
      if (cache && typeof cache.cleanup === 'function') {
        cache.cleanup()
      }
    }
  }

  /**
   * Destroy all caches and cleanup resources
   */
  public destroy(): void {
    for (const cache of this.caches.values()) {
      if (cache && typeof cache.destroy === 'function') {
        cache.destroy()
      }
    }
    this.caches.clear()
  }

  /**
   * Get cache recommendations based on usage patterns
   */
  public getRecommendations(): Array<{
    domain: string
    recommendation: string
    priority: 'low' | 'medium' | 'high'
  }> {
    const recommendations: Array<{
      domain: string
      recommendation: string
      priority: 'low' | 'medium' | 'high'
    }> = []

    const stats = this.getAggregatedStats()

    // Check overall memory usage
    if (stats.totalMemoryUsage > 100 * 1024 * 1024) { // 100MB
      recommendations.push({
        domain: 'global',
        recommendation: 'Total memory usage is high. Consider reducing cache sizes or implementing compression.',
        priority: 'high'
      })
    }

    // Check individual cache performance
    for (const [domain, cacheStats] of Object.entries(stats.cacheStats)) {
      if (cacheStats.hitRate < 0.5) {
        recommendations.push({
          domain,
          recommendation: `Low hit rate (${(cacheStats.hitRate * 100).toFixed(1)}%). Review cache strategy or TTL settings.`,
          priority: 'medium'
        })
      }

      if (cacheStats.evictionCount > cacheStats.size * 2) {
        recommendations.push({
          domain,
          recommendation: 'High eviction rate detected. Consider increasing cache size.',
          priority: 'medium'
        })
      }
    }

    return recommendations
  }
}

// ============================================================================
// Global Cache Coordinator Instance
// ============================================================================

export const globalCacheCoordinator = new CacheCoordinator()

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick access to domain-specific caches
 */
export const getCacheFor = {
  templates: () => globalCacheCoordinator.getDomainCache('templateMetadata'),
  workflows: () => globalCacheCoordinator.getDomainCache('workflowInstances'),
  permissions: () => globalCacheCoordinator.getDomainCache('userPermissions'),
  ui: () => globalCacheCoordinator.getDomainCache('uiState'),
  api: () => globalCacheCoordinator.getDomainCache('apiResponses'),
  assets: () => globalCacheCoordinator.getDomainCache('assets')
}

/**
 * Initialize all domain caches
 */
export function initializeDomainCaches(): void {
  Object.keys(DomainCaches).forEach(domain => {
    globalCacheCoordinator.getDomainCache(domain as keyof typeof DomainCaches)
  })
}

/**
 * Get cache system health status
 */
export function getCacheSystemHealth(): {
  status: 'healthy' | 'warning' | 'critical'
  stats: ReturnType<CacheCoordinator['getAggregatedStats']>
  recommendations: ReturnType<CacheCoordinator['getRecommendations']>
} {
  const stats = globalCacheCoordinator.getAggregatedStats()
  const recommendations = globalCacheCoordinator.getRecommendations()

  let status: 'healthy' | 'warning' | 'critical' = 'healthy'

  // Determine health status
  if (recommendations.some(r => r.priority === 'high')) {
    status = 'critical'
  } else if (recommendations.some(r => r.priority === 'medium')) {
    status = 'warning'
  }

  return {
    status,
    stats,
    recommendations
  }
} 