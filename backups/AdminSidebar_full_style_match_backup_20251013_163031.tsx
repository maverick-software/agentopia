import React from 'react';
import { NavLink } from 'react-router-dom';
// Replace Heroicons with Lucide icons
import { 
  LayoutDashboard, 
  Users, 
  Bot, // Using Bot icon for Agent Management
  Key, // Add Key icon for System API Keys
  Settings, // Add Settings icon for Integration Management
  CreditCard, // Add CreditCard icon for Stripe Configuration
  DollarSign, // Add DollarSign icon for User Billing
  PanelLeftClose, 
  PanelRightClose 
} from 'lucide-react';
import { AccountMenu } from '@/components/shared/AccountMenu';
import { Logo } from '../components/ui/logo';

// Define props for the component
interface AdminSidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const navigation = [
    // Update icons to Lucide components
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'User Management', href: '/admin/users', icon: Users },
    { name: 'Agent Management', href: '/admin/agents', icon: Bot }, 
    { name: 'System API Keys', href: '/admin/system-api-keys', icon: Key },
    { name: 'Integration Management', href: '/admin/oauth-providers', icon: Settings },
    // Removed 2025-10-13: 'MCP Templates' and 'Droplets' - deprecated system
    { name: 'Stripe Configuration', href: '/admin/billing/stripe-config', icon: CreditCard },
    { name: 'User Billing', href: '/admin/billing/users', icon: DollarSign },
    // Add other admin items here if needed
];

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

// Accept props
export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isCollapsed, setIsCollapsed }) => {
    return (
        // Updated to use theme CSS variables for multi-theme support
        <nav 
            className={`relative flex flex-col bg-sidebar-background border-r border-sidebar-border h-full overflow-y-auto transition-all duration-300 ease-in-out ${isCollapsed ? 'p-2' : 'p-4'}`}
        >
            {/* Main content area */}
            <div className="flex-1 flex flex-col">
                {/* Top section (Logo/Title and Nav Links) */}
                <div className="flex-1">
                    {/* Logo/Title section - adjust styling based on isCollapsed */}
                    <div className={`flex items-center mb-6 transition-all duration-300 ${isCollapsed ? 'justify-center mt-8' : 'justify-start'}`}>
                        <Logo 
                            size={isCollapsed ? 'sm' : 'md'}
                            variant="icon"
                            showText={false}
                        />
                        {!isCollapsed && (
                            <span className="ml-2 text-sm font-medium text-sidebar-primary">
                                Admin Portal
                            </span>
                        )}
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
                                                ? 'bg-sidebar-primary text-sidebar-primary-foreground' 
                                                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
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
                
                {/* Bottom section - Collapse Button and Account Menu */}
                <div className="mt-auto">
                    {/* Collapse Button - Above the line */}
                    <div className="mb-4 flex">
                        <button 
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className={`text-sidebar-foreground/60 hover:text-sidebar-foreground p-1 rounded hover:bg-sidebar-accent transition-colors duration-200 ${ 
                                isCollapsed ? 'mx-auto' : 'ml-1' // Adjust positioning
                            }`}
                            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                        >
                            {isCollapsed ? <PanelRightClose size={20} /> : <PanelLeftClose size={20} />}
                        </button>
                    </div>
                    
                    {/* Account Menu - Fixed at bottom with separator line */}
                    <div className="border-t border-sidebar-border pt-4">
                        <AccountMenu isCollapsed={isCollapsed} isAdminArea={true} />
                    </div>
                </div>
            </div>
        </nav>
    );
}; 