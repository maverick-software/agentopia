import React, { useState, useEffect } from 'react';
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
  FolderOpen,
  Users,
  Library,
  GitBranch,
  Zap,
  UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import tab content components
import { GeneralTab } from './agent-settings/GeneralTab';
import { ScheduleTab } from './agent-settings/ScheduleTab';
import { IdentityTab } from './agent-settings/IdentityTab';
import { BehaviorTab } from './agent-settings/BehaviorTab';
import { MemoryTab } from './agent-settings/MemoryTab';
import { MediaTab } from './agent-settings/MediaTab';
import { ToolsTab } from './agent-settings/ToolsTab';
import { ChannelsTab } from './agent-settings/ChannelsTab';
import { SourcesTab } from './agent-settings/SourcesTab';
import { TeamTab } from './agent-settings/TeamTab';
import ContactsTab from './agent-settings/ContactsTab';
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

type TabId = 'general' | 'schedule' | 'identity' | 'behavior' | 'memory' | 'media' | 'tools' | 'channels' | 'sources' | 'team' | 'contacts' | 'workflows' | 'automations' | 'zapier-mcp';

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  disabled?: boolean;
  comingSoon?: boolean;
  standOut?: boolean;
}

const TABS: TabConfig[] = [
  {
    id: 'general',
    label: 'General',
    icon: Settings,
    description: 'Name, role, and description'
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
    description: 'Context and knowledge sources'
  },
  {
    id: 'media',
    label: 'Media',
    icon: Library,
    description: 'SOPs and knowledge documents'
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
    id: 'sources',
    label: 'Sources',
    icon: FolderOpen,
    description: 'Cloud storage connections'
  },
  {
    id: 'team',
    label: 'Team',
    icon: Users,
    description: 'Team assignments and collaboration'
  },
  {
    id: 'contacts',
    label: 'Contacts',
    icon: UserCheck,
    description: 'Contact access and permissions'
  },
  {
    id: 'zapier-mcp',
    label: 'Zapier MCP',
    icon: Zap,
    description: 'MCP server connections and tools'
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: Calendar,
    description: 'Tasks and automation',
    standOut: true
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: GitBranch,
    description: 'Process automation and task flows',
    disabled: true,
    comingSoon: true
  },
  {
    id: 'automations',
    label: 'Automations',
    icon: Zap,
    description: 'Automated actions and triggers',
    disabled: true,
    comingSoon: true
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
      case 'media':
        return <MediaTab {...commonProps} />;
      case 'tools':
        return <ToolsTab {...commonProps} />;
      case 'channels':
        return <ChannelsTab {...commonProps} />;
      case 'sources':
        return <SourcesTab {...commonProps} />;
      case 'team':
        return <TeamTab {...commonProps} />;
      case 'contacts':
        return <ContactsTab agent={{ id: agentId, name: agentData?.name || 'Agent', user_id: '' }} />;
      case 'zapier-mcp':
        return <ZapierMCPTab {...commonProps} />;
      default:
        return <GeneralTab {...commonProps} />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-[900px] translate-x-[-50%] translate-y-[-50%] gap-0 border bg-background p-0 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-xl border-border dark:border-border max-h-[90vh]">
        <DialogHeader className="px-6 py-4 border-b border-border dark:border-border bg-background dark:bg-background rounded-t-xl">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-foreground dark:text-foreground">
              Agent Settings
            </DialogTitle>
            <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
        </DialogHeader>

        <div className="flex min-h-[500px] max-h-[calc(90vh-80px)] rounded-b-xl overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="w-56 border-r border-border dark:border-border bg-muted/30 dark:bg-muted/30">
            <div className="h-full overflow-y-auto">
              <div className="p-3 space-y-0.5">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const isDisabled = tab.disabled;
                  const isStandOut = tab.standOut;
                  
                  const tabButton = (
                    <button
                      key={tab.id}
                      onClick={() => !isDisabled && handleTabChange(tab.id)}
                      disabled={isDisabled}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors",
                        isDisabled
                          ? "opacity-50 cursor-not-allowed text-muted-foreground"
                          : isStandOut
                          ? isActive
                            ? "bg-primary dark:bg-primary text-primary-foreground dark:text-primary-foreground"
                            : "hover:bg-muted dark:hover:bg-muted text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                          : isActive
                          ? "bg-primary dark:bg-primary text-primary-foreground dark:text-primary-foreground"
                          : "hover:bg-muted dark:hover:bg-muted text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Icon className={cn(
                          "h-4 w-4",
                          isStandOut && !isActive && "text-blue-600 dark:text-blue-400"
                        )} />
                        <div className={cn(
                          "font-medium text-sm",
                          isStandOut && "font-semibold"
                        )}>
                          {tab.label}
                        </div>
                        {tab.comingSoon && (
                          <div className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            Soon
                          </div>
                        )}
                      </div>
                      {isActive && !isDisabled && (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  );

                  if (tab.comingSoon && isDisabled) {
                    return (
                      <TooltipProvider key={tab.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {tabButton}
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Coming Soon</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  }

                  return tabButton;
                })}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col bg-background dark:bg-background overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
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
