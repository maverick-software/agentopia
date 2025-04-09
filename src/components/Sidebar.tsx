import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Users, Database, Brain, Activity, Settings
} from 'lucide-react';

const navItems = [
  { to: '/agents', icon: Users, label: 'Agents' },
  { to: '/datastores', icon: Database, label: 'Datastores' },
  { to: '/mcp', icon: Brain, label: 'MCP' },
  { to: '/monitoring', icon: Activity, label: 'Monitoring' },
  { to: '/settings', icon: Settings, label: 'Settings' }
];

export function Sidebar() {
  return (
    <nav className="w-64 bg-gray-800 min-h-screen p-4">
      <div className="space-y-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-md transition-colors ${
                isActive 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-700'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span className="font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}