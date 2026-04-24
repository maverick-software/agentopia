import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { ArrowLeft, ArrowRight, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ManualWizardSteps } from './ManualWizardSteps';
import { StepIndicator } from './StepIndicator';
import { AgentData } from './types';

interface ManualWizardContentProps {
  open: boolean;
  step: number;
  creating: boolean;
  generatingDescription: boolean;
  generatingImage: boolean;
  agentData: AgentData;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onBack: () => void;
  onNext: () => Promise<void>;
  onUpdateAgentData: (updates: Partial<AgentData>) => void;
  onEnhanceWithAI: () => Promise<void>;
  onGenerateRandomAttributes: () => void;
}

export function ManualWizardContent({
  open,
  step,
  creating,
  generatingDescription,
  generatingImage,
  agentData,
  onOpenChange,
  onClose,
  onBack,
  onNext,
  onUpdateAgentData,
  onEnhanceWithAI,
  onGenerateRandomAttributes,
}: ManualWizardContentProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 flex flex-col w-full max-w-[800px] translate-x-[-50%] translate-y-[-50%] border bg-background shadow-lg duration-200 rounded-xl border-border dark:border-border max-h-[90vh] h-[90vh]">
          <VisuallyHidden.Root>
            <DialogPrimitive.Title>Create New Agent</DialogPrimitive.Title>
            <DialogPrimitive.Description>
              A multi-step wizard to create and customize your AI agent with tools, themes, and personality settings.
            </DialogPrimitive.Description>
          </VisuallyHidden.Root>

          <div className="absolute top-4 right-4 z-10">
            <DialogPrimitive.Close
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="flex-shrink-0">
            <StepIndicator step={step} />
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-6">
              <ManualWizardSteps
                step={step}
                agentData={agentData}
                generatingDescription={generatingDescription}
                onUpdateAgentData={onUpdateAgentData}
                onEnhanceWithAI={onEnhanceWithAI}
                onGenerateRandomAttributes={onGenerateRandomAttributes}
              />
            </div>
          </div>

          <div className="flex-shrink-0 px-6 py-4 border-t border-border dark:border-border bg-background dark:bg-background rounded-b-xl">
            <div className="flex justify-between">
              <Button variant="outline" onClick={step === 1 ? onClose : onBack} disabled={creating || generatingDescription || generatingImage}>
                {step === 1 ? 'Cancel' : (<><ArrowLeft className="w-4 h-4 mr-2" />Back</>)}
              </Button>
              <Button onClick={onNext} disabled={creating || generatingDescription || generatingImage} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {generatingDescription ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                ) : creating || generatingImage ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating Agent...</>
                ) : step === 5 ? (
                  'Create Agent'
                ) : (
                  <>Next<ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
