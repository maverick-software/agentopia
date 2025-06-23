/**
 * Structured Logging System
 * 
 * Provides comprehensive logging capabilities for the unified state management
 * library with structured metadata, filtering, persistence, and performance
 * optimization features.
 */

import type { LogEntry, PerformanceMetric } from '../core/types';

// ============================================================================
// CORE LOGGING TYPES
// ============================================================================

/**
 * Log level enumeration with numeric values for comparison
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Log category for organizing log entries
 */
export type LogCategory = 
  | 'state-management'
  | 'performance'
  | 'cache'
  | 'middleware'
  | 'auth'
  | 'workflow'
  | 'ui'
  | 'api'
  | 'error'
  | 'debug';

/**
 * Log transport interface for different output destinations
 */
export interface LogTransport {
  name: string;
  level: LogLevel;
  enabled: boolean;
  write(entry: LogEntry): Promise<void> | void;
  flush?(): Promise<void> | void;
  close?(): Promise<void> | void;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  maxEntries: number;
  enableConsole: boolean;
  enableStorage: boolean;
  enableRemote: boolean;
  storageKey: string;
  remoteEndpoint?: string;
  categories: LogCategory[];
  transports: LogTransport[];
  metadata: Record<string, any>;
}

/**
 * Log filter function
 */
export type LogFilter = (entry: LogEntry) => boolean;

/**
 * Log formatter function
 */
export type LogFormatter = (entry: LogEntry) => string;

// ============================================================================
// STRUCTURED LOGGER CLASS
// ============================================================================

/**
 * Main structured logger class
 */
