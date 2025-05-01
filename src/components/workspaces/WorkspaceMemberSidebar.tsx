import React from 'react';

// Define the shape of a member prop (simplified from WorkspacePage for now)
// TODO: Refine this based on actual data structure needed (e.g., joined user/agent names)
interface Member {
  id: string;
  user_id?: string | null;
  agent_id?: string | null;
  team_id?: string | null; // Added team_id for completeness
  role?: string | null;
}

interface WorkspaceMemberSidebarProps {
  workspaceId: string;
  members: Member[];
}

const WorkspaceMemberSidebar: React.FC<WorkspaceMemberSidebarProps> = ({ workspaceId, members }) => {
  // State for the invite input (will be implemented later)
  const [inviteInput, setInviteInput] = React.useState('');

  const handleInvite = () => {
    // TODO: Implement invite logic using useWorkspaceMembers hook
    console.log(`Invite action for: ${inviteInput} in workspace ${workspaceId}`);
    setInviteInput('');
  };

  return (
    <div className="h-full flex flex-col bg-gray-700 rounded-lg p-3 text-white">
      <h3 className="text-lg font-semibold mb-4 border-b border-gray-600 pb-2">Members</h3>
      
      {/* Member List Area */}
      <div className="flex-1 overflow-y-auto mb-4 scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-700">
        {members.length === 0 ? (
          <p className="text-gray-400 text-sm">No members yet.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((member) => (
              <li key={member.id} className="text-sm p-1 rounded hover:bg-gray-600">
                {/* TODO: Display user/agent/team name instead of IDs */}
                {member.user_id && <span>User: {member.user_id.substring(0, 8)}...</span>}
                {member.agent_id && <span>Agent: {member.agent_id.substring(0, 8)}...</span>}
                {member.team_id && <span>Team: {member.team_id.substring(0, 8)}...</span>}
                <span className="text-xs text-gray-400 ml-2">({member.role || 'member'})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Invite Section */}
      <div className="mt-auto border-t border-gray-600 pt-3">
        <p className="text-xs text-gray-400 mb-1">Invite Agents or Teams</p>
        <div className="flex space-x-2">
          <input 
            type="text"
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value)}
            placeholder="@agent or @team name..."
            className="flex-1 px-2 py-1 text-sm bg-gray-600 border border-gray-500 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white"
          />
          <button 
            onClick={handleInvite}
            disabled={!inviteInput.trim()} // Disable if input is empty
            className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Invite
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceMemberSidebar; 