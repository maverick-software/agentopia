import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Loader2, 
  Check, 
  Database,
  Brain,
  Plus,
  Lightbulb,
  MessageSquare,
  Library,
  FileText,
  ExternalLink
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import type { Datastore } from '@/types';
import { MediaLibrarySelector } from '../MediaLibrarySelector';

interface MemoryTabProps {
  agentId: string;
  agentData?: {
    name?: string;
    agent_datastores?: { datastore_id: string }[];
  };
  onAgentUpdated?: (updatedData: any) => void;
}

const MEMORY_PREFERENCES = [
  {
    id: 'remember_preferences',
    label: 'Remember your preferences',
    description: 'Your communication style, work patterns, and personal preferences'
  },
  {
    id: 'track_projects',
    label: 'Keep track of ongoing projects',
    description: 'Project status, deadlines, and collaborative work details'
  },
  {
    id: 'learn_conversations',
    label: 'Learn from our conversations',
    description: 'Patterns, insights, and context from our chat history'
  },
  {
    id: 'forget_sessions',
    label: 'Forget after each session',
    description: 'Start fresh each time without remembering previous conversations'
  }
];

export function MemoryTab({ agentId, agentData, onAgentUpdated }: MemoryTabProps) {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Data state
  const [availableDatastores, setAvailableDatastores] = useState<Datastore[]>([]);
  const [connectedDatastores, setConnectedDatastores] = useState<string[]>([]);
  const [memoryPreferences, setMemoryPreferences] = useState<string[]>(['remember_preferences', 'track_projects', 'learn_conversations']);
  const [contextHistorySize, setContextHistorySize] = useState<number>(
    parseInt(localStorage.getItem(`agent_${agentId}_context_size`) || '25')
  );
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingDatastores, setLoadingDatastores] = useState(true);
  const [agentSettings, setAgentSettings] = useState<Record<string, any>>({});
  const [agentMetadata, setAgentMetadata] = useState<Record<string, any>>({});
  const [graphEnabled, setGraphEnabled] = useState<boolean>(false);
  
  // Media Library integration
  const [showMediaLibrarySelector, setShowMediaLibrarySelector] = useState(false);
  const [assignedMediaCount, setAssignedMediaCount] = useState(0);

  // Load available datastores and current connections
  useEffect(() => {
    if (user) {
      loadDatastores();
      loadAssignedMediaCount();
    }
  }, [user]);

  // Load agent settings
  useEffect(() => {
    const loadAgentSettings = async () => {
      if (!agentId) return;
      try {
        const { data, error } = await supabase
          .from('agents')
          .select('metadata')
          .eq('id', agentId)
          .maybeSingle();
        
        if (error) {
          console.warn('Error loading agent metadata:', error);
          setAgentMetadata({});
          setAgentSettings({});
          setGraphEnabled(false);
          return;
        }
        
        const meta = (data?.metadata || {}) as Record<string, any>;
        setAgentMetadata(meta);
        const settings = (meta.settings || {}) as Record<string, any>;
        setAgentSettings(settings);
        setGraphEnabled(settings.use_account_graph === true);
      } catch (err) {
        console.warn('Error in loadAgentSettings:', err);
        setAgentMetadata({});
        setAgentSettings({});
        setGraphEnabled(false);
      }
    };
    loadAgentSettings();
  }, [agentId, supabase]);

  // Initialize connected datastores from agent data
  useEffect(() => {
    if (agentData?.agent_datastores) {
      const connected = agentData.agent_datastores.map(ad => ad.datastore_id);
      setConnectedDatastores(connected);
    }
  }, [agentData]);

  const loadDatastores = async () => {
    if (!user) return;
    
    setLoadingDatastores(true);
    try {
      const { data, error } = await supabase
        .from('datastores')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvailableDatastores(data || []);
    } catch (error) {
      console.error('Error loading datastores:', error);
      toast.error('Failed to load datastores');
    } finally {
      setLoadingDatastores(false);
    }
  };

  const loadAssignedMediaCount = async () => {
    if (!user || !agentId) return;
    
    try {
      const { count, error } = await supabase
        .from('agent_media_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentId)
        .eq('user_id', user.id);

      if (error) throw error;
      setAssignedMediaCount(count || 0);
    } catch (error) {
      console.error('Error loading assigned media count:', error);
    }
  };

  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    
    setLoading(true);
    
    try {
      // Save datastore connections
      const { error: deleteError } = await supabase
        .from('agent_datastores')
        .delete()
        .eq('agent_id', agentId);

      if (deleteError) throw deleteError;

      if (connectedDatastores.length > 0) {
        const connections = connectedDatastores.map(datastoreId => ({
          agent_id: agentId,
          datastore_id: datastoreId,
          user_id: user.id
        }));

        const { error: insertError } = await supabase
          .from('agent_datastores')
          .insert(connections);

        if (insertError) throw insertError;
      }

      // Save agent metadata
      const updatedMetadata = {
        ...agentMetadata,
        settings: {
          ...agentSettings,
          use_account_graph: graphEnabled,
          memory_preferences: memoryPreferences,
          context_history_size: contextHistorySize
        }
      };

      const { data, error: updateError } = await supabase
        .from('agents')
        .update({ metadata: updatedMetadata })
        .eq('id', agentId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Save context size to localStorage
      localStorage.setItem(`agent_${agentId}_context_size`, contextHistorySize.toString());

      toast.success('Memory settings updated successfully! 🧠');
      
      if (onAgentUpdated) {
        onAgentUpdated(data);
      }
      
    } catch (error: any) {
      console.error('Error updating memory settings:', error);
      toast.error('Failed to update memory settings');
    } finally {
      setLoading(false);
    }
  }, [agentId, user, connectedDatastores, agentMetadata, agentSettings, graphEnabled, memoryPreferences, contextHistorySize, supabase, onAgentUpdated]);

  const getDatastoresByType = (type: string) => {
    return availableDatastores.filter(ds => ds.type === type);
  };

  const handleDatastoreToggle = (datastoreId: string) => {
    setConnectedDatastores(prev => 
      prev.includes(datastoreId)
        ? prev.filter(id => id !== datastoreId)
        : [...prev, datastoreId]
    );
  };

  const handleMemoryPreferenceToggle = (preferenceId: string) => {
    setMemoryPreferences(prev => 
      prev.includes(preferenceId)
        ? prev.filter(id => id !== preferenceId)
        : [...prev, preferenceId]
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Memory & Knowledge</h3>
        <p className="text-sm text-muted-foreground">
          Configure context, knowledge sources, and documents for your agent.
        </p>
      </div>

      {/* Context Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Context & History</span>
          </CardTitle>
          <CardDescription>
            Control how much conversation history your agent remembers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Context History Size: {contextHistorySize} messages</Label>
            </div>
            <Slider
              value={[contextHistorySize]}
              onValueChange={(value) => setContextHistorySize(value[0])}
              max={100}
              min={5}
              step={5}
              className="w-full max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              Higher values allow longer conversations but may increase response time and cost.
            </p>
          </div>

          <div className="space-y-4">
            <Label className="text-base">Memory Preferences</Label>
            {MEMORY_PREFERENCES.map((pref) => (
              <div key={pref.id} className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{pref.label}</Label>
                  <div className="text-xs text-muted-foreground">{pref.description}</div>
                </div>
                <Switch
                  checked={memoryPreferences.includes(pref.id)}
                  onCheckedChange={() => handleMemoryPreferenceToggle(pref.id)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Knowledge Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Knowledge Sources</span>
          </CardTitle>
          <CardDescription>
            Connect datastores to enhance your agent's knowledge
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingDatastores ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading datastores...
            </div>
          ) : (
            <>
              {/* Vector Datastores */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center space-x-2">
                  <Brain className="h-4 w-4" />
                  <span>Vector Datastores (Semantic Search)</span>
                </Label>
                {getDatastoresByType('pinecone').length > 0 ? (
                  <div className="space-y-2">
                    {getDatastoresByType('pinecone').map((datastore) => (
                      <div key={datastore.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium text-sm">{datastore.name}</div>
                          <div className="text-xs text-muted-foreground">{datastore.description}</div>
                        </div>
                        <Switch
                          checked={connectedDatastores.includes(datastore.id)}
                          onCheckedChange={() => handleDatastoreToggle(datastore.id)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted/50">
                    No vector datastores available. Create one to enable semantic search.
                  </div>
                )}
              </div>

              {/* Knowledge Graph */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center space-x-2">
                  <Lightbulb className="h-4 w-4" />
                  <span>Knowledge Graph</span>
                </Label>
                {getDatastoresByType('getzep').length > 0 ? (
                  <div className="space-y-2">
                    {getDatastoresByType('getzep').map((datastore) => (
                      <div key={datastore.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium text-sm">{datastore.name}</div>
                          <div className="text-xs text-muted-foreground">{datastore.description}</div>
                        </div>
                        <Switch
                          checked={connectedDatastores.includes(datastore.id)}
                          onCheckedChange={() => handleDatastoreToggle(datastore.id)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted/50">
                    No knowledge graph datastores available.
                  </div>
                )}
              </div>

              {/* Account Graph Toggle */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Use Account Knowledge Graph</Label>
                  <div className="text-xs text-muted-foreground">
                    Enable access to your account-wide knowledge graph
                  </div>
                </div>
                <Switch
                  checked={graphEnabled}
                  onCheckedChange={setGraphEnabled}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Media Library */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Library className="h-5 w-5" />
            <span>Media Library</span>
          </CardTitle>
          <CardDescription>
            Assign documents and media to your agent's knowledge base
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium text-sm">Assigned Media</div>
                <div className="text-xs text-muted-foreground">
                  {assignedMediaCount} {assignedMediaCount === 1 ? 'item' : 'items'} assigned to this agent
                </div>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMediaLibrarySelector(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Assign Media
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/media', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Library
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Media Library Selector Modal */}
      <MediaLibrarySelector
        isOpen={showMediaLibrarySelector}
        onClose={() => setShowMediaLibrarySelector(false)}
        agentId={agentId}
        onAssignmentComplete={() => {
          setShowMediaLibrarySelector(false);
          loadAssignedMediaCount();
        }}
      />
    </div>
  );
}
