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

  // Match any route starting with /workspaces/ except /workspaces/new
  const isWorkspaceSpecificView = matchPath(
    { path: "/workspaces/:roomId", end: false }, 
    location.pathname
  ) && location.pathname !== '/workspaces/new'; // Ensure /new doesn't count

  // Only show the main Sidebar if NOT in a specific workspace view
  const showMainSidebar = !isWorkspaceSpecificView;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Conditionally render main Sidebar */}
      {showMainSidebar && (
        <Sidebar 
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
        />
      )}

      {/* Main content area flexes to fill space */}
      {/* Apply w-full only if sidebar is hidden to take full width */} 
      <div className={`flex-1 flex flex-col overflow-hidden ${!showMainSidebar ? 'w-full' : ''}`}>
        <Header />
        <main className={`flex-1 ${location.pathname.includes('/chat') ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {isTransitioning ? (
            <div className="fixed inset-0 z-50 flex justify-center items-center bg-background transition-opacity duration-300">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : (
            // Remove padding for full-screen chat pages
            location.pathname.includes('/chat') ? (
              children
            ) : (
              <div className="p-6">
                {children}
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );
};

export default Layout;