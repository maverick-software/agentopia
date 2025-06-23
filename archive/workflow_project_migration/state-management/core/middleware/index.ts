/**
 * State Management Middleware Module
 * 
 * Comprehensive middleware collection for Zustand stores including
 * persistence, performance monitoring, validation, and more.
 */

import type {
  StateCreator,
  StoreApi,
  StoreMiddleware,
  BaseState,
  LogEntry,
  PerformanceMetric,
  AppError,
} from '../types';

// ============================================================================
// Advanced Persistence Middleware
// ============================================================================

export {
  // Main persistence middleware
  persist,
  
  // Utility functions
  createPersistenceConfig,
  createSelectivePersistence,
  createTemporaryPersistence,
  createLargeDataPersistence,
  
  // Types
  type PersistenceConfig,
  type PersistenceState,
  type PersistenceAPI,
  type StorageAdapter,
  type StorageEngine
} from './persistence'

// ============================================================================
// Core Middleware (from store-middleware.ts)
// ============================================================================

export {
  // Middleware types
  type StoreMiddleware,
  
  // Logging middleware
  createLoggingMiddleware,
  
  // Performance middleware
  createPerformanceMiddleware,
  
  // Error handling middleware
  createErrorHandlingMiddleware,
  
  // Validation middleware
  createValidationMiddleware,
  
  // Throttle middleware
  createThrottleMiddleware,
  
  // Debounce middleware
  createDebounceMiddleware,
  
  // Simple persistence middleware (legacy)
  createPersistenceMiddleware
} from '../store-middleware'

// ============================================================================
// Middleware Composition Utilities
// ============================================================================

/**
 * Compose multiple middleware functions into a single middleware
 */
export const composeMiddleware = <T>(...middlewares: StoreMiddleware<T>[]): StoreMiddleware<T> => {
  return (config) => {
    return middlewares.reduceRight(
      (acc, middleware) => middleware(acc),
      config
    )
  }
}

/**
 * Create a middleware pipeline with conditional application
 */
export const createMiddlewarePipeline = <T>(
  middlewares: Array<{
    middleware: StoreMiddleware<T>
    condition?: () => boolean
  }>
): StoreMiddleware<T> => {
  return (config) => {
    const applicableMiddlewares = middlewares
      .filter(({ condition }) => !condition || condition())
      .map(({ middleware }) => middleware)
    
    return composeMiddleware(...applicableMiddlewares)(config)
  }
}

/**
 * Common middleware configurations for different use cases
 */
export const middlewarePresets = {
  /**
   * Development preset with full debugging capabilities
   */
  development: <T>(storeName: string): StoreMiddleware<T> => 
    composeMiddleware(
      createLoggingMiddleware({ 
        enabled: true, 
        logLevel: 'debug',
        prefix: `[${storeName}]`
      }),
      createPerformanceMiddleware({ 
        enabled: true, 
        threshold: 10,
        storeName 
      }),
      createErrorHandlingMiddleware({ 
        storeName,
        useGlobalLogger: true 
      })
    ),

  /**
   * Production preset with minimal overhead
   */
  production: <T>(storeName: string): StoreMiddleware<T> => 
    composeMiddleware(
      createErrorHandlingMiddleware({ 
        storeName,
        useGlobalLogger: false 
      }),
      createPerformanceMiddleware({ 
        enabled: false,
        storeName 
      })
    ),

  /**
   * Persistent store preset with localStorage
   */
  persistent: <T>(storeName: string, persistenceKey: string): StoreMiddleware<T> => 
    composeMiddleware(
      createLoggingMiddleware({ 
        enabled: true,
        prefix: `[${storeName}]`
      }),
      createErrorHandlingMiddleware({ 
        storeName,
        useGlobalLogger: true 
      }),
      createPersistenceMiddleware(persistenceKey, {
        storage: 'localStorage',
        storeName
      })
    ),

  /**
   * High-performance preset with throttling
   */
  highPerformance: <T>(storeName: string): StoreMiddleware<T> => 
    composeMiddleware(
      createThrottleMiddleware(50, { 
        storeName,
        leading: true,
        trailing: true 
      }),
      createPerformanceMiddleware({ 
        enabled: true,
        threshold: 5,
        storeName 
      }),
      createErrorHandlingMiddleware({ 
        storeName 
      })
    )
}