export class StructuredLogger {
  private config: LoggerConfig;
  private entries: LogEntry[] = [];
  private filters: LogFilter[] = [];
  private sessionId: string;
  private userId?: string;
  private startTime: number;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      maxEntries: 1000,
      enableConsole: true,
      enableStorage: false,
      enableRemote: false,
      storageKey: 'catalyst-logs',
      categories: ['state-management', 'performance', 'error'],
      transports: [],
      metadata: {},
      ...config,
    };

    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();

    // Initialize default transports
    this.initializeDefaultTransports();

    // Load persisted logs if storage is enabled
    if (this.config.enableStorage) {
      this.loadPersistedLogs();
    }

    this.info('Logger initialized', {
      sessionId: this.sessionId,
      config: this.config,
    });
  }

  /**
   * Set user context for all subsequent logs
   */
  setUser(userId: string, metadata?: Record<string, any>): void {
    this.userId = userId;
    if (metadata) {
      this.config.metadata = { ...this.config.metadata, ...metadata };
    }
    this.info('User context set', { userId, metadata });
  }

  /**
   * Add a log filter
   */
  addFilter(filter: LogFilter): void {
    this.filters.push(filter);
  }

  /**
   * Remove a log filter
   */
  removeFilter(filter: LogFilter): void {
    const index = this.filters.indexOf(filter);
    if (index > -1) {
      this.filters.splice(index, 1);
    }
  }

  /**
   * Add a transport
   */
  addTransport(transport: LogTransport): void {
    this.config.transports.push(transport);
  }

  /**
   * Remove a transport
   */
  removeTransport(name: string): void {
    this.config.transports = this.config.transports.filter(t => t.name !== name);
  }

  /**
   * Debug level logging
   */
  debug(message: string, metadata?: Record<string, any>, category: LogCategory = 'debug'): void {
    this.log(LogLevel.DEBUG, category, message, metadata);
  }

  /**
   * Info level logging
   */
  info(message: string, metadata?: Record<string, any>, category: LogCategory = 'state-management'): void {
    this.log(LogLevel.INFO, category, message, metadata);
  }

  /**
   * Warning level logging
   */
  warn(message: string, metadata?: Record<string, any>, category: LogCategory = 'state-management'): void {
    this.log(LogLevel.WARN, category, message, metadata);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error, metadata?: Record<string, any>, category: LogCategory = 'error'): void {
    const errorMetadata = error ? {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      ...metadata,
    } : metadata;

    this.log(LogLevel.ERROR, category, message, errorMetadata);
  }

  /**
   * Performance logging
   */
  performance(metric: PerformanceMetric): void {
    this.log(LogLevel.INFO, 'performance', `Performance: ${metric.operation}`, {
      duration: metric.duration,
      timestamp: metric.timestamp,
      ...metric.metadata,
    });
  }

  /**
   * State change logging
   */
  stateChange(storeName: string, action: string, prevState: any, nextState: any, duration?: number): void {
    this.log(LogLevel.DEBUG, 'state-management', `State changed: ${storeName}`, {
      store: storeName,
      action,
      duration,
      stateSize: JSON.stringify(nextState).length,
      hasChanges: prevState !== nextState,
    });
  }

  /**
   * Cache operation logging
   */
  cache(operation: string, key: string, hit: boolean, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, 'cache', `Cache ${operation}: ${key}`, {
      operation,
      key,
      hit,
      ...metadata,
    });
  }

  /**
   * API call logging
   */
  api(method: string, url: string, status: number, duration: number, metadata?: Record<string, any>): void {
    const level = status >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, 'api', `API ${method} ${url}`, {
      method,
      url,
      status,
      duration,
      ...metadata,
    });
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, category: LogCategory, message: string, metadata?: Record<string, any>): void {
    // Check if logging is enabled for this level and category
    if (level < this.config.level || !this.config.categories.includes(category)) {
      return;
    }

    const entry: LogEntry = {
      id: this.generateLogId(),
      timestamp: new Date().toISOString(),
      level: LogLevel[level].toLowerCase() as LogEntry['level'],
      category,
      message,
      metadata: {
        ...this.config.metadata,
        ...metadata,
        sessionId: this.sessionId,
        sessionDuration: Date.now() - this.startTime,
      },
      userId: this.userId,
      sessionId: this.sessionId,
    };

    // Apply filters
    if (this.filters.some(filter => !filter(entry))) {
      return;
    }

    // Add to entries array
    this.addEntry(entry);

    // Send to transports
    this.sendToTransports(entry);
  }

  /**
   * Add entry to internal storage
   */
  private addEntry(entry: LogEntry): void {
    this.entries.push(entry);

    // Maintain max entries limit
    if (this.entries.length > this.config.maxEntries) {
      this.entries = this.entries.slice(-this.config.maxEntries);
    }

    // Persist to storage if enabled
    if (this.config.enableStorage) {
      this.persistLogs();
    }
  }

  /**
   * Send entry to all enabled transports
   */
  private sendToTransports(entry: LogEntry): void {
    for (const transport of this.config.transports) {
      if (transport.enabled && LogLevel[entry.level.toUpperCase() as keyof typeof LogLevel] >= transport.level) {
        try {
          transport.write(entry);
        } catch (error) {
          console.error('Transport error:', error);
        }
      }
    }
  }

  /**
   * Get all log entries
   */
  getEntries(filter?: Partial<LogEntry>): LogEntry[] {
    if (!filter) return [...this.entries];

    return this.entries.filter(entry => {
      return Object.entries(filter).every(([key, value]) => {
        if (key === 'metadata' && typeof value === 'object') {
          return Object.entries(value).every(([metaKey, metaValue]) => 
            entry.metadata?.[metaKey] === metaValue
          );
        }
        return (entry as any)[key] === value;
      });
    });
  }

  /**
   * Get entries by category
   */
  getEntriesByCategory(category: LogCategory): LogEntry[] {
    return this.entries.filter(entry => entry.category === category);
  }

  /**
   * Get entries by level
   */
  getEntriesByLevel(level: LogLevel): LogEntry[] {
    const levelName = LogLevel[level].toLowerCase();
    return this.entries.filter(entry => entry.level === levelName);
  }

  /**
   * Get entries within time range
   */
  getEntriesByTimeRange(startTime: Date, endTime: Date): LogEntry[] {
    const start = startTime.toISOString();
    const end = endTime.toISOString();
    return this.entries.filter(entry => entry.timestamp >= start && entry.timestamp <= end);
  }

  /**
   * Search entries by message content
   */
  searchEntries(query: string): LogEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.entries.filter(entry => 
      entry.message.toLowerCase().includes(lowerQuery) ||
      JSON.stringify(entry.metadata).toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get log statistics
   */
  getStatistics(): {
    totalEntries: number;
    entriesByLevel: Record<string, number>;
    entriesByCategory: Record<string, number>;
    sessionDuration: number;
    averageEntriesPerMinute: number;
  } {
    const entriesByLevel: Record<string, number> = {};
    const entriesByCategory: Record<string, number> = {};

    for (const entry of this.entries) {
      entriesByLevel[entry.level] = (entriesByLevel[entry.level] || 0) + 1;
      entriesByCategory[entry.category] = (entriesByCategory[entry.category] || 0) + 1;
    }

    const sessionDuration = Date.now() - this.startTime;
    const sessionMinutes = sessionDuration / (1000 * 60);
    const averageEntriesPerMinute = sessionMinutes > 0 ? this.entries.length / sessionMinutes : 0;

    return {
      totalEntries: this.entries.length,
      entriesByLevel,
      entriesByCategory,
      sessionDuration,
      averageEntriesPerMinute,
    };
  }

  /**
   * Export logs in various formats
   */
  export(format: 'json' | 'csv' | 'text' = 'json'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(this.entries, null, 2);
      case 'csv':
        return this.exportToCsv();
      case 'text':
        return this.exportToText();
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Clear all log entries
   */
  clear(): void {
    this.entries = [];
    if (this.config.enableStorage) {
      localStorage.removeItem(this.config.storageKey);
    }
    this.info('Log entries cleared');
  }

  /**
   * Flush all transports
   */
  async flush(): Promise<void> {
    const flushPromises = this.config.transports
      .filter(transport => transport.flush)
      .map(transport => transport.flush!());

    await Promise.all(flushPromises);
  }

  /**
   * Close logger and cleanup resources
   */
  async close(): Promise<void> {
    this.info('Logger closing');
    
    await this.flush();

    const closePromises = this.config.transports
      .filter(transport => transport.close)
      .map(transport => transport.close!());

    await Promise.all(closePromises);
  }

  /**
   * Initialize default transports
   */
  private initializeDefaultTransports(): void {
    if (this.config.enableConsole) {
      this.addTransport(new ConsoleTransport());
    }

    if (this.config.enableStorage) {
      this.addTransport(new StorageTransport(this.config.storageKey));
    }

    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.addTransport(new RemoteTransport(this.config.remoteEndpoint));
    }
  }

  /**
   * Load persisted logs from storage
   */
  private loadPersistedLogs(): void {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (stored) {
        const parsedEntries = JSON.parse(stored);
        if (Array.isArray(parsedEntries)) {
          this.entries = parsedEntries.slice(-this.config.maxEntries);
        }
      }
    } catch (error) {
      console.error('Failed to load persisted logs:', error);
    }
  }

  /**
   * Persist logs to storage
   */
  private persistLogs(): void {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.entries));
    } catch (error) {
      console.error('Failed to persist logs:', error);
    }
  }

  /**
   * Export logs to CSV format
   */
  private exportToCsv(): string {
    const headers = ['timestamp', 'level', 'category', 'message', 'userId', 'sessionId', 'metadata'];
    const rows = this.entries.map(entry => [
      entry.timestamp,
      entry.level,
      entry.category,
      entry.message,
      entry.userId || '',
      entry.sessionId || '',
      JSON.stringify(entry.metadata || {}),
    ]);

    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  /**
   * Export logs to text format
   */
  private exportToText(): string {
    return this.entries.map(entry => {
      const metadata = entry.metadata ? ` | ${JSON.stringify(entry.metadata)}` : '';
      return `[${entry.timestamp}] ${entry.level.toUpperCase()} [${entry.category}] ${entry.message}${metadata}`;
    }).join('\n');
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique log entry ID
   */
  private generateLogId(): string {
    return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// BUILT-IN TRANSPORTS
// ============================================================================

/**
 * Console transport for development
 */
export class ConsoleTransport implements LogTransport {
  name = 'console';
  level = LogLevel.DEBUG;
  enabled = true;

  private formatter: LogFormatter;

  constructor(formatter?: LogFormatter) {
    this.formatter = formatter || this.defaultFormatter;
  }

  write(entry: LogEntry): void {
    const formatted = this.formatter(entry);
    
    switch (entry.level) {
      case 'debug':
        console.debug(formatted, entry.metadata);
        break;
      case 'info':
        console.info(formatted, entry.metadata);
        break;
      case 'warn':
        console.warn(formatted, entry.metadata);
        break;
      case 'error':
        console.error(formatted, entry.metadata);
        break;
    }
  }

  private defaultFormatter(entry: LogEntry): string {
    return `[${entry.timestamp}] ${entry.level.toUpperCase()} [${entry.category}] ${entry.message}`;
  }
}

/**
 * Storage transport for persistence
 */
export class StorageTransport implements LogTransport {
  name = 'storage';
  level = LogLevel.INFO;
  enabled = true;

  private storageKey: string;
  private buffer: LogEntry[] = [];
  private flushInterval: number;

  constructor(storageKey: string, flushInterval = 5000) {
    this.storageKey = `${storageKey}-transport`;
    this.flushInterval = flushInterval;
    
    // Auto-flush periodically
    setInterval(() => this.flush(), this.flushInterval);
  }

  write(entry: LogEntry): void {
    this.buffer.push(entry);
  }

  flush(): void {
    if (this.buffer.length === 0) return;

    try {
      const existing = localStorage.getItem(this.storageKey);
      const existingEntries = existing ? JSON.parse(existing) : [];
      const allEntries = [...existingEntries, ...this.buffer];
      
      // Keep only last 1000 entries
      const trimmedEntries = allEntries.slice(-1000);
      
      localStorage.setItem(this.storageKey, JSON.stringify(trimmedEntries));
      this.buffer = [];
    } catch (error) {
      console.error('Storage transport flush failed:', error);
    }
  }
}

/**
 * Remote transport for sending logs to server
 */
export class RemoteTransport implements LogTransport {
  name = 'remote';
  level = LogLevel.WARN;
  enabled = true;

  private endpoint: string;
  private buffer: LogEntry[] = [];
  private flushInterval: number;
  private maxBufferSize: number;

  constructor(endpoint: string, flushInterval = 10000, maxBufferSize = 100) {
    this.endpoint = endpoint;
    this.flushInterval = flushInterval;
    this.maxBufferSize = maxBufferSize;
    
    // Auto-flush periodically
    setInterval(() => this.flush(), this.flushInterval);
  }

  write(entry: LogEntry): void {
    this.buffer.push(entry);
    
    // Flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entries }),
      });
    } catch (error) {
      console.error('Remote transport flush failed:', error);
      // Re-add entries to buffer for retry
      this.buffer.unshift(...entries);
    }
  }
}

