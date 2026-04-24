import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSupabaseClient } from '../../../../hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { AgentTasksManager } from '@/components/agent-edit/AgentTasksManager';
import { ToolExecutionHistory } from '@/components/ToolExecutionHistory';
import { AgentIntegrationsManager } from '@/integrations/agent-management';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Agent } from '@/types';
import type { Datastore } from '@/types';
import { AgentBasicsSection } from './AgentBasicsSection';
import { AgentEditDialogs } from './AgentEditDialogs';
import { KnowledgeConnectionsCard } from './KnowledgeConnectionsCard';

export default function AgentEditPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const isEditing = agentId && agentId !== 'new';
  const isCreating = agentId === 'new';

  const [agentData, setAgentData] = useState<Partial<Agent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableDatastores, setAvailableDatastores] = useState<Datastore[]>([]);
  const [selectedVectorStore, setSelectedVectorStore] = useState<string | undefined>(undefined);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showDatastoreModal, setShowDatastoreModal] = useState(false);
  const [showVectorModal, setShowVectorModal] = useState(false);
  const [showCreateDatastoreModal, setShowCreateDatastoreModal] = useState(false);
  const [createDatastoreType, setCreateDatastoreType] = useState<'pinecone' | null>(null);
  const [connecting] = useState(false);
  const [loadingAvailableDatastores] = useState(false);
  const [showProfileImageModal, setShowProfileImageModal] = useState(false);

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      if (agentData !== null) setAgentData(null);
      return;
    }

    if (isCreating) {
      setAgentData({
        name: '',
        description: '',
        personality: 'helpful',
        active: true,
        system_instructions: '',
        assistant_instructions: '',
        avatar_url: null,
        user_id: user.id,
      });
      setLoading(false);
      return;
    }

    if (!isEditing) {
      setLoading(false);
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
          .select(`*, *`)
          .eq('id', agentId)
          .eq('user_id', user.id)
          .single();

        if (agentError) throw agentError;
        if (!agent) throw new Error('Agent not found or access denied.');

        setAgentData(agent);

        const { data: stores, error: datastoreError } = await supabase
          .from('datastores')
          .select('*')
          .eq('user_id', user.id);
        if (datastoreError) {
          console.error('Error fetching datastores:', datastoreError);
        } else {
          setAvailableDatastores(stores || []);
          if (agent.agent_datastores && stores) {
            const connectedDatastoreIds = agent.agent_datastores.map((connection: any) => connection.datastore_id);
            const vectorStore = stores.find(
              (store) => store.type === 'pinecone' && connectedDatastoreIds.includes(store.id)
            );
            if (vectorStore) setSelectedVectorStore(vectorStore.id);
          }
        }
      } catch (err: any) {
        console.error('[AgentEditPage] Error fetching data:', err);
        setError(err.message);
        setAgentData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAgentAndRelatedData();
  }, [agentId, isCreating, isEditing, supabase, user]);

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setAgentData((prev) => (prev ? { ...prev, [name]: value } : ({ [name]: value } as Partial<Agent>)));
  }, []);

  const handleSelectChange = useCallback((value: string, name: string = 'personality') => {
    setAgentData((prev) => (prev ? { ...prev, [name]: value } : ({ [name]: value } as Partial<Agent>)));
  }, []);

  const handleEditorChange = useCallback((fieldName: string, value: string) => {
    const agentDataKey =
      fieldName === 'system_instructions'
        ? 'system_instructions'
        : fieldName === 'assistant_instructions'
          ? 'assistant_instructions'
          : null;

    if (agentDataKey) {
      setAgentData((prev) =>
        prev ? { ...prev, [agentDataKey]: value } : ({ [agentDataKey]: value } as Partial<Agent>)
      );
    }
  }, []);

  const refreshAgentData = useCallback(async () => {
    if (!agentId || !user?.id) return;

    const { data: updatedAgent, error: fetchError } = await supabase
      .from('agents')
      .select(`*, *`)
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single();
    if (!fetchError && updatedAgent) {
      setAgentData(updatedAgent);
    }
  }, [agentId, supabase, user?.id]);

  const saveDatastoreConnections = useCallback(
    async (vectorStore?: string) => {
      if (!agentId) return;
      await supabase.from('agent_datastores').delete().eq('agent_id', agentId);

      const connections = [];
      if (vectorStore) {
        connections.push({ agent_id: agentId, datastore_id: vectorStore });
      }

      if (connections.length > 0) {
        const { error: insertError } = await supabase.from('agent_datastores').insert(connections);
        if (insertError) throw insertError;
      }
    },
    [agentId, supabase]
  );

  const handleSave = async () => {
    if (!agentId || !user || !agentData) {
      setError('Cannot save, agent data is not available.');
      return;
    }

    setSaving(true);
    setError(null);
    const minDelayPromise = new Promise((resolve) => setTimeout(resolve, 800));

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

      const [{ error: updateError }] = await Promise.all([savePromise, minDelayPromise]);
      if (updateError) throw updateError;

      toast.success('Agent saved successfully!');
      setSaveSuccess(true);
    } catch (err: any) {
      console.error('Save failed:', err);
      setError(`Save failed: ${err.message}`);
      toast.error(`Save failed: ${err.message}`);
      await minDelayPromise;
    } finally {
      setSaving(false);
    }
  };

  const handleDatastoreSelect = async (type: 'vector' | 'knowledge', value?: string) => {
    if (type === 'vector') setSelectedVectorStore(value);
    if (type === 'knowledge') return;
    if (!agentId || !user?.id) return;

    try {
      const currentVector = type === 'vector' ? value : selectedVectorStore;
      await saveDatastoreConnections(currentVector);
      toast.success('Datastore connection updated!');
      await refreshAgentData();
    } catch (err) {
      console.error('Error saving datastore connection:', err);
      toast.error('Failed to update datastore connection');
    }
  };

  const handleVectorStoreSave = async (value?: string) => {
    if (!agentId || !user?.id) return;
    try {
      await saveDatastoreConnections(value);
      setSelectedVectorStore(value);
      toast.success('Vector store connection updated!');
      await refreshAgentData();
    } catch {
      toast.error('Failed to update vector store connection');
    }
  };

  const refreshAvailableDatastores = async () => {
    if (!user?.id) return;
    const { data: stores, error: datastoreError } = await supabase
      .from('datastores')
      .select('*')
      .eq('user_id', user.id);
    if (!datastoreError) {
      setAvailableDatastores(stores || []);
    }
  };

  const getStatusBadge = () => {
    if (!agentData) return null;

    return agentData.active ? (
      <Badge variant="default" className="ml-2 bg-green-500/20 text-green-500 hover:bg-green-500/20">
        Active
      </Badge>
    ) : (
      <Badge variant="secondary" className="ml-2">
        Inactive
      </Badge>
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
          <AlertDescription>{error || 'Agent not found, access denied, or failed to load.'}</AlertDescription>
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
        <Button onClick={handleSave} disabled={saving || loading || !!error} className="w-full sm:w-auto">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : saveSuccess ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Agent
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AgentBasicsSection
          agentId={agentId!}
          agentData={agentData}
          onInputChange={handleInputChange}
          onSelectChange={handleSelectChange}
          onOpenProfileModal={() => setShowProfileImageModal(true)}
          onOpenInstructionsModal={() => setShowInstructionsModal(true)}
        />

        <div className="space-y-6">
          {user && <AgentTasksManager agentId={agentId!} availableTools={[]} />}

          <Card>
            <CardContent className="p-0">
              <AgentIntegrationsManager
                agentId={agentId!}
                category="tool"
                title="Tools"
                description="Connect external tools and services to this agent"
              />
            </CardContent>
          </Card>

          <KnowledgeConnectionsCard
            agentData={agentData}
            availableDatastores={availableDatastores}
            onOpenDatastoreModal={() => setShowDatastoreModal(true)}
            onOpenVectorModal={() => setShowVectorModal(true)}
          />
        </div>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Tool Execution History</CardTitle>
          <CardDescription>View recent tool executions and their results</CardDescription>
        </CardHeader>
        <CardContent>
          <ToolExecutionHistory agentId={agentId!} showFilters={true} showExport={true} maxItems={50} />
        </CardContent>
      </Card>

      <div className="pt-4 mt-6 border-t border-border sm:hidden">
        <Button onClick={handleSave} disabled={saving || loading || !!error} className="w-full">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : saveSuccess ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Agent
            </>
          )}
        </Button>
      </div>

      <AgentEditDialogs
        agentId={agentId}
        agentData={agentData}
        availableDatastores={availableDatastores}
        loading={loading}
        connecting={connecting}
        loadingAvailableDatastores={loadingAvailableDatastores}
        selectedVectorStore={selectedVectorStore}
        showProfileImageModal={showProfileImageModal}
        showInstructionsModal={showInstructionsModal}
        showDatastoreModal={showDatastoreModal}
        showVectorModal={showVectorModal}
        showCreateDatastoreModal={showCreateDatastoreModal}
        createDatastoreType={createDatastoreType}
        setShowProfileImageModal={setShowProfileImageModal}
        setShowInstructionsModal={setShowInstructionsModal}
        setShowDatastoreModal={setShowDatastoreModal}
        setShowVectorModal={setShowVectorModal}
        setShowCreateDatastoreModal={setShowCreateDatastoreModal}
        setCreateDatastoreType={setCreateDatastoreType}
        onEditorChange={handleEditorChange}
        onSelectDatastore={handleDatastoreSelect}
        onDatastoresUpdated={refreshAvailableDatastores}
        onSaveVectorStore={handleVectorStoreSave}
        onDatastoreCreated={refreshAvailableDatastores}
      />
    </div>
  );
}
