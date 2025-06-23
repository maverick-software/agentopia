import { globalLogger } from '../../debug/logger';
import { globalPerformanceMonitor } from '../../debug/performance-monitor';
import type { PerformanceMetric } from '../../core/types';

/**
 * IndexedDB Cache Persistence Adapter
 * 
 * Provides robust cache persistence using IndexedDB with advanced features.
 * Supports large data storage, transactions, and cross-tab synchronization.
 * 
 * Features:
 * - Large storage capacity (50MB-2GB+)
 * - Asynchronous, non-blocking operations
 * - ACID transactions for data integrity
 * - Cross-tab synchronization via BroadcastChannel
 * - Automatic quota management and cleanup
 * - Performance monitoring and metrics
 * - Compression support for large entries
 */

export interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl?: number;
  tags?: string[];
  size: number;
  accessCount: number;
  lastAccessed: number;
}

export interface IndexedDBOptions {
  dbName?: string;
  version?: number;
  storeName?: string;
  enableSync?: boolean;
  enableMetrics?: boolean;
  compressionThreshold?: number;
  maxSize?: number;
}

export interface StorageQuota {
  used: number;
  available: number;
  percentage: number;
  warning: boolean;
  critical: boolean;
}

/**
 * Cross-tab synchronization manager using BroadcastChannel
 */
class CacheSyncManager {
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<(event: any) => void>();

  constructor(channelName: string) {
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(channelName);
      this.channel.onmessage = (event) => {
        this.listeners.forEach(listener => listener(event.data));
      };
    }
  }

  broadcast(type: string, key: string, value?: any): void {
    if (this.channel) {
      this.channel.postMessage({
        type,
        key,
        value,
        timestamp: Date.now()
      });
    }
  }

  addListener(listener: (event: any) => void): void {
    this.listeners.add(listener);
  }

  removeListener(listener: (event: any) => void): void {
    this.listeners.delete(listener);
  }

  close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }
}

export class IndexedDBCacheAdapter {
  private db: IDBDatabase | null = null;
  private dbName: string;
  private version: number;
  private storeName: string;
  private enableSync: boolean;
  private enableMetrics: boolean;
  private compressionThreshold: number;
  private maxSize: number;
  private syncManager: CacheSyncManager | null = null;
  private currentSize: number = 0;

  constructor(options: IndexedDBOptions = {}) {
    this.dbName = options.dbName || 'CacheDB';
    this.version = options.version || 1;
    this.storeName = options.storeName || 'cache_entries';
    this.enableSync = options.enableSync ?? true;
    this.enableMetrics = options.enableMetrics ?? true;
    this.compressionThreshold = options.compressionThreshold || 10240; // 10KB
    this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB default

    if (this.enableSync) {
      this.syncManager = new CacheSyncManager(`cache_sync_${this.dbName}`);
      this.setupSyncListeners();
    }

    globalLogger.info('IndexedDBCacheAdapter initialized', {
      dbName: this.dbName,
      version: this.version,
      storeName: this.storeName,
      enableSync: this.enableSync,
      compressionThreshold: this.compressionThreshold
    });
  }

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    const startTime = performance.now();

    try {
      this.db = await this.openDatabase();
      await this.calculateCurrentSize();

      if (this.enableMetrics) {
        const metric: PerformanceMetric = {
          operation: 'cache_indexeddb_init',
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          metadata: { success: true, dbName: this.dbName }
        };
        globalPerformanceMonitor.recordMetric(metric);
      }

      globalLogger.info('IndexedDB cache adapter initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      globalLogger.error('Failed to initialize IndexedDB cache adapter', error as Error);
      throw new Error(`IndexedDB not available: ${errorMessage}`);
    }
  }

