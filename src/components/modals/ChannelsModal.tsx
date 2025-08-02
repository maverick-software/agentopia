import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AgentIntegrationsManager } from '@/components/agent-edit/AgentIntegrationsManager';
import { 
  Loader2, 
  Check
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface ChannelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

// This modal now uses the real AgentIntegrationsManager component for channels

export function ChannelsModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated
}: ChannelsModalProps) {
  const { user } = useAuth();
  
  // UI state
  const [saved, setSaved] = useState(false);

  // Initialize from agent data
  useEffect(() => {
    if (isOpen && agentData) {
      setSaved(false);
    }
  }, [isOpen, agentData]);

  // Clear saved state after 3 seconds
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center">
            💬 Channels
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Set up how we communicate and manage your notification preferences.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6 py-4">
          {/* Use the real AgentIntegrationsManager component for channels */}
          <AgentIntegrationsManager
            agentId={agentId}
            category="channel"
            title="Communication Channels"
            description="Connect external communication channels to this agent"
          />
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}