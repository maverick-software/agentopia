import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/useMediaQuery';

import { 
  Settings,
  X,
  Save,
  Check,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TabNavigation } from './agent-settings-modal/TabNavigation';
import { SYSTEM_AGENT_DISABLED_TABS, TABS, TabConfig, TabId } from './agent-settings-modal/config';

// Import tab content components
import { GeneralTab } from './agent-settings/GeneralTab';
import { ScheduleTab } from './agent-settings/ScheduleTab';
import { IdentityTab } from './agent-settings/IdentityTab';
import { BehaviorTab } from './agent-settings/BehaviorTab';
// Removed: ReasoningTab - archived 2025-10-17
import { MemoryTab } from './agent-settings/MemoryTab';
import { MediaTab } from './agent-settings/MediaTab';
import { ToolsTab } from './agent-settings/ToolsTab';
import { ChannelsTab } from './agent-settings/ChannelsTab';
import { SourcesTab } from './agent-settings/SourcesTab';
import { TeamTab } from './agent-settings/TeamTab';
import ContactsTab from './agent-settings/ContactsTab';
import { TabRef } from './agent-settings/types';
import { ZapierMCPTab } from './agent-settings/ZapierMCPTab';

interface AgentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
    description?: string;
    personality?: string;
    avatar_url?: string;
    agent_datastores?: { datastore_id: string }[];
  };
  onAgentUpdated?: (updatedData: any) => void;
  initialTab?: 'general' | 'schedule' | 'identity' | 'behavior' | 'memory' | 'media' | 'tools' | 'channels' | 'sources' | 'team' | 'contacts' | 'workflows' | 'automations' | 'zapier-mcp';
}

