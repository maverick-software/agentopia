import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Bot, Users, ChevronLeft, ChevronRight, Search, PowerOff, ToggleLeft, ToggleRight, Eye, Loader2 } from 'lucide-react';
import { ConfirmationModal } from '../components/modals/ConfirmationModal';

// Define the shape of the agent data we expect from the function
interface AgentOwner {
    id: string;
    email?: string;
    username?: string;
    full_name?: string;
}

interface AdminAgent {
    id: string;
    name: string;
    description?: string;
    created_at: string;
    active: boolean; // Agent's own active flag
    owner: AgentOwner | null;
    discord_status: string; // e.g., 'active', 'inactive', 'connecting'
    enabled_guild_count: number;
    total_guild_count: number;
}

interface FetchResponse {
    agents: AdminAgent[];
    total: number;
}

const PER_PAGE = 20;
const DEBOUNCE_DELAY = 500;

export function AdminAgentManagement() {
    const [agents, setAgents] = useState<AdminAgent[]>([]);
    const [totalAgents, setTotalAgents] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // --- State for individual row actions ---
    const [togglingActive, setTogglingActive] = useState<Record<string, boolean>>({}); // { [agentId]: isLoading }
    // --- End row action state ---

    // --- State for Force Stop Confirmation ---
    const [isStopConfirmModalOpen, setIsStopConfirmModalOpen] = useState(false);
    const [stoppingAgent, setStoppingAgent] = useState<AdminAgent | null>(null);
    const [isStoppingWorker, setIsStoppingWorker] = useState<Record<string, boolean>>({}); // { [agentId]: isLoading }
    // --- End Force Stop State ---

    // Ref to store refresh timeouts
    const refreshTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

    const fetchAgents = useCallback(async (page: number, search: string) => {
        setLoading(true);
        setError(null);
        // Clear any pending refresh timeouts when a full fetch starts
        Object.values(refreshTimeoutsRef.current).forEach(clearTimeout);
        refreshTimeoutsRef.current = {};
        try {
            const { data, error: functionError } = await supabase.functions.invoke<FetchResponse>(
                'admin-get-agents',
                { body: { page: page, perPage: PER_PAGE, searchTerm: search } }
            );
            if (functionError) throw new Error(functionError.message || 'Failed to fetch agents');
            if (!data) throw new Error('No data received from function');
            setAgents(data.agents || []);
            setTotalAgents(data.total || 0);
            setCurrentPage(page);
            
            // Reset action-specific loading states on successful fetch
            setIsStoppingWorker({}); 
            setTogglingActive({});

        } catch (err: any) {
            console.error("Error fetching agents:", err);
            setError(err.message || 'An unknown error occurred');
            setAgents([]);
            setTotalAgents(0);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = setTimeout(() => {
            fetchAgents(1, searchTerm);
        }, DEBOUNCE_DELAY);
        return () => { if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current); };
    }, [searchTerm, fetchAgents]);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
             Object.values(refreshTimeoutsRef.current).forEach(clearTimeout);
        }
    }, []);

    const totalPages = Math.ceil(totalAgents / PER_PAGE);

    const handlePrevPage = () => { if (currentPage > 1) { fetchAgents(currentPage - 1, searchTerm); } };
    const handleNextPage = () => { if (currentPage < totalPages) { fetchAgents(currentPage + 1, searchTerm); } };
    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => { setSearchTerm(event.target.value); };
    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString();
        } catch (e) {
            return 'Invalid Date';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'active': return 'bg-green-500';
            case 'connecting': return 'bg-yellow-500';
            case 'error': return 'bg-red-500';
            case 'terminating': return 'bg-orange-500';
            case 'inactive':
            default: return 'bg-gray-500';
        }
    };

    // --- Handler for Toggling Agent Active Status ---
    const handleToggleAgentActive = async (agentId: string, currentActiveStatus: boolean) => {
        const newActiveStatus = !currentActiveStatus;
        console.log(`Toggling agent ${agentId} active status to ${newActiveStatus}`);

        // Set loading state for this specific agent
        setTogglingActive(prev => ({ ...prev, [agentId]: true }));
        setError(null); // Clear previous errors

        try {
            const { error: functionError } = await supabase.functions.invoke(
                'admin-set-agent-active',
                { body: { agentId: agentId, active: newActiveStatus } }
            );

            if (functionError) throw new Error(functionError.message || 'Failed to update agent status');

            // Update local state on success
            setAgents(prevAgents => 
                prevAgents.map(agent => 
                    agent.id === agentId ? { ...agent, active: newActiveStatus } : agent
                )
            );
            console.log(`Agent ${agentId} status successfully updated locally to ${newActiveStatus}`);

        } catch (err: any) {
            console.error(`Error toggling agent ${agentId} active status:`, err);
            setError(err.message || 'An unknown error occurred while updating status.');
            // Optionally revert local state on error, or show error indicator on row
        } finally {
            // Remove loading state for this agent
            setTogglingActive(prev => ({ ...prev, [agentId]: false }));
        }
    };
    // --- End Toggle Handler ---

    // --- Handlers for Force Stopping Worker ---
    const handleForceStopClick = (agent: AdminAgent) => {
        setStoppingAgent(agent);
        setIsStopConfirmModalOpen(true);
    };

    const closeStopConfirmModal = () => {
        setIsStopConfirmModalOpen(false);
        setStoppingAgent(null);
    };

    const confirmForceStop = async () => {
        if (!stoppingAgent) return;
        const agentId = stoppingAgent.id;
        const REFRESH_DELAY_MS = 5000; // Refresh after 5 seconds

        console.log(`Confirming force stop for agent ${agentId}`);
        setIsStoppingWorker(prev => ({ ...prev, [agentId]: true }));
        setError(null);
        // Clear any previous refresh timeout for this agent
        if (refreshTimeoutsRef.current[agentId]) {
            clearTimeout(refreshTimeoutsRef.current[agentId]);
        }

        try {
             const { error: functionError } = await supabase.functions.invoke(
                'admin-force-stop-worker',
                { body: { agentId: agentId } }
            );

            if (functionError) throw new Error(functionError.message || 'Failed to send stop command');
            
            console.log(`Force stop command sent for agent ${agentId}. Scheduling refresh.`);
            // Optimistically update status for immediate feedback
            setAgents(prevAgents => 
                prevAgents.map(agent => 
                    agent.id === agentId ? { ...agent, discord_status: 'stopping' } : agent
                )
            );
            
            // Schedule a refresh to get the actual final status
            refreshTimeoutsRef.current[agentId] = setTimeout(() => {
                console.log(`Refreshing agent list after force stop request for ${agentId}`);
                fetchAgents(currentPage, searchTerm); // Refetch current page
                delete refreshTimeoutsRef.current[agentId]; // Clean up ref
            }, REFRESH_DELAY_MS);

        } catch (err: any) {
            console.error(`Error force stopping agent ${agentId}:`, err);
            setError(err.message || 'An unknown error occurred while stopping the worker.');
            // If the command failed, revert optimistic state? Or just show error.
            // Reverting might be confusing if status is already 'stopping'. Let error show.
        } finally {
            // IMPORTANT: Reset the button's loading state *immediately* after command is sent
            setIsStoppingWorker(prev => ({ ...prev, [agentId]: false })); 
            closeStopConfirmModal();
        }
    };
    // --- End Force Stop Handlers ---

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center text-foreground">
                            <Bot className="w-8 h-8 mr-3 text-primary" />
                            Agent Management
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Monitor and manage AI agents, their Discord status, and configurations
                        </p>
                    </div>
                    <div className="relative">
                        <input 
                            type="text"
                            placeholder="Search agents or owners..."
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
                        <span>Error loading agents: {error}</span>
                    </div>
                )}

                <div className="bg-card border border-border shadow-sm rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Owner</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Discord Status</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Enabled Guilds</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Config Active</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-card divide-y divide-border">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-muted-foreground">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                                                <span>Loading agents...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : agents.length === 0 ? (
                                     <tr>
                                        <td colSpan={7} className="text-center py-12 text-muted-foreground">
                                            {searchTerm ? `No agents found matching "${searchTerm}".` : "No agents found."}
                                        </td>
                                    </tr>
                                ) : (
                                    agents.map((agent) => {
                                        const isToggling = togglingActive[agent.id];
                                        const isStopping = isStoppingWorker[agent.id];
                                        return (
                                            <tr key={agent.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-foreground" title={agent.description || agent.name}>{agent.name}</td>
                                                <td className="px-6 py-4 text-sm text-foreground" title={agent.owner?.email}>{agent.owner?.full_name || agent.owner?.username || agent.owner?.email || 'Unknown'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(agent.discord_status)} text-white capitalize`}>
                                                        {agent.discord_status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{agent.enabled_guild_count} / {agent.total_guild_count}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${agent.active ? 'bg-success/10 text-success border border-success/20' : 'bg-muted text-muted-foreground border border-border'}`}>
                                                        {agent.active ? 'Yes' : 'No'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{formatDate(agent.created_at)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            className="text-primary hover:text-primary/80 p-1.5 rounded-md hover:bg-muted disabled:opacity-50 transition-colors" 
                                                            title="View Details" 
                                                            disabled={isStopping || isToggling}
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleToggleAgentActive(agent.id, agent.active)}
                                                            disabled={isToggling || isStopping}
                                                            className={`p-1.5 rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${agent.active ? 'text-success hover:text-success/80' : 'text-muted-foreground hover:text-foreground'}`}
                                                            title={agent.active ? "Disable Agent Config" : "Enable Agent Config"}
                                                        >
                                                            {isToggling ? <Loader2 size={16} className="animate-spin"/> : (agent.active ? <ToggleRight size={16}/> : <ToggleLeft size={16} />) }
                                                        </button>
                                                        <button 
                                                            onClick={() => handleForceStopClick(agent)} 
                                                            disabled={isStopping || isToggling || agent.discord_status === 'inactive' || agent.discord_status === 'stopping'}
                                                            className="p-1.5 rounded-md hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed text-destructive hover:text-destructive/80 transition-colors"
                                                            title={agent.discord_status === 'inactive' ? "Worker already inactive" : "Force Stop Discord Worker"}
                                                        >
                                                             {isStopping ? <Loader2 size={16} className="animate-spin"/> : <PowerOff size={16} /> }
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination Controls */}
                {(!searchTerm || totalAgents > PER_PAGE) && totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
                         <span>{searchTerm ? `Page ${currentPage} (Total matching approximate: ${totalAgents})` : `Page ${currentPage} of ${totalPages} (Total: ${totalAgents} agents)`}</span>
                         <div className="flex gap-2">
                            <button 
                                onClick={handlePrevPage} 
                                disabled={currentPage === 1} 
                                className="px-4 py-2 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors text-foreground"
                            >
                                <ChevronLeft className="w-4 h-4" /> Previous
                            </button>
                            <button 
                                onClick={handleNextPage} 
                                disabled={currentPage === totalPages} 
                                className="px-4 py-2 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors text-foreground"
                            >
                                Next <ChevronRight className="w-4 h-4" />
                            </button>
                         </div>
                    </div>
                )}
                
                {/* --- Force Stop Confirmation Modal --- */} 
                <ConfirmationModal
                    isOpen={isStopConfirmModalOpen}
                    onClose={closeStopConfirmModal}
                    onConfirm={confirmForceStop}
                    title="Force Stop Worker?"
                    confirmText="Force Stop"
                    confirmButtonVariant="danger"
                    isLoading={isStoppingWorker[stoppingAgent?.id || '']}
                >
                     <p className="text-muted-foreground">
                        Are you sure you want to forcefully stop the Discord worker process for agent <span className="font-medium text-foreground">{stoppingAgent?.name}</span>?
                        <span className="block mt-2 text-sm text-warning">This may interrupt ongoing interactions. The agent can be reactivated later from its edit page.</span>
                    </p>
                </ConfirmationModal>
            </div>
        </div>
    );
} 