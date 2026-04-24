import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AgentDatastoreSelector } from '@/components/agent-edit/AgentDatastoreSelector';
import { AgentFormInstructions } from '@/components/agent-edit/AgentFormInstructions';
import { CreateDatastoreModal } from '@/components/agent-edit/CreateDatastoreModal';
import { VectorStoreModal } from '@/components/agent-edit/VectorStoreModal';
import type { Datastore } from '@/types';

interface AgentEditDialogsProps {
  agentId?: string;
  agentData: any;
  availableDatastores: Datastore[];
  loading: boolean;
  connecting: boolean;
  loadingAvailableDatastores: boolean;
  selectedVectorStore?: string;
  showProfileImageModal: boolean;
  showInstructionsModal: boolean;
  showDatastoreModal: boolean;
  showVectorModal: boolean;
  showCreateDatastoreModal: boolean;
  createDatastoreType: 'pinecone' | null;
  setShowProfileImageModal: (open: boolean) => void;
  setShowInstructionsModal: (open: boolean) => void;
  setShowDatastoreModal: (open: boolean) => void;
  setShowVectorModal: (open: boolean) => void;
  setShowCreateDatastoreModal: (open: boolean) => void;
  setCreateDatastoreType: (type: 'pinecone' | null) => void;
  onEditorChange: (fieldName: string, value: string) => void;
  onSelectDatastore: (type: 'vector' | 'knowledge', value?: string) => Promise<void>;
  onDatastoresUpdated: () => Promise<void>;
  onSaveVectorStore: (value?: string) => Promise<void>;
  onDatastoreCreated: () => Promise<void>;
}

export function AgentEditDialogs({
  agentId,
  agentData,
  availableDatastores,
  loading,
  connecting,
  loadingAvailableDatastores,
  selectedVectorStore,
  showProfileImageModal,
  showInstructionsModal,
  showDatastoreModal,
  showVectorModal,
  showCreateDatastoreModal,
  createDatastoreType,
  setShowProfileImageModal,
  setShowInstructionsModal,
  setShowDatastoreModal,
  setShowVectorModal,
  setShowCreateDatastoreModal,
  setCreateDatastoreType,
  onEditorChange,
  onSelectDatastore,
  onDatastoresUpdated,
  onSaveVectorStore,
  onDatastoreCreated,
}: AgentEditDialogsProps) {
  return (
    <>
      <Dialog open={showProfileImageModal} onOpenChange={setShowProfileImageModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agent Profile Image</DialogTitle>
            <DialogDescription>Upload or generate a profile image for your agent.</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto">
                {agentData?.avatar_url ? (
                  <img
                    src={agentData.avatar_url}
                    alt={agentData.name || 'Agent'}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-2xl font-medium">
                      {agentData?.name?.charAt(0)?.toUpperCase() || 'A'}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Avatar management has moved to the unified Agent Settings.
                </p>
                <p className="text-xs text-muted-foreground">
                  Go to the agent chat page and click the brain icon → Identity to manage avatars.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInstructionsModal} onOpenChange={setShowInstructionsModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agent Instructions</DialogTitle>
            <DialogDescription>Define how your agent should behave and interact.</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <AgentFormInstructions
              systemInstructions={agentData.system_instructions || ''}
              assistantInstructions={agentData.assistant_instructions || ''}
              handleEditorChange={onEditorChange}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button onClick={() => setShowInstructionsModal(false)}>Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDatastoreModal} onOpenChange={setShowDatastoreModal}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Connect Datastores</DialogTitle>
            <DialogDescription>
              Connect your agent to knowledge bases to enhance its capabilities.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <AgentDatastoreSelector
              agentId={agentId}
              availableDatastores={availableDatastores}
              selectedVectorStore={selectedVectorStore}
              onSelectDatastore={onSelectDatastore}
              onConnectDatastores={async () => {}}
              loadingAvailable={loading}
              connecting={false}
              onDatastoresUpdated={onDatastoresUpdated}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VectorStoreModal
        isOpen={showVectorModal}
        onOpenChange={setShowVectorModal}
        vectorStores={availableDatastores.filter((store) => store.type === 'pinecone')}
        selectedVectorStore={selectedVectorStore}
        onSelectDatastore={onSaveVectorStore}
        onCreateNew={() => {
          setCreateDatastoreType('pinecone');
          setShowCreateDatastoreModal(true);
          setShowVectorModal(false);
        }}
        connecting={connecting}
        loadingAvailable={loadingAvailableDatastores}
      />

      <CreateDatastoreModal
        isOpen={showCreateDatastoreModal}
        onOpenChange={setShowCreateDatastoreModal}
        type={createDatastoreType}
        onSuccess={async () => {
          await onDatastoreCreated();
          if (createDatastoreType === 'pinecone') setShowVectorModal(true);
          setCreateDatastoreType(null);
        }}
      />
    </>
  );
}
