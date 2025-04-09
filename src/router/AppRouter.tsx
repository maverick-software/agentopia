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

export function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route
        path="/"
        element={user ? <Dashboard /> : <Navigate to="/login" />}
      />
      <Route
        path="/agents"
        element={user ? <Agents /> : <Navigate to="/login" />}
      />
      <Route
        path="/agents/new"
        element={user ? <AgentEdit /> : <Navigate to="/login" />}
      />
      <Route
        path="/agents/:id"
        element={user ? <AgentEdit /> : <Navigate to="/login" />}
      />
      <Route
        path="/agents/:id/chat"
        element={user ? <AgentChat /> : <Navigate to="/login" />}
      />
      <Route
        path="/datastores"
        element={user ? <Datastores /> : <Navigate to="/login" />}
      />
      <Route
        path="/mcp"
        element={user ? <MCP /> : <Navigate to="/login" />}
      />
      <Route
        path="/monitoring"
        element={user ? <Monitoring /> : <Navigate to="/login" />}
      />
      <Route
        path="/settings"
        element={user ? <Settings /> : <Navigate to="/login" />}
      />
    </Routes>
  );
}