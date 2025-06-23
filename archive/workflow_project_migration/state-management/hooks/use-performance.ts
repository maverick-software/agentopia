/**
 * Performance Monitoring Hooks
 * 
 * Specialized hooks for performance monitoring, metrics collection, and optimization
 * recommendations. Provides high-level abstractions for tracking component renders,
 * operation timing, memory usage, and performance alerts with automatic optimization.
 */

import { useCallback, useMemo, useEffect, useRef } from 'react';
import { useStore } from './use-store';
import { cacheStore } from '../stores';
import { globalPerformanceMonitor } from '../debug';
import type { 
  CacheState,
  PerformanceMetric 
} from '../core/types';
import type {
  PerformanceAlert,
  PerformanceStats,
  MemoryUsage,
  PerformanceReport
} from '../debug';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Performance monitoring return type
 */
export interface UsePerformanceReturn {
  metrics: PerformanceMetric[];
  alerts: PerformanceAlert[];
  stats: PerformanceStats | Record<string, PerformanceStats>;
  memoryUsage: MemoryUsage | null;
  isMonitoring: boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  clearMetrics: () => void;
  generateReport: () => PerformanceReport;
  getRecommendations: () => string[];
}

/**
 * Component performance return type
 */
export interface UseComponentPerformanceReturn {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  isSlowRender: boolean;
  renderHistory: number[];
  optimizationScore: number;
  recommendations: string[];
}

/**
 * Operation timing return type
 */
export interface UseOperationTimingReturn {
  startTiming: (operationName: string) => string;
  endTiming: (timingId: string) => number;
  getOperationStats: (operationName: string) => {
    count: number;
    average: number;
    min: number;
    max: number;
    total: number;
  };
  clearOperationStats: (operationName?: string) => void;
}

/**
 * Memory monitoring return type
 */
export interface UseMemoryMonitoringReturn {
  memoryUsage: MemoryUsage | null;
  isHighMemory: boolean;
  memoryTrend: 'increasing' | 'decreasing' | 'stable';
  recommendations: string[];
  triggerGarbageCollection: () => void;
  getMemoryBreakdown: () => Record<string, number>;
}

/**
 * Performance alerts return type
 */
export interface UsePerformanceAlertsReturn {
  alerts: PerformanceAlert[];
  activeAlerts: PerformanceAlert[];
  criticalAlerts: PerformanceAlert[];
  acknowledgeAlert: (alertId: string) => void;
  dismissAlert: (alertId: string) => void;
  clearAllAlerts: () => void;
  subscribeToAlerts: (callback: (alert: PerformanceAlert) => void) => () => void;
}

/**
 * Performance optimization return type
 */
export interface UsePerformanceOptimizationReturn {
  optimizationScore: number;
  bottlenecks: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    recommendation: string;
  }>;
  applyOptimizations: () => Promise<void>;
  getOptimizationReport: () => {
    current: number;
    potential: number;
    improvements: string[];
  };
}

// ============================================================================
// CORE PERFORMANCE HOOKS
// ============================================================================

/**
 * Core performance monitoring hook
 * Provides comprehensive performance monitoring and metrics collection
 */
export function usePerformance(): UsePerformanceReturn {
  const isMonitoring = useStore(cacheStore, (state: CacheState) => 
    state.status === 'healthy'
  );

  const stats = useMemo(() => {
    return globalPerformanceMonitor.getStats();
  }, []);

  const memoryUsage = useMemo((): MemoryUsage | null => {
    const usage = globalPerformanceMonitor.getMemoryUsage();
    return usage.length > 0 ? usage[usage.length - 1] : null;
  }, []);

  const alerts = useMemo((): PerformanceAlert[] => {
    return globalPerformanceMonitor.getAlerts();
  }, []);

  const metrics = useMemo((): PerformanceMetric[] => {
    return (globalPerformanceMonitor as any).metrics || [];
  }, []);

  const startMonitoring = useCallback((): void => {
    globalPerformanceMonitor.recordMemoryUsage();
  }, []);

  const stopMonitoring = useCallback((): void => {
  }, []);

  const clearMetrics = useCallback((): void => {
    globalPerformanceMonitor.clear();
  }, []);

  const generateReport = useCallback((): PerformanceReport => {
    return globalPerformanceMonitor.generateReport();
  }, []);

  const getRecommendations = useCallback((): string[] => {
    const report = globalPerformanceMonitor.generateReport();
    return report.recommendations;
  }, []);

  return {
    metrics,
    alerts,
    stats,
    memoryUsage,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    clearMetrics,
    generateReport,
    getRecommendations
  };
}

