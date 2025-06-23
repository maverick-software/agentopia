/**
 * Context Provider Patterns
 * 
 * Provides React Context-based store isolation patterns for creating
 * modular stores scoped to specific component trees.
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { create, StoreApi } from 'zustand'
import { logger } from '../debug/logger'
import { globalCoordinator } from './store-coordinator'
import { globalEventBus } from './event-bus'

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface StoreProviderOptions {
  enableLogging?: boolean
  enableCoordination?: boolean
  enableEventIntegration?: boolean
  storeName?: string
  autoCleanup?: boolean
}

export interface StoreContextValue<T> {
  store: StoreApi<T>
  state: T
  actions: Record<string, (...args: any[]) => any>
}

export interface ModularStoreConfig<T> {
  name: string
  initialState: T
  actions: (set: any, get: any) => Record<string, (...args: any[]) => any>
  options?: StoreProviderOptions
}

// ============================================================================
// Generic Store Provider Factory
// ============================================================================

/**
 * Creates a modular store provider with React Context
 */
export function createStoreProvider<T extends Record<string, any>>(
  config: ModularStoreConfig<T>
) {
  const StoreContext = createContext<StoreContextValue<T> | null>(null)

  const StoreProvider: React.FC<{ 
    children: React.ReactNode
    initialState?: Partial<T>
    options?: StoreProviderOptions 
  }> = ({ 
    children, 
    initialState = {}, 
    options = {} 
  }) => {
    const mergedOptions: Required<StoreProviderOptions> = {
      enableLogging: options.enableLogging ?? process.env.NODE_ENV === 'development',
      enableCoordination: options.enableCoordination ?? true,
      enableEventIntegration: options.enableEventIntegration ?? true,
      storeName: options.storeName ?? config.name,
      autoCleanup: options.autoCleanup ?? true
    }

    // Create store instance once per provider
    const [storeInstance] = useState(() => {
      const mergedInitialState = { ...config.initialState, ...initialState }
      
      const store = create<T>((set, get) => ({
        ...mergedInitialState,
        ...config.actions(set, get)
      }))

      if (mergedOptions.enableLogging) {
        logger.debug('Modular store created', { 
          storeName: mergedOptions.storeName,
          initialState: mergedInitialState 
        })
      }

      return store
    })

    // Get current state
    const [state, setState] = useState(() => storeInstance.getState())

    // Subscribe to store changes
    useEffect(() => {
      const unsubscribe = storeInstance.subscribe((newState) => {
        setState(newState)
      })

      return unsubscribe
    }, [storeInstance])

    // Register with coordinator if enabled
    useEffect(() => {
      if (mergedOptions.enableCoordination) {
        globalCoordinator.registerStore(mergedOptions.storeName, storeInstance)

        if (mergedOptions.enableLogging) {
          logger.debug('Store registered with coordinator', { 
            storeName: mergedOptions.storeName 
          })
        }
      }

      return () => {
        if (mergedOptions.enableCoordination && mergedOptions.autoCleanup) {
          globalCoordinator.unregisterStore(mergedOptions.storeName)
          
          if (mergedOptions.enableLogging) {
            logger.debug('Store unregistered from coordinator', { 
              storeName: mergedOptions.storeName 
            })
          }
        }
      }
    }, [storeInstance, mergedOptions])

    // Emit lifecycle events
    useEffect(() => {
      if (mergedOptions.enableEventIntegration) {
        globalEventBus.emit('store:provider:mounted', {
          storeName: mergedOptions.storeName,
          initialState: config.initialState
        }, 'context-provider')
      }

      return () => {
        if (mergedOptions.enableEventIntegration) {
          globalEventBus.emit('store:provider:unmounted', {
            storeName: mergedOptions.storeName
          }, 'context-provider')
        }
      }
    }, [mergedOptions])

    // Extract actions from state
    const actions = React.useMemo(() => {
      const currentState = storeInstance.getState()
      const actionKeys = Object.keys(config.actions(() => {}, () => {}))
      
      return actionKeys.reduce((acc, key) => {
        acc[key] = (currentState as any)[key]
        return acc
      }, {} as Record<string, (...args: any[]) => any>)
    }, [storeInstance])

    const contextValue: StoreContextValue<T> = {
      store: storeInstance,
      state,
      actions
    }

    return (
      <StoreContext.Provider value={contextValue}>
        {children}
      </StoreContext.Provider>
    )
  }

  const useStore = (): StoreContextValue<T> => {
    const context = useContext(StoreContext)
    
    if (!context) {
      throw new Error(
        `useStore must be used within a ${config.name}Provider. ` +
        `Make sure to wrap your component with <${config.name}Provider>.`
      )
    }

    return context
  }

  const useStoreState = (): T => {
    const { state } = useStore()
    return state
  }

  const useStoreActions = () => {
    const { actions } = useStore()
    return actions
  }

  const useStoreSelector = <R>(selector: (state: T) => R): R => {
    const { store } = useStore()
    const [selectedState, setSelectedState] = useState(() => selector(store.getState()))

    useEffect(() => {
      const unsubscribe = store.subscribe((state) => {
        const newSelectedState = selector(state)
        setSelectedState(newSelectedState)
      })

      return unsubscribe
    }, [store, selector])

    return selectedState
  }

  return {
    Provider: StoreProvider,
    useStore,
    useStoreState,
    useStoreActions,
    useStoreSelector,
    Context: StoreContext
  }
}

