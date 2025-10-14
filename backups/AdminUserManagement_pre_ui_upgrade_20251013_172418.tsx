import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Users, ChevronLeft, ChevronRight, Search, Edit, PlayCircle, PauseCircle, Ban } from 'lucide-react';
import { EditUserRolesModal } from '../components/modals/EditUserRolesModal';
import { ConfirmationModal } from '../components/modals/ConfirmationModal';

// Define the shape of the combined user data we expect from the function
interface AdminUser {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at?: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
    roles: { id: string; name: string }[];
}

interface FetchResponse {
    users: AdminUser[];
    total: number;
}

const PER_PAGE = 20; // Number of users per page
const DEBOUNCE_DELAY = 500; // milliseconds

export function AdminUserManagement() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // --- State for Modal ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    // --- End Modal State ---

    // --- State for Status Change Confirmation ---
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'suspend' | 'reactivate' | null>(null);
    const [userToAction, setUserToAction] = useState<AdminUser | null>(null);
    const [isPerformingAction, setIsPerformingAction] = useState(false); // Loading state for the action itself
    // --- End Status Change State ---

    const fetchUsers = useCallback(async (page: number, search: string) => {
        setLoading(true);
        setError(null);
        console.log(`Fetching page ${page}, search: '${search}'`);
        try {
            const { data, error: functionError } = await supabase.functions.invoke<FetchResponse>(
                'admin-get-users',
                {
                    body: { 
                        page: page, 
                        perPage: PER_PAGE,
                        searchTerm: search
                    }
                }
            );

            if (functionError) throw new Error(functionError.message || 'Failed to fetch users');
            if (!data) throw new Error('No data received from function');

            setUsers(data.users || []);
            setTotalUsers(data.total || 0);
            setCurrentPage(page);

        } catch (err: any) {
            console.error("Error fetching users:", err);
            setError(err.message || 'An unknown error occurred');
            setUsers([]);
            setTotalUsers(0);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        debounceTimeoutRef.current = setTimeout(() => {
            fetchUsers(1, searchTerm);
        }, DEBOUNCE_DELAY);

        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [searchTerm, fetchUsers]);

    const totalPages = Math.ceil(totalUsers / PER_PAGE);

    const handlePrevPage = () => {
        if (currentPage > 1) {
            fetchUsers(currentPage - 1, searchTerm);
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            fetchUsers(currentPage + 1, searchTerm);
        }
    };

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    // --- Modal Handlers ---
    const handleEditClick = (userToEdit: AdminUser) => {
        console.log('[AdminUserManagement] handleEditClick called for user:', userToEdit);
        setEditingUser(userToEdit);
        setIsEditModalOpen(true);
    };

    const handleCloseModal = () => {
        console.log('[AdminUserManagement] handleCloseModal called');
        setIsEditModalOpen(false);
        setEditingUser(null);
    };

    const handleRolesUpdated = (userId: string, updatedRoles: { id: string; name: string }[]) => {
        console.log(`[AdminUserManagement] handleRolesUpdated called for user ${userId}`);
        setUsers(currentUsers => 
            currentUsers.map(u => 
                u.id === userId ? { ...u, roles: updatedRoles } : u
            )
        );
    };
    // --- End Modal Handlers ---

    // --- Status Action Handlers ---
    const handleStatusActionClick = (user: AdminUser, action: 'suspend' | 'reactivate') => {
        setUserToAction(user);
        setConfirmAction(action);
        setIsConfirmModalOpen(true);
    };

    const closeConfirmModal = () => {
        setIsConfirmModalOpen(false);
        setUserToAction(null);
        setConfirmAction(null);
    };

    const confirmStatusChange = async () => {
        if (!userToAction || !confirmAction) return;

        setIsPerformingAction(true);
        setError(null);
        try {
            const { error: functionError } = await supabase.functions.invoke(
                'admin-set-user-status',
                {
                    body: { 
                        userIdToUpdate: userToAction.id, 
                        action: confirmAction 
                    }
                }
            );
            if (functionError) throw new Error(functionError.message || `Failed to ${confirmAction} user`);

            console.log(`User ${userToAction.id} ${confirmAction} success`);

        } catch (err: any) {
            console.error(`Error ${confirmAction} user:`, err);
            setError(err.message || 'An unknown error occurred');
        } finally {
            setIsPerformingAction(false);
            closeConfirmModal();
        }
    };
    // --- End Status Action Handlers ---

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString();
        } catch (e) {
            return 'Invalid Date';
        }
    };

    // Log state on render
    console.log('[AdminUserManagement] Rendering - isEditModalOpen:', isEditModalOpen, 'editingUser:', editingUser);

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold flex items-center">
                    <Users className="w-8 h-8 mr-3 text-indigo-400" />
                    User Management
                </h1>
                <div className="relative">
                    <input 
                        type="text"
                        placeholder="Search users (email, name...)"
                        value={searchTerm}
                        onChange={handleSearchChange}
                        className="pl-10 pr-4 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                </div>
            </div>

            {error && (
                <div className="mb-4 bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    <span>Error loading users: {error}</span>
                </div>
            )}

            <div className="bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Roles</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Joined</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Last Sign In</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="text-center py-10 text-gray-500">
                                    Loading users...
                                </td>
                            </tr>
                        ) : users.length === 0 ? (
                             <tr>
                                <td colSpan={6} className="text-center py-10 text-gray-500">
                                    {searchTerm ? `No users found matching "${searchTerm}".` : "No users found."}
                                </td>
                            </tr>
                        ) : (
                            users.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-100" title={user.email}>{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{user.full_name || user.username || '---'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                        {user.roles.map(role => (
                                            <span key={role.id} className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${role.name === 'admin' ? 'bg-indigo-600 text-indigo-100' : 'bg-gray-600 text-gray-100'}`}>
                                                {role.name}
                                            </span>
                                        ))}
                                        {user.roles.length === 0 && <span className="text-gray-500 italic">No roles</span>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{formatDate(user.created_at)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{formatDate(user.last_sign_in_at)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                        <button 
                                            onClick={() => handleEditClick(user)} 
                                            className="text-indigo-400 hover:text-indigo-300 p-1 rounded hover:bg-gray-700"
                                            title="Edit Roles"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleStatusActionClick(user, 'suspend')} 
                                            className="text-red-500 hover:text-red-400 p-1 rounded hover:bg-gray-700"
                                            title="Suspend User"
                                        >
                                            <Ban size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {(!searchTerm || totalUsers > PER_PAGE) && totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
                    <span>
                        {searchTerm 
                            ? `Page ${currentPage} (Total matching approximate: ${totalUsers})` 
                            : `Page ${currentPage} of ${totalPages} (Total: ${totalUsers} users)`
                        }
                    </span>
                    <div className="flex space-x-2">
                        <button
                            onClick={handlePrevPage}
                            disabled={currentPage === 1 || loading}
                            className="px-3 py-1 rounded border border-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                        </button>
                        <button
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages || loading}
                             className="px-3 py-1 rounded border border-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            Next <ChevronRight className="w-4 h-4 ml-1" />
                        </button>
                    </div>
                </div>
            )}

            <EditUserRolesModal 
                user={editingUser}
                isOpen={isEditModalOpen}
                onClose={handleCloseModal}
                onRolesUpdated={handleRolesUpdated}
            />
            <ConfirmationModal 
                isOpen={isConfirmModalOpen}
                onClose={closeConfirmModal}
                onConfirm={confirmStatusChange}
                title={`${confirmAction === 'suspend' ? 'Suspend' : 'Reactivate'} User?`}
                confirmText={`${confirmAction === 'suspend' ? 'Suspend' : 'Reactivate'}`}
                confirmButtonVariant={confirmAction === 'suspend' ? 'danger' : 'primary'}
                isLoading={isPerformingAction}
            >
                <p className="text-gray-300">
                    Are you sure you want to {confirmAction} the user <span className="font-medium text-white">{userToAction?.email}</span>?
                    {confirmAction === 'suspend' && 
                        <span className="block mt-2 text-sm text-yellow-400">This will prevent the user from logging in.</span>
                    }
                     {confirmAction === 'reactivate' && 
                        <span className="block mt-2 text-sm text-green-400">This will allow the user to log in again.</span>
                    }
                </p>
            </ConfirmationModal>
        </div>
    );
} 