import { Edit2, Trash2 } from 'lucide-react';
import type { ExtendedDatastore } from '../types';

interface DatastoreCardProps {
  datastore: ExtendedDatastore;
  onEdit: (datastore: ExtendedDatastore) => void;
  onDelete: (id: string) => void;
}

export function DatastoreCard({ datastore, onEdit, onDelete }: DatastoreCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-semibold">{datastore.name}</h3>
          <p className="text-muted-foreground text-sm mt-1">{datastore.description}</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => onEdit(datastore)}
            className="p-2 text-muted-foreground hover:text-primary rounded-md transition-colors"
            title="Edit datastore"
          >
            <Edit2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => onDelete(datastore.id)}
            className="p-2 text-muted-foreground hover:text-destructive rounded-md transition-colors"
            title="Delete datastore"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="pt-4 border-t border-border">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Type:</span>
          <span className="text-foreground capitalize">{datastore.type}</span>
        </div>
        {datastore.type === 'pinecone' && (
          <>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-muted-foreground">Index:</span>
              <span className="text-foreground">{datastore.config.indexName}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-muted-foreground">Region:</span>
              <span className="text-foreground">{datastore.config.region}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-muted-foreground">Dimensions:</span>
              <span className="text-foreground">{datastore.config.dimensions}</span>
            </div>
          </>
        )}
      </div>

      {datastore.agent_datastores && datastore.agent_datastores.length > 0 && (
        <div className="pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Connected to {datastore.agent_datastores.length} agent
            {datastore.agent_datastores.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