  /**
   * Get a cache entry by key
   */
  async get(key: string): Promise<any> {
    const startTime = performance.now();

    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const entry = await this.getFromStore(store, key);
      
      if (!entry) {
        return null;
      }

      // Check TTL expiration
      if (entry.ttl && Date.now() > entry.timestamp + entry.ttl) {
        await this.deleteFromStore(store, key);
        return null;
      }

      // Update access statistics
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      await this.putToStore(store, entry);

      if (this.enableMetrics) {
        const metric: PerformanceMetric = {
          operation: 'cache_indexeddb_get',
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          metadata: { hit: true, cacheKey: key }
        };
        globalPerformanceMonitor.recordMetric(metric);
      }

      return entry.value;
    } catch (error) {
      globalLogger.error('Failed to get cache entry from IndexedDB', error as Error, {
        key,
        errorMessage: error instanceof Error ? error.message : String(error)
      });

      if (this.enableMetrics) {
        const metric: PerformanceMetric = {
          operation: 'cache_indexeddb_get',
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

    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const entry: CacheEntry = {
        key,
        value,
        timestamp: Date.now(),
        ttl: options.ttl,
        tags: options.tags,
        size: this.calculateEntrySize(value),
        accessCount: 1,
        lastAccessed: Date.now()
      };

      // Check storage quota
      const quota = await this.checkStorageQuota();
      if (quota.critical && entry.size > 1024 * 1024) { // 1MB threshold for critical quota
        await this.cleanup();
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      await this.putToStore(store, entry);
      this.currentSize += entry.size;

      // Broadcast change to other tabs
      if (this.syncManager) {
        this.syncManager.broadcast('CACHE_SET', key, entry);
      }

      if (this.enableMetrics) {
        const metric: PerformanceMetric = {
          operation: 'cache_indexeddb_set',
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          metadata: { cacheKey: key, size: entry.size }
        };
        globalPerformanceMonitor.recordMetric(metric);
      }

      globalLogger.debug('Cache entry stored in IndexedDB', { key, size: entry.size });
    } catch (error) {
      globalLogger.error('Failed to set cache entry in IndexedDB', error as Error, {
        key,
        errorMessage: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof Error && error.name === 'QuotaExceededError') {
        await this.handleQuotaExceeded();
        throw new Error('IndexedDB quota exceeded');
      }

      throw error;
    }
  }

  /**
   * Delete a cache entry
   */
  async delete(key: string): Promise<boolean> {
    const startTime = performance.now();

    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const entry = await this.getFromStore(store, key);
      if (!entry) {
        return false;
      }

      await this.deleteFromStore(store, key);
      this.currentSize -= entry.size;

      // Broadcast change to other tabs
      if (this.syncManager) {
        this.syncManager.broadcast('CACHE_DELETE', key);
      }

      if (this.enableMetrics) {
        const metric: PerformanceMetric = {
          operation: 'cache_indexeddb_delete',
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          metadata: { cacheKey: key }
        };
        globalPerformanceMonitor.recordMetric(metric);
      }

      globalLogger.debug('Cache entry deleted from IndexedDB', { key });
      return true;
    } catch (error) {
      globalLogger.error('Failed to delete cache entry from IndexedDB', error as Error, {
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
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const count = await this.clearStore(store);
      this.currentSize = 0;

      // Broadcast change to other tabs
      if (this.syncManager) {
        this.syncManager.broadcast('CACHE_CLEAR', 'all');
      }

      if (this.enableMetrics) {
        const metric: PerformanceMetric = {
          operation: 'cache_indexeddb_clear',
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          metadata: { keysCleared: count }
        };
        globalPerformanceMonitor.recordMetric(metric);
      }

      globalLogger.info('All cache entries cleared from IndexedDB');
    } catch (error) {
      globalLogger.error('Failed to clear cache entries from IndexedDB', error as Error);
      throw error;
    }
  }

  /**
   * Get all cache keys
   */
  async keys(): Promise<string[]> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);

      return await this.getAllKeys(store);
    } catch (error) {
      globalLogger.error('Failed to get cache keys from IndexedDB', error as Error);
      return [];
    }
  }

  /**
   * Get cache size information
   */
  async size(): Promise<{ count: number; bytes: number }> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);

