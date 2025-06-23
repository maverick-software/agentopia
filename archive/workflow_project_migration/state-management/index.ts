/**
 * Unified State Management Library
 * 
 * A comprehensive state management solution for React applications with
 * advanced caching, middleware support, and debugging capabilities.
 */

// ============================================================================
// CORE EXPORTS
// ============================================================================

export {
  // Core store functionality
  createStore,
  createStoreWithMiddleware,
  
  // Store types and interfaces
  type StoreApi,
  type StoreConfig,
  type BaseState,
  type AppState,
  type StoreActions,
  type StoreSelectors,
  type StoreSubscriber,
  type StoreUnsubscriber,
  
  // Core types
  type PerformanceMetric,
  type LogEntry,
} from './core/types';

export {
  // Store implementation
  Store,
} from './core/store';

export {
  // Cache system
  CacheManager,
  LRUCache,
  MemoryCache,
  
  // Cache types
  type CacheConfig,
  type CacheEntry,
  type CacheStats,
  type CacheEvictionPolicy,
} from './core/cache';

// ============================================================================
// ADVANCED CACHE SYSTEM EXPORTS
// ============================================================================

export {
  // Core Cache Manager
  BaseCache,
  CacheEntryImpl,
  type CacheConfig as AdvancedCacheConfig,
  type CacheStrategy,
  type CacheManager as AdvancedCacheManager,
  type CacheOptions,
  type CacheStats as AdvancedCacheStats,
  type EvictionPolicy,
  type StorageType,
  
  // Cache Strategies
  LRUCache as AdvancedLRUCache,
  createLRUCache,
  TTLCache,
  createTTLCache,
  MemoryCache as AdvancedMemoryCache,
  createMemoryCache,
  createCache,
  CachePresets,
  getCacheRecommendation,
  
  // Cache Coordination
  CacheCoordinator,
  globalCacheCoordinator,
  DomainCaches,
  getCacheFor,
  initializeDomainCaches,
  getCacheSystemHealth,
} from './cache';

// ============================================================================
// MIDDLEWARE EXPORTS
// ============================================================================

export {
  // Middleware system
  MiddlewareManager,
  
  // Built-in middleware
  LoggingMiddleware,
  PerformanceMiddleware,
  PersistenceMiddleware,
  ValidationMiddleware,
  
  // Middleware types
  type Middleware,
  type MiddlewareContext,
  type MiddlewareConfig,
  type MiddlewareNext,
} from './core/middleware';

// ============================================================================
// STORE COMPOSITION EXPORTS
// ============================================================================

export {
  // Event Bus System
  StoreEventBus,
  globalEventBus,
  emit,
  on,
  once,
  off,
  emitTyped,
  onTyped,
  
  // Store Coordinator
  StoreCoordinator,
  globalCoordinator,
  registerStore,
  executeSequence,
  createSequence,
  subscribeToStores,
  synchronizeStores,
  
  // Context Providers
  createStoreProvider,
  createMultiStoreProvider,
  createAutoRegisteredStoreProvider,
  withStoreIsolation,
  useIsolatedStore,
  composeStoreProviders,
  StoreDebugger,
  
  // Composition Patterns
  createWorkflowStoreProvider,
  createFeatureStoreProvider,
  createPageStoreProvider,
  
  // React Hooks
  useStoreCoordination,
  useMultiStoreSubscription,
  useStoreSynchronization,
  
  // Composition Utilities
  initializeCompositionSystem,
  getCompositionStats,
  cleanupCompositionSystem,
  debugCompositionSystem,
  monitorCompositionPerformance,
  isStoreEvent,
  isCoordinationResult,
  
  // Composition types
  type StoreEvent,
  type EventListener,
  type EventBusOptions,
  type EventBusStats,
  type SystemEvents,
  type StoreCoordinatorOptions,
  type CoordinatedAction,
  type ActionSequence,
  type CoordinationResult,
  type StoreSubscription,
  type StoreProviderOptions,
  type StoreContextValue,
  type ModularStoreConfig,
  type MultiStoreConfig,
} from './composition';

// ============================================================================
// DOMAIN STORES EXPORTS
// ============================================================================

export {
  // Workflow Store
  useWorkflowStore,
  workflowStore,
  type WorkflowState,
  type WorkflowActions,
  
  // Auth Store
  useAuthStore,
  authStore,
  type AuthState,
  type AuthActions,
  
  // UI Store
  useUIStore,
  uiStore,
  type UIState,
  type UIActions,
  
  // UI Builder Store
  useUIBuilderStore,
  uiBuilderStore,
  type UIBuilderState,
  type UIBuilderActions,
  
  // Cache Store
  useCacheStore,
  cacheStore,
  type CacheState,
  type CacheActions,
} from './stores';

// ============================================================================
// DEBUG & LOGGING EXPORTS
// ============================================================================

export {
  // Unified debugger
  UnifiedDebugger,
  
  // Individual debug tools
  StructuredLogger,
  PerformanceMonitor,
  StateInspector,
  DebugUtils,
  
  // Global instances
  globalLogger,
  globalPerformanceMonitor,
  globalStateInspector,
  
  // Convenience exports
  debug,
  logger,
  performance,
  inspector,
  utils,
  
  // Performance decorators
  measurePerformance,
  measureAsyncPerformance,
  
  // Logging types
  LogLevel,
  type LogCategory,
  type LogTransport,
  type LoggerConfig,
  type LogFilter,
  type LogFormatter,
  
  // Performance types
  type MetricCategory,
  type PerformanceThresholds,
  type PerformanceAlert,
  type PerformanceStats,
  type MemoryUsage,
  type PerformanceReport,
  
  // State inspection types
  type StateSnapshot,
  type StateDiff,
  type DebugSession,
  type StateInspectorConfig,
  type DebugAction,
} from './debug';

