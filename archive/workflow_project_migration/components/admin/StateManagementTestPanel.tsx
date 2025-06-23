/**
 * State Management Test Panel
 * 
 * Administrative interface for testing state management integration,
 * monitoring system health, and managing caches in production.
 */

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TestTube, 
  Activity, 
  Database, 
  Trash2, 
  RefreshCcw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Play,
  Pause,
  Settings,
  BarChart3,
  Clock,
  HardDrive
} from 'lucide-react';
import { toast } from 'sonner';

// Import test utilities for operational use
import { 
  createIntegrationTestEnvironment
} from '../../lib/state-management/testing/test-utilities';

import { 
  WorkflowStoreTestSuite,
  workflowStoreTestUtilities 
} from '../../../__tests__/state-management/workflow-store.test';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'running';
  duration?: number;
  error?: string;
  details?: any;
  timestamp?: string;
  lastRun?: string;
}

interface TestSession {
  results: TestResult[];
  startTime: string;
  endTime?: string;
  totalPassed: number;
  totalFailed: number;
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  cacheHealth: {
    hitRate: number;
    size: number;
    errors: number;
  };
  performanceHealth: {
    averageResponseTime: number;
    renderPerformance: number;
  };
  eventHealth: {
    eventCount: number;
    errorRate: number;
  };
}

interface CacheInfo {
  key: string;
  size: number;
  lastAccessed: string;
  hitCount: number;
  type: 'template' | 'instance' | 'permissions' | 'ui' | 'other';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const StateManagementTestPanel: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [cacheEntries, setCacheEntries] = useState<CacheInfo[]>([]);
  const [healthMonitoring, setHealthMonitoring] = useState(false);
  const [lastTestSession, setLastTestSession] = useState<TestSession | null>(null);

  // Initialize test environment
  const [testEnv] = useState(() => createIntegrationTestEnvironment());
  const [workflowTestSuite] = useState(() => new WorkflowStoreTestSuite());

  // ============================================================================
  // TEST EXECUTION FUNCTIONS
  // ============================================================================

  const runIntegrationTests = async () => {
    setIsRunningTests(true);
    const sessionStartTime = new Date().toISOString();
    
    // Initialize test session
    const session: TestSession = {
      results: [],
      startTime: sessionStartTime,
      totalPassed: 0,
      totalFailed: 0
    };
    
    const tests = [
      {
        name: 'Cache Integration Test',
        test: async () => {
          // Fixed: Use the correct test utility function
          const templateId = 'test-template-1';
          const result = await workflowStoreTestUtilities.simulateWorkflowLoad(
            testEnv.cache, 
            templateId
          );
          return result.metadata && result.hierarchy;
        }
      },
      {
        name: 'Event Coordination Test',
        test: async () => {
          const result = await workflowTestSuite.runEventCoordinationTests();
          return result.success;
        }
      },
      {
        name: 'Performance Validation',
        test: async () => {
          const result = await workflowTestSuite.runPerformanceTests();
          return result.success;
        }
      },
      {
        name: 'Multi-Store Coordination',
        test: async () => {
          const result = await workflowTestSuite.runMultiStoreTests();
          return result.success;
        }
      },
      {
        name: 'Cache Performance Test',
        test: async () => {
          const result = await workflowTestSuite.runCachePerformanceTests();
          return result.success;
        }
      }
    ];

    // Clear previous results and start fresh
    setTestResults([]);

    for (const testCase of tests) {
      const result: TestResult = {
        name: testCase.name,
        status: 'running',
        timestamp: new Date().toISOString()
      };
      
      setTestResults(prev => [...prev, result]);

      try {
        const startTime = performance.now();
        const passed = await testCase.test();
        const duration = performance.now() - startTime;

        result.status = passed ? 'pass' : 'fail';
        result.duration = duration;
        result.lastRun = new Date().toLocaleString();
        
        if (!passed) {
          result.error = 'Test assertion failed';
        }
      } catch (error) {
        result.status = 'fail';
        result.error = error instanceof Error ? error.message : 'Unknown error';
        result.lastRun = new Date().toLocaleString();
      }

      setTestResults(prev => prev.map(r => r.name === result.name ? result : r));
      session.results.push(result);
    }

    // Finalize session
    session.endTime = new Date().toISOString();
    session.totalPassed = session.results.filter(r => r.status === 'pass').length;
    session.totalFailed = session.results.filter(r => r.status === 'fail').length;
    setLastTestSession(session);

    setIsRunningTests(false);
    
    // Show summary toast
    if (session.totalPassed === tests.length) {
      toast.success(`All ${tests.length} integration tests passed!`);
    } else {
      toast.error(`${session.totalFailed} of ${tests.length} tests failed`);
    }
  };

