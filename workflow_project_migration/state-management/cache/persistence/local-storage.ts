import { globalLogger } from '../../debug/logger';
import { globalPerformanceMonitor } from '../../debug/performance-monitor';
import type { PerformanceMetric } from '../../core/types';

/**
 * Local Storage Cache Persistence Adapter
 * 
 * Provides persistent cache storage using localStorage.
 * Data persists across browser sessions until manually cleared.
 * 
 * Features:
 * - Persistent storage across browser sessions
 * - Automatic JSON serialization/deserialization
 * - Quota management with cleanup
 * - Performance monitoring
 * - Error handling with fallbacks
 * - Cross-tab synchronization via storage events
 */

export interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl?: number;
  tags?: string[];
  size: number;
}

export interface LocalStorageOptions {
  prefix?: string;
  maxSize?: number;
  compressionThreshold?: number;
  enableMetrics?: boolean;
  enableSync?: boolean;
}

export class LocalStorageCacheAdapter {
  private prefix: string;
  private maxSize: number;
  private compressionThreshold: number;
  private enableMetrics: boolean;
  private enableSync: boolean;
  private currentSize: number = 0;
  private syncListeners = new Set<(event: StorageEvent) => void>();

  constructor(options: LocalStorageOptions = {}) {
    this.prefix = options.prefix || 'cache_';
    this.maxSize = options.maxSize || 8 * 1024 * 1024; // 8MB default (localStorage limit ~10MB)
    this.compressionThreshold = options.compressionThreshold || 1024; // 1KB
    this.enableMetrics = options.enableMetrics ?? true;
    this.enableSync = options.enableSync ?? true;
    
    this.calculateCurrentSize();
    
    if (this.enableSync) {
      this.setupStorageEventListener();
    }
    
    globalLogger.info('LocalStorageCacheAdapter initialized', {
      prefix: this.prefix,
      maxSize: this.maxSize,
      compressionThreshold: this.compressionThreshold,
      enableSync: this.enableSync
    });
  }

  /**
   * Initialize the adapter
   */
  async init(): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Test localStorage availability
      const testKey = `${this.prefix}test`;
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      
      this.calculateCurrentSize();
      
      // Clean up expired entries on initialization
      await this.cleanupExpired();
      
      if (this.enableMetrics) {
        const metric: PerformanceMetric = {
          operation: 'cache_local_init',
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          metadata: { success: true }
        };
        globalPerformanceMonitor.recordMetric(metric);
      }
      
