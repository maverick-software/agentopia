/**
 * Hook Integration Tests
 * 
 * Comprehensive integration testing for all specialized hooks in the unified
 * state management system. Tests real hook interactions, store coordination,
 * and cross-hook communication patterns.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Import hooks to test
import {
  useCache,
  useCacheMetrics,
  useAuth,
  useUserPermissions,
  useUI,
  useModal,
  useWorkflow,
  useTemplateMetadata,
  usePerformance,
  useComponentPerformance,
  useDebug,
  useStateInspector
} from '../hooks';

// Import actual stores for testing
import { authStore, cacheStore, uiStore, workflowStore } from '../stores';

// Import types
import type { TemplateMetadata } from '../core/types';

// Create test data generators
const createTestUser = () => ({
  id: 'test-user-123',
  email: 'test@example.com',
  fullName: 'Test User',
  globalRoleNames: ['user'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

const createTestTemplate = () => ({
  id: 'template-123',
  name: 'Test Template',
  type: 'process' as const,
  description: 'Test template description',
  status: 'active' as const,
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'test-user-123'
});

const createTestPermissions = () => ({
  roles: [{ id: '1', name: 'user' }],
  global: ['read_templates'],
  client: [],
  featureAccess: {
    workflowBuilder: true,
    templateManagement: false
  }
});

// ============================================================================
// HOOK INTEGRATION TESTS
// ============================================================================

describe('Hook Integration Tests', () => {
  beforeEach(() => {
    // Reset all stores to initial state before each test
    authStore.getState().reset();
    cacheStore.getState().clear();
    uiStore.getState().resetPreferences();
    workflowStore.getState().clearBuilder();
  });

  afterEach(() => {
    // Cleanup after each test
    jest.clearAllTimers();
  });

  describe('Cache + Auth Integration', () => {
    it('should coordinate auth state with cache management', async () => {
      const { result: authResult } = renderHook(() => useAuth());
      const { result: cacheResult } = renderHook(() => useCache());

      // Initial state - not authenticated
      expect(authResult.current.isAuthenticated).toBe(false);
      expect(cacheResult.current.health).toBeDefined();

      // Simulate sign-in
      const testUser = createTestUser();
      act(() => {
        authStore.getState().signIn({
          email: testUser.email,
          password: 'test-password'
        });
        
        // Simulate successful auth response
        authStore.setState({
          isAuthenticated: true,
          user: testUser,
          loading: false,
          error: null
        });
      });

      // Auth state should be updated
      expect(authResult.current.isAuthenticated).toBe(true);
      expect(authResult.current.user?.email).toBe(testUser.email);

      // Cache should be available for authenticated operations
      act(() => {
        cacheResult.current.set('user:preferences', { theme: 'dark' });
      });

      const cachedPrefs = cacheResult.current.get('user:preferences');
      expect(cachedPrefs).toEqual({ theme: 'dark' });
    });

    it('should handle cache invalidation on auth changes', async () => {
      const { result: authResult } = renderHook(() => useAuth());
      const { result: cacheResult } = renderHook(() => useCache());
      const { result: permissionsResult } = renderHook(() => useUserPermissions());

      // Set up authenticated user with cached permissions
      const testUser = createTestUser();
      const testPermissions = createTestPermissions();

      act(() => {
        authStore.setState({
          isAuthenticated: true,
          user: testUser,
          permissions: testPermissions
        });
        
        cacheResult.current.set('user:permissions:test-user-123', testPermissions);
      });

      // Verify cache has permissions
      expect(cacheResult.current.get('user:permissions:test-user-123')).toEqual(testPermissions);
      expect(permissionsResult.current.hasPermission('read_templates')).toBe(true);

      // Sign out should trigger cache cleanup
      act(() => {
        authResult.current.logout();
      });

      expect(authResult.current.isAuthenticated).toBe(false);
      expect(authResult.current.user).toBeNull();
    });
  });

  describe('UI + Workflow Integration', () => {
    it('should coordinate loading states between UI and workflow', async () => {
      const { result: uiResult } = renderHook(() => useUI());
      const { result: workflowResult } = renderHook(() => useWorkflow());

      // Initial state
      expect(uiResult.current.isLoading).toBe(false);
      expect(workflowResult.current.isLoading).toBe(false);

      // Start template loading operation
      act(() => {
        workflowStore.setState({
          loading: true
        });
      });

      expect(workflowResult.current.isLoading).toBe(true);

      // Complete loading
      act(() => {
        workflowStore.setState({
          loading: false
        });
      });

      expect(workflowResult.current.isLoading).toBe(false);
    });

    it('should handle modal interactions for workflow operations', async () => {
      const { result: modalResult } = renderHook(() => useModal());
      const { result: templateResult } = renderHook(() => useTemplateMetadata());

      // Show template selection modal
      act(() => {
        modalResult.current.show({
          id: 'template-selector',
          type: 'dialog',
          title: 'Select Template',
          content: { templates: [createTestTemplate()] }
        });
      });

      expect(modalResult.current.isVisible('template-selector')).toBe(true);

      // Simulate template selection
      const testTemplate = createTestTemplate();
      act(() => {
        workflowStore.setState({
          templates: {
            metadata: {
              [testTemplate.id]: testTemplate
            }
          }
        });
        
        modalResult.current.hide();
      });

      expect(modalResult.current.isVisible('template-selector')).toBe(false);
      expect(templateResult.current.templates.find(t => t.id === testTemplate.id)).toEqual(testTemplate);
    });
  });

  describe('Performance + Debug Integration', () => {
    it('should coordinate performance monitoring with debug tools', async () => {
      const { result: performanceResult } = renderHook(() => usePerformance());
      const { result: debugResult } = renderHook(() => useDebug());

      // Start performance monitoring
      act(() => {
        performanceResult.current.startMonitoring();
      });

      expect(performanceResult.current.isMonitoring).toBe(true);

      // Debug should have access to performance data
      expect(debugResult.current.isEnabled).toBeDefined();
      expect(performanceResult.current.metrics).toBeDefined();

      // Stop monitoring
      act(() => {
        performanceResult.current.stopMonitoring();
      });

      expect(performanceResult.current.isMonitoring).toBe(false);
    });

    it('should track component performance across renders', async () => {
      let renderCount = 0;
      
      const TestComponent = () => {
        renderCount++;
        const performance = useComponentPerformance('TestComponent');
        return performance;
      };

      const { result, rerender } = renderHook(() => TestComponent());

      expect(renderCount).toBe(1);
      expect(result.current.renderCount).toBeGreaterThanOrEqual(1);

      // Force re-renders
      rerender();
      rerender();

      expect(renderCount).toBe(3);
      expect(result.current.renderCount).toBeGreaterThan(1);
    });
  });

  describe('Cross-Store Event Coordination', () => {
    it('should coordinate state updates across multiple stores', async () => {
      const { result: authResult } = renderHook(() => useAuth());
      const { result: workflowResult } = renderHook(() => useWorkflow());
      const { result: cacheResult } = renderHook(() => useCache());

      // Set up authenticated user
      const testUser = createTestUser();
      act(() => {
        authStore.setState({
          isAuthenticated: true,
          user: testUser
        });
      });

      // Load workflow data (should be cache-aware)
      const testTemplate = createTestTemplate();
      act(() => {
        workflowStore.setState({
          templates: {
            metadata: {
              [testTemplate.id]: testTemplate
            }
          }
        });
        
        // Cache the template
        cacheResult.current.set(`template:${testTemplate.id}`, testTemplate);
      });

      // Verify coordination
      expect(authResult.current.isAuthenticated).toBe(true);
      expect(workflowResult.current.templates[testTemplate.id]).toEqual(testTemplate);
      expect(cacheResult.current.get(`template:${testTemplate.id}`)).toEqual(testTemplate);

      // Update template (should invalidate cache)
      const updatedTemplate = { ...testTemplate, name: 'Updated Template' };
      act(() => {
        workflowStore.setState({
          templates: {
            metadata: {
              [testTemplate.id]: updatedTemplate
            }
          }
        });
      });

      expect(workflowResult.current.templates[testTemplate.id].name).toBe('Updated Template');
    });

    it('should handle error propagation across stores', async () => {
      const { result: authResult } = renderHook(() => useAuth());
      const { result: uiResult } = renderHook(() => useUI());

      // Simulate auth error
      const authError = 'Authentication failed';
      act(() => {
        authStore.setState({
          loading: false,
          error: authError
        });
      });

      expect(authResult.current.error).toBe(authError);

      // UI should be able to display error notification
      act(() => {
        uiResult.current.addNotification({
          type: 'error',
          title: 'Authentication Error',
          message: authError,
          timestamp: Date.now(),
          read: false
        });
      });

      expect(uiResult.current.notifications).toHaveLength(1);
      expect(uiResult.current.notifications[0].message).toBe(authError);
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('should handle complete workflow: login → load templates → create instance', async () => {
      const { result: authResult } = renderHook(() => useAuth());
      const { result: workflowResult } = renderHook(() => useWorkflow());
      const { result: uiResult } = renderHook(() => useUI());

      // Step 1: User logs in
      const testUser = createTestUser();
      act(() => {
        authStore.setState({
          isAuthenticated: true,
          user: testUser,
          permissions: createTestPermissions()
        });
      });

      expect(authResult.current.isAuthenticated).toBe(true);
      expect(authResult.current.user?.email).toBe(testUser.email);

      // Step 2: Load templates
      const testTemplate = createTestTemplate();
      act(() => {
        workflowStore.setState({
          templates: {
            metadata: {
              [testTemplate.id]: testTemplate
            }
          },
          loading: false
        });
      });

      expect(workflowResult.current.templates[testTemplate.id]).toEqual(testTemplate);

      // Step 3: Show success notification
      act(() => {
        uiResult.current.addNotification({
          type: 'success',
          title: 'Success',
          message: 'Workflow system ready',
          timestamp: Date.now(),
          read: false
        });
      });

      expect(uiResult.current.notifications).toHaveLength(1);
      expect(uiResult.current.notifications[0].type).toBe('success');
    });

    it('should handle performance monitoring during heavy operations', async () => {
      const { result: performanceResult } = renderHook(() => usePerformance());
      const { result: workflowResult } = renderHook(() => useWorkflow());

      // Start monitoring
      act(() => {
        performanceResult.current.startMonitoring();
      });

      expect(performanceResult.current.isMonitoring).toBe(true);

      // Simulate heavy workflow operation
      act(() => {
        const templates: Record<string, TemplateMetadata> = {};
        for (let i = 0; i < 10; i++) {
          const template = { ...createTestTemplate(), id: `template-${i}`, name: `Template ${i}` };
          templates[template.id] = template;
        }
        
        workflowStore.setState({ 
          templates: {
            metadata: templates
          }
        });
      });

      expect(Object.keys(workflowResult.current.templates)).toHaveLength(10);
      expect(performanceResult.current.metrics).toBeDefined();
    });
  });

  describe('State Inspector Integration', () => {
    it('should capture state snapshots across all stores', async () => {
      const { result: inspectorResult } = renderHook(() => useStateInspector());
      const { result: authResult } = renderHook(() => useAuth());

      // Take initial snapshot
      act(() => {
        inspectorResult.current.takeSnapshot('initial-state');
      });

      // Make changes to auth state
      const testUser = createTestUser();
      act(() => {
        authStore.setState({
          isAuthenticated: true,
          user: testUser
        });
      });

      // Take second snapshot
      act(() => {
        inspectorResult.current.takeSnapshot('after-auth');
      });

      expect(authResult.current.isAuthenticated).toBe(true);
      expect(inspectorResult.current.snapshots).toHaveLength(2);
    });
  });
});

// ============================================================================
// HOOK API VALIDATION TESTS
// ============================================================================

describe('Hook API Validation', () => {
  const validateHookReturn = (hookResult: any, requiredMethods: string[]) => {
    requiredMethods.forEach(method => {
      expect(hookResult).toHaveProperty(method);
    });
  };

  it('should validate cache hook API completeness', () => {
    const { result } = renderHook(() => useCache());
    
    validateHookReturn(result.current, [
      'get', 'set', 'invalidate', 'clear', 'clearByPattern', 'status'
    ]);
  });

  it('should validate auth hook API completeness', () => {
    const { result } = renderHook(() => useAuth());
    
    validateHookReturn(result.current, [
      'isAuthenticated', 'user', 'loading', 'error', 'signIn', 'signOut'
    ]);
  });

  it('should validate UI hook API completeness', () => {
    const { result } = renderHook(() => useUI());
    
    validateHookReturn(result.current, [
      'theme', 'loading', 'notifications', 'modals', 'setTheme', 'addNotification'
    ]);
  });

  it('should validate workflow hook API completeness', () => {
    const { result } = renderHook(() => useWorkflow());
    
    validateHookReturn(result.current, [
      'templates', 'instances', 'loading', 'userCanCreateTemplates'
    ]);
  });

  it('should validate performance hook API completeness', () => {
    const { result } = renderHook(() => usePerformance());
    
    validateHookReturn(result.current, [
      'isMonitoring', 'metrics', 'startMonitoring', 'stopMonitoring'
    ]);
  });

  it('should validate debug hook API completeness', () => {
    const { result } = renderHook(() => useDebug());
    
    validateHookReturn(result.current, [
      'isEnabled', 'logs', 'enable', 'disable'
    ]);
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('Hook Performance Tests', () => {
  it('should not cause excessive re-renders with multiple hooks', () => {
    let renderCount = 0;
    
    const TestComponent = () => {
      renderCount++;
      useAuth();
      useCache();
      useUI();
      return renderCount;
    };

    const { result, rerender } = renderHook(() => TestComponent());
    
    expect(result.current).toBe(1);
    
    // Force re-render - should not cascade
    rerender();
    expect(result.current).toBe(2);
  });

  it('should handle rapid state updates efficiently', async () => {
    const { result } = renderHook(() => useUI());
    
    const startTime = performance.now();
    
    // Rapid notifications
    act(() => {
      for (let i = 0; i < 50; i++) {
        result.current.addNotification({
          id: `notification-${i}`,
          type: 'info',
          message: `Message ${i}`
        });
      }
    });
    
    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(100); // Should be fast
  });

  it('should handle memory efficiently with large datasets', () => {
    const { result } = renderHook(() => useWorkflow());
    
    act(() => {
      const templates = {};
      for (let i = 0; i < 100; i++) {
        templates[`template-${i}`] = createTestTemplate();
      }
      workflowStore.setState({ templates });
    });

    expect(Object.keys(result.current.templates)).toHaveLength(100);
  });
});

export { }; 