import { Check, Loader2 } from 'lucide-react';
import { MediaLibrarySelector } from '../MediaLibrarySelector';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';
import { DatastoreSelectionDialogs } from './components/DatastoreSelectionDialogs';
import { useWhatIKnowModalState } from './hooks/useWhatIKnowModalState';
import { WhatIKnowSections } from './tabs/WhatIKnowSections';
import type { WhatIKnowModalProps } from './types';

export function WhatIKnowModal(props: WhatIKnowModalProps) {
  const state = useWhatIKnowModalState(props);

  return (
    <>
      <Dialog open={props.isOpen} onOpenChange={props.onClose}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-xl font-semibold flex items-center">📚 Knowledge</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Connect knowledge sources and set memory preferences so I can be most helpful to you.
            </DialogDescription>
          </DialogHeader>

          <WhatIKnowSections state={state} onOpenMediaLibrary={() => state.setShowMediaLibrarySelector(true)} />

          <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
            <Button variant="outline" onClick={props.onClose} disabled={state.loading}>Cancel</Button>
            <Button onClick={state.handleSave} disabled={state.loading || !state.hasChanges()} className="min-w-[140px]">
              {state.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : state.saved ? <Check className="mr-2 h-4 w-4" /> : null}
              {state.loading ? 'Saving...' : state.saved ? 'Saved!' : 'Update My Knowledge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaLibrarySelector
        isOpen={state.showMediaLibrarySelector}
        onClose={() => state.setShowMediaLibrarySelector(false)}
        agentId={props.agentId}
        agentName={props.agentData?.name}
        onMediaAssigned={(assignedMedia) => {
          state.setAssignedMediaCount((prev: number) => prev + assignedMedia.length);
          toast.success(`Assigned ${assignedMedia.length} document${assignedMedia.length !== 1 ? 's' : ''} from Media Library`);
        }}
        multiSelect={true}
        assignmentType="training_data"
      />

      <DatastoreSelectionDialogs state={state} onCloseParent={props.onClose} />
    </>
  );
}

export type { WhatIKnowModalProps } from './types';