/**
 * Component performance monitoring hook
 * Tracks render performance for the component using this hook
 */
export function useComponentPerformance(componentName?: string): UseComponentPerformanceReturn {
  const renderCountRef = useRef(0);
  const renderTimesRef = useRef<number[]>([]);
  const lastRenderTimeRef = useRef(0);
  
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      renderCountRef.current += 1;
      lastRenderTimeRef.current = renderTime;
      renderTimesRef.current.push(renderTime);
      
      if (renderTimesRef.current.length > 20) {
        renderTimesRef.current = renderTimesRef.current.slice(-20);
      }
      
      if (componentName) {
        globalPerformanceMonitor.recordMetric({
          operation: `${componentName}_render`,
          duration: renderTime,
          timestamp: Date.now(),
          metadata: {
            renderCount: renderCountRef.current
          }
        });
      }
    };
  });

  const averageRenderTime = useMemo(() => {
    if (renderTimesRef.current.length === 0) return 0;
    return renderTimesRef.current.reduce((sum, time) => sum + time, 0) / renderTimesRef.current.length;
  }, [renderTimesRef.current.length]);

  const isSlowRender = useMemo(() => {
    return lastRenderTimeRef.current > 16;
  }, [lastRenderTimeRef.current]);

  const optimizationScore = useMemo(() => {
    if (renderTimesRef.current.length === 0) return 100;
    
    const fastRenders = renderTimesRef.current.filter(time => time <= 16).length;
    return Math.round((fastRenders / renderTimesRef.current.length) * 100);
  }, [renderTimesRef.current]);

  const recommendations = useMemo(() => {
    const recs: string[] = [];
    
    if (averageRenderTime > 32) {
      recs.push('Consider memoizing expensive computations with useMemo');
      recs.push('Review component for unnecessary re-renders');
    }
    
    if (averageRenderTime > 16) {
      recs.push('Consider breaking component into smaller components');
      recs.push('Use React.memo for pure components');
    }
    
    if (renderTimesRef.current.some(time => time > 100)) {
      recs.push('Investigate blocking operations in render method');
      recs.push('Consider moving heavy computations to useEffect');
    }
    
    return recs;
  }, [averageRenderTime]);

  return {
    renderCount: renderCountRef.current,
    lastRenderTime: lastRenderTimeRef.current,
    averageRenderTime,
    isSlowRender,
    renderHistory: [...renderTimesRef.current],
    optimizationScore,
    recommendations
  };
}

/**
 * Operation timing hook
 * Provides utilities for timing specific operations
 */
