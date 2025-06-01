/**
 * Advanced Store Utilities
 * 
 * Provides advanced utilities like computed values, store watchers, and batch updaters
 * for complex store management scenarios with debug integration.
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
// COMPUTED VALUES
// ============================================================================

/**
 * Creates a computed value that automatically updates when dependencies change
 */
export function createComputed<T, R>(
  store: StoreApi<T>,
  selector: (state: T) => R,
  equalityFn: (a: R, b: R) => boolean = Object.is,
  options: {
    computedName?: string;
    enableLogging?: boolean;
  } = {}
): {
  getValue: () => R;
  subscribe: (listener: (value: R, prevValue: R) => void) => () => void;
  destroy: () => void;
} {
  const { computedName = 'anonymous', enableLogging = false } = options;
  
  let currentValue = selector(store.getState());
  let isDestroyed = false;
  const listeners: Array<(value: R, prevValue: R) => void> = [];

  if (enableLogging) {
    globalLogger.debug(`Creating computed: ${computedName}`, {
      computedName,
      initialValue: currentValue,
    }, 'state-management');
  }

  const unsubscribe = store.subscribe((state, prevState) => {
    if (isDestroyed) return;

    const newValue = selector(state);
    
    if (!equalityFn(currentValue, newValue)) {
      const prevValue = currentValue;
      currentValue = newValue;
      
      if (enableLogging) {
        globalLogger.debug(`Computed updated: ${computedName}`, {
          computedName,
          prevValue,
          newValue,
        }, 'state-management');
      }
      
      listeners.forEach(listener => {
        try {
          listener(newValue, prevValue);
        } catch (error) {
          globalLogger.error(`Computed listener error: ${computedName}`, error as Error, {
            computedName,
            newValue,
            prevValue,
          }, 'error');
        }
      });
    }
  });

  return {
    getValue: () => currentValue,
    subscribe: (listener: (value: R, prevValue: R) => void) => {
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
          globalLogger.debug(`Computed destroyed: ${computedName}`, {
            computedName,
          }, 'state-management');
        }
      }
    },
  };
}

// ============================================================================
// STORE WATCHERS
// ============================================================================

/**
 * Creates a store watcher that can observe multiple stores
 */
export function createStoreWatcher<T extends Record<string, any>>(
  stores: { [K in keyof T]: StoreApi<T[K]> },
  callback: (states: T, prevStates: T) => void,
  options: {
    watcherName?: string;
    enableLogging?: boolean;
    debounce?: number;
  } = {}
): () => void {
  const { watcherName = 'anonymous', enableLogging = false, debounce = 0 } = options;
  
  let isDestroyed = false;
  let timeoutId: NodeJS.Timeout | null = null;
  
  const getCurrentStates = (): T => {
    const states = {} as T;
    for (const [key, store] of Object.entries(stores)) {
      states[key as keyof T] = store.getState();
    }
    return states;
  };

  let prevStates = getCurrentStates();

  if (enableLogging) {
    globalLogger.debug(`Creating store watcher: ${watcherName}`, {
      watcherName,
      storeCount: Object.keys(stores).length,
      initialStates: prevStates,
    }, 'state-management');
  }

  const executeCallback = () => {
    if (isDestroyed) return;
    
    const currentStates = getCurrentStates();
    
    try {
      callback(currentStates, prevStates);
      prevStates = currentStates;
    } catch (error) {
      globalLogger.error(`Store watcher error: ${watcherName}`, error as Error, {
        watcherName,
        currentStates,
        prevStates,
      }, 'error');
    }
  };

  const debouncedCallback = debounce > 0 
    ? () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(executeCallback, debounce);
      }
    : executeCallback;

  // Subscribe to all stores
  const unsubscribers = Object.entries(stores).map(([key, store]) => 
    store.subscribe(() => {
      if (!isDestroyed) {
        debouncedCallback();
      }
    })
  );

  return () => {
    if (!isDestroyed) {
      isDestroyed = true;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      unsubscribers.forEach(unsubscribe => unsubscribe());
      
      if (enableLogging) {
        globalLogger.debug(`Store watcher destroyed: ${watcherName}`, {
          watcherName,
        }, 'state-management');
      }
    }
  };
}

// ============================================================================
// BATCH UPDATERS
// ============================================================================

/**
 * Creates a store batch updater that can update multiple stores atomically
 */
