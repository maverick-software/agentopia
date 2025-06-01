/**
 * Cache Manager Core Implementation
 * 
 * Provides a unified interface for multiple caching strategies including
 * LRU (Least Recently Used), TTL (Time To Live), and Memory-based caching.
 */

import { globalLogger as logger } from '../debug/logger'
import { globalPerformanceMonitor as performanceMonitor } from '../debug/performance-monitor'
import type { CacheEntry } from '../core/types'

// ============================================================================
// Types & Interfaces
// ============================================================================

export type CacheStrategy = 'lru' | 'ttl' | 'memory' | 'hybrid'
export type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'random'
export type StorageType = 'memory' | 'session' | 'local' | 'indexeddb'

export interface CacheOptions {
  ttl?: number
  priority?: number
  tags?: string[]
  metadata?: Record<string, any>
}

export interface CacheConfig {
  // Size limits
  maxSize: number
  maxMemory?: number
  
  // Time settings
  defaultTTL: number
  cleanupInterval: number
  
  // Strategy settings
  strategy: CacheStrategy
  evictionPolicy: EvictionPolicy
  
  // Storage settings
  storage: StorageType
  persistent: boolean
  
  // Performance settings
  enableMetrics: boolean
  enableLogging: boolean
}

export interface CacheStats {
  size: number
  maxSize: number
  hitCount: number
  missCount: number
  hitRate: number
  memoryUsage: number
  evictionCount: number
  lastCleanup: number
  strategy: CacheStrategy
}

export interface CacheManager<T = any> {
  // Core operations
  get(key: string): T | null
  set(key: string, value: T, options?: CacheOptions): void
  delete(key: string): boolean
  clear(): void
  
  // Advanced operations
  has(key: string): boolean
  size(): number
  keys(): string[]
  values(): T[]
  getEntries(): Array<[string, T]>
  
  // Strategy management
  setStrategy(strategy: CacheStrategy): void
  getStrategy(): CacheStrategy
  
  // Statistics and monitoring
  getStats(): CacheStats
  resetStats(): void
  
  // Maintenance operations
  cleanup(): void
  evict(count?: number): number
  
  // Tag-based operations
  getByTag(tag: string): T[]
  deleteByTag(tag: string): number
  
  // Bulk operations
  mget(keys: string[]): Array<T | null>
  mset(entries: Array<[string, T, CacheOptions?]>): void
  mdelete(keys: string[]): number
}

// ============================================================================
// Cache Entry Implementation
// ============================================================================

class CacheEntryImpl<T> implements CacheEntry<T> {
  public accessCount = 0
  public lastAccessed: number
  public size: number

  constructor(
    public key: string,
    public value: T,
    public timestamp: number = Date.now(),
    public ttl?: number,
    public priority: number = 1,
    public tags: string[] = [],
    public metadata: Record<string, any> = {}
  ) {
    this.lastAccessed = timestamp
    this.size = this.calculateSize(value)
  }

  private calculateSize(value: T): number {
    try {
      return JSON.stringify(value).length * 2 // Rough estimate in bytes
    } catch {
      return 1000 // Default size for non-serializable objects
    }
  }

  public touch(): void {
    this.lastAccessed = Date.now()
    this.accessCount++
  }

  public isExpired(): boolean {
    return this.ttl ? Date.now() > (this.timestamp + this.ttl) : false
  }

  public hasTag(tag: string): boolean {
    return this.tags?.includes(tag) || false
  }
}

// ============================================================================
// Base Cache Implementation
// ============================================================================

abstract class BaseCache<T> implements CacheManager<T> {
  protected cacheEntries = new Map<string, CacheEntryImpl<T>>()
  protected stats: CacheStats
  protected cleanupTimer?: NodeJS.Timeout

  constructor(protected config: CacheConfig) {
    this.stats = {
      size: 0,
      maxSize: config.maxSize,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      memoryUsage: 0,
      evictionCount: 0,
      lastCleanup: Date.now(),
      strategy: config.strategy
    }

    this.startCleanupTimer()
  }