export function useOperationTiming(): UseOperationTimingReturn {
  const timingsRef = useRef<Map<string, number>>(new Map());
  const operationStatsRef = useRef<Map<string, number[]>>(new Map());

  const startTiming = useCallback((operationName: string): string => {
    const timingId = `${operationName}_${Date.now()}_${Math.random()}`;
    timingsRef.current.set(timingId, performance.now());
    return timingId;
  }, []);

  const endTiming = useCallback((timingId: string): number => {
    const startTime = timingsRef.current.get(timingId);
    if (!startTime) return 0;

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    const operationName = timingId.split('_')[0];
    
    if (!operationStatsRef.current.has(operationName)) {
      operationStatsRef.current.set(operationName, []);
    }
    operationStatsRef.current.get(operationName)!.push(duration);
    
    timingsRef.current.delete(timingId);
    
    globalPerformanceMonitor.recordMetric({
      operation: operationName,
      duration,
      timestamp: Date.now()
    });
    
    return duration;
  }, []);

  const getOperationStats = useCallback((operationName: string) => {
    const durations = operationStatsRef.current.get(operationName) || [];
    
    if (durations.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0, total: 0 };
    }
    
    const total = durations.reduce((sum, d) => sum + d, 0);
    const average = total / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    
    return {
      count: durations.length,
      average,
      min,
      max,
      total
    };
  }, []);

  const clearOperationStats = useCallback((operationName?: string): void => {
    if (operationName) {
      operationStatsRef.current.delete(operationName);
    } else {
      operationStatsRef.current.clear();
    }
  }, []);

  return {
    startTiming,
    endTiming,
    getOperationStats,
    clearOperationStats
  };
}

/**
 * Memory monitoring hook
 * Provides memory usage tracking and optimization recommendations
 */
