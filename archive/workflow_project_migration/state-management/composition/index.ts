/**
 * Store Composition Module
 * 
 * Comprehensive store composition and communication utilities for Zustand-based
 * state management systems. Provides event-driven communication, store coordination,
 * and React Context-based isolation patterns.
 */

// ============================================================================
// Event Bus Exports
// ============================================================================

export {
  // Core Event Bus
  StoreEventBus,
  globalEventBus,
  
  // Event Functions
  emit,
  on,
  once,
  off,
  emitTyped,
  onTyped,
  
  // Types
  type StoreEvent,
  type EventListener,
  type EventBusOptions,
  type EventBusStats,
  type SystemEvents
} from './event-bus'

// ============================================================================
// Store Coordinator Exports
// ============================================================================

export {
  // Core Coordinator
  StoreCoordinator,
  globalCoordinator,
  
  // Coordination Functions
  registerStore,
  executeSequence,
  createSequence,
  subscribeToStores,
  synchronizeStores,
  
  // React Hooks
  useStoreCoordination,
  useMultiStoreSubscription,
  useStoreSynchronization,
  
  // Types
  type StoreCoordinatorOptions,
  type CoordinatedAction,
  type ActionSequence,
  type CoordinationResult,
  type StoreSubscription
} from './store-coordinator'

// ============================================================================
// Context Provider Exports
// ============================================================================

export {
  // Provider Factories
  createStoreProvider,
  createMultiStoreProvider,
  createAutoRegisteredStoreProvider,
  
  // Isolation Utilities
  withStoreIsolation,
  useIsolatedStore,
  
  // Composition Utilities
  composeStoreProviders,
  
  // Debug Components
  StoreDebugger,
  
  // Types
  type StoreProviderOptions,
  type StoreContextValue,
  type ModularStoreConfig,
  type MultiStoreConfig
} from './context-providers'

// ============================================================================
// Convenience Re-exports
// ============================================================================

// Re-export commonly used types from core modules
export type {
  StoreApi
} from 'zustand'

// ============================================================================
// Composition Patterns
// ============================================================================

/**
 * Pre-configured composition patterns for common use cases
 */

import { 
  createStoreProvider, 
  createMultiStoreProvider,
  type ModularStoreConfig,
  type MultiStoreConfig 
} from './context-providers'
import { globalCoordinator, registerStore } from './store-coordinator'
import { globalEventBus, emitTyped } from './event-bus'

/**
 * Create a workflow-scoped store provider
 */
export function createWorkflowStoreProvider<T>(config: ModularStoreConfig<T>) {
  const { Provider, ...hooks } = createStoreProvider({
    ...config,
    options: {
      enableCoordination: true,
      enableEventIntegration: true,
      storeName: `workflow:${config.name}`,
      autoCleanup: true,
      ...config.options
    }
  })

  return { Provider, ...hooks }
}

/**
 * Create a feature-scoped multi-store provider
 */
export function createFeatureStoreProvider(config: MultiStoreConfig) {
  return createMultiStoreProvider({
    ...config,
    options: {
      enableCoordination: true,
      enableEventIntegration: true,
      storeName: 'feature-stores',
      autoCleanup: true,
      ...config.options
    }
  })
}

/**
 * Create a page-scoped store provider with automatic cleanup
 */
