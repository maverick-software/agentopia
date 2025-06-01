/**
 * Store Debug Integration
 * 
 * Provides comprehensive debug infrastructure integration for stores including
 * logging, performance monitoring, and state inspection capabilities.
 */

import type {
  StateCreator,
  StoreApi,
  StoreMiddleware,
  BaseState,
} from './types';

import { 
  createStore,
  type StoreFactoryOptions 
} from './store-factory';

// Import debug infrastructure
import { 
  globalLogger, 
  globalPerformanceMonitor, 
  globalStateInspector,
  type LogCategory,
  type MetricCategory 
} from '../debug';

// ============================================================================
// DEBUG-ENHANCED INTERFACES
// ============================================================================

/**
 * Enhanced store factory options with debug integration
 */
export interface DebugStoreFactoryOptions<T> extends StoreFactoryOptions<T> {
  debug?: {
    enabled?: boolean;
    enableLogging?: boolean;
    enablePerformanceMonitoring?: boolean;
    enableStateInspection?: boolean;
    logCategory?: LogCategory;
    performanceCategory?: MetricCategory;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  };
}

// ============================================================================
// DEBUG-ENHANCED STORE FACTORY
// ============================================================================

/**
 * Enhanced store factory function with integrated debug infrastructure
 */
export function createStoreWithDebug<T extends BaseState>(
  stateCreator: StateCreator<T>,
  options: DebugStoreFactoryOptions<T>
): StoreApi<T> {
  const {
    debug: debugConfig = {},
    ...storeOptions
  } = options;

  // Debug configuration with defaults
  const {
    enabled: debugEnabled = process.env.NODE_ENV === 'development',
    enableLogging = true,
    enablePerformanceMonitoring = true,
    enableStateInspection = true,
    logCategory = 'state-management',
    performanceCategory = 'state-update',
    logLevel = 'debug',
  } = debugConfig;

  // Log store creation
  if (debugEnabled && enableLogging) {
    globalLogger.info(`Creating store: ${options.name}`, {
      options: {
        devtools: !!options.devtools,
        persist: !!options.persist,
        immer: options.immer,
        subscribeWithSelector: options.subscribeWithSelector,
        middlewareCount: options.middleware?.length || 0,
      },
    }, logCategory);
  }

  // Start performance monitoring for store creation
  const storeCreationId = `store-creation-${options.name}`;
  if (debugEnabled && enablePerformanceMonitoring) {
    globalPerformanceMonitor.startOperation(storeCreationId, 'store-creation', {
      storeName: options.name,
    });
  }

  // Add debug middleware to the middleware stack
  const enhancedOptions: StoreFactoryOptions<T> = {
    ...storeOptions,
    middleware: [
      ...(storeOptions.middleware || []),
      ...(debugEnabled ? [createDebugMiddleware<T>(options.name, {
        enableLogging,
        enablePerformanceMonitoring,
        enableStateInspection,
        logCategory,
        performanceCategory,
        logLevel,
      })] : [])
    ]
  };

  // Create the store using the base factory
  const store = createStore(stateCreator, enhancedOptions);

  // End performance monitoring for store creation
  if (debugEnabled && enablePerformanceMonitoring) {
    globalPerformanceMonitor.endOperation(storeCreationId, {
      storeCreated: true,
      initialState: store.getState(),
    });
  }

  // Subscribe to state inspector if enabled
  if (debugEnabled && enableStateInspection) {
    globalStateInspector.subscribeToStore(options.name, store);
  }

  // Log successful store creation
  if (debugEnabled && enableLogging) {
    globalLogger.info(`Store created successfully: ${options.name}`, {
      initialState: store.getState(),
      storeApi: {
        hasSetState: typeof store.setState === 'function',
        hasGetState: typeof store.getState === 'function',
        hasSubscribe: typeof store.subscribe === 'function',
        hasDestroy: typeof store.destroy === 'function',
      },
    }, logCategory);
  }

  return store;
}

// ============================================================================
// DEBUG MIDDLEWARE
// ============================================================================

/**
 * Creates debug middleware that integrates logging, performance monitoring, and state inspection
 */
