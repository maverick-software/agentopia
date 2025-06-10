import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Database, Brain, Activity, Settings,
  ShieldCheck, LogOut, Bot, PanelLeftClose, PanelRightClose,
  MessageSquare, ChevronDown, ChevronRight, MemoryStick,
  Wrench, GitBranch, FolderKanban, Folder,
  Building2,
  User as UserIcon,
  Server, Store
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
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
}

// Updated navigation structure with nesting
const navItems: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { 
    to: '/agents', // Parent link
    icon: Users, 
    label: 'Agents',
    children: [
      { to: '/agents', icon: Users, label: 'View Agents' },
      { to: '/memory', icon: MemoryStick, label: 'Memory' },
    ]
  },
  { to: '/teams', icon: Building2, label: 'Teams' },
  { to: '/tools', icon: Wrench, label: 'Tools' },
  { 
    to: '/mcp/servers', 
    icon: Server, 
    label: 'MCP Servers',
    children: [
      { to: '/mcp/servers', icon: Server, label: 'My Servers' },
      { to: '/mcp/marketplace', icon: Store, label: 'Marketplace' },
    ]
  },
  { to: '/workspaces', icon: MessageSquare, label: 'Workspaces' }, 
  { to: '/workflows', icon: GitBranch, label: 'Workflows' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  {
    to: '/settings', 
    icon: Settings, 
    label: 'Settings',
    children: [
      { to: '/settings', icon: Settings, label: 'General Settings' },
      { to: '/monitoring', icon: Activity, label: 'Monitoring' },
    ]
  },
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
          className={`flex items-center w-full space-x-3 rounded-md transition-colors px-4 py-3 text-gray-300 hover:bg-gray-700 ${
            isActiveOrParent ? 'bg-gray-700/50' : '' // Subtle highlight for active parent
          }`}
          style={{ paddingLeft: `${1 + level * 1.5}rem` }} // Indentation for submenus
        >
          <item.icon className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium flex-1 text-left truncate">{item.label}</span>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
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
              ? 'bg-indigo-600 text-white'
              : 'text-gray-300 hover:bg-gray-700'
          }`
        }
        style={!isCollapsed ? { paddingLeft: `${1 + level * 1.5}rem` } : {}}
      >
        <item.icon className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? '' : ''}`} />
        {!isCollapsed && <span className="font-medium truncate">{item.label}</span>}
      </NavLink>
    );
  }
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
      className={`relative flex flex-col bg-gray-800 h-full overflow-y-auto transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16 p-2' : 'w-64 p-4'}`}
    >
      <div className="flex-1 mb-4 flex flex-col">
        <div>
          <div className={`flex items-center mb-6 transition-all duration-300 ${isCollapsed ? 'justify-center mt-8' : 'justify-start'}`}>
            <Bot size={isCollapsed ? 28 : 24} className="text-indigo-400" />
            <span className={`ml-2 text-xl font-bold text-white transition-opacity duration-300 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
              Agentopia
            </span>
          </div>
          
          <div className="space-y-2">
            {visibleNavItems.map((item) => (
              <NavItemRenderer key={item.to} item={item} isCollapsed={isCollapsed} />
            ))}
          </div>
        </div>

        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`mt-auto text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors duration-200 mb-2 ${ 
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
              className={`flex items-center w-full rounded-md hover:bg-gray-700 transition-colors ${isCollapsed ? 'justify-center p-2' : 'p-2'}`}
              title="Account options"
            >
              <Avatar className={`flex-shrink-0 w-8 h-8 ${!isCollapsed ? 'mr-3' : ''}`}> 
                 <AvatarFallback className="bg-indigo-500 text-white text-xs">
                    {user.email?.substring(0, 2).toUpperCase() || '??'}
                 </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <span className="flex-1 text-sm text-left text-gray-300 truncate" title={user.email || 'User'}>
                  {user.email}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
             className="w-56 bg-gray-800 border-gray-700 text-gray-200" 
             sideOffset={5} 
             align={isCollapsed ? "start" : "center"}
             alignOffset={isCollapsed ? 5 : 0}
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                 <p className="text-sm font-medium leading-none">Signed in as</p>
                 <p className="text-xs leading-none text-gray-400 truncate">
                    {user.email}
                 </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-700" />
            {isAdmin && (
              <DropdownMenuItem asChild className="cursor-pointer focus:bg-gray-700 focus:text-white">
                 <Link to="/admin" className="flex items-center w-full">
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Admin Panel</span>
                 </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild className="cursor-pointer focus:bg-gray-700 focus:text-white">
               <Link to="/settings" className="flex items-center w-full">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
               </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-gray-700" />
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