/**
 * Debug & Logging Infrastructure
 * 
 * Comprehensive debugging and logging infrastructure for the unified state
 * management library including structured logging, performance monitoring,
 * and state inspection tools.
 */

// ============================================================================
// STRUCTURED LOGGING EXPORTS
// ============================================================================

export {
  // Core logger classes
  StructuredLogger,
  ConsoleTransport,
  StorageTransport,
  RemoteTransport,
  
  // Global logger instance
  globalLogger,
  
  // Utility functions
  createLogger,
  LogFilters,
  
  // Types and enums
  LogLevel,
  type LogCategory,
  type LogTransport,
  type LoggerConfig,
  type LogFilter,
  type LogFormatter,
} from './logger';

// ============================================================================
// PERFORMANCE MONITORING EXPORTS
// ============================================================================

export {
  // Core performance monitor classes
  PerformanceMonitor,
  
  // Global performance monitor instance
  globalPerformanceMonitor,
  
  // Decorators for performance measurement
  measurePerformance,
  measureAsyncPerformance,
  
  // Types and interfaces
  type MetricCategory,
  type PerformanceThresholds,
  type PerformanceAlert,
  type PerformanceStats,
  type MemoryUsage,
  type PerformanceReport,
} from './performance-monitor';

// ============================================================================
// STATE INSPECTOR EXPORTS
// ============================================================================

export {
  // Core state inspector classes
  StateInspector,
  DebugUtils,
  
  // Global state inspector instance
  globalStateInspector,
  
  // Types and interfaces
  type StateSnapshot,
  type StateDiff,
  type DebugSession,
  type StateInspectorConfig,
  type DebugAction,
} from './state-inspector';

// ============================================================================
// UNIFIED DEBUG INTERFACE
// ============================================================================

/**
 * Unified debug interface that provides access to all debugging tools
 */
export class UnifiedDebugger {
  /**
   * Get all debug tools in one interface
   */
  static getDebugTools() {
    return {
      // Logging
      logger: globalLogger,
      
      // Performance monitoring
      performance: globalPerformanceMonitor,
      
      // State inspection
      inspector: globalStateInspector,
      
      // Utilities
      utils: DebugUtils,
    };
  }

  /**
   * Initialize all debug tools with common configuration
   */
  static initialize(config: {
    logLevel?: LogLevel;
    enablePerformanceMonitoring?: boolean;
    enableStateInspection?: boolean;
    enableTimeTravel?: boolean;
    maxSnapshots?: number;
    performanceThresholds?: Partial<PerformanceThresholds>;
  } = {}) {
    const {
      logLevel = LogLevel.INFO,
      enablePerformanceMonitoring = true,
      enableStateInspection = true,
      enableTimeTravel = process.env.NODE_ENV === 'development',
      maxSnapshots = 1000,
      performanceThresholds = {},
    } = config;

    // Configure logger
    globalLogger.info('Initializing unified debugger', { config });

    // Configure performance monitor
    if (enablePerformanceMonitoring) {
      // Performance monitor is already initialized with defaults
      globalLogger.info('Performance monitoring enabled');
    }

    // Configure state inspector
    if (enableStateInspection) {
      // State inspector is already initialized with defaults
      globalLogger.info('State inspection enabled', {
        timeTravel: enableTimeTravel,
        maxSnapshots,
      });
    }

    return this.getDebugTools();
  }

  /**
   * Start a comprehensive debug session
   */
  static startDebugSession(metadata?: Record<string, any>) {
    const sessionId = globalStateInspector.startSession(metadata);
    
    globalLogger.info('Debug session started', {
      sessionId,
      metadata,
      tools: {
        logging: true,
        performance: true,
        stateInspection: true,
      },
    });

    return {
      sessionId,
      tools: this.getDebugTools(),
      
      // Convenience methods
      log: globalLogger,
      perf: globalPerformanceMonitor,
      inspector: globalStateInspector,
      
      // End session method
      end: () => {
        const session = globalStateInspector.endSession();
        globalLogger.info('Debug session ended', { sessionId });
        return session;
      },
    };
  }

  /**
   * Generate comprehensive debug report
   */
  static generateReport() {
    const performanceReport = globalPerformanceMonitor.generateReport();
    const logStats = globalLogger.getStatistics();
    const inspectorMetrics = globalStateInspector.getPerformanceMetrics();

    return {
      timestamp: new Date().toISOString(),
      performance: performanceReport,
      logging: logStats,
      stateInspection: inspectorMetrics,
      summary: {
        performanceScore: performanceReport.score,
        totalLogEntries: logStats.totalEntries,
        totalSnapshots: inspectorMetrics.totalSnapshots,
        sessionDuration: logStats.sessionDuration,
      },
    };
  }

  /**
   * Export all debug data
   */
  static exportDebugData(format: 'json' | 'csv' = 'json') {
    return {
      logs: globalLogger.export(format),
      performance: globalPerformanceMonitor.export(format),
      stateInspection: globalStateInspector.export(format),
      report: this.generateReport(),
    };
  }

  /**
   * Clear all debug data
   */
  static clearAll() {
    globalLogger.clear();
    globalPerformanceMonitor.clear();
    globalStateInspector.clear();
    
    globalLogger.info('All debug data cleared');
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

// Re-export commonly used items for convenience
import { globalLogger } from './logger';
import { globalPerformanceMonitor } from './performance-monitor';
import { globalStateInspector, DebugUtils } from './state-inspector';
import { LogLevel, type PerformanceThresholds } from './logger';

/**
 * Quick access to debug tools
 */
export const debug = UnifiedDebugger.getDebugTools();

/**
 * Quick access to logger
 */
export const logger = globalLogger;

/**
 * Quick access to performance monitor
 */
export const performance = globalPerformanceMonitor;

/**
 * Quick access to state inspector
 */
export const inspector = globalStateInspector;

/**
 * Quick access to debug utilities
 */
export const utils = DebugUtils;

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default UnifiedDebugger; 