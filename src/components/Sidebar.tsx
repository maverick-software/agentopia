import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Users, Settings,
  LogOut, Bot, PanelLeftClose, PanelRightClose,
  ChevronDown, ChevronRight,
  GitBranch, FolderKanban,
  User as UserIcon,
  Server, Key, Zap, Plus, MessageSquarePlus,
  MoreVertical, Pencil, Archive, Trash2,
  Network, FileText, HelpCircle, Crown, CreditCard, Shield,
  UserCheck, Library, Plug
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAgents } from '../hooks/useAgents';
import { useSubscription } from '../hooks/useSubscription';
import { CreateAgentWizard } from './CreateAgentWizard';
import { AccountMenu } from './shared/AccountMenu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useConversations } from '../hooks/useConversations';

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
  if (route.includes('/media') || label.includes('Media')) return 'text-icon-media';
  if (route.includes('/contacts') || label.includes('Contacts')) return 'text-icon-contacts';
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
  { to: '/media', icon: Library, label: 'Media' },
  { to: '/contacts', icon: UserCheck, label: 'Contacts' },
  { to: '/integrations', icon: Plug, label: 'Integrations' },
  { to: '/teams', icon: Users, label: 'Teams' },
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
          className={`flex items-center w-full space-x-2 rounded-md transition-colors px-3 py-2 text-sidebar-foreground hover:bg-sidebar-accent text-sm ${
            isActiveOrParent ? 'bg-sidebar-accent/50' : '' // Subtle highlight for active parent
          }`}
          style={{ paddingLeft: `${1 + level * 1.5}rem` }} // Indentation for submenus
        >
          <item.icon className={`w-4 h-4 flex-shrink-0 ${getIconColorClass(item.to, item.label)}`} />
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
          `flex items-center space-x-2 rounded-md transition-colors text-sm ${
            isCollapsed
              ? 'px-2 justify-center py-2' // Collapsed style
              : level > 0 
                ? 'py-1.5 px-3' // Child item style (not collapsed)
                : 'px-3 py-2' // Top-level item style (not collapsed)
          } ${
            isActive
              ? 'bg-sidebar-accent/20 text-sidebar-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent'
          }`
        }
        style={!isCollapsed ? { paddingLeft: `${1 + level * 1.5}rem` } : {}}
      >
        <item.icon className={`w-4 h-4 flex-shrink-0 ${getIconColorClass(item.to, item.label)}`} />
        {!isCollapsed && <span className="font-medium truncate">{item.label}</span>}
      </NavLink>
    );
  }
};

