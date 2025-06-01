/**
 * Cache Persistence Adapters
 * 
 * Unified interface for cache persistence across different storage mechanisms.
 * Provides adapters for sessionStorage, localStorage, and IndexedDB with
 * consistent APIs and advanced features.
 */

// Export all adapters
export { 
  SessionStorageCacheAdapter, 
  createSessionStorageAdapter,
  type SessionStorageOptions 
} from './session-storage';

export { 
  LocalStorageCacheAdapter, 
  createLocalStorageAdapter,
  type LocalStorageOptions 
} from './local-storage';

export { 
  IndexedDBCacheAdapter, 
  createIndexedDBAdapter,
  type IndexedDBOptions,
  type StorageQuota 
} from './indexeddb';

// Import factory functions for internal use
import { createSessionStorageAdapter } from './session-storage';
import { createLocalStorageAdapter } from './local-storage';
import { createIndexedDBAdapter } from './indexeddb';

// Common types
export interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl?: number;
  tags?: string[];
  size: number;
}

export interface PersistenceAdapter {
  init(): Promise<void>;
  get(key: string): Promise<any>;
  set(key: string, value: any, options?: { ttl?: number; tags?: string[] }): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  size(): Promise<{ count: number; bytes: number }>;
  getByTags(tags: string[]): Promise<Array<{ key: string; value: any }>>;
  deleteByTags(tags: string[]): Promise<number>;
  getStats(): any;
  close?(): Promise<void>;
}

export type StorageType = 'session' | 'local' | 'indexeddb';

export interface PersistenceConfig {
  type: StorageType;
  prefix?: string;
  maxSize?: number;
  enableMetrics?: boolean;
  enableSync?: boolean;
  compressionThreshold?: number;
  // IndexedDB specific
  dbName?: string;
  version?: number;
  storeName?: string;
}

/**
 * Unified factory function for creating cache persistence adapters
 */
export function createPersistenceAdapter(config: PersistenceConfig): PersistenceAdapter {
  switch (config.type) {
    case 'session':
      return createSessionStorageAdapter({
        prefix: config.prefix,
        maxSize: config.maxSize,
        enableMetrics: config.enableMetrics,
        compressionThreshold: config.compressionThreshold
      });

    case 'local':
      return createLocalStorageAdapter({
        prefix: config.prefix,
        maxSize: config.maxSize,
        enableMetrics: config.enableMetrics,
        enableSync: config.enableSync,
        compressionThreshold: config.compressionThreshold
      });

    case 'indexeddb':
      return createIndexedDBAdapter({
        dbName: config.dbName,
        version: config.version,
        storeName: config.storeName,
        enableSync: config.enableSync,
        enableMetrics: config.enableMetrics,
        compressionThreshold: config.compressionThreshold,
        maxSize: config.maxSize
      });

    default:
      throw new Error(`Unsupported storage type: ${config.type}`);
  }
}

/**
 * Storage capability detection
 */
export class StorageCapabilities {
  static async detect(): Promise<{
    sessionStorage: boolean;
    localStorage: boolean;
    indexedDB: boolean;
    storageQuota: boolean;
    broadcastChannel: boolean;
  }> {
    const capabilities = {
      sessionStorage: false,
      localStorage: false,
      indexedDB: false,
      storageQuota: false,
      broadcastChannel: false
    };

    // Test sessionStorage
    try {
      const testKey = 'test_session_storage';
      sessionStorage.setItem(testKey, 'test');
      sessionStorage.removeItem(testKey);
      capabilities.sessionStorage = true;
    } catch {
      // sessionStorage not available
    }

    // Test localStorage
    try {
      const testKey = 'test_local_storage';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      capabilities.localStorage = true;
    } catch {
      // localStorage not available
    }

    // Test IndexedDB
    try {
      if ('indexedDB' in window) {
        capabilities.indexedDB = true;
      }
    } catch {
      // IndexedDB not available
    }

    // Test Storage Quota API
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        capabilities.storageQuota = true;
      }
    } catch {
      // Storage Quota API not available
    }

    // Test BroadcastChannel
    try {
      if ('BroadcastChannel' in window) {
        capabilities.broadcastChannel = true;
      }
    } catch {
      // BroadcastChannel not available
    }

    return capabilities;
  }

  static async getRecommendedStorage(): Promise<StorageType> {
    const capabilities = await this.detect();

    // Prefer IndexedDB for its advanced features and large capacity
    if (capabilities.indexedDB) {
      return 'indexeddb';
    }

    // Fall back to localStorage for persistence
    if (capabilities.localStorage) {
      return 'local';
    }

    // Last resort: sessionStorage
    if (capabilities.sessionStorage) {
      return 'session';
    }

    throw new Error('No storage mechanisms available');
  }
}

