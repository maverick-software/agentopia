import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  Loader2, 
  Check, 
  BookOpen,
  Database,
  Brain,
  FileText,
  Network,
  Plus,
  Settings,
  Trash2,
  ExternalLink,
  Lightbulb,
  Archive
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import type { Datastore } from '@/types';

interface WhatIKnowModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
    agent_datastores?: { datastore_id: string }[];
  };
  onAgentUpdated?: (updatedData: any) => void;
}

const KNOWLEDGE_TYPES = {
  pinecone: {
    name: 'Document Library',
    description: 'Research papers, PDFs, and text documents I can search through',
    icon: FileText,
    gradient: 'from-blue-500 to-indigo-600',
    examples: 'Company docs, research papers, manuals'
  },
  getzep: {
    name: 'Memory & Connections',
    description: 'Connected knowledge that helps me understand relationships',
    icon: Network,
    gradient: 'from-purple-500 to-pink-500',
    examples: 'Concept maps, relationship data, structured knowledge'
  }
};

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

export function WhatIKnowModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated
}: WhatIKnowModalProps) {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  
  // Data state
  const [availableDatastores, setAvailableDatastores] = useState<Datastore[]>([]);
  const [connectedDatastores, setConnectedDatastores] = useState<string[]>([]);
  const [memoryPreferences, setMemoryPreferences] = useState<string[]>(['remember_preferences', 'track_projects', 'learn_conversations']);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingDatastores, setLoadingDatastores] = useState(true);
  const [saved, setSaved] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDatastoreName, setNewDatastoreName] = useState('');
  const [newDatastoreDescription, setNewDatastoreDescription] = useState('');
  const [newDatastoreType, setNewDatastoreType] = useState<'pinecone' | 'getzep'>('pinecone');
  const [creatingDatastore, setCreatingDatastore] = useState(false);

  // Load available datastores and current connections
  useEffect(() => {
    if (isOpen && user) {
      loadDatastores();
    }
  }, [isOpen, user]);

  // Initialize connected datastores from agent data
  useEffect(() => {
    if (isOpen && agentData?.agent_datastores) {
      const connected = agentData.agent_datastores.map(ad => ad.datastore_id);
      setConnectedDatastores(connected);
      setSaved(false);
    }
  }, [isOpen, agentData]);

  // Clear saved state after 3 seconds
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const loadDatastores = useCallback(async () => {
    if (!user) return;
    
    setLoadingDatastores(true);
    try {
      const { data: datastores, error } = await supabase
        .from('datastores')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setAvailableDatastores(datastores || []);
    } catch (error: any) {
      console.error('Error loading datastores:', error);
      toast.error('Failed to load knowledge sources');
    } finally {
      setLoadingDatastores(false);
    }
  }, [user, supabase]);

  const handleToggleDatastore = (datastoreId: string) => {
    setConnectedDatastores(prev => 
      prev.includes(datastoreId) 
        ? prev.filter(id => id !== datastoreId)
        : [...prev, datastoreId]
    );
  };

  const handleToggleMemoryPreference = (preferenceId: string) => {
    if (preferenceId === 'forget_sessions') {
      // Exclusive: if forget_sessions is selected, clear all others
      setMemoryPreferences(prev => 
        prev.includes(preferenceId) ? [] : [preferenceId]
      );
    } else {
      // Remove forget_sessions if selecting any other option
      setMemoryPreferences(prev => {
        const filtered = prev.filter(id => id !== 'forget_sessions');
        return filtered.includes(preferenceId)
          ? filtered.filter(id => id !== preferenceId)
          : [...filtered, preferenceId];
      });
    }
  };

  const handleCreateDatastore = useCallback(async () => {
    if (!user || !newDatastoreName.trim()) return;
    
    setCreatingDatastore(true);
    try {
      const { data: newDatastore, error } = await supabase
        .from('datastores')
        .insert([{
          name: newDatastoreName.trim(),
          description: newDatastoreDescription.trim() || `A ${KNOWLEDGE_TYPES[newDatastoreType].name.toLowerCase()} for ${newDatastoreName}`,
          type: newDatastoreType,
          config: {},
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('Knowledge source created! 📚');
      setAvailableDatastores(prev => [...prev, newDatastore]);
      setConnectedDatastores(prev => [...prev, newDatastore.id]);
      setShowCreateModal(false);
      setNewDatastoreName('');
      setNewDatastoreDescription('');
      
    } catch (error: any) {
      console.error('Error creating datastore:', error);
      toast.error('Failed to create knowledge source');
    } finally {
      setCreatingDatastore(false);
    }
  }, [user, newDatastoreName, newDatastoreDescription, newDatastoreType, supabase]);

  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    
    setLoading(true);
    try {
      // Remove all existing connections
      await supabase
        .from('agent_datastores')
        .delete()
        .eq('agent_id', agentId);

      // Add new connections
      if (connectedDatastores.length > 0) {
        const connections = connectedDatastores.map(datastoreId => ({
          agent_id: agentId,
          datastore_id: datastoreId
        }));

        const { error } = await supabase
          .from('agent_datastores')
          .insert(connections);

        if (error) throw error;
      }

      // Here you could also save memory preferences to agent settings/metadata
      // For now, we'll just show success
      
      toast.success('Knowledge connections updated! 🧠');
      setSaved(true);
      
      // Notify parent component
      if (onAgentUpdated) {
        // Fetch updated agent data
        const { data: updatedAgent } = await supabase
          .from('agents')
          .select(`*, agent_datastores(datastore_id)`)
          .eq('id', agentId)
          .single();
          
        if (updatedAgent) {
          onAgentUpdated(updatedAgent);
        }
      }
      
    } catch (error: any) {
      console.error('Error updating knowledge connections:', error);
      toast.error('Failed to update knowledge connections');
    } finally {
      setLoading(false);
    }
  }, [agentId, connectedDatastores, supabase, onAgentUpdated]);

  const getDatastoresByType = (type: 'pinecone' | 'getzep') => {
    return availableDatastores.filter(ds => ds.type === type);
  };

  const hasChanges = () => {
    if (!agentData?.agent_datastores) return connectedDatastores.length > 0;
    const currentConnections = agentData.agent_datastores.map(ad => ad.datastore_id);
    return JSON.stringify(currentConnections.sort()) !== JSON.stringify(connectedDatastores.sort());
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
                      <DialogTitle className="text-xl font-semibold flex items-center">
            📚 Knowledge
          </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Connect knowledge sources and set memory preferences so I can be most helpful to you.
            </DialogDescription>
          </DialogHeader>
          
          <div className="px-6 space-y-6">
            {/* Connected Knowledge Sources */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  What topics am I expert in?
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(true)}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Knowledge Source
                </Button>
              </div>

              {loadingDatastores ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading knowledge sources...</span>
                </div>
              ) : availableDatastores.length === 0 ? (
                <div className="text-center p-8 border border-dashed border-border rounded-lg">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-2">No knowledge sources yet</p>
                  <p className="text-sm text-muted-foreground">Create your first knowledge source to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(KNOWLEDGE_TYPES).map(([type, config]) => {
                    const Icon = config.icon;
                    const datastores = getDatastoresByType(type as 'pinecone' | 'getzep');
                    
                    if (datastores.length === 0) return null;
                    
                    return (
                      <div key={type} className="space-y-2">
                        <div className="flex items-center space-x-2 text-xs font-medium text-muted-foreground">
                          <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                            <Icon className="h-3 w-3 text-white" />
                          </div>
                          <span>{config.name}</span>
                        </div>
                        
                        {datastores.map(datastore => {
                          const isConnected = connectedDatastores.includes(datastore.id);
                          return (
                            <div
                              key={datastore.id}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                                isConnected
                                  ? 'border-primary bg-primary/5 shadow-sm'
                                  : 'border-border hover:border-border'
                              }`}
                            >
                              <div className="flex-1">
                                <div className="font-medium text-sm">{datastore.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {datastore.description}
                                </div>
                              </div>
                              <Switch
                                checked={isConnected}
                                onCheckedChange={() => handleToggleDatastore(datastore.id)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Memory Preferences */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                What should I remember from our chats?
              </Label>
              <div className="space-y-2">
                {MEMORY_PREFERENCES.map(preference => {
                  const isSelected = memoryPreferences.includes(preference.id);
                  const isForgetSessions = preference.id === 'forget_sessions';
                  
                  return (
                    <div
                      key={preference.id}
                      className={`flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? isForgetSessions 
                            ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20'
                            : 'border-primary bg-primary/5'
                          : 'border-border hover:border-border hover:bg-accent/50'
                      }`}
                      onClick={() => handleToggleMemoryPreference(preference.id)}
                    >
                      <Switch
                        checked={isSelected}
                        onCheckedChange={() => handleToggleMemoryPreference(preference.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{preference.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {preference.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            {(connectedDatastores.length > 0 || memoryPreferences.length > 0) && (
              <div className="p-4 bg-muted/50 rounded-lg border border-muted">
                <div className="text-sm font-medium mb-2 flex items-center">
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Summary of my knowledge setup:
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Connected to {connectedDatastores.length} knowledge source{connectedDatastores.length !== 1 ? 's' : ''}</li>
                  <li>• {memoryPreferences.includes('forget_sessions') ? 'Will forget after each session' : `Will remember ${memoryPreferences.length} type${memoryPreferences.length !== 1 ? 's' : ''} of information`}</li>
                </ul>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={loading || !hasChanges()}
              className="min-w-[140px]"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="mr-2 h-4 w-4" />
              ) : null}
              {loading ? 'Saving...' : saved ? 'Saved!' : 'Update My Knowledge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Knowledge Source Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Knowledge Source</DialogTitle>
            <DialogDescription>
              Create a new knowledge source to enhance my capabilities.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="knowledge-type">Type of Knowledge</Label>
              <Select 
                value={newDatastoreType} 
                onValueChange={(value: 'pinecone' | 'getzep') => setNewDatastoreType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KNOWLEDGE_TYPES).map(([type, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center space-x-2">
                          <div className={`w-4 h-4 rounded bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                            <Icon className="h-2.5 w-2.5 text-white" />
                          </div>
                          <span>{config.name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {KNOWLEDGE_TYPES[newDatastoreType].description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="knowledge-name">Name</Label>
              <Input
                id="knowledge-name"
                value={newDatastoreName}
                onChange={(e) => setNewDatastoreName(e.target.value)}
                placeholder="e.g., Company Documentation, Research Papers"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="knowledge-description">Description</Label>
              <Textarea
                id="knowledge-description"
                value={newDatastoreDescription}
                onChange={(e) => setNewDatastoreDescription(e.target.value)}
                placeholder="Describe what this knowledge source contains..."
                className="min-h-[60px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={creatingDatastore}>
              Cancel
            </Button>
            <Button onClick={handleCreateDatastore} disabled={creatingDatastore || !newDatastoreName.trim()}>
              {creatingDatastore ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {creatingDatastore ? 'Creating...' : 'Create Knowledge Source'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}