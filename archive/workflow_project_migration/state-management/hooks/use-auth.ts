/**
 * Authentication Hooks
 * 
 * Specialized hooks for authentication state, permission checking, and role-based
 * access control. Provides high-level abstractions for common auth patterns.
 */

import { useCallback, useMemo } from 'react';
import { useStore } from './use-store';
import { authStore } from '../stores';
import type { AuthUser, UserPermissions, AuthState } from '../core/types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Login credentials interface
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Core authentication state return type
 */
export interface UseAuthReturn {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<void>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<void>;
}

/**
 * User permissions return type
 */
export interface UseUserPermissionsReturn {
  permissions: UserPermissions | null;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  canAccessClient: (clientId: string) => boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Client permissions return type
 */
export interface UseClientPermissionsReturn {
  permissions: UserPermissions | null;
  canEdit: boolean;
  canDelete: boolean;
  canView: boolean;
  canManageUsers: boolean;
  isLoading: boolean;
}

/**
 * User role checking return type
 */
export interface UseUserRoleReturn {
  hasRole: boolean;
  roleLevel: number;
  isLoading: boolean;
}

// ============================================================================
// CORE AUTHENTICATION HOOK
// ============================================================================

/**
 * Core authentication hook
 * Provides authentication state and basic auth operations
 */
export function useAuth(): UseAuthReturn {
  // Subscribe to specific auth state slices for optimal performance
  const user = useStore(authStore, (state: AuthState) => state.user);
  const isLoading = useStore(authStore, (state: AuthState) => state.loading);
  const error = useStore(authStore, (state: AuthState) => state.error);
  
  // Actions accessed directly from store (not via state selectors)
  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    await authStore.getState().signIn(email, password);
  }, []);
  
  const logout = useCallback((): void => {
    authStore.getState().signOut();
  }, []);
  
  const refreshSession = useCallback(async (): Promise<void> => {
    await authStore.getState().refreshSession();
  }, []);
  
  const updateProfile = useCallback(async (updates: Partial<AuthUser>): Promise<void> => {
    await authStore.getState().updateProfile(updates);
  }, []);

  // Computed properties
  const isAuthenticated = useMemo(() => {
    return user !== null;
  }, [user]);

  // Wrap signIn to match expected interface
  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    await signIn(credentials.email, credentials.password);
  }, [signIn]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    refreshSession,
    updateProfile
  };
}

// ============================================================================
// PERMISSION CHECKING HOOKS
// ============================================================================

/**
 * User permissions hook
 * Provides comprehensive permission checking capabilities
 */
export function useUserPermissions(): UseUserPermissionsReturn {
  const permissions = useStore(authStore, (state: AuthState) => state.permissions);
  const isLoading = useStore(authStore, (state: AuthState) => state.loading);
  
  // Action accessed directly from store
  const loadPermissions = useCallback(async (): Promise<void> => {
    await authStore.getState().loadPermissions();
  }, []);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!permissions) return false;
    
    // Check global permissions
    if (permissions.global?.includes(permission)) return true;
    
    // Check role permissions - using correct roles structure
    const userRoles = permissions.roles || [];
    for (const role of userRoles) {
      if (role.permissions.includes(permission) || role.permissions.includes('admin:all')) {
        return true;
      }
    }
    
    return false;
  }, [permissions]);

  const hasRole = useCallback((role: string): boolean => {
    if (!permissions) return false;
    // Use correct roles structure instead of globalRoleNames
    return permissions.roles?.some(userRole => userRole.name === role) || false;
  }, [permissions]);

  const canAccessClient = useCallback((clientId: string): boolean => {
    if (!permissions) return false;
    
    // Super admin can access all clients
    if (permissions.roles?.some(role => role.name === 'admin')) return true;
    
    // Check if user has access to this client
    return permissions.client[clientId]?.length > 0 || false;
  }, [permissions]);

  const refresh = useCallback(async (): Promise<void> => {
    await loadPermissions();
  }, [loadPermissions]);

  return {
    permissions,
    hasPermission,
    hasRole,
    canAccessClient,
    isLoading,
    refresh
  };
}

/**
 * Specific permission checking hook
 * Optimized for checking a single permission with caching
 */
export function useHasPermission(permission: string): boolean {
  return useStore(
    authStore,
    useCallback((state: AuthState) => {
      if (!state.permissions) return false;
      
      // Check global permissions
      if (state.permissions.global?.includes(permission)) return true;
      
      // Check role permissions - using correct roles structure
      const userRoles = state.permissions.roles || [];
      return userRoles.some(role => 
        role.permissions.includes(permission) || role.permissions.includes('admin:all')
      );
    }, [permission])
  );
}

/**
 * Role checking hook
 * Optimized for checking a single role with additional metadata
 */
export function useUserRole(role: string): UseUserRoleReturn {
  const hasRole = useStore(
    authStore,
    useCallback((state: AuthState) => {
      // Use correct roles structure instead of globalRoleNames
      return state.permissions?.roles?.some(userRole => userRole.name === role) || false;
    }, [role])
  );

  const isLoading = useStore(authStore, (state: AuthState) => state.loading);

  // Role hierarchy levels (for comparison/authorization logic)
  const roleLevel = useMemo(() => {
    const roleLevels: Record<string, number> = {
      'user': 1,
      'client_admin': 2,
      'admin': 3,
      'super_admin': 4,
      'developer': 5
    };
    return roleLevels[role.toLowerCase()] || 0;
  }, [role]);

  return {
    hasRole,
    roleLevel,
    isLoading
  };
}

