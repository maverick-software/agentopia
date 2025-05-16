import React, { useState, useRef } from 'react';
import { AdminSidebar } from './AdminSidebar'; // Import the existing admin sidebar

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  // State for admin sidebar collapse
  const [isCollapsedAdmin, setIsCollapsedAdmin] = useState(false);
  // const [isMenuOpen, setIsMenuOpen] = useState(false);
  // const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar Container - Width changes based on collapsed state */}
      <div className={`flex-shrink-0 transition-all duration-300 ease-in-out ${isCollapsedAdmin ? 'w-16' : 'w-64'}`}>
        <AdminSidebar 
            isCollapsed={isCollapsedAdmin} 
            setIsCollapsed={setIsCollapsedAdmin} 
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
         {/* Remove Header Placeholder */}
         {/* <div className="h-16 bg-gray-800 border-b border-gray-700 flex items-center px-4 flex-shrink-0"> 
             Header Area (Admin) - Needs actual Header component
         </div> */}
         {/* Ensure main content takes full height now */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-900 p-6"> {/* Added padding */}
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout; 