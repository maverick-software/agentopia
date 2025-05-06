import { useRouter } from 'next/router';
import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useAuth } from '@/contexts/AuthContext'; 
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AgentFormBasicInfo } from '@/components/agent-edit/AgentFormBasicInfo';
import { AgentFormInstructions } from '@/components/agent-edit/AgentFormInstructions';
import { AgentDiscordSettings } from '@/components/agent-edit/AgentDiscordSettings';
import { AgentDatastoreSelector } from '@/components/agent-edit/AgentDatastoreSelector';
import type { Agent, AgentDiscordConnection, Datastore } from '@/types';

const AgentEditPage = () => {
    const router = useRouter();
    const { agentId } = router.query as { agentId: string };
    const supabase = useSupabaseClient();
    const { user } = useAuth();

    const [agentData, setAgentData] = useState<Partial<Agent>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [availableDatastores, setAvailableDatastores] = useState<Datastore[]>([]); 
    const [selectedVectorStore, setSelectedVectorStore] = useState<string | undefined>(undefined);
    const [selectedKnowledgeStore, setSelectedKnowledgeStore] = useState<string | undefined>(undefined);
    const [discordConnection, setDiscordConnection] = useState<Partial<AgentDiscordConnection> | null>(null);
    const [personalityTemplates, setPersonalityTemplates] = useState<any[]>([]);

    useEffect(() => {
        const fetchAgentAndRelatedData = async () => {
            if (!agentId || !user) return;
            setLoading(true);
            setError(null);
            try {
                const { data: agent, error: agentError } = await supabase
                    .from('agents')
                    .select(`
                        *, 
                        agent_discord_connections(*),
                        agent_datastores(datastore_id)
                    `)
                    .eq('id', agentId)
                    .eq('user_id', user.id)
                    .single();

                if (agentError) throw agentError;
                if (!agent) throw new Error('Agent not found or access denied.');

                setAgentData(agent);
                
                if (agent.agent_discord_connections) {
                    setDiscordConnection(agent.agent_discord_connections);
                }
                
                if (agent.agent_datastores && availableDatastores.length > 0) {
                } 

                const { data: stores, error: dsError } = await supabase
                    .from('datastores')
                    .select('id, name, type')
                    .eq('user_id', user.id);
                if (dsError) console.error("Error fetching datastores:", dsError);
                else setAvailableDatastores(stores || []);
                
            } catch (err: any) {
                console.error("Error loading agent data:", err);
                setError(err.message);
                setAgentData({});
                setDiscordConnection(null);
            } finally {
                setLoading(false);
            }
        };
        fetchAgentAndRelatedData();
    }, [agentId, user, supabase]);

    const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target;
        setAgentData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleSelectChange = useCallback((value: string, name: string = 'personality') => {
        setAgentData(prev => ({ ...prev, [name]: value }));
    }, []);
    
    const handleSwitchChange = useCallback((checked: boolean, name: string = 'active') => {
        setAgentData(prev => ({ ...prev, [name]: checked }));
    }, []);

    const handleEditorChange = useCallback((fieldName: string, value: string) => {
        const agentDataKey = fieldName === 'system_instructions' ? 'system_instructions' : 
                             fieldName === 'assistant_instructions' ? 'assistant_instructions' : null;
        if (agentDataKey) {
            setAgentData(prev => ({ ...prev, [agentDataKey]: value }));
        }
    }, []);
    
    const handleAvatarUpdate = useCallback((newAvatarUrl: string | null) => {
        setAgentData(prev => ({ ...(prev as any), avatar_url: newAvatarUrl }));
    }, []);

    const handleSave = async () => {
      if (!agentId || !user) return;
      setSaving(true);
      setError(null);
      console.log("Saving agent data:", agentData);
      try {
          const updatePayload: Partial<Agent> = {
              name: agentData.name,
              description: agentData.description,
              personality: agentData.personality,
              active: agentData.active,
              system_instructions: agentData.system_instructions,
              assistant_instructions: agentData.assistant_instructions,
              avatar_url: (agentData as any).avatar_url,
          };

          const { error: updateError } = await supabase
              .from('agents')
              .update(updatePayload)
              .eq('id', agentId)
              .eq('user_id', user.id);

          if (updateError) throw updateError;

          toast.success('Agent saved successfully!');
      } catch (err: any) {
          console.error("Save failed:", err);
          setError(`Save failed: ${err.message}`);
          toast.error(`Save failed: ${err.message}`);
      } finally {
          setSaving(false);
      }
    };

    if (loading) return (
        <Layout>
            <div className="container mx-auto px-4 py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin inline-block" />
                <p>Loading Agent Data...</p>
            </div>
        </Layout>
    );
    
    if (error || !agentData.id) return (
        <Layout>
             <div className="container mx-auto px-4 py-8">
                <p className="text-destructive">Error loading agent: {error || 'Agent not found or access denied.'}</p>
             </div>
        </Layout>
    );

    return (
        <Layout>
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-6">Edit Agent: {agentData.name || '...'}</h1>
                <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                       <AgentFormBasicInfo
                            agentData={agentData}
                            handleInputChange={handleInputChange}
                            handleSelectChange={handleSelectChange} 
                            handleSwitchChange={handleSwitchChange} 
                            personalityTemplates={personalityTemplates}
                            handleAvatarUpdate={handleAvatarUpdate}
                       />
                       <AgentFormInstructions
                           systemInstructions={agentData.system_instructions || ''}
                           assistantInstructions={agentData.assistant_instructions || ''}
                           handleEditorChange={handleEditorChange}
                       />
                       <AgentDiscordSettings
                           connection={discordConnection}
                           hasCredentials={!!discordConnection?.discord_app_id}
                           workerStatus={discordConnection?.worker_status as any || 'inactive'}
                           allGuilds={[]}
                           isActivating={false}
                           isDeactivating={false}
                           isGeneratingInvite={false}
                           discordLoading={false}
                           discordError={null}
                           onConnectionChange={() => {}}
                           activate={async () => {}}
                           deactivate={async () => {}}
                           generateInviteLink={async () => null}
                       />
                       <AgentDatastoreSelector
                           agentId={agentId}
                           availableDatastores={availableDatastores}
                           selectedVectorStore={selectedVectorStore}
                           selectedKnowledgeStore={selectedKnowledgeStore}
                           onSelectDatastore={() => {}}
                           onConnectDatastores={async () => {}}
                           loadingAvailable={false}
                           connecting={false}
                       />
                    </div>

                    <div className="flex justify-end mt-6">
                        <Button type="submit" disabled={saving || loading}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </div>
        </Layout>
    );
};

export default AgentEditPage; 