export function AgentSettingsModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated,
  initialTab = 'general'
}: AgentSettingsModalProps) {
  const { isAdmin } = useAuth();
  const isMobile = useIsMobile();
  // Check if this is a system agent (like Gofr)
  const isSystemAgent = agentData?.metadata?.is_system_agent === true;
  
  // If system agent and initial tab is disabled, default to first allowed tab
  const getInitialTab = () => {
    // For system agents, check if user is admin
    if (isSystemAgent && !isAdmin && SYSTEM_AGENT_DISABLED_TABS.includes(initialTab)) {
      // Non-admin users can't access restricted tabs, find first allowed tab
      const allowedTab = TABS.find(tab => 
        !tab.disabled && 
        !SYSTEM_AGENT_DISABLED_TABS.includes(tab.id)
      );
      return allowedTab?.id || 'memory'; // Fallback to 'memory' if nothing found
    }
    // Admin users or non-system agents always use the requested initial tab
    return initialTab;
  };
  
  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab());
  
  // Create refs for all tabs that support saving
  const tabRefs = useRef<Record<string, React.RefObject<TabRef>>>({
    general: React.createRef<TabRef>(),
    identity: React.createRef<TabRef>(),
    behavior: React.createRef<TabRef>(),
    reasoning: React.createRef<TabRef>(),
    tools: React.createRef<TabRef>(),
    contacts: React.createRef<TabRef>(),
  });
  
  // Legacy refs for backward compatibility
  const [forceUpdate, setForceUpdate] = useState(0);

  // Reset to initial tab when modal opens (respecting system agent restrictions)
  useEffect(() => {
    if (isOpen) {
      setActiveTab(getInitialTab());
    }
  }, [isOpen, initialTab, isSystemAgent]);

  // Poll for changes in tabs to update save button visibility
  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        setForceUpdate(prev => prev + 1);
      }, 300); // Poll every 300ms for responsive save button
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Handle save button click - works for any tab with a ref
  const handleSave = async () => {
    const currentTabRef = tabRefs.current[activeTab];
    if (currentTabRef?.current?.save) {
      await currentTabRef.current.save();
    }
  };

  // Get current tab ref
  const currentTabRef = tabRefs.current[activeTab];
  
  // Determine if current tab has save functionality
  const canSave = currentTabRef?.current?.hasChanges ?? false;
  const isSaving = currentTabRef?.current?.saving ?? false;
  const saveSuccess = currentTabRef?.current?.saveSuccess ?? false;

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
  };

  const renderTabContent = () => {
    const commonProps = {
      agentId,
      agentData,
      onAgentUpdated,
    };

    switch (activeTab) {
      case 'general':
        return <GeneralTab ref={tabRefs.current.general} {...commonProps} />;
      case 'schedule':
        return <ScheduleTab {...commonProps} />;
      case 'identity':
        return <IdentityTab ref={tabRefs.current.identity} {...commonProps} />;
      case 'behavior':
        return <BehaviorTab ref={tabRefs.current.behavior} {...commonProps} />;
      // Removed: Reasoning case - archived 2025-10-17
      case 'memory':
        return <MemoryTab {...commonProps} />;
      case 'media':
        return <MediaTab {...commonProps} />;
      case 'tools':
        return <ToolsTab ref={tabRefs.current.tools} {...commonProps} />;
      case 'channels':
        return <ChannelsTab {...commonProps} />;
      case 'sources':
        return <SourcesTab {...commonProps} />;
      case 'team':
        return <TeamTab {...commonProps} />;
      case 'contacts':
        return <ContactsTab ref={tabRefs.current.contacts} agent={{ id: agentId, name: agentData?.name || 'Agent', user_id: '' }} />;
      case 'zapier-mcp':
        return <ZapierMCPTab {...commonProps} />;
      default:
        return <GeneralTab ref={tabRefs.current.general} {...commonProps} />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content 
          className={cn(
            "fixed z-50 grid w-full gap-0 border bg-background p-0 shadow-lg duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            isMobile
              ? "inset-0 h-screen-mobile" // Full screen on mobile
              : "left-[50%] top-[50%] max-w-[900px] translate-x-[-50%] translate-y-[-50%] rounded-xl border-border dark:border-border max-h-[90vh] data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          )}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
        <DialogHeader className={cn(
          "bg-background dark:bg-background safe-area-top",
          isMobile ? "px-4 py-3 sticky top-0 z-10 border-b border-border" : "px-6 py-4 rounded-t-xl"
        )}>
          <div className="flex items-center justify-between">
            <DialogTitle className={cn(
              "font-semibold text-foreground dark:text-foreground",
              isMobile ? "text-base" : "text-lg"
            )}>
              Agent Settings
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* Save icon - always visible, subdued when no changes */}
              {(activeTab === 'general' || activeTab === 'identity' || activeTab === 'behavior' || activeTab === 'tools' || activeTab === 'contacts') && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleSave}
                        disabled={isSaving || saveSuccess || !canSave}
                        size="icon"
                        className={cn(
                          "transition-all duration-300 touch-target",
                          isMobile ? "h-9 w-9" : "h-8 w-8",
                          saveSuccess 
                            ? 'bg-green-600/50 hover:bg-green-600/50 cursor-default' 
                            : canSave 
                              ? 'bg-blue-600 hover:bg-blue-700' 
                              : 'bg-blue-600/30 hover:bg-blue-600/40 cursor-not-allowed'
                        )}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : saveSuccess ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Save className={`h-4 w-4 ${!canSave ? 'opacity-50' : ''}`} />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : !canSave ? 'No changes to save' : 'Save Settings'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <DialogPrimitive.Close className={cn(
                "rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none",
                isMobile && "touch-target p-2"
              )}>
                <X className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
          </div>
        </DialogHeader>

        <div className={cn(
          "flex overflow-hidden",
          isMobile 
            ? "flex-col flex-1" 
            : "min-h-[500px] max-h-[calc(90vh-80px)] rounded-b-xl"
        )}>
          <TabNavigation
            isMobile={isMobile}
            activeTab={activeTab}
            isSystemAgent={isSystemAgent}
            isAdmin={isAdmin}
            onTabChange={handleTabChange}
          />

          {/* Main Content Area */}
          <div className={cn(
            "flex-1 flex flex-col bg-background dark:bg-background overflow-hidden"
          )}>
            <div className={cn(
              "flex-1 overflow-y-auto momentum-scroll",
              isMobile && "pb-safe"
            )}>
              <div className={isMobile ? "p-4 pb-8" : "p-6"}>
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
