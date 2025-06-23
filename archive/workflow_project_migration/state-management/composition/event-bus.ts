/**
 * Store Event Bus System
 * 
 * Provides event-driven communication between stores while maintaining loose coupling.
 * Supports typed events, performance monitoring, and automatic cleanup.
 */

import { logger } from '../debug/logger'
import { performanceMonitor } from '../debug/performance-monitor'

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface StoreEvent<T = any> {
  type: string
  payload?: T
  timestamp: number
  source: string
  id: string
  metadata?: Record<string, any>
}

export interface EventListener<T = any> {
  handler: (event: StoreEvent<T>) => void | Promise<void>
  once?: boolean
  priority?: number
  source?: string
}

export interface EventBusOptions {
  maxListeners?: number
  enableLogging?: boolean
  enablePerformanceMonitoring?: boolean
  debounceMs?: number
  enableErrorRecovery?: boolean
}

export interface EventBusStats {
  totalEvents: number
  totalListeners: number
  eventTypes: string[]
  averageProcessingTime: number
  errorCount: number
  lastEventTime: number
}

// ============================================================================
// Event Bus Implementation
// ============================================================================

export class StoreEventBus {
  private listeners = new Map<string, Set<EventListener>>()
  private wildcardListeners = new Set<EventListener>()
  private eventHistory: StoreEvent[] = []
  private stats: EventBusStats = {
    totalEvents: 0,
    totalListeners: 0,
    eventTypes: [],
    averageProcessingTime: 0,
    errorCount: 0,
    lastEventTime: 0
  }
  
  private options: Required<EventBusOptions>
  private debounceTimers = new Map<string, NodeJS.Timeout>()
  private processingTimes: number[] = []

  constructor(options: EventBusOptions = {}) {
    this.options = {
      maxListeners: options.maxListeners ?? 100,
      enableLogging: options.enableLogging ?? true,
      enablePerformanceMonitoring: options.enablePerformanceMonitoring ?? true,
      debounceMs: options.debounceMs ?? 0,
      enableErrorRecovery: options.enableErrorRecovery ?? true
    }

    if (this.options.enableLogging) {
      logger.info('StoreEventBus initialized', { options: this.options })
    }
  }

  // ============================================================================
  // Event Emission
  // ============================================================================

  /**
   * Emit an event to all registered listeners
   */
  emit<T = any>(type: string, payload?: T, source = 'unknown'): void {
    const event: StoreEvent<T> = {
      type,
      payload,
      timestamp: Date.now(),
      source,
      id: this.generateEventId(),
      metadata: {}
    }

    if (this.options.debounceMs > 0) {
      this.emitDebounced(event)
    } else {
      this.emitImmediate(event)
    }
  }

