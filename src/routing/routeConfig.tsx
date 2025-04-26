import React from 'react';

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
    DashboardPage,
    AgentsPage,
    AgentChatPage,
    DatastoresPage,
    DatastoreEditPage,
    AdminDashboardPage,
    TeamsPage,
    CreateTeamPage,
    TeamDetailsPage,
    EditTeamPage,
    SettingsPage,
    MCPPage,
    MonitoringPage,
    AdminUserManagement,
    AdminAgentManagement,
    HomePage,
    LoginPage, // Now imported here
    RegisterPage, // Now imported here
    AgentEditPage // Now imported here
} from './lazyComponents';

// Define the application routes using the RouteConfig structure
export const appRoutes: RouteConfig[] = [
  // Public routes (no layout, no protection needed beyond AppRouter logic)
  { path: '/login', element: LoginPage, protection: 'public', layout: false },
  { path: '/register', element: RegisterPage, protection: 'public', layout: false },
  { path: '/unauthorized', element: UnauthorizedPage, protection: 'public', layout: false },

  // Protected routes (require layout)
  { path: '/dashboard', element: DashboardPage, protection: 'protected', layout: true },
  { path: '/agents', element: AgentsPage, protection: 'protected', layout: true },
  { path: '/agents/new', element: AgentEditPage, protection: 'protected', layout: true }, // Using direct import
  { path: '/agents/:agentId', element: AgentEditPage, protection: 'protected', layout: true }, // Using direct import
  { path: '/agents/:agentId/edit', element: AgentEditPage, protection: 'protected', layout: true }, // Using direct import
  { path: '/agents/:agentId/chat', element: AgentChatPage, protection: 'protected', layout: true },
  { path: '/datastores', element: DatastoresPage, protection: 'protected', layout: true },
  { path: '/datastores/new', element: DatastoreEditPage, protection: 'protected', layout: true },
  { path: '/datastores/:datastoreId/edit', element: DatastoreEditPage, protection: 'protected', layout: true },
  { path: '/teams', element: TeamsPage, protection: 'protected', layout: true },
  { path: '/teams/new', element: CreateTeamPage, protection: 'protected', layout: true },
  { path: '/teams/:teamId', element: TeamDetailsPage, protection: 'protected', layout: true },
  { path: '/teams/:teamId/edit', element: EditTeamPage, protection: 'protected', layout: true },
  { path: '/settings', element: SettingsPage, protection: 'protected', layout: true },
  { path: '/mcp', element: MCPPage, protection: 'protected', layout: true },
  { path: '/monitoring', element: MonitoringPage, protection: 'protected', layout: true },
  
  // Admin routes (nested under a protected layout)
  {
    path: '/admin', 
    protection: 'admin', 
    layout: true, // The parent route requires layout and admin check
    element: AdminDashboardPage, // Base element for /admin
    children: [
      { path: '/admin/users', element: AdminUserManagement, protection: 'admin', layout: false }, // Children inherit layout/protection
      { path: '/admin/agents', element: AdminAgentManagement, protection: 'admin', layout: false }, // Children inherit layout/protection
    ]
  },

  // Root route
  { path: '/', element: HomePage, protection: 'public', layout: false, exact: true },
]; 