// ============================================================================
// Multi-Store Provider
// ============================================================================

export interface MultiStoreConfig {
  stores: Record<string, ModularStoreConfig<any>>
  options?: StoreProviderOptions
}

/**
 * Creates a provider that manages multiple stores
 */
export function createMultiStoreProvider(config: MultiStoreConfig) {
  const MultiStoreContext = createContext<Record<string, StoreContextValue<any>> | null>(null)

  const MultiStoreProvider: React.FC<{ 
    children: React.ReactNode
    initialStates?: Record<string, any>
    options?: StoreProviderOptions 
  }> = ({ 
    children, 
    initialStates = {}, 
    options = {} 
  }) => {
    const mergedOptions: Required<StoreProviderOptions> = {
      enableLogging: options.enableLogging ?? process.env.NODE_ENV === 'development',
      enableCoordination: options.enableCoordination ?? true,
      enableEventIntegration: options.enableEventIntegration ?? true,
      storeName: options.storeName ?? 'multi-store',
      autoCleanup: options.autoCleanup ?? true
    }

    // Create all store instances
    const [storeInstances] = useState(() => {
      const instances: Record<string, StoreContextValue<any>> = {}

      Object.entries(config.stores).forEach(([key, storeConfig]) => {
        const initialState = { ...storeConfig.initialState, ...(initialStates[key] || {}) }
        
        const store = create((set, get) => ({
          ...initialState,
          ...storeConfig.actions(set, get)
        }))

        const actions = Object.keys(storeConfig.actions(() => {}, () => {})).reduce((acc, actionKey) => {
          acc[actionKey] = (store.getState() as any)[actionKey]
          return acc
        }, {} as Record<string, (...args: any[]) => any>)

        instances[key] = {
          store,
          state: store.getState(),
          actions
        }

        if (mergedOptions.enableLogging) {
          logger.debug('Multi-store instance created', { 
            storeKey: key,
            storeName: storeConfig.name 
          })
        }
      })

      return instances
    })

    // Subscribe to all store changes
    const [states, setStates] = useState(() => {
      return Object.fromEntries(
        Object.entries(storeInstances).map(([key, { store }]) => [key, store.getState()])
      )
    })

    useEffect(() => {
      const unsubscribers = Object.entries(storeInstances).map(([key, { store }]) => {
        return store.subscribe((newState) => {
          setStates(prev => ({ ...prev, [key]: newState }))
        })
      })

      return () => {
        unsubscribers.forEach(unsub => unsub())
      }
    }, [storeInstances])

    // Update context value when states change
    const contextValue = React.useMemo(() => {
      return Object.fromEntries(
        Object.entries(storeInstances).map(([key, instance]) => [
          key,
          { ...instance, state: states[key] }
        ])
      )
    }, [storeInstances, states])

    // Register stores with coordinator
    useEffect(() => {
      if (mergedOptions.enableCoordination) {
        Object.entries(storeInstances).forEach(([key, { store }]) => {
          const storeName = `${mergedOptions.storeName}:${key}`
          globalCoordinator.registerStore(storeName, store)
        })
      }

      return () => {
        if (mergedOptions.enableCoordination && mergedOptions.autoCleanup) {
          Object.keys(storeInstances).forEach(key => {
            const storeName = `${mergedOptions.storeName}:${key}`
            globalCoordinator.unregisterStore(storeName)
          })
        }
      }
    }, [storeInstances, mergedOptions])

    return (
      <MultiStoreContext.Provider value={contextValue}>
        {children}
      </MultiStoreContext.Provider>
    )
  }

  const useMultiStore = () => {
    const context = useContext(MultiStoreContext)
    
    if (!context) {
      throw new Error(
        'useMultiStore must be used within a MultiStoreProvider. ' +
        'Make sure to wrap your component with <MultiStoreProvider>.'
      )
    }

    return context
  }

  const useStoreByKey = <T>(key: string): StoreContextValue<T> => {
    const stores = useMultiStore()
    
    if (!stores[key]) {
      throw new Error(`Store with key '${key}' not found in MultiStoreProvider`)
    }

    return stores[key] as StoreContextValue<T>
  }

  return {
    Provider: MultiStoreProvider,
    useMultiStore,
    useStoreByKey,
    Context: MultiStoreContext
  }
}

