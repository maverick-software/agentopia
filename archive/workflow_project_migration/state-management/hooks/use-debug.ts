/**
 * Debug & Development Hooks
 * 
 * Specialized hooks for development debugging, state inspection, logging control,
 * and diagnostic utilities. Provides high-level abstractions for common debugging
 * patterns with seamless integration to the debug infrastructure.
 */

import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { useStore } from './use-store';
import { cacheStore } from '../stores';
import { globalLogger, globalStateInspector, LogLevel } from '../debug';
import type { 
  CacheState,
  PerformanceMetric 
} from '../core/types';
import type {
  StateSnapshot,
  StateDiff,
  DebugSession
} from '../debug';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Debug state return type
 */
export interface UseDebugReturn {
  isEnabled: boolean;
  logLevel: LogLevel;
  session: DebugSession | null;
  snapshots: StateSnapshot[];
  enable: () => void;
  disable: () => void;
  setLogLevel: (level: LogLevel) => void;
  createSnapshot: (label?: string) => StateSnapshot;
  compareSnapshots: (snapshot1: StateSnapshot, snapshot2: StateSnapshot) => StateDiff | null;
  exportDebugData: () => string;
  clearDebugData: () => void;
}

/**
 * State inspector return type
 */
export interface UseStateInspectorReturn {
  snapshots: StateSnapshot[];
  currentSnapshot: StateSnapshot | null;
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  takeSnapshot: (label?: string) => StateSnapshot;
  getSnapshot: (id: string) => StateSnapshot | null;
  compareSnapshots: (id1: string, id2: string) => StateDiff | null;
  timeTravel: (snapshotId: string) => boolean;
  exportSnapshots: () => string;
  clearSnapshots: () => void;
}

/**
 * Logger control return type
 */
export interface UseLoggerReturn {
  logLevel: LogLevel;
  isEnabled: boolean;
  logs: Array<{
    level: LogLevel;
    message: string;
    timestamp: number;
    category?: string;
    metadata?: any;
  }>;
  setLogLevel: (level: LogLevel) => void;
  enable: () => void;
  disable: () => void;
  log: (level: LogLevel, message: string, metadata?: any, category?: string) => void;
  debug: (message: string, metadata?: any, category?: string) => void;
  info: (message: string, metadata?: any, category?: string) => void;
  warn: (message: string, metadata?: any, category?: string) => void;
  error: (message: string, error?: Error, metadata?: any, category?: string) => void;
  clearLogs: () => void;
  exportLogs: () => string;
}

/**
 * Development utilities return type
 */
export interface UseDevUtilsReturn {
  isDevelopment: boolean;
  isProduction: boolean;
  performance: {
    metrics: PerformanceMetric[];
    getMetrics: () => PerformanceMetric[];
    clearMetrics: () => void;
  };
  memory: {
    usage: any;
    triggerGC: () => void;
    getBreakdown: () => Record<string, number>;
  };
  stores: {
    getState: (storeName: string) => any;
    getAllStates: () => Record<string, any>;
    resetStore: (storeName: string) => void;
    resetAllStores: () => void;
  };
  utilities: {
    measure: <T>(operation: string, fn: () => T) => T;
    measureAsync: <T>(operation: string, fn: () => Promise<T>) => Promise<T>;
    createMockData: (type: string, count?: number) => any[];
    validateState: (state: any, schema?: any) => boolean;
  };
}

/**
 * Debug console return type
 */
export interface UseDebugConsoleReturn {
  isVisible: boolean;
  logs: Array<any>;
  commands: Record<string, Function>;
  show: () => void;
  hide: () => void;
  toggle: () => void;
  executeCommand: (command: string, ...args: any[]) => any;
  addCommand: (name: string, fn: Function, description?: string) => void;
  removeCommand: (name: string) => void;
  clearConsole: () => void;
}

/**
 * Store debugging return type
 */