// ============================================================================
// GLOBAL LOGGER INSTANCE
// ============================================================================

/**
 * Global logger instance
 */
export const globalLogger = new StructuredLogger({
  level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsole: true,
  enableStorage: true,
  categories: ['state-management', 'performance', 'cache', 'middleware', 'auth', 'workflow', 'ui', 'api', 'error', 'debug'],
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a logger with specific configuration
 */
export function createLogger(config: Partial<LoggerConfig>): StructuredLogger {
  return new StructuredLogger(config);
}

/**
 * Create common log filters
 */
export const LogFilters = {
  byLevel: (level: LogLevel): LogFilter => 
    (entry) => LogLevel[entry.level.toUpperCase() as keyof typeof LogLevel] >= level,
  
  byCategory: (categories: LogCategory[]): LogFilter => 
    (entry) => categories.includes(entry.category),
  
  byUser: (userId: string): LogFilter => 
    (entry) => entry.userId === userId,
  
  byTimeRange: (start: Date, end: Date): LogFilter => 
    (entry) => entry.timestamp >= start.toISOString() && entry.timestamp <= end.toISOString(),
  
  excludeCategories: (categories: LogCategory[]): LogFilter => 
    (entry) => !categories.includes(entry.category),
};

// ============================================================================
// EXPORTS
// ============================================================================

export {
  StructuredLogger,
  ConsoleTransport,
  StorageTransport,
  RemoteTransport,
  LogLevel,
  type LogCategory,
  type LogTransport,
  type LoggerConfig,
  type LogFilter,
  type LogFormatter,
}; 