export function createDebugMiddleware<T extends BaseState>(
  storeName: string,
  options: {
    enableLogging: boolean;
    enablePerformanceMonitoring: boolean;
    enableStateInspection: boolean;
    logCategory: LogCategory;
    performanceCategory: MetricCategory;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  }
): StoreMiddleware<T> {
  const {
    enableLogging,
    enablePerformanceMonitoring,
    enableStateInspection,
    logCategory,
    performanceCategory,
    logLevel,
  } = options;

  return (config) => (set, get, api) => {
    // Enhanced set function with debug integration
    const debugSet = (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => {
      const operationId = `state-update-${storeName}-${Date.now()}`;
      const prevState = get();

      // Start performance monitoring
      if (enablePerformanceMonitoring) {
        globalPerformanceMonitor.startOperation(operationId, performanceCategory, {
          storeName,
          operation: 'setState',
        });
      }

      // Log state update start
      if (enableLogging) {
        const logMessage = `State update started: ${storeName}`;
        const metadata = {
          operationId,
          prevState,
          updateType: typeof partial,
        };

        switch (logLevel) {
          case 'debug':
            globalLogger.debug(logMessage, metadata, logCategory);
            break;
          case 'info':
            globalLogger.info(logMessage, metadata, logCategory);
            break;
          case 'warn':
            globalLogger.warn(logMessage, metadata, logCategory);
            break;
          case 'error':
            globalLogger.error(logMessage, undefined, metadata, logCategory);
            break;
        }
      }

      try {
        // Apply the state update
        const result = set(partial);
        const nextState = get();

        // End performance monitoring
        if (enablePerformanceMonitoring) {
          globalPerformanceMonitor.endOperation(operationId, {
            success: true,
            stateChanged: prevState !== nextState,
            stateSize: JSON.stringify(nextState).length,
          });
        }

        // Log successful state update
        if (enableLogging) {
          const logMessage = `State update completed: ${storeName}`;
          const metadata = {
            operationId,
            prevState,
            nextState,
            stateChanged: prevState !== nextState,
          };

          switch (logLevel) {
            case 'debug':
              globalLogger.debug(logMessage, metadata, logCategory);
              break;
            case 'info':
              globalLogger.info(logMessage, metadata, logCategory);
              break;
            case 'warn':
              globalLogger.warn(logMessage, metadata, logCategory);
              break;
            case 'error':
              globalLogger.error(logMessage, undefined, metadata, logCategory);
              break;
          }
        }

        // Log state change for performance monitoring
        if (enablePerformanceMonitoring) {
          globalLogger.stateChange(storeName, 'setState', prevState, nextState);
        }

        return result;
      } catch (error) {
        // End performance monitoring with error
        if (enablePerformanceMonitoring) {
          globalPerformanceMonitor.endOperation(operationId, {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }

        // Log error
        if (enableLogging) {
          globalLogger.error(`State update failed: ${storeName}`, error as Error, {
            operationId,
            prevState,
            updateType: typeof partial,
          }, 'error');
        }

        throw error;
      }
    };

    // Enhanced get function with debug integration
    const debugGet = () => {
      const state = get();

      // Log state access if in debug mode
      if (enableLogging && logLevel === 'debug') {
        globalLogger.debug(`State accessed: ${storeName}`, {
          state,
          timestamp: Date.now(),
        }, logCategory);
      }

      return state;
    };

    return config(debugSet, debugGet, api);
  };
}

// ============================================================================
// SPECIALIZED STORE CREATORS WITH DEBUG INTEGRATION
// ============================================================================

/**
 * Creates a domain store with standard configuration and debug integration
 */
export function createDomainStore<T extends BaseState>(
  name: string,
  stateCreator: StateCreator<T>,
  options: Partial<DebugStoreFactoryOptions<T>> = {}
): StoreApi<T> {
  return createStoreWithDebug(stateCreator, {
    name,
    devtools: { name: `${name}-store` },
    persist: false, // Domain stores typically don't persist
    immer: true,
    subscribeWithSelector: true,
    debug: {
      enabled: true,
      enableLogging: true,
      enablePerformanceMonitoring: true,
      enableStateInspection: true,
      logCategory: 'state-management',
      performanceCategory: 'state-update',
      logLevel: 'info',
    },
    ...options,
  });
}

/**
 * Creates a UI store with persistence and debug integration
 */
export function createUIStore<T extends BaseState>(
  name: string,
  stateCreator: StateCreator<T>,
  options: Partial<DebugStoreFactoryOptions<T>> = {}
): StoreApi<T> {
  return createStoreWithDebug(stateCreator, {
    name,
    devtools: { name: `${name}-ui-store` },
    persist: {
      name: `${name}-ui-preferences`,
      storage: 'localStorage',
      // Only persist non-transient UI state
      partialize: (state) => {
        const { loading, error, lastUpdated, ...persistableState } = state as any;
        return persistableState;
      },
    },
    immer: true,
    subscribeWithSelector: true,
    debug: {
      enabled: true,
      enableLogging: true,
      enablePerformanceMonitoring: true,
      enableStateInspection: true,
      logCategory: 'ui',
      performanceCategory: 'state-update',
      logLevel: 'debug',
    },
    ...options,
  });
}

/**
 * Creates a cache store with session persistence and debug integration
 */
export function createCacheStore<T extends BaseState>(
  name: string,
  stateCreator: StateCreator<T>,
  options: Partial<DebugStoreFactoryOptions<T>> = {}
): StoreApi<T> {
  return createStoreWithDebug(stateCreator, {
    name,
    devtools: { name: `${name}-cache-store` },
    persist: {
      name: `${name}-cache`,
      storage: 'sessionStorage', // Cache data only for session
    },
    immer: true,
    subscribeWithSelector: true,
    debug: {
      enabled: true,
      enableLogging: true,
      enablePerformanceMonitoring: true,
      enableStateInspection: true,
      logCategory: 'cache',
      performanceCategory: 'cache-operation',
      logLevel: 'debug',
    },
    ...options,
  });
}

/**
 * Creates a temporary store without persistence but with debug integration
 */
export function createTemporaryStore<T extends BaseState>(
  name: string,
  stateCreator: StateCreator<T>,
  options: Partial<DebugStoreFactoryOptions<T>> = {}
): StoreApi<T> {
  return createStoreWithDebug(stateCreator, {
    name,
    devtools: { name: `${name}-temp-store` },
    persist: false,
    immer: true,
    subscribeWithSelector: true,
    debug: {
      enabled: true,
      enableLogging: false, // Temporary stores don't need extensive logging
      enablePerformanceMonitoring: true,
      enableStateInspection: false, // Don't clutter inspector with temp stores
      logCategory: 'state-management',
      performanceCategory: 'state-update',
      logLevel: 'warn',
    },
    ...options,
  });
} 