import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, isSupabaseConnected } from '../../lib/supabase';
import type { Agent } from '../../types';
import { CreateAgentWizard } from '../../components/CreateAgentWizard';
import { useTeamsWithAgentCounts } from '../../hooks/useTeamsWithAgentCounts';
import { CreateTeamModal } from '../../components/modals/CreateTeamModal';
import { MobileHeader } from '../../components/mobile/MobileHeader';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { AgentCard } from './AgentCard';
import { TeamFilterDropdown } from './TeamFilterDropdown';
import { buildHierarchicalTeams, filterAgents } from './helpers';

export function AgentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const totalFetchAttempts = useRef(0);
  const MAX_TOTAL_FETCH_ATTEMPTS = 5;
  const isMobile = useIsMobile();

  const { teams, refetch: refetchTeams } = useTeamsWithAgentCounts();

  const hierarchicalTeams = useMemo(() => buildHierarchicalTeams(teams as any), [teams]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (showTeamDropdown) {
        setShowTeamDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showTeamDropdown]);

  const fetchAgents = useCallback(
    async (isInitialCall = true) => {
      if (!user) return;

      let currentAttempt = totalFetchAttempts.current + 1;
      if (isInitialCall) {
        currentAttempt = 1;
        totalFetchAttempts.current = 0;
      }
      totalFetchAttempts.current = currentAttempt;

      if (currentAttempt > MAX_TOTAL_FETCH_ATTEMPTS) {
        setError(`Failed to load agents after ${MAX_TOTAL_FETCH_ATTEMPTS} attempts.`);
        setLoading(false);
        setIsRetrying(false);
        return;
      }

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

        if (data && data.length > 0) {
          const agentIds = data.map((agent) => agent.id);
          const { data: teamMemberships } = await supabase
            .from('team_members')
            .select(
              `
              agent_id,
              team_id,
              teams(
                id,
                name
              )
            `,
            )
            .in('agent_id', agentIds);

          const agentsWithTeams = data.map((agent) => ({
            ...agent,
            team_members: teamMemberships?.filter((tm) => tm.agent_id === agent.id) || [],
          }));

          setAgents(agentsWithTeams as Agent[]);
        } else {
          setAgents((data || []) as Agent[]);
        }

        setLoading(false);
        setIsRetrying(false);
        if (isInitialCall) totalFetchAttempts.current = 0;
      } catch (err: any) {
        if (currentAttempt < MAX_TOTAL_FETCH_ATTEMPTS) {
          const delay = 2000;
          setTimeout(() => fetchAgents(false), delay);
          const message = err instanceof Error ? err.message : 'An unknown error occurred';
          setError(
            `Failed to load agents. Retrying... (${currentAttempt}/${MAX_TOTAL_FETCH_ATTEMPTS}): ${message}`,
          );
        } else {
          const message = err instanceof Error ? err.message : 'An unknown error occurred';
          setError(`Failed to load agents after ${MAX_TOTAL_FETCH_ATTEMPTS} attempts: ${message}`);
          setLoading(false);
          setIsRetrying(false);
        }
      }
    },
    [user],
  );

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

  useEffect(() => {
    if (agents.length > 0 && loading) {
      setLoading(false);
    }
  }, [agents.length, loading]);

  const handleDeleteAgent = useCallback(
    async (id: string) => {
      if (!id || isDeleting) return;

      try {
        setIsDeleting(true);
        const { error: deleteError } = await supabase
          .from('agents')
          .delete()
          .eq('id', id)
          .eq('user_id', user?.id);

        if (deleteError) throw deleteError;
        setAgents((prev) => prev.filter((agent) => agent.id !== id));
        setShowDeleteConfirm(null);
        setError(null);
      } catch {
        setError('Failed to delete agent. Please try again.');
      } finally {
        setIsDeleting(false);
      }
    },
    [user?.id, isDeleting],
  );

  const filteredAgents = useMemo(
    () => filterAgents(agents, searchQuery, selectedTeam),
    [agents, searchQuery, selectedTeam],
  );

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Please sign in to view your agents.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {isMobile && (
        <MobileHeader
          agentName="My Agents"
          agentCount={filteredAgents.length}
          showMenu={true}
          onAgentClick={() => {}}
          actions={
            <button
              onClick={() => setShowCreateModal(true)}
              className="touch-target p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="Create agent"
            >
              <Plus className="w-5 h-5" />
            </button>
          }
        />
      )}

      {!isMobile && (
        <div className="border-b border-border/50 bg-background/95 backdrop-blur-sm sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-8">
                <h1 className="text-2xl font-bold text-foreground mb-2">Meet Your AI Team</h1>
                <p className="text-muted-foreground">
                  Manage and organize your AI agents by teams
                </p>
              </div>

              <div className="flex items-center space-x-3 flex-shrink-0">
                <TeamFilterDropdown
                  selectedTeam={selectedTeam}
                  teams={teams as any}
                  hierarchicalTeams={hierarchicalTeams}
                  showTeamDropdown={showTeamDropdown}
                  setShowTeamDropdown={setShowTeamDropdown}
                  setSelectedTeam={setSelectedTeam}
                />

                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Agent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-7xl mx-auto ${isMobile ? 'px-4 py-4' : 'px-6 py-6'}`}>
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

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-16 h-16 bg-muted rounded-xl" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} mb-6`}>
              <h2 className={`${isMobile ? 'text-xl mb-3' : 'text-2xl'} font-semibold text-foreground`}>
                {selectedTeam === 'all'
                  ? 'All Agents'
                  : teams.find((team) => team.id === selectedTeam)?.name || 'Team Agents'}
                <span className="text-muted-foreground font-normal ml-3 text-lg">
                  ({filteredAgents.length})
                </span>
              </h2>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all duration-200"
                />
              </div>
            </div>

            {filteredAgents.length === 0 ? (
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
                    : 'Create your first agent to get started with AI assistance.'}
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors duration-200 font-medium"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Agent
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                {filteredAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onClick={(agentId) => navigate(`/agents/${agentId}/chat`)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-semibold mb-3 text-foreground">Delete Agent</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Are you sure you want to delete this agent? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all duration-200"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAgent(showDeleteConfirm)}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateAgentWizard open={showCreateModal} onOpenChange={setShowCreateModal} />

      <CreateTeamModal
        isOpen={showCreateTeamModal}
        onClose={() => setShowCreateTeamModal(false)}
        onTeamCreated={async () => {
          setShowCreateTeamModal(false);
          await refetchTeams();
        }}
      />
    </div>
  );
}
