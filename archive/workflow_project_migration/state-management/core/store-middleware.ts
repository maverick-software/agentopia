/**
 * Store Middleware Utilities
 * 
 * Provides enhanced middleware creators with debug infrastructure integration
 * for logging, performance monitoring, error handling, and validation.
 */

import type {
  StoreMiddleware,
  BaseState,
} from './types';

// Import debug infrastructure
import { 
  globalLogger, 
  globalPerformanceMonitor,
  type LogCategory 
} from '../debug';

// ============================================================================
// LOGGING MIDDLEWARE
// ============================================================================

/**
 * Creates an enhanced logging middleware with debug infrastructure integration
 */
export function createLoggingMiddleware<T>(
  options: {
    enabled?: boolean;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    prefix?: string;
    useGlobalLogger?: boolean;
  } = {}
): StoreMiddleware<T> {
  const { 
    enabled = process.env.NODE_ENV === 'development', 
    logLevel = 'debug', 
    prefix = 'Store',
    useGlobalLogger = true,
  } = options;

  return (config) => (set, get, api) => {
    const loggedSet = (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => {
      if (enabled) {
        const prevState = get();
        const result = set(partial);
        const nextState = get();
        
        if (useGlobalLogger) {
          const logMessage = `${prefix} State Update`;
          const metadata = {
            prevState,
            nextState,
            hasChanges: prevState !== nextState,
          };

          switch (logLevel) {
            case 'debug':
              globalLogger.debug(logMessage, metadata, 'state-management');
              break;
            case 'info':
              globalLogger.info(logMessage, metadata, 'state-management');
              break;
            case 'warn':
              globalLogger.warn(logMessage, metadata, 'state-management');
              break;
            case 'error':
              globalLogger.error(logMessage, undefined, metadata, 'state-management');
              break;
          }
        } else {
          console.group(`${prefix} State Update`);
          console.log('Previous State:', prevState);
          console.log('Next State:', nextState);
          console.groupEnd();
        }
        
        return result;
      }
      return set(partial);
    };

    return config(loggedSet, get, api);
  };
}

// ============================================================================
// PERFORMANCE MIDDLEWARE
// ============================================================================

/**
 * Creates an enhanced performance monitoring middleware with debug infrastructure integration
 */
export function createPerformanceMiddleware<T>(
  options: {
    enabled?: boolean;
    threshold?: number; // ms
    onSlowUpdate?: (duration: number, stateName: string) => void;
    useGlobalMonitor?: boolean;
    storeName?: string;
  } = {}
): StoreMiddleware<T> {
  const { 
    enabled = true, 
    threshold = 16, 
    onSlowUpdate,
    useGlobalMonitor = true,
    storeName = 'unknown',
  } = options;

  return (config) => (set, get, api) => {
    const timedSet = (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => {
      if (!enabled) return set(partial);

      const operationId = `middleware-perf-${storeName}-${Date.now()}`;
      const start = performance.now();

      if (useGlobalMonitor) {
        globalPerformanceMonitor.startOperation(operationId, 'state-update', {
          storeName,
          middleware: 'performance',
        });
      }

      try {
        const result = set(partial);
        const duration = performance.now() - start;

        if (useGlobalMonitor) {
          globalPerformanceMonitor.endOperation(operationId, {
            duration,
            threshold,
            isSlowUpdate: duration > threshold,
          });
        }

        if (duration > threshold && onSlowUpdate) {
          onSlowUpdate(duration, storeName);
        }

        return result;
      } catch (error) {
        if (useGlobalMonitor) {
          globalPerformanceMonitor.endOperation(operationId, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        throw error;
      }
    };

    return config(timedSet, get, api);
  };
}

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

/**
 * Creates an enhanced error handling middleware with debug infrastructure integration
 */
export function createErrorHandlingMiddleware<T>(
  options: {
    onError?: (error: Error, stateName: string) => void;
    fallbackState?: Partial<T>;
    useGlobalLogger?: boolean;
    storeName?: string;
  } = {}
): StoreMiddleware<T> {
  const { onError, fallbackState, useGlobalLogger = true, storeName = 'unknown' } = options;

  return (config) => (set, get, api) => {
    const safeSet = (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => {
      try {
        return set(partial);
      } catch (error) {
        const errorObj = error as Error;
        
        if (useGlobalLogger) {
          globalLogger.error(`Store update error in ${storeName}`, errorObj, {
            storeName,
            middleware: 'error-handling',
            updateType: typeof partial,
          }, 'error');
        } else {
          console.error('Store update error:', errorObj);
        }
        
        if (onError) {
          onError(errorObj, storeName);
        }

        // Apply fallback state if provided
        if (fallbackState) {
          set((state: T) => ({ ...state, ...fallbackState }));
        }

        throw errorObj; // Re-throw to maintain error propagation
      }
    };

    return config(safeSet, get, api);
  };
}

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Creates an enhanced validation middleware with debug infrastructure integration
 */
export function createValidationMiddleware<T>(
  validator: (state: T) => boolean | string,
  options: {
    onValidationError?: (error: string, state: T) => void;
    preventUpdate?: boolean;
    useGlobalLogger?: boolean;
    storeName?: string;
  } = {}
): StoreMiddleware<T> {
  const { onValidationError, preventUpdate = false, useGlobalLogger = true, storeName = 'unknown' } = options;

  return (config) => (set, get, api) => {
    const validatedSet = (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => {
      // Apply the update to get the new state
      const prevState = get();
      set(partial);
      const newState = get();

      // Validate the new state
      const validationResult = validator(newState);
      
      if (validationResult !== true) {
        const errorMessage = typeof validationResult === 'string' 
          ? validationResult 
          : 'State validation failed';

        if (useGlobalLogger) {
          globalLogger.warn(`State validation failed in ${storeName}`, {
            storeName,
            middleware: 'validation',
            error: errorMessage,
            prevState,
            newState,
          }, 'state-management');
        }

        if (onValidationError) {
          onValidationError(errorMessage, newState);
        }

        if (preventUpdate) {
          // Revert to previous state
          set(prevState);
          throw new Error(errorMessage);
        }
      }
    };

    return config(validatedSet, get, api);
  };
}

// ============================================================================
// THROTTLE MIDDLEWARE
// ============================================================================

/**
 * Creates a throttle middleware that limits the frequency of state updates
 */
export function createThrottleMiddleware<T>(
  delay: number = 100,
  options: {
    leading?: boolean;
    trailing?: boolean;
    storeName?: string;
  } = {}
): StoreMiddleware<T> {
  const { leading = true, trailing = true, storeName = 'unknown' } = options;
  
  let timeoutId: NodeJS.Timeout | null = null;
  let lastCallTime = 0;
  let pendingArgs: [T | Partial<T> | ((state: T) => T | Partial<T>)] | null = null;

  return (config) => (set, get, api) => {
    const throttledSet = (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTime;

      const executeUpdate = () => {
        lastCallTime = Date.now();
        const args = pendingArgs || [partial];
        pendingArgs = null;
        return set(args[0]);
      };

      // If this is the first call or enough time has passed, and leading is enabled
      if ((timeSinceLastCall >= delay || lastCallTime === 0) && leading) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        return executeUpdate();
      }

      // Store the latest arguments for trailing execution
      pendingArgs = [partial];

      // Set up trailing execution if enabled
      if (trailing && !timeoutId) {
        timeoutId = setTimeout(() => {
          timeoutId = null;
          if (pendingArgs) {
            executeUpdate();
          }
        }, delay - timeSinceLastCall);
      }
    };

    return config(throttledSet, get, api);
  };
}

// ============================================================================
// DEBOUNCE MIDDLEWARE
// ============================================================================

/**
 * Creates a debounce middleware that delays state updates until after a specified delay
 */
export function createDebounceMiddleware<T>(
  delay: number = 300,
  options: {
    immediate?: boolean;
    storeName?: string;
  } = {}
): StoreMiddleware<T> {
  const { immediate = false, storeName = 'unknown' } = options;
  
  let timeoutId: NodeJS.Timeout | null = null;
  let hasExecuted = false;

  return (config) => (set, get, api) => {
    const debouncedSet = (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => {
      const executeUpdate = () => {
        hasExecuted = true;
        return set(partial);
      };

      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Execute immediately if immediate is true and this is the first call
      if (immediate && !hasExecuted) {
        return executeUpdate();
      }

      // Set up delayed execution
      timeoutId = setTimeout(() => {
        timeoutId = null;
        hasExecuted = false;
        executeUpdate();
      }, delay);
    };

    return config(debouncedSet, get, api);
  };
}

// ============================================================================
// PERSISTENCE MIDDLEWARE
// ============================================================================

/**
 * Creates a simple persistence middleware for localStorage/sessionStorage
 */
export function createPersistenceMiddleware<T extends BaseState>(
  key: string,
  options: {
    storage?: 'localStorage' | 'sessionStorage';
    serialize?: (state: T) => string;
    deserialize?: (value: string) => T;
    partialize?: (state: T) => Partial<T>;
    onError?: (error: Error) => void;
    storeName?: string;
  } = {}
): StoreMiddleware<T> {
  const {
    storage = 'localStorage',
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    partialize,
    onError,
    storeName = 'unknown',
  } = options;

  const storageApi = storage === 'localStorage' ? localStorage : sessionStorage;

  return (config) => (set, get, api) => {
    // Try to restore state on initialization
    try {
      const stored = storageApi.getItem(key);
      if (stored) {
        const restoredState = deserialize(stored);
        set((state: T) => ({ ...state, ...restoredState }));
        
        globalLogger.debug(`State restored from ${storage}`, {
          key,
          storeName,
          restoredState,
        }, 'state-management');
      }
    } catch (error) {
      if (onError) {
        onError(error as Error);
      } else {
        globalLogger.error(`Failed to restore state from ${storage}`, error as Error, {
          key,
          storeName,
        }, 'error');
      }
    }

    const persistingSet = (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => {
      const result = set(partial);
      
      try {
        const currentState = get();
        const stateToPersist = partialize ? partialize(currentState) : currentState;
        const serialized = serialize(stateToPersist as T);
        storageApi.setItem(key, serialized);
        
        globalLogger.debug(`State persisted to ${storage}`, {
          key,
          storeName,
          persistedState: stateToPersist,
        }, 'state-management');
      } catch (error) {
        if (onError) {
          onError(error as Error);
        } else {
          globalLogger.error(`Failed to persist state to ${storage}`, error as Error, {
            key,
            storeName,
          }, 'error');
        }
      }
      
      return result;
    };

    return config(persistingSet, get, api);
  };
} 