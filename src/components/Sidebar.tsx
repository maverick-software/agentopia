import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Users, Settings,
  LogOut, Bot, PanelLeftClose, PanelRightClose,
  ChevronDown, ChevronRight,
  GitBranch, FolderKanban,
  User as UserIcon,
  Server, Key, Zap, Plus,
  MoreVertical, Pencil, Archive, Trash2,
  Network, FileText, HelpCircle, Crown, CreditCard, Shield,
  MessageCircle, SquarePen, Brain
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
import { Logo } from './ui/logo';

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
  // Map routes/labels to Tailwind icon color classes
  if (route === '/' || label === 'Dashboard') return 'text-icon-dashboard';
  if (route === '/agents' || label === 'Agents') return 'text-icon-agents';
  if (route === '/datastores' || label === 'Library') return 'text-icon-memory';
  if (route === '/knowledge' || label === 'Knowledge') return 'text-icon-memory';
  if (route === '/workflows' || label === 'Workflows') return 'text-icon-workflows';
  if (route === '/automations' || label === 'Automations') return 'text-icon-workflows';
  if (route === '/integrations' || label === 'Integrations') return 'text-icon-integrations';
  if (route === '/credentials' || label === 'Credentials') return 'text-icon-credentials';
  if (route === '/teams' || label === 'Teams') return 'text-icon-teams';
  if (route === '/workspaces' || label === 'Workspaces') return 'text-icon-workspaces';
  if (route === '/projects' || label === 'Projects') return 'text-icon-projects';
  if (route === '/settings' || label === 'Settings') return 'text-icon-settings';
  if (route === '/monitoring' || label === 'Monitoring') return 'text-icon-monitoring';
  if (route === '/contacts' || label === 'Contacts') return 'text-icon-integrations';
  if (route === '/media-library' || label === 'Media Library') return 'text-icon-memory';
  if (route === '/mcp-servers' || label === 'MCP Servers') return 'text-icon-integrations';
  
  // Default to sidebar foreground color
  return 'text-sidebar-foreground';
};

