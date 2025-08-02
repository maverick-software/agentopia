import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Users, Settings,
  LogOut, Bot, PanelLeftClose, PanelRightClose,
  ChevronDown, ChevronRight, MemoryStick,
  GitBranch, FolderKanban,
  Building2,
  User as UserIcon,
  Server, Key
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAgents } from '../hooks/useAgents';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Define type for a single navigation item, allowing for children
interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  children?: NavItem[];
  adminOnly?: boolean;
  isCustom?: boolean; // For special handling of Agents and Teams
}

// Helper function to get icon color class based on route or label
const getIconColorClass = (route: string, label: string): string => {
  // Check by route first, then by label for flexibility
  if (route.includes('/dashboard') || label.includes('Dashboard')) return 'text-icon-dashboard';
  if (route.includes('/agents') || label.includes('Agent')) return 'text-icon-agents';
  if (route.includes('/memory') || label.includes('Memory')) return 'text-icon-memory';
  if (route.includes('/workflows') || label.includes('Workflows')) return 'text-icon-workflows';
  if (route.includes('/integrations') || label.includes('Integrations')) return 'text-icon-integrations';
  if (route.includes('/credentials') || label.includes('Credentials')) return 'text-icon-credentials';
  if (route.includes('/teams') || label.includes('Team')) return 'text-icon-teams';
  if (route.includes('/workspaces') || label.includes('Workspaces')) return 'text-icon-workspaces';
  if (route.includes('/projects') || label.includes('Projects')) return 'text-icon-projects';
  if (route.includes('/settings') || label.includes('Settings')) return 'text-icon-settings';
  
  // Default fallback
  return 'text-sidebar-foreground';
};

