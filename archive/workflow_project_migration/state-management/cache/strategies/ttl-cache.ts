/**
 * TTL (Time To Live) Cache Strategy
 * 
 * Implements a cache that automatically expires items based on their time-to-live.
 * Focuses on time-based eviction with efficient cleanup and expiration tracking.
 */

import { BaseCache, CacheEntryImpl, type CacheConfig } from '../cache-manager'
import { globalLogger as logger } from '../../debug/logger'

// ============================================================================
// TTL Expiration Tracker
// ============================================================================

interface ExpirationEntry {
  key: string
  expiry: number
}

class ExpirationTracker {
  private expirationQueue: ExpirationEntry[] = []
  private keyToIndex = new Map<string, number>()

  public add(key: string, expiry: number): void {
    this.remove(key) // Remove existing entry if present
    
    const entry: ExpirationEntry = { key, expiry }
    this.expirationQueue.push(entry)
    this.keyToIndex.set(key, this.expirationQueue.length - 1)
    
    // Maintain sorted order (earliest expiry first)
    this.bubbleUp(this.expirationQueue.length - 1)
  }

  public remove(key: string): void {
    const index = this.keyToIndex.get(key)
    if (index === undefined) return

    this.keyToIndex.delete(key)
    
    if (index === this.expirationQueue.length - 1) {
      // Last element, just pop
      this.expirationQueue.pop()
    } else {
      // Replace with last element and reheapify
      const lastEntry = this.expirationQueue.pop()!
      this.expirationQueue[index] = lastEntry
      this.keyToIndex.set(lastEntry.key, index)
      
      // Restore heap property
      this.bubbleDown(index)
      this.bubbleUp(index)
    }
  }

  public getExpiredKeys(now: number = Date.now()): string[] {
    const expired: string[] = []
    
    while (this.expirationQueue.length > 0 && this.expirationQueue[0].expiry <= now) {
      const entry = this.expirationQueue[0]
      expired.push(entry.key)
      this.remove(entry.key)
    }
    
    return expired
  }

  public getNextExpiry(): number | null {
    return this.expirationQueue.length > 0 ? this.expirationQueue[0].expiry : null
  }

  public clear(): void {
    this.expirationQueue = []
    this.keyToIndex.clear()
  }

  public size(): number {
    return this.expirationQueue.length
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)
      
      if (this.expirationQueue[index].expiry >= this.expirationQueue[parentIndex].expiry) {
        break
      }
      
      this.swap(index, parentIndex)
      index = parentIndex
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      let minIndex = index
      const leftChild = 2 * index + 1
      const rightChild = 2 * index + 2
      
      if (leftChild < this.expirationQueue.length && 
          this.expirationQueue[leftChild].expiry < this.expirationQueue[minIndex].expiry) {
        minIndex = leftChild
      }
      
      if (rightChild < this.expirationQueue.length && 
          this.expirationQueue[rightChild].expiry < this.expirationQueue[minIndex].expiry) {
        minIndex = rightChild
      }
      
      if (minIndex === index) break
      
      this.swap(index, minIndex)
      index = minIndex
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.expirationQueue[i]
    this.expirationQueue[i] = this.expirationQueue[j]
    this.expirationQueue[j] = temp
    
    // Update index mappings
    this.keyToIndex.set(this.expirationQueue[i].key, i)
    this.keyToIndex.set(this.expirationQueue[j].key, j)
  }
}

// ============================================================================
// TTL Cache Implementation
// ============================================================================

export class TTLCache<T> extends BaseCache<T> {
  private expirationTracker = new ExpirationTracker()
  private proactiveCleanupTimer?: NodeJS.Timeout

  constructor(config: CacheConfig) {
    super({
      ...config,
      strategy: 'ttl'
    })

    this.startProactiveCleanup()
  }

  // ============================================================================
  // Abstract Method Implementations
  // ============================================================================

  protected onGet(entry: CacheEntryImpl<T>): void {
    // TTL cache doesn't need special handling on get
    // Expiration is handled proactively and during cleanup
  }

  protected onSet(entry: CacheEntryImpl<T>): void {
    // Track expiration if TTL is set
    if (entry.ttl && entry.ttl > 0) {
      const expiry = entry.timestamp + entry.ttl
      this.expirationTracker.add(entry.key, expiry)
    }
  }

  protected selectEvictionCandidate(): string | null {
    // For TTL cache, prefer expired items first
    const expiredKeys = this.expirationTracker.getExpiredKeys()
    if (expiredKeys.length > 0) {
      return expiredKeys[0]
    }

    // If no expired items, evict the earliest expiring item
    const nextExpiry = this.expirationTracker.getNextExpiry()
    if (nextExpiry) {
      for (const [key, entry] of this.cacheEntries.entries()) {
        if (entry.ttl && (entry.timestamp + entry.ttl) === nextExpiry) {
          return key
        }
      }
    }

    // Fallback to any item
    return this.cacheEntries.keys().next().value || null
  }

  // ============================================================================
  // TTL-Specific Operations
  // ============================================================================

  public delete(key: string): boolean {
    const deleted = super.delete(key)
    if (deleted) {
      this.expirationTracker.remove(key)
    }
    return deleted
  }

