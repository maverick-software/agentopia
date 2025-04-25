import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { TeamMember, Agent } from '../types'; // Import necessary types
import { PostgrestError } from '@supabase/supabase-js';

// Type for the data returned by the fetch query
interface TeamMemberData extends Omit<TeamMember, 'agent'> {
  agents: Agent | null; // Supabase join returns related table in a nested object
}

// Type for updates, omitting keys managed by DB or joins
type TeamMemberUpdatePayload = Partial<Omit<TeamMember, 'team_id' | 'agent_id' | 'joined_at' | 'agent'>>;

interface UseTeamMembersReturn {
  members: TeamMember[];
  loading: boolean;
  error: PostgrestError | null;
  fetchTeamMembers: (teamId: string) => Promise<void>;
  addTeamMember: (teamId: string, agentId: string, team_role: string, team_role_description?: string) => Promise<TeamMember | null>;
  removeTeamMember: (teamId: string, agentId: string) => Promise<boolean>;
  updateTeamMember: (teamId: string, agentId: string, updates: TeamMemberUpdatePayload) => Promise<TeamMember | null>;
}

export function useTeamMembers(): UseTeamMembersReturn {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<PostgrestError | null>(null);

  // Helper to transform fetched data
  const transformMemberData = (data: TeamMemberData[] | null): TeamMember[] => {
    if (!data) return [];
    return data.map(item => ({
      ...item,
      agent: item.agents ?? {} as Agent, // Handle potential null agent join
    })).filter(item => item.agent.id); // Filter out any where agent join failed unexpectedly
  };

  // Fetch members for a specific team
  const fetchTeamMembers = useCallback(async (teamId: string) => {
    if (!teamId) {
        console.warn('fetchTeamMembers called without teamId');
        setMembers([]);
        return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('team_members')
        .select(`
          team_id,
          agent_id,
          team_role,
          team_role_description,
          reports_to_agent_id,
          reports_to_user,
          joined_at,
          agents (*) 
        `)
        .eq('team_id', teamId);

      if (fetchError) throw fetchError;
      setMembers(transformMemberData(data as TeamMemberData[]));
    } catch (err) {
      console.error(`Error fetching members for team ${teamId}:`, err);
      setError(err as PostgrestError);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Add a new member to a team
  const addTeamMember = useCallback(async (teamId: string, agentId: string, team_role: string, team_role_description?: string): Promise<TeamMember | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('team_members')
        .insert([{ team_id: teamId, agent_id: agentId, team_role, team_role_description }])
        // Fetch the newly inserted row with agent details
        .select(`..., agents (*)`) 
        .single();

      if (insertError) throw insertError;
      const newMember = transformMemberData([data as TeamMemberData])[0];
      // Update local state
      setMembers(currentMembers => [...currentMembers, newMember]);
      return newMember;
    } catch (err) {
      console.error(`Error adding agent ${agentId} to team ${teamId}:`, err);
      setError(err as PostgrestError);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Remove a member from a team
  const removeTeamMember = useCallback(async (teamId: string, agentId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('team_members')
        .delete()
        .match({ team_id: teamId, agent_id: agentId });

      if (deleteError) throw deleteError;
      // Update local state
      setMembers(currentMembers => currentMembers.filter(m => !(m.team_id === teamId && m.agent_id === agentId)));
      return true;
    } catch (err) {
      console.error(`Error removing agent ${agentId} from team ${teamId}:`, err);
      setError(err as PostgrestError);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update a team member's details (role, description, reporting)
  const updateTeamMember = useCallback(async (teamId: string, agentId: string, updates: TeamMemberUpdatePayload): Promise<TeamMember | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: updateError } = await supabase
        .from('team_members')
        .update(updates)
        .match({ team_id: teamId, agent_id: agentId })
        .select(`..., agents (*)`) 
        .single();

      if (updateError) throw updateError;
      const updatedMember = transformMemberData([data as TeamMemberData])[0];
      // Update local state
      setMembers(currentMembers => currentMembers.map(m => 
        (m.team_id === teamId && m.agent_id === agentId) ? updatedMember : m
      ));
      return updatedMember;
    } catch (err) {
      console.error(`Error updating agent ${agentId} in team ${teamId}:`, err);
      setError(err as PostgrestError);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    members,
    loading,
    error,
    fetchTeamMembers,
    addTeamMember,
    removeTeamMember,
    updateTeamMember,
  };
} 