import { Brain, Database, FileText, Library, Lightbulb, Loader2, MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

interface WhatIKnowSectionsProps {
  state: any;
  onOpenMediaLibrary: () => void;
}

export function WhatIKnowSections({ state, onOpenMediaLibrary }: WhatIKnowSectionsProps) {
  const vectorDatastores = state.getDatastoresByType('pinecone');
  const connectedVector = vectorDatastores.find((ds: any) => state.connectedDatastores.includes(ds.id));

  return (
    <div className="px-6 space-y-6">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">What topics am I expert in?</label>
        </div>

        {state.loadingDatastores ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading knowledge sources...</span>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center transition-all duration-200 cursor-pointer ${connectedVector ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-muted-foreground/25 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/10'}`}
              onClick={state.handleSelectVectorDatastore}
            >
              <Database className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              {connectedVector ? (
                <>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Vector Datastore</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">Connected: {connectedVector.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">Click to change or disconnect</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium mb-1">Vector Datastore</p>
                  <p className="text-xs text-muted-foreground">{vectorDatastores.length > 0 ? 'Click to select a Pinecone datastore' : 'Click to create a new Pinecone datastore'}</p>
                </>
              )}
            </div>

            <div
              className={`border-2 rounded-lg p-4 text-center transition-all duration-200 cursor-pointer ${state.graphEnabled ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-muted-foreground/25 hover:border-green-500/50 hover:bg-green-50/50 dark:hover:bg-green-950/10'}`}
              onClick={state.toggleGraphEnabled}
            >
              <Brain className="h-8 w-8 mx-auto mb-2 text-green-500" />
              {state.graphEnabled ? (
                <>
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">Knowledge Graph Datastore</p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">Enabled (account-wide)</p>
                  <p className="text-xs text-muted-foreground mt-1">Click to disable</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium mb-1">Knowledge Graph Datastore</p>
                  <p className="text-xs text-muted-foreground">Disabled. Click to enable account-wide knowledge graph</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">What should I remember from our chats?</label>
        <div className="space-y-2">
          {state.MEMORY_PREFERENCES.map((preference: any) => {
            const isSelected = state.memoryPreferences.includes(preference.id);
            const isForgetSessions = preference.id === 'forget_sessions';
            return (
              <div
                key={preference.id}
                className={`flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${isSelected ? (isForgetSessions ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20' : 'border-primary bg-primary/5') : 'border-border hover:border-border hover:bg-accent/50'}`}
                onClick={() => state.handleToggleMemoryPreference(preference.id)}
              >
                <Switch checked={isSelected} onCheckedChange={() => state.handleToggleMemoryPreference(preference.id)} className="mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{preference.label}</div>
                  <div className="text-xs text-muted-foreground">{preference.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversation Memory
          </label>
          <p className="text-xs text-muted-foreground mt-1">How many recent messages should I remember from our conversation?</p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Messages to remember:</span>
            <span className="text-sm font-medium bg-primary/10 px-2 py-1 rounded">{state.contextHistorySize} {state.contextHistorySize === 1 ? 'message' : 'messages'}</span>
          </div>
          <Slider value={[state.contextHistorySize]} onValueChange={state.handleContextSizeChange} min={0} max={100} step={5} className="w-full" />
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Media Library Documents</label>
        <Card className="border-2 border-dashed border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20">
          <CardContent className="p-4 text-center">
            <Library className="h-8 w-8 mx-auto mb-2 text-purple-500" />
            <p className="text-sm font-medium mb-1">
              {state.assignedMediaCount > 0 ? `${state.assignedMediaCount} document${state.assignedMediaCount !== 1 ? 's' : ''} assigned` : 'No documents assigned from Media Library'}
            </p>
            <p className="text-xs text-muted-foreground mb-3">Assign documents from your centralized media library for training data</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={onOpenMediaLibrary}>
                <Plus className="h-3 w-3 mr-1" />
                Assign from Library
              </Button>
              <Button variant="outline" size="sm" onClick={() => state.navigate('/media')}>
                <FileText className="h-3 w-3 mr-1" />
                Manage Library
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {(state.connectedDatastores.length > 0 || state.memoryPreferences.length > 0) && (
        <div className="p-4 bg-muted/50 rounded-lg border border-muted">
          <div className="text-sm font-medium mb-2 flex items-center">
            <Lightbulb className="h-4 w-4 mr-2" />
            Summary of my knowledge setup:
          </div>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Connected to {state.connectedDatastores.length} knowledge source{state.connectedDatastores.length !== 1 ? 's' : ''}</li>
            <li>• {state.memoryPreferences.includes('forget_sessions') ? 'Will forget after each session' : `Will remember ${state.memoryPreferences.length} type${state.memoryPreferences.length !== 1 ? 's' : ''} of information`}</li>
          </ul>
        </div>
      )}
    </div>
  );
}
