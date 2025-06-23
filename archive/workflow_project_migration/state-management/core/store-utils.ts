/**
 * Store Utilities
 * 
 * Provides helper functions, composition utilities, selectors, and subscriptions
 * for enhanced store management with debug integration.
 */

import type {
  StoreApi,
  BaseState,
} from './types';

// Import debug infrastructure
import { 
  globalLogger, 
  globalPerformanceMonitor 
} from '../debug';

// ============================================================================
// STORE COMPOSITION UTILITIES
// ============================================================================

/**
 * Enhanced store combination with debug integration
 */
export function combineStores<T extends Record<string, any>>(
  stores: { [K in keyof T]: () => T[K] },
  options: {
    enableLogging?: boolean;
    storeName?: string;
  } = {}
): () => T {
  const { enableLogging = true, storeName = 'combined-store' } = options;

  return () => {
    const operationId = `combine-stores-${storeName}-${Date.now()}`;
    
    if (enableLogging) {
      globalPerformanceMonitor.startOperation(operationId, 'state-update', {
        operation: 'combineStores',
        storeName,
        storeCount: Object.keys(stores).length,
      });
    }

    const combined = {} as T;
    
    try {
      for (const [key, store] of Object.entries(stores)) {
        combined[key as keyof T] = store();
      }

      if (enableLogging) {
        globalPerformanceMonitor.endOperation(operationId, {
          success: true,
          combinedStateSize: JSON.stringify(combined).length,
        });
      }

      return combined;
    } catch (error) {
      if (enableLogging) {
        globalPerformanceMonitor.endOperation(operationId, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      throw error;
    }
  };
}

/**
 * Enhanced store selector with debug integration
 */
export function createSelector<T, R>(
  store: StoreApi<T>,
  selector: (state: T) => R,
  equalityFn?: (a: R, b: R) => boolean,
  options: {
    enableLogging?: boolean;
    selectorName?: string;
  } = {}
): () => R {
  const { enableLogging = false, selectorName = 'anonymous' } = options;

  return () => {
    const operationId = `selector-${selectorName}-${Date.now()}`;
    
    if (enableLogging) {
      globalPerformanceMonitor.startOperation(operationId, 'state-update', {
        operation: 'selector',
        selectorName,
      });
    }

    try {
      const state = store.getState();
      const result = selector(state);

      if (enableLogging) {
        globalPerformanceMonitor.endOperation(operationId, {
          success: true,
          hasResult: result !== undefined,
        });
      }

      return result;
    } catch (error) {
      if (enableLogging) {
        globalPerformanceMonitor.endOperation(operationId, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      throw error;
    }
  };
}

/**
 * Enhanced store subscription with debug integration
 */
export function createSubscription<T>(
  store: StoreApi<T>,
  listener: (state: T, prevState: T) => void,
  selector?: (state: T) => any,
  options: {
    enableLogging?: boolean;
    subscriptionName?: string;
  } = {}
): () => void {
  const { enableLogging = false, subscriptionName = 'anonymous' } = options;

  if (enableLogging) {
    globalLogger.debug(`Creating subscription: ${subscriptionName}`, {
      hasSelector: !!selector,
      subscriptionName,
    }, 'state-management');
  }

  const enhancedListener = (state: T, prevState: T) => {
    if (enableLogging) {
      globalLogger.debug(`Subscription triggered: ${subscriptionName}`, {
        subscriptionName,
        hasChanges: state !== prevState,
      }, 'state-management');
    }

    try {
      listener(state, prevState);
    } catch (error) {
      globalLogger.error(`Subscription error: ${subscriptionName}`, error as Error, {
        subscriptionName,
        state,
        prevState,
      }, 'error');
    }
  };

  if (selector) {
    // Use subscribeWithSelector if available
    const api = store as any;
    if (api.subscribe && api.subscribe.length > 1) {
      return api.subscribe(selector, enhancedListener);
    }
  }

  return store.subscribe(enhancedListener);
}

// ============================================================================
// STORE HELPER FUNCTIONS
// ============================================================================

/**
 * Enhanced utility to reset a store to its initial state with debug integration
 */
export function resetStore<T>(store: StoreApi<T>, initialState: T, storeName?: string): void {
  const operationId = `reset-store-${storeName || 'unknown'}`;
  globalPerformanceMonitor.startOperation(operationId, 'state-update', {
    operation: 'resetStore',
    storeName,
  });

  try {
    const prevState = store.getState();
    store.setState(initialState);
    
    globalPerformanceMonitor.endOperation(operationId, {
      success: true,
      stateChanged: true,
    });

    globalLogger.info(`Store reset: ${storeName || 'unknown'}`, {
      prevState,
      initialState,
    }, 'state-management');
  } catch (error) {
    globalPerformanceMonitor.endOperation(operationId, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    globalLogger.error(`Store reset failed: ${storeName || 'unknown'}`, error as Error, {
      initialState,
    }, 'error');

    throw error;
  }
}

/**
 * Enhanced utility to get store state without subscribing with debug integration
 */
export function getStoreSnapshot<T>(store: StoreApi<T>, storeName?: string): T {
  const operationId = `snapshot-${storeName || 'unknown'}`;
  globalPerformanceMonitor.startOperation(operationId, 'state-update', {
    operation: 'getSnapshot',
    storeName,
  });

  try {
    const state = store.getState();
    
    globalPerformanceMonitor.endOperation(operationId, {
      success: true,
      stateSize: JSON.stringify(state).length,
    });

    return state;
  } catch (error) {
    globalPerformanceMonitor.endOperation(operationId, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

/**
 * Enhanced utility to check if a store has been initialized with debug integration
 */
export function isStoreInitialized<T extends BaseState>(store: StoreApi<T>, storeName?: string): boolean {
  try {
    const state = store.getState();
    const initialized = state.lastUpdated !== null;
    
    globalLogger.debug(`Store initialization check: ${storeName || 'unknown'}`, {
      initialized,
      lastUpdated: state.lastUpdated,
    }, 'state-management');
    
    return initialized;
  } catch (error) {
    globalLogger.error(`Store initialization check failed: ${storeName || 'unknown'}`, error as Error, {
      storeName,
    }, 'error');
    
    return false;
  }
}

/**
 * Creates a memoized selector that only recomputes when dependencies change
 */
export function createMemoizedSelector<T, R>(
  store: StoreApi<T>,
  selector: (state: T) => R,
  equalityFn: (a: R, b: R) => boolean = Object.is,
  options: {
    selectorName?: string;
    enableLogging?: boolean;
  } = {}
): () => R {
  const { selectorName = 'memoized', enableLogging = false } = options;
  
  let lastState: T;
  let lastResult: R;
  let hasComputed = false;

  return () => {
    const currentState = store.getState();
    
    if (!hasComputed || currentState !== lastState) {
      const operationId = `memoized-selector-${selectorName}-${Date.now()}`;
      
      if (enableLogging) {
        globalPerformanceMonitor.startOperation(operationId, 'state-update', {
          operation: 'memoizedSelector',
          selectorName,
          recompute: true,
        });
      }

      try {
        const newResult = selector(currentState);
        
        if (!hasComputed || !equalityFn(lastResult, newResult)) {
          lastResult = newResult;
          lastState = currentState;
          hasComputed = true;
          
          if (enableLogging) {
            globalPerformanceMonitor.endOperation(operationId, {
              success: true,
              resultChanged: true,
            });
          }
        } else {
          if (enableLogging) {
            globalPerformanceMonitor.endOperation(operationId, {
              success: true,
              resultChanged: false,
            });
          }
        }
      } catch (error) {
        if (enableLogging) {
          globalPerformanceMonitor.endOperation(operationId, {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        throw error;
      }
    }
    
    return lastResult;
  };
}

/**
 * Creates a store transformer that applies a transformation to state updates
 */
export function createStoreTransformer<T, R>(
  sourceStore: StoreApi<T>,
  transform: (state: T) => R,
  options: {
    transformerName?: string;
    enableLogging?: boolean;
  } = {}
): {
  getState: () => R;
  subscribe: (listener: (state: R, prevState: R) => void) => () => void;
  destroy: () => void;
} {
  const { transformerName = 'anonymous', enableLogging = false } = options;
  
  let currentTransformedState = transform(sourceStore.getState());
  let isDestroyed = false;
  const listeners: Array<(state: R, prevState: R) => void> = [];

  if (enableLogging) {
    globalLogger.debug(`Creating store transformer: ${transformerName}`, {
      transformerName,
      initialState: currentTransformedState,
    }, 'state-management');
  }

  const unsubscribe = sourceStore.subscribe((state, prevState) => {
    if (isDestroyed) return;

    try {
      const newTransformedState = transform(state);
      const prevTransformedState = currentTransformedState;
      
      if (newTransformedState !== prevTransformedState) {
        currentTransformedState = newTransformedState;
        
        if (enableLogging) {
          globalLogger.debug(`Store transformer updated: ${transformerName}`, {
            transformerName,
            prevState: prevTransformedState,
            newState: newTransformedState,
          }, 'state-management');
        }
        
        listeners.forEach(listener => {
          try {
            listener(newTransformedState, prevTransformedState);
          } catch (error) {
            globalLogger.error(`Store transformer listener error: ${transformerName}`, error as Error, {
              transformerName,
              newState: newTransformedState,
              prevState: prevTransformedState,
            }, 'error');
          }
        });
      }
    } catch (error) {
      globalLogger.error(`Store transformer error: ${transformerName}`, error as Error, {
        transformerName,
        sourceState: state,
      }, 'error');
    }
  });

  return {
    getState: () => currentTransformedState,
    subscribe: (listener: (state: R, prevState: R) => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      };
    },
    destroy: () => {
      if (!isDestroyed) {
        isDestroyed = true;
        unsubscribe();
        listeners.length = 0;
        
        if (enableLogging) {
          globalLogger.debug(`Store transformer destroyed: ${transformerName}`, {
            transformerName,
          }, 'state-management');
        }
      }
    },
  };
} 