  public clear(): void {
    super.clear()
    this.expirationTracker.clear()
  }

  public cleanup(): void {
    const startTime = performance.now()
    const expiredKeys = this.expirationTracker.getExpiredKeys()
    
    let removedCount = 0
    for (const key of expiredKeys) {
      if (this.cacheEntries.delete(key)) {
        removedCount++
      }
    }

    this.updateMemoryUsage()
    this.stats.lastCleanup = Date.now()

    if (this.config.enableLogging && removedCount > 0) {
      logger.debug('TTL cache cleanup completed', {
        removedCount,
        duration: performance.now() - startTime,
        strategy: this.config.strategy
      })
    }
  }

  // ============================================================================
  // TTL-Specific Features
  // ============================================================================

  public getTimeToExpiry(key: string): number | null {
    const entry = this.cacheEntries.get(key)
    if (!entry || !entry.ttl) return null

    const expiry = entry.timestamp + entry.ttl
    const remaining = expiry - Date.now()
    return Math.max(0, remaining)
  }

  public extendTTL(key: string, additionalTime: number): boolean {
    const entry = this.cacheEntries.get(key)
    if (!entry || !entry.ttl) return false

    // Remove from current expiration tracking
    this.expirationTracker.remove(key)

    // Update TTL
    entry.ttl += additionalTime

    // Re-add to expiration tracking
    const newExpiry = entry.timestamp + entry.ttl
    this.expirationTracker.add(key, newExpiry)

    return true
  }

  public setTTL(key: string, ttl: number): boolean {
    const entry = this.cacheEntries.get(key)
    if (!entry) return false

    // Remove from current expiration tracking
    this.expirationTracker.remove(key)

    // Update TTL
    entry.ttl = ttl

    // Re-add to expiration tracking if TTL > 0
    if (ttl > 0) {
      const expiry = entry.timestamp + ttl
      this.expirationTracker.add(key, expiry)
    }

    return true
  }

  public getExpiringKeys(withinMs: number): string[] {
    const threshold = Date.now() + withinMs
    const expiringKeys: string[] = []

    for (const [key, entry] of this.cacheEntries.entries()) {
      if (entry.ttl && (entry.timestamp + entry.ttl) <= threshold) {
        expiringKeys.push(key)
      }
    }

    return expiringKeys.sort((a, b) => {
      const entryA = this.cacheEntries.get(a)!
      const entryB = this.cacheEntries.get(b)!
      const expiryA = entryA.timestamp + entryA.ttl!
      const expiryB = entryB.timestamp + entryB.ttl!
      return expiryA - expiryB
    })
  }

  // ============================================================================
  // Proactive Cleanup
  // ============================================================================

  private startProactiveCleanup(): void {
    // More frequent cleanup for TTL cache
    const cleanupInterval = Math.min(this.config.cleanupInterval, 30000) // Max 30 seconds
    
    this.proactiveCleanupTimer = setInterval(() => {
      this.cleanup()
    }, cleanupInterval)
  }

  public destroy(): void {
    if (this.proactiveCleanupTimer) {
      clearInterval(this.proactiveCleanupTimer)
    }
    super.destroy()
    this.expirationTracker.clear()
  }

  // ============================================================================
  // TTL-Specific Statistics
  // ============================================================================

  public getTTLStats(): {
    totalWithTTL: number
    averageTTL: number
    nextExpiry: number | null
    expiringIn5Min: number
    expiringIn1Hour: number
  } {
    let totalWithTTL = 0
    let totalTTL = 0

    for (const entry of this.cacheEntries.values()) {
      if (entry.ttl && entry.ttl > 0) {
        totalWithTTL++
        totalTTL += entry.ttl
      }
    }

    return {
      totalWithTTL,
      averageTTL: totalWithTTL > 0 ? totalTTL / totalWithTTL : 0,
      nextExpiry: this.expirationTracker.getNextExpiry(),
      expiringIn5Min: this.getExpiringKeys(5 * 60 * 1000).length,
      expiringIn1Hour: this.getExpiringKeys(60 * 60 * 1000).length
    }
  }

  public getDebugInfo(): {
    cacheSize: number
    trackerSize: number
    nextExpiry: number | null
    ttlStats: ReturnType<TTLCache<T>['getTTLStats']>
  } {
    return {
      cacheSize: this.cacheEntries.size,
      trackerSize: this.expirationTracker.size(),
      nextExpiry: this.expirationTracker.getNextExpiry(),
      ttlStats: this.getTTLStats()
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createTTLCache<T>(config: Partial<CacheConfig> = {}): TTLCache<T> {
  const defaultConfig: CacheConfig = {
    maxSize: 1000,
    defaultTTL: 300000, // 5 minutes default TTL
    cleanupInterval: 30000, // 30 seconds
    strategy: 'ttl',
    evictionPolicy: 'lru', // Fallback eviction policy
    storage: 'memory',
    persistent: false,
    enableMetrics: true,
    enableLogging: false
  }

  return new TTLCache<T>({ ...defaultConfig, ...config })
}

// ============================================================================
// Exports
// ============================================================================

export { TTLCache as default }
export type { ExpirationEntry } 