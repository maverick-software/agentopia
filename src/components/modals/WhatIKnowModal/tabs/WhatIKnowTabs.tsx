import { Check, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MediaLibrarySelector } from '@/components/modals/MediaLibrarySelector';
import type { WhatIKnowModalProps } from '../types';
import { useWhatIKnowModal, useWhatIKnowNavigation } from '../hooks/useWhatIKnowModal';
import { KnowledgeSourcesSection } from '../components/KnowledgeSourcesSection';
import { MemoryPreferencesSection } from '../components/MemoryPreferencesSection';
import { ConversationMemorySection } from '../components/ConversationMemorySection';
import { MediaLibrarySection } from '../components/MediaLibrarySection';
import { KnowledgeSummary } from '../components/KnowledgeSummary';
import { DatastoreSelectionDialogs } from '../components/DatastoreSelectionDialogs';

export function WhatIKnowTabs(props: WhatIKnowModalProps) {
  const { isOpen, onClose, agentId, agentData } = props;
  const state = useWhatIKnowModal(props);
  const navigate = useWhatIKnowNavigation();

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-xl font-semibold flex items-center">📚 Knowledge</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Connect knowledge sources and set memory preferences so I can be most helpful to you.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 space-y-6">
            <KnowledgeSourcesSection
              loadingDatastores={state.loadingDatastores}
              connectedDatastores={state.connectedDatastores}
              getDatastoresByType={state.getDatastoresByType}
              onSelectVectorDatastore={state.handleSelectVectorDatastore}
            />

            <MemoryPreferencesSection
              memoryPreferences={state.memoryPreferences}
              onTogglePreference={state.handleToggleMemoryPreference}
            />

            <ConversationMemorySection
              contextHistorySize={state.contextHistorySize}
              onContextSizeChange={state.handleContextSizeChange}
            />

            <MediaLibrarySection
              assignedMediaCount={state.assignedMediaCount}
              onOpenSelector={() => state.setShowMediaLibrarySelector(true)}
              onManageLibrary={() => navigate('/media')}
            />

            <KnowledgeSummary
              connectedDatastores={state.connectedDatastores}
              memoryPreferences={state.memoryPreferences}
            />
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
            <Button variant="outline" onClick={onClose} disabled={state.loading}>
              Cancel
            </Button>
            <Button onClick={state.handleSave} disabled={state.loading || !state.hasChanges()} className="min-w-[140px]">
              {state.loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : state.saved ? (
                <Check className="mr-2 h-4 w-4" />
              ) : null}
              {state.loading ? 'Saving...' : state.saved ? 'Saved!' : 'Update My Knowledge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaLibrarySelector
        isOpen={state.showMediaLibrarySelector}
        onClose={() => state.setShowMediaLibrarySelector(false)}
        agentId={agentId}
        agentName={agentData?.name}
        onMediaAssigned={(assignedMedia) => {
          state.setAssignedMediaCount((prev) => prev + assignedMedia.length);
          toast.success(`Assigned ${assignedMedia.length} document${assignedMedia.length !== 1 ? 's' : ''} from Media Library`);
        }}
        multiSelect={true}
        assignmentType="training_data"
      />

      <DatastoreSelectionDialogs
        showVectorSelection={state.showVectorSelection}
        setShowVectorSelection={state.setShowVectorSelection}
        getDatastoresByType={state.getDatastoresByType}
        onVectorSelect={state.handleVectorDatastoreSelect}
        onNavigateToMemory={() => {
          state.setShowVectorSelection(false);
          onClose();
          navigate('/memory');
        }}
      />
    </>
  );
}