  /**
   * Emit event with debouncing
   */
  private emitDebounced<T>(event: StoreEvent<T>): void {
    const key = `${event.type}:${event.source}`
    
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key)!)
    }

    const timer = setTimeout(() => {
      this.emitImmediate(event)
      this.debounceTimers.delete(key)
    }, this.options.debounceMs)

    this.debounceTimers.set(key, timer)
  }

  /**
   * Emit event immediately
   */
  private emitImmediate<T>(event: StoreEvent<T>): void {
    const startTime = performance.now()

    try {
      // Update statistics
      this.updateStats(event)

      // Log event if enabled
      if (this.options.enableLogging) {
        logger.debug('Event emitted', { 
          type: event.type, 
          source: event.source,
          payload: event.payload 
        })
      }

      // Store in history
      this.addToHistory(event)

      // Notify specific listeners
      const typeListeners = this.listeners.get(event.type)
      if (typeListeners) {
        this.notifyListeners(Array.from(typeListeners), event)
      }

      // Notify wildcard listeners
      if (this.wildcardListeners.size > 0) {
        this.notifyListeners(Array.from(this.wildcardListeners), event)
      }

      // Record performance
      if (this.options.enablePerformanceMonitoring) {
        const processingTime = performance.now() - startTime
        this.recordProcessingTime(processingTime)
        
        performanceMonitor.recordMetric('event_bus_processing_time', processingTime)
        performanceMonitor.recordMetric('event_bus_events_emitted', 1)
      }

    } catch (error) {
      this.handleError(error, event)
    }
  }

  // ============================================================================
  // Event Listening
  // ============================================================================

  /**
   * Register an event listener
   */
  on<T = any>(
    type: string, 
    handler: (event: StoreEvent<T>) => void | Promise<void>,
    options: Partial<EventListener> = {}
  ): () => void {
    const listener: EventListener<T> = {
      handler,
      once: options.once ?? false,
      priority: options.priority ?? 0,
      source: options.source
    }

    // Check listener limits
    if (this.getTotalListenerCount() >= this.options.maxListeners) {
      logger.warn('Maximum listeners reached', { 
        maxListeners: this.options.maxListeners,
        currentCount: this.getTotalListenerCount()
      })
      return () => {} // Return no-op cleanup function
    }

    // Handle wildcard listeners
    if (type === '*') {
      this.wildcardListeners.add(listener)
      this.stats.totalListeners++
      
      return () => {
        this.wildcardListeners.delete(listener)
        this.stats.totalListeners--
      }
    }

    // Handle specific type listeners
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }

    const typeListeners = this.listeners.get(type)!
    typeListeners.add(listener)
    this.stats.totalListeners++

    // Update event types
    if (!this.stats.eventTypes.includes(type)) {
      this.stats.eventTypes.push(type)
    }

    if (this.options.enableLogging) {
      logger.debug('Event listener registered', { 
        type, 
        listenerCount: typeListeners.size,
        source: listener.source 
      })
    }

    // Return cleanup function
    return () => {
      typeListeners.delete(listener)
      this.stats.totalListeners--
      
      if (typeListeners.size === 0) {
        this.listeners.delete(type)
        this.stats.eventTypes = this.stats.eventTypes.filter(t => t !== type)
      }
    }
  }

  /**
   * Register a one-time event listener
   */
  once<T = any>(
    type: string, 
    handler: (event: StoreEvent<T>) => void | Promise<void>,
    options: Partial<EventListener> = {}
  ): () => void {
    return this.on(type, handler, { ...options, once: true })
  }

  /**
   * Remove all listeners for a specific event type
   */
  off(type: string): void {
    if (type === '*') {
      const count = this.wildcardListeners.size
      this.wildcardListeners.clear()
      this.stats.totalListeners -= count
    } else {
      const typeListeners = this.listeners.get(type)
      if (typeListeners) {
        this.stats.totalListeners -= typeListeners.size
        this.listeners.delete(type)
        this.stats.eventTypes = this.stats.eventTypes.filter(t => t !== type)
      }
    }

    if (this.options.enableLogging) {
      logger.debug('Event listeners removed', { type })
    }
  }

  // ============================================================================
  // Listener Notification
  // ============================================================================

  /**
   * Notify listeners of an event
   */
  private async notifyListeners<T>(listeners: EventListener<T>[], event: StoreEvent<T>): Promise<void> {
    // Sort by priority (higher priority first)
    const sortedListeners = listeners.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

    for (const listener of sortedListeners) {
      try {
        // Check if listener should be removed after execution
        if (listener.once) {
          this.removeListener(event.type, listener)
        }

        // Execute handler
        const result = listener.handler(event)
        
        // Handle async handlers
        if (result instanceof Promise) {
          await result
        }

      } catch (error) {
        this.handleListenerError(error, listener, event)
      }
    }
  }

  /**
   * Remove a specific listener
   */
  private removeListener<T>(type: string, listener: EventListener<T>): void {
    if (type === '*') {
      this.wildcardListeners.delete(listener)
    } else {
      const typeListeners = this.listeners.get(type)
      if (typeListeners) {
        typeListeners.delete(listener)
        if (typeListeners.size === 0) {
          this.listeners.delete(type)
          this.stats.eventTypes = this.stats.eventTypes.filter(t => t !== type)
        }
      }
    }
    this.stats.totalListeners--
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get current event bus statistics
   */
  getStats(): EventBusStats {
    return { ...this.stats }
  }

  /**
   * Get event history
   */
  getHistory(limit = 100): StoreEvent[] {
    return this.eventHistory.slice(-limit)
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = []
    if (this.options.enableLogging) {
      logger.debug('Event history cleared')
    }
  }

  /**
   * Get total listener count
   */
  private getTotalListenerCount(): number {
    let count = this.wildcardListeners.size
    for (const listeners of this.listeners.values()) {
      count += listeners.size
    }
    return count
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Update statistics
   */
  private updateStats(event: StoreEvent): void {
    this.stats.totalEvents++
    this.stats.lastEventTime = event.timestamp
  }

  /**
   * Add event to history
   */
  private addToHistory(event: StoreEvent): void {
    this.eventHistory.push(event)
    
    // Limit history size
    if (this.eventHistory.length > 1000) {
      this.eventHistory = this.eventHistory.slice(-500)
    }
  }

  /**
   * Record processing time for performance monitoring
   */
  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time)
    
    // Keep only last 100 measurements
    if (this.processingTimes.length > 100) {
      this.processingTimes = this.processingTimes.slice(-50)
    }

    // Update average
    this.stats.averageProcessingTime = 
      this.processingTimes.reduce((sum, t) => sum + t, 0) / this.processingTimes.length
  }

  /**
   * Handle general errors
   */
  private handleError(error: any, event: StoreEvent): void {
    this.stats.errorCount++
    
    logger.error('Event bus error', { 
      error: error.message,
      event: { type: event.type, source: event.source },
      stack: error.stack
    })

    if (this.options.enableErrorRecovery) {
      // Attempt to continue processing
      logger.info('Attempting error recovery for event bus')
    }
  }

  /**
   * Handle listener-specific errors
   */
  private handleListenerError(error: any, listener: EventListener, event: StoreEvent): void {
    this.stats.errorCount++
    
    logger.error('Event listener error', {
      error: error.message,
      event: { type: event.type, source: event.source },
      listener: { source: listener.source },
      stack: error.stack
    })
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    // Clear all timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()

    // Clear all listeners
    this.listeners.clear()
    this.wildcardListeners.clear()

    // Clear history
    this.eventHistory = []

    // Reset stats
    this.stats = {
      totalEvents: 0,
      totalListeners: 0,
      eventTypes: [],
      averageProcessingTime: 0,
      errorCount: 0,
      lastEventTime: 0
    }

    if (this.options.enableLogging) {
      logger.info('StoreEventBus destroyed')
    }
  }
}