// ============================================================================
// Re-export Types
// ============================================================================

export type { StoreMiddleware } from '../store-middleware'

// ============================================================================
// CORE MIDDLEWARE TYPES
// ============================================================================

/**
 * Middleware context provides access to store metadata and utilities
 */
export interface MiddlewareContext<T> {
  storeName: string;
  storeId: string;
  timestamp: number;
  metadata: Record<string, any>;
  logger: MiddlewareLogger;
  performance: PerformanceTracker;
}

/**
 * Middleware logger interface
 */
export interface MiddlewareLogger {
  debug(message: string, metadata?: any): void;
  info(message: string, metadata?: any): void;
  warn(message: string, metadata?: any): void;
  error(message: string, error?: Error, metadata?: any): void;
}

/**
 * Performance tracker interface
 */
export interface PerformanceTracker {
  start(operation: string): string; // Returns operation ID
  end(operationId: string, metadata?: any): number; // Returns duration
  measure<T>(operation: string, fn: () => T): T;
  measureAsync<T>(operation: string, fn: () => Promise<T>): Promise<T>;
}

/**
 * Enhanced middleware function with context
 */
export type EnhancedMiddleware<T = any> = (
  context: MiddlewareContext<T>
) => StoreMiddleware<T>;

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  name: string;
  enabled?: boolean;
  priority?: number; // Higher priority = applied later (closer to store)
  dependencies?: string[]; // Names of middleware this depends on
  options?: Record<string, any>;
}

/**
 * Middleware registry entry
 */
export interface MiddlewareRegistryEntry<T = any> {
  config: MiddlewareConfig;
  factory: EnhancedMiddleware<T>;
  instance?: StoreMiddleware<T>;
}

// ============================================================================
// MIDDLEWARE REGISTRY
// ============================================================================

/**
 * Global middleware registry for managing and composing middleware
 */
export class MiddlewareRegistry {
  private middleware = new Map<string, MiddlewareRegistryEntry>();
  private logger: MiddlewareLogger;

  constructor(logger?: MiddlewareLogger) {
    this.logger = logger || this.createDefaultLogger();
  }

  /**
   * Register a middleware factory
   */
  register<T>(
    config: MiddlewareConfig,
    factory: EnhancedMiddleware<T>
  ): void {
    if (this.middleware.has(config.name)) {
      this.logger.warn(`Middleware '${config.name}' is already registered. Overwriting.`);
    }

    this.middleware.set(config.name, {
      config: { enabled: true, priority: 0, ...config },
      factory,
    });

    this.logger.debug(`Registered middleware: ${config.name}`);
  }

  /**
   * Unregister a middleware
   */
  unregister(name: string): boolean {
    const removed = this.middleware.delete(name);
    if (removed) {
      this.logger.debug(`Unregistered middleware: ${name}`);
    }
    return removed;
  }

  /**
   * Get middleware configuration
   */
  getConfig(name: string): MiddlewareConfig | null {
    const entry = this.middleware.get(name);
    return entry ? entry.config : null;
  }

  /**
   * Update middleware configuration
   */
  updateConfig(name: string, updates: Partial<MiddlewareConfig>): boolean {
    const entry = this.middleware.get(name);
    if (!entry) return false;

    entry.config = { ...entry.config, ...updates };
    entry.instance = undefined; // Force recreation
    this.logger.debug(`Updated middleware config: ${name}`);
    return true;
  }

  /**
   * Compose middleware for a store
   */
  compose<T extends BaseState>(
    storeName: string,
    requestedMiddleware?: string[]
  ): StoreMiddleware<T>[] {
    // Get all enabled middleware or requested subset
    const enabledMiddleware = Array.from(this.middleware.entries())
      .filter(([name, entry]) => {
        if (!entry.config.enabled) return false;
        if (requestedMiddleware && !requestedMiddleware.includes(name)) return false;
        return true;
      })
      .map(([name, entry]) => ({ name, ...entry }));

    // Sort by priority (higher priority = applied later)
    enabledMiddleware.sort((a, b) => a.config.priority! - b.config.priority!);

    // Check dependencies
    this.validateDependencies(enabledMiddleware);

    // Create middleware instances
    const context = this.createContext<T>(storeName);
    const instances: StoreMiddleware<T>[] = [];

    for (const { name, config, factory } of enabledMiddleware) {
      try {
        const instance = factory(context);
        instances.push(instance);
        this.logger.debug(`Composed middleware: ${name} for store: ${storeName}`);
      } catch (error) {
        this.logger.error(`Failed to compose middleware: ${name}`, error as Error);
        throw new Error(`Middleware composition failed: ${name}`);
      }
    }

    return instances;
  }

