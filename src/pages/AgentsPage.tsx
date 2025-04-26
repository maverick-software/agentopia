import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, Trash2, Power, Edit2, MessageSquare, RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConnected } from '../lib/supabase';
import type { Agent } from '../types';

export function AgentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const totalFetchAttempts = useRef(0);
  const MAX_TOTAL_FETCH_ATTEMPTS = 5;

  const fetchAgents = useCallback(async (isInitialCall = true) => {
    if (!user) return;

    let currentAttempt = totalFetchAttempts.current + 1;
    if (isInitialCall) {
      currentAttempt = 1;
      totalFetchAttempts.current = 0;
    }
    totalFetchAttempts.current = currentAttempt;

    if (currentAttempt > MAX_TOTAL_FETCH_ATTEMPTS) {
      console.warn(`Max fetch attempts (${MAX_TOTAL_FETCH_ATTEMPTS}) reached for agents. Aborting.`);
      setError(`Failed to load agents after ${MAX_TOTAL_FETCH_ATTEMPTS} attempts.`);
      setLoading(false);
      setIsRetrying(false);
      return;
    }
    console.log(`Fetching agents... Attempt ${currentAttempt}`);

    try {
      setError(null);
      setLoading(true);
      setIsRetrying(true);

      const isConnected = await isSupabaseConnected();
      if (!isConnected) throw new Error('Unable to connect to the database.');

      const { data, error: fetchError } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      await new Promise(resolve => setTimeout(resolve, 300));
      setAgents(data || []);
      setLoading(false);
      setIsRetrying(false);
      if (isInitialCall) totalFetchAttempts.current = 0;

    } catch (err: any) {
      console.error('Error fetching agents:', err);
      if (currentAttempt < MAX_TOTAL_FETCH_ATTEMPTS) {
        const delay = 2000;
        console.log(`Agent fetch failed, retrying in ${delay}ms (Attempt ${currentAttempt + 1})`);
        setTimeout(() => fetchAgents(false), delay);
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(`Failed to load agents. Retrying... (${currentAttempt}/${MAX_TOTAL_FETCH_ATTEMPTS}): ${message}`);
      } else {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(`Failed to load agents after ${MAX_TOTAL_FETCH_ATTEMPTS} attempts: ${message}`);
        console.error('Max fetch attempts reached for agents after error.');
        setLoading(false);
        setIsRetrying(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      totalFetchAttempts.current = 0;
      fetchAgents(true);
    } else {
      setAgents([]);
      setLoading(false);
      setError(null);
      setIsRetrying(false);
    }
  }, [user, fetchAgents]);

  const toggleAgentStatus = useCallback(async (id: string, currentStatus: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('agents')
        .update({ active: !currentStatus })
        .eq('id', id)
        .eq('user_id', user?.id);

      if (updateError) throw updateError;

      setAgents(prev => prev.map(agent =>
        agent.id === id ? { ...agent, active: !currentStatus } : agent
      ));
      setError(null);
    } catch (err) {
      console.error('Error updating agent status:', err);
      setError('Failed to update agent status. Please try again.');
    }
  }, [user?.id]);

  const handleDeleteAgent = useCallback(async (id: string) => {
    if (!id || isDeleting) return;
    
    try {
      setIsDeleting(true);
      
      const { error: deleteError } = await supabase
        .from('agents')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (deleteError) throw deleteError;

      setAgents(prev => prev.filter(agent => agent.id !== id));
      setShowDeleteConfirm(null);
      setError(null);
    } catch (err) {
      console.error('Error deleting agent:', err);
      setError('Failed to delete agent. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [user?.id, isDeleting]);

  const renderedAgents = useMemo(() => {
    if (!agents.length) return null;

    return agents.map((agent, index) => (
      <div
        key={agent.id}
        className="bg-gray-800 rounded-lg p-6 space-y-4 opacity-0 animate-fade-in"
        style={{
          animationDelay: `${index * 100}ms`,
          animationFillMode: 'forwards'
        }}
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-semibold">{agent.name}</h3>
            <p className="text-gray-400 text-sm mt-1">{agent.description}</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => navigate(`/agents/${agent.id}/chat`)}
              className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            >
              <MessageSquare className="h-5 w-5" />
            </button>
            <button
              onClick={() => toggleAgentStatus(agent.id, agent.active)}
              className={`p-2 rounded-md transition-colors ${
                agent.active ? 'text-green-400 hover:text-green-500' : 'text-gray-400 hover:text-gray-300'
              }`}
              title={agent.active ? 'Deactivate agent' : 'Activate agent'}
            >
              <Power className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate(`/agents/${agent.id}`)}
              className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              title="Edit agent"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(agent.id)}
              className="p-2 text-gray-400 hover:text-red-400 rounded-md transition-colors"
              title="Delete agent"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="pt-4 border-t border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Personality:</span>
            <span className="text-gray-300">{agent.personality}</span>
          </div>
          {agent.discord_channel && (
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-400">Discord Channel:</span>
              <span className="text-gray-300">#{agent.discord_channel}</span>
            </div>
          )}
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-400">Status:</span>
            <span className={agent.active ? 'text-green-400' : 'text-gray-400'}>
              {agent.active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
    ));
  }, [agents, navigate, toggleAgentStatus]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Please sign in to view your agents.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">AI Agents</h1>
        <button
          onClick={() => navigate('/agents/new')}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Agent
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => fetchAgents(true)}
            disabled={isRetrying || loading}
            className="flex items-center px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div 
              key={i} 
              className="bg-gray-800 rounded-lg p-6 space-y-4 animate-pulse"
            >
              <div className="h-6 bg-gray-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-700 rounded w-1/2"></div>
              <div className="pt-4 border-t border-gray-700 space-y-2">
                <div className="h-4 bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-700 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400">No agents found. Create your first agent to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {renderedAgents}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Delete Agent</h2>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete this agent? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAgent(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}