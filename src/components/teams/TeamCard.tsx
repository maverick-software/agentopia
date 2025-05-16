import React from 'react';
import { Link } from 'react-router-dom';
import type { Team } from '../../types'; // Adjust path as necessary
import { Users } from 'lucide-react'; // Or another relevant icon

interface TeamCardProps {
  team: Team;
}

const TeamCard: React.FC<TeamCardProps> = ({ team }) => {
  return (
    <Link 
      to={`/teams/${team.id}`}
      className="block bg-gray-800 hover:bg-gray-700 rounded-lg p-4 shadow transition-colors duration-200"
    >
      <div className="flex items-start space-x-3">
        <div className="bg-indigo-500 p-2 rounded-lg">
            <Users className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
            <h3 className="text-lg font-semibold text-white truncate" title={team.name}>
              {team.name}
            </h3>
            <p className="text-sm text-gray-400 mt-1 line-clamp-2" title={team.description || ''}>
              {team.description || 'No description available.'}
            </p>
        </div>
      </div>
      {/* Optional: Add more details like member count later */}
    </Link>
  );
};

export default TeamCard; 