export function createBatchUpdater<T extends Record<string, any>>(
  stores: { [K in keyof T]: StoreApi<T[K]> },
  options: {
    batcherName?: string;
    enableLogging?: boolean;
  } = {}
): (updates: { [K in keyof T]?: Partial<T[K]> | ((state: T[K]) => Partial<T[K]>) }) => void {
  const { batcherName = 'anonymous', enableLogging = false } = options;

  return (updates) => {
    const operationId = `batch-update-${batcherName}-${Date.now()}`;
    
    if (enableLogging) {
      globalPerformanceMonitor.startOperation(operationId, 'state-update', {
        operation: 'batchUpdate',
        batcherName,
        updateCount: Object.keys(updates).length,
      });
      
      globalLogger.debug(`Batch update started: ${batcherName}`, {
        batcherName,
        updates: Object.keys(updates),
      }, 'state-management');
    }

    try {
      // Apply all updates
      for (const [key, update] of Object.entries(updates)) {
        if (update !== undefined) {
          const store = stores[key as keyof T];
          if (store) {
            if (typeof update === 'function') {
              store.setState(update as any);
            } else {
              store.setState(update as any);
            }
          }
        }
      }

      if (enableLogging) {
        globalPerformanceMonitor.endOperation(operationId, {
          success: true,
          updatedStores: Object.keys(updates).length,
        });
        
        globalLogger.debug(`Batch update completed: ${batcherName}`, {
          batcherName,
          updatedStores: Object.keys(updates),
        }, 'state-management');
      }
    } catch (error) {
      if (enableLogging) {
        globalPerformanceMonitor.endOperation(operationId, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        globalLogger.error(`Batch update failed: ${batcherName}`, error as Error, {
          batcherName,
          updates: Object.keys(updates),
        }, 'error');
      }
      
      throw error;
    }
  };
}

// ============================================================================
// STORE SYNCHRONIZATION
// ============================================================================

/**
 * Creates a store synchronizer that keeps multiple stores in sync
 */
export function createStoreSynchronizer<T>(
  sourceStore: StoreApi<T>,
  targetStores: StoreApi<T>[],
  options: {
    syncName?: string;
    enableLogging?: boolean;
    bidirectional?: boolean;
    transform?: (state: T) => T;
  } = {}
): () => void {
  const { syncName = 'anonymous', enableLogging = false, bidirectional = false, transform } = options;
  
  let isSyncing = false;
  const unsubscribers: (() => void)[] = [];

  if (enableLogging) {
    globalLogger.debug(`Creating store synchronizer: ${syncName}`, {
      syncName,
      targetCount: targetStores.length,
      bidirectional,
      hasTransform: !!transform,
    }, 'state-management');
  }

  const syncToTargets = (state: T) => {
    if (isSyncing) return;
    
    isSyncing = true;
    const finalState = transform ? transform(state) : state;
    
    try {
      targetStores.forEach(store => {
        store.setState(finalState);
      });
      
      if (enableLogging) {
        globalLogger.debug(`Synchronized to targets: ${syncName}`, {
          syncName,
          targetCount: targetStores.length,
          state: finalState,
        }, 'state-management');
      }
    } catch (error) {
      globalLogger.error(`Synchronization failed: ${syncName}`, error as Error, {
        syncName,
        state: finalState,
      }, 'error');
    } finally {
      isSyncing = false;
    }
  };

  const syncFromTarget = (state: T) => {
    if (isSyncing) return;
    
    isSyncing = true;
    const finalState = transform ? transform(state) : state;
    
    try {
      sourceStore.setState(finalState);
      
      if (enableLogging) {
        globalLogger.debug(`Synchronized from target: ${syncName}`, {
          syncName,
          state: finalState,
        }, 'state-management');
      }
    } catch (error) {
      globalLogger.error(`Reverse synchronization failed: ${syncName}`, error as Error, {
        syncName,
        state: finalState,
      }, 'error');
    } finally {
      isSyncing = false;
    }
  };

  // Subscribe to source store
  unsubscribers.push(
    sourceStore.subscribe((state) => syncToTargets(state))
  );

  // Subscribe to target stores if bidirectional
  if (bidirectional) {
    targetStores.forEach(store => {
      unsubscribers.push(
        store.subscribe((state) => syncFromTarget(state))
      );
    });
  }

  // Initial sync
  syncToTargets(sourceStore.getState());

  return () => {
    unsubscribers.forEach(unsubscribe => unsubscribe());
    
    if (enableLogging) {
      globalLogger.debug(`Store synchronizer destroyed: ${syncName}`, {
        syncName,
      }, 'state-management');
    }
  };
} 