  // Abstract methods to be implemented by specific strategies
  protected abstract onGet(entry: CacheEntryImpl<T>): void
  protected abstract onSet(entry: CacheEntryImpl<T>): void
  protected abstract selectEvictionCandidate(): string | null

  // Core operations
  public get(key: string): T | null {
    const startTime = performance.now()
    
    try {
      const entry = this.cacheEntries.get(key)
      
      if (!entry) {
        this.recordMiss()
        return null
      }

      if (entry.isExpired()) {
        this.cacheEntries.delete(key)
        this.recordMiss()
        return null
      }

      entry.touch()
      this.onGet(entry)
      this.recordHit()
      
      if (this.config.enableLogging) {
        logger.debug('Cache hit', { key, strategy: this.config.strategy })
      }

      return entry.value
    } finally {
      if (this.config.enableMetrics) {
        const duration = performance.now() - startTime
        performanceMonitor.recordMetric({
          operation: `cache_get_${this.config.strategy}`,
          duration,
          timestamp: Date.now(),
          metadata: { category: 'cache-operation', key, strategy: this.config.strategy }
        })
      }
    }
  }

  public set(key: string, value: T, options: CacheOptions = {}): void {
    const startTime = performance.now()
    
    try {
      const ttl = options.ttl || this.config.defaultTTL
      
      const entry = new CacheEntryImpl(
        key,
        value,
        Date.now(),
        ttl > 0 ? ttl : undefined,
        options.priority || 1,
        options.tags || [],
        options.metadata || {}
      )

      // Check if we need to evict entries
      if (this.cacheEntries.size >= this.config.maxSize && !this.cacheEntries.has(key)) {
        this.evictEntries(1)
      }

      this.cacheEntries.set(key, entry)
      this.onSet(entry)
      this.updateMemoryUsage()

      if (this.config.enableLogging) {
        logger.debug('Cache set', { 
          key, 
          ttl, 
          strategy: this.config.strategy,
          size: entry.size 
        })
      }
    } finally {
      if (this.config.enableMetrics) {
        const duration = performance.now() - startTime
        performanceMonitor.recordMetric({
          operation: `cache_set_${this.config.strategy}`,
          duration,
          timestamp: Date.now(),
          metadata: { category: 'cache-operation', key, strategy: this.config.strategy }
        })
      }
    }
  }

  public delete(key: string): boolean {
    const deleted = this.cacheEntries.delete(key)
    if (deleted) {
      this.updateMemoryUsage()
      
      if (this.config.enableLogging) {
        logger.debug('Cache delete', { key, strategy: this.config.strategy })
      }
    }
    return deleted
  }

  public clear(): void {
    const size = this.cacheEntries.size
    this.cacheEntries.clear()
    this.updateMemoryUsage()
    
    if (this.config.enableLogging) {
      logger.info('Cache cleared', { 
        entriesRemoved: size, 
        strategy: this.config.strategy 
      })
    }
  }

  // Advanced operations
  public has(key: string): boolean {
    const entry = this.cacheEntries.get(key)
    return entry ? !entry.isExpired() : false
  }

  public size(): number {
    return this.cacheEntries.size
  }

  public keys(): string[] {
    return Array.from(this.cacheEntries.keys())
  }

  public values(): T[] {
    return Array.from(this.cacheEntries.values()).map(entry => entry.value)
  }

  public getEntries(): Array<[string, T]> {
    return Array.from(this.cacheEntries.entries()).map(([key, entry]) => [key, entry.value])
  }

  // Strategy management
  public setStrategy(strategy: CacheStrategy): void {
    this.config.strategy = strategy
    this.stats.strategy = strategy
  }

  public getStrategy(): CacheStrategy {
    return this.config.strategy
  }

