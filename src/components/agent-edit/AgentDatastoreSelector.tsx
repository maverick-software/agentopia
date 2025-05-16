import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Datastore } from '@/types';
import { Label } from '@/components/ui/label';
import { Loader2, Database } from 'lucide-react';

// Define component props
interface AgentDatastoreSelectorProps {
  agentId: string | undefined; // Needed for connecting
  availableDatastores: Datastore[];
  selectedVectorStore: string | undefined;
  selectedKnowledgeStore: string | undefined;
  onSelectDatastore: (type: 'vector' | 'knowledge', value: string) => void;
  onConnectDatastores: () => Promise<void>; // Handler to connect
  loadingAvailable: boolean; // Loading state for available datastores
  connecting: boolean; // Loading state for connection process
}

export const AgentDatastoreSelector: React.FC<AgentDatastoreSelectorProps> = ({
  agentId,
  availableDatastores,
  selectedVectorStore,
  selectedKnowledgeStore,
  onSelectDatastore,
  onConnectDatastores,
  loadingAvailable,
  connecting
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter datastores by type for selects
  const vectorStores = availableDatastores.filter(ds => ds.type === 'pinecone'); // Assuming pinecone
  const knowledgeStores = availableDatastores.filter(ds => ds.type === 'getzep'); // Assuming getzep

  const handleConnectClick = async () => {
    await onConnectDatastores();
    setIsModalOpen(false); // Close modal after attempting connection
  };

  return (
    <div className="space-y-2">
      <Label>Datastore Connections</Label>
      <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
        <div className="text-sm space-y-1">
          <p>Vector: {selectedVectorStore ? availableDatastores.find(d => d.id === selectedVectorStore)?.name || selectedVectorStore.substring(0, 8)+'...' : 'None'}</p>
          <p>Knowledge: {selectedKnowledgeStore ? availableDatastores.find(d => d.id === selectedKnowledgeStore)?.name || selectedKnowledgeStore.substring(0, 8)+'...' : 'None'}</p>
        </div>
        <Button 
          variant="outline"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          disabled={loadingAvailable || !agentId} // Disable if no agentId (create mode) or still loading
        >
          <Database className="mr-2 h-4 w-4" />
          Manage
        </Button>
      </div>

      {/* Datastore Selection Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Connect Datastores</DialogTitle>
            <DialogDescription>
              Select vector and knowledge datastores for this agent.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {loadingAvailable ? (
              <p className="text-center text-muted-foreground">Loading datastores...</p>
            ) : (
              <>
                {/* Vector Datastore Select */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="vectorStore" className="text-right">
                    Vector
                  </Label>
                  <Select 
                    value={selectedVectorStore || ''}
                    onValueChange={(value) => onSelectDatastore('vector', value)}
                    disabled={connecting}
                  >
                    <SelectTrigger id="vectorStore" className="col-span-3">
                      <SelectValue placeholder="Select Pinecone store..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {vectorStores.map(ds => (
                        <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Knowledge Datastore Select */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="knowledgeStore" className="text-right">
                    Knowledge
                  </Label>
                  <Select 
                    value={selectedKnowledgeStore || ''}
                    onValueChange={(value) => onSelectDatastore('knowledge', value)}
                    disabled={connecting}
                  >
                    <SelectTrigger id="knowledgeStore" className="col-span-3">
                      <SelectValue placeholder="Select Zep store..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {knowledgeStores.map(ds => (
                        <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={connecting}>
                Cancel
              </Button>
            </DialogClose>
            <Button 
              type="button" 
              onClick={handleConnectClick} 
              disabled={connecting || loadingAvailable}
            >
              {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}; 