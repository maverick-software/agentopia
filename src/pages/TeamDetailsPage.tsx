import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTeams } from '../hooks/useTeams';
import { ArrowLeft, Edit, Loader2, AlertCircle, Users, MessageSquare } from 'lucide-react';
import type { Team } from '../types';
import { TeamMemberList } from '../../components/teams/TeamMemberList';

// Placeholder components until created
// Placeholder for TeamMemberList removed

const ChatSessionListPlaceholder: React.FC<{ teamId: string }> = ({ teamId }) => (
   <div className="mt-6 p-4 border border-dashed border-gray-600 rounded-md">
    <h2 className="text-xl font-semibold mb-3 text-gray-300">Chat Sessions (Loading...)</h2>
    <div className="h-20 bg-gray-700 rounded animate-pulse"></div>
  </div>
);

export const TeamDetailsPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { fetchTeamById, loading, error } = useTeams();
  const [team, setTeam] = useState<Team | null>(null);

  useEffect(() => {
    if (teamId) {
      console.log(`[TeamDetailsPage] Fetching team details for ID: ${teamId}`);
      fetchTeamById(teamId).then(fetchedTeam => {
        if (fetchedTeam) {
            setTeam(fetchedTeam);
        } else {
            // Handle case where team is not found or error occurred during fetch
            // The useTeams hook should set the error state, which is displayed below
            console.log(`[TeamDetailsPage] Team not found or error fetching team ${teamId}`);
            setTeam(null); // Ensure team state is null if fetch fails
        }
      });
    } else {
        console.error("[TeamDetailsPage] teamId is missing from URL parameters.");
        // Optionally navigate away or show a specific error message
        navigate('/teams'); // Redirect back to teams list if ID is missing
    }
    // Depend on teamId, fetchTeamById
  }, [teamId, fetchTeamById, navigate]);

  if (loading && !team) {
    return (
      <div className="p-8 flex justify-center items-center">
        <Loader2 className="animate-spin h-8 w-8 text-indigo-500" />
      </div>
    );
  }

  if (error && !team) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md flex items-center">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          <span>Error loading team details: {error.message || 'Unknown error'}.</span>
           <Link to="/teams" className="ml-auto text-sm font-medium text-red-300 hover:text-red-100">Back to Teams</Link>
        </div>
      </div>
    );
  }

  if (!team) {
     // This state might be reached if fetchTeamById returns null without setting an error in the hook
    return (
        <div className="p-6 text-center text-gray-400">
            Team not found or could not be loaded.
             <Link to="/teams" className="block mt-4 text-indigo-400 hover:text-indigo-500">Back to Teams</Link>
        </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center mb-6">
        <Link 
            to="/teams"
            className="mr-4 p-2 rounded-full hover:bg-gray-700 transition-colors"
            title="Back to Teams List"
        >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white truncate" title={team.name}>
                {team.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate" title={team.description || ''}>
                {team.description || 'No description'}
            </p>
        </div>
        <Link
          to={`/teams/${team.id}/edit`}
          className="ml-4 inline-flex items-center px-3 py-1.5 border border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
        >
          <Edit className="-ml-1 mr-2 h-4 w-4" aria-hidden="true" />
          Edit Team
        </Link>
      </div>

      {/* Render the actual TeamMemberList component */}
      <TeamMemberList teamId={team.id} />
      
      {/* Placeholder for chat sessions */}
      <ChatSessionListPlaceholder teamId={team.id} />
      
    </div>
  );
}; 