  /**
   * List all registered middleware
   */
  list(): MiddlewareConfig[] {
    return Array.from(this.middleware.values()).map(entry => entry.config);
  }

  /**
   * Clear all middleware
   */
  clear(): void {
    this.middleware.clear();
    this.logger.debug('Cleared all middleware');
  }

  private validateDependencies(middleware: Array<{ name: string; config: MiddlewareConfig }>): void {
    const availableNames = new Set(middleware.map(m => m.name));

    for (const { name, config } of middleware) {
      if (config.dependencies) {
        for (const dep of config.dependencies) {
          if (!availableNames.has(dep)) {
            throw new Error(`Middleware '${name}' depends on '${dep}' which is not available`);
          }
        }
      }
    }
  }

  private createContext<T>(storeName: string): MiddlewareContext<T> {
    return {
      storeName,
      storeId: `${storeName}-${Date.now()}`,
      timestamp: Date.now(),
      metadata: {},
      logger: this.logger,
      performance: this.createPerformanceTracker(),
    };
  }

  private createDefaultLogger(): MiddlewareLogger {
    return {
      debug: (message, metadata) => console.debug(`[Middleware] ${message}`, metadata),
      info: (message, metadata) => console.info(`[Middleware] ${message}`, metadata),
      warn: (message, metadata) => console.warn(`[Middleware] ${message}`, metadata),
      error: (message, error, metadata) => console.error(`[Middleware] ${message}`, error, metadata),
    };
  }

  private createPerformanceTracker(): PerformanceTracker {
    const operations = new Map<string, number>();

    return {
      start: (operation) => {
        const id = `${operation}-${Date.now()}-${Math.random()}`;
        operations.set(id, performance.now());
        return id;
      },
      end: (operationId, metadata) => {
        const startTime = operations.get(operationId);
        if (!startTime) return 0;
        
        const duration = performance.now() - startTime;
        operations.delete(operationId);
        return duration;
      },
      measure: <T>(operation: string, fn: () => T): T => {
        const start = performance.now();
        try {
          return fn();
        } finally {
          const duration = performance.now() - start;
          console.debug(`[Performance] ${operation}: ${duration.toFixed(2)}ms`);
        }
      },
      measureAsync: async <T>(operation: string, fn: () => Promise<T>): Promise<T> => {
        const start = performance.now();
        try {
          return await fn();
        } finally {
          const duration = performance.now() - start;
          console.debug(`[Performance] ${operation}: ${duration.toFixed(2)}ms`);
        }
      },
    };
  }
}

// ============================================================================
// BUILT-IN MIDDLEWARE FACTORIES
// ============================================================================

/**
 * Creates a comprehensive logging middleware
 */
export function createAdvancedLoggingMiddleware<T>(
  options: {
    enabled?: boolean;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    includeState?: boolean;
    includeDiff?: boolean;
    maxStateSize?: number;
    filter?: (action: any, state: T) => boolean;
  } = {}
): EnhancedMiddleware<T> {
  return (context) => {
    const {
      enabled = process.env.NODE_ENV === 'development',
      logLevel = 'debug',
      includeState = true,
      includeDiff = false,
      maxStateSize = 1000,
      filter,
    } = options;

    return (config) => (set, get, api) => {
      if (!enabled) return config(set, get, api);

      const loggedSet = (...args: any[]) => {
        const prevState = get();
        const startTime = performance.now();
        
        try {
          const result = set(...args);
          const nextState = get();
          const duration = performance.now() - startTime;

          // Apply filter if provided
          if (filter && !filter(args[0], nextState)) {
            return result;
          }

          const logData: any = {
            store: context.storeName,
            duration: `${duration.toFixed(2)}ms`,
            timestamp: new Date().toISOString(),
          };

          if (includeState) {
            const stateStr = JSON.stringify(nextState);
            if (stateStr.length <= maxStateSize) {
              logData.state = nextState;
            } else {
              logData.state = '[State too large to log]';
              logData.stateSize = stateStr.length;
            }
          }

          if (includeDiff && prevState !== nextState) {
            logData.diff = this.createStateDiff(prevState, nextState);
          }

          context.logger[logLevel]('State updated', logData);
          return result;
        } catch (error) {
          context.logger.error('State update failed', error as Error, {
            store: context.storeName,
            args,
          });
          throw error;
        }
      };

      return config(loggedSet, get, api);
    };
  };
}