// Updated navigation structure with organized hierarchical nesting
const navItems: NavItem[] = [
  { 
    to: '/agents', 
    icon: Users, 
    label: 'Agents',
    isCustom: true
  },
  { to: '/teams', icon: Building2, label: 'Teams' },
  { to: '/workflows', icon: GitBranch, label: 'Workflows' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
];

// Component to render a single NavLink or a collapsible parent item
const NavItemRenderer: React.FC<{ item: NavItem; isCollapsed: boolean; level?: number }> = ({ item, isCollapsed, level = 0 }) => {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if the current path matches the item's path or any of its children's paths
  const isActiveOrParent = location.pathname === item.to || (item.children?.some(child => location.pathname.startsWith(child.to)) ?? false);

  // Determine if the item should be expanded initially (if it or a child is active)
  React.useEffect(() => {
    if (isActiveOrParent) {
      setIsExpanded(true);
    }
    // Optionally collapse when navigating away, depends on desired UX
    // else {
    //   setIsExpanded(false);
    // }
  }, [isActiveOrParent]);

  if (item.children && !isCollapsed) {
    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center w-full space-x-3 rounded-md transition-colors px-4 py-3 text-sidebar-foreground hover:bg-sidebar-accent ${
            isActiveOrParent ? 'bg-sidebar-accent/50' : '' // Subtle highlight for active parent
          }`}
          style={{ paddingLeft: `${1 + level * 1.5}rem` }} // Indentation for submenus
        >
          <item.icon className={`w-5 h-5 flex-shrink-0 ${getIconColorClass(item.to, item.label)}`} />
          <span className="font-medium flex-1 text-left truncate">{item.label}</span>
          {isExpanded ? <ChevronDown size={16} className="text-sidebar-foreground" /> : <ChevronRight size={16} className="text-sidebar-foreground" />}
        </button>
        {isExpanded && (
          <div className="mt-1 space-y-1">
            {item.children.map((child) => (
              <NavItemRenderer key={child.to} item={child} isCollapsed={isCollapsed} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  } else {
    // Render standard NavLink for top-level items (when collapsed or no children) or child items
    return (
      <NavLink
        key={item.to}
        to={item.to}
        title={isCollapsed ? item.label : undefined}
        className={({ isActive }): string =>
          `flex items-center space-x-3 rounded-md transition-colors ${
            isCollapsed
              ? 'px-2 justify-center py-3' // Collapsed style
              : level > 0 
                ? 'py-2 text-sm' // Child item style (not collapsed)
                : 'px-4 py-3' // Top-level item style (not collapsed)
          } ${
            isActive
              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent'
          }`
        }
        style={!isCollapsed ? { paddingLeft: `${1 + level * 1.5}rem` } : {}}
      >
        <item.icon className={`w-5 h-5 flex-shrink-0 ${getIconColorClass(item.to, item.label)}`} />
        {!isCollapsed && <span className="font-medium truncate">{item.label}</span>}
      </NavLink>
    );
  }
};

// Custom component for Agents navigation with recent agents
const AgentsNavRenderer: React.FC<{ isCollapsed: boolean; level?: number }> = ({ isCollapsed, level = 0 }) => {
  const location = useLocation();
  const { agents, fetchAllAgents } = useAgents();
  const [isExpanded, setIsExpanded] = useState(false);
  const [recentAgents, setRecentAgents] = useState<any[]>([]);

  const isActiveOrParent = location.pathname.startsWith('/agents');

  useEffect(() => {
    if (isActiveOrParent && !isCollapsed) {
      setIsExpanded(true);
    }
  }, [isActiveOrParent, isCollapsed]);

  useEffect(() => {
    fetchAllAgents().then((fetchedAgents) => {
      // Get top 3 most recent agents (already ordered by created_at desc)
      setRecentAgents(fetchedAgents.slice(0, 3));
    });
  }, [fetchAllAgents]);

  if (isCollapsed) {
    return (
      <NavLink
        to="/agents"
        title="Agents"
        className={({ isActive }): string =>
          `flex items-center space-x-3 rounded-md transition-colors px-2 justify-center py-3 ${
            isActive
              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent'
          }`
        }
      >
        <Users className={`w-5 h-5 flex-shrink-0 ${getIconColorClass('/agents', 'Agents')}`} />
      </NavLink>
    );
  }

  return (
    <div>
      <div className={`flex items-center w-full rounded-md transition-colors ${
        isActiveOrParent ? 'bg-sidebar-accent/50' : ''
      }`}>
        <NavLink
          to="/agents"
          className={({ isActive }): string =>
            `flex items-center space-x-3 rounded-l-md transition-colors px-4 py-3 flex-1 ${
              isActive
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent'
            }`
          }
          style={{ paddingLeft: `${1 + level * 1.5}rem` }}
        >
          <Users className={`w-5 h-5 flex-shrink-0 ${getIconColorClass('/agents', 'Agents')}`} />
          <span className="font-medium truncate">Agents</span>
        </NavLink>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-3 hover:bg-sidebar-accent rounded-r-md transition-colors text-sidebar-foreground"
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
      {isExpanded && (
        <div className="mt-1 space-y-1">
          {recentAgents.map((agent) => (
            <NavLink
              key={agent.id}
              to={`/agents/${agent.id}/chat`}
              className={({ isActive }): string =>
                `flex items-center space-x-3 rounded-md transition-colors py-2 text-sm ${
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                }`
              }
              style={{ paddingLeft: `${1 + (level + 1) * 1.5}rem` }}
            >
              <div className="w-4 h-4 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-medium">
                  {agent.name?.charAt(0)?.toUpperCase() || 'A'}
                </span>
              </div>
              <span className="font-medium truncate">{agent.name || 'Unnamed Agent'}</span>
            </NavLink>
          ))}

        </div>
      )}
    </div>
  );
};



// Update props interface
interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Filter nav items based on admin status - no longer needed for the main list
  // const visibleNavItems = navItems.filter(item => !item.adminOnly || isAdmin);
  // Use the full navItems list now
  const visibleNavItems = navItems; 

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  return (
    <nav 
      className={`relative flex flex-col bg-sidebar-background border-r border-sidebar-border h-full overflow-y-auto transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16 p-2' : 'w-64 p-4'}`}
    >
      <div className="flex-1 mb-4 flex flex-col">
        <div>
          <div className={`flex items-center mb-6 transition-all duration-300 ${isCollapsed ? 'justify-center mt-8' : 'justify-start'}`}>
            <Bot size={isCollapsed ? 28 : 24} className="text-icon-agents" />
            <span className={`ml-2 text-xl font-bold text-sidebar-foreground transition-opacity duration-300 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
              Agentopia
            </span>
          </div>
          
          <div className="space-y-2">
            {visibleNavItems.map((item) => {
              if (item.isCustom && item.label === 'Agents') {
                return <AgentsNavRenderer key={item.to} isCollapsed={isCollapsed} />;
              } else {
                return <NavItemRenderer key={item.to} item={item} isCollapsed={isCollapsed} />;
              }
            })}
          </div>
        </div>

        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`mt-auto text-sidebar-foreground hover:text-sidebar-accent-foreground p-1 rounded hover:bg-sidebar-accent transition-colors duration-200 mb-2 ${ 
            isCollapsed ? 'self-center' : 'self-start ml-1'
          }`}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <PanelRightClose size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className={`flex items-center w-full rounded-md hover:bg-sidebar-accent transition-colors ${isCollapsed ? 'justify-center p-2' : 'p-2'}`}
              title="Account options"
            >
              <Avatar className={`flex-shrink-0 w-8 h-8 ${!isCollapsed ? 'mr-3' : ''}`}> 
                 <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                    {user.email?.substring(0, 2).toUpperCase() || '??'}
                 </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <span className="flex-1 text-sm text-left text-sidebar-foreground truncate" title={user.email || 'User'}>
                  {user.email}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
             className="w-56 bg-popover border-border text-popover-foreground" 
             sideOffset={5} 
             align={isCollapsed ? "start" : "center"}
             alignOffset={isCollapsed ? 5 : 0}
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                 <p className="text-sm font-medium leading-none">Signed in as</p>
                 <p className="text-xs leading-none text-muted-foreground truncate">
                    {user.email}
                 </p>
              </div>
            </DropdownMenuLabel>
                        <DropdownMenuSeparator className="border-border" />
            {isAdmin && (
              <DropdownMenuItem asChild className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                <Link to="/admin" className="flex items-center w-full">
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Admin Panel</span>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <Link to="/memory" className="flex items-center w-full">
                <MemoryStick className="mr-2 h-4 w-4" />
                <span>Memory</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <Link to="/integrations" className="flex items-center w-full">
                <Server className="mr-2 h-4 w-4" />
                <span>Integrations</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <Link to="/credentials" className="flex items-center w-full">
                <Key className="mr-2 h-4 w-4" />
                <span>Credentials</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <Link to="/settings" className="flex items-center w-full">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="border-border" />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer focus:bg-red-900/50 focus:text-red-300">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </nav>
  );
}