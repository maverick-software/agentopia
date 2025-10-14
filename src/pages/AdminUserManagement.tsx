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
        <div className="min-h-screen bg-background">
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center text-foreground">
                            <Users className="w-8 h-8 mr-3 text-primary" />
                            User Management
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Manage user accounts, roles, and permissions across the platform
                        </p>
                    </div>
                    <div className="relative">
                        <input 
                            type="text"
                            placeholder="Search users (email, name...)"
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="pl-10 pr-4 py-2 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                        />
                        <Search className="w-5 h-5 text-muted-foreground absolute left-3 top-1/2 transform -translate-y-1/2" />
                    </div>
                </div>

                {error && (
                    <div className="mb-6 bg-destructive/10 border border-destructive/50 text-destructive p-4 rounded-lg flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                        <span>Error loading users: {error}</span>
                    </div>
                )}

                <div className="bg-card border border-border shadow-sm rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Roles</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Joined</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Sign In</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-card divide-y divide-border">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-muted-foreground">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                                                <span>Loading users...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : users.length === 0 ? (
                                     <tr>
                                        <td colSpan={6} className="text-center py-12 text-muted-foreground">
                                            {searchTerm ? `No users found matching "${searchTerm}".` : "No users found."}
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4 text-sm font-medium text-foreground" title={user.email}>{user.email}</td>
                                            <td className="px-6 py-4 text-sm text-foreground">{user.full_name || user.username || '---'}</td>
                                            <td className="px-6 py-4 text-sm">
                                                <div className="flex flex-wrap gap-1">
                                                    {user.roles.map(role => (
                                                        <span key={role.id} className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${role.name === 'admin' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground border border-border'}`}>
                                                            {role.name}
                                                        </span>
                                                    ))}
                                                    {user.roles.length === 0 && <span className="text-muted-foreground italic">No roles</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{formatDate(user.created_at)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{formatDate(user.last_sign_in_at)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => handleEditClick(user)} 
                                                        className="text-primary hover:text-primary/80 p-1.5 rounded-md hover:bg-muted transition-colors"
                                                        title="Edit Roles"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleStatusActionClick(user, 'suspend')} 
                                                        className="text-destructive hover:text-destructive/80 p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                                                        title="Suspend User"
                                                    >
                                                        <Ban size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {(!searchTerm || totalUsers > PER_PAGE) && totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
                        <span>
                            {searchTerm 
                                ? `Page ${currentPage} (Total matching approximate: ${totalUsers})` 
                                : `Page ${currentPage} of ${totalPages} (Total: ${totalUsers} users)`
                            }
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={handlePrevPage}
                                disabled={currentPage === 1 || loading}
                                className="px-4 py-2 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors text-foreground"
                            >
                                <ChevronLeft className="w-4 h-4" /> Prev
                            </button>
                            <button
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages || loading}
                                className="px-4 py-2 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors text-foreground"
                            >
                                Next <ChevronRight className="w-4 h-4" />
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
                    <p className="text-muted-foreground">
                        Are you sure you want to {confirmAction} the user <span className="font-medium text-foreground">{userToAction?.email}</span>?
                        {confirmAction === 'suspend' && 
                            <span className="block mt-2 text-sm text-warning">This will prevent the user from logging in.</span>
                        }
                         {confirmAction === 'reactivate' && 
                            <span className="block mt-2 text-sm text-success">This will allow the user to log in again.</span>
                        }
                    </p>
                </ConfirmationModal>
            </div>
        </div>
    );
} 