import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Users, Settings,
  LogOut, Bot, PanelLeftClose, PanelRightClose,
  ChevronDown, ChevronRight, MemoryStick,
  GitBranch, FolderKanban,
  Building2,
  User as UserIcon,
  Server, Key, Zap, Plus, MessageSquarePlus,
  MoreVertical, Pencil, Archive, Trash2,
  Network, FileText
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
import { useConversations } from '../hooks/useConversations';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

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

  if (route.includes('/agents') || label.includes('Agent')) return 'text-icon-agents';
  if (route.includes('/memory') || label.includes('Memory')) return 'text-icon-memory';
  if (route.includes('/workflows') || label.includes('Workflows')) return 'text-icon-workflows';
  if (route.includes('/automations') || label.includes('Automations')) return 'text-purple-500';
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
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/media', icon: FileText, label: 'Media' },
  { to: '/workflows', icon: GitBranch, label: 'Workflows' },
  { to: '/workflows/automations', icon: Zap, label: 'Automations' },
  { to: '/graph-settings', icon: Network, label: 'Knowledge Graph' },
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
              ? 'bg-sidebar-accent/20 text-sidebar-foreground'
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

  // Update recent agents when the agents list changes
  useEffect(() => {
    if (agents.length > 0) {
      // Get top 3 most recent agents (already ordered by created_at desc)
      setRecentAgents(agents.slice(0, 3));
    }
  }, [agents]);

  // Initial fetch on mount
  useEffect(() => {
    fetchAllAgents();
  }, [fetchAllAgents]);

  if (isCollapsed) {
    return (
      <NavLink
        to="/agents"
        title="Agents"
        className={({ isActive }): string =>
          `flex items-center space-x-3 rounded-md transition-colors px-2 justify-center py-3 ${
            isActive
              ? 'bg-sidebar-accent/20 text-sidebar-foreground'
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
                ? 'bg-sidebar-accent/30 text-sidebar-foreground'
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
                    ? 'bg-sidebar-accent/20 text-sidebar-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                }`
              }
              style={{ paddingLeft: `${1 + (level + 1) * 1.5}rem` }}
            >
              {agent.avatar_url ? (
                <img 
                  src={agent.avatar_url} 
                  alt={agent.name || 'Agent'}
                  className="w-4 h-4 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-4 h-4 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-medium">
                    {agent.name?.charAt(0)?.toUpperCase() || 'A'}
                  </span>
                </div>
              )}
              <span className="font-medium truncate">{agent.name || 'Unnamed Agent'}</span>
            </NavLink>
          ))}
          
          {/* Create New Agent Button */}
          <NavLink
            to="/agents/new"
            className={({ isActive }): string =>
              `flex items-center space-x-3 rounded-md transition-colors py-2 text-sm ${
                isActive
                  ? 'bg-sidebar-accent/20 text-sidebar-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              }`
            }
            style={{ paddingLeft: `${1 + (level + 1) * 1.5}rem` }}
          >
            <div className="w-4 h-4 rounded bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">+</span>
            </div>
            <span className="font-medium truncate text-green-600 dark:text-green-400">Create New</span>
          </NavLink>

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
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

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
      className={`relative flex flex-col bg-sidebar-background border-r border-sidebar-border h-full overflow-y-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16 p-2' : 'w-64 p-4'}`}
    >
      <div className="flex-1 mb-4 flex flex-col min-h-0 overflow-y-auto">
        <div>
          <div className={`flex items-center mb-6 transition-all duration-300 ${isCollapsed ? 'justify-center mt-8' : 'justify-start'}`}>
            <Bot size={isCollapsed ? 28 : 24} className="text-icon-agents" />
            <span className={`ml-2 text-xl font-bold text-sidebar-foreground transition-opacity duration-300 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
              Agentopia
            </span>
          </div>
          
          <div className="space-y-2">
            {/* New Chat (global top link) */}
            {(() => {
              const m = location.pathname.match(/^\/agents\/([^/]+)\/chat/);
              const agentId = m?.[1];
              if (!agentId || !user) return null;
              return (
                <button
                  onClick={async () => {
                    if (!agentId || !user) { navigate('/agents'); return; }
                    // create a one-off client hook usage via dynamic function call is not possible; instead, route to chat and let page create on first message
                    // Fallback: simple local creation using RPC-like insert
                    try {
                      const { supabase } = await import('../lib/supabase');
                      const id = crypto.randomUUID();
                      // optimistic local persistence; if RLS blocks, route without
                      await supabase.from('conversation_sessions').insert({ conversation_id: id, user_id: user.id, agent_id: agentId, title: 'New Conversation', status: 'active' });
                      // proactively refresh sidebar list by emitting a synthetic change (fetch hook is already subscribed)
                      try { (await import('../hooks/useConversations')); } catch {}
                      const convId = id;
                      localStorage.setItem(`agent_${agentId}_conversation_id`, convId);
                      navigate(`/agents/${agentId}/chat?conv=${convId}`);
                    } catch {
                      navigate(`/agents/${agentId}/chat`);
                    }
                  }}
                  className={`flex items-center space-x-3 rounded-md transition-colors px-4 py-3 w-full text-left text-sidebar-foreground hover:bg-sidebar-accent`}
                  title="New Chat"
                >
                  <MessageSquarePlus className={`w-5 h-5 flex-shrink-0 ${getIconColorClass('/chat/new', 'New Chat')}`} />
                  {!isCollapsed && <span className="font-medium truncate">New Chat</span>}
                </button>
              );
            })()}

            {visibleNavItems.map((item) => {
              if (item.isCustom && item.label === 'Agents') {
                return <AgentsNavRenderer key={item.to} isCollapsed={isCollapsed} />;
              } else {
                return <NavItemRenderer key={item.to} item={item} isCollapsed={isCollapsed} />;
              }
            })}

            {/* Conversations injected under Automations only on agent chat page */}
            {(() => {
              const m = location.pathname.match(/^\/agents\/([^/]+)\/chat/);
              if (!m || !user) return null;
              const agentId = m[1];
              return (
                <ConversationsForAgentSidebar
                  agentId={agentId}
                  userId={user.id}
                  isCollapsed={isCollapsed}
                  onOpen={(convId) => {
                    // Validate conversation is active before opening
                    (async () => {
                      try {
                        const { supabase } = await import('../lib/supabase');
                        const { data: row } = await supabase
                          .from('conversation_sessions')
                          .select('status')
                          .eq('conversation_id', convId)
                          .eq('agent_id', agentId)
                          .eq('user_id', user.id)
                          .maybeSingle();
                        if (!row || row.status !== 'active') {
                          // If not active, clear selection and go to new chat screen
                          try { localStorage.removeItem(`agent_${agentId}_conversation_id`); } catch {}
                          navigate(`/agents/${agentId}/chat`);
                          return;
                        }
                        localStorage.setItem(`agent_${agentId}_conversation_id`, convId);
                        navigate(`/agents/${agentId}/chat?conv=${convId}`);
                      } catch {
                        navigate(`/agents/${agentId}/chat`);
                      }
                    })();
                  }}
                />
              );
            })()}
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
              className={`flex items-center w-full rounded-md hover:bg-sidebar-accent transition-colors ${isCollapsed ? 'justify-center p-2' : 'p-2'} sticky bottom-2`}
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
            <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </DropdownMenuItem>
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

function ConversationsForAgentSidebar({ agentId, userId, isCollapsed, onOpen }: { agentId: string; userId: string; isCollapsed: boolean; onOpen: (id: string) => void }) {
  const { items, createConversation, renameConversation, archiveConversation } = useConversations(agentId, userId);
  const navigate = useNavigate();
  if (isCollapsed) return null;
  return (
    <div className="mt-2">
      <div className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">Conversations</div>
      <div className="space-y-1">
        {items.map(c => {
          const displayTitle = c.title || (c.last_message ? 'Conversation' : 'New conversation');
          return (
            <div key={c.conversation_id} className="px-4 py-2 hover:bg-sidebar-accent rounded cursor-pointer flex items-center justify-between" onClick={(e) => { e.preventDefault(); onOpen(c.conversation_id); }}>
              <div className="min-w-0 flex-1 pr-2">
                <div className="truncate text-sm text-sidebar-foreground">{displayTitle}</div>
                {c.last_message && <div className="truncate text-[11px] text-muted-foreground/80">{c.last_message}</div>}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1.5 hover:bg-sidebar-accent rounded text-sidebar-foreground" onClick={(e) => { e.stopPropagation(); }}>
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 bg-popover text-popover-foreground border-border">
                  <DropdownMenuItem className="cursor-pointer" onClick={async (e) => { e.preventDefault(); e.stopPropagation(); const t = prompt('Rename conversation', c.title || '') || undefined; if (t !== undefined) { await renameConversation(c.conversation_id, t); } }}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onClick={async (e) => { 
                    e.preventDefault(); 
                    e.stopPropagation(); 
                    await archiveConversation(c.conversation_id); 
                    try { localStorage.removeItem(`agent_${agentId}_conversation_id`); } catch {}
                    navigate(`/agents/${agentId}/chat`);
                  }}>
                    <Archive className="w-4 h-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer focus:bg-red-900/50 focus:text-red-300" onClick={async (e) => { 
                    e.preventDefault(); 
                    e.stopPropagation(); 
                    if (confirm('Delete this conversation? This will archive it.')) { 
                      await archiveConversation(c.conversation_id); 
                      try { localStorage.removeItem(`agent_${agentId}_conversation_id`); } catch {}
                      navigate(`/agents/${agentId}/chat`);
                    } 
                  }}>
                    <Trash2 className="w-4 h-4 mr-2 text-red-500" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
    </div>
  );
}