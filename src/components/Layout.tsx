import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import RoomListSidebar from './RoomListSidebar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 300);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const isRoomContext = location.pathname.startsWith('/workspaces/');
  const isChannelContext = location.pathname.includes('/channels/');

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      <Sidebar 
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        setIsMenuOpen={setIsMenuOpen}
        triggerRef={triggerRef}
      />
      
      {/* Only show the RoomListSidebar when we're in a room context */}
      {isRoomContext && <RoomListSidebar />}

      <div className="flex-1 flex flex-col overflow-hidden relative">
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