// ============================================================================
// PERSISTENCE EXPORTS
// ============================================================================

export {
  // Advanced persistence middleware
  persist,
  
  // Configuration utilities
  createPersistenceConfig,
  createSelectivePersistence,
  createTemporaryPersistence,
  createLargeDataPersistence,
  
  // Domain-specific configurations
  createUserPreferencesPersistence,
  createSessionPersistence,
  createWorkflowPersistence,
  createCachePersistence,
  
  // Migration utilities
  createMigration,
  migrationPatterns,
  
  // Storage utilities
  isStorageAvailable,
  getStorageInfo,
  clearPersistedData,
  
  // Types
  type PersistenceConfig,
  type PersistenceState,
  type PersistenceAPI,
  type StorageAdapter,
  type StorageEngine,
} from './persistence';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Initialize the entire state management system with configuration
 */
export function initializeStateManagement(config: {
  // Debug configuration
  debug?: {
    logLevel?: LogLevel;
    enablePerformanceMonitoring?: boolean;
    enableStateInspection?: boolean;
    enableTimeTravel?: boolean;
    maxSnapshots?: number;
    performanceThresholds?: Partial<PerformanceThresholds>;
  };
  
  // Cache configuration
  cache?: {
    maxSize?: number;
    ttl?: number;
    evictionPolicy?: CacheEvictionPolicy;
  };
  
  // Middleware configuration
  middleware?: {
    enableLogging?: boolean;
    enablePerformance?: boolean;
    enablePersistence?: boolean;
    enableValidation?: boolean;
  };
  
  // Composition configuration
  composition?: {
    enableGlobalLogging?: boolean;
    enableGlobalPerformanceMonitoring?: boolean;
    maxEventListeners?: number;
    maxCoordinatorActions?: number;
  };
} = {}) {
  // Initialize debug tools
  const debugTools = UnifiedDebugger.initialize(config.debug);
  
  // Initialize composition system
  const compositionSystem = initializeCompositionSystem(config.composition);
  
  logger.info('State management system initialized', {
    config,
    timestamp: new Date().toISOString(),
  });
  
  return {
    // Debug tools
    debug: debugTools,
    
    // Composition system
    composition: compositionSystem,
    
    // Core functionality
    createStore,
    createStoreWithMiddleware,
    
    // Utilities
    logger,
    performance,
    inspector,
    
    // Start debug session helper
    startDebugSession: (metadata?: Record<string, any>) => 
      UnifiedDebugger.startDebugSession(metadata),
    
    // Generate report helper
    generateReport: () => UnifiedDebugger.generateReport(),
    
    // Composition helpers
    getCompositionStats,
    debugCompositionSystem,
  };
}

/**
 * Quick setup for development environment
 */
export function setupDevelopmentEnvironment() {
  return initializeStateManagement({
    debug: {
      logLevel: LogLevel.DEBUG,
      enablePerformanceMonitoring: true,
      enableStateInspection: true,
      enableTimeTravel: true,
      maxSnapshots: 1000,
    },
    middleware: {
      enableLogging: true,
      enablePerformance: true,
      enablePersistence: false,
      enableValidation: true,
    },
    composition: {
      enableGlobalLogging: true,
      enableGlobalPerformanceMonitoring: true,
      maxEventListeners: 200,
      maxCoordinatorActions: 15,
    },
  });
}

/**
 * Quick setup for production environment
 */
export function setupProductionEnvironment() {
  return initializeStateManagement({
    debug: {
      logLevel: LogLevel.WARN,
      enablePerformanceMonitoring: true,
      enableStateInspection: false,
      enableTimeTravel: false,
      maxSnapshots: 100,
    },
    middleware: {
      enableLogging: false,
      enablePerformance: true,
      enablePersistence: true,
      enableValidation: false,
    },
    composition: {
      enableGlobalLogging: false,
      enableGlobalPerformanceMonitoring: true,
      maxEventListeners: 100,
      maxCoordinatorActions: 10,
    },
  });
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  // Core
  createStore,
  createStoreWithMiddleware,
  Store,
  
  // Cache
  CacheManager,
  LRUCache,
  MemoryCache,
  
  // Middleware
  MiddlewareManager,
  LoggingMiddleware,
  PerformanceMiddleware,
  PersistenceMiddleware,
  ValidationMiddleware,
  
  // Composition
  globalEventBus,
  globalCoordinator,
  createStoreProvider,
  createMultiStoreProvider,
  createWorkflowStoreProvider,
  createFeatureStoreProvider,
  createPageStoreProvider,
  
  // Domain Stores
  useWorkflowStore,
  useAuthStore,
  useUIStore,
  useCacheStore,
  
  // Debug
  UnifiedDebugger,
  StructuredLogger,
  PerformanceMonitor,
  StateInspector,
  DebugUtils,
  
  // Global instances
  globalLogger,
  globalPerformanceMonitor,
  globalStateInspector,
  
  // Utilities
  initializeStateManagement,
  setupDevelopmentEnvironment,
  setupProductionEnvironment,
  initializeCompositionSystem,
  getCompositionStats,
  
  // Quick access
  debug,
  logger,
  performance,
  inspector,
  utils,
}; 