import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '../../../hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext'; 
import { Button } from '@/components/ui/button';
import { 
    Loader2, ArrowLeft, Save, Database, Wrench, 
    Edit, Settings, PencilLine, ImagePlus, Power,
    Info, Plus, Globe
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AgentFormInstructions } from '@/components/agent-edit/AgentFormInstructions';
import { AgentDiscordSettings } from '@/components/agent-edit/AgentDiscordSettings';
import { AgentDatastoreSelector } from '@/components/agent-edit/AgentDatastoreSelector';
import type { Agent } from '@/types/index';
import type { AgentDiscordConnection, Datastore } from '@/types';
import { useAgentDiscordConnection_refactored } from '@/hooks/useAgentDiscordConnection_refactored';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AgentProfileImageEditor } from '@/components/agent-edit/AgentProfileImageEditor';
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

// Import actual API functions
import {
    activateAgentToolEnvironment,
    deactivateAgentToolEnvironment,
    // getAgentToolEnvironmentStatus // Not actively used if status fetched with agent
} from '@/lib/api/toolEnvironments'; // Assuming this path

const AgentEditPage = () => {
    const { agentId } = useParams<{ agentId: string }>();
    const navigate = useNavigate();
    const supabase = useSupabaseClient();
    const { user } = useAuth();

    const {
        connection: discordConnection,
        hasCredentials,
        workerStatus,
        allGuilds,
        isActivating: discordIsActivating,
        isDeactivating: discordIsDeactivating,
        isGeneratingInvite,
        isSavingToken,
        loading: discordLoading,
        error: discordError,
        updateConnectionField,
        saveDiscordBotToken,
        activate: activateDiscord,
        deactivate: deactivateDiscord,
        generateInviteLink,
    } = useAgentDiscordConnection_refactored(agentId);

    const [agentData, setAgentData] = useState<Partial<Agent> | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [availableDatastores, setAvailableDatastores] = useState<Datastore[]>([]); 
    const [selectedVectorStore, setSelectedVectorStore] = useState<string | undefined>(undefined);
    const [selectedKnowledgeStore, setSelectedKnowledgeStore] = useState<string | undefined>(undefined);
    
    const [showInstructionsModal, setShowInstructionsModal] = useState(false);
    const [showDatastoreModal, setShowDatastoreModal] = useState(false);
    const [showProfileImageModal, setShowProfileImageModal] = useState(false);

    // State for Tool Environment
    type ToolEnvStatus = 'inactive' | 'activating' | 'active' | 'deactivating' | 'error' | 'unknown';
    const [toolEnvStatus, setToolEnvStatus] = useState<ToolEnvStatus>('unknown'); // Start with unknown until fetched
    const [toolEnvMessage, setToolEnvMessage] = useState<string | null>(null);
    const [dropletIp, setDropletIp] = useState<string | null>(null);

    const [personalityTemplates, setPersonalityTemplates] = useState<any[]>([
        { id: 'helpful', name: 'Helpful', description: 'Friendly and eager to assist' },
        { id: 'professional', name: 'Professional', description: 'Formal and business-oriented' },
        { id: 'cheerful', name: 'Cheerful', description: 'Upbeat and positive' },
    ]);

    useEffect(() => {
        if (!agentId || !user) {
            setLoading(false); 
            if (agentData !== null) setAgentData(null);
            setToolEnvStatus('inactive'); // Default if no agent/user
            return; 
        }

        const fetchAgentAndRelatedData = async () => {
            setLoading(true);
            setError(null);
            setAgentData(null); 
            setAvailableDatastores([]);
            setToolEnvStatus('unknown'); // Reset while loading
            setDropletIp(null);
            setToolEnvMessage(null);

            try {
                const { data: agent, error: agentError } = await supabase
                    .from('agents')
                    .select(`*, agent_datastores(datastore_id), agent_droplets(status, ip_address)`)
                    .eq('id', agentId)
                    .eq('user_id', user.id)
                    .single();

                if (agentError) throw agentError;
                if (!agent) throw new Error('Agent not found or access denied.');

                setAgentData(agent);

                const dropletInfo = (agent as any).agent_droplets?.[0];
                if (dropletInfo) {
                    switch (dropletInfo.status) {
                        case 'active':
                            setToolEnvStatus('active');
                            setDropletIp(dropletInfo.ip_address);
                            break;
                        case 'creating':
                        case 'pending_creation':
                            setToolEnvStatus('activating');
                            break;
                        case 'deleting':
                        case 'pending_deletion':
                            setToolEnvStatus('deactivating');
                            break;
                        case 'error_creation':
                        case 'error_deletion':
                        case 'unresponsive':
                            setToolEnvStatus('error');
                            setToolEnvMessage(`Droplet is in '${dropletInfo.status}' state.`);
                            break;
                        default:
                            setToolEnvStatus('inactive');
                            break;
                    }
                } else {
                    setToolEnvStatus('inactive');
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
                setAgentData(null);
                setToolEnvStatus('error');
                setToolEnvMessage("Failed to load agent or tool environment data.");
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

    const handleToolEnvironmentToggle = async (activate: boolean) => {
        if (!agentId) {
            toast.error("Agent ID is missing. Cannot manage tool environment.");
            return;
        }

        setToolEnvMessage(null);
        // const originalStatus = toolEnvStatus; // Keep for potential revert logic
        // const originalIp = dropletIp;

        if (activate) {
            setToolEnvStatus('activating');
            setDropletIp(null);
            toast.promise(
                activateAgentToolEnvironment(agentId), // Using imported function
                {
                    loading: 'Activating tool environment...',
                    success: (result: any) => {
                        // Assuming result.data contains { status: string, ip_address?: string }
                        // The Edge function might return the current status from the DB or DO
                        if (result.data?.status === 'active') {
                            setToolEnvStatus('active');
                            setDropletIp(result.data?.ip_address || null);
                        } else {
                            // If not immediately active, remain in 'activating' for polling or next status update
                            setToolEnvStatus('activating'); 
                        }
                        setToolEnvMessage(result.message || 'Activation initiated.');
                        return result.message || 'Activation initiated successfully!';
                    },
                    error: (err: any) => {
                        setToolEnvStatus('error');
                        setToolEnvMessage(err.message || 'Failed to activate tool environment.');
                        return err.message || 'Failed to activate tool environment.';
                    },
                }
            );
        } else {
            setToolEnvStatus('deactivating');
            toast.promise(
                deactivateAgentToolEnvironment(agentId), // Using imported function
                {
                    loading: 'Deactivating tool environment...',
                    success: (result: any) => {
                        setToolEnvStatus('inactive');
                        setDropletIp(null);
                        setToolEnvMessage(result.message || 'Deactivation initiated.');
                        return result.message || 'Deactivation initiated successfully!';
                    },
                    error: (err: any) => {
                        setToolEnvStatus('error');
                        setToolEnvMessage(err.message || 'Failed to deactivate tool environment.');
                        return err.message || 'Failed to deactivate tool environment.';
                    },
                }
            );
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
                    ) : (
                        <><Save className="mr-2 h-4 w-4" />Save Agent</>
                    )}
                </Button>
            </div>

            {error && !toolEnvMessage && (
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
                                className="w-full mt-2"
                            >
                                <PencilLine className="h-4 w-4 mr-2" />
                                Edit Instructions
                            </Button>
                        </CardContent>
                    </Card>

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
                    <Card>
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Discord Connection</CardTitle>
                                <CardDescription>Configure Discord integration</CardDescription>
                            </div>
                            <div className="flex items-center">
                                <Button 
                                    variant={agentData?.active ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleDiscordBotActiveSwitchChange(!agentData?.active, 'active')}
                                    className={`${
                                        agentData?.active 
                                            ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                                            : "text-muted-foreground"
                                    }`}
                                >
                                    <Power className="mr-2 h-4 w-4" />
                                    Bot {agentData?.active ? "Active" : "Inactive"}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {discordError && (
                                <div className="text-sm text-destructive mb-3">
                                    Discord Error: {discordError}
                                </div>
                            )}
                            
                            <AgentDiscordSettings
                                connection={discordConnection}
                                hasCredentials={hasCredentials}
                                workerStatus={workerStatus || 'inactive'}
                                allGuilds={allGuilds}
                                isActivating={discordIsActivating} 
                                isDeactivating={discordIsDeactivating}
                                isGeneratingInvite={isGeneratingInvite}
                                isSavingToken={isSavingToken}
                                discordLoading={discordLoading}
                                discordError={discordError}
                                onConnectionChange={updateConnectionField}
                                saveDiscordBotToken={saveDiscordBotToken}
                                activate={activateDiscord} 
                                deactivate={deactivateDiscord}
                                generateInviteLink={generateInviteLink}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle>Tools & Dedicated Environment</CardTitle>
                            <CardDescription>Manage dedicated environment and tools for this agent.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-2 rounded-md bg-muted/10 hover:bg-muted/20">
                                <Label htmlFor="tool-env-switch" className="font-medium">
                                    Dedicated Tool Environment
                                </Label>
                                <Switch
                                    id="tool-env-switch"
                                    checked={toolEnvStatus === 'active' || toolEnvStatus === 'activating'}
                                    onCheckedChange={handleToolEnvironmentToggle}
                                    disabled={toolEnvStatus === 'activating' || toolEnvStatus === 'deactivating'}
                                />
                            </div>
                            
                            {(toolEnvStatus === 'activating' || toolEnvStatus === 'deactivating') && (
                                <Alert variant="default" className={`border-opacity-50 text-sm ${toolEnvStatus === 'activating' ? 'bg-blue-500/10 border-blue-500 text-blue-700 dark:text-blue-400' : 'bg-orange-500/10 border-orange-500 text-orange-700 dark:text-orange-400'}`}>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2 inline-block" />
                                    <AlertDescription className="inline">
                                        {toolEnvStatus === 'activating' ? 'Activating environment... Please wait.' : 'Deactivating environment...'}
                                    </AlertDescription>
                                </Alert>
                            )}
                            {toolEnvStatus === 'active' && (
                                <Alert variant="default" className="bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-500 text-sm">
                                    <Power className="h-4 w-4 mr-2 inline-block" />
                                    <AlertDescription className="inline">
                                        Environment Active. {dropletIp && `IP: ${dropletIp}`}
                                        {toolEnvMessage && toolEnvMessage !== 'Activation initiated.' && toolEnvMessage !== 'Activated successfully!' && <span className="block text-xs opacity-80 pt-1">{toolEnvMessage}</span>}
                                    </AlertDescription>
                                </Alert>
                            )}
                            {toolEnvStatus === 'inactive' && toolEnvMessage && toolEnvMessage !== 'Deactivation initiated.' && (
                                <Alert variant="default" className="text-sm">
                                    <Info className="h-4 w-4 mr-2 inline-block" />
                                    <AlertDescription className="inline">{toolEnvMessage}</AlertDescription>
                                </Alert>
                            )}
                            {toolEnvStatus === 'error' && toolEnvMessage && (
                                <Alert variant="destructive" className="text-sm">
                                    <AlertTitle>Error</AlertTitle>
                                    <AlertDescription>{toolEnvMessage}</AlertDescription>
                                </Alert>
                            )}

                            {toolEnvStatus === 'active' && (
                                <div className="pt-4 mt-2 border-t border-border">
                                    <p className="text-sm text-muted-foreground mb-3">Manage installed tools on the droplet:</p>
                                    <div className="text-center py-4 text-muted-foreground bg-muted/20 rounded-md">
                                        <Wrench className="h-8 w-8 mx-auto opacity-40 mb-2" />
                                        <p className="text-xs">Tool management coming soon.</p>
                                    </div>
                                </div>
                            )}
                            {(toolEnvStatus === 'inactive' || toolEnvStatus === 'unknown') && !toolEnvMessage && (
                                 <p className="text-sm text-muted-foreground text-center py-3">Activate the dedicated environment to manage and run agent-specific tools.</p>
                            )}
                             {toolEnvStatus === 'unknown' && (
                                <Alert variant="default" className="text-sm">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2 inline-block" />
                                    <AlertDescription className="inline">Checking tool environment status...</AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Integrations</CardTitle>
                                <CardDescription>Connect external services and tools</CardDescription>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => navigate('/integrations')}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Integration
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-6 text-muted-foreground">
                                <Globe className="h-10 w-10 mx-auto opacity-50 mb-2" />
                                <p>No integrations configured</p>
                                <p className="text-xs mt-1">Add credentials and assign tools to this agent</p>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="mt-4"
                                    onClick={() => navigate('/integrations')}
                                >
                                    Browse Integrations
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle>Agent Settings</CardTitle>
                            <CardDescription>Configure advanced agent options</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-6 text-muted-foreground">
                                <Settings className="h-10 w-10 mx-auto opacity-50 mb-2" />
                                <p>Advanced settings coming soon</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="pt-4 mt-6 border-t border-border sm:hidden">
                <Button 
                    onClick={handleSave} 
                    disabled={saving || loading || !!error} 
                    className="w-full"
                >
                    {saving ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
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
                           onSelectDatastore={() => {}}
                            onConnectDatastores={async () => {
                                setShowDatastoreModal(false);
                                toast("Datastores connected!");
                            }}
                           loadingAvailable={false}
                           connecting={false}
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