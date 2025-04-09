import React from 'react';
import { Bot, Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="bg-gray-800 border-b border-gray-700">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-3">
          <Bot className="w-8 h-8 text-indigo-500" />
          <h1 className="text-xl font-semibold font-poppins">Agentopia</h1>
        </div>
        
        {user && (
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-300">{user.email}</span>
            <button
              onClick={signOut}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}