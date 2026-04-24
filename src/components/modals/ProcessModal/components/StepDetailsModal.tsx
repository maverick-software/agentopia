import React from 'react';
import { X } from 'lucide-react';

interface StepDetailsModalProps {
  isOpen: boolean;
  selectedStep: any | null;
  onClose: () => void;
}

export const StepDetailsModal: React.FC<StepDetailsModalProps> = ({ isOpen, selectedStep, onClose }) => {
  if (!isOpen || !selectedStep) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="text-sm font-semibold text-foreground">
            Reasoning Step #{selectedStep.step} - {selectedStep.state || selectedStep.type}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm text-foreground">
          {selectedStep.question && (
            <div>
              <div className="font-medium text-foreground">Question</div>
              <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{selectedStep.question}</div>
            </div>
          )}
          {selectedStep.hypothesis && (
            <div>
              <div className="font-medium text-foreground">Hypothesis</div>
              <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{selectedStep.hypothesis}</div>
            </div>
          )}
          {(selectedStep.action || selectedStep.observation) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="font-medium text-foreground">Action</div>
                <pre className="mt-1 bg-muted border border-border rounded p-2 text-xs overflow-auto text-foreground">
                  {JSON.stringify(selectedStep.action, null, 2)}
                </pre>
              </div>
              <div>
                <div className="font-medium text-foreground">Observation</div>
                <pre className="mt-1 bg-muted border border-border rounded p-2 text-xs overflow-auto text-foreground">
                  {JSON.stringify(selectedStep.observation, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t flex justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded bg-gray-900 text-white hover:bg-black">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
