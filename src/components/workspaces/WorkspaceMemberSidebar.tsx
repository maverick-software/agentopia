import React, { useState, useEffect } from 'react';
import { User, Bot, Users } from 'lucide-react'; // Import icons

// Import the detailed type from the hook
import type { WorkspaceMemberDetail } from '@/hooks/useWorkspaceMembers';
// Import the hook to get agent summaries
import { useAgents, type AgentSummary } from '@/hooks/useAgents';

// Define the shape of a member prop (using the imported type)
// interface Member { ... } // Remove the simplified interface

interface WorkspaceMemberSidebarProps {
  workspaceId: string;
  // Use the detailed type for members prop
  members: WorkspaceMemberDetail[]; 
  // Add the mutation function prop
  onAddAgent: (agentId: string, role?: string) => Promise<boolean>;
  // TODO: Add props for mutation loading/error state if needed for UI feedback
  // mutationLoading?: boolean;
  // mutationError?: string | null;
}

const WorkspaceMemberSidebar: React.FC<WorkspaceMemberSidebarProps> = ({ 
  workspaceId, 
  members, 
  onAddAgent, // Destructure the passed-in function
  // mutationLoading, // Destructure if passed
  // mutationError // Destructure if passed
}) => {
  // State for the invite input and agent selection
  const [inviteInput, setInviteInput] = useState('');
  const [suggestions, setSuggestions] = useState<AgentSummary[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentSummary | null>(null);
  // Local state for loading/error specific to *this component's* actions?
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Fetch available agents for suggestions
  // Correctly destructure agentSummaries and fetchAgentSummaries
  const { 
    agentSummaries, 
    fetchAgentSummaries, 
    loading: agentSummariesLoading, // Optional: Use loading state
    error: agentSummariesError // Optional: Use error state
  } = useAgents();

  // Fetch agents when the component mounts
  useEffect(() => {
    console.log("[WorkspaceMemberSidebar] Fetching agent summaries...");
    fetchAgentSummaries().then(() => {
        console.log("[WorkspaceMemberSidebar] Agent summaries fetched.");
        // Optionally log fetched data: console.log(agentSummaries);
    });
  }, [fetchAgentSummaries]);

  // Handle input changes for autocomplete
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInviteInput(value);
    setSelectedAgent(null); // Clear selection when input changes
    setInviteError(null); // Clear error on new input

    if (value.startsWith('@') && value.length > 1) {
      const searchTerm = value.substring(1).toLowerCase();
      // Filter using the correct agentSummaries array
      const filtered = agentSummaries.filter(agent => 
        agent.name?.toLowerCase().includes(searchTerm)
      );
      console.log(`[WorkspaceMemberSidebar] Filtering with term "${searchTerm}", Found:`, filtered);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0); // Only show if there are suggestions
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  // Handle selecting an agent from suggestions
  const handleSelectAgent = (agent: AgentSummary) => {
    setSelectedAgent(agent);
    setInviteInput(`@${agent.name || agent.id}`); // Display selected name
    setShowSuggestions(false);
    setSuggestions([]);
    setInviteError(null); // Clear error on selection
  };

  const handleInvite = async () => {
    if (!selectedAgent) {
      setInviteError("Please select an agent from the suggestions.");
      return; 
    }

    setIsInviting(true);
    setInviteError(null);
    console.log(`Attempting to add agent: ${selectedAgent.name} (ID: ${selectedAgent.id})`);
    // Call the passed-in function
    const success = await onAddAgent(selectedAgent.id);

    if (success) {
      console.log(`Invite successful for ${selectedAgent.name}`);
      setInviteInput(''); 
      setSelectedAgent(null); 
    } else {
      console.error(`Invite failed for ${selectedAgent.name}.`);
      // Use local error state, assuming parent might handle/log the actual error
      setInviteError("Failed to add agent. They might already be a member."); 
    }
    setIsInviting(false);
  };

  return (
    <div className="h-full flex flex-col bg-gray-700 rounded-lg p-3 text-white relative">
      <h3 className="text-lg font-semibold mb-4 border-b border-gray-600 pb-2">Members</h3>
      
      {/* Member List Area */}
      <div className="flex-1 overflow-y-auto mb-4 scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-700">
        {members.length === 0 ? (
          <p className="text-gray-400 text-sm">No members yet.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((member) => (
              // Use member.id (workspace_member UUID) as key
              <li key={member.id} className="flex items-center text-sm p-1 rounded hover:bg-gray-600">
                {/* Display Avatar/Icon based on member type */}
                {member.user_id && (
                  member.user_profile?.avatar_url ? (
                    <img src={member.user_profile.avatar_url} alt="User avatar" className="w-5 h-5 rounded-full mr-2" />
                  ) : (
                    <User className="w-4 h-4 mr-2 text-gray-400" />
                  )
                )}
                {member.agent_id && <Bot className="w-4 h-4 mr-2 text-blue-400" />}
                {member.team_id && <Users className="w-4 h-4 mr-2 text-green-400" />}
                
                {/* Display Name based on member type */}
                <span className="flex-1 truncate">
                  {member.user_id && (member.user_profile?.full_name || `User ${member.user_id.substring(0,6)}...`)}
                  {member.agent_id && (member.agent?.name || `Agent ${member.agent_id.substring(0,6)}...`)}
                  {member.team_id && (member.team?.name || `Team ${member.team_id.substring(0,6)}...`)}
                </span>
                
                {/* Display Role */}
                <span className="text-xs text-gray-400 ml-2">({member.role || 'member'})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Invite Section */}
      <div className="mt-auto border-t border-gray-600 pt-3">
        {/* Display local invite error */} 
        {inviteError && <p className="text-xs text-red-400 mb-1">Error: {inviteError}</p>}
        <p className="text-xs text-gray-400 mb-1">Invite Agents (use @)</p> 
        <div className="relative"> {/* Wrapper for positioning suggestions */}
          <div className="flex space-x-2">
            <input 
              type="text"
              value={inviteInput}
              onChange={handleInputChange} // Use new handler
              placeholder="@agent name..." // Updated placeholder
              className="flex-1 px-2 py-1 text-sm bg-gray-600 border border-gray-500 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white"
              disabled={isInviting} // Use local loading state
            />
            <button 
              onClick={handleInvite}
              // Disable if no agent is selected OR mutation is loading
              disabled={!selectedAgent || isInviting} 
              className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isInviting ? 'Inviting...' : 'Invite'} {/* Use local loading state */}
            </button>
          </div>
          {/* Suggestions Dropdown */} 
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute bottom-full left-0 right-0 mb-1 max-h-40 overflow-y-auto bg-gray-600 border border-gray-500 rounded shadow-lg z-10">
              {suggestions.map(agent => (
                <li 
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent)} // Select agent on click
                  className="px-3 py-1 text-sm hover:bg-indigo-500 cursor-pointer"
                >
                  {agent.name || `Agent ${agent.id.substring(0,6)}...`}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceMemberSidebar; 