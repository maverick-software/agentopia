/**
 * Memory Cache Strategy
 * 
 * Implements a cache that focuses on memory efficiency with size-based eviction.
 * Monitors memory usage and implements intelligent eviction based on size and access patterns.
 */

import { BaseCache, CacheEntryImpl, type CacheConfig } from '../cache-manager'
import { globalLogger as logger } from '../../debug/logger'

// ============================================================================
// Memory Usage Tracker
// ============================================================================

interface MemoryStats {
  totalSize: number
  averageEntrySize: number
  largestEntry: number
  smallestEntry: number
  memoryEfficiency: number // hit rate per byte
}

class MemoryTracker {
  private sizeMap = new Map<string, number>()
  private totalSize = 0

  public add(key: string, size: number): void {
    const existingSize = this.sizeMap.get(key) || 0
    this.sizeMap.set(key, size)
    this.totalSize = this.totalSize - existingSize + size
  }

  public remove(key: string): void {
    const size = this.sizeMap.get(key) || 0
    this.sizeMap.delete(key)
    this.totalSize -= size
  }

  public getSize(key: string): number {
    return this.sizeMap.get(key) || 0
  }

  public getTotalSize(): number {
    return this.totalSize
  }

  public getStats(): MemoryStats {
    const sizes = Array.from(this.sizeMap.values())
    const count = sizes.length

    return {
      totalSize: this.totalSize,
      averageEntrySize: count > 0 ? this.totalSize / count : 0,
      largestEntry: count > 0 ? Math.max(...sizes) : 0,
      smallestEntry: count > 0 ? Math.min(...sizes) : 0,
      memoryEfficiency: 0 // Will be calculated by the cache
    }
  }

  public getLargestEntries(count: number): Array<{ key: string; size: number }> {
    return Array.from(this.sizeMap.entries())
      .map(([key, size]) => ({ key, size }))
      .sort((a, b) => b.size - a.size)
      .slice(0, count)
  }

  public clear(): void {
    this.sizeMap.clear()
    this.totalSize = 0
  }
}

// ============================================================================
// Memory Cache Implementation
// ============================================================================

export class MemoryCache<T> extends BaseCache<T> {
  private memoryTracker = new MemoryTracker()
  private maxMemoryBytes: number
  private memoryPressureThreshold: number
  private lastMemoryCheck = 0
  private memoryCheckInterval = 5000 // 5 seconds

  constructor(config: CacheConfig) {
    super({
      ...config,
      strategy: 'memory'
    })

    this.maxMemoryBytes = config.maxMemory || 50 * 1024 * 1024 // 50MB default
    this.memoryPressureThreshold = this.maxMemoryBytes * 0.8 // 80% threshold
  }

  // ============================================================================
  // Abstract Method Implementations
  // ============================================================================

  protected onGet(entry: CacheEntryImpl<T>): void {
    // Check memory pressure periodically
    this.checkMemoryPressure()
  }

  protected onSet(entry: CacheEntryImpl<T>): void {
    // Track memory usage
    this.memoryTracker.add(entry.key, entry.size)
    
    // Check if we need to free memory
    this.enforceMemoryLimits()
  }

  protected selectEvictionCandidate(): string | null {
    // Memory cache uses a hybrid approach:
    // 1. Prefer large, infrequently accessed items
    // 2. Consider access patterns and size efficiency

    const candidates: Array<{
      key: string
      entry: CacheEntryImpl<T>
      score: number
    }> = []

    for (const [key, entry] of this.cacheEntries.entries()) {
      // Calculate eviction score (higher = more likely to evict)
      const timeSinceAccess = Date.now() - entry.lastAccessed
      const sizeWeight = entry.size / 1000 // Size in KB
      const accessWeight = 1 / Math.max(entry.accessCount, 1)
      
      const score = (timeSinceAccess / 1000) * sizeWeight * accessWeight
      
      candidates.push({ key, entry, score })
    }

    // Sort by score (highest first) and return the best candidate
    candidates.sort((a, b) => b.score - a.score)
    return candidates.length > 0 ? candidates[0].key : null
  }

  // ============================================================================
  // Memory-Specific Operations
  // ============================================================================

  public delete(key: string): boolean {
    const deleted = super.delete(key)
    if (deleted) {
      this.memoryTracker.remove(key)
    }
    return deleted
  }

  public clear(): void {
    super.clear()
    this.memoryTracker.clear()
  }

  // ============================================================================
  // Memory Management
  // ============================================================================

  private checkMemoryPressure(): void {
    const now = Date.now()
    if (now - this.lastMemoryCheck < this.memoryCheckInterval) {
      return
    }

    this.lastMemoryCheck = now
    const currentMemory = this.memoryTracker.getTotalSize()

    if (currentMemory > this.memoryPressureThreshold) {
      this.freeMemory(currentMemory - this.memoryPressureThreshold)
    }
  }

  private enforceMemoryLimits(): void {
    const currentMemory = this.memoryTracker.getTotalSize()
    
    if (currentMemory > this.maxMemoryBytes) {
      const targetReduction = currentMemory - this.maxMemoryBytes
      this.freeMemory(targetReduction)
    }
  }

