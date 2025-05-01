import { useState, useCallback, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useAuth } from '../contexts/AuthContext';

// TODO: Define a more detailed Member type, potentially joining with user profiles/agent names
export interface WorkspaceMemberDetail {
  id: string; // workspace_member id
  workspace_id: string;
  user_id?: string | null;
  agent_id?: string | null;
  team_id?: string | null;
  role?: string | null;
  created_at?: string;
  // Joined data placeholders
  user_profile?: { full_name?: string | null; avatar_url?: string | null } | null;
  agent?: { name?: string | null } | null;
  team?: { name?: string | null } | null;
}

export const useWorkspaceMembers = (workspaceId: string | null) => {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const [members, setMembers] = useState<WorkspaceMemberDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!supabase || !workspaceId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    console.log(`[useWorkspaceMembers] Fetching members via RPC for workspace: ${workspaceId}`);
    try {
      // Call the RPC function instead of direct select
      const { data, error: rpcError } = await supabase
        .rpc('get_workspace_members_with_details', { 
          p_workspace_id: workspaceId 
        });

      // Old select query:
      // const { data, error: fetchError } = await supabase
      //   .from('workspace_members')
      //   .select(`
      //     id,
      //     role,
      //     created_at,
      //     workspace_id,
      //     user_id,
      //     agent_id,
      //     team_id,
      //     user_profiles:user_id!inner( full_name, avatar_url ),
      //     agents ( name ),
      //     teams ( name )
      //   `)
      //   .eq('workspace_id', workspaceId);

      if (rpcError) throw rpcError;

      console.log("[useWorkspaceMembers] Fetched members via RPC:", data);
      // The RPC function returns an array directly, matching our state type
      // No need to cast if the function return type matches WorkspaceMemberDetail structure
      setMembers(data || []);

    } catch (err: any) {
      console.error("[useWorkspaceMembers] Error fetching members via RPC:", err);
      setError(err.message || 'Failed to fetch members via RPC');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, workspaceId]);

  useEffect(() => {
    if (workspaceId && supabase) {
      fetchMembers();
    }
  }, [workspaceId, supabase, fetchMembers]);

  // --- Placeholder Mutation Functions --- 

  const addAgentMember = async (agentId: string, role: string = 'member'): Promise<boolean> => {
    console.log(`[useWorkspaceMembers] Placeholder: Add agent ${agentId} with role ${role} to ${workspaceId}`);
    // TODO: Implement Supabase insert into workspace_members
    // Remember to check permissions (e.g., using RLS or checking ownership/role here)
    setError('Add agent member not implemented.');
    return false;
  };
  
  const addTeamMember = async (teamId: string, role: string = 'member'): Promise<boolean> => {
    console.log(`[useWorkspaceMembers] Placeholder: Add team ${teamId} with role ${role} to ${workspaceId}`);
    // TODO: Implement Supabase insert into workspace_members
    setError('Add team member not implemented.');
    return false;
  };

  const addUserMember = async (inviteUserId: string, role: string = 'member'): Promise<boolean> => {
      console.log(`[useWorkspaceMembers] Placeholder: Add user ${inviteUserId} with role ${role} to ${workspaceId}`);
      // TODO: Implement Supabase insert into workspace_members
      setError('Add user member not implemented.');
      return false;
  };

  const removeMember = async (memberId: string): Promise<boolean> => {
    console.log(`[useWorkspaceMembers] Placeholder: Remove member ${memberId} from ${workspaceId}`);
    // TODO: Implement Supabase delete from workspace_members where id = memberId
    // Check permissions.
    setError('Remove member not implemented.');
    return false;
  };

  const updateMemberRole = async (memberId: string, newRole: string): Promise<boolean> => {
    console.log(`[useWorkspaceMembers] Placeholder: Update member ${memberId} to role ${newRole} in ${workspaceId}`);
    // TODO: Implement Supabase update on workspace_members
    // Check permissions.
    setError('Update member role not implemented.');
    return false;
  };

  // --- End Placeholder Functions --- 

  return {
    members,
    loading,
    error,
    fetchMembers,
    addAgentMember,
    addTeamMember,
    addUserMember,
    removeMember,
    updateMemberRole,
  };
}; 