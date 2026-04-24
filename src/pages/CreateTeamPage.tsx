import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTeams } from '../hooks/useTeams';
import { ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react';

export const CreateTeamPage: React.FC = () => {
  const navigate = useNavigate();
  const { createTeam, loading: saving, error: saveError } = useTeams();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError('Team name is required.');
      return;
    }

    try {
      const newTeam = await createTeam(name.trim(), description.trim());
      if (newTeam) {
        console.log(`Team created successfully: ${newTeam.id}`);
        navigate(`/teams/${newTeam.id}`); // Navigate to the new team's detail page
      } else {
        // Error handled by useTeams hook, display saveError
         console.error('Team creation failed, but no specific error from hook?');
      }
    } catch (err) {
      // Should be caught by the hook, but just in case
      console.error("Error during team creation submission:", err);
    }
  };

  // Input field styles (consistent with RegisterPage)
  const inputClasses = "appearance-none relative block w-full px-3 py-2 border border-gray-700 placeholder-gray-500 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";
  const labelClasses = "block text-sm font-medium text-gray-300 mb-1";

  return (
    <div className="p-4 sm:p-6 lg:p-8">
       <div className="flex items-center mb-6">
         <Link 
           to="/teams"
           className="mr-4 p-2 rounded-full hover:bg-gray-700 transition-colors"
         >
           <ArrowLeft className="w-5 h-5 text-gray-400" />
         </Link>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Create New Team</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-6">
        {(validationError || saveError) && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-md text-sm flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span>{validationError || saveError?.message || 'An unexpected error occurred.'}</span>
          </div>
        )}

        <div>
          <label htmlFor="team-name" className={labelClasses}>Team Name</label>
          <input
            id="team-name"
            name="name"
            type="text"
            required
            className={inputClasses}
            placeholder="Enter team name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
          />
        </div>

        <div>
           <label htmlFor="team-description" className={labelClasses}>Description (Optional)</label>
          <textarea
            id="team-description"
            name="description"
            rows={4}
            className={inputClasses}
            placeholder="Describe the team's purpose"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
           <Link
             to="/teams"
             className={`py-2 px-4 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
           >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className={`inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {saving ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Save className="mr-2 h-5 w-5"/>}
            {saving ? 'Creating...' : 'Create Team'}
          </button>
        </div>
      </form>
    </div>
  );
}; 