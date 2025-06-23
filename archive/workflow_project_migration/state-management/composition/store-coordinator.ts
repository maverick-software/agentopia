/**
 * Store Coordinator System
 * 
 * Provides utilities for coordinating actions between multiple stores
 * while maintaining loose coupling and type safety.
 */

import { StoreApi } from 'zustand'
import { logger } from '../debug/logger'
import { performanceMonitor } from '../debug/performance-monitor'
import { globalEventBus, StoreEvent } from './event-bus'

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface StoreCoordinatorOptions {
  enableLogging?: boolean
  enablePerformanceMonitoring?: boolean
  enableEventIntegration?: boolean
  maxConcurrentActions?: number
}

export interface CoordinatedAction<T = any> {
  name: string
  store: string
  action: (...args: any[]) => T
  priority?: number
  condition?: (...args: any[]) => boolean
  rollback?: (...args: any[]) => void
}

export interface ActionSequence {
  id: string
  actions: CoordinatedAction[]
  parallel?: boolean
  rollbackOnError?: boolean
}

export interface CoordinationResult {
  success: boolean
  results: any[]
  errors: Error[]
  duration: number
  actionsExecuted: number
}

export interface StoreSubscription {
  store: string
  selector: (state: any) => any
  handler: (value: any, previousValue: any) => void
  cleanup?: () => void
}

// ============================================================================
// Store Coordinator Implementation
// ============================================================================

export class StoreCoordinator {
  private stores = new Map<string, StoreApi<any>>()
  private subscriptions = new Map<string, StoreSubscription[]>()
  private actionHistory: Array<{ sequence: ActionSequence; result: CoordinationResult }> = []
  private options: Required<StoreCoordinatorOptions>

  constructor(options: StoreCoordinatorOptions = {}) {
    this.options = {
      enableLogging: options.enableLogging ?? true,
      enablePerformanceMonitoring: options.enablePerformanceMonitoring ?? true,
      enableEventIntegration: options.enableEventIntegration ?? true,
      maxConcurrentActions: options.maxConcurrentActions ?? 10
    }

    if (this.options.enableLogging) {
      logger.info('StoreCoordinator initialized', { options: this.options })
    }
  }

  // ============================================================================
  // Store Registration
  // ============================================================================

  /**
   * Register a store with the coordinator
   */
  registerStore<T>(name: string, store: StoreApi<T>): void {
    if (this.stores.has(name)) {
      logger.warn('Store already registered, overwriting', { storeName: name })
    }

    this.stores.set(name, store)

    if (this.options.enableLogging) {
      logger.debug('Store registered', { storeName: name })
    }

    // Emit registration event
    if (this.options.enableEventIntegration) {
      globalEventBus.emit('coordinator:store:registered', { storeName: name }, 'coordinator')
    }
  }

  /**
   * Unregister a store
   */
  unregisterStore(name: string): void {
    if (!this.stores.has(name)) {
      logger.warn('Attempted to unregister non-existent store', { storeName: name })
      return
    }

    // Cleanup subscriptions for this store
    this.cleanupStoreSubscriptions(name)

    this.stores.delete(name)

    if (this.options.enableLogging) {
      logger.debug('Store unregistered', { storeName: name })
    }

    // Emit unregistration event
    if (this.options.enableEventIntegration) {
      globalEventBus.emit('coordinator:store:unregistered', { storeName: name }, 'coordinator')
    }
  }

  /**
   * Get a registered store
   */
  getStore<T>(name: string): StoreApi<T> | undefined {
    return this.stores.get(name) as StoreApi<T> | undefined
  }

  /**
   * Check if a store is registered
   */
  hasStore(name: string): boolean {
    return this.stores.has(name)
  }

  // ============================================================================
  // Action Coordination
  // ============================================================================

