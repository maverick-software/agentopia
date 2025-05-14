import { lazy } from 'react';

// This file centralizes the lazy loading definitions for page components. 

export const LoginPage = lazy(() => import('../pages/LoginPage').then(module => ({ default: module.LoginPage })));
export const RegisterPage = lazy(() => import('../pages/RegisterPage').then(module => ({ default: module.RegisterPage })));

// DashboardPage is imported directly in AppRouter.tsx and routeConfig.tsx.
// Lazy loading caused a 'TypeError: Cannot convert object to primitive value'
// during component initialization, likely due to timing interactions with
// hooks/data fetching within DashboardPage when loaded lazily.
// export const DashboardPage = lazy(() => import('../pages/DashboardPage')); 

export const AgentsPage = lazy(() => import('../pages/AgentsPage.tsx').then(module => ({ default: module.AgentsPage })));
// Note: AgentEditPage is currently directly imported in AppRouter.tsx
// export const AgentEditPage = lazy(() => import('../pages/AgentEditPage').then(module => ({ default: module.AgentEditPage })));
export const AgentEditPage = lazy(() => import('../pages/agents/[agentId]/edit'));
export const AgentChatPage = lazy(() => import('../pages/AgentChatPage.tsx').then(module => ({ default: module.AgentChatPage })));
export const DatastoresPage = lazy(() => import('../pages/DatastoresPage.tsx').then(module => ({ default: module.DatastoresPage })));
export const DatastoreEditPage = lazy(() => import('../pages/DatastoreEditPage.tsx'));
export const AdminDashboardPage = lazy(() => import('../pages/AdminDashboardPage.tsx').then(module => ({ default: module.AdminDashboardPage })));
export const TeamsPage = lazy(() => import('../pages/TeamsPage.tsx').then(module => ({ default: module.TeamsPage })));
export const CreateTeamPage = lazy(() => import('../pages/CreateTeamPage.tsx').then(module => ({ default: module.CreateTeamPage })));
export const TeamDetailsPage = lazy(() => import('../pages/TeamDetailsPage.tsx').then(module => ({ default: module.TeamDetailsPage })));
export const EditTeamPage = lazy(() => import('../pages/EditTeamPage.tsx').then(module => ({ default: module.EditTeamPage })));
export const SettingsPage = lazy(() => import('../pages/SettingsPage.tsx').then(module => ({ default: module.Settings })));
export const ToolboxesPage = lazy(() => import('../pages/ToolboxesPage').then(module => ({ default: module.ToolboxesPage })));
export const MonitoringPage = lazy(() => import('../pages/MonitoringPage.tsx').then(module => ({ default: module.Monitoring })));
export const AdminUserManagement = lazy(() => import('../pages/AdminUserManagement.tsx').then(module => ({ default: module.AdminUserManagement })));
export const AdminAgentManagement = lazy(() => import('../pages/AdminAgentManagement.tsx').then(module => ({ default: module.AdminAgentManagement })));
export const HomePage = lazy(() => import('../pages/HomePage.tsx').then(module => ({ default: module.HomePage }))); 

// Add WorkspacePage
export const WorkspacePage = lazy(() => import('../pages/WorkspacePage').then(module => ({ default: module.WorkspacePage })));
export const WorkspacesListPage = lazy(() => import('../pages/WorkspacesListPage').then(module => ({ default: module.WorkspacesListPage }))); 
export const CreateWorkspacePage = lazy(() => import('../pages/CreateWorkspacePage').then(module => ({ default: module.CreateWorkspacePage }))); 
// Add WorkspaceSettingsPage
export const WorkspaceSettingsPage = lazy(() => import('../pages/WorkspaceSettingsPage').then(module => ({ default: module.WorkspaceSettingsPage }))); 

// Commenting out missing pages to resolve Vite errors
// export const AgentStorePage = lazy(() => import('../pages/AgentStorePage.tsx'));
// export const DatasetStorePage = lazy(() => import('../pages/DatasetStorePage.tsx'));
// export const NotFoundPage = lazy(() => import('../pages/NotFoundPage.tsx')); 

export const ToolboxDetailPage = lazy(() => import('../pages/ToolboxDetailPage').then(module => ({ default: module.ToolboxDetailPage }))); 