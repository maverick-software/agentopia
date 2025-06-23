/**
 * Core Testing Utilities
 * 
 * Comprehensive testing utilities for cache integration, store coordination,
 * and event-driven system testing based on industry best practices.
 */

// Simple mock implementations for testing environments
type MockFunction<T = any> = {
  (...args: any[]): T;
  mockImplementation?: (impl: (...args: any[]) => T) => void;
  mockClear?: () => void;
  mockReset?: () => void;
  mock?: {
    calls: any[][];
  };
};

// Mock act function for testing environments
const act = (callback: () => void | Promise<void>) => {
  if (typeof callback === 'function') {
    return callback();
  }
  return Promise.resolve();
};

import type { 
  WorkflowState,
  AuthState, 
  UIState,
  CacheState,
  StateCreator,
  TemplateMetadata,
  CompleteTemplate,
  WorkflowInstance,
  InstanceProgress,
  StepData,
  WorkflowBuilderState
} from '../core/types';

// ============================================================================
// MOCK STORE UTILITIES
// ============================================================================

/**
 * Type-safe mock store creator pattern
 * Based on research from Zustand testing best practices
 */
export const createMockStore = <T>(
  initialState: Partial<T>,
  storeName: string = 'testStore'
) => {
  // Create mock implementation that can be safely called in test environments
  let mockState = initialState;
  
  const mockImplementation: MockFunction = (...args: any[]) => {
    if (args.length > 0 && typeof args[0] === 'function') {
      return args[0](mockState);
    }
    return mockState;
  };
  
  // Add mock properties if jest-like environment
  mockImplementation.mock = { calls: [] };
  mockImplementation.mockImplementation = (impl: any) => {
    // Mock implementation logic would go here
  };
  mockImplementation.mockClear = () => {
    if (mockImplementation.mock) {
      mockImplementation.mock.calls = [];
    }
  };
  mockImplementation.mockReset = () => {
    mockState = initialState;
    if (mockImplementation.mock) {
      mockImplementation.mock.calls = [];
    }
  };
  
  const mockStore = (overrides: Partial<T> = {}) => {
    mockState = { ...initialState, ...overrides } as Partial<T>;
    return mockImplementation;
  };
  
  return {
    mockStore,
    mockImplementation,
    reset: () => mockImplementation.mockReset?.(),
    getCallCount: () => mockImplementation.mock?.calls?.length || 0,
    getLastCall: () => {
      const calls = mockImplementation.mock?.calls;
      return calls && calls.length > 0 ? calls[calls.length - 1] : undefined;
    },
  };
};

/**
 * Store-specific mock creators
 */
export const createWorkflowStoreMock = (overrides: Partial<WorkflowState> = {}) => {
  const defaultBuilderState: WorkflowBuilderState = {
    activeLevel: 'template',
    selectedItem: null,
    expandedItems: new Set<string>(),
    isDirty: false,
    saveStatus: 'idle',
    dragState: null,
    clipboard: null,
    undoStack: [],
    redoStack: [],
  };

  const defaultState: Partial<WorkflowState> = {
    loading: false,
    error: null,
    lastUpdated: null,
    templates: {
      metadata: {} as Record<string, TemplateMetadata>,
      hierarchies: {} as Record<string, CompleteTemplate>,
      loading: new Set<string>(),
    },
    instances: {
      active: {} as Record<string, WorkflowInstance>,
      progress: {} as Record<string, InstanceProgress>,
      stepData: {} as Record<string, Record<string, StepData>>,
    },
    builder: defaultBuilderState,
  };
  
  return createMockStore({ ...defaultState, ...overrides }, 'workflowStore');
};

export const createAuthStoreMock = (overrides: Partial<AuthState> = {}) => {
  const defaultState: Partial<AuthState> = {
    loading: false,
    error: null,
    lastUpdated: null,
    user: null,
    permissions: null,
    activeClientId: null,
    clientPermissions: [],
    isFetchingPermissions: false,
  };
  
  return createMockStore({ ...defaultState, ...overrides }, 'authStore');
};

