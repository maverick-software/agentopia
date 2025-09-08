import React from 'react';
import { Navigate } from 'react-router-dom'; // Import Navigate

// Define the types for route protection
export type ProtectionType = 'public' | 'protected' | 'admin';

// Define the structure for a single route configuration
export interface RouteConfig {
  path: string;
  element: React.ComponentType<any> | React.LazyExoticComponent<React.ComponentType<any>>;
  protection: ProtectionType;
  layout?: boolean; // true if requires the main Layout component
  exact?: boolean; // Optional: useful for matching '/' exactly
  children?: RouteConfig[]; // For nested routes (like admin section)
}

// Import page components (both lazy and direct)
// Note: Need to import all components referenced in the routes below
// import { AgentEditPage } from '../pages/AgentEditPage'; // Removed direct import
// import { LoginPage } from '../pages/LoginPage'; // Removed direct import
// import { RegisterPage } from '../pages/RegisterPage'; // Removed direct import
import UnauthorizedPage from '../pages/UnauthorizedPage';
import {
    AgentsPage,
    AgentChatPage,
    DatastoresPage,
    DatastoreEditPage,
    AdminDashboardPage,
    TeamsPage,
    TeamDetailsPage,
    EditTeamPage,
    SettingsPage,
    MonitoringPage,
    AdminUserManagement,
    AdminAgentManagement,
    AdminMCPMarketplaceManagement,
    AdminIntegrationManagement,
    HomePage,
    LoginPage, // Now imported here
    RegisterPage, // Now imported here
    WorkspacePage, // Added WorkspacePage
    WorkspacesListPage, // Added WorkspacesListPage
    CreateWorkspacePage,
    WorkspaceSettingsPage,
    IntegrationsPage, // Added IntegrationsPage
    CredentialsPage, // Added CredentialsPage

    // AgentStorePage, // Commented out
    // DatasetStorePage, // Commented out
    // NotFoundPage, // Commented out
    MCPServersPage,
    MCPMarketplacePage,
    MCPDeployPage,
    MCPServerConfigPage,
} from './lazyComponents';

// Import Media Library page
import { MediaLibraryPage } from '../pages/MediaLibraryPage';

// Manually import the new non-lazy pages
import { WorkflowsPage } from '../pages/WorkflowsPage';
import { AutomationsPage } from '../pages/AutomationsPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { GmailCallbackPage } from '@/integrations/gmail';
import { SMTPIntegrationsPage } from '@/integrations/smtp';
import { MicrosoftTeamsCallbackPage } from '../pages/integrations/MicrosoftTeamsCallbackPage';
import { MicrosoftOneDriveCallbackPage } from '../pages/integrations/MicrosoftOneDriveCallbackPage';
import { MicrosoftOutlookCallbackPage } from '../pages/integrations/MicrosoftOutlookCallbackPage';
import GraphSettingsPage from '../pages/GraphSettingsPage';

import AgentEditPage from '../pages/agents/[agentId]/edit'; // Use the fixed version