export function createPageStoreProvider<T>(config: ModularStoreConfig<T>) {
  const { Provider, ...hooks } = createStoreProvider({
    ...config,
    options: {
      enableCoordination: false, // Page stores are typically isolated
      enableEventIntegration: true,
      storeName: `page:${config.name}`,
      autoCleanup: true,
      ...config.options
    }
  })

  return { Provider, ...hooks }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Initialize the composition system with default configuration
 */
export function initializeCompositionSystem(options: {
  enableGlobalLogging?: boolean
  enableGlobalPerformanceMonitoring?: boolean
  maxEventListeners?: number
  maxCoordinatorActions?: number
} = {}) {
  const {
    enableGlobalLogging = process.env.NODE_ENV === 'development',
    enableGlobalPerformanceMonitoring = true,
    maxEventListeners = 200,
    maxCoordinatorActions = 15
  } = options

  // Configure global event bus
  if (globalEventBus.getStats().totalListeners === 0) {
    // Event bus is already configured in its constructor
    if (enableGlobalLogging) {
      console.log('🚀 Store Composition System initialized', {
        eventBus: 'ready',
        coordinator: 'ready',
        logging: enableGlobalLogging,
        performance: enableGlobalPerformanceMonitoring
      })
    }
  }

  return {
    eventBus: globalEventBus,
    coordinator: globalCoordinator,
    stats: {
      eventBusStats: globalEventBus.getStats(),
      coordinatorStores: globalCoordinator.getRegisteredStores()
    }
  }
}

/**
 * Get composition system statistics
 */
export function getCompositionStats() {
  return {
    eventBus: globalEventBus.getStats(),
    coordinator: {
      registeredStores: globalCoordinator.getRegisteredStores(),
      actionHistory: globalCoordinator.getActionHistory(10)
    },
    timestamp: Date.now()
  }
}

/**
 * Cleanup composition system resources
 */
export function cleanupCompositionSystem() {
  globalEventBus.clearHistory()
  globalCoordinator.clearActionHistory()
  
  // Emit cleanup event
  emitTyped('debug:performance:warning', {
    metric: 'composition_system_cleanup',
    value: Date.now()
  })
}

// ============================================================================
// Development Helpers
// ============================================================================

/**
 * Development-only function to log composition system state
 */
export function debugCompositionSystem() {
  if (process.env.NODE_ENV !== 'development') {
    return
  }

  const stats = getCompositionStats()
  
  console.group('🔍 Store Composition System Debug')
  console.log('Event Bus Stats:', stats.eventBus)
  console.log('Coordinator Stats:', stats.coordinator)
  console.log('Event History:', globalEventBus.getHistory(5))
  console.groupEnd()
}

/**
 * Development-only function to monitor composition system performance
 */
export function monitorCompositionPerformance(intervalMs = 5000) {
  if (process.env.NODE_ENV !== 'development') {
    return () => {}
  }

  const interval = setInterval(() => {
    const stats = getCompositionStats()
    
    if (stats.eventBus.errorCount > 0) {
      console.warn('⚠️ Event Bus Errors Detected:', stats.eventBus.errorCount)
    }
    
    if (stats.eventBus.averageProcessingTime > 10) {
      console.warn('⚠️ Slow Event Processing:', stats.eventBus.averageProcessingTime + 'ms')
    }
    
    if (stats.coordinator.registeredStores.length > 20) {
      console.warn('⚠️ Many Registered Stores:', stats.coordinator.registeredStores.length)
    }
  }, intervalMs)

  return () => clearInterval(interval)
}

// ============================================================================
// Type Guards and Utilities
// ============================================================================

/**
 * Type guard to check if an object is a store event
 */
export function isStoreEvent(obj: any): obj is StoreEvent {
  return obj && 
    typeof obj.type === 'string' &&
    typeof obj.timestamp === 'number' &&
    typeof obj.source === 'string' &&
    typeof obj.id === 'string'
}

/**
 * Type guard to check if an object is a coordination result
 */
export function isCoordinationResult(obj: any): obj is CoordinationResult {
  return obj &&
    typeof obj.success === 'boolean' &&
    Array.isArray(obj.results) &&
    Array.isArray(obj.errors) &&
    typeof obj.duration === 'number' &&
    typeof obj.actionsExecuted === 'number'
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Core systems
  eventBus: globalEventBus,
  coordinator: globalCoordinator,
  
  // Factory functions
  createStoreProvider,
  createMultiStoreProvider,
  createWorkflowStoreProvider,
  createFeatureStoreProvider,
  createPageStoreProvider,
  
  // Utilities
  initializeCompositionSystem,
  getCompositionStats,
  cleanupCompositionSystem,
  debugCompositionSystem,
  monitorCompositionPerformance,
  
  // Type guards
  isStoreEvent,
  isCoordinationResult
} 