  /**
   * Execute a sequence of coordinated actions
   */
  async executeSequence(sequence: ActionSequence): Promise<CoordinationResult> {
    const startTime = performance.now()
    const result: CoordinationResult = {
      success: true,
      results: [],
      errors: [],
      duration: 0,
      actionsExecuted: 0
    }

    if (this.options.enableLogging) {
      logger.debug('Executing action sequence', { 
        sequenceId: sequence.id,
        actionCount: sequence.actions.length,
        parallel: sequence.parallel 
      })
    }

    try {
      if (sequence.parallel) {
        await this.executeParallelActions(sequence, result)
      } else {
        await this.executeSequentialActions(sequence, result)
      }

      result.success = result.errors.length === 0

    } catch (error) {
      result.success = false
      result.errors.push(error as Error)
      
      if (sequence.rollbackOnError) {
        await this.rollbackSequence(sequence, result)
      }
    }

    result.duration = performance.now() - startTime

    // Record performance metrics
    if (this.options.enablePerformanceMonitoring) {
      performanceMonitor.recordMetric('coordinator_sequence_duration', result.duration)
      performanceMonitor.recordMetric('coordinator_actions_executed', result.actionsExecuted)
      performanceMonitor.recordMetric('coordinator_sequence_success', result.success ? 1 : 0)
    }

    // Store in history
    this.actionHistory.push({ sequence, result })
    if (this.actionHistory.length > 100) {
      this.actionHistory = this.actionHistory.slice(-50)
    }

    // Emit completion event
    if (this.options.enableEventIntegration) {
      globalEventBus.emit('coordinator:sequence:completed', {
        sequenceId: sequence.id,
        success: result.success,
        duration: result.duration,
        actionsExecuted: result.actionsExecuted
      }, 'coordinator')
    }

    return result
  }

  /**
   * Execute actions in parallel
   */
  private async executeParallelActions(
    sequence: ActionSequence, 
    result: CoordinationResult
  ): Promise<void> {
    const promises = sequence.actions.map(async (action, index) => {
      try {
        if (action.condition && !action.condition()) {
          return { index, result: null, skipped: true }
        }

        const store = this.getStore(action.store)
        if (!store) {
          throw new Error(`Store '${action.store}' not found`)
        }

        const actionResult = await action.action()
        result.actionsExecuted++
        
        return { index, result: actionResult, skipped: false }
      } catch (error) {
        result.errors.push(error as Error)
        return { index, result: null, error: error as Error }
      }
    })

    const results = await Promise.allSettled(promises)
    
    results.forEach((promiseResult, index) => {
      if (promiseResult.status === 'fulfilled') {
        result.results[index] = promiseResult.value.result
      } else {
        result.errors.push(promiseResult.reason)
      }
    })
  }

  /**
   * Execute actions sequentially
   */
  private async executeSequentialActions(
    sequence: ActionSequence, 
    result: CoordinationResult
  ): Promise<void> {
    // Sort actions by priority (higher priority first)
    const sortedActions = [...sequence.actions].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

    for (const action of sortedActions) {
      try {
        // Check condition
        if (action.condition && !action.condition()) {
          result.results.push(null) // Placeholder for skipped action
          continue
        }

        // Get store
        const store = this.getStore(action.store)
        if (!store) {
          throw new Error(`Store '${action.store}' not found`)
        }

        // Execute action
        const actionResult = await action.action()
        result.results.push(actionResult)
        result.actionsExecuted++

        if (this.options.enableLogging) {
          logger.debug('Action executed', { 
            actionName: action.name,
            storeName: action.store,
            sequenceId: sequence.id
          })
        }

      } catch (error) {
        result.errors.push(error as Error)
        
        if (sequence.rollbackOnError) {
          break // Stop execution for rollback
        }
      }
    }
  }

