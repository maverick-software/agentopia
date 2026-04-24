import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { Loader2, Settings, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIQuickSetup } from '../agent-wizard/AIQuickSetup';

interface AIWizardContentProps {
  open: boolean;
  creating: boolean;
  generatingImage: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToManual: () => void;
  onClose: () => void;
  onConfigGenerated: (config: any) => Promise<void>;
}

export function AIWizardContent({
  open,
  creating,
  generatingImage,
  onOpenChange,
  onSwitchToManual,
  onClose,
  onConfigGenerated,
}: AIWizardContentProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 flex flex-col w-full max-w-[800px] translate-x-[-50%] translate-y-[-50%] border bg-background shadow-lg duration-200 rounded-xl border-border dark:border-border max-h-[90vh] h-[90vh]">
          <VisuallyHidden.Root>
            <DialogPrimitive.Title>Create New Agent with AI</DialogPrimitive.Title>
            <DialogPrimitive.Description>
              Use AI to generate your agent configuration by describing what you want in natural language.
            </DialogPrimitive.Description>
          </VisuallyHidden.Root>

          <div className="flex-shrink-0 px-8 py-6 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-semibold">AI Agent Wizard</h2>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={onSwitchToManual} disabled={creating || generatingImage} className="text-sm text-muted-foreground hover:text-foreground">
                  <Settings className="w-4 h-4 mr-2" />
                  Manual Setup
                </Button>
                <DialogPrimitive.Close
                  className="rounded-md p-2 opacity-70 ring-offset-background transition-opacity hover:opacity-100 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-muted"
                  onClick={onClose}
                  disabled={creating || generatingImage}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {(creating || generatingImage) && (
              <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="text-center space-y-6 max-w-md px-6">
                  <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                  <div className="space-y-3">
                    <p className="text-lg font-semibold">{generatingImage ? 'Generating avatar...' : 'Creating your agent...'}</p>
                    <p className="text-sm text-muted-foreground">This may take a few moments</p>
                  </div>
                </div>
              </div>
            )}
            <AIQuickSetup onConfigGenerated={onConfigGenerated} onClose={onClose} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
