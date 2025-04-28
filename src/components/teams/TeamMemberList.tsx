import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import { AgentSelector } from '../shared/AgentSelector';
import { Loader2, AlertCircle, Plus, Trash2, Users, Check, X, User } from 'lucide-react';
import type { TeamMember } from '../../types';

// Define standard roles (consider moving to a shared constants file later)
const STANDARD_ROLES = [
  { id: 'member', name: 'Member' },
  { id: 'project_manager', name: 'Project Manager' },
  { id: 'user_liaison', name: 'User Liaison' },
  { id: 'qa', name: 'QA' },
];

interface TeamMemberListProps {
  teamId: string;
}

// Constant for the 'User' option value
const REPORTS_TO_USER_VALUE = '__USER__';

export const TeamMemberList: React.FC<TeamMemberListProps> = ({ teamId }) => {
  const {
    members,
    loading,
    error,
    fetchTeamMembers,
    addTeamMember,
    removeTeamMember,
    updateTeamMember,
  } = useTeamMembers();

  const [selectedAgentToAdd, setSelectedAgentToAdd] = useState<string>('');
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState<string>(STANDARD_ROLES[0]?.id || '');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // State for managing member removal
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // State for role updates
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [updateRoleError, setUpdateRoleError] = useState<string | null>(null);

  // State for reports to updates
  const [updatingReportsToId, setUpdatingReportsToId] = useState<string | null>(null);
  const [updateReportsToError, setUpdateReportsToError] = useState<string | null>(null);

  // Fetch members when component mounts or teamId changes
  useEffect(() => {
    if (teamId) {
      fetchTeamMembers(teamId);
    }
  }, [teamId, fetchTeamMembers]);

  const currentMemberAgentIds = useMemo(() => members.map(m => m.agent_id), [members]);
  const memberReportingToUser = useMemo(() => members.find(m => m.reports_to_user), [members]);

  const handleAddMember = useCallback(async () => {
    if (!selectedAgentToAdd || !selectedRoleToAdd || !teamId) {
      setAddError('Please select an agent and a role.');
      return;
    }
    // Safeguard: Check if agent is already a member (should be handled by AgentSelector, but belt-and-suspenders)
    if (currentMemberAgentIds.includes(selectedAgentToAdd)) {
      setAddError('This agent is already a member of the team.');
      return; 
    }
    setIsAdding(true);
    setAddError(null);
    try {
      const newMember = await addTeamMember(teamId, selectedAgentToAdd, selectedRoleToAdd);
      if (newMember) {
        setSelectedAgentToAdd(''); // Reset selector
        // Explicitly refresh the member list after successful add
        await fetchTeamMembers(teamId); 
      } else {
        // Error should be reflected in the main 'error' state from the hook
        // Use the error state from the hook if it exists
        setAddError(error?.message || 'Failed to add team member. Check console.');
      }
    } catch (err: any) {
      console.error("Error adding member:", err);
      setAddError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsAdding(false);
    }
  }, [teamId, selectedAgentToAdd, selectedRoleToAdd, addTeamMember, currentMemberAgentIds, fetchTeamMembers, error]);

  // Remove member handler
  const handleRemoveMember = useCallback(async (agentId: string) => {
    setRemovingMemberId(agentId);
    setRemoveError(null);
    try {
      const success = await removeTeamMember(teamId, agentId);
      if (!success) {
        setRemoveError('Failed to remove member. Check console or main error message.');
      }
      // State is updated optimistically by the hook
      setConfirmRemoveId(null); // Hide confirmation on success/failure
    } catch (err: any) {
      console.error("Error removing member:", err);
      setRemoveError(err.message || 'An unexpected error occurred.');
    } finally {
      setRemovingMemberId(null);
    }
  }, [teamId, removeTeamMember]);

  // Role Update Handler
  const handleRoleUpdate = useCallback(async (agentId: string, newRole: string) => {
      if (!agentId || !newRole) return;
      setUpdatingRoleId(agentId);
      setUpdateRoleError(null);
      console.log(`Updating role for agent ${agentId} to ${newRole}`);
      try {
          const updatedMember = await updateTeamMember(teamId, agentId, { team_role: newRole });
          if (!updatedMember) {
              setUpdateRoleError('Failed to update role. Check logs.');
          }
          // State updates optimistically via the hook
      } catch(err: any) {
          console.error("Error updating role:", err);
          setUpdateRoleError(err.message || 'Failed to update role.');
      } finally {
          setUpdatingRoleId(null);
      }
  }, [teamId, updateTeamMember]);

  // Reports To Update Handler
  const handleReportsToUpdate = useCallback(async (agentId: string, reportsToValue: string) => {
      if (!agentId || !reportsToValue) return;
      setUpdatingReportsToId(agentId);
      setUpdateReportsToError(null);
      console.log(`Updating reports_to for agent ${agentId} to ${reportsToValue}`);
      
      let updateData: Partial<TeamMember> = {};
      if (reportsToValue === REPORTS_TO_USER_VALUE) {
          // Check if someone else already reports to user
          if (memberReportingToUser && memberReportingToUser.agent_id !== agentId) {
              setUpdateReportsToError(`Only one member can report to the User. (${memberReportingToUser.agent?.name || memberReportingToUser.agent_id} currently does).`);
              setUpdatingReportsToId(null);
              return; // Prevent update
          }
          updateData = { reports_to_user: true, reports_to_agent_id: null };
      } else {
          updateData = { reports_to_agent_id: reportsToValue, reports_to_user: false };
      }

      try {
          const updatedMember = await updateTeamMember(teamId, agentId, updateData);
          if (!updatedMember) {
              setUpdateReportsToError('Failed to update reports to. Check logs.');
          }
      } catch(err: any) {
          console.error("Error updating reports to:", err);
          setUpdateReportsToError(err.message || 'Failed to update reports to.');
      } finally {
          setUpdatingReportsToId(null);
      }
  }, [teamId, updateTeamMember, memberReportingToUser]);

  // Helper to get display name for reports_to
  const getReportsToDisplayName = useCallback((member: TeamMember): string => {
    if (member.reports_to_user) {
      return 'User';
    }
    if (member.reports_to_agent_id) {
      const reportingAgent = members.find(m => m.agent_id === member.reports_to_agent_id);
      return reportingAgent?.agent?.name || member.reports_to_agent_id.substring(0, 8) + '...' || 'Unknown Agent';
    }
    return 'N/A'; // Should ideally report to someone
  }, [members]);

  // --- UI Rendering --- 

  const inputClasses = "block w-full px-3 py-2 border border-gray-700 placeholder-gray-500 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed";
  const labelClasses = "block text-sm font-medium text-gray-300 mb-1";
  const buttonClasses = "inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const dangerButtonClasses = "inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const secondaryButtonClasses = "inline-flex items-center justify-center px-3 py-1.5 border border-gray-600 text-xs font-medium rounded shadow-sm text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const selectClasses = "block w-full pl-3 pr-8 py-1 border border-gray-700 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"; // Combined select style

  return (
    <div className="mt-8 p-6 bg-gray-850 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4 text-white">Team Members</h2>

      {/* --- Add Member Section --- */} 
      <div className="mb-6 p-4 border border-gray-700 rounded-md space-y-3">
          <h3 className="text-lg font-medium text-gray-200 mb-2">Add New Member</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <AgentSelector 
                label="Select Agent to Add" 
                onSelectAgent={setSelectedAgentToAdd} 
                excludeAgentIds={currentMemberAgentIds} 
                initialSelectedAgentId={selectedAgentToAdd}
                disabled={isAdding}
            />
            <div>
                <label htmlFor="role-selector" className={labelClasses}>Assign Role</label>
                <select 
                    id="role-selector"
                    value={selectedRoleToAdd}
                    onChange={(e) => setSelectedRoleToAdd(e.target.value)}
                    className={inputClasses}
                    disabled={isAdding}
                >
                    {STANDARD_ROLES.map(role => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                </select>
            </div>
            <button 
                onClick={handleAddMember}
                disabled={!selectedAgentToAdd || !selectedRoleToAdd || isAdding}
                className={`${buttonClasses} md:self-end`}
            >
                {isAdding ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Plus className="mr-2 h-4 w-4" />}
                {isAdding ? 'Adding...' : 'Add Member'}
            </button>
          </div>
          {addError && <p className="mt-2 text-xs text-red-400">{addError}</p>}
      </div>
      
      {/* --- Member List Section --- */} 
      {loading && (
        <div className="flex justify-center items-center p-4"><Loader2 className="animate-spin h-6 w-6 text-indigo-400" /></div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-md text-sm flex items-center"><AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" /> Error loading members: {error.message}</div>
      )}
      {!loading && !error && members.length === 0 && (
          <div className="text-center py-6 px-4 border border-dashed border-gray-700 rounded-lg"><Users className="mx-auto h-8 w-8 text-gray-500" /><p className="mt-2 text-sm text-gray-400">This team has no members yet.</p></div>
      )}

      {/* Enhanced Member List */} 
      {!loading && !error && members.length > 0 && (
          <div className="overflow-x-auto">
              {/* Log the members array right before rendering the table */} 
              {(() => { console.log('[TeamMemberList] Rendering list with members:', members); return null; })()}
              <table className="min-w-full divide-y divide-gray-700">
                  <thead>
                      <tr>
                          <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-300 sm:pl-0">Agent</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Role</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Reports To</th>
                          <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0">
                              <span className="sr-only">Actions</span>
                          </th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                      {members.map(member => {
                          // Determine current reports_to value for the select input
                          const currentReportsToValue = member.reports_to_user 
                                ? REPORTS_TO_USER_VALUE 
                                : member.reports_to_agent_id || '';
                          
                          // Disable "User" option if another member already reports to user
                          const isUserOptionDisabled = !!memberReportingToUser && memberReportingToUser.agent_id !== member.agent_id;
                          
                          return (
                              <tr key={member.agent_id}>
                                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-0">{member.agent?.name || member.agent_id}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-400">
                                    <div className="relative">
                                      <select 
                                          value={member.team_role || ''}
                                          onChange={(e) => handleRoleUpdate(member.agent_id, e.target.value)}
                                          disabled={updatingRoleId === member.agent_id || removingMemberId === member.agent_id || updatingReportsToId === member.agent_id}
                                          className={selectClasses} 
                                          title={`Current role: ${member.team_role || 'None'}`}
                                      >
                                          <option value="" disabled>Select Role</option>
                                          {STANDARD_ROLES.map(role => (
                                              <option key={role.id} value={role.id}>{role.name}</option>
                                          ))}
                                      </select>
                                      {updatingRoleId === member.agent_id && (
                                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><Loader2 className="h-4 w-4 text-indigo-400 animate-spin" /></div>
                                      )}
                                    </div>
                                    {updateRoleError && updatingRoleId === member.agent_id && <p className="mt-1 text-xs text-red-400">{updateRoleError}</p>} 
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-400">
                                    <div className="relative">
                                      <select
                                        value={currentReportsToValue}
                                        onChange={(e) => handleReportsToUpdate(member.agent_id, e.target.value)}
                                        disabled={updatingReportsToId === member.agent_id || removingMemberId === member.agent_id || updatingRoleId === member.agent_id}
                                        className={selectClasses}
                                        title={`Currently reports to: ${getReportsToDisplayName(member)}`}
                                      >
                                        <option value="" disabled>Select who this agent reports to</option>
                                        {/* User Option */} 
                                        <option 
                                            value={REPORTS_TO_USER_VALUE} 
                                            disabled={isUserOptionDisabled}
                                            title={isUserOptionDisabled ? `Disabled: ${memberReportingToUser?.agent?.name} already reports to User` : 'Report directly to the User'}
                                        >
                                            User
                                        </option>
                                        {/* Other Agent Options */} 
                                        {members
                                          .filter(otherMember => otherMember.agent_id !== member.agent_id) // Exclude self
                                          .map(otherMember => (
                                            <option key={otherMember.agent_id} value={otherMember.agent_id}>
                                              {otherMember.agent?.name || otherMember.agent_id}
                                            </option>
                                          ))}
                                      </select>
                                      {updatingReportsToId === member.agent_id && (
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><Loader2 className="h-4 w-4 text-indigo-400 animate-spin" /></div>
                                      )}
                                    </div>
                                    {updateReportsToError && updatingReportsToId === member.agent_id && <p className="mt-1 text-xs text-red-400">{updateReportsToError}</p>}
                                  </td>
                                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                                      <div className="flex items-center justify-end space-x-2">
                                          {/* Remove Button & Confirmation (disable during any update) */} 
                                          {confirmRemoveId !== member.agent_id ? (
                                              <button 
                                                onClick={() => setConfirmRemoveId(member.agent_id)}
                                                disabled={removingMemberId === member.agent_id || updatingRoleId === member.agent_id || updatingReportsToId === member.agent_id}
                                                className={dangerButtonClasses.replace('px-3 py-1.5 text-xs', 'p-1.5')}
                                                title="Remove Member"
                                              >
                                                  <Trash2 className="h-4 w-4" />
                                              </button>
                                          ) : (
                                              <div className="flex items-center space-x-1.5">
                                                  <span className="text-xs text-yellow-400 mr-1">Confirm?</span>
                                                  <button 
                                                    onClick={() => handleRemoveMember(member.agent_id)}
                                                    disabled={removingMemberId === member.agent_id}
                                                    className={dangerButtonClasses.replace('text-xs', 'p-1')}
                                                    title="Confirm Remove"
                                                  >
                                                    {removingMemberId === member.agent_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                  </button>
                                                  <button 
                                                    onClick={() => setConfirmRemoveId(null)} 
                                                    disabled={removingMemberId === member.agent_id}
                                                    className={secondaryButtonClasses.replace('text-xs', 'p-1')}
                                                    title="Cancel Remove"
                                                  >
                                                      <X className="h-4 w-4" />
                                                  </button>
                                              </div>
                                          )}
                                      </div>
                                      {removeError && confirmRemoveId === member.agent_id && <p className="mt-1 text-xs text-red-400 text-right">{removeError}</p>}
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      )}
    </div>
  );
}; 