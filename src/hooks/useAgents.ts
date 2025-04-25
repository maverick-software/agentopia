import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Agent } from '../types';
import { PostgrestError } from '@supabase/supabase-js';

interface AgentTeamDetails {
  team_id: string;
  team_name: string | null;
  team_role: string | null;
  reports_to_user: boolean | null;
  reports_to_agent_id: string | null;
}

interface UseAgentsReturn {
  agents: Agent[];
  loading: boolean;
  error: PostgrestError | null;
  fetchAllAgents: () => Promise<Agent[]>; // Returns the fetched agents
  
  // New state and function for specific agent team details
  teamDetails: AgentTeamDetails | null;
  teamDetailsLoading: boolean;
  teamDetailsError: PostgrestError | null;
  fetchAgentTeamDetails: (agentId: string) => Promise<void>;
}

export function useAgents(): UseAgentsReturn {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<PostgrestError | null>(null);
  
  // New state for team details
  const [teamDetails, setTeamDetails] = useState<AgentTeamDetails | null>(null);
  const [teamDetailsLoading, setTeamDetailsLoading] = useState<boolean>(false);
  const [teamDetailsError, setTeamDetailsError] = useState<PostgrestError | null>(null);

  const fetchAllAgents = useCallback(async (): Promise<Agent[]> => {
    if (!user) {
      console.warn('fetchAllAgents called but user is not logged in.');
      setAgents([]);
      return [];
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('agents')
        .select('id, name') // Only fetch necessary fields for selector
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;
      
      const fetchedAgents = data || [];
      setAgents(fetchedAgents); // Update state within the hook
      return fetchedAgents; // Return the fetched data
    } catch (err) {
      console.error('Error fetching all agents:', err);
      setError(err as PostgrestError);
      setAgents([]);
      return []; // Return empty array on error
    } finally {
      setLoading(false);
    }
  }, [user]);

  // New function to fetch team details for a specific agent
  const fetchAgentTeamDetails = useCallback(async (agentId: string): Promise<void> => {
    if (!agentId) {
        console.warn('fetchAgentTeamDetails called without agentId.');
        setTeamDetails(null);
        setTeamDetailsError(null);
        return;
    }
    
    console.log(`Fetching team details for agent: ${agentId}`); // Log start
    setTeamDetailsLoading(true);
    setTeamDetailsError(null);
    setTeamDetails(null); // Clear previous details

    try {
      // Fetch team membership details including team name
      const { data, error: fetchError } = await supabase
        .from('team_members')
        .select(`
          team_id,
          team_role,
          reports_to_user,
          reports_to_agent_id,
          teams ( name ) 
        `)
        .eq('agent_id', agentId)
        .maybeSingle(); // Expect 0 or 1 result

      if (fetchError) throw fetchError;

      if (data) {
          console.log('Fetched team details:', data); // Log successful fetch
          // Transform the data slightly to match AgentTeamDetails interface
          const details: AgentTeamDetails = {
              team_id: data.team_id,
              team_name: data.teams?.name || null, // Access nested team name
              team_role: data.team_role,
              reports_to_user: data.reports_to_user,
              reports_to_agent_id: data.reports_to_agent_id,
          };
          setTeamDetails(details);
      } else {
          console.log(`No team details found for agent: ${agentId}`); // Log if no details found
          setTeamDetails(null); // Agent might not be on a team
      }

    } catch (err) {
      console.error(`Error fetching team details for agent ${agentId}:`, err);
      setTeamDetailsError(err as PostgrestError);
      setTeamDetails(null);
    } finally {
      setTeamDetailsLoading(false);
      console.log(`Finished fetching team details for agent: ${agentId}`); // Log end
    }
  }, []); // No user dependency needed here, reads public/RLS-protected data

  // Optional: Fetch agents automatically when the hook is mounted?
  // Or rely on the component using the hook to call fetchAllAgents.
  // For a selector, usually fetching on demand or on component mount is preferred.

  return {
    agents, // Current state of agents fetched by this hook instance
    loading,
    error,
    fetchAllAgents,
    // Return new state and function
    teamDetails,
    teamDetailsLoading,
    teamDetailsError,
    fetchAgentTeamDetails,
  };
} 