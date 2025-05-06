import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useAuth } from '@/contexts/AuthContext'; 
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
// import { AgentFormBasicInfo } from '@/components/agent-edit/AgentFormBasicInfo'; // ENSURE THIS IS REMOVED OR COMMENTED
import { AgentFormInstructions } from '@/components/agent-edit/AgentFormInstructions';
import { AgentDiscordSettings } from '@/components/agent-edit/AgentDiscordSettings';
import { AgentDatastoreSelector } from '@/components/agent-edit/AgentDatastoreSelector';
import type { Agent } from '@/types/index';
import type { AgentDiscordConnection, Datastore } from '@/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentProfileImageEditor } from '@/components/agent-edit/AgentProfileImageEditor';

const AgentEditPage = () => {
    const { agentId } = useParams<{ agentId: string }>();
    const supabase = useSupabaseClient();
    const { user } = useAuth();

    const [agentData, setAgentData] = useState<Partial<Agent> | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [availableDatastores, setAvailableDatastores] = useState<Datastore[]>([]); 
    const [selectedVectorStore, setSelectedVectorStore] = useState<string | undefined>(undefined);
    const [selectedKnowledgeStore, setSelectedKnowledgeStore] = useState<string | undefined>(undefined);
    const [discordConnection, setDiscordConnection] = useState<Partial<AgentDiscordConnection> | null>(null);
    const [personalityTemplates, setPersonalityTemplates] = useState<any[]>([]);

    useEffect(() => {
        if (!agentId || !user) {
            setLoading(false); 
            if (agentData !== null) {
                 setAgentData(null);
            }
            return; 
        }

        const fetchAgentAndRelatedData = async () => {
            setLoading(true);
            setError(null); 
            setAgentData(null); 
            setDiscordConnection(null);
            setAvailableDatastores([]);

            try {
                const { data: agent, error: agentError } = await supabase
                    .from('agents')
                    .select(`*, agent_discord_connections(*), agent_datastores(datastore_id)`)
                    .eq('id', agentId)
                    .eq('user_id', user.id)
                    .single();

                if (agentError) throw agentError;
                if (!agent) throw new Error('Agent not found or access denied.');

                console.log("[AgentEditPage] Data fetched successfully. Preparing to set state with:", agent);
                setAgentData(agent);
                console.log("[AgentEditPage] Called setAgentData.");
                
                if (agent.agent_discord_connections) {
                    setDiscordConnection(agent.agent_discord_connections);
                }
                
                const { data: stores, error: dsError } = await supabase
                    .from('datastores')
                    .select('id, name, type')
                    .eq('user_id', user.id);
                if (dsError) console.error("Error fetching datastores:", dsError);
                else setAvailableDatastores(stores || []);
                
            } catch (err: any) {
                console.error("[AgentEditPage] Error fetching data:", err);
                setError(err.message);
                console.log("[AgentEditPage] Error occurred. Preparing to set agentData state to null.");
                setAgentData(null);
                console.log("[AgentEditPage] Called setAgentData with null.");
                setDiscordConnection(null);
            } finally {
                setLoading(false);
            }
        };

        fetchAgentAndRelatedData();

    }, [agentId, user, supabase]);

    useEffect(() => {
        console.log("[AgentEditPage] agentData state CHANGED to:", agentData);
    }, [agentData]);

    const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target;
        setAgentData(prev => (prev ? { ...prev, [name]: value } : { [name]: value } as Partial<Agent>));
    }, []);

    const handleSelectChange = useCallback((value: string, name: string = 'personality') => {
        setAgentData(prev => (prev ? { ...prev, [name]: value } : { [name]: value } as Partial<Agent>));
    }, []);
    
    const handleSwitchChange = useCallback((checked: boolean, name: string = 'active') => {
        setAgentData(prev => (prev ? { ...prev, [name]: checked } : { [name]: checked } as Partial<Agent>));
    }, []);

    const handleEditorChange = useCallback((fieldName: string, value: string) => {
        const agentDataKey = fieldName === 'system_instructions' ? 'system_instructions' :
                             fieldName === 'assistant_instructions' ? 'assistant_instructions' : null;
        if (agentDataKey) {
            setAgentData(prev => (prev ? { ...prev, [agentDataKey]: value } : { [agentDataKey]: value } as Partial<Agent>));
        }
    }, []);
    
    const handleAvatarUpdate = useCallback((newAvatarUrl: string | null) => {
        setAgentData(prev => (prev ? { ...prev, avatar_url: newAvatarUrl } : { avatar_url: newAvatarUrl } as Partial<Agent>));
    }, []);

    const handleSave = async () => {
      if (!agentId || !user || !agentData) {
        setError("Cannot save, agent data is not available.");
        return;
      }
      setSaving(true);
      setError(null);
      try {
          const updatePayload: Partial<Agent> = {
              name: agentData.name || undefined,
              description: agentData.description || undefined,
              personality: agentData.personality || undefined,
              active: agentData.active === null ? false : agentData.active,
              system_instructions: agentData.system_instructions || undefined,
              assistant_instructions: agentData.assistant_instructions || undefined,
              avatar_url: agentData.avatar_url,
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

    if (loading) {
        return (
            <Layout>
                <div className="container mx-auto px-4 py-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin inline-block" />
                    <p>Loading Agent Data...</p>
                </div>
            </Layout>
        );
    }
    
    if (error || !agentData || !agentData.id) {
        return (
            <Layout>
                 <div className="container mx-auto px-4 py-8">
                    <p className="text-destructive">{error || 'Agent not found, access denied, or failed to load.'}</p>
                 </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-6">Edit Agent: {agentData.name || '...'}</h1>
                <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                       {/* ================================================================================ */}
                       {/* === START INLINED AgentFormBasicInfo (Temporary for Debugging) === */}
                       {/* ================================================================================ */}
                       <Card>
                         <CardHeader>
                           <CardTitle>Basic Information</CardTitle>
                         </CardHeader>
                         <CardContent className="space-y-4">
                           {/* Agent Profile Image Editor Integration */}
                           {agentData && agentData.id && (
                             <AgentProfileImageEditor 
                               agentId={agentData.id} 
                               currentAvatarUrl={agentData.avatar_url}
                               onAvatarUpdate={handleAvatarUpdate}
                             />
                           )}
               
                           {/* Agent Name */}
                           <div className="space-y-1">
                             <Label htmlFor="name">Name</Label>
                             <Input 
                               id="name" 
                               name="name" 
                               value={agentData.name || ''} 
                               onChange={handleInputChange} 
                               placeholder="My Helpful Agent" 
                             />
                           </div>
               
                           {/* Agent Description */}
                           <div className="space-y-1">
                             <Label htmlFor="description">Description</Label>
                             <Textarea 
                               id="description" 
                               name="description" 
                               value={agentData.description || ''} 
                               onChange={handleInputChange} 
                               placeholder="Provide a brief description of the agent's purpose."
                             />
                           </div>
               
                           {/* Agent Personality */}
                           <div>
                             <Label htmlFor="agentPersonality">Personality</Label>
                             <Select 
                               name="personality"
                               value={agentData.personality || ''} 
                               onValueChange={(value) => handleSelectChange(value)}
                             >
                               <SelectTrigger id="agentPersonality">
                                 <SelectValue placeholder="Select a personality template" />
                               </SelectTrigger>
                               <SelectContent>
                                 {personalityTemplates.map(template => (
                                   <SelectItem key={template.id} value={template.id}>
                                     {template.name} - {template.description}
                                   </SelectItem>
                                 ))}
                               </SelectContent>
                             </Select>
                           </div>
               
                           {/* Active Status */}
                           <div className="flex items-center space-x-2">
                             <Switch 
                               id="agentActive" 
                               checked={agentData.active === null ? false : agentData.active} 
                               onCheckedChange={(checked) => handleSwitchChange(checked)}
                             />
                             <Label htmlFor="agentActive">Active</Label>
                           </div>
                         </CardContent>
                       </Card>
                       {/* ================================================================================ */}
                       {/* === END INLINED AgentFormBasicInfo                                       === */}
                       {/* ================================================================================ */}

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
                    <div className="flex justify-end">
                        <Button type="submit" disabled={saving || loading || !!error}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Agent
                        </Button>
                    </div>
                </form>
            </div>
        </Layout>
    );
};

export default AgentEditPage; 