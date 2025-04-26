import React, { Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminRoute } from './AdminRoute';
import { appRoutes, RouteConfig } from './routeConfig';

// Helper function to wrap element with necessary wrappers (Layout, Protection)
const wrapElement = (route: RouteConfig) => {
  let element = <route.element />;

  if (route.layout) {
    element = <Layout>{element}</Layout>;
  }

  if (route.protection === 'protected') {
    element = <ProtectedRoute>{element}</ProtectedRoute>;
  }
  
  // AdminRoute itself handles the protection and provides Outlet for children
  // So we only apply it to the parent /admin route definition
  if (route.protection === 'admin' && route.path === '/admin' && route.children) { 
      element = <Layout><AdminRoute>{element}</AdminRoute></Layout>; // Wrap base /admin element
  } else if (route.protection === 'admin') {
      // Child admin routes are rendered via Outlet within AdminRoute
      // No extra wrapper needed here, assuming they are defined as children
      // of the main '/admin' route in the config.
      // If a standalone admin route existed, it would need <AdminRoute><Page/></AdminRoute>
  }

  return element;
};

export const AppRouter: React.FC = () => {
  const { user } = useAuth();

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {appRoutes.map((route) => {
          // Handle public routes with redirects if user is logged in
          if (route.protection === 'public' && (route.path === '/login' || route.path === '/register')) {
            return (
              <Route 
                key={route.path}
                path={route.path}
                element={user ? <Navigate to="/dashboard" replace /> : wrapElement(route)} 
              />
            );
          }
          // Handle root route redirect if user is logged in
          if (route.path === '/') {
              return (
                <Route 
                  key={route.path}
                  path={route.path}
                  element={user ? <Navigate to="/dashboard" replace /> : wrapElement(route)} 
                />
              );
          }

          // Handle nested admin routes
          if (route.path === '/admin' && route.children) {
            return (
              <Route key={route.path} path={route.path} element={wrapElement(route)}>
                {/* Render base /admin route element if needed (already wrapped) */}
                {/* Currently, AdminRoute uses Outlet, so children are rendered directly */}
                {/* If /admin itself should show AdminDashboardPage, config needs adjustment */} 
                {/* Let's assume AdminRoute provides Outlet */} 
                <Route index element={<route.element />} /> {/* Render base element at /admin */} 
                {route.children.map(childRoute => (
                  <Route 
                    key={childRoute.path}
                    path={childRoute.path} 
                    element={wrapElement(childRoute)} // Children inherit protection, no layout needed
                  />
                ))}
              </Route>
            );
          }
          
          // Handle standard routes
          return (
            <Route 
              key={route.path}
              path={route.path}
              element={wrapElement(route)}
            />
          );
        })}
        
        {/* Default Catch-all route */}
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </Suspense>
  );
}; 