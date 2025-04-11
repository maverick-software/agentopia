import React, { useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Users, Database, Brain, Activity, Settings,
  LogOut, Bot, PanelLeftClose, PanelRightClose
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Update props interface
interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setIsMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  triggerRef: React.RefObject<HTMLButtonElement>;
}

const navItems = [
  { to: '/agents', icon: Users, label: 'Agents' },
  { to: '/datastores', icon: Database, label: 'Datastores' },
  { to: '/mcp', icon: Brain, label: 'MCP' },
  { to: '/monitoring', icon: Activity, label: 'Monitoring' },
  { to: '/settings', icon: Settings, label: 'Settings' }
];

// Accept new props
export function Sidebar({ isCollapsed, setIsCollapsed, setIsMenuOpen, triggerRef }: SidebarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
            <span className={`ml-2 text-xl font-bold transition-opacity duration-300 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
              Agentopia
            </span>
          </div>
          
          <div className="space-y-2">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                title={isCollapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center space-x-3 rounded-md transition-colors ${
                    isCollapsed ? 'px-2 justify-center py-3' : 'px-4 py-3'
                  } ${
                    isActive 
                      ? 'bg-indigo-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span className={`font-medium transition-opacity duration-300 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>{label}</span>
              </NavLink>
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
        <div className="mt-auto border-t border-gray-700 pt-4">
          <button 
            ref={triggerRef}
            onClick={() => setIsMenuOpen(prev => !prev)}
            className={`flex items-center w-full rounded-md hover:bg-gray-700 transition-colors ${isCollapsed ? 'justify-center p-2' : 'p-2'}`}
            title="Account options"
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center ${!isCollapsed ? 'mr-3' : ''}`}>
              <span className="text-xs font-medium text-white">{user.email?.charAt(0).toUpperCase()}</span>
            </div>
            {!isCollapsed && (
              <span className="flex-1 text-sm text-left text-gray-300 truncate" title={user.email || 'User'}>
                {user.email}
              </span>
            )}
          </button>
        </div>
      )}
    </nav>
  );
}