// ============================================================================
// Store Isolation Utilities
// ============================================================================

/**
 * Higher-order component for store isolation
 */
export function withStoreIsolation<P extends object, T>(
  Component: React.ComponentType<P>,
  storeConfig: ModularStoreConfig<T>
) {
  const { Provider } = createStoreProvider(storeConfig)

  const IsolatedComponent: React.FC<P & { 
    storeInitialState?: Partial<T>
    storeOptions?: StoreProviderOptions 
  }> = ({ storeInitialState, storeOptions, ...props }) => {
    return (
      <Provider initialState={storeInitialState} options={storeOptions}>
        <Component {...(props as P)} />
      </Provider>
    )
  }

  IsolatedComponent.displayName = `withStoreIsolation(${Component.displayName || Component.name})`

  return IsolatedComponent
}

/**
 * Hook for creating temporary isolated stores
 */
export function useIsolatedStore<T>(
  storeConfig: ModularStoreConfig<T>,
  initialState?: Partial<T>
) {
  const storeRef = useRef<StoreApi<T>>()
  const [state, setState] = useState<T>()

  if (!storeRef.current) {
    const mergedInitialState = { ...storeConfig.initialState, ...initialState }
    
    storeRef.current = create<T>((set, get) => ({
      ...mergedInitialState,
      ...storeConfig.actions(set, get)
    }))

    setState(storeRef.current.getState())
  }

  useEffect(() => {
    if (!storeRef.current) return

    const unsubscribe = storeRef.current.subscribe((newState) => {
      setState(newState)
    })

    return unsubscribe
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (storeRef.current) {
        // Store cleanup if needed
        logger.debug('Isolated store cleaned up', { storeName: storeConfig.name })
      }
    }
  }, [storeConfig.name])

  return {
    store: storeRef.current!,
    state: state!,
    actions: React.useMemo(() => {
      if (!storeRef.current) return {}
      
      const currentState = storeRef.current.getState()
      const actionKeys = Object.keys(storeConfig.actions(() => {}, () => {}))
      
      return actionKeys.reduce((acc, key) => {
        acc[key] = (currentState as any)[key]
        return acc
      }, {} as Record<string, (...args: any[]) => any>)
    }, [storeConfig, state])
  }
}

// ============================================================================
// Store Composition Utilities
// ============================================================================

/**
 * Compose multiple store providers into a single provider
 */
export function composeStoreProviders(
  providers: Array<React.ComponentType<{ children: React.ReactNode }>>
) {
  return ({ children }: { children: React.ReactNode }) => {
    return providers.reduceRight(
      (acc, Provider) => <Provider>{acc}</Provider>,
      children
    )
  }
}

/**
 * Create a store provider with automatic registration
 */
export function createAutoRegisteredStoreProvider<T>(
  config: ModularStoreConfig<T>
) {
  const { Provider, ...hooks } = createStoreProvider(config)

  const AutoRegisteredProvider: React.FC<{
    children: React.ReactNode
    initialState?: Partial<T>
    options?: StoreProviderOptions
  }> = (props) => {
    return (
      <Provider 
        {...props} 
        options={{ 
          enableCoordination: true, 
          enableEventIntegration: true,
          ...props.options 
        }}
      />
    )
  }

  return {
    Provider: AutoRegisteredProvider,
    ...hooks
  }
}

// ============================================================================
// Development Utilities
// ============================================================================

/**
 * Debug component for visualizing store state
 */
export const StoreDebugger: React.FC<{ 
  storeName: string
  expanded?: boolean 
}> = ({ storeName, expanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(expanded)

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div style={{ 
      position: 'fixed', 
      top: 10, 
      right: 10, 
      background: 'rgba(0,0,0,0.8)', 
      color: 'white', 
      padding: 10, 
      borderRadius: 5,
      fontSize: 12,
      fontFamily: 'monospace',
      zIndex: 9999,
      maxWidth: 300,
      maxHeight: 400,
      overflow: 'auto'
    }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: 5 }}
      >
        {storeName} {isExpanded ? '▼' : '▶'}
      </div>
      {isExpanded && (
        <div>
          <div>Coordinator Stores: {globalCoordinator.getRegisteredStores().length}</div>
          <div>Event Bus Stats: {globalEventBus.getStats().totalEvents} events</div>
        </div>
      )}
    </div>
  )
} 