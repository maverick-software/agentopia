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
  ChevronRight,
  Calendar,
  Image,
  MessageSquare,
  Wrench,
  Mail,
  Plug,
  FolderOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import tab content components
import { GeneralTab } from './agent-settings/GeneralTab';
import { ScheduleTab } from './agent-settings/ScheduleTab';
import { IdentityTab } from './agent-settings/IdentityTab';
import { BehaviorTab } from './agent-settings/BehaviorTab';
import { MemoryTab } from './agent-settings/MemoryTab';
import { ToolsTab } from './agent-settings/ToolsTab';
import { ChannelsTab } from './agent-settings/ChannelsTab';
import { IntegrationsTab } from './agent-settings/IntegrationsTab';
import { SourcesTab } from './agent-settings/SourcesTab';

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
  initialTab?: 'general' | 'schedule' | 'identity' | 'behavior' | 'memory' | 'tools' | 'channels' | 'integrations' | 'sources';
}

type TabId = 'general' | 'schedule' | 'identity' | 'behavior' | 'memory' | 'tools' | 'channels' | 'integrations' | 'sources';

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const TABS: TabConfig[] = [
  {
    id: 'general',
    label: 'General',
    icon: Settings,
    description: 'Name, role, and description'
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: Calendar,
    description: 'Tasks and automation'
  },
  {
    id: 'identity',
    label: 'Identity',
    icon: Image,
    description: 'Avatar, model, and personality'
  },
  {
    id: 'behavior',
    label: 'Behavior',
    icon: Brain,
    description: 'Reasoning and instructions'
  },
  {
    id: 'memory',
    label: 'Memory',
    icon: Database,
    description: 'Context, knowledge, and documents'
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: Wrench,
    description: 'Voice, web search, and creation'
  },
  {
    id: 'channels',
    label: 'Channels',
    icon: MessageSquare,
    description: 'Email, SMS, and messaging'
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: Plug,
    description: 'Third-party connections'
  },
  {
    id: 'sources',
    label: 'Sources',
    icon: FolderOpen,
    description: 'Cloud storage connections'
  }
];

export function AgentSettingsModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated,
  initialTab = 'general'
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
      case 'general':
        return <GeneralTab {...commonProps} />;
      case 'schedule':
        return <ScheduleTab {...commonProps} />;
      case 'identity':
        return <IdentityTab {...commonProps} />;
      case 'behavior':
        return <BehaviorTab {...commonProps} />;
      case 'memory':
        return <MemoryTab {...commonProps} />;
      case 'tools':
        return <ToolsTab {...commonProps} />;
      case 'channels':
        return <ChannelsTab {...commonProps} />;
      case 'integrations':
        return <IntegrationsTab {...commonProps} />;
      case 'sources':
        return <SourcesTab {...commonProps} />;
      default:
        return <GeneralTab {...commonProps} />;
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
                        <div className="font-medium text-sm">{tab.label}</div>
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