export const createUIStoreMock = (overrides: Partial<UIState> = {}) => {
  const defaultBuilderState: WorkflowBuilderState = {
    activeLevel: 'template',
    selectedItem: null,
    expandedItems: new Set<string>(),
    isDirty: false,
    saveStatus: 'idle',
    dragState: null,
    clipboard: null,
    undoStack: [],
    redoStack: [],
  };

  const defaultState: Partial<UIState> = {
    loading: false,
    error: null,
    lastUpdated: null,
    global: {
      sidebarOpen: false,
      theme: 'light',
      loading: false,
      notifications: [],
      modals: [],
      toasts: [],
    },
    preferences: {
      theme: 'light',
      language: 'en',
      timezone: 'UTC',
      notifications: {
        email: true,
        browser: true,
        workflowUpdates: true,
        taskAssignments: true,
        deadlineReminders: true,
      },
      workflow: {
        autoSave: true,
        autoSaveInterval: 30,
        showHelpText: true,
        compactView: false,
        recentTemplates: [],
        favoriteTemplates: [],
      },
      ui: {
        sidebarCollapsed: false,
        gridView: false,
        itemsPerPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      },
    },
    builder: defaultBuilderState,
  };
  
  return createMockStore({ ...defaultState, ...overrides }, 'uiStore');
};

export const createCacheStoreMock = (overrides: Partial<CacheState> = {}) => {
  const defaultState: Partial<CacheState> = {
    loading: false,
    error: null,
    lastUpdated: null,
    metrics: {
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      evictionCount: 0,
      totalRequests: 0,
      averageResponseTime: 0,
    },
    status: 'healthy',
    lastCleanup: null,
    config: {},
  };
  
  return createMockStore({ ...defaultState, ...overrides }, 'cacheStore');
};

// ============================================================================
// CACHE TESTING UTILITIES
// ============================================================================

/**
 * Cache operation testing utilities
 * Based on research from industry cache testing patterns
 */
export class CacheTestUtilities {
  private hitCount = 0;
  private missCount = 0;
  private operations: Array<{ type: 'hit' | 'miss' | 'set' | 'invalidate'; key: string; timestamp: number }> = [];
  
  /**
   * Mock cache implementation for testing
   */
  mockCache = new Map<string, { data: any; timestamp: number; ttl?: number }>();
  
  /**
   * Get cached data with hit/miss tracking
   */
  getCached: MockFunction<Promise<any>> = async (key: string) => {
    const cached = this.mockCache.get(key);
    const now = Date.now();
    
    if (cached && (!cached.ttl || now - cached.timestamp < cached.ttl)) {
      this.hitCount++;
      this.operations.push({ type: 'hit', key, timestamp: now });
      return cached.data;
    } else {
      this.missCount++;
      this.operations.push({ type: 'miss', key, timestamp: now });
      return null;
    }
  };
  
  /**
   * Set cached data
   */
  setCached: MockFunction<Promise<void>> = async (key: string, data: any, options?: { ttl?: number }) => {
    const now = Date.now();
    this.mockCache.set(key, {
      data,
      timestamp: now,
      ttl: options?.ttl,
    });
    this.operations.push({ type: 'set', key, timestamp: now });
  };
  
  /**
   * Invalidate cached data
   */
  invalidateCache: MockFunction<Promise<void>> = async (keyPattern: string) => {
    const now = Date.now();
    const keysToDelete = Array.from(this.mockCache.keys()).filter(key => 
      key.includes(keyPattern) || keyPattern.includes(key)
    );
    
    keysToDelete.forEach(key => {
      this.mockCache.delete(key);
      this.operations.push({ type: 'invalidate', key, timestamp: now });
    });
  };
  
  /**
   * Get cache statistics for testing
   */
  getStats = () => ({
    hitCount: this.hitCount,
    missCount: this.missCount,
    hitRate: this.hitCount + this.missCount > 0 ? this.hitCount / (this.hitCount + this.missCount) : 0,
    cacheSize: this.mockCache.size,
    operations: [...this.operations],
  });
  
  /**
   * Reset cache for testing
   */
  reset = () => {
    this.hitCount = 0;
    this.missCount = 0;
    this.operations = [];
    this.mockCache.clear();
    this.getCached.mockClear?.();
    this.setCached.mockClear?.();
    this.invalidateCache.mockClear?.();
  };
  