/**
 * Creates a performance monitoring middleware
 */
export function createPerformanceMiddleware<T>(
  options: {
    enabled?: boolean;
    threshold?: number;
    trackMemory?: boolean;
    onSlowUpdate?: (metric: PerformanceMetric) => void;
    onMemoryLeak?: (usage: number) => void;
  } = {}
): EnhancedMiddleware<T> {
  return (context) => {
    const {
      enabled = true,
      threshold = 16,
      trackMemory = false,
      onSlowUpdate,
      onMemoryLeak,
    } = options;

    let updateCount = 0;
    let totalDuration = 0;
    let memoryBaseline: number | null = null;

    return (config) => (set, get, api) => {
      if (!enabled) return config(set, get, api);

      const performantSet = (...args: any[]) => {
        const operationId = context.performance.start('state-update');
        
        try {
          const result = set(...args);
          const duration = context.performance.end(operationId);
          
          updateCount++;
          totalDuration += duration;

          // Track slow updates
          if (duration > threshold) {
            const metric: PerformanceMetric = {
              operation: 'state-update',
              duration,
              timestamp: Date.now(),
              metadata: {
                store: context.storeName,
                updateCount,
                averageDuration: totalDuration / updateCount,
              },
            };

            context.logger.warn(`Slow state update detected: ${duration.toFixed(2)}ms`, metric);
            
            if (onSlowUpdate) {
              onSlowUpdate(metric);
            }
          }

          // Track memory usage
          if (trackMemory && (performance as any).memory) {
            const memoryUsage = (performance as any).memory.usedJSHeapSize;
            
            if (memoryBaseline === null) {
              memoryBaseline = memoryUsage;
            } else {
              const memoryIncrease = memoryUsage - memoryBaseline;
              const memoryThreshold = 50 * 1024 * 1024; // 50MB
              
              if (memoryIncrease > memoryThreshold && onMemoryLeak) {
                onMemoryLeak(memoryUsage);
              }
            }
          }

          return result;
        } catch (error) {
          context.performance.end(operationId);
          throw error;
        }
      };

      return config(performantSet, get, api);
    };
  };
}

/**
 * Creates an error handling and recovery middleware
 */