// Define the application routes using the RouteConfig structure
export const appRoutes: RouteConfig[] = [
  // Public routes (no layout, no protection needed beyond AppRouter logic)
  { path: '/login', element: LoginPage, protection: 'public', layout: false },
  { path: '/register', element: RegisterPage, protection: 'public', layout: false },
  { path: '/unauthorized', element: UnauthorizedPage, protection: 'public', layout: false },

  // Protected routes (require layout)

  { path: '/agents', element: AgentsPage, protection: 'protected', layout: true },
  { path: '/agents/new', element: AgentEditPage, protection: 'protected', layout: true },
  { path: '/agents/:agentId', element: AgentEditPage, protection: 'protected', layout: true },
  { path: '/agents/:agentId/edit', element: AgentEditPage, protection: 'protected', layout: true },
  { path: '/agents/:agentId/chat', element: AgentChatPage, protection: 'protected', layout: true },
  { path: '/memory', element: DatastoresPage, protection: 'protected', layout: true },
  { path: '/memory/new', element: DatastoreEditPage, protection: 'protected', layout: true },
  { path: '/memory/:datastoreId/edit', element: DatastoreEditPage, protection: 'protected', layout: true },
  { path: '/media', element: MediaLibraryPage, protection: 'protected', layout: true },
  { path: '/teams', element: TeamsPage, protection: 'protected', layout: true },
  { path: '/teams/:teamId', element: TeamDetailsPage, protection: 'protected', layout: true },
  { path: '/teams/:teamId/edit', element: EditTeamPage, protection: 'protected', layout: true },
  { path: '/workspaces', element: WorkspacesListPage, protection: 'protected', layout: true },
  { path: '/workspaces/new', element: CreateWorkspacePage, protection: 'protected', layout: true },
  { path: '/workspaces/:roomId', element: WorkspacePage, protection: 'protected', layout: false },
  { path: '/workspaces/:roomId/settings', element: WorkspaceSettingsPage, protection: 'protected', layout: false },
  { path: '/workspaces/:roomId/channels/:channelId', element: WorkspacePage, protection: 'protected', layout: false },
  { path: '/integrations', element: IntegrationsPage, protection: 'protected', layout: true },
  { path: '/integrations/smtp', element: SMTPIntegrationsPage, protection: 'protected', layout: true },
  { path: '/credentials', element: CredentialsPage, protection: 'protected', layout: true },
  { path: '/settings', element: SettingsPage, protection: 'protected', layout: true },
  { path: '/monitoring', element: MonitoringPage, protection: 'protected', layout: true },
  { path: '/graph-settings', element: GraphSettingsPage, protection: 'protected', layout: true },
  { path: '/workflows', element: WorkflowsPage, protection: 'protected', layout: true },
  { path: '/workflows/automations', element: AutomationsPage, protection: 'protected', layout: true },
  { path: '/projects', element: ProjectsPage, protection: 'protected', layout: true },
  { path: '/integrations/gmail/callback', element: GmailCallbackPage, protection: 'public', layout: false },
  { path: '/integrations/microsoft-teams/callback', element: MicrosoftTeamsCallbackPage, protection: 'public', layout: false },
  { path: '/integrations/microsoft-onedrive/callback', element: MicrosoftOneDriveCallbackPage, protection: 'public', layout: false },
  { path: '/integrations/microsoft-outlook/callback', element: MicrosoftOutlookCallbackPage, protection: 'public', layout: false },
  // { path: 'agent-store', element: AgentStorePage, protection: 'protected', layout: true }, // Commented out
  // { path: 'dataset-store', element: DatasetStorePage, protection: 'protected', layout: true }, // Commented out
  
  // MCP Server Management routes - REMOVED: Users should not deploy their own MCP servers
  // MCP servers are now managed by admins only via /admin/marketplace
  // Users connect to admin-deployed servers via agent configuration
  
  // Admin routes (nested under a protected layout)
  {
    path: '/admin', 
    protection: 'admin', 
    layout: false, // AdminRoute now provides AdminLayout, no need for regular Layout
    element: AdminDashboardPage, // Base element for /admin
    children: [
      { path: '/admin/users', element: AdminUserManagement, protection: 'admin', layout: false }, // Children inherit layout/protection
      { path: '/admin/agents', element: AdminAgentManagement, protection: 'admin', layout: false }, // Children inherit layout/protection
      { path: '/admin/marketplace', element: AdminMCPMarketplaceManagement, protection: 'admin', layout: false }, // Add marketplace management
      { path: '/admin/oauth-providers', element: AdminIntegrationManagement, protection: 'admin', layout: false }, // OAuth providers management
    ]
  },

  // Root route
  { path: '/', element: HomePage, protection: 'public', layout: false, exact: true },
]; 