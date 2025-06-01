/**
 * Performance Monitoring Infrastructure
 * 
 * Provides comprehensive performance monitoring for the unified state management
 * library with metrics collection, analysis, alerting, and optimization
 * recommendations.
 */

import type { PerformanceMetric } from '../core/types';
import { globalLogger } from './logger';

// ============================================================================
// PERFORMANCE MONITORING TYPES
// ============================================================================

/**
 * Performance metric categories
 */
export type MetricCategory = 
  | 'state-update'
  | 'cache-operation'
  | 'render'
  | 'memory'
  | 'network'
  | 'user-interaction'
  | 'middleware'
  | 'store-creation';

/**
 * Performance threshold configuration
 */
export interface PerformanceThresholds {
  stateUpdate: number; // ms
  cacheOperation: number; // ms
  render: number; // ms
  memoryUsage: number; // bytes
  networkRequest: number; // ms
  userInteraction: number; // ms
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  id: string;
  type: 'threshold_exceeded' | 'memory_leak' | 'performance_degradation';
  category: MetricCategory;
  message: string;
  metric: PerformanceMetric;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

/**
 * Performance statistics
 */
export interface PerformanceStats {
  category: MetricCategory;
  count: number;
  average: number;
  min: number;
  max: number;
  median: number;
  p95: number;
  p99: number;
  standardDeviation: number;
  trend: 'improving' | 'stable' | 'degrading';
}

/**
 * Memory usage information
 */
export interface MemoryUsage {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  timestamp: number;
}

/**
 * Performance report
 */
export interface PerformanceReport {
  sessionId: string;
  startTime: number;
  endTime: number;
  duration: number;
  totalMetrics: number;
  stats: Record<MetricCategory, PerformanceStats>;
  alerts: PerformanceAlert[];
  memoryUsage: MemoryUsage[];
  recommendations: string[];
  score: number; // 0-100
}

// ============================================================================
// PERFORMANCE MONITOR CLASS
// ============================================================================

/**
 * Main performance monitoring class
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private memoryUsage: MemoryUsage[] = [];
  private activeOperations = new Map<string, { start: number; category: MetricCategory; metadata?: any }>();
  private sessionId: string;
  private startTime: number;
  private thresholds: PerformanceThresholds;
  private maxMetrics: number;
  private memoryCheckInterval: number;
  private alertCallbacks: Array<(alert: PerformanceAlert) => void> = [];

  constructor(config: {
    thresholds?: Partial<PerformanceThresholds>;
    maxMetrics?: number;
    memoryCheckInterval?: number;
  } = {}) {
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.maxMetrics = config.maxMetrics || 10000;
    this.memoryCheckInterval = config.memoryCheckInterval || 30000; // 30 seconds

    this.thresholds = {
      stateUpdate: 16, // One frame at 60fps
      cacheOperation: 5,
      render: 16,
      memoryUsage: 100 * 1024 * 1024, // 100MB
      networkRequest: 5000, // 5 seconds
      userInteraction: 100,
      ...config.thresholds,
    };

    // Start memory monitoring
    this.startMemoryMonitoring();

    globalLogger.info('Performance monitor initialized', {
      sessionId: this.sessionId,
      thresholds: this.thresholds,
    });
  }

  /**
   * Start timing an operation
   */
  startOperation(operationId: string, category: MetricCategory, metadata?: any): void {
    this.activeOperations.set(operationId, {
      start: performance.now(),
      category,
      metadata,
    });
  }

  /**
   * End timing an operation
   */
  endOperation(operationId: string, additionalMetadata?: any): PerformanceMetric | null {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      globalLogger.warn('Attempted to end unknown operation', { operationId });
      return null;
    }

    const duration = performance.now() - operation.start;
    this.activeOperations.delete(operationId);

    const metric: PerformanceMetric = {
      operation: operationId,
      duration,
      timestamp: Date.now(),
      metadata: {
        category: operation.category,
        sessionId: this.sessionId,
        ...operation.metadata,
        ...additionalMetadata,
      },
    };