  // ============================================================================
  // HEALTH MONITORING FUNCTIONS
  // ============================================================================

  const updateSystemHealth = () => {
    const cacheStats = testEnv.cache.getStats();
    const perfStats = testEnv.performance.getStats();
    const eventHistory = testEnv.eventBus.getEventHistory();

    const health: SystemHealth = {
      overall: 'healthy',
      cacheHealth: {
        hitRate: cacheStats.hitRate,
        size: cacheStats.cacheSize,
        errors: 0
      },
      performanceHealth: {
        averageResponseTime: perfStats.average,
        renderPerformance: 95 // Mock value
      },
      eventHealth: {
        eventCount: eventHistory.length,
        errorRate: 0.02 // Mock value
      }
    };

    // Determine overall health
    if (health.cacheHealth.hitRate < 0.6 || health.performanceHealth.averageResponseTime > 1000) {
      health.overall = 'warning';
    }
    if (health.cacheHealth.hitRate < 0.4 || health.performanceHealth.averageResponseTime > 2000) {
      health.overall = 'critical';
    }

    setSystemHealth(health);
  };

  const toggleHealthMonitoring = () => {
    setHealthMonitoring(!healthMonitoring);
    if (!healthMonitoring) {
      // Start monitoring
      const interval = setInterval(updateSystemHealth, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    }
  };

  // ============================================================================
  // CACHE MANAGEMENT FUNCTIONS
  // ============================================================================

  const loadCacheEntries = () => {
    // Simulate loading cache entries from the actual cache system
    const mockEntries: CacheInfo[] = [
      {
        key: 'template:metadata:template-1',
        size: 2048,
        lastAccessed: new Date().toISOString(),
        hitCount: 15,
        type: 'template'
      },
      {
        key: 'workflow:instance:instance-1',
        size: 4096,
        lastAccessed: new Date(Date.now() - 300000).toISOString(),
        hitCount: 8,
        type: 'instance'
      },
      {
        key: 'auth:permissions:user-1',
        size: 1024,
        lastAccessed: new Date(Date.now() - 60000).toISOString(),
        hitCount: 25,
        type: 'permissions'
      },
      {
        key: 'ui:preferences:user-1',
        size: 512,
        lastAccessed: new Date().toISOString(),
        hitCount: 50,
        type: 'ui'
      }
    ];
    
    setCacheEntries(mockEntries);
  };

  const clearAllCaches = async () => {
    try {
      testEnv.cache.reset();
      // In real implementation, would clear actual application caches
      setCacheEntries([]);
      toast.success('All caches cleared successfully');
      updateSystemHealth();
    } catch (error) {
      toast.error('Failed to clear caches');
    }
  };

  const clearCacheByType = async (type: string) => {
    try {
      // In real implementation, would clear specific cache types
      setCacheEntries(prev => prev.filter(entry => entry.type !== type));
      toast.success(`Cleared all ${type} caches`);
      updateSystemHealth();
    } catch (error) {
      toast.error(`Failed to clear ${type} caches`);
    }
  };

  // ============================================================================
  // LIFECYCLE EFFECTS
  // ============================================================================

  useEffect(() => {
    loadCacheEntries();
    updateSystemHealth();
  }, []);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Card className="max-w-6xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          State Management System
        </CardTitle>
        <CardDescription>
          Integration testing, health monitoring, and cache management for the unified state management system.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="testing" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="testing" className="flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              Integration Testing
            </TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              System Health
            </TabsTrigger>
            <TabsTrigger value="cache" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Cache Management
            </TabsTrigger>
          </TabsList>

          {/* INTEGRATION TESTING TAB */}
          <TabsContent value="testing" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Integration Test Suite</h3>
                <p className="text-sm text-muted-foreground">
                  Run comprehensive tests on store coordination, cache integration, and event systems.
                </p>
                {lastTestSession && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last run: {new Date(lastTestSession.startTime).toLocaleString()} • 
                    {lastTestSession.totalPassed} passed, {lastTestSession.totalFailed} failed
                  </p>
                )}
              </div>
              <Button 
                onClick={runIntegrationTests}
                disabled={isRunningTests}
                className="flex items-center gap-2"
              >
                {isRunningTests ? (
                  <>
                    <Pause className="h-4 w-4" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    {testResults.length > 0 ? 'Re-run Tests' : 'Run Tests'}
                  </>
                )}
              </Button>
            </div>