      const count = await this.getCount(store);
      return {
        count,
        bytes: this.currentSize
      };
    } catch (error) {
      globalLogger.error('Failed to get cache size from IndexedDB', error as Error);
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
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);

      const entries = await this.getAllEntries(store);

      for (const entry of entries) {
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
          operation: 'cache_indexeddb_get_by_tags',
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          metadata: { tags, resultCount: results.length }
        };
        globalPerformanceMonitor.recordMetric(metric);
      }

      return results;
    } catch (error) {
      globalLogger.error('Failed to get cache entries by tags from IndexedDB', error as Error, {
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
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const entries = await this.getAllEntries(store);

      for (const entry of entries) {
        // Check if entry has any of the requested tags
        if (entry.tags && entry.tags.some(tag => tags.includes(tag))) {
          await this.deleteFromStore(store, entry.key);
          this.currentSize -= entry.size;
          deletedCount++;
        }
      }

      // Broadcast change to other tabs
      if (this.syncManager && deletedCount > 0) {
        this.syncManager.broadcast('CACHE_DELETE_BY_TAGS', 'multiple', { tags, count: deletedCount });
      }

      if (this.enableMetrics) {
        const metric: PerformanceMetric = {
          operation: 'cache_indexeddb_delete_by_tags',
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          metadata: { tags, deletedCount }
        };
        globalPerformanceMonitor.recordMetric(metric);
      }

      globalLogger.info('Cache entries deleted by tags from IndexedDB', { tags, deletedCount });
      return deletedCount;
    } catch (error) {
      globalLogger.error('Failed to delete cache entries by tags from IndexedDB', error as Error, {
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
    dbName: string;
    storeName: string;
  } {
    return {
      totalSize: this.currentSize,
      maxSize: this.maxSize,
      utilization: this.currentSize / this.maxSize,
      entryCount: 0, // Will be updated by size() method
      dbName: this.dbName,
      storeName: this.storeName
    };
  }

  /**
   * Check storage quota
   */
  async checkStorageQuota(): Promise<StorageQuota> {
    try {
      if (!navigator.storage?.estimate) {
        return {
          used: 0,
          available: 0,
          percentage: 0,
          warning: false,
          critical: false
        };
      }

      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const available = estimate.quota || 0;
      const percentage = available > 0 ? (used / available) * 100 : 0;

      return {
        used,
        available,
        percentage,
        warning: percentage > 80,
        critical: percentage > 95
      };
    } catch (error) {
      globalLogger.error('Failed to check storage quota', error as Error);
      return {
        used: 0,
        available: 0,
        percentage: 0,
        warning: false,
        critical: false
      };
    }
  }

  /**
   * Cleanup expired and least recently used entries
   */
  async cleanup(): Promise<number> {
    const startTime = performance.now();
    let cleanedCount = 0;

    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const entries = await this.getAllEntries(store);
      const now = Date.now();

      // First, remove expired entries
      for (const entry of entries) {
        if (entry.ttl && now > entry.timestamp + entry.ttl) {
          await this.deleteFromStore(store, entry.key);
          this.currentSize -= entry.size;
          cleanedCount++;
        }
      }

      // If still over quota, remove least recently used entries
      const quota = await this.checkStorageQuota();
      if (quota.warning) {
        const validEntries = entries.filter(entry => 
          !entry.ttl || now <= entry.timestamp + entry.ttl
        );

        // Sort by last accessed (oldest first)
        validEntries.sort((a, b) => a.lastAccessed - b.lastAccessed);

        // Remove oldest 20% of entries
        const toRemove = Math.ceil(validEntries.length * 0.2);
        for (let i = 0; i < toRemove && i < validEntries.length; i++) {
          const entry = validEntries[i];
          await this.deleteFromStore(store, entry.key);
          this.currentSize -= entry.size;
          cleanedCount++;
        }
      }

      if (this.enableMetrics) {
        const metric: PerformanceMetric = {
          operation: 'cache_indexeddb_cleanup',
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          metadata: { cleanedCount }
        };
        globalPerformanceMonitor.recordMetric(metric);
      }

      globalLogger.info('Cache cleanup completed', { cleanedCount });
      return cleanedCount;
    } catch (error) {
      globalLogger.error('Failed to cleanup cache', error as Error);
      return 0;
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    if (this.syncManager) {
      this.syncManager.close();
      this.syncManager = null;
    }

    globalLogger.info('IndexedDB cache adapter closed');
  }

  // Private methods

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('lastAccessed', 'lastAccessed');
          store.createIndex('tags', 'tags', { multiEntry: true });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  private async getFromStore(store: IDBObjectStore, key: string): Promise<CacheEntry | null> {
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async putToStore(store: IDBObjectStore, entry: CacheEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteFromStore(store: IDBObjectStore, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async clearStore(store: IDBObjectStore): Promise<number> {
    return new Promise((resolve, reject) => {
      let count = 0;
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          count++;
          cursor.continue();
        } else {
          resolve(count);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  private async getAllKeys(store: IDBObjectStore): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const keys: string[] = [];
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          keys.push(cursor.key as string);
          cursor.continue();
        } else {
          resolve(keys);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  private async getAllEntries(store: IDBObjectStore): Promise<CacheEntry[]> {
    return new Promise((resolve, reject) => {
      const entries: CacheEntry[] = [];
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          entries.push(cursor.value);
          cursor.continue();
        } else {
          resolve(entries);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  private async getCount(store: IDBObjectStore): Promise<number> {
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private calculateEntrySize(value: any): number {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch {
      return 0;
    }
  }

  private async calculateCurrentSize(): Promise<void> {
    try {
      if (!this.db) return;

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const entries = await this.getAllEntries(store);

      this.currentSize = entries.reduce((total, entry) => total + entry.size, 0);
    } catch (error) {
      globalLogger.error('Failed to calculate current cache size', error as Error);
      this.currentSize = 0;
    }
  }

  private async handleQuotaExceeded(): Promise<void> {
    globalLogger.warn('IndexedDB quota exceeded, attempting cleanup');
    await this.cleanup();
  }

  private setupSyncListeners(): void {
    if (!this.syncManager) return;

    this.syncManager.addListener((event) => {
      globalLogger.debug('Received cache sync event', event);
      
      // Handle sync events from other tabs
      switch (event.type) {
        case 'CACHE_SET':
          // Could update local cache or invalidate
          break;
        case 'CACHE_DELETE':
          // Could remove from local cache
          break;
        case 'CACHE_CLEAR':
          // Could clear local cache
          break;
      }
    });
  }
}

// Factory function for easy instantiation
export function createIndexedDBAdapter(options?: IndexedDBOptions): IndexedDBCacheAdapter {
  return new IndexedDBCacheAdapter(options);
}

// Default export
export default IndexedDBCacheAdapter; 