export function useMemoryMonitoring(): UseMemoryMonitoringReturn {
  const memoryHistoryRef = useRef<number[]>([]);

  const memoryUsage = useMemo((): MemoryUsage | null => {
    const usage = globalPerformanceMonitor.getMemoryUsage();
    return usage.length > 0 ? usage[usage.length - 1] : null;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const usage = globalPerformanceMonitor.recordMemoryUsage();
      if (usage) {
        memoryHistoryRef.current.push(usage.usedJSHeapSize);
        
        if (memoryHistoryRef.current.length > 20) {
          memoryHistoryRef.current = memoryHistoryRef.current.slice(-20);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const isHighMemory = useMemo(() => {
    if (!memoryUsage) return false;
    return memoryUsage.usedJSHeapSize > memoryUsage.jsHeapSizeLimit * 0.8;
  }, [memoryUsage]);

  const memoryTrend = useMemo((): 'increasing' | 'decreasing' | 'stable' => {
    if (memoryHistoryRef.current.length < 3) return 'stable';
    
    const recent = memoryHistoryRef.current.slice(-3);
    const increasing = recent[2] > recent[1] && recent[1] > recent[0];
    const decreasing = recent[2] < recent[1] && recent[1] < recent[0];
    
    if (increasing) return 'increasing';
    if (decreasing) return 'decreasing';
    return 'stable';
  }, [memoryHistoryRef.current]);

  const recommendations = useMemo(() => {
    const recs: string[] = [];
    
    if (isHighMemory) {
      recs.push('Memory usage is high - consider clearing unnecessary caches');
      recs.push('Review large objects and consider lazy loading');
    }
    
    if (memoryTrend === 'increasing') {
      recs.push('Memory usage is consistently increasing - check for memory leaks');
      recs.push('Review event listeners and subscriptions for proper cleanup');
    }
    
    if (memoryUsage && memoryUsage.usedJSHeapSize > 100 * 1024 * 1024) {
      recs.push('Large memory footprint - consider code splitting');
      recs.push('Review image and asset loading strategies');
    }
    
    return recs;
  }, [isHighMemory, memoryTrend, memoryUsage]);

  const triggerGarbageCollection = useCallback((): void => {
    if ('gc' in window && typeof window.gc === 'function') {
      window.gc();
    }
  }, []);

  const getMemoryBreakdown = useCallback((): Record<string, number> => {
    if (!memoryUsage) return {};
    
    return {
      heap: memoryUsage.usedJSHeapSize,
      external: memoryUsage.totalJSHeapSize - memoryUsage.usedJSHeapSize,
      arrayBuffers: 0,
      code: 0
    };
  }, [memoryUsage]);

  return {
    memoryUsage,
    isHighMemory,
    memoryTrend,
    recommendations,
    triggerGarbageCollection,
    getMemoryBreakdown
  };
}

/**
 * Performance alerts hook
 * Manages performance alerts and notifications
 */
export function usePerformanceAlerts(): UsePerformanceAlertsReturn {
  const alerts = useMemo((): PerformanceAlert[] => {
    return globalPerformanceMonitor.getAlerts();
  }, []);

  const activeAlerts = useMemo(() => {
    return alerts.filter(alert => alert.severity !== 'low');
  }, [alerts]);

  const criticalAlerts = useMemo(() => {
    return alerts.filter(alert => alert.severity === 'critical');
  }, [alerts]);

  const acknowledgeAlert = useCallback((alertId: string): void => {
    globalPerformanceMonitor.clear();
  }, []);

  const dismissAlert = useCallback((alertId: string): void => {
    globalPerformanceMonitor.clear();
  }, []);

  const clearAllAlerts = useCallback((): void => {
    globalPerformanceMonitor.clear();
  }, []);

  const subscribeToAlerts = useCallback((callback: (alert: PerformanceAlert) => void) => {
    globalPerformanceMonitor.onAlert(callback);
    return () => {
    };
  }, []);

  return {
    alerts,
    activeAlerts,
    criticalAlerts,
    acknowledgeAlert,
    dismissAlert,
    clearAllAlerts,
    subscribeToAlerts
  };
}

/**
 * Performance optimization hook
 * Provides optimization analysis and recommendations
 */
export function usePerformanceOptimization(): UsePerformanceOptimizationReturn {
  const optimizationScore = useMemo(() => {
    const report = globalPerformanceMonitor.generateReport();
    return report.score;
  }, []);

  const bottlenecks = useMemo(() => {
    const alerts = globalPerformanceMonitor.getAlerts();
    return alerts.map(alert => ({
      type: alert.type,
      severity: alert.severity as 'low' | 'medium' | 'high',
      description: alert.message,
      recommendation: alert.recommendations.join(', ')
    }));
  }, []);

  const applyOptimizations = useCallback(async (): Promise<void> => {
    globalPerformanceMonitor.clear();
  }, []);

  const getOptimizationReport = useCallback(() => {
    const current = optimizationScore;
    const potential = Math.min(100, current + 20);
    const report = globalPerformanceMonitor.generateReport();
    
    return {
      current,
      potential,
      improvements: report.recommendations
    };
  }, [optimizationScore]);

  return {
    optimizationScore,
    bottlenecks,
    applyOptimizations,
    getOptimizationReport
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Performance timing hook
 * Simple timing utility for measuring operation duration
 */
export function usePerformanceTiming() {
  const { startTiming, endTiming } = useOperationTiming();
  
  return useCallback((operationName: string) => {
    const timingId = startTiming(operationName);
    
    return () => endTiming(timingId);
  }, [startTiming, endTiming]);
}

/**
 * Performance threshold hook
 * Monitors performance against specified thresholds
 */
export function usePerformanceThreshold(
  thresholds: Record<string, number>,
  onThresholdExceeded?: (metric: string, value: number, threshold: number) => void
) {
  const cacheMetrics = useStore(cacheStore, (state: CacheState) => state.metrics);

  useEffect(() => {
    if (!onThresholdExceeded) return;

    Object.entries(thresholds).forEach(([metric, threshold]) => {
      if (metric === 'cacheHitRate' && cacheMetrics.hitRate < threshold) {
        onThresholdExceeded(metric, cacheMetrics.hitRate, threshold);
      }
    });
  }, [cacheMetrics, thresholds, onThresholdExceeded]);

  return useMemo(() => {
    const violations: Record<string, { value: number; threshold: number }> = {};
    
    Object.entries(thresholds).forEach(([metric, threshold]) => {
      if (metric === 'cacheHitRate' && cacheMetrics.hitRate < threshold) {
        violations[metric] = { value: cacheMetrics.hitRate, threshold };
      }
    });
    
    return violations;
  }, [cacheMetrics, thresholds]);
} 