// ============================================================================
// CLIENT-SPECIFIC PERMISSION HOOKS
// ============================================================================

/**
 * Client permissions hook
 * Provides permissions for a specific client context
 */
export function useClientPermissions(clientId: string): UseClientPermissionsReturn {
  const clientPermissions = useStore(
    authStore,
    useCallback((state: AuthState) => {
      if (!state.permissions) return null;
      
      // Super admin has all permissions
      if (state.permissions.roles?.some(role => role.name === 'admin')) {
        return state.permissions;
      }
      
      // Return user permissions (simplified)
      return state.permissions;
    }, [clientId])
  );

  const isLoading = useStore(authStore, (state: AuthState) => state.loading);

  const canEdit = useMemo(() => {
    if (!clientPermissions) return false;
    return clientPermissions.roles?.some(role => role.name === 'admin') || false;
  }, [clientPermissions]);

  const canDelete = useMemo(() => {
    if (!clientPermissions) return false;
    return clientPermissions.roles?.some(role => role.name === 'admin') || false;
  }, [clientPermissions]);

  const canView = useMemo(() => {
    return clientPermissions !== null;
  }, [clientPermissions]);

  const canManageUsers = useMemo(() => {
    if (!clientPermissions) return false;
    return clientPermissions.roles?.some(role => role.name === 'admin') || false;
  }, [clientPermissions]);

  return {
    permissions: clientPermissions,
    canEdit,
    canDelete,
    canView,
    canManageUsers,
    isLoading
  };
}

// ============================================================================
// ADMIN & ROLE-BASED HOOKS
// ============================================================================

/**
 * Admin access hook
 * Simplified check for admin-level access
 */
export function useIsAdmin(): boolean {
  return useStore(
    authStore,
    useCallback((state: AuthState) => {
      return state.permissions?.roles?.some((role) => 
        ['admin', 'super_admin', 'developer'].includes(role.name.toLowerCase())
      ) || false;
    }, [])
  );
}

/**
 * Super admin access hook
 * Check for super admin access specifically
 */
export function useIsSuperAdmin(): boolean {
  return useStore(
    authStore,
    useCallback((state: AuthState) => {
      return state.permissions?.roles?.some(role => role.name === 'super_admin') || false;
    }, [])
  );
}

/**
 * Developer access hook
 * Check for developer access (includes debug features)
 */
export function useIsDeveloper(): boolean {
  return useStore(
    authStore,
    useCallback((state: AuthState) => {
      return state.permissions?.roles?.some(role => role.name === 'developer') || false;
    }, [])
  );
}

/**
 * Client admin hook
 * Check if user is admin for a specific client
 */
export function useIsClientAdmin(clientId: string): boolean {
  return useStore(
    authStore,
    useCallback((state: AuthState) => {
      if (!state.permissions) return false;
      
      // Super admin is admin everywhere
      if (state.permissions.roles?.some(role => role.name === 'admin')) return true;
      
      // Check client-specific admin role
      return state.permissions.roles?.some(role => 
        role.name === 'client_admin' && role.clientId === clientId
      ) || false;
    }, [clientId])
  );
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Active client hook
 * Manages active client context
 */
export function useActiveClient(): {
  activeClient: string | null;
  setActiveClient: (clientId: string) => Promise<void>;
  clearActiveClient: () => void;
  isLoading: boolean;
} {
  const activeClient = useStore(authStore, (state: AuthState) => state.activeClientId);
  const isLoading = useStore(authStore, (state: AuthState) => state.loading);
  
  // Actions accessed directly from store
  const setActiveClient = useCallback(async (clientId: string): Promise<void> => {
    await authStore.getState().setActiveClient(clientId);
  }, []);
  
  const clearActiveClient = useCallback((): void => {
    authStore.getState().clearActiveClient();
  }, []);

  return {
    activeClient,
    setActiveClient,
    clearActiveClient,
    isLoading
  };
}

/**
 * Session status hook
 * Monitors session health and expiration
 */
export function useSessionStatus(): {
  isValid: boolean;
  expiresAt: Date | null;
  timeUntilExpiry: number | null;
  needsRefresh: boolean;
} {
  const user = useStore(authStore, (state: AuthState) => state.user);

  return useMemo(() => {
    if (!user) {
      return {
        isValid: false,
        expiresAt: null,
        timeUntilExpiry: null,
        needsRefresh: false
      };
    }

    // Simplified session status (would use actual session expiry if available)
    return {
      isValid: true,
      expiresAt: null,
      timeUntilExpiry: null,
      needsRefresh: false
    };
  }, [user]);
}

/**
 * User profile hook
 * Focused hook for user profile information
 */
export function useUserProfile(): {
  profile: Pick<AuthUser, 'fullName' | 'email'> | null;
  isLoading: boolean;
  update: (updates: Partial<AuthUser>) => Promise<void>;
} {
  const user = useStore(authStore, (state: AuthState) => state.user);
  const isLoading = useStore(authStore, (state: AuthState) => state.loading);
  
  // Action accessed directly from store
  const updateProfile = useCallback(async (updates: Partial<AuthUser>): Promise<void> => {
    await authStore.getState().updateProfile(updates);
  }, []);

  const profile = useMemo(() => {
    if (!user) return null;
    return {
      fullName: user.fullName,
      email: user.email
    };
  }, [user]);

  return {
    profile,
    isLoading,
    update: updateProfile
  };
} 