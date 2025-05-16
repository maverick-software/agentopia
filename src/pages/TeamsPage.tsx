import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Loader2, AlertCircle } from 'lucide-react';
import { useTeams } from '../hooks/useTeams';
import TeamCard from '../components/teams/TeamCard'; // Import the actual component
import type { Team } from '../types';

// Placeholder for TeamCard until it's created
const TeamCardPlaceholder: React.FC<{ team: Team }> = ({ team }) => (
  <div className="bg-gray-800 p-4 rounded-lg shadow animate-pulse">
    <div className="h-6 bg-gray-700 rounded w-3/4 mb-2"></div>
    <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div>
    <div className="h-4 bg-gray-700 rounded w-full"></div>
  </div>
);

// Assuming named export based on other pages
export const TeamsPage: React.FC = () => {
  const { teams, loading, error, fetchTeams } = useTeams();

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Teams</h1>
        <Link
          to="/teams/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
          Create New Team
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md mb-6 flex items-center">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          <span>Error loading teams: {error.message || 'Unknown error'}</span>
        </div>
      )}

      {loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
             <div key={i} className="bg-gray-800 p-4 rounded-lg shadow animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div>
                <div className="h-4 bg-gray-700 rounded w-full"></div>
             </div>
          ))}
        </div>
      )}

      {!loading && !error && teams.length === 0 && (
        <div className="text-center py-12 px-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
            <Users className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No teams yet</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new team.</p>
            <div className="mt-6">
              <Link
                to="/teams/new"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Create New Team
              </Link>
            </div>
        </div>
      )}

      {!loading && !error && teams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            // Use the actual TeamCard component
            <TeamCard key={team.id} team={team} /> 
          ))}
        </div>
      )}
    </div>
  );
}; 