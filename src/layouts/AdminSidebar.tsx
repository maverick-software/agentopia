import React from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, UsersIcon, CogIcon, ShieldCheckIcon, ServerIcon, LifebuoyIcon } from '@heroicons/react/24/outline'; // Example icons

const navigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: HomeIcon },
    { name: 'User Management', href: '/admin/users', icon: UsersIcon },
    { name: 'Agent Management', href: '/admin/agents', icon: ServerIcon }, // <-- New Item
    // Add other admin navigation items here
    // { name: 'Role Management', href: '/admin/roles', icon: ShieldCheckIcon },
    // { name: 'System Health', href: '/admin/health', icon: LifebuoyIcon },
    // { name: 'Settings', href: '/admin/settings', icon: CogIcon },
];

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

export const AdminSidebar: React.FC = () => {
    return (
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-gray-900 px-6 pb-4">
            <div className="flex h-16 shrink-0 items-center text-white">
                {/* Replace with your logo or admin panel name */}
                <img
                    className="h-8 w-auto"
                    src="/logo.png" // Make sure you have a logo image
                    alt="Your Company"
                />
                <span className="ml-3 text-xl font-semibold">Admin Panel</span>
            </div>
            <nav className="flex flex-1 flex-col">
                <ul role="list" className="flex flex-1 flex-col gap-y-7">
                    <li>
                        <ul role="list" className="-mx-2 space-y-1">
                            {navigation.map((item) => (
                                <li key={item.name}>
                                    <NavLink
                                        to={item.href}
                                        className={({ isActive }) =>
                                            classNames(
                                                isActive
                                                    ? 'bg-gray-800 text-white'
                                                    : 'text-gray-400 hover:text-white hover:bg-gray-800',
                                                'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                            )
                                        }
                                    >
                                        <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                                        {item.name}
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </li>
                    {/* Optional: Add other sections like Settings, Profile links here */}
                    {/* Example:
                    <li className="mt-auto">
                        <a
                            href="#"
                            className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-400 hover:bg-gray-800 hover:text-white"
                        >
                            <CogIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
                            Settings
                        </a>
                    </li>
                    */}
                </ul>
            </nav>
        </div>
    );
}; 