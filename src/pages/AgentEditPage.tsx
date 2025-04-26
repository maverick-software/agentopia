import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Database, Check } from 'lucide-react'; // Use icons from AgentEdit
import MonacoEditor from 'react-monaco-editor';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Agent, Datastore, AgentDiscordConnection } from '../types'; // Import Agent and Datastore types
import { DiscordConnect } from '../components/DiscordConnect'; // Import DiscordConnect
import { SubtleStatusToggle } from '../components/DiscordConnect'; // Import the new toggle
import { useAgentDiscordConnection } from '../hooks/useAgentDiscordConnection'; // Import the new hook

// Removed conflicting local Agent interface

// Define personality templates (copied from AgentEdit)
const personalityTemplates = [
  { id: 'disc-d', name: 'DISC - Dominant', description: 'Direct, results-oriented, strong-willed' },
  { id: 'disc-i', name: 'DISC - Influential', description: 'Outgoing, enthusiastic, optimistic' },
  { id: 'disc-s', name: 'DISC - Steady', description: 'Patient, stable, consistent' },
  { id: 'disc-c', name: 'DISC - Conscientious', description: 'Accurate, analytical, systematic' },
  { id: 'mbti-intj', name: 'MBTI - INTJ', description: 'Architect - Imaginative and strategic thinkers' },
  { id: 'mbti-enfp', name: 'MBTI - ENFP', description: 'Campaigner - Enthusiastic, creative, sociable' },
  { id: 'custom', name: 'Custom Template', description: 'Create your own personality template' },
];