export interface UseStoreDebugReturn {
  storeName: string;
  currentState: any;
  stateHistory: StateSnapshot[];
  subscriptions: number;
  lastUpdate: number;
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  getStateHistory: () => StateSnapshot[];
  rollbackToSnapshot: (snapshotId: string) => boolean;
  exportState: () => string;
  importState: (stateJson: string) => boolean;
  validateState: () => { isValid: boolean; errors: string[] };
}

// ============================================================================
// CORE DEBUG HOOKS
// ============================================================================

/**
 * Core debug hook
 * Provides comprehensive debugging capabilities and session management
 */
export function useDebug(): UseDebugReturn {
  const isEnabled = useMemo(() => {
    return process.env.NODE_ENV === 'development';
  }, []);

  // Get current log level from logger config
  const logLevel = useMemo((): LogLevel => {
    return (globalLogger as any).config?.level || LogLevel.INFO;
  }, []);

  const session = useMemo((): DebugSession | null => {
    const sessions = globalStateInspector.getSessions();
    return sessions.length > 0 ? sessions[sessions.length - 1] : null;
  }, []);

  const snapshots = useMemo((): StateSnapshot[] => {
    return globalStateInspector.getSnapshots();
  }, []);

  const enable = useCallback((): void => {
    globalStateInspector.startSession({ type: 'debug-session' });
  }, []);

  const disable = useCallback((): void => {
    globalStateInspector.endSession();
  }, []);

  const setLogLevel = useCallback((level: LogLevel): void => {
    // Update logger configuration - accessing private config
    if ((globalLogger as any).config) {
      (globalLogger as any).config.level = level;
    }
  }, []);

  const createSnapshot = useCallback((label?: string): StateSnapshot => {
    // Using captureSnapshot method from state inspector
    return globalStateInspector.captureSnapshot(
      'debug', 
      globalStateInspector.getCurrentStates(), 
      'manual-snapshot',
      { label: label || `Debug snapshot ${Date.now()}` }
    );
  }, []);

  const compareSnapshots = useCallback((snapshot1: StateSnapshot, snapshot2: StateSnapshot): StateDiff | null => {
    return globalStateInspector.getSnapshotDiff(snapshot1.id, snapshot2.id);
  }, []);

  const exportDebugData = useCallback((): string => {
    return globalStateInspector.export('json');
  }, []);

  const clearDebugData = useCallback((): void => {
    globalStateInspector.clear();
  }, []);

  return {
    isEnabled,
    logLevel,
    session,
    snapshots,
    enable,
    disable,
    setLogLevel,
    createSnapshot,
    compareSnapshots,
    exportDebugData,
    clearDebugData
  };
}

/**
 * State inspector hook
 * Provides state inspection and time-travel debugging capabilities
 */
export function useStateInspector(): UseStateInspectorReturn {
  const snapshots = useMemo((): StateSnapshot[] => {
    return globalStateInspector.getSnapshots();
  }, []);

  const currentSnapshot = useMemo((): StateSnapshot | null => {
    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  }, [snapshots]);

  // Access private isRecording property safely
  const isRecording = useMemo((): boolean => {
    return (globalStateInspector as any).isRecording || false;
  }, []);

  const startRecording = useCallback((): void => {
    globalStateInspector.startSession({ type: 'recording' });
  }, []);

  const stopRecording = useCallback((): void => {
    globalStateInspector.endSession();
  }, []);

  const takeSnapshot = useCallback((label?: string): StateSnapshot => {
    return globalStateInspector.captureSnapshot(
      'debug',
      globalStateInspector.getCurrentStates(),
      'manual-snapshot',
      { label: label || `Snapshot ${Date.now()}` }
    );
  }, []);

  const getSnapshot = useCallback((id: string): StateSnapshot | null => {
    const snapshots = globalStateInspector.getSnapshots();
    return snapshots.find(s => s.id === id) || null;
  }, []);

  const compareSnapshots = useCallback((id1: string, id2: string): StateDiff | null => {
    return globalStateInspector.getSnapshotDiff(id1, id2);
  }, []);

  const timeTravel = useCallback((snapshotId: string): boolean => {
    return globalStateInspector.restoreSnapshot(snapshotId);
  }, []);

  const exportSnapshots = useCallback((): string => {
    return globalStateInspector.export('json');
  }, []);

  const clearSnapshots = useCallback((): void => {
    globalStateInspector.clear();
  }, []);

  return {
    snapshots,
    currentSnapshot,
    isRecording,
    startRecording,
    stopRecording,
    takeSnapshot,
    getSnapshot,
    compareSnapshots,
    timeTravel,
    exportSnapshots,
    clearSnapshots
  };
}

