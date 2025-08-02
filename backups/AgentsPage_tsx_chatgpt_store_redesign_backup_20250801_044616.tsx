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
    console.log(`DEBUG: User ID: ${user.id}`);

    try {
      setError(null);
      setLoading(true);
      setIsRetrying(true);

      const isConnected = await isSupabaseConnected();
      if (!isConnected) throw new Error('Unable to connect to the database.');
      console.log('DEBUG: Supabase connection successful');

      const { data, error: fetchError } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      console.log('DEBUG: Supabase query result:', { data, error: fetchError });
      console.log('DEBUG: Number of agents found:', data?.length || 0);

      if (fetchError) throw fetchError;

      console.log('DEBUG: Setting agents and loading state');
      setAgents(data || []);
      setLoading(false);
      setIsRetrying(false);
      if (isInitialCall) totalFetchAttempts.current = 0;
      console.log('DEBUG: Loading state set to false');

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

  // Debug effect to monitor loading state
  useEffect(() => {
    console.log('DEBUG: Loading state changed to:', loading);
  }, [loading]);

  // Force loading to false if we have agents but loading is still true
  useEffect(() => {
    if (agents.length > 0 && loading) {
      console.log('DEBUG: Forcing loading to false - we have agents but loading is still true');
      setLoading(false);
    }
  }, [agents.length, loading]);

  // Debug useEffect to monitor loading state changes
  useEffect(() => {
    console.log('DEBUG: Loading state changed to:', loading);
  }, [loading]);

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
    console.log('DEBUG: renderedAgents useMemo called');
    console.log('DEBUG: agents array:', agents);
    console.log('DEBUG: agents.length:', agents.length);
    
    if (!agents.length) {
      console.log('DEBUG: No agents to render - returning null');
      return null;
    }

    console.log('DEBUG: Rendering agents...');
    return agents.map((agent, index) => {
      console.log(`DEBUG: Rendering agent ${index}:`, agent);
      return (
        <div
          key={agent.id}
          className="bg-card border border-border rounded-lg p-6 space-y-4 transition-colors duration-200 hover:bg-accent shadow-sm"
        >
          <div className="flex justify-between items-start">
            <div className="flex items-start space-x-4 flex-1">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {agent.avatar_url ? (
                  <img 
                    src={agent.avatar_url} 
                    alt={`${agent.name} avatar`}
                    className="w-12 h-12 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted border-2 border-border flex items-center justify-center">
                    <span className="text-muted-foreground text-lg font-semibold">
                      {agent.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-semibold text-foreground">{agent.name}</h3>
                <p className="text-muted-foreground text-sm mt-1 line-clamp-2 leading-relaxed">
                  {agent.description}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => navigate(`/agents/${agent.id}/chat`)}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset"
              >
                <MessageSquare className="h-5 w-5" />
              </button>
              <button
                onClick={() => toggleAgentStatus(agent.id, agent.active ?? false)}
                className={`p-2 rounded-md transition-colors duration-200 ${
                  agent.active ? 'text-success hover:text-success/80' : 'text-muted-foreground hover:text-foreground'
                }`}
                title={agent.active ? 'Deactivate agent' : 'Activate agent'}
              >
                <Power className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate(`/agents/${agent.id}`)}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset"
                title="Edit agent"
              >
                <Settings className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(agent.id)}
                className="p-2 text-muted-foreground hover:text-destructive rounded-md transition-colors duration-200"
                title="Delete agent"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="pt-4 border-t border-border">
            {agent.discord_channel && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discord Channel:</span>
                <span className="text-foreground">#{agent.discord_channel}</span>
              </div>
            )}
            <div className={`flex justify-between text-sm ${agent.discord_channel ? 'mt-2' : ''}`}>
              <span className="text-muted-foreground">Status:</span>
              <span className={agent.active ? 'text-success' : 'text-muted-foreground'}>
                {agent.active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
      );
    });
  }, [agents, navigate, toggleAgentStatus]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[hsl(210,15%,70%)]">Please sign in to view your agents.</div>
      </div>
    );
  }

  console.log('DEBUG: Main render - user exists');
  console.log('DEBUG: loading:', loading);
  console.log('DEBUG: agents.length:', agents.length);
  console.log('DEBUG: renderedAgents:', renderedAgents);

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">AI Agents</h1>
        <button
          onClick={() => navigate('/agents/new')}
          className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors duration-200 font-medium h-11"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Agent
        </button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-md flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => fetchAgents(true)}
            disabled={isRetrying || loading}
            className="flex items-center px-4 py-2 bg-destructive/20 hover:bg-destructive/30 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="bg-card border border-border rounded-lg p-6 space-y-4 animate-pulse shadow-sm"
            >
              <div className="h-6 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
              <div className="pt-4 border-t border-border space-y-2">
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center shadow-sm">
          <p className="text-muted-foreground">No agents found. Create your first agent to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {renderedAgents}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-foreground">Delete Agent</h2>
            <p className="text-foreground mb-6">
              Are you sure you want to delete this agent? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors duration-200"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAgent(showDeleteConfirm)}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
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