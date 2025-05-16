import React from 'react';
import { NavLink } from 'react-router-dom';
// Replace Heroicons with Lucide icons
import { 
  LayoutDashboard, 
  Users, 
  Bot, // Using Bot icon for Agent Management
  PanelLeftClose, 
  PanelRightClose 
} from 'lucide-react';

// Define props for the component
interface AdminSidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const navigation = [
    // Update icons to Lucide components
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'User Management', href: '/admin/users', icon: Users },
    { name: 'Agent Management', href: '/admin/agents', icon: Bot }, 
    // Add other admin items here if needed
];

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

// Accept props
export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isCollapsed, setIsCollapsed }) => {
    return (
        // Apply dynamic padding and background like user sidebar
        <nav 
            className={`relative flex flex-col bg-gray-800 h-full overflow-y-auto transition-all duration-300 ease-in-out ${isCollapsed ? 'p-2' : 'p-4'}`}
        >
            {/* Use flex-1 to push button to bottom */}
            <div className="flex-1 mb-4 flex flex-col">
                {/* Top section (Logo/Title and Nav Links) */}
                <div>
                    {/* Logo/Title section - adjust styling based on isCollapsed */}
                    <div className={`flex items-center mb-6 transition-all duration-300 ${isCollapsed ? 'justify-center mt-8' : 'justify-start'}`}>
                        {/* Use a generic icon or replace img src */}
                        <Bot size={isCollapsed ? 28 : 24} className="text-indigo-400" />
                        <span className={`ml-2 text-xl font-bold transition-opacity duration-300 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
                            Admin Panel
                        </span>
                    </div>
                    
                    {/* Navigation Links - adjust styling based on isCollapsed */}
                    <ul role="list" className="space-y-2">
                        {navigation.map((item) => (
                            <li key={item.name}>
                                <NavLink
                                    to={item.href}
                                    title={isCollapsed ? item.name : undefined}
                                    className={({ isActive }) =>
                                        `flex items-center space-x-3 rounded-md transition-colors ${
                                            isCollapsed ? 'px-2 justify-center py-3' : 'px-4 py-3' // Adjust padding/justify
                                        } ${
                                            isActive 
                                                ? 'bg-indigo-600 text-white' 
                                                : 'text-gray-300 hover:bg-gray-700'
                                        }`
                                    }
                                >
                                    <item.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                                    {/* Hide text when collapsed */}
                                    <span className={`font-medium transition-opacity duration-300 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>{item.name}</span>
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>
                
                {/* Collapse Button - pushed to bottom */}
                <button 
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={`mt-auto text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors duration-200 mb-2 ${ 
                        isCollapsed ? 'self-center' : 'self-start ml-1' // Adjust positioning
                    }`}
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {isCollapsed ? <PanelRightClose size={20} /> : <PanelLeftClose size={20} />}
                </button>
            </div>

            {/* Remove user profile section for now, keep it simpler */}
        </nav>
    );
}; 