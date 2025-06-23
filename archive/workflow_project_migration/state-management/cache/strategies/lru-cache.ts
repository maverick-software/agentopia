/**
 * LRU (Least Recently Used) Cache Strategy
 * 
 * Implements a cache that evicts the least recently used items when capacity is reached.
 * Uses a doubly-linked list for O(1) access time tracking and efficient eviction.
 */

import { BaseCache, CacheEntryImpl, type CacheConfig } from '../cache-manager'

// ============================================================================
// LRU Node Implementation
// ============================================================================

class LRUNode<T> {
  public prev: LRUNode<T> | null = null
  public next: LRUNode<T> | null = null

  constructor(
    public key: string,
    public entry: CacheEntryImpl<T>
  ) {}
}

// ============================================================================
// LRU Cache Implementation
// ============================================================================

export class LRUCache<T> extends BaseCache<T> {
  private accessOrder = new Map<string, LRUNode<T>>()
  private head: LRUNode<T> | null = null
  private tail: LRUNode<T> | null = null

  constructor(config: CacheConfig) {
    super({
      ...config,
      strategy: 'lru'
    })
  }

  // ============================================================================
  // Abstract Method Implementations
  // ============================================================================

  protected onGet(entry: CacheEntryImpl<T>): void {
    // Move to front of access order (most recently used)
    this.moveToFront(entry.key)
  }

  protected onSet(entry: CacheEntryImpl<T>): void {
    // Add to front of access order (most recently used)
    this.addToFront(entry.key, entry)
  }

  protected selectEvictionCandidate(): string | null {
    // Return least recently used item (tail of the list)
    return this.tail?.key || null
  }

  // ============================================================================
  // LRU-Specific Operations
  // ============================================================================

  public delete(key: string): boolean {
    const deleted = super.delete(key)
    if (deleted) {
      this.removeFromAccessOrder(key)
    }
    return deleted
  }

  public clear(): void {
    super.clear()
    this.clearAccessOrder()
  }

  // ============================================================================
  // Access Order Management
  // ============================================================================

  private addToFront(key: string, entry: CacheEntryImpl<T>): void {
    // Remove existing node if it exists
    this.removeFromAccessOrder(key)

    // Create new node
    const node = new LRUNode(key, entry)
    this.accessOrder.set(key, node)

    if (!this.head) {
      // First node
      this.head = this.tail = node
    } else {
      // Add to front
      node.next = this.head
      this.head.prev = node
      this.head = node
    }
  }

  private moveToFront(key: string): void {
    const node = this.accessOrder.get(key)
    if (!node || node === this.head) {
      return // Already at front or doesn't exist
    }

    // Remove from current position
    this.removeNodeFromList(node)

    // Add to front
    node.prev = null
    node.next = this.head
    if (this.head) {
      this.head.prev = node
    }
    this.head = node

    // Update tail if necessary
    if (!this.tail) {
      this.tail = node
    }
  }

  protected removeFromAccessOrder(key: string): void {
    const node = this.accessOrder.get(key)
    if (!node) return

    this.accessOrder.delete(key)
    this.removeNodeFromList(node)
  }

  private removeNodeFromList(node: LRUNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next
    } else {
      this.head = node.next
    }

    if (node.next) {
      node.next.prev = node.prev
    } else {
      this.tail = node.prev
    }

    node.prev = null
    node.next = null
  }

  private clearAccessOrder(): void {
    this.accessOrder.clear()
    this.head = null
    this.tail = null
  }

  // ============================================================================
  // LRU-Specific Statistics
  // ============================================================================

  public getAccessOrder(): string[] {
    const order: string[] = []
    let current = this.head

    while (current) {
      order.push(current.key)
      current = current.next
    }

    return order
  }

  public getMostRecentlyUsed(): string | null {
    return this.head?.key || null
  }

  public getLeastRecentlyUsed(): string | null {
    return this.tail?.key || null
  }

  // ============================================================================
  // Enhanced Eviction with LRU Logic
  // ============================================================================

  protected evictEntries(count: number): void {
    for (let i = 0; i < count; i++) {
      const keyToEvict = this.selectEvictionCandidate()
      if (keyToEvict) {
        this.cacheEntries.delete(keyToEvict)
        this.removeFromAccessOrder(keyToEvict)
        this.stats.evictionCount++
      } else {
        break
      }
    }
  }

  // ============================================================================
  // Validation and Debugging
  // ============================================================================

  public validateIntegrity(): boolean {
    // Check that all cache entries have corresponding access order nodes
    for (const key of this.cacheEntries.keys()) {
      if (!this.accessOrder.has(key)) {
        console.error(`LRU integrity error: Cache entry ${key} missing from access order`)
        return false
      }
    }

    // Check that all access order nodes have corresponding cache entries
    for (const key of this.accessOrder.keys()) {
      if (!this.cacheEntries.has(key)) {
        console.error(`LRU integrity error: Access order node ${key} missing from cache entries`)
        return false
      }
    }

    // Check linked list integrity
    let nodeCount = 0
    let current = this.head
    let prev: LRUNode<T> | null = null

    while (current) {
      nodeCount++
      
      if (current.prev !== prev) {
        console.error(`LRU integrity error: Node ${current.key} has incorrect prev pointer`)
        return false
      }

      prev = current
      current = current.next
    }

    if (prev !== this.tail) {
      console.error('LRU integrity error: Tail pointer is incorrect')
      return false
    }

    if (nodeCount !== this.accessOrder.size) {
      console.error(`LRU integrity error: Node count mismatch (${nodeCount} vs ${this.accessOrder.size})`)
      return false
    }

    return true
  }

  public getDebugInfo(): {
    cacheSize: number
    accessOrderSize: number
    accessOrder: string[]
    head: string | null
    tail: string | null
    isValid: boolean
  } {
    return {
      cacheSize: this.cacheEntries.size,
      accessOrderSize: this.accessOrder.size,
      accessOrder: this.getAccessOrder(),
      head: this.head?.key || null,
      tail: this.tail?.key || null,
      isValid: this.validateIntegrity()
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createLRUCache<T>(config: Partial<CacheConfig> = {}): LRUCache<T> {
  const defaultConfig: CacheConfig = {
    maxSize: 1000,
    defaultTTL: 0, // No TTL by default for LRU
    cleanupInterval: 60000, // 1 minute
    strategy: 'lru',
    evictionPolicy: 'lru',
    storage: 'memory',
    persistent: false,
    enableMetrics: true,
    enableLogging: false
  }

  return new LRUCache<T>({ ...defaultConfig, ...config })
}

// ============================================================================
// Exports
// ============================================================================

export { LRUCache as default }
export type { LRUNode } 