/**
 * Storage quota utilities
 */
export class StorageQuotaManager {
  static async getQuotaInfo(): Promise<{
    used: number;
    available: number;
    percentage: number;
    warning: boolean;
    critical: boolean;
  }> {
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
    } catch {
      return {
        used: 0,
        available: 0,
        percentage: 0,
        warning: false,
        critical: false
      };
    }
  }

  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * Persistence adapter presets for common use cases
 */
export const PersistencePresets = {
  /**
   * Fast access cache for UI state and temporary data
   */
  fastAccess: {
    type: 'session' as StorageType,
    prefix: 'fast_',
    maxSize: 2 * 1024 * 1024, // 2MB
    enableMetrics: true
  },

  /**
   * Session-persistent cache for user preferences and settings
   */
  sessionPersistent: {
    type: 'local' as StorageType,
    prefix: 'session_',
    maxSize: 5 * 1024 * 1024, // 5MB
    enableMetrics: true,
    enableSync: true
  },

  /**
   * Large data cache for templates, assets, and API responses
   */
  largeData: {
    type: 'indexeddb' as StorageType,
    dbName: 'CatalystCache',
    storeName: 'large_data',
    prefix: 'large_',
    maxSize: 50 * 1024 * 1024, // 50MB
    enableMetrics: true,
    enableSync: true
  },

  /**
   * Development cache with extensive logging and debugging
   */
  development: {
    type: 'indexeddb' as StorageType,
    dbName: 'CatalystDevCache',
    storeName: 'dev_cache',
    prefix: 'dev_',
    maxSize: 10 * 1024 * 1024, // 10MB
    enableMetrics: true,
    enableSync: true
  }
} as const;

/**
 * Get persistence configuration recommendation based on use case
 */
export function getPersistenceRecommendation(useCase: {
  dataSize: 'small' | 'medium' | 'large';
  persistence: 'session' | 'temporary' | 'permanent';
  sync: boolean;
  performance: 'fast' | 'balanced' | 'capacity';
}): PersistenceConfig {
  const { dataSize, persistence, sync, performance } = useCase;

  // Base configuration
  let config: PersistenceConfig = {
    type: 'session',
    enableMetrics: true,
    enableSync: sync
  };

  // Determine storage type based on requirements
  if (persistence === 'permanent' || dataSize === 'large') {
    config.type = 'indexeddb';
    config.dbName = 'CatalystCache';
    config.storeName = 'cache_entries';
  } else if (persistence === 'temporary' && performance === 'fast') {
    config.type = 'session';
  } else {
    config.type = 'local';
  }

  // Set size limits based on data size and performance requirements
  switch (dataSize) {
    case 'small':
      config.maxSize = performance === 'fast' ? 1024 * 1024 : 2 * 1024 * 1024; // 1-2MB
      break;
    case 'medium':
      config.maxSize = performance === 'capacity' ? 10 * 1024 * 1024 : 5 * 1024 * 1024; // 5-10MB
      break;
    case 'large':
      config.maxSize = performance === 'capacity' ? 100 * 1024 * 1024 : 50 * 1024 * 1024; // 50-100MB
      break;
  }

  // Set compression threshold based on performance requirements
  config.compressionThreshold = performance === 'fast' ? 2048 : 1024; // 1-2KB

  return config;
}

// Default export
export default {
  createPersistenceAdapter,
  StorageCapabilities,
  StorageQuotaManager,
  PersistencePresets,
  getPersistenceRecommendation
}; 