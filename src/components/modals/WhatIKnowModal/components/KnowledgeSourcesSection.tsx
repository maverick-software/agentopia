import React from 'react';
import { Database, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import type { Datastore } from '@/types';

interface KnowledgeSourcesSectionProps {
  loadingDatastores: boolean;
  connectedDatastores: string[];
  getDatastoresByType: (type: 'pinecone') => Datastore[];
  onSelectVectorDatastore: () => void;
}

export const KnowledgeSourcesSection: React.FC<KnowledgeSourcesSectionProps> = ({
  loadingDatastores,
  connectedDatastores,
  getDatastoresByType,
  onSelectVectorDatastore,
}) => {
  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">What topics am I expert in?</Label>
      {loadingDatastores ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading knowledge sources...</span>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <VectorDatastoreCard
            connectedDatastores={connectedDatastores}
            getDatastoresByType={getDatastoresByType}
            onClick={onSelectVectorDatastore}
          />
        </div>
      )}
    </div>
  );
};

function VectorDatastoreCard({
  connectedDatastores,
  getDatastoresByType,
  onClick,
}: {
  connectedDatastores: string[];
  getDatastoresByType: (type: 'pinecone') => Datastore[];
  onClick: () => void;
}) {
  const vectorDatastores = getDatastoresByType('pinecone');
  const connectedVector = vectorDatastores.find((ds) => connectedDatastores.includes(ds.id));

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-4 text-center transition-all duration-200 cursor-pointer ${
        connectedVector
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
          : 'border-muted-foreground/25 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/10'
      }`}
      onClick={onClick}
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
          <p className="text-xs text-muted-foreground">
            {vectorDatastores.length > 0
              ? 'Click to select a Pinecone datastore'
              : 'Click to create a new Pinecone datastore'}
          </p>
        </>
      )}
    </div>
  );
}
