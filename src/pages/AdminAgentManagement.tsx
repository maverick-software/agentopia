import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Bot, Users, ChevronLeft, ChevronRight, Search, PowerOff, ToggleLeft, ToggleRight, Eye } from 'lucide-react';

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

    // TODO: State for modals/actions (disable, force stop)

    const fetchAgents = useCallback(async (page: number, search: string) => {
        setLoading(true);
        setError(null);
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

    const totalPages = Math.ceil(totalAgents / PER_PAGE);

    const handlePrevPage = () => { if (currentPage > 1) { fetchAgents(currentPage - 1, searchTerm); } };
    const handleNextPage = () => { if (currentPage < totalPages) { fetchAgents(currentPage + 1, searchTerm); } };
    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => { setSearchTerm(event.target.value); };
    const formatDate = (dateString?: string) => { /* ... same as before ... */ 
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

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold flex items-center">
                    <Bot className="w-8 h-8 mr-3 text-indigo-400" />
                    Agent Management
                </h1>
                <div className="relative">
                    <input 
                        type="text"
                        placeholder="Search agents or owners..."
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
                    <span>Error loading agents: {error}</span>
                </div>
            )}

            <div className="bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Owner</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Discord Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Enabled Guilds</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Config Active</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Created</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {loading ? (
                            <tr><td colSpan={7} className="text-center py-10 text-gray-500">Loading agents...</td></tr>
                        ) : agents.length === 0 ? (
                             <tr><td colSpan={7} className="text-center py-10 text-gray-500">{searchTerm ? `No agents found matching "${searchTerm}".` : "No agents found."}</td></tr>
                        ) : (
                            agents.map((agent) => (
                                <tr key={agent.id} className="hover:bg-gray-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-100" title={agent.description || agent.name}>{agent.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300" title={agent.owner?.email}>{agent.owner?.full_name || agent.owner?.username || agent.owner?.email || 'Unknown'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(agent.discord_status)} text-white capitalize`}>
                                            {agent.discord_status}
                                        </span>
                                    </td>
                                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{agent.enabled_guild_count} / {agent.total_guild_count}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {agent.active ? 
                                            <span className="text-green-400">Yes</span> : 
                                            <span className="text-gray-500">No</span>
                                        }
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{formatDate(agent.created_at)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                        {/* TODO: Add Admin Actions */}
                                        <button className="text-blue-400 hover:text-blue-300 p-1 rounded hover:bg-gray-700" title="View Details"><Eye size={16} /></button>
                                        <button className="text-yellow-400 hover:text-yellow-300 p-1 rounded hover:bg-gray-700" title="Disable Agent Config (Prevents Activation)">{agent.active ? <ToggleRight size={16}/> : <ToggleLeft size={16} />}</button>
                                        <button className="text-red-500 hover:text-red-400 p-1 rounded hover:bg-gray-700" title="Force Stop Discord Worker"><PowerOff size={16} /></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {(!searchTerm || totalAgents > PER_PAGE) && totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
                     <span>{searchTerm ? `Page ${currentPage} (Total matching approximate: ${totalAgents})` : `Page ${currentPage} of ${totalPages} (Total: ${totalAgents} agents)`}</span>
                     {/* ... pagination buttons ... */} <div className="flex space-x-2"> ... </div>
                </div>
            )}
            
            {/* TODO: Add Modals for actions */} 
        </div>
    );
} 