// ============================================================================
// Global Event Bus Instance
// ============================================================================

export const globalEventBus = new StoreEventBus({
  maxListeners: 200,
  enableLogging: process.env.NODE_ENV === 'development',
  enablePerformanceMonitoring: true,
  debounceMs: 10,
  enableErrorRecovery: true
})

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Emit a global event
 */
export const emit = <T = any>(type: string, payload?: T, source = 'global'): void => {
  globalEventBus.emit(type, payload, source)
}

/**
 * Listen to global events
 */
export const on = <T = any>(
  type: string, 
  handler: (event: StoreEvent<T>) => void | Promise<void>,
  options?: Partial<EventListener>
): (() => void) => {
  return globalEventBus.on(type, handler, options)
}

/**
 * Listen to global events once
 */
export const once = <T = any>(
  type: string, 
  handler: (event: StoreEvent<T>) => void | Promise<void>,
  options?: Partial<EventListener>
): (() => void) => {
  return globalEventBus.once(type, handler, options)
}

/**
 * Remove global event listeners
 */
export const off = (type: string): void => {
  globalEventBus.off(type)
}

// ============================================================================
// Event Types for Type Safety
// ============================================================================

export interface SystemEvents {
  'cache:invalidate': { key: string; reason: string }
  'cache:clear': { scope?: string }
  'auth:login': { userId: string; timestamp: number }
  'auth:logout': { userId: string; reason: string }
  'workflow:created': { workflowId: string; templateId: string }
  'workflow:updated': { workflowId: string; changes: string[] }
  'workflow:completed': { workflowId: string; duration: number }
  'ui:modal:open': { modalId: string; props?: any }
  'ui:modal:close': { modalId: string }
  'ui:notification:show': { type: string; message: string }
  'debug:performance:warning': { metric: string; value: number }
  'debug:error:occurred': { error: string; context: any }
}

/**
 * Type-safe event emission
 */
export const emitTyped = <K extends keyof SystemEvents>(
  type: K,
  payload: SystemEvents[K],
  source = 'system'
): void => {
  globalEventBus.emit(type, payload, source)
}

/**
 * Type-safe event listening
 */
export const onTyped = <K extends keyof SystemEvents>(
  type: K,
  handler: (event: StoreEvent<SystemEvents[K]>) => void | Promise<void>,
  options?: Partial<EventListener>
): (() => void) => {
  return globalEventBus.on(type, handler, options)
} 