  private freeMemory(targetBytes: number): void {
    let freedBytes = 0
    let evictedCount = 0

    while (freedBytes < targetBytes && this.cacheEntries.size > 0) {
      const keyToEvict = this.selectEvictionCandidate()
      if (!keyToEvict) break

      const entry = this.cacheEntries.get(keyToEvict)
      if (entry) {
        freedBytes += entry.size
        evictedCount++
        this.delete(keyToEvict)
      }
    }

    if (this.config.enableLogging && evictedCount > 0) {
      logger.debug('Memory cache freed memory', {
        evictedCount,
        freedBytes,
        targetBytes,
        strategy: this.config.strategy
      })
    }
  }

  // ============================================================================
  // Memory-Specific Features
  // ============================================================================

  public getMemoryUsage(): number {
    return this.memoryTracker.getTotalSize()
  }

  public getMemoryStats(): MemoryStats & {
    maxMemory: number
    memoryPressureThreshold: number
    memoryUtilization: number
  } {
    const stats = this.memoryTracker.getStats()
    const currentMemory = this.memoryTracker.getTotalSize()
    
    // Calculate memory efficiency (hits per byte)
    stats.memoryEfficiency = currentMemory > 0 ? this.stats.hitCount / currentMemory : 0

    return {
      ...stats,
      maxMemory: this.maxMemoryBytes,
      memoryPressureThreshold: this.memoryPressureThreshold,
      memoryUtilization: currentMemory / this.maxMemoryBytes
    }
  }

  public getLargestEntries(count: number = 10): Array<{
    key: string
    size: number
    accessCount: number
    lastAccessed: number
  }> {
    const largestBySize = this.memoryTracker.getLargestEntries(count)
    
    return largestBySize.map(({ key, size }) => {
      const entry = this.cacheEntries.get(key)!
      return {
        key,
        size,
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed
      }
    })
  }

  public optimizeMemory(): {
    beforeSize: number
    afterSize: number
    evictedCount: number
    recommendations: string[]
  } {
    const beforeSize = this.memoryTracker.getTotalSize()
    let evictedCount = 0
    const recommendations: string[] = []

    // Remove expired entries first
    const expiredKeys: string[] = []
    for (const [key, entry] of this.cacheEntries.entries()) {
      if (entry.isExpired()) {
        expiredKeys.push(key)
      }
    }

    expiredKeys.forEach(key => {
      this.delete(key)
      evictedCount++
    })

    // Analyze memory usage patterns
    const stats = this.getMemoryStats()
    
    if (stats.memoryUtilization > 0.9) {
      recommendations.push('Consider increasing maxMemory limit')
    }

    if (stats.averageEntrySize > 10000) { // 10KB
      recommendations.push('Consider implementing compression for large entries')
    }

    if (stats.memoryEfficiency < 0.001) {
      recommendations.push('Low memory efficiency - review cache hit patterns')
    }

    const afterSize = this.memoryTracker.getTotalSize()

    return {
      beforeSize,
      afterSize,
      evictedCount,
      recommendations
    }
  }

  public setMemoryLimit(maxBytes: number): void {
    this.maxMemoryBytes = maxBytes
    this.memoryPressureThreshold = maxBytes * 0.8
    this.enforceMemoryLimits()
  }

  // ============================================================================
  // Enhanced Statistics
  // ============================================================================

  public getDetailedStats(): ReturnType<MemoryCache<T>['getStats']> & {
    memoryStats: ReturnType<MemoryCache<T>['getMemoryStats']>
    topEntries: ReturnType<MemoryCache<T>['getLargestEntries']>
  } {
    return {
      ...super.getStats(),
      memoryStats: this.getMemoryStats(),
      topEntries: this.getLargestEntries(5)
    }
  }

  public getDebugInfo(): {
    cacheSize: number
    memoryUsage: number
    memoryLimit: number
    memoryUtilization: number
    largestEntries: ReturnType<MemoryCache<T>['getLargestEntries']>
    memoryStats: ReturnType<MemoryCache<T>['getMemoryStats']>
  } {
    const memoryStats = this.getMemoryStats()
    
    return {
      cacheSize: this.cacheEntries.size,
      memoryUsage: this.memoryTracker.getTotalSize(),
      memoryLimit: this.maxMemoryBytes,
      memoryUtilization: memoryStats.memoryUtilization,
      largestEntries: this.getLargestEntries(10),
      memoryStats
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMemoryCache<T>(config: Partial<CacheConfig> = {}): MemoryCache<T> {
  const defaultConfig: CacheConfig = {
    maxSize: 1000,
    maxMemory: 50 * 1024 * 1024, // 50MB
    defaultTTL: 0, // No TTL by default
    cleanupInterval: 60000, // 1 minute
    strategy: 'memory',
    evictionPolicy: 'lru',
    storage: 'memory',
    persistent: false,
    enableMetrics: true,
    enableLogging: false
  }

  return new MemoryCache<T>({ ...defaultConfig, ...config })
}

// ============================================================================
// Exports
// ============================================================================

export { MemoryCache as default }
export type { MemoryStats } 