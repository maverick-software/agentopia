import React, { useState, useEffect } from 'react';
import { useLocation, matchPath } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 300);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const isWorkspaceView = matchPath(
    { path: "/workspaces/:roomId", end: false },
    location.pathname
  );

  const showMainSidebar = !isWorkspaceView || 
                          location.pathname === '/workspaces' || 
                          location.pathname === '/workspaces/new';

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {showMainSidebar && (
        <Sidebar 
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
        />
      )}

      <div className={`flex-1 flex flex-col overflow-hidden relative ${!showMainSidebar ? 'w-full' : ''}`}>
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-900 p-6 relative text-gray-100">
          {isTransitioning ? (
            <div className="fixed inset-0 z-50 flex justify-center items-center bg-gray-900 transition-opacity duration-300">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
};

export default Layout;