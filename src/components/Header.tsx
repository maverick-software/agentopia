import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Header() {
  const { isAdmin } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close dropdown if clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current && 
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef, triggerRef]);

  return (
    <header className="absolute top-0 right-0 p-4 z-20">
      {/* Conditional Admin Dropdown Trigger */} 
      {isAdmin && (
        <div className="relative">
          <button 
            ref={triggerRef}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            title="Admin Panel"
            className="text-gray-400 hover:text-white transition-colors duration-200 p-2 rounded hover:bg-gray-600/50"
          >
            <ShieldCheck size={20} />
          </button>

          {/* Admin Dropdown Menu */} 
          {isDropdownOpen && (
            <div 
              ref={dropdownRef}
              className="absolute top-full right-0 mt-2 w-48 bg-gray-800 border border-gray-600 rounded-md shadow-lg z-50 py-1"
            >
              <Link 
                to="/admin"
                onClick={() => setIsDropdownOpen(false)}
                className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Admin Dashboard
              </Link>
              <Link 
                to="/admin/users"
                onClick={() => setIsDropdownOpen(false)}
                className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                User Management
              </Link>
              <Link 
                to="/admin/agents"
                onClick={() => setIsDropdownOpen(false)}
                className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Agent Management
              </Link>
            </div>
          )}
        </div>
      )}
      {/* Add other header elements here if needed in the future (e.g., User Menu) */}
    </header>
  );
}