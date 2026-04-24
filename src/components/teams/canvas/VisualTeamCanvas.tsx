import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import type { VisualTeamCanvasProps } from './types/canvas';
import { VisualTeamCanvasContent } from './VisualTeamCanvasContent';

// Main component with ReactFlow provider
export const VisualTeamCanvas: React.FC<VisualTeamCanvasProps> = ({
  isOpen,
  onClose,
  ...props
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0">
        <VisuallyHidden>
          <DialogTitle>Team Organization Canvas</DialogTitle>
        </VisuallyHidden>
        <div className="h-full overflow-hidden">
          <ReactFlowProvider>
            <VisualTeamCanvasContent {...props} onClose={onClose} isOpen={isOpen} />
          </ReactFlowProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
};