  /**
   * Simulate cache pressure for boundary testing
   */
  simulateCachePressure = (maxSize: number) => {
    if (this.mockCache.size >= maxSize) {
      // Simulate LRU eviction - remove oldest entries
      const entries = Array.from(this.mockCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const evictCount = this.mockCache.size - maxSize + 1;
      for (let i = 0; i < evictCount; i++) {
        this.mockCache.delete(entries[i][0]);
      }
    }
  };
}

// ============================================================================
// EVENT BUS TESTING UTILITIES  
// ============================================================================

/**
 * Event bus testing utilities for event-driven system testing
 * Based on research from event-driven architecture testing patterns
 */
export class EventBusTestUtilities {
  private events: Array<{ type: string; payload: any; timestamp: number }> = [];
  private listeners = new Map<string, Array<(payload: any) => void>>();
  
  /**
   * Mock event bus emit
   */
  emit: MockFunction<void> = (eventType: string, payload: any) => {
    const now = Date.now();
    this.events.push({ type: eventType, payload, timestamp: now });
    
    // Trigger listeners
    const eventListeners = this.listeners.get(eventType) || [];
    eventListeners.forEach(listener => {
      try {
        listener(payload);
      } catch (error) {
        console.error(`Event listener error for ${eventType}:`, error);
      }
    });
  };
  
  /**
   * Mock event bus listen
   */
  on: MockFunction<void> = (eventType: string, listener: (payload: any) => void) => {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
  };
  
  /**
   * Mock event bus unlisten
   */
  off: MockFunction<void> = (eventType: string, listener: (payload: any) => void) => {
    const eventListeners = this.listeners.get(eventType);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  };
  
  /**
   * Get event history for testing
   */
  getEventHistory = () => [...this.events];
  
  /**
   * Get events of specific type
   */
  getEventsOfType = (eventType: string) => 
    this.events.filter(event => event.type === eventType);
  
  /**
   * Check if event was emitted
   */
  wasEventEmitted = (eventType: string, payload?: any) => {
    const typeEvents = this.getEventsOfType(eventType);
    if (!payload) return typeEvents.length > 0;
    
    return typeEvents.some(event => 
      JSON.stringify(event.payload) === JSON.stringify(payload)
    );
  };
  
