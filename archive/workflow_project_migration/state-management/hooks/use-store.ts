/**
 * Generic Store Hook
 * 
 * High-performance React hook for accessing Zustand stores with optimized
 * selector-based subscriptions and performance monitoring.
 * 
 * Based on 2024 optimization research and modern React patterns.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { StoreApi } from '../core/types';
import { globalLogger } from '../debug/logger';
import { globalPerformanceMonitor } from '../debug/performance-monitor';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Options for store hook optimization and debugging
 */
export interface UseStoreOptions {
  // Subscription optimization
  enableDeepComparison?: boolean;
  debounceMs?: number;
  suspense?: boolean;
  
  // Debug integration
  enableLogging?: boolean;
  hookName?: string;
  
  // Performance monitoring
  enablePerformanceTracking?: boolean;
  
  // Error handling
  onError?: (error: Error) => void;
  fallback?: any;
}

/**
 * Equality function type for comparing selector results
 */
export type EqualityFn<T> = (a: T, b: T) => boolean;

/**
 * Selector function type
 */
export type Selector<T, R> = (state: T) => R;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Default shallow equality comparison
 */
const shallowEqual: EqualityFn<any> = (a, b) => {
  if (Object.is(a, b)) return true;
  
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) {
      return false;
    }
  }
  
  return true;
};

/**
 * Default reference equality comparison
 */
const referenceEqual: EqualityFn<any> = (a, b) => Object.is(a, b);

/**
 * Debounce utility for subscription updates
 */
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T => {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
};

// ============================================================================
// CORE HOOK IMPLEMENTATION
// ============================================================================

/**
 * Generic store hook with selector support (overload 1)
 */
export function useStore<TState, TSelected>(
  store: StoreApi<TState>,
  selector: Selector<TState, TSelected>,
  equalityFn?: EqualityFn<TSelected>,
  options?: UseStoreOptions
): TSelected;

/**
 * Generic store hook without selector (overload 2)
 */
export function useStore<TState>(
  store: StoreApi<TState>,
  options?: UseStoreOptions
): TState;

/**
 * Generic store hook implementation
 */