    this.recordMetric(metric);
    return metric;
  }

  /**
   * Measure a synchronous operation
   */
  measure<T>(operationId: string, category: MetricCategory, fn: () => T, metadata?: any): T {
    this.startOperation(operationId, category, metadata);
    try {
      return fn();
    } finally {
      this.endOperation(operationId);
    }
  }

  /**
   * Measure an asynchronous operation
   */
  async measureAsync<T>(operationId: string, category: MetricCategory, fn: () => Promise<T>, metadata?: any): Promise<T> {
    this.startOperation(operationId, category, metadata);
    try {
      return await fn();
    } finally {
      this.endOperation(operationId);
    }
  }

  /**
   * Record a metric directly
   */
  recordMetric(metric: PerformanceMetric): void {
    // Add session metadata
    metric.metadata = {
      sessionId: this.sessionId,
      sessionDuration: Date.now() - this.startTime,
      ...metric.metadata,
    };

    this.metrics.push(metric);

    // Maintain max metrics limit
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Check for threshold violations
    this.checkThresholds(metric);

    // Log performance metric
    globalLogger.performance(metric);
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(): MemoryUsage | null {
    if (!(performance as any).memory) {
      return null;
    }

    const memory = (performance as any).memory;
    const usage: MemoryUsage = {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      timestamp: Date.now(),
    };

    this.memoryUsage.push(usage);

    // Keep only last 1000 memory readings
    if (this.memoryUsage.length > 1000) {
      this.memoryUsage = this.memoryUsage.slice(-1000);
    }

    // Check for memory issues
    this.checkMemoryThresholds(usage);

    return usage;
  }

  /**
   * Get performance statistics for a category
   */
  getStats(category?: MetricCategory): PerformanceStats | Record<MetricCategory, PerformanceStats> {
    if (category) {
      return this.calculateStats(category);
    }

    const categories: MetricCategory[] = [
      'state-update', 'cache-operation', 'render', 'memory', 
      'network', 'user-interaction', 'middleware', 'store-creation'
    ];

    const stats: Record<MetricCategory, PerformanceStats> = {} as any;
    for (const cat of categories) {
      stats[cat] = this.calculateStats(cat);
    }

    return stats;
  }

  /**
   * Get all metrics
   */
  getMetrics(filter?: { category?: MetricCategory; timeRange?: { start: number; end: number } }): PerformanceMetric[] {
    let filtered = [...this.metrics];

    if (filter?.category) {
      filtered = filtered.filter(m => m.metadata?.category === filter.category);
    }

    if (filter?.timeRange) {
      filtered = filtered.filter(m => 
        m.timestamp >= filter.timeRange!.start && m.timestamp <= filter.timeRange!.end
      );
    }

    return filtered;
  }

  /**
   * Get all alerts
   */
  getAlerts(filter?: { severity?: PerformanceAlert['severity']; category?: MetricCategory }): PerformanceAlert[] {
    let filtered = [...this.alerts];

    if (filter?.severity) {
      filtered = filtered.filter(a => a.severity === filter.severity);
    }

    if (filter?.category) {
      filtered = filtered.filter(a => a.category === filter.category);
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get memory usage history
   */
  getMemoryUsage(timeRange?: { start: number; end: number }): MemoryUsage[] {
    if (!timeRange) return [...this.memoryUsage];

    return this.memoryUsage.filter(m => 
      m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
    );
  }

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport {
    const endTime = Date.now();
    const stats = this.getStats() as Record<MetricCategory, PerformanceStats>;
    const score = this.calculatePerformanceScore(stats);

    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime,
      duration: endTime - this.startTime,
      totalMetrics: this.metrics.length,
      stats,
      alerts: this.alerts,
      memoryUsage: this.memoryUsage,
      recommendations: this.generateRecommendations(stats),
      score,
    };
  }

  /**
   * Add alert callback
   */
  onAlert(callback: (alert: PerformanceAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Remove alert callback
   */
  removeAlertCallback(callback: (alert: PerformanceAlert) => void): void {
    const index = this.alertCallbacks.indexOf(callback);
    if (index > -1) {
      this.alertCallbacks.splice(index, 1);
    }
  }

  /**
   * Clear all metrics and alerts
   */
  clear(): void {
    this.metrics = [];
    this.alerts = [];
    this.memoryUsage = [];
    this.activeOperations.clear();
    globalLogger.info('Performance monitor cleared');
  }

  /**
   * Export performance data
   */
  export(format: 'json' | 'csv' = 'json'): string {
    const data = {
      sessionId: this.sessionId,
      metrics: this.metrics,
      alerts: this.alerts,
      memoryUsage: this.memoryUsage,
      report: this.generateReport(),
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      return this.exportToCsv(data);
    }
  }

  /**
   * Calculate statistics for a category
   */
  private calculateStats(category: MetricCategory): PerformanceStats {
    const categoryMetrics = this.metrics.filter(m => m.metadata?.category === category);
    
    if (categoryMetrics.length === 0) {
      return {
        category,
        count: 0,
        average: 0,
        min: 0,
        max: 0,
        median: 0,
        p95: 0,
        p99: 0,
        standardDeviation: 0,
        trend: 'stable',
      };
    }

    const durations = categoryMetrics.map(m => m.duration).sort((a, b) => a - b);
    const count = durations.length;
    const sum = durations.reduce((a, b) => a + b, 0);
    const average = sum / count;
    const min = durations[0];
    const max = durations[count - 1];
    const median = durations[Math.floor(count / 2)];
    const p95 = durations[Math.floor(count * 0.95)];
    const p99 = durations[Math.floor(count * 0.99)];

    // Calculate standard deviation
    const variance = durations.reduce((acc, duration) => acc + Math.pow(duration - average, 2), 0) / count;
    const standardDeviation = Math.sqrt(variance);

    // Calculate trend (simplified)
    const trend = this.calculateTrend(categoryMetrics);

    return {
      category,
      count,
      average,
      min,
      max,
      median,
      p95,
      p99,
      standardDeviation,
      trend,
    };
  }

  /**
   * Calculate performance trend
   */
  private calculateTrend(metrics: PerformanceMetric[]): 'improving' | 'stable' | 'degrading' {
    if (metrics.length < 10) return 'stable';

    const recentMetrics = metrics.slice(-10);
    const olderMetrics = metrics.slice(-20, -10);

    if (olderMetrics.length === 0) return 'stable';

    const recentAvg = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length;
    const olderAvg = olderMetrics.reduce((sum, m) => sum + m.duration, 0) / olderMetrics.length;

    const change = (recentAvg - olderAvg) / olderAvg;

    if (change < -0.1) return 'improving';
    if (change > 0.1) return 'degrading';
    return 'stable';
  }

  /**
   * Check performance thresholds
   */
  private checkThresholds(metric: PerformanceMetric): void {
    const category = metric.metadata?.category as MetricCategory;
    if (!category) return;

    const threshold = this.thresholds[category];
    if (!threshold) return;

    if (metric.duration > threshold) {
      const alert: PerformanceAlert = {
        id: this.generateAlertId(),
        type: 'threshold_exceeded',
        category,
        message: `${category} operation exceeded threshold: ${metric.duration.toFixed(2)}ms > ${threshold}ms`,
        metric,
        timestamp: Date.now(),
        severity: this.calculateSeverity(metric.duration, threshold),
        recommendations: this.getThresholdRecommendations(category, metric.duration, threshold),
      };

      this.addAlert(alert);
    }
  }

  /**
   * Check memory thresholds
   */
  private checkMemoryThresholds(usage: MemoryUsage): void {
    const threshold = this.thresholds.memoryUsage;
    
    if (usage.usedJSHeapSize > threshold) {
      const alert: PerformanceAlert = {
        id: this.generateAlertId(),
        type: 'memory_leak',
        category: 'memory',
        message: `Memory usage exceeded threshold: ${(usage.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB > ${(threshold / 1024 / 1024).toFixed(2)}MB`,
        metric: {
          operation: 'memory-check',
          duration: 0,
          timestamp: usage.timestamp,
          metadata: { usage },
        },
        timestamp: Date.now(),
        severity: this.calculateMemorySeverity(usage.usedJSHeapSize, threshold),
        recommendations: this.getMemoryRecommendations(usage),
      };

      this.addAlert(alert);
    }
  }

  /**
   * Add alert and notify callbacks
   */
  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    // Notify callbacks
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        globalLogger.error('Alert callback error', error as Error);
      }
    }

    globalLogger.warn('Performance alert', { alert });
  }

  /**
   * Calculate alert severity
   */
  private calculateSeverity(value: number, threshold: number): PerformanceAlert['severity'] {
    const ratio = value / threshold;
    if (ratio > 5) return 'critical';
    if (ratio > 3) return 'high';
    if (ratio > 2) return 'medium';
    return 'low';
  }

  /**
   * Calculate memory alert severity
   */
  private calculateMemorySeverity(usage: number, threshold: number): PerformanceAlert['severity'] {
    const ratio = usage / threshold;
    if (ratio > 2) return 'critical';
    if (ratio > 1.5) return 'high';
    if (ratio > 1.2) return 'medium';
    return 'low';
  }

  /**
   * Get threshold-specific recommendations
   */
  private getThresholdRecommendations(category: MetricCategory, duration: number, threshold: number): string[] {
    const recommendations: string[] = [];

    switch (category) {
      case 'state-update':
        recommendations.push('Consider using shallow updates instead of deep object mutations');
        recommendations.push('Implement state normalization to reduce update complexity');
        recommendations.push('Use selectors to prevent unnecessary re-renders');
        break;
      case 'cache-operation':
        recommendations.push('Optimize cache key generation');
        recommendations.push('Consider using a more efficient serialization method');
        recommendations.push('Implement cache warming for frequently accessed data');
        break;
      case 'render':
        recommendations.push('Use React.memo for expensive components');
        recommendations.push('Implement virtualization for large lists');
        recommendations.push('Optimize component re-render patterns');
        break;
      default:
        recommendations.push('Review operation implementation for optimization opportunities');
    }

    return recommendations;
  }

  /**
   * Get memory-specific recommendations
   */
  private getMemoryRecommendations(usage: MemoryUsage): string[] {
    return [
      'Review cache size limits and implement LRU eviction',
      'Check for memory leaks in event listeners and subscriptions',
      'Consider implementing lazy loading for large datasets',
      'Review state normalization to reduce memory footprint',
      'Implement periodic garbage collection triggers',
    ];
  }

  /**
   * Calculate overall performance score
   */
  private calculatePerformanceScore(stats: Record<MetricCategory, PerformanceStats>): number {
    let score = 100;
    let totalWeight = 0;

    const weights: Record<MetricCategory, number> = {
      'state-update': 0.3,
      'cache-operation': 0.2,
      'render': 0.25,
      'memory': 0.15,
      'network': 0.05,
      'user-interaction': 0.05,
      'middleware': 0.0,
      'store-creation': 0.0,
    };

    for (const [category, weight] of Object.entries(weights)) {
      if (weight === 0) continue;
      
      const stat = stats[category as MetricCategory];
      if (stat.count === 0) continue;

      const threshold = this.thresholds[category as MetricCategory];
      const penalty = Math.max(0, (stat.average - threshold) / threshold * 100);
      
      score -= penalty * weight;
      totalWeight += weight;
    }

    // Adjust for alerts
    const criticalAlerts = this.alerts.filter(a => a.severity === 'critical').length;
    const highAlerts = this.alerts.filter(a => a.severity === 'high').length;
    
    score -= criticalAlerts * 10;
    score -= highAlerts * 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(stats: Record<MetricCategory, PerformanceStats>): string[] {
    const recommendations: string[] = [];

    // Check each category for issues
    for (const [category, stat] of Object.entries(stats)) {
      const threshold = this.thresholds[category as MetricCategory];
      if (stat.average > threshold) {
        recommendations.push(`Optimize ${category} operations (avg: ${stat.average.toFixed(2)}ms > ${threshold}ms)`);
      }
    }

    // Add general recommendations based on trends
    const degradingCategories = Object.values(stats).filter(s => s.trend === 'degrading');
    if (degradingCategories.length > 0) {
      recommendations.push('Performance is degrading over time - review recent changes');
    }

    return recommendations;
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    setInterval(() => {
      this.recordMemoryUsage();
    }, this.memoryCheckInterval);
  }

  /**
   * Export data to CSV format
   */
  private exportToCsv(data: any): string {
    const metrics = data.metrics.map((m: PerformanceMetric) => [
      m.operation,
      m.duration,
      m.timestamp,
      m.metadata?.category || '',
      JSON.stringify(m.metadata || {}),
    ]);

    const headers = ['operation', 'duration', 'timestamp', 'category', 'metadata'];
    return [headers, ...metrics].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// GLOBAL PERFORMANCE MONITOR
// ============================================================================

/**
 * Global performance monitor instance
 */
export const globalPerformanceMonitor = new PerformanceMonitor({
  thresholds: {
    stateUpdate: 16,
    cacheOperation: 5,
    render: 16,
    memoryUsage: 100 * 1024 * 1024, // 100MB
    networkRequest: 5000,
    userInteraction: 100,
  },
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Decorator for measuring method performance
 */
export function measurePerformance(category: MetricCategory) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const operationId = `${target.constructor.name}.${propertyKey}`;
      return globalPerformanceMonitor.measure(operationId, category, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Decorator for measuring async method performance
 */
export function measureAsyncPerformance(category: MetricCategory) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const operationId = `${target.constructor.name}.${propertyKey}`;
      return await globalPerformanceMonitor.measureAsync(operationId, category, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  PerformanceMonitor,
  globalPerformanceMonitor,
  measurePerformance,
  measureAsyncPerformance,
  type MetricCategory,
  type PerformanceThresholds,
  type PerformanceAlert,
  type PerformanceStats,
  type MemoryUsage,
  type PerformanceReport,
}; 