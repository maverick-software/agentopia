/**
 * State Inspector & Debug Tools
 * 
 * Provides comprehensive state inspection, time-travel debugging, and
 * development utilities for the unified state management library.
 */

import type { StoreApi, BaseState, AppState } from '../core/types';
import { globalLogger } from './logger';
import { globalPerformanceMonitor } from './performance-monitor';

// ============================================================================
// STATE INSPECTOR TYPES
// ============================================================================

/**
 * State snapshot for time-travel debugging
 */
export interface StateSnapshot<T = any> {
  id: string;
  timestamp: number;
  state: T;
  action?: string;
  metadata?: Record<string, any>;
  storeName: string;
  diff?: StateDiff;
}

/**
 * State difference between snapshots
 */
export interface StateDiff {
  added: Record<string, any>;
  modified: Record<string, { from: any; to: any }>;
  removed: Record<string, any>;
}

/**
 * Debug session information
 */
export interface DebugSession {
  id: string;
  startTime: number;
  endTime?: number;
  snapshots: StateSnapshot[];
  stores: string[];
  metadata: Record<string, any>;
}

/**
 * State inspector configuration
 */
export interface StateInspectorConfig {
  maxSnapshots: number;
  enableTimeTravel: boolean;
  enableStateDiff: boolean;
  enablePerformanceTracking: boolean;
  autoSnapshot: boolean;
  snapshotInterval: number;
  excludeKeys: string[];
  includeMetadata: boolean;
}

/**
 * Store subscription info
 */
export interface StoreSubscription {
  storeName: string;
  store: StoreApi<any>;
  unsubscribe: () => void;
  lastSnapshot?: StateSnapshot;
}

/**
 * Debug action for time-travel
 */
export interface DebugAction {
  type: 'SNAPSHOT' | 'RESTORE' | 'CLEAR' | 'EXPORT' | 'IMPORT';
  payload?: any;
  timestamp: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// STATE INSPECTOR CLASS
// ============================================================================

/**
 * Main state inspector class
 */
export class StateInspector {
  private config: StateInspectorConfig;
  private sessions: DebugSession[] = [];
  private currentSession: DebugSession | null = null;
  private subscriptions = new Map<string, StoreSubscription>();
  private snapshots: StateSnapshot[] = [];
  private actionHistory: DebugAction[] = [];
  private isRecording = false;
  private snapshotTimer?: number;

  constructor(config: Partial<StateInspectorConfig> = {}) {
    this.config = {
      maxSnapshots: 1000,
      enableTimeTravel: true,
      enableStateDiff: true,
      enablePerformanceTracking: true,
      autoSnapshot: false,
      snapshotInterval: 5000, // 5 seconds
      excludeKeys: ['timestamp', 'lastUpdated'],
      includeMetadata: true,
      ...config,
    };

    globalLogger.info('State inspector initialized', {
      config: this.config,
    });
  }

  /**
   * Start a new debug session
   */
  startSession(metadata?: Record<string, any>): string {
    const session: DebugSession = {
      id: this.generateSessionId(),
      startTime: Date.now(),
      snapshots: [],
      stores: Array.from(this.subscriptions.keys()),
      metadata: metadata || {},
    };

    this.currentSession = session;
    this.sessions.push(session);
    this.isRecording = true;

    // Start auto-snapshot if enabled
    if (this.config.autoSnapshot) {
      this.startAutoSnapshot();
    }

    globalLogger.info('Debug session started', {
      sessionId: session.id,
      metadata,
    });

    return session.id;
  }

  /**
   * End the current debug session
   */
  endSession(): DebugSession | null {
    if (!this.currentSession) return null;

    this.currentSession.endTime = Date.now();
    this.isRecording = false;

    // Stop auto-snapshot
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = undefined;
    }

    const session = this.currentSession;
    this.currentSession = null;

    globalLogger.info('Debug session ended', {
      sessionId: session.id,
      duration: session.endTime - session.startTime,
      snapshotCount: session.snapshots.length,
    });

