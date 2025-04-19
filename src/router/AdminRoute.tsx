import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface AdminRouteProps {
  // You could add props here if needed, e.g., required permissions
}

export function AdminRoute({}: AdminRouteProps) {
  const { user, isAdmin, loading, rolesLoading } = useAuth();

  const isLoading = loading || rolesLoading;

  if (isLoading) {
    // Optional: Show a loading indicator while checking auth/roles
    // Or return null/empty fragment to prevent brief flashes of content
    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-white">Checking permissions...</div>
        </div>
    );
  }

  if (!user) {
    // If user is not logged in, redirect to login
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    // If user is logged in but not an admin, redirect to dashboard (or show an unauthorized page)
    console.warn('AdminRoute: User is not an admin. Redirecting.');
    return <Navigate to="/" replace />;
  }

  // If user is logged in and is an admin, render the child route component
  return <Outlet />;
} 