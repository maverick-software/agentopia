import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

import { 
  User, 
  Brain, 
  Database, 
  Settings,
  X,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import existing modal content components (we'll create these)
import { IdentityTab } from './agent-settings/IdentityTab';
import { BehaviorTab } from './agent-settings/BehaviorTab';
import { MemoryTab } from './agent-settings/MemoryTab';
import { AdvancedReasoningTab } from './agent-settings/AdvancedReasoningTab';

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
  initialTab?: 'identity' | 'behavior' | 'memory' | 'reasoning';
}

type TabId = 'identity' | 'behavior' | 'memory' | 'reasoning';

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const TABS: TabConfig[] = [
  {
    id: 'identity',
    label: 'Identity',
    icon: User,
    description: 'Name, personality, and avatar'
  },
  {
    id: 'behavior',
    label: 'Behavior',
    icon: Brain,
    description: 'Reasoning style and model settings'
  },
  {
    id: 'memory',
    label: 'Memory',
    icon: Database,
    description: 'Knowledge sources and context'
  },
  {
    id: 'reasoning',
    label: 'Advanced Reasoning',
    icon: Settings,
    description: 'Enhanced reasoning capabilities'
  }
];

export function AgentSettingsModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated,
  initialTab = 'identity'
}: AgentSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // Reset to initial tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

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
      case 'identity':
        return <IdentityTab {...commonProps} />;
      case 'behavior':
        return <BehaviorTab {...commonProps} />;
      case 'memory':
        return <MemoryTab {...commonProps} />;
      case 'reasoning':
        return <AdvancedReasoningTab {...commonProps} />;
      default:
        return <IdentityTab {...commonProps} />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              Agent Settings
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex h-[600px]">
          {/* Sidebar Navigation */}
          <div className="w-64 border-r border-border bg-muted/30">
            <div className="h-full overflow-y-auto">
              <div className="p-4 space-y-1">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className="h-4 w-4" />
                        <div>
                          <div className="font-medium text-sm">{tab.label}</div>
                          <div className={cn(
                            "text-xs",
                            isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                          )}>
                            {tab.description}
                          </div>
                        </div>
                      </div>
                      {isActive && (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <div className="p-6">
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
