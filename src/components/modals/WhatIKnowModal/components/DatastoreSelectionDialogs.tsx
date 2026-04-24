import { Brain, Database, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface DatastoreSelectionDialogsProps {
  state: any;
  onCloseParent: () => void;
}

export function DatastoreSelectionDialogs({ state, onCloseParent }: DatastoreSelectionDialogsProps) {
  return (
    <>
      <Dialog open={state.showVectorSelection} onOpenChange={state.setShowVectorSelection}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-blue-500" />Select Vector Datastore</DialogTitle>
            <DialogDescription>Choose a Pinecone vector database to connect for semantic search and document embeddings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {state.getDatastoresByType('pinecone').map((datastore: any) => (
              <Card key={datastore.id} className="cursor-pointer transition-all duration-200 hover:bg-accent hover:border-blue-500" onClick={() => state.handleVectorDatastoreSelect(datastore.id)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="font-medium">{datastore.name}</h4>
                      {datastore.description && <p className="text-sm text-muted-foreground">{datastore.description}</p>}
                    </div>
                    <div className="h-2 w-2 bg-green-500 rounded-full" title="Available" />
                  </div>
                </CardContent>
              </Card>
            ))}
            {state.getDatastoresByType('pinecone').length === 0 && (
              <div className="text-center p-6 text-muted-foreground">
                <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No vector datastores available</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => { state.setShowVectorSelection(false); onCloseParent(); state.navigate('/memory'); }}>
                  <Plus className="h-3 w-3 mr-1" />
                  Create Vector Datastore
                </Button>
              </div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => state.setShowVectorSelection(false)}>Cancel</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={state.showKnowledgeSelection} onOpenChange={state.setShowKnowledgeSelection}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-green-500" />Select Knowledge Graph</DialogTitle>
            <DialogDescription>Choose a GetZep knowledge graph to connect for entity relationships and contextual understanding.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {state.getDatastoresByType('getzep').map((datastore: any) => (
              <Card key={datastore.id} className="cursor-pointer transition-all duration-200 hover:bg-accent hover:border-green-500" onClick={() => state.handleKnowledgeDatastoreSelect(datastore.id)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="font-medium">{datastore.name}</h4>
                      {datastore.description && <p className="text-sm text-muted-foreground">{datastore.description}</p>}
                    </div>
                    <div className="h-2 w-2 bg-green-500 rounded-full" title="Available" />
                  </div>
                </CardContent>
              </Card>
            ))}
            {state.getDatastoresByType('getzep').length === 0 && (
              <div className="text-center p-6 text-muted-foreground">
                <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No knowledge graphs available</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => { state.setShowKnowledgeSelection(false); onCloseParent(); state.navigate('/memory'); }}>
                  <Plus className="h-3 w-3 mr-1" />
                  Create Knowledge Graph
                </Button>
              </div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => state.setShowKnowledgeSelection(false)}>Cancel</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
import React from 'react';
import { Brain, Database, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Datastore } from '@/types';

interface DatastoreSelectionDialogsProps {
  showVectorSelection: boolean;
  setShowVectorSelection: (open: boolean) => void;
  showKnowledgeSelection: boolean;
  setShowKnowledgeSelection: (open: boolean) => void;
  getDatastoresByType: (type: 'pinecone' | 'getzep') => Datastore[];
  onVectorSelect: (datastoreId: string) => void;
  onKnowledgeSelect: (datastoreId: string) => void;
  onNavigateToMemory: () => void;
}

export const DatastoreSelectionDialogs: React.FC<DatastoreSelectionDialogsProps> = ({
  showVectorSelection,
  setShowVectorSelection,
  showKnowledgeSelection,
  setShowKnowledgeSelection,
  getDatastoresByType,
  onVectorSelect,
  onKnowledgeSelect,
  onNavigateToMemory,
}) => {
  return (
    <>
      <Dialog open={showVectorSelection} onOpenChange={setShowVectorSelection}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-500" />
              Select Vector Datastore
            </DialogTitle>
            <DialogDescription>Choose a Pinecone vector database to connect.</DialogDescription>
          </DialogHeader>
          <DatastoreOptions
            datastores={getDatastoresByType('pinecone')}
            icon={<Database className="h-3 w-3" />}
            label="Pinecone Vector Database"
            onSelect={onVectorSelect}
            onNavigateToMemory={onNavigateToMemory}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVectorSelection(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showKnowledgeSelection} onOpenChange={setShowKnowledgeSelection}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-green-500" />
              Select Knowledge Graph
            </DialogTitle>
            <DialogDescription>Choose a GetZep knowledge graph to connect.</DialogDescription>
          </DialogHeader>
          <DatastoreOptions
            datastores={getDatastoresByType('getzep')}
            icon={<Brain className="h-3 w-3" />}
            label="GetZep Knowledge Graph"
            onSelect={onKnowledgeSelect}
            onNavigateToMemory={onNavigateToMemory}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKnowledgeSelection(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

function DatastoreOptions({
  datastores,
  icon,
  label,
  onSelect,
  onNavigateToMemory,
}: {
  datastores: Datastore[];
  icon: React.ReactNode;
  label: string;
  onSelect: (datastoreId: string) => void;
  onNavigateToMemory: () => void;
}) {
  if (datastores.length === 0) {
    return (
      <div className="text-center p-6 text-muted-foreground">
        <p>No datastores available</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={onNavigateToMemory}>
          <Plus className="h-3 w-3 mr-1" />
          Create Datastore
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {datastores.map((datastore) => (
        <Card
          key={datastore.id}
          className="cursor-pointer transition-all duration-200 hover:bg-accent"
          onClick={() => onSelect(datastore.id)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h4 className="font-medium">{datastore.name}</h4>
                {datastore.description && <p className="text-sm text-muted-foreground">{datastore.description}</p>}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {icon}
                  <span>{label}</span>
                </div>
              </div>
              <div className="h-2 w-2 bg-green-500 rounded-full" title="Available" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