export function useStore<TState, TSelected = TState>(
  store: StoreApi<TState>,
  selectorOrOptions?: Selector<TState, TSelected> | UseStoreOptions,
  equalityFnOrOptions?: EqualityFn<TSelected> | UseStoreOptions,
  options?: UseStoreOptions
): TSelected {
  // Parse overloaded parameters
  let selector: Selector<TState, TSelected>;
  let equalityFn: EqualityFn<TSelected>;
  let finalOptions: UseStoreOptions;

  if (typeof selectorOrOptions === 'function') {
    // Overload 1: selector provided
    selector = selectorOrOptions as Selector<TState, TSelected>;
    equalityFn = (equalityFnOrOptions as EqualityFn<TSelected>) || referenceEqual;
    finalOptions = options || {};
  } else {
    // Overload 2: no selector, return full state
    selector = ((state: TState) => state as unknown as TSelected);
    equalityFn = referenceEqual;
    finalOptions = (selectorOrOptions as UseStoreOptions) || {};
  }

  const {
    enableDeepComparison = false,
    debounceMs = 0,
    enableLogging = false,
    hookName = 'useStore',
    enablePerformanceTracking = false,
    onError,
    fallback
  } = finalOptions;

  // Use deep comparison if requested
  const comparison = enableDeepComparison ? shallowEqual : equalityFn;

  // Performance tracking
  const performanceId = useRef<string>();
  
  // State for selected value
  const [selectedState, setSelectedState] = useState<TSelected>(() => {
    try {
      if (enablePerformanceTracking) {
        const operationId = `${hookName}:initial-selection:${Date.now()}`;
        globalPerformanceMonitor.startOperation(
          operationId,
          'state-update'
        );
        performanceId.current = operationId;
      }

      const initialValue = selector(store.getState());
      
      if (enablePerformanceTracking && performanceId.current) {
        globalPerformanceMonitor.endOperation(performanceId.current, {
          success: true,
          resultType: typeof initialValue
        });
      }

      if (enableLogging) {
        globalLogger.debug(`${hookName}: Initial state selected`, {
          hookName,
          hasValue: initialValue !== undefined,
          valueType: typeof initialValue
        }, 'state-management');
      }

      return initialValue;
    } catch (error) {
      if (enablePerformanceTracking && performanceId.current) {
        globalPerformanceMonitor.endOperation(performanceId.current, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      if (onError) {
        onError(error as Error);
      }

      if (enableLogging) {
        globalLogger.error(`${hookName}: Error in initial selection`, error as Error, {
          hookName,
          fallbackUsed: fallback !== undefined
        }, 'error');
      }

      return fallback;
    }
  });

  // Track previous value for comparison
  const previousValueRef = useRef<TSelected>(selectedState);

  // Subscription update handler
  const updateSelectedState = useCallback((newState: TState) => {
    try {
      if (enablePerformanceTracking) {
        const operationId = `${hookName}:selector-update:${Date.now()}`;
        globalPerformanceMonitor.startOperation(
          operationId,
          'state-update'
        );
        performanceId.current = operationId;
      }

      const newSelectedState = selector(newState);
      const previousValue = previousValueRef.current;

      // Only update if the selected value has changed
      if (!comparison(newSelectedState, previousValue)) {
        if (enableLogging) {
          globalLogger.debug(`${hookName}: State updated`, {
            hookName,
            changed: true,
            previousType: typeof previousValue,
            newType: typeof newSelectedState
          }, 'state-management');
        }

        setSelectedState(newSelectedState);
        previousValueRef.current = newSelectedState;
      } else if (enableLogging) {
        globalLogger.debug(`${hookName}: State not changed (skipping update)`, {
          hookName,
          changed: false
        }, 'state-management');
      }

      if (enablePerformanceTracking && performanceId.current) {
        globalPerformanceMonitor.endOperation(performanceId.current, {
          success: true,
          stateChanged: !comparison(newSelectedState, previousValue)
        });
      }
    } catch (error) {
      if (enablePerformanceTracking && performanceId.current) {
        globalPerformanceMonitor.endOperation(performanceId.current, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      if (onError) {
        onError(error as Error);
      }

      if (enableLogging) {
        globalLogger.error(`${hookName}: Error in selector update`, error as Error, {
          hookName,
          fallbackUsed: fallback !== undefined
        }, 'error');
      }

      if (fallback !== undefined) {
        setSelectedState(fallback);
        previousValueRef.current = fallback;
      }
    }
  }, [selector, comparison, enableLogging, enablePerformanceTracking, hookName, onError, fallback]);

  // Apply debouncing if requested
  const debouncedUpdate = debounceMs > 0 
    ? useCallback(debounce(updateSelectedState, debounceMs), [updateSelectedState, debounceMs])
    : updateSelectedState;

  // Subscribe to store changes
  useEffect(() => {
    if (enableLogging) {
      globalLogger.debug(`${hookName}: Subscribing to store`, {
        hookName,
        debounced: debounceMs > 0
      }, 'state-management');
    }

    const unsubscribe = store.subscribe(debouncedUpdate);

    return () => {
      if (enableLogging) {
        globalLogger.debug(`${hookName}: Unsubscribing from store`, {
          hookName
        }, 'state-management');
      }
      unsubscribe();
    };
  }, [store, debouncedUpdate, enableLogging, hookName, debounceMs]);

  return selectedState;
}

// ============================================================================
// SHALLOW COMPARISON HOOK
// ============================================================================

/**
 * Hook with built-in shallow comparison for object selections
 */
export function useStoreShallow<TState, TSelected>(
  store: StoreApi<TState>,
  selector: Selector<TState, TSelected>,
  options?: UseStoreOptions
): TSelected {
  return useStore(store, selector, shallowEqual, {
    enableDeepComparison: true,
    ...options
  });
}

// ============================================================================
// SAFE HOOK WITH ERROR BOUNDARIES
// ============================================================================

/**
 * Safe store hook with automatic error handling and fallbacks
 */
export function useSafeStore<TState, TSelected>(
  store: StoreApi<TState>,
  selector: Selector<TState, TSelected>,
  fallback: TSelected,
  options?: Omit<UseStoreOptions, 'fallback'>
): TSelected {
  const [error, setError] = useState<Error | null>(null);

  const handleError = useCallback((err: Error) => {
    setError(err);
    if (options?.onError) {
      options.onError(err);
    }
  }, [options]);

  const result = useStore(store, selector, undefined, {
    ...options,
    fallback,
    onError: handleError
  });

  // Clear error when selector succeeds
  useEffect(() => {
    if (error && result !== fallback) {
      setError(null);
    }
  }, [error, result, fallback]);

  return result;
}

// ============================================================================
// PERFORMANCE OPTIMIZED HOOKS
// ============================================================================

/**
 * Hook with automatic performance tracking
 */
export function useStoreWithPerformance<TState, TSelected>(
  store: StoreApi<TState>,
  selector: Selector<TState, TSelected>,
  hookName: string,
  equalityFn?: EqualityFn<TSelected>,
  options?: Omit<UseStoreOptions, 'enablePerformanceTracking' | 'hookName'>
): TSelected {
  return useStore(store, selector, equalityFn, {
    ...options,
    enablePerformanceTracking: true,
    hookName
  });
}

/**
 * Hook with automatic debug logging
 */
export function useStoreWithDebug<TState, TSelected>(
  store: StoreApi<TState>,
  selector: Selector<TState, TSelected>,
  hookName: string,
  equalityFn?: EqualityFn<TSelected>,
  options?: Omit<UseStoreOptions, 'enableLogging' | 'hookName'>
): TSelected {
  return useStore(store, selector, equalityFn, {
    ...options,
    enableLogging: true,
    hookName
  });
}

// ============================================================================
// BATCH UPDATE UTILITIES
// ============================================================================

/**
 * Batch multiple store updates to prevent cascade re-renders
 */
export const batchStoreUpdates = (updates: Array<() => void>): void => {
  // Use React's automatic batching (React 18+) or unstable_batchedUpdates fallback
  if (typeof (React as any).unstable_batchedUpdates === 'function') {
    (React as any).unstable_batchedUpdates(() => {
      updates.forEach(update => update());
    });
  } else {
    // React 18+ automatic batching
    updates.forEach(update => update());
  }
};

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export {
  shallowEqual,
  referenceEqual
}; 