import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DatabaseStatus } from './DatabaseStatus';
import { PanelLeftClose, PanelRightClose, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Handle page transitions
  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 300);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const updateMenuPosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPosition({ top: rect.top - 8, left: rect.left });
    }
  };

  useEffect(() => {
    if (isMenuOpen) {
      updateMenuPosition();
    }
  }, [isMenuOpen, isCollapsed]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef, triggerRef]);

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsMenuOpen(false);
      navigate('/login');
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Page transition loading indicator */}
      {isTransitioning && (
        <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-80 flex items-center justify-center transition-opacity duration-300">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      )}
      
      {!user && <Header />}
      
      <div className="flex h-screen overflow-hidden">
        {user && 
          <Sidebar 
            isCollapsed={isCollapsed} 
            setIsCollapsed={setIsCollapsed} 
            setIsMenuOpen={setIsMenuOpen}
            triggerRef={triggerRef}
          />}
        
        <main className={`relative flex-1 min-w-0 h-full overflow-y-auto duration-300 ease-in-out`}>
          <DatabaseStatus />
          {children}
        </main>
      </div>

      {isMenuOpen && user && (
        <div 
          ref={menuRef}
          className={`fixed z-50 bg-gray-900 border border-gray-700 rounded-md shadow-lg overflow-hidden py-1 w-56`}
          style={{ 
            top: `${menuPosition.top}px`, 
            left: `${menuPosition.left}px`,
            transform: 'translateY(-100%)'
          }}
        >
          <button
            onClick={handleSignOut}
            className="flex items-center w-full px-3 py-2 text-sm text-left text-gray-200 hover:bg-red-600/80 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}