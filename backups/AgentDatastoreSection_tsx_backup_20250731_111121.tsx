import React, { useState, useEffect } from 'react';
import { Database, Plus, Link as LinkIcon, Loader2, AlertTriangle } from 'lucide-react';
import type { Datastore } from '../../types';
import { supabase } from '../../lib/supabase'; // Assuming supabase client is here

interface AgentDatastoreSectionProps {
  agentId: string | undefined;
  selectedDatastores: { vector?: string; knowledge?: string };
  onDatastoreConnect: (type: 'vector' | 'knowledge', datastoreId: string) => Promise<void>; // Make async if connect op is async
  onDatastoreDisconnect: (type: 'vector' | 'knowledge') => Promise<void>; // Make async if needed
  saving: boolean;
}

export const AgentDatastoreSection: React.FC<AgentDatastoreSectionProps> = ({
  agentId,
  selectedDatastores,
  onDatastoreConnect,
  onDatastoreDisconnect,
  saving,
}) => {
  const [showDatastoreModal, setShowDatastoreModal] = useState(false);
  const [datastores, setDatastores] = useState<Datastore[]>([]);
  const [loadingDatastores, setLoadingDatastores] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectingType, setConnectingType] = useState<'vector' | 'knowledge' | null>(null);

  // Fetch available datastores when modal is opened or agentId changes
  useEffect(() => {
    const fetchDatastores = async () => {
      if (!agentId) return;
      setLoadingDatastores(true);
      setConnectError(null);
      try {
        // Assuming RLS allows fetching user's datastores
        const { data, error } = await supabase
          .from('datastores')
          .select('id, name, type, description')
          // .eq('user_id', user.id) // Add user filter if needed
          .order('name');

        if (error) throw error;
        setDatastores(data || []);
      } catch (err: any) {
        console.error("Error fetching datastores:", err);
        setConnectError(`Failed to load datastores: ${err.message}`);
        setDatastores([]);
      } finally {
        setLoadingDatastores(false);
      }
    };

    if (showDatastoreModal && agentId) {
      fetchDatastores();
    }
  }, [showDatastoreModal, agentId]);

  const handleConnectClick = async (type: 'vector' | 'knowledge', datastoreId: string) => {
      if (!datastoreId) return;
      setConnectingType(type);
      setConnectError(null);
      try {
          await onDatastoreConnect(type, datastoreId);
          setShowDatastoreModal(false); // Close modal on successful connect
      } catch (err: any) {
          console.error(`Error connecting ${type} datastore:`, err);
          setConnectError(`Failed to connect ${type} datastore: ${err.message}`);
      } finally {
          setConnectingType(null);
      }
  };
  
  const handleDisconnectClick = async (type: 'vector' | 'knowledge') => {
      setConnectingType(type); // Reuse connecting state for visual feedback
      setConnectError(null);
      try {
          await onDatastoreDisconnect(type);
      } catch (err: any) {
           console.error(`Error disconnecting ${type} datastore:`, err);
          setConnectError(`Failed to disconnect ${type} datastore: ${err.message}`);
      } finally {
          setConnectingType(null);
      }
  };

  const getDatastoreName = (id: string | undefined): string => {
      return datastores.find(ds => ds.id === id)?.name || id?.substring(0, 8) || 'N/A';
  };

  const buttonClasses = "inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const secondaryButtonClasses = "inline-flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const labelClasses = "block text-sm font-medium text-gray-300 mb-1";
  const selectClasses = "block w-full pl-3 pr-8 py-2 border border-border text-foreground bg-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="space-y-6 bg-gray-850 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold text-white mb-4 border-b border-gray-700 pb-2 flex items-center">
          <Database className="w-5 h-5 mr-2" /> Datastore Connections
      </h2>

       {connectError && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-md text-sm flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" /> {connectError}
          </div>
       )}

      {/* Vector Datastore */}
      <div className="space-y-2">
        <label className={labelClasses}>Vector Datastore (for Similarity Search)</label>
        <div className="flex items-center space-x-3">
            <input 
                type="text" 
                readOnly 
                value={selectedDatastores.vector ? getDatastoreName(selectedDatastores.vector) : 'None Connected'}
                className={`${selectClasses} flex-grow bg-gray-700 cursor-default`} 
                disabled={saving}
            />
            {selectedDatastores.vector ? (
                <button 
                    onClick={() => handleDisconnectClick('vector')} 
                    className={`${secondaryButtonClasses} bg-red-800 hover:bg-red-700 border-red-700`} 
                    disabled={saving || connectingType === 'vector'}
                    title="Disconnect Vector Datastore"
                >
                    {connectingType === 'vector' ? <Loader2 className="animate-spin h-4 w-4" /> : 'Disconnect'}
                </button>
            ) : (
                <button 
                    onClick={() => setShowDatastoreModal(true)} 
                    className={buttonClasses} 
                    disabled={saving || connectingType === 'vector'}
                    title="Connect Vector Datastore"
                >
                    {connectingType === 'vector' ? <Loader2 className="animate-spin h-4 w-4" /> : 'Connect'}
                </button>
            )}
        </div>
      </div>

      {/* Knowledge Datastore */}
      <div className="space-y-2">
        <label className={labelClasses}>Knowledge Datastore (for Fact Retrieval)</label>
         <div className="flex items-center space-x-3">
             <input 
                type="text" 
                readOnly 
                value={selectedDatastores.knowledge ? getDatastoreName(selectedDatastores.knowledge) : 'None Connected'}
                className={`${selectClasses} flex-grow bg-gray-700 cursor-default`} 
                disabled={saving}
            />
            {selectedDatastores.knowledge ? (
                <button 
                    onClick={() => handleDisconnectClick('knowledge')}
                    className={`${secondaryButtonClasses} bg-red-800 hover:bg-red-700 border-red-700`} 
                    disabled={saving || connectingType === 'knowledge'}
                    title="Disconnect Knowledge Datastore"
                 >
                    {connectingType === 'knowledge' ? <Loader2 className="animate-spin h-4 w-4" /> : 'Disconnect'}
                </button>
            ) : (
                <button 
                    onClick={() => setShowDatastoreModal(true)} 
                    className={buttonClasses} 
                    disabled={saving || connectingType === 'knowledge'}
                    title="Connect Knowledge Datastore"
                >
                   {connectingType === 'knowledge' ? <Loader2 className="animate-spin h-4 w-4" /> : 'Connect'}
                </button>
            )}
        </div>
      </div>

      {/* Datastore Selection Modal */}
      {showDatastoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="bg-card border border-border p-6 rounded-lg shadow-xl max-w-lg w-full mx-4">
            <h3 className="text-lg font-medium text-white mb-4">Select Datastore to Connect</h3>
            {loadingDatastores ? (
              <div className="flex justify-center items-center p-4"><Loader2 className="animate-spin h-6 w-6 text-indigo-400" /></div>
            ) : connectError ? (
               <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-md text-sm mb-4">
                  {connectError}
               </div>
            ) : (
              <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                {datastores.length === 0 && <p className="text-gray-400 text-sm">No datastores found or failed to load.</p>}
                {datastores.map((ds) => (
                  <div key={ds.id} className="p-3 bg-gray-700 rounded-md flex justify-between items-center">
                    <div>
                        <p className="font-medium text-white">{ds.name}</p>
                        <p className="text-xs text-gray-400">Type: {ds.type} - {ds.description || 'No description'}</p>
                    </div>
                    <div className="space-x-2 flex-shrink-0">
                      {ds.type === 'vector' && (
                        <button 
                            onClick={() => handleConnectClick('vector', ds.id)}
                            className={secondaryButtonClasses}
                            disabled={connectingType === 'vector' || selectedDatastores.vector === ds.id}
                        >
                          {connectingType === 'vector' && !selectedDatastores.vector ? <Loader2 className="animate-spin h-4 w-4 mr-1" /> : <LinkIcon className="h-4 w-4 mr-1" />} Connect Vector
                        </button>
                      )}
                      {ds.type === 'knowledge' && (
                         <button 
                            onClick={() => handleConnectClick('knowledge', ds.id)}
                            className={secondaryButtonClasses}
                            disabled={connectingType === 'knowledge' || selectedDatastores.knowledge === ds.id}
                         >
                           {connectingType === 'knowledge' && !selectedDatastores.knowledge ? <Loader2 className="animate-spin h-4 w-4 mr-1" /> : <LinkIcon className="h-4 w-4 mr-1" />} Connect Knowledge
                         </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setShowDatastoreModal(false)} 
                className={secondaryButtonClasses}
                disabled={connectingType !== null}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 