export function createErrorHandlingMiddleware<T extends BaseState>(
  options: {
    enabled?: boolean;
    maxRetries?: number;
    retryDelay?: number;
    fallbackState?: Partial<T>;
    onError?: (error: AppError) => void;
    onRecovery?: (state: T) => void;
  } = {}
): EnhancedMiddleware<T> {
  return (context) => {
    const {
      enabled = true,
      maxRetries = 3,
      retryDelay = 1000,
      fallbackState,
      onError,
      onRecovery,
    } = options;

    let retryCount = 0;
    let lastError: Error | null = null;

    return (config) => (set, get, api) => {
      if (!enabled) return config(set, get, api);

      const safeSet = (...args: any[]) => {
        try {
          const result = set(...args);
          
          // Reset retry count on successful update
          if (retryCount > 0) {
            retryCount = 0;
            lastError = null;
            context.logger.info('State update recovered after retries');
            
            if (onRecovery) {
              onRecovery(get());
            }
          }
          
          return result;
        } catch (error) {
          const appError: AppError = {
            id: `error-${Date.now()}`,
            code: 'STATE_UPDATE_ERROR',
            message: (error as Error).message,
            timestamp: Date.now(),
            context: {
              store: context.storeName,
              retryCount,
              args,
            },
            stackTrace: (error as Error).stack,
            recoverable: retryCount < maxRetries,
          };

          context.logger.error('State update error', error as Error, appError);

          if (onError) {
            onError(appError);
          }

          // Attempt recovery
          if (retryCount < maxRetries) {
            retryCount++;
            lastError = error as Error;
            
            // Apply fallback state if provided
            if (fallbackState) {
              try {
                set((state: T) => ({ ...state, ...fallbackState, error: appError.message }));
                context.logger.info(`Applied fallback state (retry ${retryCount}/${maxRetries})`);
                return;
              } catch (fallbackError) {
                context.logger.error('Fallback state application failed', fallbackError as Error);
              }
            }

            // Schedule retry
            setTimeout(() => {
              context.logger.info(`Retrying state update (${retryCount}/${maxRetries})`);
              safeSet(...args);
            }, retryDelay);

            return;
          }

          // Max retries exceeded
          context.logger.error('Max retries exceeded, state update failed permanently');
          throw error;
        }
      };

      return config(safeSet, get, api);
    };
  };
}

/**
 * Creates a state validation middleware
 */
export function createValidationMiddleware<T>(
  validators: Array<{
    name: string;
    validate: (state: T) => boolean | string;
    severity: 'warning' | 'error';
  }>,
  options: {
    enabled?: boolean;
    preventInvalidUpdates?: boolean;
    onValidationError?: (errors: string[], state: T) => void;
  } = {}
): EnhancedMiddleware<T> {
  return (context) => {
    const {
      enabled = true,
      preventInvalidUpdates = false,
      onValidationError,
    } = options;

    return (config) => (set, get, api) => {
      if (!enabled) return config(set, get, api);

      const validatedSet = (...args: any[]) => {
        const prevState = get();
        
        // Apply the update
        set(...args);
        const newState = get();

        // Run validations
        const errors: string[] = [];
        const warnings: string[] = [];

        for (const validator of validators) {
          const result = validator.validate(newState);
          
          if (result !== true) {
            const message = typeof result === 'string' 
              ? result 
              : `Validation failed: ${validator.name}`;

            if (validator.severity === 'error') {
              errors.push(message);
            } else {
              warnings.push(message);
            }
          }
        }

        // Log warnings
        if (warnings.length > 0) {
          context.logger.warn('State validation warnings', {
            store: context.storeName,
            warnings,
            state: newState,
          });
        }

        // Handle errors
        if (errors.length > 0) {
          context.logger.error('State validation errors', undefined, {
            store: context.storeName,
            errors,
            state: newState,
          });

          if (onValidationError) {
            onValidationError(errors, newState);
          }

          if (preventInvalidUpdates) {
            // Revert to previous state
            set(prevState);
            throw new Error(`State validation failed: ${errors.join(', ')}`);
          }
        }
      };

      return config(validatedSet, get, api);
    };
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a simple state diff for logging
 */
function createStateDiff(prevState: any, nextState: any): any {
  const diff: any = {};
  
  for (const key in nextState) {
    if (prevState[key] !== nextState[key]) {
      diff[key] = {
        from: prevState[key],
        to: nextState[key],
      };
    }
  }
  
  return diff;
}

// ============================================================================
// GLOBAL REGISTRY INSTANCE
// ============================================================================

/**
 * Global middleware registry instance
 */
export const globalMiddlewareRegistry = new MiddlewareRegistry();

// Register built-in middleware
globalMiddlewareRegistry.register(
  { name: 'logging', priority: 10 },
  createAdvancedLoggingMiddleware()
);

globalMiddlewareRegistry.register(
  { name: 'performance', priority: 20 },
  createPerformanceMiddleware()
);

globalMiddlewareRegistry.register(
  { name: 'errorHandling', priority: 30 },
  createErrorHandlingMiddleware()
);

// ============================================================================
// EXPORTS
// ============================================================================

export {
  MiddlewareRegistry,
  createAdvancedLoggingMiddleware,
  createPerformanceMiddleware,
  createErrorHandlingMiddleware,
  createValidationMiddleware,
}; 