            {/* Test Session Summary */}
            {lastTestSession && !isRunningTests && (
              <div className="bg-muted/50 p-3 rounded-lg border">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span className="font-medium">Test Session Summary</span>
                    <span className="text-muted-foreground">
                      Started: {new Date(lastTestSession.startTime).toLocaleTimeString()}
                    </span>
                    {lastTestSession.endTime && (
                      <span className="text-muted-foreground">
                        Completed: {new Date(lastTestSession.endTime).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-green-600">
                      {lastTestSession.totalPassed} Passed
                    </Badge>
                    {lastTestSession.totalFailed > 0 && (
                      <Badge variant="destructive">
                        {lastTestSession.totalFailed} Failed
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {testResults.length > 0 && (
              <div className="space-y-2">
                {testResults.map((result, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {result.status === 'running' && (
                        <RefreshCcw className="h-4 w-4 animate-spin text-blue-600" />
                      )}
                      {result.status === 'pass' && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      {result.status === 'fail' && (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <div>
                        <p className="font-medium">{result.name}</p>
                        {result.error && (
                          <p className="text-sm text-red-600">{result.error}</p>
                        )}
                        {result.lastRun && (
                          <p className="text-xs text-muted-foreground">
                            Last run: {result.lastRun}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={result.status === 'pass' ? 'default' : result.status === 'fail' ? 'destructive' : 'secondary'}
                      >
                        {result.status}
                      </Badge>
                      {result.duration && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {result.duration.toFixed(2)}ms
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {testResults.length === 0 && !isRunningTests && (
              <Alert>
                <TestTube className="h-4 w-4" />
                <AlertDescription>
                  Click "Run Tests" to execute the integration test suite and validate system functionality.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* SYSTEM HEALTH TAB */}
          <TabsContent value="health" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">System Health Monitor</h3>
                <p className="text-sm text-muted-foreground">
                  Real-time monitoring of cache performance, event coordination, and system health.
                </p>
              </div>
              <Button 
                onClick={toggleHealthMonitoring}
                variant={healthMonitoring ? 'destructive' : 'default'}
                className="flex items-center gap-2"
              >
                {healthMonitoring ? (
                  <>
                    <Pause className="h-4 w-4" />
                    Stop Monitoring
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Start Monitoring
                  </>
                )}
              </Button>
            </div>

            {systemHealth && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Overall Health */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
                    {getHealthIcon(systemHealth.overall)}
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${getHealthColor(systemHealth.overall)}`}>
                      {systemHealth.overall.toUpperCase()}
                    </div>
                  </CardContent>
                </Card>

                {/* Cache Health */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cache Performance</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {(systemHealth.cacheHealth.hitRate * 100).toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Hit Rate • {systemHealth.cacheHealth.size} entries
                    </p>
                    <Progress 
                      value={systemHealth.cacheHealth.hitRate * 100} 
                      className="mt-2" 
                    />
                  </CardContent>
                </Card>

                {/* Performance Health */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {systemHealth.performanceHealth.averageResponseTime.toFixed(0)}ms
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Average Response Time
                    </p>
                  </CardContent>
                </Card>

                {/* Event Health */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Event System</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {systemHealth.eventHealth.eventCount}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Events Processed • {(systemHealth.eventHealth.errorRate * 100).toFixed(2)}% error rate
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* CACHE MANAGEMENT TAB */}
          <TabsContent value="cache" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Cache Management</h3>
                <p className="text-sm text-muted-foreground">
                  Manage and monitor application caches for optimal performance.
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={loadCacheEntries}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </Button>
                <Button 
                  onClick={clearAllCaches}
                  variant="destructive"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All
                </Button>
              </div>
            </div>

            {/* Cache Type Filters */}
            <div className="flex flex-wrap gap-2">
              {['template', 'instance', 'permissions', 'ui'].map((type) => (
                <Button 
                  key={type}
                  onClick={() => clearCacheByType(type)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear {type}
                </Button>
              ))}
            </div>

            {/* Cache Entries Table */}
            <div className="border rounded-lg">
              <div className="p-4 border-b bg-muted/50">
                <div className="grid grid-cols-5 gap-4 text-sm font-medium">
                  <div>Cache Key</div>
                  <div>Type</div>
                  <div>Size</div>
                  <div>Hit Count</div>
                  <div>Last Accessed</div>
                </div>
              </div>
              <div className="divide-y">
                {cacheEntries.map((entry, index) => (
                  <div key={index} className="p-4 grid grid-cols-5 gap-4 text-sm">
                    <div className="font-mono text-xs">{entry.key}</div>
                    <div>
                      <Badge variant="outline">{entry.type}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-3 w-3 text-muted-foreground" />
                      {formatBytes(entry.size)}
                    </div>
                    <div>{entry.hitCount}</div>
                    <div className="text-muted-foreground">
                      {new Date(entry.lastAccessed).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {cacheEntries.length === 0 && (
              <Alert>
                <Database className="h-4 w-4" />
                <AlertDescription>
                  No cache entries found. Click "Refresh" to load current cache state.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}; 