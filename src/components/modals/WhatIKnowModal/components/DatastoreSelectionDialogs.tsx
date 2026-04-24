import React from 'react';
import { Database, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Datastore } from '@/types';

interface DatastoreSelectionDialogsProps {
  showVectorSelection: boolean;
  setShowVectorSelection: (open: boolean) => void;
  getDatastoresByType: (type: 'pinecone') => Datastore[];
  onVectorSelect: (datastoreId: string) => void;
  onNavigateToMemory: () => void;
}

export const DatastoreSelectionDialogs: React.FC<DatastoreSelectionDialogsProps> = ({
  showVectorSelection,
  setShowVectorSelection,
  getDatastoresByType,
  onVectorSelect,
  onNavigateToMemory,
}) => {
  const datastores = getDatastoresByType('pinecone');

  return (
    <Dialog open={showVectorSelection} onOpenChange={setShowVectorSelection}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-500" />
            Select Vector Datastore
          </DialogTitle>
          <DialogDescription>Choose a Pinecone vector database to connect.</DialogDescription>
        </DialogHeader>
        {datastores.length === 0 ? (
          <div className="text-center p-6 text-muted-foreground">
            <p>No datastores available</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={onNavigateToMemory}>
              <Plus className="h-3 w-3 mr-1" />
              Create Datastore
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {datastores.map((datastore) => (
              <Card
                key={datastore.id}
                className="cursor-pointer transition-all duration-200 hover:bg-accent"
                onClick={() => onVectorSelect(datastore.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="font-medium">{datastore.name}</h4>
                      {datastore.description ? <p className="text-sm text-muted-foreground">{datastore.description}</p> : null}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Database className="h-3 w-3" />
                        <span>Pinecone Vector Database</span>
                      </div>
                    </div>
                    <div className="h-2 w-2 bg-green-500 rounded-full" title="Available" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowVectorSelection(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