  /**
   * Rollback a sequence of actions
   */
  private async rollbackSequence(
    sequence: ActionSequence, 
    result: CoordinationResult
  ): Promise<void> {
    if (this.options.enableLogging) {
      logger.info('Rolling back action sequence', { sequenceId: sequence.id })
    }

    const rollbackActions = sequence.actions
      .filter(action => action.rollback)
      .reverse() // Rollback in reverse order

    for (const action of rollbackActions) {
      try {
        if (action.rollback) {
          await action.rollback()
        }
      } catch (rollbackError) {
        logger.error('Rollback action failed', {
          actionName: action.name,
          error: rollbackError,
          sequenceId: sequence.id
        })
      }
    }

    // Emit rollback event
    if (this.options.enableEventIntegration) {
      globalEventBus.emit('coordinator:sequence:rolledback', {
        sequenceId: sequence.id,
        actionsRolledBack: rollbackActions.length
      }, 'coordinator')
    }
  }

  // ============================================================================
  // Store Synchronization
  // ============================================================================

  /**
   * Subscribe to changes across multiple stores
   */
  subscribeToStores(subscriptions: StoreSubscription[]): () => void {
    const cleanupFunctions: Array<() => void> = []

    subscriptions.forEach(subscription => {
      const store = this.getStore(subscription.store)
      if (!store) {
        logger.warn('Cannot subscribe to non-existent store', { storeName: subscription.store })
        return
      }

      let previousValue = subscription.selector(store.getState())

      const unsubscribe = store.subscribe((state) => {
        const currentValue = subscription.selector(state)
        
        if (currentValue !== previousValue) {
          subscription.handler(currentValue, previousValue)
          previousValue = currentValue
        }
      })

      cleanupFunctions.push(unsubscribe)

      // Store subscription for cleanup
      if (!this.subscriptions.has(subscription.store)) {
        this.subscriptions.set(subscription.store, [])
      }
      this.subscriptions.get(subscription.store)!.push(subscription)
    })

    // Return cleanup function
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup())
      