    return session;
  }

  /**
   * Subscribe to a store for monitoring
   */
  subscribeToStore<T extends BaseState>(storeName: string, store: StoreApi<T>): void {
    // Unsubscribe if already subscribed
    this.unsubscribeFromStore(storeName);

    const unsubscribe = store.subscribe((state, prevState) => {
      if (this.isRecording) {
        this.captureSnapshot(storeName, state, 'state-change', {
          hasChanges: state !== prevState,
        });
      }
    });

    const subscription: StoreSubscription = {
      storeName,
      store,
      unsubscribe,
    };

    this.subscriptions.set(storeName, subscription);

    // Take initial snapshot
    if (this.isRecording) {
      this.captureSnapshot(storeName, store.getState(), 'initial-state');
    }

    globalLogger.debug('Subscribed to store', { storeName });
  }

  /**
   * Unsubscribe from a store
   */
  unsubscribeFromStore(storeName: string): void {
    const subscription = this.subscriptions.get(storeName);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(storeName);
      globalLogger.debug('Unsubscribed from store', { storeName });
    }
  }

  /**
   * Capture a state snapshot
   */
  captureSnapshot<T>(storeName: string, state: T, action?: string, metadata?: Record<string, any>): StateSnapshot<T> {
    const subscription = this.subscriptions.get(storeName);
    const prevSnapshot = subscription?.lastSnapshot;

    const snapshot: StateSnapshot<T> = {
      id: this.generateSnapshotId(),
      timestamp: Date.now(),
      state: this.sanitizeState(state),
      action,
      metadata: this.config.includeMetadata ? {
        storeName,
        sessionId: this.currentSession?.id,
        ...metadata,
      } : undefined,
      storeName,
    };

    // Calculate diff if enabled and previous snapshot exists
    if (this.config.enableStateDiff && prevSnapshot) {
      snapshot.diff = this.calculateStateDiff(prevSnapshot.state, state);
    }

    // Add to snapshots
    this.snapshots.push(snapshot);
    
    // Add to current session
    if (this.currentSession) {
      this.currentSession.snapshots.push(snapshot);
    }

    // Update subscription
    if (subscription) {
      subscription.lastSnapshot = snapshot;
    }

    // Maintain max snapshots limit
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.config.maxSnapshots);
    }

    // Track performance if enabled
    if (this.config.enablePerformanceTracking) {
      globalPerformanceMonitor.recordMetric({
        operation: 'state-snapshot',
        duration: 0,
        timestamp: Date.now(),
        metadata: {
          category: 'state-update',
          storeName,
          stateSize: JSON.stringify(state).length,
        },
      });
    }

    globalLogger.debug('State snapshot captured', {
      snapshotId: snapshot.id,
      storeName,
      action,
    });

    return snapshot;
  }

  /**
   * Restore state from a snapshot (time-travel)
   */
  restoreSnapshot(snapshotId: string): boolean {
    if (!this.config.enableTimeTravel) {
      globalLogger.warn('Time-travel debugging is disabled');
      return false;
    }

    const snapshot = this.snapshots.find(s => s.id === snapshotId);
    if (!snapshot) {
      globalLogger.warn('Snapshot not found', { snapshotId });
      return false;
    }

    const subscription = this.subscriptions.get(snapshot.storeName);
    if (!subscription) {
      globalLogger.warn('Store not subscribed', { storeName: snapshot.storeName });
      return false;
    }

    try {
      // Temporarily disable recording to avoid capturing the restore
      const wasRecording = this.isRecording;
      this.isRecording = false;

      // Restore the state
      subscription.store.setState(snapshot.state);

      // Re-enable recording
      this.isRecording = wasRecording;

      // Record the restore action
      this.recordAction('RESTORE', {
        snapshotId,
        storeName: snapshot.storeName,
        timestamp: snapshot.timestamp,
      });

      globalLogger.info('State restored from snapshot', {
        snapshotId,
        storeName: snapshot.storeName,
        timestamp: snapshot.timestamp,
      });

      return true;
    } catch (error) {
      globalLogger.error('Failed to restore snapshot', error as Error, {
        snapshotId,
        storeName: snapshot.storeName,
      });
      return false;
    }
  }

  /**
   * Get all snapshots
   */
  getSnapshots(filter?: {
    storeName?: string;
    action?: string;
    timeRange?: { start: number; end: number };
  }): StateSnapshot[] {
    let filtered = [...this.snapshots];

    if (filter?.storeName) {
      filtered = filtered.filter(s => s.storeName === filter.storeName);
    }

    if (filter?.action) {
      filtered = filtered.filter(s => s.action === filter.action);
    }

    if (filter?.timeRange) {
      filtered = filtered.filter(s => 
        s.timestamp >= filter.timeRange!.start && s.timestamp <= filter.timeRange!.end
      );
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get current state of all subscribed stores
   */
  getCurrentStates(): Record<string, any> {
    const states: Record<string, any> = {};

    for (const [storeName, subscription] of this.subscriptions) {
      states[storeName] = subscription.store.getState();
    }

    return states;
  }

  /**
   * Get debug session by ID
   */
  getSession(sessionId: string): DebugSession | null {
    return this.sessions.find(s => s.id === sessionId) || null;
  }

  /**
   * Get all debug sessions
   */
  getSessions(): DebugSession[] {
    return [...this.sessions].sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * Clear all snapshots and sessions
   */
  clear(): void {
    this.snapshots = [];
    this.sessions = [];
    this.actionHistory = [];
    this.currentSession = null;
    this.isRecording = false;

    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = undefined;
    }

    globalLogger.info('State inspector cleared');
  }

  /**
   * Export debug data
   */
  export(format: 'json' | 'csv' = 'json'): string {
    const data = {
      config: this.config,
      sessions: this.sessions,
      snapshots: this.snapshots,
      actionHistory: this.actionHistory,
      currentStates: this.getCurrentStates(),
      exportTimestamp: Date.now(),
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      return this.exportToCsv(data);
    }
  }

  /**
   * Import debug data
   */
  import(data: string, format: 'json' | 'csv' = 'json'): boolean {
    try {
      let parsedData: any;

      if (format === 'json') {
        parsedData = JSON.parse(data);
      } else {
        // CSV import would need custom parsing
        throw new Error('CSV import not yet implemented');
      }

      // Validate data structure
      if (!parsedData.sessions || !parsedData.snapshots) {
        throw new Error('Invalid debug data format');
      }

      // Import data
      this.sessions = parsedData.sessions || [];
      this.snapshots = parsedData.snapshots || [];
      this.actionHistory = parsedData.actionHistory || [];

      this.recordAction('IMPORT', {
        sessionCount: this.sessions.length,
        snapshotCount: this.snapshots.length,
      });

      globalLogger.info('Debug data imported', {
        sessionCount: this.sessions.length,
        snapshotCount: this.snapshots.length,
      });

      return true;
    } catch (error) {
      globalLogger.error('Failed to import debug data', error as Error);
      return false;
    }
  }

  /**
   * Get state diff between two snapshots
   */
  getSnapshotDiff(fromSnapshotId: string, toSnapshotId: string): StateDiff | null {
    const fromSnapshot = this.snapshots.find(s => s.id === fromSnapshotId);
    const toSnapshot = this.snapshots.find(s => s.id === toSnapshotId);

    if (!fromSnapshot || !toSnapshot) {
      return null;
    }

    return this.calculateStateDiff(fromSnapshot.state, toSnapshot.state);
  }

  /**
   * Search snapshots by state content
   */
  searchSnapshots(query: string): StateSnapshot[] {
    const lowerQuery = query.toLowerCase();
    
    return this.snapshots.filter(snapshot => {
      const stateStr = JSON.stringify(snapshot.state).toLowerCase();
      const actionStr = (snapshot.action || '').toLowerCase();
      const metadataStr = JSON.stringify(snapshot.metadata || {}).toLowerCase();
      
      return stateStr.includes(lowerQuery) || 
             actionStr.includes(lowerQuery) || 
             metadataStr.includes(lowerQuery);
    });
  }

  /**
   * Get performance metrics for state operations
   */
  getPerformanceMetrics(): {
    averageSnapshotSize: number;
    snapshotsPerSecond: number;
    memoryUsage: number;
    totalSnapshots: number;
  } {
    const totalSize = this.snapshots.reduce((sum, snapshot) => 
      sum + JSON.stringify(snapshot.state).length, 0
    );
    
    const averageSnapshotSize = this.snapshots.length > 0 ? totalSize / this.snapshots.length : 0;
    
    const sessionDuration = this.currentSession 
      ? Date.now() - this.currentSession.startTime
      : 0;
    
    const snapshotsPerSecond = sessionDuration > 0 
      ? (this.snapshots.length / sessionDuration) * 1000 
      : 0;

    return {
      averageSnapshotSize,
      snapshotsPerSecond,
      memoryUsage: totalSize,
      totalSnapshots: this.snapshots.length,
    };
  }

  /**
   * Calculate state difference
   */
  private calculateStateDiff(prevState: any, nextState: any): StateDiff {
    const diff: StateDiff = {
      added: {},
      modified: {},
      removed: {},
    };

    // Find added and modified keys
    for (const key in nextState) {
      if (this.config.excludeKeys.includes(key)) continue;

      if (!(key in prevState)) {
        diff.added[key] = nextState[key];
      } else if (prevState[key] !== nextState[key]) {
        diff.modified[key] = {
          from: prevState[key],
          to: nextState[key],
        };
      }
    }

    // Find removed keys
    for (const key in prevState) {
      if (this.config.excludeKeys.includes(key)) continue;

      if (!(key in nextState)) {
        diff.removed[key] = prevState[key];
      }
    }

    return diff;
  }

  /**
   * Sanitize state by removing excluded keys
   */
  private sanitizeState<T>(state: T): T {
    if (typeof state !== 'object' || state === null) {
      return state;
    }

    const sanitized = { ...state } as any;
    
    for (const key of this.config.excludeKeys) {
      delete sanitized[key];
    }

    return sanitized;
  }

  /**
   * Record a debug action
   */
  private recordAction(type: DebugAction['type'], payload?: any): void {
    const action: DebugAction = {
      type,
      payload,
      timestamp: Date.now(),
      metadata: {
        sessionId: this.currentSession?.id,
      },
    };

    this.actionHistory.push(action);

    // Keep only last 1000 actions
    if (this.actionHistory.length > 1000) {
      this.actionHistory = this.actionHistory.slice(-1000);
    }
  }

  /**
   * Start auto-snapshot timer
   */
  private startAutoSnapshot(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
    }

    this.snapshotTimer = setInterval(() => {
      for (const [storeName, subscription] of this.subscriptions) {
        this.captureSnapshot(storeName, subscription.store.getState(), 'auto-snapshot');
      }
    }, this.config.snapshotInterval) as any;
  }

  /**
   * Export data to CSV format
   */
  private exportToCsv(data: any): string {
    const snapshots = data.snapshots.map((s: StateSnapshot) => [
      s.id,
      s.timestamp,
      s.storeName,
      s.action || '',
      JSON.stringify(s.state),
      JSON.stringify(s.metadata || {}),
    ]);

    const headers = ['id', 'timestamp', 'storeName', 'action', 'state', 'metadata'];
    return [headers, ...snapshots].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique snapshot ID
   */
  private generateSnapshotId(): string {
    return `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// DEBUG UTILITIES
// ============================================================================

/**
 * Debug utilities for development
 */
export class DebugUtils {
  /**
   * Pretty print state with syntax highlighting
   */
  static prettyPrint(state: any, indent = 2): string {
    return JSON.stringify(state, null, indent);
  }

  /**
   * Compare two states and highlight differences
   */
  static compareStates(state1: any, state2: any): {
    equal: boolean;
    differences: string[];
    summary: string;
  } {
    const diff1 = this.getObjectDifferences(state1, state2, 'state1');
    const diff2 = this.getObjectDifferences(state2, state1, 'state2');
    const differences = [...diff1, ...diff2];

    return {
      equal: differences.length === 0,
      differences,
      summary: differences.length === 0 
        ? 'States are identical' 
        : `Found ${differences.length} differences`,
    };
  }

  /**
   * Validate state structure
   */
  static validateState<T extends BaseState>(state: T): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required BaseState properties
    if (typeof state.loading !== 'boolean') {
      errors.push('loading must be a boolean');
    }

    if (state.error !== null && typeof state.error !== 'string') {
      errors.push('error must be null or string');
    }

    if (state.lastUpdated !== null && typeof state.lastUpdated !== 'string') {
      errors.push('lastUpdated must be null or string');
    }

    // Check for circular references
    try {
      JSON.stringify(state);
    } catch (error) {
      errors.push('State contains circular references');
    }

    // Check state size
    const stateSize = JSON.stringify(state).length;
    if (stateSize > 1024 * 1024) { // 1MB
      warnings.push(`State is large (${(stateSize / 1024 / 1024).toFixed(2)}MB)`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get memory usage of state
   */
  static getStateMemoryUsage(state: any): {
    sizeInBytes: number;
    sizeInKB: number;
    sizeInMB: number;
    formattedSize: string;
  } {
    const sizeInBytes = new Blob([JSON.stringify(state)]).size;
    const sizeInKB = sizeInBytes / 1024;
    const sizeInMB = sizeInKB / 1024;

    let formattedSize: string;
    if (sizeInMB >= 1) {
      formattedSize = `${sizeInMB.toFixed(2)} MB`;
    } else if (sizeInKB >= 1) {
      formattedSize = `${sizeInKB.toFixed(2)} KB`;
    } else {
      formattedSize = `${sizeInBytes} bytes`;
    }

    return {
      sizeInBytes,
      sizeInKB,
      sizeInMB,
      formattedSize,
    };
  }

  private static getObjectDifferences(obj1: any, obj2: any, prefix: string): string[] {
    const differences: string[] = [];

    for (const key in obj1) {
      const path = `${prefix}.${key}`;
      
      if (!(key in obj2)) {
        differences.push(`${path} exists only in ${prefix}`);
      } else if (typeof obj1[key] !== typeof obj2[key]) {
        differences.push(`${path} type differs: ${typeof obj1[key]} vs ${typeof obj2[key]}`);
      } else if (obj1[key] !== obj2[key]) {
        if (typeof obj1[key] === 'object' && obj1[key] !== null) {
          differences.push(...this.getObjectDifferences(obj1[key], obj2[key], path));
        } else {
          differences.push(`${path} value differs: ${obj1[key]} vs ${obj2[key]}`);
        }
      }
    }

    return differences;
  }
}

// ============================================================================
// GLOBAL STATE INSPECTOR
// ============================================================================

/**
 * Global state inspector instance
 */
export const globalStateInspector = new StateInspector({
  maxSnapshots: 1000,
  enableTimeTravel: process.env.NODE_ENV === 'development',
  enableStateDiff: true,
  enablePerformanceTracking: true,
  autoSnapshot: false,
  snapshotInterval: 10000, // 10 seconds
});

// ============================================================================
// EXPORTS
// ============================================================================

export {
  StateInspector,
  DebugUtils,
  globalStateInspector,
  type StateSnapshot,
  type StateDiff,
  type DebugSession,
  type StateInspectorConfig,
  type DebugAction,
}; 