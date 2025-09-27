import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Loader2, AlertCircle, Building2, UserCheck, Target, Workflow, Network, Grid } from 'lucide-react';
import { useTeams } from '../hooks/useTeams';
import { useAuth } from '../contexts/AuthContext';
import TeamCard from '../components/teams/TeamCard'; // Import the actual component
import { CreateTeamModal } from '../components/modals/CreateTeamModal';
import { VisualTeamCanvas } from '../components/teams/canvas/VisualTeamCanvas';
import type { Team } from '../types';
import type { ViewMode } from '../components/teams/canvas/types/canvas';

// Placeholder for TeamCard until it's created
const TeamCardPlaceholder: React.FC<{ team: Team }> = ({ team }) => (
  <div className="bg-card border border-border p-4 rounded-lg shadow animate-pulse">
    <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
    <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
    <div className="h-4 bg-muted rounded w-full"></div>
  </div>
);

// Assuming named export based on other pages
export const TeamsPage: React.FC = () => {
  const { teams, loading, error, fetchTeams } = useTeams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCanvasModal, setShowCanvasModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const handleTeamCreated = (teamId: string) => {
    // Refresh teams list
    fetchTeams();
    // Navigate to the new team's detail page
    navigate(`/teams/${teamId}`);
  };
  
  // Memoize teams to prevent unnecessary re-renders
  const memoizedTeams = useMemo(() => teams, [teams]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-semibold text-foreground">Teams</h1>
          
          {/* View Toggle - only show if we have teams */}
          {teams.length > 0 && (
            <div className="flex items-center border rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Grid className="h-4 w-4 mr-1" />
                Grid
              </button>
              <button
                onClick={() => setShowCanvasModal(true)}
                className={`flex items-center px-3 py-2 text-sm font-medium transition-colors border-l ${
                  showCanvasModal
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Network className="h-4 w-4 mr-1" />
                Canvas
              </button>
            </div>
          )}
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
          Create New Team
        </button>
      </div>

      {/* Teams Information Section */}
      <div className="bg-card border border-border rounded-lg p-6 mb-8">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground mb-2">Organize Your Agents Like Your Company</h2>
            <p className="text-muted-foreground mb-4">
              Teams in Gofr Agents mirror your organizational structure, allowing you to group agents based on departments, 
              projects, or functional areas. This alignment helps maintain clear responsibilities and streamlined workflows 
              that match how your company operates.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">Department Structure</h3>
                  <p className="text-xs text-muted-foreground">Group agents by HR, Marketing, Sales, Engineering, etc.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <Target className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">Project Focus</h3>
                  <p className="text-xs text-muted-foreground">Organize agents around specific projects or initiatives.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <Workflow className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">Clear Workflows</h3>
                  <p className="text-xs text-muted-foreground">Establish reporting structures and collaboration patterns.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
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
             <div key={i} className="bg-card border border-border p-4 rounded-lg shadow animate-pulse">
                <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
             </div>
          ))}
        </div>
      )}

      {!loading && !error && teams.length === 0 && (
        <div className="text-center py-12 px-4 border-2 border-dashed border-border rounded-lg">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-lg font-medium text-foreground">Ready to organize your agents?</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Create your first team to mirror your company's structure. Whether it's HR, Marketing, Engineering, 
              or project-based groups, teams help organize agents just like your organization.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Create Your First Team
              </button>
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

      <CreateTeamModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTeamCreated={handleTeamCreated}
      />
      
      {/* Visual Team Canvas Modal */}
      {user && showCanvasModal && (
        <VisualTeamCanvas
          isOpen={showCanvasModal}
          onClose={() => setShowCanvasModal(false)}
          teams={memoizedTeams}
          teamMembers={new Map()} // TODO: Implement team members fetching
          userId={user.id}
          workspaceId={undefined} // TODO: Implement workspace support
          onTeamCreate={() => {
            setShowCreateModal(true);
          }}
          onTeamUpdate={(teamId, updates) => {
            // TODO: Implement team update
            console.log('Update team:', teamId, updates);
          }}
          onTeamDelete={(teamId) => {
            // TODO: Implement team delete
            console.log('Delete team:', teamId);
          }}
          onLayoutSave={async (layout) => {
            // Layout persistence is handled by the canvas component
            console.log('Layout saved:', layout);
          }}
          onConnectionCreate={(connection) => {
            console.log('Connection created:', connection);
          }}
          onConnectionDelete={(connectionId) => {
            console.log('Connection deleted:', connectionId);
          }}
          showToolbar={true}
          defaultViewMode="canvas"
        />
      )}
    </div>
  );
}; 