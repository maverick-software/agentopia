import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { Workspace } from '@/pages/WorkspacesListPage'; // Assuming type is exported there or define locally

interface WorkspaceCardProps {
  workspace: Workspace;
  index: number; // For animation delay
}

const WorkspaceCard: React.FC<WorkspaceCardProps> = ({ workspace, index }) => {
  return (
    <div
      className="bg-gray-800 rounded-lg p-6 space-y-4 opacity-0 animate-fade-in"
      style={{
        animationDelay: `${index * 100}ms`,
        animationFillMode: 'forwards'
      }}
    >
      <h3 className="text-xl font-semibold mb-2 truncate" title={workspace.name}>
        {workspace.name}
      </h3>
      
      <div>
        <p className="text-sm text-gray-400 mb-4">
          Created: {new Date(workspace.created_at).toLocaleDateString()}
        </p>
        <Button variant="outline" asChild>
          <Link to={`/workspaces/${workspace.id}`}>Open Workspace</Link>
        </Button>
      </div>
    </div>
  );
};

export default WorkspaceCard; 