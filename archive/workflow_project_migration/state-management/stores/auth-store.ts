/**
 * Auth Store Implementation
 * 
 * Manages authentication state, user permissions, and client context with
 * comprehensive debug integration, performance monitoring, and caching support.
 */

import { createDomainStore } from '../core/store-debug';
import { 
  getCached, 
  setCached, 
  createCacheKey, 
  invalidateUser
} from '../cache/cache-integration';
import { globalEventBus } from '../composition/event-bus';
import type { 
  AuthState, 
  AuthUser,
  UserPermissions,
  StateCreator
} from '../core/types';

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialAuthState: AuthState = {
  // Base state properties
  loading: false,
  error: null,
  lastUpdated: null,
  
  // Auth-specific state
  user: null,
  permissions: null,
  activeClientId: null,
  clientPermissions: [],
  isFetchingPermissions: false,
};

// ============================================================================
// STORE CREATOR
// ============================================================================

const createAuthStore: StateCreator<AuthState> = (set, get) => ({
  ...initialAuthState,

  // ============================================================================
  // AUTHENTICATION ACTIONS
  // ============================================================================

  /**
   * Sign in user
   */
  signIn: async (email: string, password: string) => {
    const state = get();
    
    set({
      ...state,
      loading: true,
      error: null,
    });

    try {
      // TODO: Replace with actual authentication API call
      const user: AuthUser = {
        id: `user_${Date.now()}`,
        email,
        globalRoleNames: ['admin'],
        fullName: 'John Doe',
        defaultClientId: 'default-client',
        avatarUrl: undefined,
      };

      const newState = get();
      set({
        ...newState,
        user,
        loading: false,
        lastUpdated: new Date().toISOString(),
      });

      return user;
    } catch (error) {
      const currentState = get();
      set({
        ...currentState,
        loading: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      });
      throw error;
    }
  },

  /**
   * Sign out user
   */
  signOut: async () => {
    const state = get();
    
    set({
      ...state,
      loading: true,
      error: null,
    });

    try {
      // TODO: Replace with actual sign out API call
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call

      // Reset to initial state
      set({ ...initialAuthState });
      
      // Emit logout event for cache invalidation
      globalEventBus.emit('auth:logout', { userId: state.user?.id });
    } catch (error) {
      const currentState = get();
      set({
        ...currentState,
        loading: false,
        error: error instanceof Error ? error.message : 'Sign out failed',
      });
      throw error;
    }
  },

  /**
   * Refresh user session
   */
  refreshSession: async () => {
    const state = get();
    
    if (!state.user) {
      return;
    }

    set({
      ...state,
      loading: true,
      error: null,
    });

    try {
      // TODO: Replace with actual session refresh API call
      const refreshedUser: AuthUser = {
        ...state.user,
        // Update any fields that need refreshing
      };

      const newState = get();
      set({
        ...newState,
        user: refreshedUser,
        loading: false,
        lastUpdated: new Date().toISOString(),
      });

      return refreshedUser;
    } catch (error) {
      const currentState = get();
      set({
        ...currentState,
        loading: false,
        error: error instanceof Error ? error.message : 'Session refresh failed',
      });
      throw error;
    }
  },

  /**
   * Update user profile
   */
  updateProfile: async (updates: Partial<AuthUser>) => {
    const state = get();
    
    if (!state.user) {
      throw new Error('No user logged in');
    }

    set({
      ...state,
      loading: true,
      error: null,
    });

    try {
      // TODO: Replace with actual profile update API call
      const updatedUser: AuthUser = {
        ...state.user,
        ...updates,
      };

      const newState = get();
      set({
        ...newState,
        user: updatedUser,
        loading: false,
        lastUpdated: new Date().toISOString(),
      });

      // Cache updated user data
      setCached(
        createCacheKey.userPreferences(updatedUser.id),
        updatedUser,
        { dataType: 'user:prefs' }
      );

      // Emit event for cache coordination
      globalEventBus.emit('auth:user:updated', { 
        userId: updatedUser.id,
        user: updatedUser 
      });

      return updatedUser;
    } catch (error) {
      const currentState = get();
      set({
        ...currentState,
        loading: false,
        error: error instanceof Error ? error.message : 'Profile update failed',
      });
      throw error;
    }
  },

  // ============================================================================
  // PERMISSIONS ACTIONS
  // ============================================================================

  /**
   * Load user permissions with cache integration
   */
  loadPermissions: async () => {
    const state = get();
    
    if (!state.user) {
      throw new Error('No user logged in');
    }

    // Check if already fetching to prevent duplicate requests
    if (state.isFetchingPermissions) {
      return;
    }

    // Check if permissions already loaded
    if (state.permissions) {
      return state.permissions;
    }

    set({
      ...state,
      isFetchingPermissions: true,
      error: null,
    });

    try {
      const cacheKey = createCacheKey.permissions(state.user.id);
      
      // Use cache-first pattern with fallback
      const permissions = await getCached(
        cacheKey,
        async () => {
          // TODO: Replace with actual permissions API call
          const apiData: UserPermissions = {
            global: [
              'read:workflows',
              'write:workflows',
              'delete:workflows',
              'read:users',
              'write:users',
            ],
            client: {},
            roles: [
              {
                id: 'admin-role',
                name: 'admin',
                roleType: 'GLOBAL',
                permissions: [
                  'read:all',
                  'write:all',
                  'delete:all',
                  'admin:all',
                ],
              },
            ],
          };
          
          return apiData;
        },
        { dataType: 'permissions' }
      );

      const newState = get();
      set({
        ...newState,
        permissions,
        isFetchingPermissions: false,
        lastUpdated: new Date().toISOString(),
      });

      // Emit event for cache invalidation coordination
      globalEventBus.emit('auth:permissions:loaded', { 
        userId: state.user.id,
        permissions 
      });

      return permissions;
    } catch (error) {
      const currentState = get();
      set({
        ...currentState,
        isFetchingPermissions: false,
        error: error instanceof Error ? error.message : 'Failed to load permissions',
      });
      throw error;
    }
  },

  /**
   * Set active client with cache integration
   */
  setActiveClient: async (clientId: string) => {
    const state = get();
    
    if (!state.user) {
      throw new Error('No user logged in');
    }

    set({
      ...state,
      loading: true,
      error: null,
    });

    try {
      const cacheKey = createCacheKey.permissions(state.user.id, clientId);
      
      // Use cache-first pattern for client permissions
      const clientPermissions = await getCached(
        cacheKey,
        async () => {
          // TODO: Replace with actual client permissions API call
          return [
            'read:client-workflows',
            'write:client-workflows',
            'read:client-data',
          ];
        },
        { dataType: 'permissions' }
      );

      const newState = get();
      set({
        ...newState,
        activeClientId: clientId,
        clientPermissions,
        loading: false,
        lastUpdated: new Date().toISOString(),
      });

      // Emit event for cache coordination
      globalEventBus.emit('auth:client:changed', { 
        userId: state.user.id,
        clientId,
        permissions: clientPermissions 
      });

      return clientPermissions;
    } catch (error) {
      const currentState = get();
      set({
        ...currentState,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to set active client',
      });
      throw error;
    }
  },

  /**
   * Clear active client
   */
  clearActiveClient: () => {
    const state = get();
    
    set({
      ...state,
      activeClientId: null,
      clientPermissions: [],
      lastUpdated: new Date().toISOString(),
    });
  },

  /**
   * Check if user has permission
   */
  hasPermission: (permission: string, clientId?: string) => {
    const state = get();
    
    if (!state.permissions) {
      return false;
    }

    // Check global permissions
    if (state.permissions.global.includes(permission)) {
      return true;
    }

    // Check role permissions
    const userRoles = state.permissions.roles || [];
    for (const role of userRoles) {
      if (role.permissions.includes(permission) || role.permissions.includes('admin:all')) {
        return true;
      }
    }

    // Check client-specific permissions
    if (clientId && state.permissions.client[clientId]) {
      return state.permissions.client[clientId].includes(permission);
    }

    // Check current active client permissions
    if (state.activeClientId && state.clientPermissions.includes(permission)) {
      return true;
    }

    return false;
  },

  /**
   * Check if feature flag is enabled
   */
  hasFeatureFlag: (flag: string) => {
    const state = get();
    // Feature flags would be part of permissions or user data
    // For now, return false as this needs to be implemented
    return false;
  },

  // ============================================================================
  // UTILITY ACTIONS
  // ============================================================================

  /**
   * Reset store to initial state
   */
  reset: () => {
    set({ ...initialAuthState });
  },

  /**
   * Clear error state
   */
  clearError: () => {
    const state = get();
    set({
      ...state,
      error: null,
    });
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: () => {
    const state = get();
    return !!state.user;
  },

  /**
   * Check if user is admin
   */
  isAdmin: () => {
    const state = get();
    // Check if user has admin role in globalRoleNames
    return state.user?.globalRoleNames?.includes('admin') || 
           state.permissions?.roles?.some(role => 
             role.name === 'admin' || role.permissions.includes('admin:all')
           ) || false;
  },

  /**
   * Get user display name
   */
  getUserDisplayName: () => {
    const state = get();
    if (!state.user) return null;
    return state.user.fullName || state.user.email;
  },
});

// ============================================================================
// STORE INSTANCE
// ============================================================================

/**
 * Auth store with debug integration and performance monitoring
 */
export const useAuthStore = createDomainStore(
  'auth',
  createAuthStore,
  {
    debug: {
      enabled: true,
      enableLogging: true,
      enablePerformanceMonitoring: true,
      enableStateInspection: true,
      logCategory: 'auth',
      performanceCategory: 'state-update',
      logLevel: 'info',
    },
  }
);

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Get current user
 */
export const selectCurrentUser = (state: AuthState) => state.user;

/**
 * Get user permissions
 */
export const selectUserPermissions = (state: AuthState) => state.permissions;

/**
 * Get active client ID
 */
export const selectActiveClientId = (state: AuthState) => state.activeClientId;

/**
 * Get client permissions
 */
export const selectClientPermissions = (state: AuthState) => state.clientPermissions;

/**
 * Check if authenticated
 */
export const selectIsAuthenticated = (state: AuthState) => !!state.user;

/**
 * Check if admin
 */
export const selectIsAdmin = (state: AuthState) => 
  state.user?.globalRoleNames?.includes('admin') || 
  state.permissions?.roles?.some(role => 
    role.name === 'admin' || role.permissions.includes('admin:all')
  ) || false;

/**
 * Get user display name
 */
export const selectUserDisplayName = (state: AuthState) => {
  if (!state.user) return null;
  return state.user.fullName || state.user.email;
};

/**
 * Check if loading
 */
export const selectIsLoading = (state: AuthState) => state.loading;

/**
 * Check if fetching permissions
 */
export const selectIsFetchingPermissions = (state: AuthState) => state.isFetchingPermissions;

/**
 * Get error state
 */
export const selectError = (state: AuthState) => state.error;

/**
 * Check specific permission
 */
export const selectHasPermission = (permission: string, clientId?: string) => (state: AuthState) => {
  if (!state.permissions) return false;

  // Check global permissions
  if (state.permissions.global.includes(permission)) {
    return true;
  }

  // Check role permissions
  const userRoles = state.permissions.roles || [];
  for (const role of userRoles) {
    if (role.permissions.includes(permission) || role.permissions.includes('admin:all')) {
      return true;
    }
  }

  // Check client-specific permissions
  if (clientId && state.permissions.client[clientId]) {
    return state.permissions.client[clientId].includes(permission);
  }

  // Check current active client permissions
  if (state.activeClientId && state.clientPermissions.includes(permission)) {
    return true;
  }

  return false;
};

/**
 * Check feature flag
 */
export const selectHasFeatureFlag = (flag: string) => (state: AuthState) =>
  false; // Feature flags not yet implemented in permissions structure 