// Updated navigation structure with organized hierarchical nesting
const navItems: NavItem[] = [
  { 
    to: '/chat', 
    icon: SquarePen, 
    label: 'New chat',
    isCustom: false
  },
  { 
    to: '/agents', 
    icon: Users, 
    label: 'Agents',
    isCustom: true
  },
  { 
    to: '/media', 
    icon: FileText, 
    label: 'Library',
    isCustom: false
  },
  { 
    to: '/graph-settings', 
    icon: Brain, 
    label: 'Knowledge',
    isCustom: false
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
          className={`flex items-center w-full space-x-2 rounded-md transition-colors px-3 py-2 hover:bg-sidebar-accent text-sm ${
            isActiveOrParent ? 'bg-sidebar-accent/50' : '' // Subtle highlight for active parent
          }`}
          style={{ paddingLeft: `${1 + level * 1.5}rem` }} // Indentation for submenus
        >
          <item.icon className={`w-4 h-4 flex-shrink-0 ${getIconColorClass(item.to, item.label)}`} />
          <span className="font-normal flex-1 text-left truncate text-sidebar-foreground">{item.label}</span>
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
              ? 'bg-sidebar-accent/20'
              : 'hover:bg-sidebar-accent'
          }`
        }
        style={!isCollapsed ? { paddingLeft: `${1 + level * 1.5}rem` } : {}}
      >
        <item.icon className={`w-4 h-4 flex-shrink-0 ${getIconColorClass(item.to, item.label)}`} />
        {!isCollapsed && <span className="font-normal truncate text-sidebar-foreground">{item.label}</span>}
      </NavLink>
    );
  }
};

// Simplified Agents navigation - just the main link
const AgentsNavRenderer: React.FC<{ isCollapsed: boolean; level?: number }> = ({ isCollapsed, level = 0 }) => {
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
      <span className="font-normal truncate">Agents</span>
    </NavLink>
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
  const { subscription, isFreePlan } = useSubscription();
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);

  // Filter nav items based on admin status - no longer needed for the main list
  // const visibleNavItems = navItems.filter(item => !item.adminOnly || isAdmin);
  // Use the full navItems list now
  const visibleNavItems = navItems; 


  return (
    <nav 
      className={`relative flex flex-col bg-sidebar-background border-r border-sidebar-border h-full overflow-y-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'w-12 p-1' : 'w-64 p-2'}`}
    >
      <div className="flex-1 mb-2 flex flex-col min-h-0 overflow-y-auto">
        <div>
          <div className={`flex items-center mb-3 mt-1 transition-all duration-300 ${isCollapsed ? 'justify-center mt-4' : 'justify-between px-2'}`}>
            <div className="flex items-center">
              <Logo
                size={isCollapsed ? 'sm' : 'md'}
                variant="icon"
                showText={false}
              />
              {!isCollapsed && (
                <span className="ml-2 text-base text-sidebar-foreground">
                  <span className="font-semibold">Gofr</span> <span className="font-light">Labs</span>
                </span>
              )}
            </div>
            {!isCollapsed && (
              <button 
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="text-sidebar-foreground/60 hover:text-sidebar-foreground p-1 rounded hover:bg-sidebar-accent transition-colors duration-200"
                title="Collapse Sidebar"
              >
                <PanelLeftClose size={20} />
              </button>
            )}
          </div>
          
          {/* Subtle separator line */}
          <div className="border-b border-sidebar-border/30 mb-3"></div>
          
          <div className="space-y-1">
            {visibleNavItems.map((item) => {
              if (item.isCustom && item.label === 'Agents') {
                return <AgentsNavRenderer key={item.to} isCollapsed={isCollapsed} />;
              } else {
                return <NavItemRenderer key={item.to} item={item} isCollapsed={isCollapsed} />;
              }
            })}

            {/* Conversations - Show Gofr agent by default, or current agent if on agent chat page */}
            {(() => {
              if (!user) return null;
              
              // Check if we're on an agent chat page
              const m = location.pathname.match(/^\/agents\/([^/]+)\/chat/);
              const agentId = m?.[1];
              
              return (
                <ConversationsForAgentSidebar
                  agentId={agentId} // Will be undefined for non-agent pages, component will fetch Gofr agent
                  userId={user.id}
                  isCollapsed={isCollapsed}
                  onOpen={(convId, targetAgentId) => {
                    // Validate conversation is active before opening
                    (async () => {
                      try {
                        const { supabase } = await import('../lib/supabase');
                        const { data: row } = await supabase
                          .from('conversation_sessions')
                          .select('status')
                          .eq('conversation_id', convId)
                          .eq('agent_id', targetAgentId)
                          .eq('user_id', user.id)
                          .maybeSingle();
                        if (!row || row.status !== 'active') {
                          // If not active, clear selection and go to new chat screen
                          try { localStorage.removeItem(`agent_${targetAgentId}_conversation_id`); } catch {}
                          navigate(`/agents/${targetAgentId}/chat`);
                          return;
                        }
                        localStorage.setItem(`agent_${targetAgentId}_conversation_id`, convId);
                        navigate(`/agents/${targetAgentId}/chat?conv=${convId}`);
                      } catch {
                        navigate(`/agents/${targetAgentId}/chat`);
                      }
                    })();
                  }}
                />
              );
            })()}
          </div>
        </div>

        {/* Show expand button at bottom when collapsed */}
        {isCollapsed && (
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="mt-auto text-sidebar-foreground/60 hover:text-sidebar-foreground p-1 rounded hover:bg-sidebar-accent transition-colors duration-200 mb-2 self-center"
            title="Expand Sidebar"
          >
            <PanelRightClose size={20} />
          </button>
        )}
      </div>

      {user && !isCollapsed && (
        <>
          {/* Plan Usage Information - Above separator */}
          <div className="px-1.5 mb-4">
            <div className="bg-sidebar-accent/40 rounded-lg p-3">
              <div className="mb-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-sidebar-foreground">
                    {subscription?.display_name || 'FREE PLAN'}
                  </span>
                </div>
              </div>
              
              {/* API Calls/Actions Usage */}
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Actions</span>
                    <span className="font-medium text-sidebar-foreground">
                      200 / 200
                    </span>
                  </div>
                  <div className="w-full bg-sidebar-border/50 rounded-full h-1.5">
                    <div 
                      className="bg-green-500 h-1.5 rounded-full transition-all duration-300" 
                      style={{ width: `${(200 / 200) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Credits Usage */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Credits</span>
                    <span className="font-medium text-sidebar-foreground">
                      1,000 / 1,000
                    </span>
                  </div>
                  <div className="w-full bg-sidebar-border/50 rounded-full h-1.5">
                    <div 
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
                      style={{ width: `${(1000 / 1000) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => navigate('/billing')}
                className="w-full mt-3 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center justify-between transition-colors"
              >
                <span>Manage plan</span>
                <span className="text-muted-foreground">→</span>
              </button>
              
              {isFreePlan && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Resets in 24 days
                </div>
              )}
            </div>
          </div>
          
          {/* Separator then Account Menu */}
          <div className="border-t border-sidebar-border/50 pt-2 px-2 pb-2">
            <AccountMenu isCollapsed={isCollapsed} isAdminArea={false} />
          </div>
        </>
      )}
      
      {user && isCollapsed && (
        <div className="border-t border-sidebar-border/50 pt-2 mt-2 px-2">
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

function ConversationsForAgentSidebar({ agentId, userId, isCollapsed, onOpen }: { agentId?: string; userId: string; isCollapsed: boolean; onOpen: (id: string, agentId: string) => void }) {
  const navigate = useNavigate();
  const [isChatsExpanded, setIsChatsExpanded] = useState(true);
  const [gofrAgentId, setGofrAgentId] = useState<string | null>(null);
  const [isLoadingGofr, setIsLoadingGofr] = useState(false);
  
  // If no agentId provided, fetch the Gofr system agent ID
  useEffect(() => {
    if (!agentId && !gofrAgentId && !isLoadingGofr) {
      setIsLoadingGofr(true);
      (async () => {
        try {
          const { supabase } = await import('../lib/supabase');
          const { data, error } = await supabase
            .from('agents')
            .select('id')
            .eq('name', 'Gofr')
            .eq('metadata->>is_system_agent', 'true')
            .single();
          
          if (data && !error) {
            setGofrAgentId(data.id);
          }
        } catch (err) {
          console.error('Failed to fetch Gofr agent:', err);
        } finally {
          setIsLoadingGofr(false);
        }
      })();
    }
  }, [agentId, gofrAgentId, isLoadingGofr]);
  
  // Use provided agentId or fallback to Gofr agent
  const effectiveAgentId = agentId || gofrAgentId;
  
  const { items, createConversation, renameConversation, archiveConversation } = useConversations(effectiveAgentId || '', userId);
  
  // Debug logging
  console.log('[ConversationsForAgentSidebar] effectiveAgentId:', effectiveAgentId);
  console.log('[ConversationsForAgentSidebar] items:', items);
  console.log('[ConversationsForAgentSidebar] items.length:', items.length);
  
  if (isCollapsed || !effectiveAgentId) return null;
  
  // Limit to last 10 chats
  const recentItems = items.slice(0, 10);
  const hasMoreChats = items.length > 10;
  
  return (
    <div style={{ marginTop: '40px' }}>
      <button
        onClick={() => setIsChatsExpanded(!isChatsExpanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground font-medium hover:text-sidebar-foreground transition-colors"
      >
        <span>Chats</span>
        {isChatsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {isChatsExpanded && (
        <div className="space-y-0.5">
        {recentItems.map(c => {
          const displayTitle = c.title || (c.last_message ? 'Chat' : 'New chat');
          return (
            <div key={c.conversation_id} className="px-3 py-1.5 hover:bg-sidebar-accent rounded cursor-pointer flex items-center justify-between text-sm group" onClick={(e) => { e.preventDefault(); onOpen(c.conversation_id, effectiveAgentId); }}>
              <div className="min-w-0 flex-1 pr-2">
                <div className="truncate text-sm font-normal text-sidebar-foreground">{displayTitle}</div>
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
                    try { localStorage.removeItem(`agent_${effectiveAgentId}_conversation_id`); } catch {}
                    navigate(`/agents/${effectiveAgentId}/chat`);
                  }}>
                    <Archive className="w-4 h-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer focus:bg-red-900/50 focus:text-red-300" onClick={async (e) => { 
                    e.preventDefault(); 
                    e.stopPropagation(); 
                    if (confirm('Delete this conversation? This will archive it.')) { 
                      await archiveConversation(c.conversation_id); 
                      try { localStorage.removeItem(`agent_${effectiveAgentId}_conversation_id`); } catch {}
                      navigate(`/agents/${effectiveAgentId}/chat`);
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
          <div className="px-3 py-1.5 hover:bg-sidebar-accent rounded cursor-pointer text-sm" onClick={() => navigate(`/chats/${effectiveAgentId}`)}>
            <div className="text-muted-foreground hover:text-sidebar-foreground transition-colors">View all ({items.length})</div>
          </div>
        )}
        </div>
      )}
    </div>
  );
}