      globalLogger.info('LocalStorage cache adapter initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      globalLogger.error('Failed to initialize LocalStorage cache adapter', error as Error);
      throw new Error(`LocalStorage not available: ${errorMessage}`);
    }
  }

  /**
   * Get a cache entry by key
   */
  async get(key: string): Promise<any> {
    const startTime = performance.now();
    const fullKey = this.getFullKey(key);
    
    try {
      const item = localStorage.getItem(fullKey);
      if (!item) {
        return null;
      }

      const entry: CacheEntry = JSON.parse(item);
      
      // Check TTL expiration
      if (entry.ttl && Date.now() > entry.timestamp + entry.ttl) {
        await this.delete(key);
        return null;
      }

      if (this.enableMetrics) {
        const metric: PerformanceMetric = {
          operation: 'cache_local_get',
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          metadata: { hit: true, cacheKey: key }
        };
        globalPerformanceMonitor.recordMetric(metric);
      }

      return entry.value;
    } catch (error) {
      globalLogger.error('Failed to get cache entry from localStorage', error as Error, {
        key,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      
      if (this.enableMetrics) {
        const metric: PerformanceMetric = {
          operation: 'cache_local_get',
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          metadata: { hit: false, error: true, cacheKey: key }
        };
        globalPerformanceMonitor.recordMetric(metric);
      }
      
      return null;
    }
  }

  /**
   * Set a cache entry
   */
  async set(key: string, value: any, options: { ttl?: number; tags?: string[] } = {}): Promise<void> {
    const startTime = performance.now();
    const fullKey = this.getFullKey(key);
    
    try {
      const entry: CacheEntry = {
        key,
        value,
        timestamp: Date.now(),
        ttl: options.ttl,
        tags: options.tags,
        size: 0
      };

      const serialized = JSON.stringify(entry);
      entry.size = new Blob([serialized]).size;

      // Check if we need to make space
      if (this.currentSize + entry.size > this.maxSize) {
        await this.makeSpace(entry.size);
      }

      localStorage.setItem(fullKey, serialized);
      this.currentSize += entry.size;

      if (this.enableMetrics) {
        const metric: PerformanceMetric = {
          operation: 'cache_local_set',
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          metadata: { cacheKey: key, size: entry.size }
        };
        globalPerformanceMonitor.recordMetric(metric);
      }

      globalLogger.debug('Cache entry stored in localStorage', { key, size: entry.size });
    } catch (error) {
      globalLogger.error('Failed to set cache entry in localStorage', error as Error, {
        key,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        await this.handleQuotaExceeded();
        throw new Error('LocalStorage quota exceeded');
      }
      
      throw error;
    }
  }

  /**
   * Delete a cache entry
   */
  async delete(key: string): Promise<boolean> {
    const startTime = performance.now();
    const fullKey = this.getFullKey(key);
    
    try {
      const item = localStorage.getItem(fullKey);
      if (!item) {
        return false;
      }

      const entry: CacheEntry = JSON.parse(item);
      localStorage.removeItem(fullKey);
      this.currentSize -= entry.size;

      if (this.enableMetrics) {
        const metric: PerformanceMetric = {
          operation: 'cache_local_delete',
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          metadata: { cacheKey: key }
        };
        globalPerformanceMonitor.recordMetric(metric);
      }

      globalLogger.debug('Cache entry deleted from localStorage', { key });
      return true;
    } catch (error) {
      globalLogger.error('Failed to delete cache entry from localStorage', error as Error, {
        key,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const keys = this.getAllKeys();
      keys.forEach(key => localStorage.removeItem(key));
      this.currentSize = 0;

      if (this.enableMetrics) {
        const metric: PerformanceMetric = {
          operation: 'cache_local_clear',
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          metadata: { keysCleared: keys.length }
        };
        globalPerformanceMonitor.recordMetric(metric);
      }

      globalLogger.info('All cache entries cleared from localStorage');
    } catch (error) {
      globalLogger.error('Failed to clear cache entries from localStorage', error as Error);
      throw error;
    }
  }

  /**
   * Get all cache keys
   */
  async keys(): Promise<string[]> {
    try {
      return this.getAllKeys().map(fullKey => 
        fullKey.substring(this.prefix.length)
      );
    } catch (error) {
      globalLogger.error('Failed to get cache keys from localStorage', error as Error);
      return [];
    }
  }

  /**
   * Get cache size information
   */
  async size(): Promise<{ count: number; bytes: number }> {
    try {
      const keys = this.getAllKeys();
      return {
        count: keys.length,
        bytes: this.currentSize
      };
    } catch (error) {
      globalLogger.error('Failed to get cache size from localStorage', error as Error);
      return { count: 0, bytes: 0 };
    }
  }

  /**
   * Get cache entries by tags
   */
  async getByTags(tags: string[]): Promise<Array<{ key: string; value: any }>> {
    const startTime = performance.now();
    const results: Array<{ key: string; value: any }> = [];
    
    try {
      const keys = this.getAllKeys();
      
      for (const fullKey of keys) {
        const item = localStorage.getItem(fullKey);
        if (!item) continue;

        const entry: CacheEntry = JSON.parse(item);
        
        // Check if entry has any of the requested tags
        if (entry.tags && entry.tags.some(tag => tags.includes(tag))) {
          // Check TTL expiration
          if (!entry.ttl || Date.now() <= entry.timestamp + entry.ttl) {
            results.push({
              key: entry.key,
              value: entry.value
            });
          }
        }
      }

      if (this.enableMetrics) {
        const metric: PerformanceMetric = {
          operation: 'cache_local_get_by_tags',
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          metadata: { tags, resultCount: results.length }
        };
        globalPerformanceMonitor.recordMetric(metric);
      }

      return results;
    } catch (error) {
      globalLogger.error('Failed to get cache entries by tags from localStorage', error as Error, {
        tags,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Delete cache entries by tags
   */
  async deleteByTags(tags: string[]): Promise<number> {
    const startTime = performance.now();
    let deletedCount = 0;
    
    try {
      const keys = this.getAllKeys();
      
      for (const fullKey of keys) {
        const item = localStorage.getItem(fullKey);
        if (!item) continue;

        const entry: CacheEntry = JSON.parse(item);
        
        // Check if entry has any of the requested tags
        if (entry.tags && entry.tags.some(tag => tags.includes(tag))) {
          localStorage.removeItem(fullKey);
          this.currentSize -= entry.size;
          deletedCount++;
        }
      }

      if (this.enableMetrics) {
        const metric: PerformanceMetric = {
          operation: 'cache_local_delete_by_tags',
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          metadata: { tags, deletedCount }
        };
        globalPerformanceMonitor.recordMetric(metric);
      }

      globalLogger.info('Cache entries deleted by tags from localStorage', { tags, deletedCount });
      return deletedCount;
    } catch (error) {
      globalLogger.error('Failed to delete cache entries by tags from localStorage', error as Error, {
        tags,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalSize: number;
    maxSize: number;
    utilization: number;
    entryCount: number;
    persistent: boolean;
  } {
    const keys = this.getAllKeys();
    return {
      totalSize: this.currentSize,
      maxSize: this.maxSize,
      utilization: this.currentSize / this.maxSize,
      entryCount: keys.length,
      persistent: true
    };
  }

  /**
   * Add storage event listener for cross-tab synchronization
   */
  addSyncListener(listener: (event: StorageEvent) => void): void {
    this.syncListeners.add(listener);
  }

  /**
   * Remove storage event listener
   */
  removeSyncListener(listener: (event: StorageEvent) => void): void {
    this.syncListeners.delete(listener);
  }

  /**
   * Cleanup and close the adapter
   */
  async close(): Promise<void> {
    if (this.enableSync) {
      window.removeEventListener('storage', this.handleStorageEvent);
    }
    
    this.syncListeners.clear();
    globalLogger.info('LocalStorage cache adapter closed');
  }

  // Private methods

  private getFullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private getAllKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key);
      }
    }
    return keys;
  }

  private calculateCurrentSize(): void {
    this.currentSize = 0;
    const keys = this.getAllKeys();
    
    for (const key of keys) {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const entry: CacheEntry = JSON.parse(item);
          this.currentSize += entry.size || new Blob([item]).size;
        }
      } catch (error) {
        // Skip invalid entries
        globalLogger.warn('Invalid cache entry found in localStorage', { key });
      }
    }
  }

  private async makeSpace(requiredSize: number): Promise<void> {
    const keys = this.getAllKeys();
    const entries: Array<{ key: string; entry: CacheEntry; fullKey: string }> = [];
    
    // Collect all entries with timestamps
    for (const fullKey of keys) {
      try {
        const item = localStorage.getItem(fullKey);
        if (item) {
          const entry: CacheEntry = JSON.parse(item);
          entries.push({ key: entry.key, entry, fullKey });
        }
      } catch (error) {
        // Remove invalid entries
        localStorage.removeItem(fullKey);
      }
    }

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a.entry.timestamp - b.entry.timestamp);

    // Remove entries until we have enough space
    let freedSpace = 0;
    for (const { fullKey, entry } of entries) {
      if (freedSpace >= requiredSize) break;
      
      localStorage.removeItem(fullKey);
      freedSpace += entry.size;
      this.currentSize -= entry.size;
      
      globalLogger.debug('Removed old cache entry to make space', { 
        key: entry.key, 
        size: entry.size 
      });
    }
  }

  private async handleQuotaExceeded(): Promise<void> {
    globalLogger.warn('LocalStorage quota exceeded, attempting cleanup');
    
    // Remove expired entries first
    await this.cleanupExpired();
    
    // If still over quota, remove oldest entries
    if (this.currentSize > this.maxSize * 0.8) {
      await this.makeSpace(this.maxSize * 0.2);
    }
  }

  private async cleanupExpired(): Promise<void> {
    const keys = this.getAllKeys();
    let cleanedCount = 0;
    
    for (const fullKey of keys) {
      try {
        const item = localStorage.getItem(fullKey);
        if (!item) continue;

        const entry: CacheEntry = JSON.parse(item);
        
        // Check if expired
        if (entry.ttl && Date.now() > entry.timestamp + entry.ttl) {
          localStorage.removeItem(fullKey);
          this.currentSize -= entry.size;
          cleanedCount++;
        }
      } catch (error) {
        // Remove invalid entries
        localStorage.removeItem(fullKey);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      globalLogger.info('Cleaned up expired cache entries from localStorage', { 
        cleanedCount 
      });
    }
  }

  private setupStorageEventListener(): void {
    this.handleStorageEvent = this.handleStorageEvent.bind(this);
    window.addEventListener('storage', this.handleStorageEvent);
  }

  private handleStorageEvent = (event: StorageEvent): void => {
    // Only handle events for our cache keys
    if (!event.key || !event.key.startsWith(this.prefix)) {
      return;
    }

    globalLogger.debug('Storage event received', {
      key: event.key,
      oldValue: event.oldValue ? 'present' : 'null',
      newValue: event.newValue ? 'present' : 'null',
      url: event.url
    });

    // Recalculate current size when storage changes
    this.calculateCurrentSize();

    // Notify listeners
    this.syncListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        globalLogger.error('Error in storage event listener', error as Error);
      }
    });
  };
}

// Factory function for easy instantiation
export function createLocalStorageAdapter(options?: LocalStorageOptions): LocalStorageCacheAdapter {
  return new LocalStorageCacheAdapter(options);
}

// Default export
export default LocalStorageCacheAdapter; 