import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSupabaseClient } from '../../../hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext'; 
import { Button } from '@/components/ui/button';
import { 
    Loader2, ArrowLeft, Save, Database, 
    Edit, Settings, PencilLine, ImagePlus, Check
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AgentFormInstructions } from '@/components/agent-edit/AgentFormInstructions';
import { AgentDatastoreSelector } from '@/components/agent-edit/AgentDatastoreSelector';
import type { Agent } from '@/types/index';
import type { Datastore } from '@/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AgentProfileImageEditor } from '@/components/agent-edit/AgentProfileImageEditor';
import { AgentIntegrationsManager } from '@/components/agent-edit/AgentIntegrationsManager';
import { AgentTasksManager } from '@/components/agent-edit/AgentTasksManager';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle,
    DialogTrigger,
    DialogClose
} from "@/components/ui/dialog";
import { ToolExecutionHistory } from '@/components/ToolExecutionHistory';


const AgentEditPage = () => {
    const { agentId } = useParams<{ agentId: string }>();
    const supabase = useSupabaseClient();
    const { user } = useAuth();

    const [agentData, setAgentData] = useState<Partial<Agent> | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [availableDatastores, setAvailableDatastores] = useState<Datastore[]>([]); 
    const [selectedVectorStore, setSelectedVectorStore] = useState<string | undefined>(undefined);
    const [selectedKnowledgeStore, setSelectedKnowledgeStore] = useState<string | undefined>(undefined);
    
    const [showInstructionsModal, setShowInstructionsModal] = useState(false);

    // Clear save success state after 3 seconds
    useEffect(() => {
        if (saveSuccess) {
            const timer = setTimeout(() => {
                setSaveSuccess(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [saveSuccess]);
    const [showDatastoreModal, setShowDatastoreModal] = useState(false);
    const [showProfileImageModal, setShowProfileImageModal] = useState(false);

    const [personalityTemplates, setPersonalityTemplates] = useState<any[]>([
        { id: 'helpful', name: 'Helpful', description: 'Friendly and eager to assist' },
        { id: 'professional', name: 'Professional', description: 'Formal and business-oriented' },
        { id: 'cheerful', name: 'Cheerful', description: 'Upbeat and positive' },
    ]);

    useEffect(() => {
        if (!agentId || !user) {
            setLoading(false); 
            if (agentData !== null) setAgentData(null);
            return; 
        }

        const fetchAgentAndRelatedData = async () => {
            setLoading(true);
            setError(null);
            setAgentData(null); 
            setAvailableDatastores([]);

            try {
                const { data: agent, error: agentError } = await supabase
                    .from('agents')
                    .select(`*, agent_datastores(datastore_id)`)
                    .eq('id', agentId)
                    .eq('user_id', user.id)
                    .single();

                if (agentError) throw agentError;
                if (!agent) throw new Error('Agent not found or access denied.');

                setAgentData(agent);

                const { data: stores, error: dsError } = await supabase
                    .from('datastores')
                    .select('*')
                    .eq('user_id', user.id);
                if (dsError) console.error("Error fetching datastores:", dsError);
                else setAvailableDatastores(stores || []);
                
            } catch (err: any) {
                console.error("[AgentEditPage] Error fetching data:", err);
                setError(err.message);
                setAgentData(null);
            } finally {
                setLoading(false);
            }
        };

        fetchAgentAndRelatedData();

    }, [agentId, user, supabase]);

    const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target;
        setAgentData(prev => (prev ? { ...prev, [name]: value } : { [name]: value } as Partial<Agent>));
    }, []);

    const handleSelectChange = useCallback((value: string, name: string = 'personality') => {
        setAgentData(prev => (prev ? { ...prev, [name]: value } : { [name]: value } as Partial<Agent>));
    }, []);
    
    const handleDiscordBotActiveSwitchChange = useCallback((checked: boolean, name: string = 'active') => {
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
        setShowProfileImageModal(false);
    }, []);

    const handleSave = async () => {
        if (!agentId || !user || !agentData) {
            setError("Cannot save, agent data is not available.");
            return;
        }
        setSaving(true);
        setError(null);
        
        // Start minimum delay timer
        const minDelayPromise = new Promise(resolve => setTimeout(resolve, 800));
        
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

            const savePromise = supabase
                .from('agents')
                .update(updatePayload)
                .eq('id', agentId)
                .eq('user_id', user.id);

            // Wait for both the save operation and minimum delay
            const [{ error: updateError }] = await Promise.all([savePromise, minDelayPromise]);

            if (updateError) throw updateError;

            toast.success('Agent saved successfully!');
            setSaveSuccess(true);
        } catch (err: any) {
            console.error("Save failed:", err);
            setError(`Save failed: ${err.message}`);
            toast.error(`Save failed: ${err.message}`);
            // Still wait for minimum delay even on error to avoid jarring UI
            await minDelayPromise;
        } finally {
            setSaving(false);
        }
    };


    
    const getStatusBadge = () => {
        if (!agentData) return null;
        
        return agentData.active ? (
            <Badge variant="default" className="ml-2 bg-green-500/20 text-green-500 hover:bg-green-500/20">Active</Badge>
        ) : (
            <Badge variant="secondary" className="ml-2">Inactive</Badge>
        );
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading agent data...</p>
            </div>
        );
    }
    
    if (error || !agentData || !agentData.id) {
        return (
            <div className="container max-w-6xl mx-auto p-6">
                <Alert variant="destructive" className="mb-6">
                    <AlertDescription>
                        {error || 'Agent not found, access denied, or failed to load.'}
                    </AlertDescription>
                </Alert>
                <Button asChild variant="outline" size="sm">
                    <Link to="/agents" className="flex items-center">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Agents
                    </Link>
                </Button>
             </div>
        );
    }

    return (
        <div className="container max-w-6xl mx-auto px-4 py-6 space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div className="flex items-center">
                    <Button asChild variant="ghost" size="icon" className="mr-2">
                        <Link to="/agents">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold">Edit Agent: {agentData.name || '...'}</h1>
                    {getStatusBadge()}
                </div>
                <Button 
                    onClick={handleSave} 
                    disabled={saving || loading || !!error} 
                    className="w-full sm:w-auto"
                >
                    {saving ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                    ) : saveSuccess ? (
                        <><Check className="mr-2 h-4 w-4" />Saved!</>
                    ) : (
                        <><Save className="mr-2 h-4 w-4" />Save Agent</>
                    )}
                </Button>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle>Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col items-center mb-6">
                                <div className="relative group">
                                    <Avatar className="h-32 w-32 border-2 border-border">
                                        {agentData.avatar_url ? (
                                            <AvatarImage src={agentData.avatar_url} alt={agentData.name || 'Agent'} />
                                        ) : (
                                            <AvatarFallback className="text-3xl">
                                                {agentData.name?.charAt(0).toUpperCase() || 'A'}
                                            </AvatarFallback>
                                        )}
                                    </Avatar>
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full">
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="text-white"
                                            onClick={() => setShowProfileImageModal(true)}
                                        >
                                            <PencilLine className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                    
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input 
                                    id="name" 
                                    name="name" 
                                    value={agentData.name || ''} 
                                    onChange={handleInputChange} 
                                    placeholder="My Helpful Agent" 
                                />
                            </div>
                    
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea 
                                    id="description" 
                                    name="description" 
                                    value={agentData.description || ''} 
                                    onChange={handleInputChange} 
                                    placeholder="Provide a brief description of the agent's purpose."
                                    className="min-h-[80px] resize-y"
                                />
                            </div>
                    

                        </CardContent>
                    </Card>

                    {/* Channels (Communication) - Moved from right column */}
                    <AgentIntegrationsManager 
                        agentId={agentId!} 
                        category="channel"
                        title="Channels"
                        description="Connect communication channels to this agent"
                    />

                    <Card>
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Knowledge</CardTitle>
                                <CardDescription>Connect to knowledge bases</CardDescription>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setShowDatastoreModal(true)}
                            >
                                <Database className="h-4 w-4 mr-2" />
                                Connect Datastores
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {(() => {
                                const connectedDatastores = Array.isArray(
                                    (agentData as any)?.agent_datastores
                                ) ? (agentData as any).agent_datastores.length : 0;
                                
                                if (connectedDatastores > 0) {
                                    return (
                                        <div className="text-sm">
                                            {connectedDatastores} datastore(s) connected
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div className="text-center py-6 text-muted-foreground">
                                            <Database className="h-10 w-10 mx-auto opacity-50 mb-2" />
                                            <p>No datastores connected</p>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="mt-4"
                                                onClick={() => setShowDatastoreModal(true)}
                                            >
                                                Connect Datastores
                                            </Button>
                                        </div>
                                    );
                                }
                            })()}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">

                    {/* Agent Tasks - Moved to top of right column */}
                    <AgentTasksManager 
                        agentId={agentId!} 
                        userId={user?.id!} 
                    />

                    {/* Tools */}
                    <AgentIntegrationsManager 
                        agentId={agentId!} 
                        category="tool"
                        title="Tools"
                        description="Connect external tools and services to this agent"
                    />

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle>Agent Settings</CardTitle>
                            <CardDescription>Configure personality and behavior options</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
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
                            
                            <Button 
                                variant="outline" 
                                onClick={() => setShowInstructionsModal(true)}
                                className="w-full"
                            >
                                <PencilLine className="h-4 w-4 mr-2" />
                                Edit Instructions
                            </Button>
                        </CardContent>
                    </Card>

                </div>
            </div>

            {/* Tool Execution History - Moved to bottom, full width */}
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Tool Execution History</CardTitle>
                    <CardDescription>View recent tool executions and their results</CardDescription>
                </CardHeader>
                <CardContent>
                    <ToolExecutionHistory 
                        agentId={agentId!}
                        showFilters={true}
                        showExport={true}
                        maxItems={50}
                    />
                </CardContent>
            </Card>

            <div className="pt-4 mt-6 border-t border-border sm:hidden">
                <Button 
                    onClick={handleSave} 
                    disabled={saving || loading || !!error} 
                    className="w-full"
                >
                    {saving ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                    ) : saveSuccess ? (
                        <><Check className="mr-2 h-4 w-4" />Saved!</>
                    ) : (
                        <><Save className="mr-2 h-4 w-4" />Save Agent</>
                    )}
                </Button>
            </div>
            
            <Dialog open={showProfileImageModal} onOpenChange={setShowProfileImageModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Agent Profile Image</DialogTitle>
                        <DialogDescription>
                            Upload or generate a profile image for your agent.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {agentData && agentData.id && (
                        <div className="py-4">
                            <AgentProfileImageEditor 
                                agentId={agentData.id} 
                                currentAvatarUrl={agentData.avatar_url}
                                onAvatarUpdate={handleAvatarUpdate}
                            />
                        </div>
                    )}
                    
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            <Dialog open={showInstructionsModal} onOpenChange={setShowInstructionsModal}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Agent Instructions</DialogTitle>
                        <DialogDescription>
                            Define how your agent should behave and interact.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4">
                       <AgentFormInstructions
                           systemInstructions={agentData.system_instructions || ''}
                           assistantInstructions={agentData.assistant_instructions || ''}
                           handleEditorChange={handleEditorChange}
                       />
                    </div>
                    
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button onClick={() => setShowInstructionsModal(false)}>
                                Done
                            </Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            <Dialog open={showDatastoreModal} onOpenChange={setShowDatastoreModal}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Connect Datastores</DialogTitle>
                        <DialogDescription>
                            Connect your agent to knowledge bases to enhance its capabilities.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4">
                       <AgentDatastoreSelector
                           agentId={agentId}
                           availableDatastores={availableDatastores}
                           selectedVectorStore={selectedVectorStore}
                           selectedKnowledgeStore={selectedKnowledgeStore}
                           onSelectDatastore={(type, value) => {
                               if (type === 'vector') {
                                   setSelectedVectorStore(value);
                               } else {
                                   setSelectedKnowledgeStore(value);
                               }
                           }}
                           onConnectDatastores={async () => {
                               // Save the datastore connections here
                               toast.success("Datastore connections updated!");
                           }}
                           loadingAvailable={loading}
                           connecting={false}
                           onDatastoresUpdated={async () => {
                               // Refresh available datastores
                               const { data: stores, error: dsError } = await supabase
                                   .from('datastores')
                                   .select('*')
                                   .eq('user_id', user.id);
                               if (!dsError) {
                                   setAvailableDatastores(stores || []);
                               }
                           }}
                       />
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AgentEditPage; 