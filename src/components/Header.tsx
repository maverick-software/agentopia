import React from 'react';
import { Bot } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-gray-800 border-b border-gray-700">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-3">
          <Bot className="w-8 h-8 text-indigo-500" />
          <h1 className="text-xl font-semibold font-poppins">Agentopia</h1>
        </div>
      </div>
    </header>
  );
}