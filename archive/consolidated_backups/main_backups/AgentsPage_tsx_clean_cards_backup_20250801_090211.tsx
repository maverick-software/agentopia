import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, Trash2, Power, Edit2, MessageSquare, RefreshCw, Settings, Search, Star, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConnected } from '../lib/supabase';
import type { Agent } from '../types';

// Agent categories for filtering
const AGENT_CATEGORIES = [
  { id: 'all', name: 'All', description: 'All agents' },
  { id: 'featured', name: 'Featured', description: 'Highlighted agents' },
  { id: 'productivity', name: 'Productivity', description: 'Boost your productivity' },
  { id: 'communication', name: 'Communication', description: 'Email, chat, and messaging' },
  { id: 'content', name: 'Content Creation', description: 'Writing and creative work' },
  { id: 'analysis', name: 'Data Analysis', description: 'Data processing and insights' },
  { id: 'automation', name: 'Automation', description: 'Workflow automation' },
  { id: 'customer-service', name: 'Customer Service', description: 'Support and assistance' }
] as const;

type AgentCategory = typeof AGENT_CATEGORIES[number]['id'];

export function AgentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AgentCategory>('all');
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

  // Filtering logic
  const filteredAgents = useMemo(() => {
    let filtered = agents;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(agent => 
        agent.name.toLowerCase().includes(query) ||
        agent.description?.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      // For now, we'll just show featured agents as active ones
      // In the future, this could be based on agent tags or categories
      if (selectedCategory === 'featured') {
        filtered = filtered.filter(agent => agent.active);
      }
      // Add more category filtering logic here as needed
    }

    return filtered;
  }, [agents, searchQuery, selectedCategory]);

  // Modern agent card component
  const AgentCard = ({ agent }: { agent: Agent }) => (
    <div className="group bg-card rounded-2xl border border-border hover:border-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 overflow-hidden">
      {/* Card Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4 flex-1">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {agent.avatar_url ? (
                <img 
                  src={agent.avatar_url} 
                  alt={`${agent.name} avatar`}
                  className="w-12 h-12 rounded-xl object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/30 flex items-center justify-center">
                  <span className="text-primary text-lg font-semibold">
                    {agent.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {agent.name}
                </h3>
                {agent.active && (
                  <div className="flex items-center space-x-1 text-xs text-success bg-success/10 px-2 py-1 rounded-full">
                    <div className="w-1.5 h-1.5 bg-success rounded-full"></div>
                    <span>Active</span>
                  </div>
                )}
              </div>
              <p className="text-muted-foreground text-sm mt-1 line-clamp-2 leading-relaxed">
                {agent.description || 'A helpful AI assistant ready to assist you.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Card Actions */}
      <div className="px-6 pb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/agents/${agent.id}/chat`)}
            className="flex-1 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors duration-200 font-medium mr-2"
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Chat
          </button>
          <div className="flex space-x-1">
            <button
              onClick={() => navigate(`/agents/${agent.id}/edit`)}
              className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-all duration-200"
              title="Edit Agent"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate(`/agents/${agent.id}/edit?tab=settings`)}
              className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-all duration-200"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(agent.id)}
              className="p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all duration-200"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderedAgents = useMemo(() => {
    if (!filteredAgents.length) {
      return null;
    }

    return filteredAgents.map((agent) => (
      <AgentCard key={agent.id} agent={agent} />
    ));
  }, [filteredAgents, navigate]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Please sign in to view your agents.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Title and Create Button */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Discover custom agents designed for different uses</h1>
              <p className="text-muted-foreground mt-1">Enhance your productivity, streamline workflows, and get things done with AI agents</p>
            </div>
            <button
              onClick={() => navigate('/agents/new')}
              className="flex items-center px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors duration-200 font-medium shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Agent
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-2xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-200"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-1 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-border">
            {AGENT_CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  selectedCategory === category.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-xl mb-8 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => fetchAgents(true)}
              disabled={isRetrying || loading}
              className="flex items-center px-4 py-2 bg-destructive/20 hover:bg-destructive/30 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying...' : 'Try Again'}
            </button>
          </div>
        )}

        {/* Featured Section (when on 'all' or 'featured' category) */}
        {(selectedCategory === 'all' || selectedCategory === 'featured') && !loading && !error && (
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Featured</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAgents.filter(agent => agent.active).slice(0, 4).map((agent) => (
                <AgentCard key={`featured-${agent.id}`} agent={agent} />
              ))}
            </div>
          </div>
        )}

        {/* All Agents Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i} 
                className="bg-card border border-border rounded-2xl p-6 space-y-4 animate-pulse"
              >
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-muted rounded-xl"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-muted rounded w-3/4"></div>
                    <div className="h-4 bg-muted rounded w-full"></div>
                    <div className="h-4 bg-muted rounded w-2/3"></div>
                  </div>
                </div>
                <div className="h-10 bg-muted rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchQuery.trim() ? 'No agents found' : 'No agents yet'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery.trim() 
                ? `No agents match "${searchQuery}". Try a different search term.`
                : 'Create your first agent to get started with AI assistance.'
              }
            </p>
            <button
              onClick={() => navigate('/agents/new')}
              className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors duration-200 font-medium"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Agent
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">
                {selectedCategory === 'all' ? 'All Agents' : AGENT_CATEGORIES.find(c => c.id === selectedCategory)?.name}
                <span className="text-muted-foreground font-normal ml-2">({filteredAgents.length})</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {renderedAgents}
            </div>
          </div>
        )}
      </div>
    </div>

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