import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner'; // Keep spinner import

interface AdminRouteProps {
  // Props if needed
}

export function AdminRoute({}: AdminRouteProps) {
  const { user, isAdmin, loading, rolesLoading } = useAuth();

  // --- TEMPORARY SIMPLIFICATION --- 
  // Check user first (essential)
  if (!user) {
    // Even if initial loading is true, if no user object yet, redirect
    console.log('[AdminRoute Simplified] Decision: No user object. Redirecting to /login.');
    return <Navigate to="/login" replace />;
  }

  // If user exists, check isAdmin directly (ignoring loading states for now)
  if (!isAdmin) {
    console.warn('[AdminRoute Simplified] Decision: User exists but is not admin. Redirecting to /dashboard.');
    return <Navigate to="/dashboard" replace />;
  }
  
  // If user exists and isAdmin is true
  console.log('[AdminRoute Simplified] Decision: User exists and is admin. Rendering Outlet.');
  return <Outlet />;
  // --- END TEMPORARY SIMPLIFICATION ---

  /* Original Logic:
  const isLoading = loading || rolesLoading;
  console.log(`[AdminRoute V1] State: isLoading=${isLoading}, user=${user?.id}, isAdmin=${isAdmin}`);
  if (isLoading) {
    console.log('[AdminRoute V1] Decision: Checking permissions...');
    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-white">Checking permissions...</div>
        </div>
    );
  }
  if (!user) {
    console.log('[AdminRoute V1] Decision: No user found. Redirecting to /login.');
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin) {
    console.warn('[AdminRoute V1] Decision: User is not an admin. Redirecting to /dashboard.');
    return <Navigate to="/dashboard" replace />;
  }
  console.log('[AdminRoute V1] Decision: User is admin. Rendering Outlet.');
  return <Outlet />;
  */
} 