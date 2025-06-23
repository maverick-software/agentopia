/**
 * Cache Strategies Index
 * 
 * Exports all cache strategy implementations and provides unified factory functions
 * for creating different types of caches with appropriate configurations.
 */

import { LRUCache, createLRUCache } from './lru-cache'
import { TTLCache, createTTLCache } from './ttl-cache'
import { MemoryCache, createMemoryCache } from './memory-cache'
import type { CacheConfig, CacheStrategy, CacheManager } from '../cache-manager'

// ============================================================================
// Strategy Exports
// ============================================================================

export { LRUCache, createLRUCache } from './lru-cache'
export { TTLCache, createTTLCache } from './ttl-cache'
export { MemoryCache, createMemoryCache } from './memory-cache'

// ============================================================================
// Unified Cache Factory
// ============================================================================

export function createCache<T>(
  strategy: CacheStrategy,
  config: Partial<CacheConfig> = {}
): CacheManager<T> {
  switch (strategy) {
    case 'lru':
      return createLRUCache<T>(config)
    
    case 'ttl':
      return createTTLCache<T>(config)
    
    case 'memory':
      return createMemoryCache<T>(config)
    
    case 'hybrid':
      // Hybrid cache combines LRU with TTL
      return createHybridCache<T>(config)
    
    default:
      throw new Error(`Unknown cache strategy: ${strategy}`)
  }
}

// ============================================================================
// Hybrid Cache Implementation
// ============================================================================

class HybridCache<T> extends LRUCache<T> {
  private ttlTracker = new Map<string, number>()

  constructor(config: CacheConfig) {
    super({
      ...config,
      strategy: 'hybrid'
    })
  }

  protected onSet(entry: CacheEntryImpl<T>): void {
    super.onSet(entry)
    
    // Track TTL if specified
    if (entry.ttl && entry.ttl > 0) {
      const expiry = entry.timestamp + entry.ttl
      this.ttlTracker.set(entry.key, expiry)
    }
  }

  public delete(key: string): boolean {
    const deleted = super.delete(key)
    if (deleted) {
      this.ttlTracker.delete(key)
    }
    return deleted
  }

  public clear(): void {
    super.clear()
    this.ttlTracker.clear()
  }

  protected selectEvictionCandidate(): string | null {
    // First, check for expired items
    const now = Date.now()
    for (const [key, expiry] of this.ttlTracker.entries()) {
      if (expiry <= now) {
        return key
      }
    }

    // Fall back to LRU eviction
    return super.selectEvictionCandidate()
  }

  public cleanup(): void {
    const startTime = performance.now()
    let removedCount = 0

    // Remove expired entries
    const now = Date.now()
    const expiredKeys: string[] = []
    
    for (const [key, expiry] of this.ttlTracker.entries()) {
      if (expiry <= now) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      if (this.cacheEntries.delete(key)) {
        this.ttlTracker.delete(key)
        this.removeFromAccessOrder(key)
        removedCount++
      }
    }

    this.updateMemoryUsage()
    this.stats.lastCleanup = Date.now()

    if (this.config.enableLogging && removedCount > 0) {
      logger.debug('Hybrid cache cleanup completed', {
        removedCount,
        duration: performance.now() - startTime,
        strategy: this.config.strategy
      })
    }
  }

  public getHybridStats(): {
    lruStats: ReturnType<LRUCache<T>['getDebugInfo']>
    ttlTrackedEntries: number
    expiredEntries: number
  } {
    const now = Date.now()
    let expiredCount = 0
    
    for (const expiry of this.ttlTracker.values()) {
      if (expiry <= now) {
        expiredCount++
      }
    }

    return {
      lruStats: super.getDebugInfo(),
      ttlTrackedEntries: this.ttlTracker.size,
      expiredEntries: expiredCount
    }
  }
}

function createHybridCache<T>(config: Partial<CacheConfig> = {}): HybridCache<T> {
  const defaultConfig: CacheConfig = {
    maxSize: 1000,
    defaultTTL: 300000, // 5 minutes
    cleanupInterval: 30000, // 30 seconds
    strategy: 'hybrid',
    evictionPolicy: 'lru',
    storage: 'memory',
    persistent: false,
    enableMetrics: true,
    enableLogging: false
  }

  return new HybridCache<T>({ ...defaultConfig, ...config })
}

