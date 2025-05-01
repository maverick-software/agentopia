import React from 'react';
import { User, Bot, Users } from 'lucide-react'; // Import icons

// Import the detailed type from the hook
import type { WorkspaceMemberDetail } from '@/hooks/useWorkspaceMembers';

// Define the shape of a member prop (using the imported type)
// interface Member { ... } // Remove the simplified interface

interface WorkspaceMemberSidebarProps {
  workspaceId: string;
  // Use the detailed type for members prop
  members: WorkspaceMemberDetail[]; 
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