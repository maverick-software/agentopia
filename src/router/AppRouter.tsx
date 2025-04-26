import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { Layout } from '../components/Layout.tsx';
import LoadingSpinner from '../components/LoadingSpinner.tsx';
import { AdminRoute } from './AdminRoute.tsx';
import { LoginPage } from '../pages/LoginPage.tsx';
import { RegisterPage } from '../pages/RegisterPage.tsx';
import UnauthorizedPage from '../pages/UnauthorizedPage.tsx';

// --- Import AgentEditPage directly ---
import { AgentEditPage } from '../pages/AgentEditPage.tsx'; 

// Lazy load page components
const DashboardPage = lazy(() => import('../pages/DashboardPage.tsx').then(module => ({ default: module.DashboardPage })));
const AgentsPage = lazy(() => import('../pages/AgentsPage.tsx').then(module => ({ default: module.AgentsPage })));
// const AgentEditPage = lazy(() => import('../pages/AgentEditPage.tsx').then(module => ({ default: module.AgentEditPage }))); // Commented out lazy load
const AgentChatPage = lazy(() => import('../pages/AgentChatPage.tsx').then(module => ({ default: module.AgentChatPage })));
const DatastoresPage = lazy(() => import('../pages/DatastoresPage.tsx').then(module => ({ default: module.DatastoresPage })));
const DatastoreEditPage = lazy(() => import('../pages/DatastoreEditPage.tsx'));
const AdminDashboardPage = lazy(() => import('../pages/AdminDashboardPage.tsx').then(module => ({ default: module.AdminDashboardPage })));
// --- Add Teams Pages --- 
const TeamsPage = lazy(() => import('../pages/TeamsPage.tsx').then(module => ({ default: module.TeamsPage })));
const CreateTeamPage = lazy(() => import('../pages/CreateTeamPage.tsx').then(module => ({ default: module.CreateTeamPage })));
const TeamDetailsPage = lazy(() => import('../pages/TeamDetailsPage.tsx').then(module => ({ default: module.TeamDetailsPage })));
const EditTeamPage = lazy(() => import('../pages/EditTeamPage.tsx').then(module => ({ default: module.EditTeamPage })));
// --- CORRECTED NEWLY ADDED PAGES --- 
const SettingsPage = lazy(() => import('../pages/SettingsPage.tsx').then(module => ({ default: module.Settings })));
const MCPPage = lazy(() => import('../pages/MCPPage.tsx').then(module => ({ default: module.MCP })));
const MonitoringPage = lazy(() => import('../pages/MonitoringPage.tsx').then(module => ({ default: module.Monitoring })));
const AdminUserManagement = lazy(() => import('../pages/AdminUserManagement.tsx').then(module => ({ default: module.AdminUserManagement })));
const AdminAgentManagement = lazy(() => import('../pages/AdminAgentManagement.tsx').then(module => ({ default: module.AdminAgentManagement })));
const HomePage = lazy(() => import('../pages/HomePage.tsx').then(module => ({ default: module.HomePage })));
// --- End Add --- 


// Protective Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth(); 

  // Log the state immediately upon render
  console.log(`[ProtectedRoute V5 - Render] loading: ${loading}, user: ${user ? user.id : null}`);

  if (loading) {
    console.log('[ProtectedRoute V5] Decision: Still loading auth state, showing spinner.');
    return <LoadingSpinner />; 
  }

  // If loading is finished, check the user state definitively.
  if (!user) { 
    console.log('[ProtectedRoute V5] Decision: Loading finished, user is null. ===> REDIRECTING TO /login NOW! <===');
    return <Navigate to="/login" replace />;
  }
  
  // Loading finished and user exists.
  console.log('[ProtectedRoute V5] Decision: Loading finished, user exists. Rendering children.');
  return <>{children}</>; 
};


const AppRouter: React.FC = () => {
  const { user } = useAuth();

  return (
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
          <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <RegisterPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* --- Protected Routes (Defined Individually) --- */}
          <Route path="/dashboard" element={<Layout><ProtectedRoute><DashboardPage /></ProtectedRoute></Layout>} />
          <Route path="/agents" element={<Layout><ProtectedRoute><AgentsPage /></ProtectedRoute></Layout>} />
          <Route path="/agents/new" element={<Layout><ProtectedRoute><AgentEditPage /></ProtectedRoute></Layout>} />
          <Route path="/agents/:agentId" element={<Layout><ProtectedRoute><AgentEditPage /></ProtectedRoute></Layout>} />
          <Route path="/agents/:agentId/edit" element={<Layout><ProtectedRoute><AgentEditPage /></ProtectedRoute></Layout>} />
          <Route path="/agents/:agentId/chat" element={<Layout><ProtectedRoute><AgentChatPage /></ProtectedRoute></Layout>} />
          <Route path="/datastores" element={<Layout><ProtectedRoute><DatastoresPage /></ProtectedRoute></Layout>} />
          <Route path="/datastores/new" element={<Layout><ProtectedRoute><DatastoreEditPage /></ProtectedRoute></Layout>} />
          <Route path="/datastores/:datastoreId/edit" element={<Layout><ProtectedRoute><DatastoreEditPage /></ProtectedRoute></Layout>} />
          <Route path="/teams" element={<Layout><ProtectedRoute><TeamsPage /></ProtectedRoute></Layout>} />
          <Route path="/teams/new" element={<Layout><ProtectedRoute><CreateTeamPage /></ProtectedRoute></Layout>} />
          <Route path="/teams/:teamId" element={<Layout><ProtectedRoute><TeamDetailsPage /></ProtectedRoute></Layout>} />
          <Route path="/teams/:teamId/edit" element={<Layout><ProtectedRoute><EditTeamPage /></ProtectedRoute></Layout>} />
          <Route path="/settings" element={<Layout><ProtectedRoute><SettingsPage /></ProtectedRoute></Layout>} />
          <Route path="/mcp" element={<Layout><ProtectedRoute><MCPPage /></ProtectedRoute></Layout>} />
          <Route path="/monitoring" element={<Layout><ProtectedRoute><MonitoringPage /></ProtectedRoute></Layout>} /> 

          {/* --- Admin Routes (Still Nested) --- */}
          <Route element={<Layout><AdminRoute><Outlet /></AdminRoute></Layout>}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<AdminUserManagement />} />
            <Route path="/admin/agents" element={<AdminAgentManagement />} />
          </Route>
          
          {/* --- Root Route --- */}
          <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <HomePage />} />

          {/* Default Catch-all route */}
          <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
        </Routes>
      </Suspense>
  );
};

export default AppRouter;