// ============================================================================
// Preset Configurations
// ============================================================================

export const CachePresets = {
  /**
   * Fast access cache with LRU eviction
   * Good for frequently accessed data
   */
  fastAccess: (maxSize: number = 500): Partial<CacheConfig> => ({
    strategy: 'lru' as const,
    maxSize,
    defaultTTL: 0,
    cleanupInterval: 60000,
    enableMetrics: true,
    enableLogging: false
  }),

  /**
   * Session cache with TTL expiration
   * Good for user session data
   */
  session: (ttlMinutes: number = 30): Partial<CacheConfig> => ({
    strategy: 'ttl' as const,
    maxSize: 1000,
    defaultTTL: ttlMinutes * 60 * 1000,
    cleanupInterval: 60000,
    enableMetrics: true,
    enableLogging: false
  }),

  /**
   * Memory-efficient cache for large data
   * Good for caching large objects with size constraints
   */
  memoryEfficient: (maxMemoryMB: number = 50): Partial<CacheConfig> => ({
    strategy: 'memory' as const,
    maxSize: 1000,
    maxMemory: maxMemoryMB * 1024 * 1024,
    defaultTTL: 0,
    cleanupInterval: 30000,
    enableMetrics: true,
    enableLogging: false
  }),

  /**
   * Balanced cache with both LRU and TTL
   * Good for general-purpose caching
   */
  balanced: (maxSize: number = 1000, ttlMinutes: number = 15): Partial<CacheConfig> => ({
    strategy: 'hybrid' as const,
    maxSize,
    defaultTTL: ttlMinutes * 60 * 1000,
    cleanupInterval: 30000,
    enableMetrics: true,
    enableLogging: false
  }),

  /**
   * Development cache with extensive logging
   * Good for debugging and development
   */
  development: (): Partial<CacheConfig> => ({
    strategy: 'hybrid' as const,
    maxSize: 100,
    defaultTTL: 60000, // 1 minute
    cleanupInterval: 10000, // 10 seconds
    enableMetrics: true,
    enableLogging: true
  })
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getCacheRecommendation(
  usage: {
    dataSize: 'small' | 'medium' | 'large'
    accessPattern: 'frequent' | 'occasional' | 'rare'
    dataLifetime: 'short' | 'medium' | 'long'
    memoryConstraints: 'tight' | 'moderate' | 'relaxed'
  }
): { strategy: CacheStrategy; config: Partial<CacheConfig>; reasoning: string } {
  
  // Memory-constrained environments
  if (usage.memoryConstraints === 'tight') {
    return {
      strategy: 'memory',
      config: CachePresets.memoryEfficient(25),
      reasoning: 'Memory cache recommended for tight memory constraints'
    }
  }

  // Large data with infrequent access
  if (usage.dataSize === 'large' && usage.accessPattern === 'rare') {
    return {
      strategy: 'ttl',
      config: CachePresets.session(5),
      reasoning: 'TTL cache recommended for large, rarely accessed data'
    }
  }

  // Frequently accessed data
  if (usage.accessPattern === 'frequent') {
    return {
      strategy: 'lru',
      config: CachePresets.fastAccess(1000),
      reasoning: 'LRU cache recommended for frequently accessed data'
    }
  }

  // Short-lived data
  if (usage.dataLifetime === 'short') {
    return {
      strategy: 'ttl',
      config: CachePresets.session(10),
      reasoning: 'TTL cache recommended for short-lived data'
    }
  }

  // Default to balanced approach
  return {
    strategy: 'hybrid',
    config: CachePresets.balanced(),
    reasoning: 'Hybrid cache recommended for balanced performance'
  }
}

// ============================================================================
// Type Exports
// ============================================================================

export type {
  CacheConfig,
  CacheStrategy,
  CacheManager,
  CacheOptions,
  CacheStats
} from '../cache-manager'

// Import required types for hybrid cache
import type { CacheEntryImpl } from '../cache-manager'
import { globalLogger as logger } from '../../debug/logger' 