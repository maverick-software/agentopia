import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DatabaseStatus } from './DatabaseStatus';
import { PanelLeftClose, PanelRightClose } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getMainContentMargin = () => {
    if (!user) return 'ml-0';
    return isCollapsed ? 'ml-16' : 'ml-64';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {!user && <Header />}
      
      <div className="flex">
        {user && <Sidebar isCollapsed={isCollapsed} />}
        
        <main className={`relative flex-1 transition-all duration-300 ease-in-out ${getMainContentMargin()}`}>
          {user && (
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="fixed top-5 text-gray-400 hover:text-white z-20 transition-all duration-300 ease-in-out"
              style={{ left: isCollapsed ? 'calc(4rem + 0.5rem)' : 'calc(16rem + 0.5rem)' }}
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <PanelRightClose size={20} /> : <PanelLeftClose size={20} />}
            </button>
          )}
          <DatabaseStatus />
          {children}
        </main>
      </div>
    </div>
  );
}