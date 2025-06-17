import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { MCPServerConfig } from '../lib/mcp/types';
import ToolboxModal from './ToolboxModal';
import { useAgentMcp } from '../hooks/useAgentMcp';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { ServerOff, PlusCircle } from 'lucide-react';

interface McpConfiguration { id: number; name: string; driver_type?: string; endpoint_url?: string; is_active?: boolean; }

interface AgentToolboxSectionProps {
  agentId: string;
}

const AgentToolboxSection: React.FC<AgentToolboxSectionProps> = ({ agentId }) => {
  const {
    mcpConfigurations,
    isLoading,
    error,
    addMcpConfiguration,
    updateMcpConfiguration,
    deleteMcpConfiguration,
  } = useAgentMcp(agentId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<McpConfiguration | null>(null);

  const handleOpenModal = (item: McpConfiguration | null) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSaveItem = async (formData: any) => {
    if (editingItem?.id) {
      console.warn('Update logic to be implemented for', editingItem, formData);
    } else {
      console.warn('Add logic to be implemented for', formData);
    }
    setIsModalOpen(false);
    setEditingItem(null);
  };

  if (isLoading) return <div className="p-4">Loading Toolboxes...</div>;
  if (error) return <div className="p-4 text-red-500">Error loading configurations: {error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Agent Toolboxes & Connected Tools</h2>
        <p className="text-sm text-muted-foreground">
          Manage Toolboxes and how this agent connects to and uses tools deployed on them.
        </p>
      </div>

      {mcpConfigurations && mcpConfigurations.length > 0 ? (
        <div className="space-y-4">
          {mcpConfigurations.map((config) => (
            <Card key={config.id}>
              <CardHeader>
                <CardTitle>Toolbox: {config.name}</CardTitle>
                <CardDescription>Status: {config.is_active ? 'Active' : 'Inactive'} (Will be more detailed)</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">Status: {config.is_active ? 'Active' : 'Inactive'} (Status will be more detailed)</p>
                <p className="text-sm truncate">Endpoint: {config.endpoint_url || 'N/A'} (Details will change)</p>
              </CardContent>
              <CardFooter className="flex justify-end space-x-2">
                <Button variant="outline" size="sm" onClick={() => handleOpenModal(config as McpConfiguration)}>
                  Edit Toolbox
                </Button>
                <Button variant="destructive" size="sm" onClick={() => console.warn('Delete for Toolbox to be implemented')}>
                  Delete Toolbox
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <ServerOff className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-lg font-medium">No Toolboxes Configured (Yet!)</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started by adding a Toolbox and deploying services to it.
          </p>
        </div>
      )}

      <Button onClick={() => handleOpenModal(null)}>
        <PlusCircle className="mr-2 h-4 w-4" /> Add New Toolbox / Connect to Service
      </Button>

      {isModalOpen && (
        <ToolboxModal 
          agentId={agentId} 
          isOpen={isModalOpen} 
          onClose={() => { setIsModalOpen(false); setEditingItem(null); }} 
          onSave={handleSaveItem} 
          initialData={editingItem}
        />
      )}
      <div className="mt-6 p-4 border rounded-lg bg-secondary/50">
        <h2 className="text-lg font-semibold">Developer Note (AgentToolboxSection.tsx)</h2>
        <p className="text-sm text-muted-foreground">
          This component requires a major refactor. It previously managed a list of 'MCP Servers' (now Toolboxes or Toolbelt Items).
          The new structure will likely involve:
          1. Displaying Toolboxes accessible by the agent.
          2. For a selected Toolbox, showing Deployed Services.
          3. For each Deployed Service, managing the agent's Toolbelt Item (credentials, permissions).
          The `useAgentMcp` hook and the `ToolboxModal` will also be heavily adapted or replaced.
          Current changes are primarily terminological placeholders.
        </p>
      </div>
    </div>
  );
};

export default AgentToolboxSection; 