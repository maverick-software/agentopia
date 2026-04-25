import { Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Datastore } from '@/types';

interface KnowledgeConnectionsCardProps {
  agentData: any;
  availableDatastores: Datastore[];
  onOpenDatastoreModal: () => void;
  onOpenVectorModal: () => void;
  onOpenKnowledgeModal: () => void;
}

export function KnowledgeConnectionsCard({
  agentData,
  availableDatastores,
  onOpenDatastoreModal,
  onOpenVectorModal,
  onOpenKnowledgeModal,
}: KnowledgeConnectionsCardProps) {
  const agentDatastores = agentData?.agent_datastores;
  const connectedDatastoreIds = Array.isArray(agentDatastores)
    ? agentDatastores.map((connection: any) => connection.datastore_id)
    : [];
  const connectedVectorStore = availableDatastores.find(
    (store) => store.type === 'pinecone' && connectedDatastoreIds.includes(store.id)
  );
  const connectedKnowledgeStore = availableDatastores.find(
    (store) => store.type === 'getzep' && connectedDatastoreIds.includes(store.id)
  );

  return (
    <Card>
      <CardHeader className="pb-4 flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>Knowledge</CardTitle>
          <CardDescription>Connect to knowledge bases</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenDatastoreModal}>
          <Database className="h-4 w-4 mr-2" />
          Connect Datastores
        </Button>
      </CardHeader>
      <CardContent className="pt-2 pb-6 min-h-[200px]">
        <div className="space-y-3">
          {connectedVectorStore ? (
            <div
              className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border transition-colors hover:bg-muted cursor-pointer"
              onClick={onOpenVectorModal}
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{connectedVectorStore.name}</p>
                  <p className="text-xs text-muted-foreground">Vector Store</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge
                  variant="secondary"
                  className="text-xs px-3 py-1 bg-green-500/20 text-green-400 border-green-500/30"
                >
                  Connected
                </Badge>
                <div className="text-slate-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="flex items-center justify-between p-4 border-2 border-dashed border-border rounded-lg bg-muted/20 transition-colors hover:bg-muted/30 cursor-pointer"
              onClick={onOpenVectorModal}
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <Database className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Vector Store</p>
                  <p className="text-xs text-muted-foreground">Add vector datastore</p>
                </div>
              </div>
              <div className="text-muted-foreground">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>
          )}

          {connectedKnowledgeStore ? (
            <div
              className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border transition-colors hover:bg-muted cursor-pointer"
              onClick={onOpenKnowledgeModal}
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{connectedKnowledgeStore.name}</p>
                  <p className="text-xs text-muted-foreground">Knowledge Graph</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge
                  variant="secondary"
                  className="text-xs px-3 py-1 bg-green-500/20 text-green-400 border-green-500/30"
                >
                  Connected
                </Badge>
                <div className="text-muted-foreground">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="flex items-center justify-between p-4 border-2 border-dashed border-border rounded-lg bg-muted/20 transition-colors hover:bg-muted/30 cursor-pointer"
              onClick={onOpenKnowledgeModal}
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <Database className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Knowledge Store</p>
                  <p className="text-xs text-muted-foreground">Add Knowledge Graph</p>
                </div>
              </div>
              <div className="text-muted-foreground">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
