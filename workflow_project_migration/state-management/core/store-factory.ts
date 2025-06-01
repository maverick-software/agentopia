/**
 * Store Factory Core
 * 
 * Provides the fundamental store creation functionality with type safety
 * and basic configuration. Enhanced functionality is provided by separate modules.
 */

// TODO: Install Zustand dependencies
// import { create } from 'zustand';
// import { devtools } from 'zustand/middleware';
// import { persist } from 'zustand/middleware';
// import { immer } from 'zustand/middleware/immer';
// import { subscribeWithSelector } from 'zustand/middleware';

import type {
  StateCreator,
  StoreApi,
  StoreConfig,
  StoreMiddleware,
  BaseState,
} from './types';

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Basic store factory options
 */
export interface StoreFactoryOptions<T> {
  name: string;
  devtools?: boolean | { name?: string; enabled?: boolean };
  persist?: boolean | {
    name?: string;
    storage?: 'localStorage' | 'sessionStorage';
    partialize?: (state: T) => Partial<T>;
    version?: number;
    migrate?: (persistedState: any, version: number) => T;
  };
  immer?: boolean;
  subscribeWithSelector?: boolean;
  middleware?: StoreMiddleware<T>[];
}

// ============================================================================
// CORE STORE FACTORY
// ============================================================================

/**
 * Core store factory function
 */
export function createStore<T extends BaseState>(
  stateCreator: StateCreator<T>,
  options: StoreFactoryOptions<T>
): StoreApi<T> {
  const {
    name,
    devtools: devtoolsConfig = true,
    persist: persistConfig = false,
    immer: useImmer = true,
    subscribeWithSelector: useSubscribeWithSelector = true,
    middleware = [],
  } = options;

  // Build middleware stack from inside out
  let composedStateCreator = stateCreator;

  // Apply custom middleware
  for (const middlewareFn of middleware.reverse()) {
    composedStateCreator = middlewareFn(composedStateCreator);
  }

  // TODO: Apply Zustand middleware when dependencies are installed
  // Apply Immer middleware
  // if (useImmer) {
  //   composedStateCreator = immer(composedStateCreator);
  // }

  // Apply persist middleware
  // if (persistConfig) {
  //   const persistOptions = typeof persistConfig === 'boolean' 
  //     ? { name: `${name}-storage` }
  //     : {
  //         name: persistConfig.name || `${name}-storage`,
  //         storage: persistConfig.storage === 'sessionStorage' 
  //           ? createJSONStorage(() => sessionStorage)
  //           : createJSONStorage(() => localStorage),
  //         partialize: persistConfig.partialize,
  //         version: persistConfig.version || 1,
  //         migrate: persistConfig.migrate,
  //       };

  //   composedStateCreator = persist(composedStateCreator, persistOptions);
  // }

  // Apply subscribe with selector middleware
  // if (useSubscribeWithSelector) {
  //   composedStateCreator = subscribeWithSelector(composedStateCreator);
  // }

  // Apply devtools middleware (outermost)
  // if (devtoolsConfig) {
  //   const devtoolsOptions = typeof devtoolsConfig === 'boolean'
  //     ? { name }
  //     : {
  //         name: devtoolsConfig.name || name,
  //         enabled: devtoolsConfig.enabled !== false,
  //       };

  //   composedStateCreator = devtools(composedStateCreator, devtoolsOptions);
  // }

  // Create the store (placeholder implementation until Zustand is installed)
  const store = createMockStore(composedStateCreator);

  return store;
}

// ============================================================================
// MOCK STORE IMPLEMENTATION (TEMPORARY)
// ============================================================================

/**
 * Temporary mock store implementation until Zustand is installed
 */
function createMockStore<T extends BaseState>(stateCreator: StateCreator<T>): StoreApi<T> {
  let state: T;
  const listeners: Array<(state: T, prevState: T) => void> = [];

  const setState = (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => {
    const prevState = state;
    if (typeof partial === 'function') {
      state = { ...state, ...(partial as any)(state) };
    } else {
      state = { ...state, ...partial };
    }
    listeners.forEach(listener => listener(state, prevState));
  };

  const getState = () => state;

  const subscribe = (listener: (state: T, prevState: T) => void) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  };

  const destroy = () => {
    listeners.length = 0;
  };

  const api: StoreApi<T> = { setState, getState, subscribe, destroy };
  
  // Initialize state
  state = stateCreator(setState, getState, api);

  return api;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Creates JSON storage adapter for persist middleware
 */
function createJSONStorage(getStorage: () => Storage) {
  return {
    getItem: (name: string) => {
      try {
        const item = getStorage().getItem(name);
        return item ? JSON.parse(item) : null;
      } catch (error) {
        return null;
      }
    },
    setItem: (name: string, value: any) => {
      try {
        const serialized = JSON.stringify(value);
        getStorage().setItem(name, serialized);
      } catch (error) {
        // Silently fail for now
      }
    },
    removeItem: (name: string) => {
      try {
        getStorage().removeItem(name);
      } catch (error) {
        // Silently fail for now
      }
    },
  };
}

/**
 * Export helper functions that need to be accessible
 */
export { createMockStore, createJSONStorage }; 