  // Statistics and monitoring
  public getStats(): CacheStats {
    this.updateStats()
    return { ...this.stats }
  }

  public resetStats(): void {
    this.stats.hitCount = 0
    this.stats.missCount = 0
    this.stats.hitRate = 0
    this.stats.evictionCount = 0
  }

  // Maintenance operations
  public cleanup(): void {
    const startTime = performance.now()
    let removedCount = 0

    for (const [key, entry] of this.cacheEntries.entries()) {
      if (entry.isExpired()) {
        this.cacheEntries.delete(key)
        removedCount++
      }
    }

    this.updateMemoryUsage()
    this.stats.lastCleanup = Date.now()

    if (this.config.enableLogging && removedCount > 0) {
      logger.debug('Cache cleanup completed', {
        removedCount,
        duration: performance.now() - startTime,
        strategy: this.config.strategy
      })
    }
  }

  public evict(count: number = 1): number {
    let evicted = 0
    
    for (let i = 0; i < count; i++) {
      const keyToEvict = this.selectEvictionCandidate()
      if (keyToEvict && this.cacheEntries.delete(keyToEvict)) {
        evicted++
        this.stats.evictionCount++
      } else {
        break
      }
    }

    if (evicted > 0) {
      this.updateMemoryUsage()
      
      if (this.config.enableLogging) {
        logger.debug('Cache eviction completed', {
          evicted,
          strategy: this.config.strategy
        })
      }
    }

    return evicted
  }

  // Tag-based operations
  public getByTag(tag: string): T[] {
    const results: T[] = []
    
    for (const entry of this.cacheEntries.values()) {
      if (entry.hasTag(tag) && !entry.isExpired()) {
        results.push(entry.value)
      }
    }

    return results
  }

  public deleteByTag(tag: string): number {
    let deleted = 0
    
    for (const [key, entry] of this.cacheEntries.entries()) {
      if (entry.hasTag(tag)) {
        this.cacheEntries.delete(key)
        deleted++
      }
    }

    if (deleted > 0) {
      this.updateMemoryUsage()
      
      if (this.config.enableLogging) {
        logger.debug('Cache delete by tag', { tag, deleted, strategy: this.config.strategy })
      }
    }

    return deleted
  }

  // Bulk operations
  public mget(keys: string[]): Array<T | null> {
    return keys.map(key => this.get(key))
  }

  public mset(entries: Array<[string, T, CacheOptions?]>): void {
    entries.forEach(([key, value, options]) => {
      this.set(key, value, options)
    })
  }

  public mdelete(keys: string[]): number {
    let deleted = 0
    keys.forEach(key => {
      if (this.delete(key)) {
        deleted++
      }
    })
    return deleted
  }

  // Protected helper methods
  protected evictEntries(count: number): void {
    for (let i = 0; i < count; i++) {
      const keyToEvict = this.selectEvictionCandidate()
      if (keyToEvict) {
        this.cacheEntries.delete(keyToEvict)
        this.stats.evictionCount++
      } else {
        break
      }
    }
  }

  protected recordHit(): void {
    this.stats.hitCount++
    this.updateHitRate()
  }

  protected recordMiss(): void {
    this.stats.missCount++
    this.updateHitRate()
  }

  protected updateHitRate(): void {
    const total = this.stats.hitCount + this.stats.missCount
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0
  }

  protected updateMemoryUsage(): void {
    let totalSize = 0
    for (const entry of this.cacheEntries.values()) {
      totalSize += entry.size
    }
    this.stats.memoryUsage = totalSize
  }

  protected updateStats(): void {
    this.stats.size = this.cacheEntries.size
    this.updateMemoryUsage()
  }

  protected startCleanupTimer(): void {
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup()
      }, this.config.cleanupInterval)
    }
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.clear()
  }
}

// ============================================================================
// Export Base Cache for Strategy Implementations
// ============================================================================

export { BaseCache, CacheEntryImpl } 