import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

import PublicLayout from '../layouts/PublicLayout';
import { Layout } from '../components/Layout';
import AdminLayout from '../layouts/AdminLayout'; // Assuming an AdminLayout exists

// Public Pages (Lazy Loaded)
const LoginPage = lazy(() => import('../pages/LoginPage').then(module => ({ default: module.LoginPage })) );
const HomePage = lazy(() => import('../pages/HomePage').then(module => ({ default: module.HomePage })) );

// Protected Pages (Lazy Loaded)
const DashboardPage = lazy(() => import('../pages/DashboardPage').then(module => ({ default: module.DashboardPage })) );
const AgentEditPage = lazy(() => import('../pages/AgentEditPage').then(module => ({ default: module.AgentEditPage })) );

// Admin Pages (Lazy Loaded)
const AdminDashboardPage = lazy(() => import('../pages/AdminDashboardPage').then(module => ({ default: module.AdminDashboardPage })) );
const AdminUserManagement = lazy(() => import('../pages/AdminUserManagement').then(module => ({ default: module.AdminUserManagement })) );
const AdminAgentManagement = lazy(() => import('../pages/AdminAgentManagement').then(module => ({ default: module.AdminAgentManagement })) ); // <-- New import

// Loading fallback
const LoadingSpinner = () => <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div></div>;

// Custom Route Wrappers
const PublicRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
    const { user } = useAuth();
    return !user ? children : <Navigate to="/dashboard" replace />;
};

const ProtectedRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
    const { user } = useAuth();
    return user ? children : <Navigate to="/login" replace />;
};

// We'll assume a function getUserRoles() exists in useAuth or is fetched elsewhere
// For now, simplify: Check if user exists (real check needed later)
const AdminRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
    const { user, isAdmin } = useAuth(); // Assuming useAuth provides isAdmin flag
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    if (!isAdmin) {
        // Redirect non-admins away, maybe to their dashboard or a specific "access denied" page
        return <Navigate to="/dashboard" replace />;
    }
    return children;
};

export function AppRouter() {
    return (
        <Suspense fallback={<LoadingSpinner />}>
            <Routes>
                {/* Public Routes */}
                <Route path="/" element={<PublicLayout><PublicRoute><HomePage /></PublicRoute></PublicLayout>} />
                <Route path="/login" element={<PublicLayout><PublicRoute><LoginPage /></PublicRoute></PublicLayout>} />
                {/* Add other public routes like /register, /about here */}

                {/* Protected Routes (Regular Users) - Use main Layout */}
                <Route path="/dashboard" element={<Layout><ProtectedRoute><DashboardPage /></ProtectedRoute></Layout>} />
                <Route path="/agent/create" element={<Layout><ProtectedRoute><AgentEditPage /></ProtectedRoute></Layout>} />
                <Route path="/agent/:agentId" element={<Layout><ProtectedRoute><AgentEditPage /></ProtectedRoute></Layout>} />
                {/* Add other protected user routes within Layout */}
                {/* Example: Ensure SettingsPage, etc., are imported if needed */}
                {/* <Route path="/settings" element={<Layout><ProtectedRoute><SettingsPage /></ProtectedRoute></Layout>} /> */}

                {/* Admin Routes - Use AdminLayout */}
                <Route path="/admin" element={<AdminLayout><AdminRoute><Navigate to="/admin/dashboard" replace /></AdminRoute></AdminLayout>} />
                <Route path="/admin/dashboard" element={<AdminLayout><AdminRoute><AdminDashboardPage /></AdminRoute></AdminLayout>} />
                <Route path="/admin/users" element={<AdminLayout><AdminRoute><AdminUserManagement /></AdminRoute></AdminLayout>} />
                <Route path="/admin/agents" element={<AdminLayout><AdminRoute><AdminAgentManagement /></AdminRoute></AdminLayout>} /> {/* <-- New route */}
                {/* Add other admin routes here */}

                {/* Fallback for unmatched routes */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
}