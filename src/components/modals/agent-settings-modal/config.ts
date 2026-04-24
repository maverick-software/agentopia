import React from 'react';
import {
  Calendar,
  Database,
  FolderOpen,
  GitBranch,
  Image,
  Library,
  MessageSquare,
  Settings,
  UserCheck,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import { MCPIcon } from '@/components/ui/mcp-icon';

export type TabId =
  | 'general'
  | 'schedule'
  | 'identity'
  | 'behavior'
  | 'memory'
  | 'media'
  | 'tools'
  | 'channels'
  | 'sources'
  | 'team'
  | 'contacts'
  | 'workflows'
  | 'automations'
  | 'zapier-mcp';

export interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  disabled?: boolean;
  comingSoon?: boolean;
  standOut?: boolean;
}

export const SYSTEM_AGENT_DISABLED_TABS: TabId[] = [
  'general',
  'identity',
  'behavior',
  'team',
  'schedule',
  'workflows',
  'automations',
];

export const TABS: TabConfig[] = [
  { id: 'general', label: 'General', icon: Settings, description: 'Language model and description' },
  { id: 'identity', label: 'Identity', icon: Image, description: 'Name, avatar, and personality' },
  { id: 'behavior', label: 'Behavior', icon: MessageSquare, description: 'System instructions' },
  { id: 'tools', label: 'Capabilities', icon: Wrench, description: 'Voice, web search, and creation' },
  { id: 'memory', label: 'Memory', icon: Database, description: 'Context and knowledge sources' },
  { id: 'media', label: 'Documents', icon: Library, description: 'SOPs and knowledge documents' },
  { id: 'channels', label: 'Channels', icon: MessageSquare, description: 'Email, SMS, and messaging' },
  { id: 'sources', label: 'Sources', icon: FolderOpen, description: 'Cloud storage connections' },
  { id: 'team', label: 'Team', icon: Users, description: 'Team assignments and collaboration' },
  { id: 'contacts', label: 'Contacts', icon: UserCheck, description: 'Contact access and permissions' },
  {
    id: 'zapier-mcp',
    label: 'MCP',
    icon: MCPIcon,
    description: 'Model Context Protocol server connections',
    standOut: false,
  },
  { id: 'schedule', label: 'Schedule', icon: Calendar, description: 'Tasks and automation', standOut: true },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: GitBranch,
    description: 'Process automation and task flows',
    disabled: true,
    comingSoon: true,
  },
  {
    id: 'automations',
    label: 'Automations',
    icon: Zap,
    description: 'Automated actions and triggers',
    disabled: true,
    comingSoon: true,
  },
];
