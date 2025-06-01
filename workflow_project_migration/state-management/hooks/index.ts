/**
 * State Management Hooks - Unified Export
 * 
 * Centralized exports for all state management hooks, providing a clean API
 * for consuming components. Includes generic hooks, specialized domain hooks,
 * and utility hooks with full TypeScript support.
 */

// ============================================================================
// GENERIC HOOKS
// ============================================================================

export {
  useStore,
  useStoreShallow,
  useSafeStore,
  useStoreWithPerformance,
  useStoreWithDebug,
  batchStoreUpdates,
  type UseStoreOptions,
} from './use-store';

// ============================================================================
// CACHE MANAGEMENT HOOKS
// ============================================================================

export {
  useCache,
  useCacheMetrics,
  useCacheInvalidation,
  useCacheWarming,
  useCacheEntry,
  useCacheHealth,
  type UseCacheReturn,
  type UseCacheMetricsReturn,
  type UseCacheInvalidationReturn,
  type UseCacheWarmingReturn,
} from './use-cache';

// ============================================================================
// AUTHENTICATION HOOKS
// ============================================================================

export {
  useAuth,
  useUserPermissions,
  useHasPermission,
  useUserRole,
  useClientPermissions,
  useIsAdmin,
  useIsSuperAdmin,
  useIsDeveloper,
  useIsClientAdmin,
  useActiveClient,
  useSessionStatus,
  useUserProfile,
  type UseAuthReturn,
  type UseUserPermissionsReturn,
  type UseUserRoleReturn,
  type UseClientPermissionsReturn,
  type LoginCredentials,
} from './use-auth';

// ============================================================================
// UI STATE MANAGEMENT HOOKS
// ============================================================================

export {
  useUI,
  useModal,
  useModalVisible,
  useNotifications,
  useToast,
  useUserPreferences,
  usePreference,
  useTheme,
  useSystemTheme,
  useSidebar,
  useLoading,
  useLoadingWithCleanup,
  type UseUIReturn,
  type UseModalReturn,
  type UseNotificationsReturn,
  type UseUserPreferencesReturn,
  type UseThemeReturn,
  type UseSidebarReturn,
} from './use-ui';

// ============================================================================
// WORKFLOW MANAGEMENT HOOKS
// ============================================================================

export {
  useWorkflow,
  useTemplateMetadata,
  useTemplateHierarchy,
  useWorkflowBuilder,
  useInstanceManagement,
  useStepData,
  useTemplateStatus,
  useInstanceStatus,
  type CreateInstanceData,
  type TemplateFilters,
  type UseWorkflowReturn,
  type UseTemplateMetadataReturn,
  type UseTemplateHierarchyReturn,
  type UseWorkflowBuilderReturn,
  type UseInstanceManagementReturn,
  type UseStepDataReturn,
} from './use-workflow';

// ============================================================================
// PERFORMANCE MONITORING HOOKS
// ============================================================================

export {
  usePerformance,
  useComponentPerformance,
  useOperationTiming,
  useMemoryMonitoring,
  usePerformanceAlerts,
  usePerformanceOptimization,
  usePerformanceTiming,
  usePerformanceThreshold,
  type UsePerformanceReturn,
  type UseComponentPerformanceReturn,
  type UseOperationTimingReturn,
  type UseMemoryMonitoringReturn,
  type UsePerformanceAlertsReturn,
  type UsePerformanceOptimizationReturn,
} from './use-performance';

// ============================================================================
// DEBUG & DEVELOPMENT HOOKS
// ============================================================================

export {
  useDebug,
  useStateInspector,
  useLogger,
  useDevUtils,
  useDebugConsole,
  useStoreDebug,
  useIsDevelopment,
  useDebugKeyboard,
  type UseDebugReturn,
  type UseStateInspectorReturn,
  type UseLoggerReturn,
  type UseDevUtilsReturn,
  type UseDebugConsoleReturn,
  type UseStoreDebugReturn,
} from './use-debug';

// ============================================================================
// STORE INSTANCES & TYPES (for advanced usage)
// ============================================================================

export {
  authStore,
  cacheStore,
  uiStore,
  workflowStore,
} from '../stores';

export type {
  AuthState,
  CacheState,
  UIState,
  WorkflowState,
  UserPermissions,
  AuthUser,
  GlobalUIState,
  UserPreferences,
  Modal,
  Notification,
  Toast,
} from '../core/types'; 