/**
 * Logger control hook
 * Provides logging control and log management capabilities
 */
export function useLogger(): UseLoggerReturn {
  const logsRef = useRef<Array<any>>([]);

  const logLevel = useMemo((): LogLevel => {
    return (globalLogger as any).config?.level || LogLevel.INFO;
  }, []);

  const isEnabled = useMemo((): boolean => {
    return (globalLogger as any).config?.enabled !== false;
  }, []);

  const logs = useMemo(() => {
    return [...logsRef.current];
  }, []);

  const setLogLevel = useCallback((level: LogLevel): void => {
    if ((globalLogger as any).config) {
      (globalLogger as any).config.level = level;
    }
  }, []);

  const enable = useCallback((): void => {
    if ((globalLogger as any).config) {
      (globalLogger as any).config.enabled = true;
    }
  }, []);

  const disable = useCallback((): void => {
    if ((globalLogger as any).config) {
      (globalLogger as any).config.enabled = false;
    }
  }, []);

  const log = useCallback((level: LogLevel, message: string, metadata?: any, category?: string): void => {
    const logEntry = {
      level,
      message,
      timestamp: Date.now(),
      category,
      metadata
    };
    
    logsRef.current.push(logEntry);
    
    // Keep only last 1000 logs
    if (logsRef.current.length > 1000) {
      logsRef.current = logsRef.current.slice(-1000);
    }
    
    switch (level) {
      case LogLevel.DEBUG:
        globalLogger.debug(message, metadata, category as any);
        break;
      case LogLevel.INFO:
        globalLogger.info(message, metadata, category as any);
        break;
      case LogLevel.WARN:
        globalLogger.warn(message, metadata, category as any);
        break;
      case LogLevel.ERROR:
        globalLogger.error(message, metadata instanceof Error ? metadata : undefined, metadata, category as any);
        break;
    }
  }, []);

  const debug = useCallback((message: string, metadata?: any, category?: string): void => {
    log(LogLevel.DEBUG, message, metadata, category);
  }, [log]);

  const info = useCallback((message: string, metadata?: any, category?: string): void => {
    log(LogLevel.INFO, message, metadata, category);
  }, [log]);

  const warn = useCallback((message: string, metadata?: any, category?: string): void => {
    log(LogLevel.WARN, message, metadata, category);
  }, [log]);

  const error = useCallback((message: string, error?: Error, metadata?: any, category?: string): void => {
    log(LogLevel.ERROR, message, error || metadata, category);
  }, [log]);

  const clearLogs = useCallback((): void => {
    logsRef.current = [];
  }, []);

  const exportLogs = useCallback((): string => {
    return JSON.stringify(logsRef.current, null, 2);
  }, []);

  return {
    logLevel,
    isEnabled,
    logs,
    setLogLevel,
    enable,
    disable,
    log,
    debug,
    info,
    warn,
    error,
    clearLogs,
    exportLogs
  };
}

/**
 * Development utilities hook
 * Provides comprehensive development and debugging utilities
 */
