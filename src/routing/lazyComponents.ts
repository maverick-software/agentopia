import { lazy } from 'react';

// This file centralizes the lazy loading definitions for page components. 

export const LoginPage = lazy(() => import('../pages/LoginPage').then(module => ({ default: module.LoginPage })));
export const RegisterPage = lazy(() => import('../pages/RegisterPage').then(module => ({ default: module.RegisterPage })));

export const DashboardPage = lazy(() => import('../pages/DashboardPage.tsx').then(module => ({ default: module.DashboardPage })));
export const AgentsPage = lazy(() => import('../pages/AgentsPage.tsx').then(module => ({ default: module.AgentsPage })));
// Note: AgentEditPage is currently directly imported in AppRouter.tsx
export const AgentEditPage = lazy(() => import('../pages/AgentEditPage.tsx').then(module => ({ default: module.AgentEditPage })));
export const AgentChatPage = lazy(() => import('../pages/AgentChatPage.tsx').then(module => ({ default: module.AgentChatPage })));
export const DatastoresPage = lazy(() => import('../pages/DatastoresPage.tsx').then(module => ({ default: module.DatastoresPage })));
export const DatastoreEditPage = lazy(() => import('../pages/DatastoreEditPage.tsx'));
export const AdminDashboardPage = lazy(() => import('../pages/AdminDashboardPage.tsx').then(module => ({ default: module.AdminDashboardPage })));
export const TeamsPage = lazy(() => import('../pages/TeamsPage.tsx').then(module => ({ default: module.TeamsPage })));
export const CreateTeamPage = lazy(() => import('../pages/CreateTeamPage.tsx').then(module => ({ default: module.CreateTeamPage })));
export const TeamDetailsPage = lazy(() => import('../pages/TeamDetailsPage.tsx').then(module => ({ default: module.TeamDetailsPage })));
export const EditTeamPage = lazy(() => import('../pages/EditTeamPage.tsx').then(module => ({ default: module.EditTeamPage })));
export const SettingsPage = lazy(() => import('../pages/SettingsPage.tsx').then(module => ({ default: module.Settings })));
export const MCPPage = lazy(() => import('../pages/MCPPage.tsx').then(module => ({ default: module.MCP })));
export const MonitoringPage = lazy(() => import('../pages/MonitoringPage.tsx').then(module => ({ default: module.Monitoring })));
export const AdminUserManagement = lazy(() => import('../pages/AdminUserManagement.tsx').then(module => ({ default: module.AdminUserManagement })));
export const AdminAgentManagement = lazy(() => import('../pages/AdminAgentManagement.tsx').then(module => ({ default: module.AdminAgentManagement })));
export const HomePage = lazy(() => import('../pages/HomePage.tsx').then(module => ({ default: module.HomePage }))); 