      // Remove from stored subscriptions
      subscriptions.forEach(subscription => {
        const storeSubscriptions = this.subscriptions.get(subscription.store)
        if (storeSubscriptions) {
          const index = storeSubscriptions.indexOf(subscription)
          if (index > -1) {
            storeSubscriptions.splice(index, 1)
          }
        }
      })
    }
  }

  /**
   * Synchronize state between stores
   */
  synchronizeStores<T>(
    sourceStore: string,
    targetStore: string,
    sourceSelector: (state: any) => T,
    targetAction: (value: T) => void,
    options: { immediate?: boolean; debounceMs?: number } = {}
  ): () => void {
    const store = this.getStore(sourceStore)
    if (!store) {
      throw new Error(`Source store '${sourceStore}' not found`)
    }

    const targetStoreInstance = this.getStore(targetStore)
    if (!targetStoreInstance) {
      throw new Error(`Target store '${targetStore}' not found`)
    }

    let timeoutId: NodeJS.Timeout | null = null
    let previousValue = sourceSelector(store.getState())

    // Initial synchronization
    if (options.immediate) {
      targetAction(previousValue)
    }

    const unsubscribe = store.subscribe((state) => {
      const currentValue = sourceSelector(state)
      
      if (currentValue !== previousValue) {
        previousValue = currentValue

        if (options.debounceMs && options.debounceMs > 0) {
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
          timeoutId = setTimeout(() => {
            targetAction(currentValue)
          }, options.debounceMs)
        } else {
          targetAction(currentValue)
        }
      }
    })

    return () => {
      unsubscribe()
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get action execution history
   */
  getActionHistory(limit = 50): Array<{ sequence: ActionSequence; result: CoordinationResult }> {
    return this.actionHistory.slice(-limit)
  }

  /**
   * Clear action history
   */
  clearActionHistory(): void {
    this.actionHistory = []
    if (this.options.enableLogging) {
      logger.debug('Action history cleared')
    }
  }

  /**
   * Get registered store names
   */
  getRegisteredStores(): string[] {
    return Array.from(this.stores.keys())
  }

  /**
   * Cleanup subscriptions for a specific store
   */
  private cleanupStoreSubscriptions(storeName: string): void {
    const storeSubscriptions = this.subscriptions.get(storeName)
    if (storeSubscriptions) {
      storeSubscriptions.forEach(subscription => {
        if (subscription.cleanup) {
          subscription.cleanup()
        }
      })
      this.subscriptions.delete(storeName)
    }
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    // Cleanup all subscriptions
    for (const storeName of this.stores.keys()) {
      this.cleanupStoreSubscriptions(storeName)
    }

    // Clear stores
    this.stores.clear()
    this.subscriptions.clear()
    this.actionHistory = []

    if (this.options.enableLogging) {
      logger.info('StoreCoordinator destroyed')
    }
  }
}

// ============================================================================
// Global Coordinator Instance
// ============================================================================

export const globalCoordinator = new StoreCoordinator({
  enableLogging: process.env.NODE_ENV === 'development',
  enablePerformanceMonitoring: true,
  enableEventIntegration: true,
  maxConcurrentActions: 15
})

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Register a store with the global coordinator
 */
export const registerStore = <T>(name: string, store: StoreApi<T>): void => {
  globalCoordinator.registerStore(name, store)
}

/**
 * Execute a coordinated action sequence
 */
export const executeSequence = (sequence: ActionSequence): Promise<CoordinationResult> => {
  return globalCoordinator.executeSequence(sequence)
}

/**
 * Create a coordinated action sequence
 */
export const createSequence = (
  id: string,
  actions: CoordinatedAction[],
  options: { parallel?: boolean; rollbackOnError?: boolean } = {}
): ActionSequence => {
  return {
    id,
    actions,
    parallel: options.parallel ?? false,
    rollbackOnError: options.rollbackOnError ?? true
  }
}

/**
 * Subscribe to multiple stores
 */
export const subscribeToStores = (subscriptions: StoreSubscription[]): (() => void) => {
  return globalCoordinator.subscribeToStores(subscriptions)
}

/**
 * Synchronize state between stores
 */
export const synchronizeStores = <T>(
  sourceStore: string,
  targetStore: string,
  sourceSelector: (state: any) => T,
  targetAction: (value: T) => void,
  options?: { immediate?: boolean; debounceMs?: number }
): (() => void) => {
  return globalCoordinator.synchronizeStores(
    sourceStore,
    targetStore,
    sourceSelector,
    targetAction,
    options
  )
}

// ============================================================================
// React Hook for Store Coordination
// ============================================================================

import { useEffect, useRef } from 'react'

/**
 * React hook for coordinating multiple store actions
 */
export const useStoreCoordination = () => {
  const coordinatorRef = useRef<StoreCoordinator>()

  if (!coordinatorRef.current) {
    coordinatorRef.current = new StoreCoordinator({
      enableLogging: process.env.NODE_ENV === 'development',
      enablePerformanceMonitoring: true,
      enableEventIntegration: true
    })
  }

  useEffect(() => {
    return () => {
      if (coordinatorRef.current) {
        coordinatorRef.current.destroy()
      }
    }
  }, [])

  return coordinatorRef.current
}

/**
 * React hook for subscribing to multiple stores
 */
export const useMultiStoreSubscription = (subscriptions: StoreSubscription[]) => {
  useEffect(() => {
    const cleanup = globalCoordinator.subscribeToStores(subscriptions)
    return cleanup
  }, [subscriptions])
}

/**
 * React hook for store synchronization
 */
export const useStoreSynchronization = <T>(
  sourceStore: string,
  targetStore: string,
  sourceSelector: (state: any) => T,
  targetAction: (value: T) => void,
  options?: { immediate?: boolean; debounceMs?: number }
) => {
  useEffect(() => {
    const cleanup = globalCoordinator.synchronizeStores(
      sourceStore,
      targetStore,
      sourceSelector,
      targetAction,
      options
    )
    return cleanup
  }, [sourceStore, targetStore, sourceSelector, targetAction, options])
} 