export function useDevUtils(): UseDevUtilsReturn {
  const isDevelopment = useMemo(() => {
    return process.env.NODE_ENV === 'development';
  }, []);

  const isProduction = useMemo(() => {
    return process.env.NODE_ENV === 'production';
  }, []);

  // Performance utilities
  const performance = useMemo(() => ({
    metrics: (globalStateInspector as any).metrics || [],
    getMetrics: () => (globalStateInspector as any).getMetrics?.() || [],
    clearMetrics: () => (globalStateInspector as any).clearMetrics?.()
  }), []);

  // Development utilities
  const utilities = useMemo(() => ({
    measure: <T>(operation: string, fn: () => T): T => {
      const start = window.performance.now();
      const result = fn();
      const duration = window.performance.now() - start;
      
      globalLogger.debug(`Operation "${operation}" took ${duration.toFixed(2)}ms`, {
        operation,
        duration
      }, 'performance');
      
      return result;
    },
    
    measureAsync: async <T>(operation: string, fn: () => Promise<T>): Promise<T> => {
      const start = window.performance.now();
      const result = await fn();
      const duration = window.performance.now() - start;
      
      globalLogger.debug(`Async operation "${operation}" took ${duration.toFixed(2)}ms`, {
        operation,
        duration
      }, 'performance');
      
      return result;
    },
    
    createMockData: (type: string, count: number = 10): any[] => {
      // Generate mock data based on type
      const mockItems = [];
      for (let i = 0; i < count; i++) {
        mockItems.push({
          id: `mock-${type}-${i}`,
          name: `Mock ${type} ${i}`,
          timestamp: Date.now() - (i * 1000),
          type
        });
      }
      return mockItems;
    },
    
    validateState: (state: any, schema?: any): boolean => {
      // Basic state validation
      if (!state) return false;
      if (typeof state !== 'object') return false;
      
      // Add more validation logic based on schema
      return true;
    }
  }), []);

  // Memory utilities
  const memory = useMemo(() => ({
    usage: (window as any).performance?.memory || null,
    triggerGC: () => {
      if ('gc' in window && typeof window.gc === 'function') {
        window.gc();
      }
    },
    getBreakdown: (): Record<string, number> => {
      const memory = (window as any).performance?.memory;
      if (!memory) return { used: 0, total: 0, limit: 0 };
      
      return {
        used: memory.usedJSHeapSize || 0,
        total: memory.totalJSHeapSize || 0,
        limit: memory.jsHeapSizeLimit || 0
      };
    }
  }), []);

  // Store utilities
  const stores = useMemo(() => ({
    getState: (storeName: string) => {
      return globalStateInspector.getCurrentStates()[storeName] || null;
    },
    getAllStates: () => {
      return globalStateInspector.getCurrentStates();
    },
    resetStore: (storeName: string) => {
      // Reset specific store - would need access to store registry
      globalLogger.info(`Reset requested for store: ${storeName}`);
    },
    resetAllStores: () => {
      // Reset all stores - would need access to store registry
      globalLogger.info('Reset requested for all stores');
    }
  }), []);

  return {
    isDevelopment,
    isProduction,
    performance,
    memory,
    stores,
    utilities
  };
}

/**
 * Debug console hook
 * Provides a debug console interface for runtime debugging
 */