export function AgentEditPage() { // Keep existing export name
  const { user } = useAuth();
  const navigate = useNavigate();
  const { agentId } = useParams<{ agentId: string }>(); // Renamed id to agentId for clarity
  const isEditing = Boolean(agentId);

  // Discord Connection Hook
  const {
    connection: discordConnectionData, // Renamed to avoid conflict with DB connection variable naming conventions
    hasCredentials, // Added
    workerStatus,
    allGuilds,
    isActivating,
    isDeactivating,
    isGeneratingInvite,
    loading: discordLoading,
    error: discordError,
    // fetchConnectionDetails, // Called automatically by the hook
    updateConnectionField,
    activate,
    deactivate,
    generateInviteLink,
  } = useAgentDiscordConnection(agentId);

  // Calculate canActivate here based on hook state for the toggle
  const canActivateToggle = hasCredentials && !!discordConnectionData?.guild_id;

  // State from AgentEdit
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Agent>>({
    name: '',
    description: '',
    personality: '',
    discord_channel: '',
    discord_bot_key: '',
    system_instructions: '',
    assistant_instructions: '',
    active: true
  });

  // Datastore state from AgentEdit
  const [showDatastoreModal, setShowDatastoreModal] = useState(false);
  const [datastores, setDatastores] = useState<Datastore[]>([]);
  const [selectedDatastores, setSelectedDatastores] = useState<{
    vector?: string;
    knowledge?: string;
  }>({});
  const [loadingDatastores, setLoadingDatastores] = useState(false);
  const [connectingDatastores, setConnectingDatastores] = useState(false);

  // Reset success message effect (from AgentEdit)
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (saveSuccess) {
      timeout = setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    }
    return () => clearTimeout(timeout);
  }, [saveSuccess]);

  // Fetch datastores function (from AgentEdit)
  const fetchDatastores = async () => {
    if (!user?.id) return; // Added user check
    try {
      setLoadingDatastores(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('datastores')
        .select('*')
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;

      setDatastores(data || []);
    } catch (err: any) { // Added type any
      console.error('Error fetching datastores:', err);
      setError('Failed to load datastores. Please try again.');
    } finally {
      setLoadingDatastores(false);
    }
  };

  // Fetch agent function (from AgentEdit)
  const fetchAgent = async (currentAgentId: string) => {
    if (!user?.id) return; // Added user check
    try {
      setLoading(true);
      setError(null);

      // First fetch the agent data
      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', currentAgentId)
        .eq('user_id', user.id)
        .single();

      if (agentError) throw new Error(agentError.message);
      if (!agentData) throw new Error('Agent not found');

      setFormData(agentData);

      // Then fetch the associated datastores
      const { data: connections, error: connectionsError } = await supabase
        .from('agent_datastores')
        .select(`
          datastore_id,
          datastores:datastore_id (
            id,
            type
          )
        `)
        .eq('agent_id', currentAgentId);

      if (connectionsError) throw new Error(connectionsError.message);

      if (connections) {
        // Corrected linter error: Check datastores object exists AND has 'type' property before accessing
        const vectorStore = connections.find(c => c.datastores && typeof c.datastores === 'object' && 'type' in c.datastores && c.datastores.type === 'pinecone');
        const knowledgeStore = connections.find(c => c.datastores && typeof c.datastores === 'object' && 'type' in c.datastores && c.datastores.type === 'getzep');

        setSelectedDatastores({
          vector: vectorStore?.datastore_id,
          knowledge: knowledgeStore?.datastore_id
        });
      }
    } catch (err: any) { // Added type any
      console.error('Error fetching agent:', err);
      setError(err.message || 'Failed to load agent. Please try again.'); // Use err.message
    } finally {
      setLoading(false);
    }
  };

  // Fetch datastores on component mount if editing (from AgentEdit)
  useEffect(() => {
    if (isEditing) {
      fetchDatastores();
    }
  }, [isEditing]); // Removed fetchDatastores from dependency array as it's stable

  // Fetch agent effect (combined logic from AgentEdit and previous AgentEditPage)
  useEffect(() => {
    if (isEditing && agentId) {
      fetchAgent(agentId);
    } else {
      // Reset form for create mode
      setFormData({
          name: '',
          description: '',
          personality: '',
          discord_channel: '',
          discord_bot_key: '',
          system_instructions: '',
          assistant_instructions: '',
          active: true
      });
      setSelectedDatastores({});
      setError(null);
      setLoading(false); // Ensure loading is false in create mode
    }
  }, [agentId, isEditing]); // Removed fetchAgent from dependency array

  // Handle datastore connection (from AgentEdit)
  const handleConnectDatastores = async () => {
    if (!agentId || !user?.id) return; // Use agentId

    try {
      setConnectingDatastores(true);
      setError(null);

      // Remove existing connections
      const { error: deleteError } = await supabase
        .from('agent_datastores')
        .delete()
        .eq('agent_id', agentId);

      if (deleteError) throw deleteError;

      // Add new connections
      const connections = [];
      if (selectedDatastores.vector) {
        connections.push({
          agent_id: agentId,
          datastore_id: selectedDatastores.vector
        });
      }
      if (selectedDatastores.knowledge) {
        connections.push({
          agent_id: agentId,
          datastore_id: selectedDatastores.knowledge
        });
      }

      if (connections.length > 0) {
        const { error: insertError } = await supabase
          .from('agent_datastores')
          .insert(connections);

        if (insertError) throw insertError;
      }

      setShowDatastoreModal(false);
    } catch (err: any) { // Added type any
      console.error('Error connecting datastores:', err);
      setError('Failed to connect datastores. Please try again.');
    } finally {
      setConnectingDatastores(false);
    }
  };

  // Handle form submit (from AgentEdit, adapted)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation
    if (!formData.name || !formData.description || !formData.personality) {
        setError('Name, Description, and Personality are required.');
        return;
    }
    try {
      setSaving(true);
      setError(null);
      
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Prepare data, removing potentially undefined fields handled by DB defaults
      const agentDataToSave = { ...formData };
      // Ensure user_id is correct, remove created_at/updated_at for insert/update
      delete agentDataToSave.created_at;
      delete agentDataToSave.updated_at;
      // agentDataToSave.user_id = user.id; // This line is causing issues, user_id is added later

      if (isEditing && agentId) {
          // Don't send ID in update payload
          delete agentDataToSave.id;
          const { error: updateError } = await supabase
          .from('agents')
          .update(agentDataToSave)
          .eq('id', agentId)
          .eq('user_id', user.id);

        if (updateError) throw new Error(updateError.message);
      } else {
         // Remove id if present from create payload
         delete agentDataToSave.id;
         const { data, error: insertError } = await supabase
          .from('agents')
          .insert([{ ...agentDataToSave, user_id: user.id }]) // Add user_id here for insert
          .select()
          .single();

        if (insertError) throw new Error(insertError.message);
        
        // If creating new agent, update the URL to edit mode without full page reload
        if (data) {
          navigate(`/agents/${data.id}`, { replace: true });
        }
      }

      setSaveSuccess(true);
    } catch (err: any) { // Added type any
      console.error('Error saving agent:', err);
      setError(err.message || 'Failed to save agent. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Loading / Signed out states (from AgentEdit)
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Please sign in to manage agents.</div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading agent...</div> 
      </div>
    );
  }

  // Render UI (merged from AgentEdit)
  return (
    <div className="space-y-6 p-6"> {/* Added padding */} 
      {/* Header section from AgentEdit */} 
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/agents')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold">
            {isEditing ? 'Edit Agent' : 'Create New Agent'}
          </h1>
        </div>
        <div className="flex space-x-4">
          {isEditing && (
            <button
              onClick={() => setShowDatastoreModal(true)}
              className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              <Database className="w-5 h-5 mr-2" />
              Connect Datastores
            </button>
          )}
          <button
            // onClick={handleSubmit} // Submit via form element
            type="submit" // Make this button submit the form
            form="agent-form" // Link button to form
            disabled={saving}
            className={`flex items-center px-4 py-2 rounded-md transition-colors ${
              saveSuccess
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {saving ? (
              <>
                {/* Using simpler spinner */} 
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                {isEditing ? 'Save Changes' : 'Create Agent'} {/* Updated text */} 
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error display from AgentEdit */} 
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md">
          {error}
          {/* Removed close button for simplicity, error clears on save attempt */}
        </div>
      )}

      {/* Form structure from AgentEdit */} 
      <form id="agent-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */} 
          <div className="bg-gray-800 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter agent name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Description *
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter agent description"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Personality Template *
              </label>
              <select
                required
                value={formData.personality}
                onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a template</option>
                {personalityTemplates.map(template => (
                  <option key={template.id} value={template.name}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Discord Configuration */} 
          <div className="bg-gray-800 rounded-lg p-6 space-y-4">
            {/* Heading and Toggle Row */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Discord Configuration</h2>
              {/* Conditionally render toggle if credentials seem complete and server selected */}
              {hasCredentials && discordConnectionData?.guild_id && (
                <SubtleStatusToggle
                   workerStatus={workerStatus || 'inactive'}
                   canActivate={canActivateToggle} // Use calculated value
                   onActivate={activate}
                   onDeactivate={deactivate}
                   isActivating={isActivating}
                   isDeactivating={isDeactivating}
                 />
              )}
            </div>
            
            { discordLoading ? (
                <p className="text-sm text-gray-400">Loading Discord connection...</p>
            ) : discordError ? (
                 <p className="text-sm text-red-400">Error loading Discord info: {discordError}</p>
            ) : (
                 <DiscordConnect
                    connection={discordConnectionData || {}} // Pass fetched connection or empty object
                    hasCredentials={hasCredentials} // Pass credentials status
                    onConnectionChange={updateConnectionField} // Pass handler
                    discord_app_id={discordConnectionData?.discord_app_id} // Pass app_id
                    onGenerateInviteLink={generateInviteLink} // Pass handler
                    isGeneratingInvite={isGeneratingInvite} // Pass state
                    workerStatus={workerStatus || 'inactive'} // Pass status
                    onActivate={activate} // Pass handler
                    onDeactivate={deactivate} // Pass handler
                    isActivating={isActivating} // Pass state
                    isDeactivating={isDeactivating} // Pass state
                    allGuilds={allGuilds} // Pass guilds
                    currentGuildId={discordConnectionData?.guild_id} // Pass current guild
                    showStatusToggle={true} // Always show toggle on edit page
                />
            )}
            {/* <p className="text-sm text-gray-500">(Discord connection UI temporarily disabled - requires prop updates)</p> */}
          </div>
        </div>

        {/* System Instructions */} 
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-4">System Instructions</h2>
          <p className="text-sm text-gray-400 mb-4">
            Define the core behavior and capabilities of your AI agent. These instructions set the foundation for how the agent will interact and process information.
          </p>
          <div className="h-64 border border-gray-700 rounded-lg overflow-hidden">
            <MonacoEditor
              language="markdown"
              theme="vs-dark"
              value={formData.system_instructions}
              onChange={(value) => setFormData({ ...formData, system_instructions: value })}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                wrappingIndent: 'indent',
                automaticLayout: true,
              }}
            />
          </div>
        </div>

        {/* Assistant Instructions */} 
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-4">Assistant Instructions</h2>
          <p className="text-sm text-gray-400 mb-4">
            Specify additional context and instructions for the assistant, including any relevant information from datastores or specific behavioral guidelines.
          </p>
          <div className="h-64 border border-gray-700 rounded-lg overflow-hidden">
            <MonacoEditor
              language="markdown"
              theme="vs-dark"
              value={formData.assistant_instructions}
              onChange={(value) => setFormData({ ...formData, assistant_instructions: value })}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                wrappingIndent: 'indent',
                automaticLayout: true,
              }}
            />
          </div>
        </div>
        {/* Removed redundant save/cancel buttons from here, moved to header */}
      </form>

      {/* Datastore Connection Modal (from AgentEdit) */} 
      {showDatastoreModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-2xl font-bold mb-6">Connect Datastores</h2>
            
            {loadingDatastores ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-400">Loading datastores...</p>
              </div>
            ) : datastores.length === 0 ? (
              <div className="text-center py-8">
                <Database className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No datastores found. Create a datastore first.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Vector Datastore Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Vector Datastore (Pinecone)
                  </label>
                  <select
                    value={selectedDatastores.vector || ''}
                    onChange={(e) => setSelectedDatastores({
                      ...selectedDatastores,
                      vector: e.target.value || undefined
                    })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select a vector datastore</option>
                    {datastores
                      .filter(ds => ds.type === 'pinecone')
                      .map(ds => (
                        <option key={ds.id} value={ds.id}>{ds.name}</option>
                      ))
                    }
                  </select>
                </div>

                {/* Knowledge Graph Datastore Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Knowledge Graph (GetZep)
                  </label>
                  <select
                    value={selectedDatastores.knowledge || ''}
                    onChange={(e) => setSelectedDatastores({
                      ...selectedDatastores,
                      knowledge: e.target.value || undefined
                    })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select a knowledge graph datastore</option>
                    {datastores
                      .filter(ds => ds.type === 'getzep')
                      .map(ds => (
                        <option key={ds.id} value={ds.id}>{ds.name}</option>
                      ))
                    }
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-700"> {/* Added border */} 
                  <button
                    type="button"
                    onClick={() => setShowDatastoreModal(false)}
                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                    disabled={connectingDatastores}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConnectDatastores}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={connectingDatastores}
                  >
                    {connectingDatastores ? (
                        <>
                             <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                             Connecting...
                        </>
                    ) : (
                         'Connect Datastores'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/*
// --- ORIGINAL COMPONENT CODE START ---
// ... (All the original code of AgentEditPage is now inside this comment) ...
// --- ORIGINAL COMPONENT CODE END ---
*/