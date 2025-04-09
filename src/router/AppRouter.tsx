import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Login } from '../pages/Login';
import { Dashboard } from '../pages/Dashboard';
import { Agents } from '../pages/Agents';
import { AgentEdit } from '../pages/AgentEdit';
import { AgentChat } from '../pages/AgentChat';
import { Datastores } from '../pages/Datastores';
import { MCP } from '../pages/MCP';
import { Monitoring } from '../pages/Monitoring';
import { Settings } from '../pages/Settings';

/**
 * AppRouter component manages the application's routing logic.
 * It defines routes for various pages and handles navigation based on user authentication.
 *
 * @returns {JSX.Element} The rendered routes for the application.
 */
export function AppRouter() {
  // Get the current user and loading state from the authentication context
  const { user, loading } = useAuth();

  // Display a loading message while authentication state is being determined
  if (loading) {
    return <div>Loading...</div>;
  }

  // Define routes with authentication checks
  return (
    <Routes>
      {/* Redirect to login if user is not authenticated */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="/agents" element={user ? <Agents /> : <Navigate to="/login" />} />
      <Route path="/agents/new" element={user ? <AgentEdit /> : <Navigate to="/login" />} />
      <Route path="/agents/:id" element={user ? <AgentEdit /> : <Navigate to="/login" />} />
      <Route path="/agents/:id/chat" element={user ? <AgentChat /> : <Navigate to="/login" />} />
      <Route path="/datastores" element={user ? <Datastores /> : <Navigate to="/login" />} />
      <Route path="/mcp" element={user ? <MCP /> : <Navigate to="/login" />} />
      <Route path="/monitoring" element={user ? <Monitoring /> : <Navigate to="/login" />} />
      <Route path="/settings" element={user ? <Settings /> : <Navigate to="/login" />} />
    </Routes>
  );
}