export function useDebugConsole(): UseDebugConsoleReturn {
  const [isVisible, setIsVisible] = useState(false);
  const logsRef = useRef<Array<any>>([]);
  const commandsRef = useRef<Record<string, Function>>({});

  // Initialize default commands
  useEffect(() => {
    commandsRef.current = {
      help: () => {
        return 'Available commands: ' + Object.keys(commandsRef.current).join(', ');
      },
      clear: () => {
        logsRef.current = [];
        return 'Console cleared';
      },
      state: (storeName?: string) => {
        if (!storeName) {
          return 'Usage: state <storeName>';
        }
        const states = globalStateInspector.getCurrentStates();
        return `State for ${storeName}: ${JSON.stringify(states[storeName] || {}, null, 2)}`;
      },
      snapshot: (label?: string) => {
        const snapshot = globalStateInspector.captureSnapshot(
          'debug',
          globalStateInspector.getCurrentStates(),
          'console-snapshot',
          { label: label || 'Console snapshot' }
        );
        return `Snapshot created: ${snapshot.id}`;
      },
      performance: () => {
        const memory = (window as any).performance?.memory;
        if (!memory) return 'Performance API not available';
        
        return {
          memory: {
            used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
            total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
            limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`
          }
        };
      }
    };
  }, []);

  const show = useCallback((): void => {
    setIsVisible(true);
  }, []);

  const hide = useCallback((): void => {
    setIsVisible(false);
  }, []);

  const toggle = useCallback((): void => {
    setIsVisible(prev => !prev);
  }, []);

  const executeCommand = useCallback((command: string, ...args: any[]): any => {
    const cmd = commandsRef.current[command];
    if (!cmd) {
      return `Unknown command: ${command}. Type 'help' for available commands.`;
    }
    
    try {
      return cmd(...args);
    } catch (error) {
      return `Error executing command: ${(error as Error).message}`;
    }
  }, []);

  const addCommand = useCallback((name: string, fn: Function, description?: string): void => {
    commandsRef.current[name] = fn;
  }, []);

  const removeCommand = useCallback((name: string): void => {
    delete commandsRef.current[name];
  }, []);

  const clearConsole = useCallback((): void => {
    logsRef.current = [];
  }, []);

  const logs = useMemo(() => {
    return [...logsRef.current];
  }, []);

  const commands = useMemo(() => {
    return { ...commandsRef.current };
  }, []);

  return {
    isVisible,
    logs,
    commands,
    show,
    hide,
    toggle,
    executeCommand,
    addCommand,
    removeCommand,
    clearConsole
  };
}

/**
 * Store debugging hook
 * Provides debugging capabilities for a specific store
 */
export function useStoreDebug(storeName: string): UseStoreDebugReturn {
  const stateHistoryRef = useRef<StateSnapshot[]>([]);
  const isRecordingRef = useRef(false);

  // Get current store state - using cache store as example
  const currentState = useStore(cacheStore, (state: CacheState) => state);

  const stateHistory = useMemo(() => {
    return [...stateHistoryRef.current];
  }, []);

  const subscriptions = useMemo(() => {
    // Count of subscriptions - placeholder
    return 1;
  }, []);

  const lastUpdate = useMemo(() => {
    return Date.now(); // Placeholder
  }, []);

  const isRecording = useMemo(() => {
    return isRecordingRef.current;
  }, []);

  const startRecording = useCallback((): void => {
    isRecordingRef.current = true;
    globalStateInspector.startSession({ type: 'store-debug', storeName });
  }, [storeName]);

  const stopRecording = useCallback((): void => {
    isRecordingRef.current = false;
    globalStateInspector.endSession();
  }, []);

  const getStateHistory = useCallback((): StateSnapshot[] => {
    return globalStateInspector.getSnapshots({
      storeName
    });
  }, [storeName]);

  const rollbackToSnapshot = useCallback((snapshotId: string): boolean => {
    return globalStateInspector.restoreSnapshot(snapshotId);
  }, []);

  const exportState = useCallback((): string => {
    return JSON.stringify(currentState, null, 2);
  }, [currentState]);

  const importState = useCallback((stateJson: string): boolean => {
    try {
      const state = JSON.parse(stateJson);
      globalLogger.info(`State imported for store: ${storeName}`, { state });
      return true;
    } catch (error) {
      globalLogger.error(`Failed to import state for store: ${storeName}`, error as Error);
      return false;
    }
  }, [storeName]);

  const validateState = useCallback((): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!currentState) {
      errors.push('State is null or undefined');
    }
    
    if (typeof currentState !== 'object') {
      errors.push('State is not an object');
    }
    
    // Add more validation logic
    return {
      isValid: errors.length === 0,
      errors
    };
  }, [currentState]);

  return {
    storeName,
    currentState,
    stateHistory,
    subscriptions,
    lastUpdate,
    isRecording,
    startRecording,
    stopRecording,
    getStateHistory,
    rollbackToSnapshot,
    exportState,
    importState,
    validateState
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Development mode hook
 * Simple utility to check if running in development mode
 */
export function useIsDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Debug key combination hook
 * Enables debug features with keyboard shortcuts
 */
export function useDebugKeyboard(onToggle?: () => void): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Shift+D or Cmd+Shift+D to toggle debug
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        onToggle?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggle]);
} 