  /**
   * Wait for event to be emitted (for async testing)
   */
  waitForEvent = async (eventType: string, timeout = 1000) => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Event ${eventType} not emitted within ${timeout}ms`));
      }, timeout);
      
      const listener = (payload: any) => {
        clearTimeout(timeoutId);
        this.off(eventType, listener);
        resolve(payload);
      };
      
      this.on(eventType, listener);
    });
  };
  
  /**
   * Reset event bus for testing
   */
  reset = () => {
    this.events = [];
    this.listeners.clear();
    this.emit.mockClear?.();
    this.on.mockClear?.();
    this.off.mockClear?.();
  };
}

// ============================================================================
// PERFORMANCE TESTING UTILITIES
// ============================================================================

/**
 * Performance testing utilities for cache and render performance
 * Based on research from React performance testing best practices
 */
export class PerformanceTestUtilities {
  private measurements: Array<{ name: string; duration: number; timestamp: number }> = [];
  
  /**
   * Measure function execution time
   */
  measureFunction = async <T>(name: string, fn: () => T | Promise<T>): Promise<T> => {
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const result = await fn();
    const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
    
    this.measurements.push({
      name,
      duration: end - start,
      timestamp: Date.now(),
    });
    
    return result;
  };
  
  /**
   * Measure React component render performance
   */
  measureRender = (name: string, renderFn: () => void) => {
    return act(() => {
      return this.measureFunction(name, renderFn);
    });
  };
  
  /**
   * Get performance statistics
   */
  getStats = () => {
    const durations = this.measurements.map(m => m.duration);
    return {
      count: durations.length,
      total: durations.reduce((sum, d) => sum + d, 0),
      average: durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0,
      min: durations.length > 0 ? Math.min(...durations) : 0,
      max: durations.length > 0 ? Math.max(...durations) : 0,
      measurements: [...this.measurements],
    };
  };
  
  /**
   * Assert performance within threshold
   */
  assertPerformance = (name: string, maxDuration: number) => {
    const relevantMeasurements = this.measurements.filter(m => m.name === name);
    if (relevantMeasurements.length === 0) {
      throw new Error(`No measurements found for "${name}"`);
    }
    
    const averageDuration = relevantMeasurements.reduce((sum, m) => sum + m.duration, 0) / relevantMeasurements.length;
    
    if (averageDuration > maxDuration) {
      throw new Error(
        `Performance assertion failed for "${name}": ` +
        `average ${averageDuration.toFixed(2)}ms > threshold ${maxDuration}ms`
      );
    }
  };
  
  /**
   * Reset performance measurements
   */
  reset = () => {
    this.measurements = [];
  };
}

// ============================================================================
// INTEGRATION TEST HELPERS
// ============================================================================

/**
 * Comprehensive integration test setup
 * Combines all testing utilities for full integration testing
 */
export const createIntegrationTestEnvironment = () => {
  const cache = new CacheTestUtilities();
  const eventBus = new EventBusTestUtilities();
  const performance = new PerformanceTestUtilities();
  
  // Mock store creators
  const workflowStore = createWorkflowStoreMock();
  const authStore = createAuthStoreMock();
  const uiStore = createUIStoreMock();
  const cacheStore = createCacheStoreMock();
  
  return {
    // Utilities
    cache,
    eventBus,
    performance,
    
    // Store mocks
    stores: {
      workflow: workflowStore,
      auth: authStore,
      ui: uiStore,
      cache: cacheStore,
    },
    
    // Reset all mocks and utilities
    resetAll: () => {
      cache.reset();
      eventBus.reset();
      performance.reset();
      workflowStore.reset();
      authStore.reset();
      uiStore.reset();
      cacheStore.reset();
    },
    
    // Assert system health
    assertSystemHealth: () => {
      const cacheStats = cache.getStats();
      const perfStats = performance.getStats();
      
      return {
        cacheHitRate: cacheStats.hitRate,
        averagePerformance: perfStats.average,
        eventCount: eventBus.getEventHistory().length,
        cacheSize: cacheStats.cacheSize,
        isHealthy: cacheStats.hitRate > 0.8 && perfStats.average < 100, // Example thresholds
      };
    },
  };
};

// ============================================================================
// ASYNC TESTING HELPERS
// ============================================================================

/**
 * Utilities for testing asynchronous operations and race conditions
 * Based on research from advanced JavaScript testing patterns
 */
export const asyncTestUtilities = {
  /**
   * Create controlled timing for race condition testing
   */
  createDelayedPromise: <T>(value: T, delay: number): Promise<T> => {
    return new Promise(resolve => {
      setTimeout(() => resolve(value), delay);
    });
  },
  
  /**
   * Test concurrent operations
   */
  testConcurrentOperations: async <T>(
    operations: Array<() => Promise<T>>,
    expectedResults?: T[]
  ): Promise<T[]> => {
    const promises = operations.map(op => op());
    const results = await Promise.all(promises);
    
    // Basic assertion if expected results provided
    if (expectedResults) {
      if (results.length !== expectedResults.length) {
        throw new Error(`Expected ${expectedResults.length} results, got ${results.length}`);
      }
      
      for (let i = 0; i < results.length; i++) {
        if (JSON.stringify(results[i]) !== JSON.stringify(expectedResults[i])) {
          throw new Error(`Result ${i} does not match expected`);
        }
      }
    }
    
    return results;
  },
  
  /**
   * Wait for condition to be true (useful for async state changes)
   */
  waitForCondition: async (
    condition: () => boolean,
    timeout = 1000,
    interval = 10
  ): Promise<void> => {
    const start = Date.now();
    
    while (!condition() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  },
  
  /**
   * Test operation with timeout
   */
  withTimeout: async <T>(promise: Promise<T>, timeout: number): Promise<T> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout);
    });
    
    return Promise.race([promise, timeoutPromise]);
  },
};

// Export all utilities
export default {
  createMockStore,
  createWorkflowStoreMock,
  createAuthStoreMock, 
  createUIStoreMock,
  createCacheStoreMock,
  CacheTestUtilities,
  EventBusTestUtilities,
  PerformanceTestUtilities,
  createIntegrationTestEnvironment,
  asyncTestUtilities,
}; 