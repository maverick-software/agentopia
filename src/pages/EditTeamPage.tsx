import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTeams } from '../hooks/useTeams';
import { TeamUpdatePayload } from '../types';

export const EditTeamPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { fetchTeamById, updateTeam, team, loading, error } = useTeams();

  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (teamId) {
      fetchTeamById(teamId);
    }
  }, [teamId, fetchTeamById]);

  useEffect(() => {
    if (team) {
      setTeamName(team.name || '');
      setDescription(team.description || '');
    }
  }, [team]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teamId) return;

    const payload: TeamUpdatePayload = {
        id: teamId,
        name: teamName,
        description: description,
    };

    const success = await updateTeam(payload);
    if (success) {
        navigate(`/teams/${teamId}`);
    }
  };

  if (loading && !team) {
    return <div className="p-4 text-center text-gray-500 dark:text-gray-400">Loading team details...</div>;
  }

  if (error && !team) {
    return <div className="p-4 text-center text-red-500 dark:text-red-400">Error loading team details: {error}</div>;
  }

  if (!team) {
    return <div className="p-4 text-center text-gray-500 dark:text-gray-400">Team not found.</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center mb-6">
         <Link
           to={`/teams/${teamId}`}
           className="mr-4 p-2 rounded-full hover:bg-gray-700 transition-colors"
         >
           <ArrowLeft className="w-5 h-5 text-gray-400" />
         </Link>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Edit Team {teamName || teamId}</h1>
      </div>

      {error && (
         <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 rounded-md">
           Error updating team: {error}
         </div>
       )}

       <form onSubmit={handleSave} className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
         <div>
           <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
             Team Name
           </label>
           <div className="mt-1">
             <input
               type="text"
               name="teamName"
               id="teamName"
               value={teamName}
               onChange={(e) => setTeamName(e.target.value)}
               required
               className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
             />
           </div>
         </div>

         <div>
           <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
             Description
           </label>
           <div className="mt-1">
             <textarea
               id="description"
               name="description"
               rows={3}
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
             />
           </div>
           <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Brief description for your team.</p>
         </div>

         <div className="flex justify-end space-x-3">
            <Link
              to={`/teams/${teamId}`}
              className="inline-flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                Cancel
            </Link>
           <button
             type="submit"
             disabled={loading}
             className="inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
           >
             {loading ? 'Saving...' : 'Save Changes'}
           </button>
         </div>
       </form>
    </div>
  );
}; 