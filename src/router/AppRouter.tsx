import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { AdminRoute } from './AdminRoute';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import UnauthorizedPage from '../pages/UnauthorizedPage';

// Lazy load page components
const DashboardPage = lazy(() => import('../pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const AgentsPage = lazy(() => import('../pages/AgentsPage').then(module => ({ default: module.AgentsPage })));
const AgentEditPage = lazy(() => import('../pages/AgentEditPage').then(module => ({ default: module.AgentEditPage })));
const AgentChatPage = lazy(() => import('../pages/AgentChatPage').then(module => ({ default: module.AgentChatPage })));
const DatastoresPage = lazy(() => import('../pages/DatastoresPage').then(module => ({ default: module.DatastoresPage })));
const DatastoreEditPage = lazy(() => import('../pages/DatastoreEditPage'));
const AdminDashboardPage = lazy(() => import('../pages/AdminDashboardPage').then(module => ({ default: module.AdminDashboardPage })));
// --- Add Teams Pages --- 
const TeamsPage = lazy(() => import('../pages/TeamsPage').then(module => ({ default: module.TeamsPage })));
const CreateTeamPage = lazy(() => import('../pages/CreateTeamPage').then(module => ({ default: module.CreateTeamPage })));
const TeamDetailsPage = lazy(() => import('../pages/TeamDetailsPage').then(module => ({ default: module.TeamDetailsPage })));
const EditTeamPage = lazy(() => import('../pages/EditTeamPage').then(module => ({ default: module.EditTeamPage })));
// --- End Add Teams Pages ---


// Protective Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth(); // Assuming useAuth provides a loading state

  if (loading) {
    return <LoadingSpinner />; // Show loading spinner while checking auth
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

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

          {/* Protected routes */}
          <Route path="/dashboard" element={<Layout><ProtectedRoute><DashboardPage /></ProtectedRoute></Layout>} />
          <Route path="/agents" element={<Layout><ProtectedRoute><AgentsPage /></ProtectedRoute></Layout>} />
          <Route path="/agents/new" element={<Layout><ProtectedRoute><AgentEditPage /></ProtectedRoute></Layout>} />
          <Route path="/agents/:agentId/edit" element={<Layout><ProtectedRoute><AgentEditPage /></ProtectedRoute></Layout>} />
          <Route path="/agents/:agentId/chat" element={<Layout><ProtectedRoute><AgentChatPage /></ProtectedRoute></Layout>} />
          <Route path="/datastores" element={<Layout><ProtectedRoute><DatastoresPage /></ProtectedRoute></Layout>} />
          <Route path="/datastores/new" element={<Layout><ProtectedRoute><DatastoreEditPage /></ProtectedRoute></Layout>} />
          <Route path="/datastores/:datastoreId/edit" element={<Layout><ProtectedRoute><DatastoreEditPage /></ProtectedRoute></Layout>} />

          {/* --- Add Teams Routes --- */}
          <Route path="/teams" element={<Layout><ProtectedRoute><TeamsPage /></ProtectedRoute></Layout>} />
          <Route path="/teams/new" element={<Layout><ProtectedRoute><CreateTeamPage /></ProtectedRoute></Layout>} />
          <Route path="/teams/:teamId" element={<Layout><ProtectedRoute><TeamDetailsPage /></ProtectedRoute></Layout>} />
          <Route path="/teams/:teamId/edit" element={<Layout><ProtectedRoute><EditTeamPage /></ProtectedRoute></Layout>} />
          {/* --- End Add Teams Routes --- */}

          {/* Admin routes */}
          <Route path="/admin" element={<Layout><AdminRoute><AdminDashboardPage /></AdminRoute></Layout>} />

          {/* Default route */}
          <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
        </Routes>
      </Suspense>
  );
};

export default AppRouter;