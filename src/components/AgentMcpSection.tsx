import React, { useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { MCPServerConfig } from '../lib/mcp/types';
import { McpServerModal } from './McpServerModal'; // Assuming modal is extracted later

interface AgentMcpSectionProps {
  mcpServers: MCPServerConfig[];
  onAddServer: (configData: Partial<Omit<MCPServerConfig, 'id' | 'config_id'>>) => Promise<void>; // Simplified for now
  onUpdateServer: (serverId: number, configData: Partial<Omit<MCPServerConfig, 'id' | 'config_id'>>) => Promise<void>; // Simplified for now
  onDeleteServer: (serverId: number) => Promise<void>;
  onTestConnection: (serverConfig: Partial<MCPServerConfig>) => Promise<any>; // Type can be refined
  loading: boolean;
  error: string | null;
  // We might pass DEFAULT_NEW_SERVER_CONFIG as prop if needed in modal
}

export function AgentMcpSection({ 
  mcpServers, 
  onAddServer,
  onUpdateServer,
  onDeleteServer,
  onTestConnection,
  loading, 
  error 
}: AgentMcpSectionProps) {
  
  // State for managing the modal will live here for now
  const [showMcpModal, setShowMcpModal] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(null);

  const handleOpenMcpModal = (server: MCPServerConfig | null) => {
    setEditingServer(server); 
    setShowMcpModal(true);
  };

  const handleCloseMcpModal = () => {
    setShowMcpModal(false);
    setEditingServer(null); // Clear editing state on close
  };
  
  // Simplified save handler - calls appropriate prop function
  const handleSaveMcpServer = async (formData: Partial<MCPServerConfig>) => {
      if (editingServer?.id) {
          await onUpdateServer(editingServer.id, formData);
      } else {
          await onAddServer(formData);
      }
      handleCloseMcpModal(); // Close modal on successful save
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">MCP Connections / External Tools</h2>
      
      {/* Server List Table - Moved from AgentEdit.tsx */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-750">
            <tr>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Endpoint</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Priority</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Active</th>
              <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">
                  Loading MCP servers...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-sm text-red-400">
                  Error loading servers: {error}
                </td>
              </tr>
            )}
            {!loading && !error && mcpServers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">
                  No MCP servers configured.
                </td>
              </tr>
            )}
            {!loading && !error && mcpServers.map((server) => (
              <tr key={server.id} className="hover:bg-gray-750">
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-200">{server.name}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-400 truncate max-w-xs">{server.endpoint_url}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-400">{server.priority}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm">
                  {server.is_active ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">
                      Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900 text-red-300">
                      No
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button
                    type="button"
                    onClick={() => handleOpenMcpModal(server)}
                    className="text-indigo-400 hover:text-indigo-300"
                    title="Edit Server"
                  >
                    <Edit className="h-4 w-4 inline" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteServer(server.id)} // Direct call to prop
                    className="text-red-500 hover:text-red-400"
                    title="Delete Server"
                  >
                    <Trash2 className="h-4 w-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Add Server Button - Moved from AgentEdit.tsx */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => handleOpenMcpModal(null)} // Open modal for adding
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
          disabled={loading} // Disable button while loading
        >
          <Plus className="-ml-1 mr-2 h-4 w-4" aria-hidden="true" />
          Add MCP Server
        </button>
      </div>

      {/* Render Modal (Actual modal component will be created next) */}
      {showMcpModal && (
        <McpServerModal
           isOpen={showMcpModal}
           onClose={handleCloseMcpModal}
           onSave={handleSaveMcpServer}
           onTestConnection={onTestConnection}
           initialData={editingServer} // Pass the server being edited (or null for new)
           // We might need to pass DEFAULT_NEW_SERVER_CONFIG here too
        />
      )}
    </div>
  );
} 