// Simplified Agents navigation - just the main link
const AgentsNavRenderer: React.FC<{ isCollapsed: boolean; level?: number }> = ({ isCollapsed, level = 0 }) => {
  const location = useLocation();
  const { agents, fetchAllAgents } = useAgents();
  const [recentAgents, setRecentAgents] = useState<any[]>([]);

  const isActiveOrParent = location.pathname.startsWith('/agents');

  // Update recent agents when the agents list changes
  useEffect(() => {
    if (agents.length > 0) {
      // Get top 10 most recent agents (already ordered by created_at desc)
      setRecentAgents(agents.slice(0, 10));
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
          `flex items-center space-x-2 rounded-md transition-colors px-2 justify-center py-2 text-sm ${
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
    <div className="space-y-1">
      {/* Main Agents Link */}
      <NavLink
        to="/agents"
        className={({ isActive }): string =>
          `flex items-center space-x-2 rounded-md transition-colors px-3 py-2 text-sm ${
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

      {/* Recent Agents List */}
      {recentAgents.length > 0 && (
        <div className="ml-6 space-y-1">
          {recentAgents.map((agent) => (
            <NavLink
              key={agent.id}
              to={`/agents/${agent.id}/chat`}
              className={({ isActive }): string =>
                `flex items-center space-x-2 rounded-md transition-colors px-2 py-1.5 text-sm group ${
                  isActive
                    ? 'bg-sidebar-accent/20 text-sidebar-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                }`
              }
            >
              {/* Agent Avatar */}
              {agent.avatar_url ? (
                <img 
                  src={agent.avatar_url} 
                  alt={agent.name}
                  className="w-4 h-4 rounded-full flex-shrink-0"
                />
              ) : (
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0" />
              )}
              
              {/* Agent Name */}
              <span className="truncate text-xs">{agent.name}</span>
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
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);

  // Filter nav items based on admin status - no longer needed for the main list
  // const visibleNavItems = navItems.filter(item => !item.adminOnly || isAdmin);
  // Use the full navItems list now
  const visibleNavItems = navItems; 


  return (
    <nav 
      className={`relative flex flex-col bg-sidebar-background border-r border-sidebar-border h-full overflow-y-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'w-12 p-1' : 'w-56 p-2'}`}
    >
      <div className="flex-1 mb-2 flex flex-col min-h-0 overflow-y-auto">
        <div>
          <div className={`flex items-center mb-3 transition-all duration-300 ${isCollapsed ? 'justify-center mt-4' : 'justify-start px-2'}`}>
            <Bot size={isCollapsed ? 20 : 18} className="text-icon-agents" />
            <span className={`ml-2 text-lg font-semibold text-sidebar-foreground transition-opacity duration-300 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
              Agentopia
            </span>
          </div>
          
          <div className="space-y-1">
            {visibleNavItems.map((item) => {
              if (item.isCustom && item.label === 'Agents') {
                return <AgentsNavRenderer key={item.to} isCollapsed={isCollapsed} />;
              } else {
                return <NavItemRenderer key={item.to} item={item} isCollapsed={isCollapsed} />;
              }
            })}

            {/* New Chat (positioned after Projects, before Conversations) */}
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
                  className={`flex items-center space-x-2 rounded-md transition-colors px-3 py-2 w-full text-left text-sidebar-foreground hover:bg-sidebar-accent text-sm`}
                  title="New Chat"
                >
                  <MessageSquarePlus className={`w-4 h-4 flex-shrink-0 ${getIconColorClass('/chat/new', 'New Chat')}`} />
                  {!isCollapsed && <span className="font-medium truncate">New Chat</span>}
                </button>
              );
            })()}

            {/* Conversations injected after New Chat only on agent chat page */}
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
        <div className="border-t border-sidebar-border/50 pt-2 mt-2">
          <AccountMenu isCollapsed={isCollapsed} isAdminArea={false} />
        </div>
      )}

      {/* Create Agent Wizard */}
      <CreateAgentWizard 
        open={showCreateAgentModal} 
        onOpenChange={setShowCreateAgentModal} 
      />
    </nav>
  );
}

function ConversationsForAgentSidebar({ agentId, userId, isCollapsed, onOpen }: { agentId: string; userId: string; isCollapsed: boolean; onOpen: (id: string) => void }) {
  const { items, createConversation, renameConversation, archiveConversation } = useConversations(agentId, userId);
  const navigate = useNavigate();
  if (isCollapsed) return null;
  
  // Limit to last 10 chats
  const recentItems = items.slice(0, 10);
  const hasMoreChats = items.length > 10;
  
  return (
    <div className="mt-2">
      <div className="px-3 py-1.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Chats</div>
      <div className="space-y-0.5">
        {recentItems.map(c => {
          const displayTitle = c.title || (c.last_message ? 'Chat' : 'New chat');
          return (
            <div key={c.conversation_id} className="px-3 py-1.5 hover:bg-sidebar-accent rounded cursor-pointer flex items-center justify-between text-sm group" onClick={(e) => { e.preventDefault(); onOpen(c.conversation_id); }}>
              <div className="min-w-0 flex-1 pr-2">
                <div className="truncate text-sm text-sidebar-foreground">{displayTitle}</div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 hover:bg-sidebar-accent rounded text-sidebar-foreground opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); }}>
                    <MoreVertical className="w-3 h-3" />
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
        
        {/* View All link if there are more than 10 chats */}
        {hasMoreChats && (
          <div className="px-3 py-1.5 hover:bg-sidebar-accent rounded cursor-pointer text-sm" onClick={() => navigate(`/chats/${agentId}`)}>
            <div className="text-muted-foreground hover:text-sidebar-foreground transition-colors">View all ({items.length})</div>
          </div>
        )}
      </div>
    </div>
  );
}