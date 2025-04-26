import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface AdminRouteProps {
  // You could add props here if needed, e.g., required permissions
}

export function AdminRoute({}: AdminRouteProps) {
  const { user, isAdmin, loading, rolesLoading } = useAuth();

  const isLoading = loading || rolesLoading;
  
  // Add detailed logging
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
    // Redirect to dashboard explicitly instead of /
    return <Navigate to="/dashboard" replace />;
  }

  console.log('[AdminRoute V1] Decision: User is admin. Rendering Outlet.');
  return <Outlet />;
} 