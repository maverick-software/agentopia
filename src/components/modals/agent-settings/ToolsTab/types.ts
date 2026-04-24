import type { LucideIcon } from 'lucide-react';
import type { TabRef } from '../types';

export interface ToolsTabProps {
  agentId: string;
  agentData?: any;
  onAgentUpdated?: (updatedData: any) => void;
}

export interface ToolSettings {
  voice_enabled: boolean;
  web_search_enabled: boolean;
  document_creation_enabled: boolean;
  ocr_processing_enabled: boolean;
  temporary_chat_links_enabled: boolean;
}

export interface CredentialModalState {
  isOpen: boolean;
  toolType: 'voice' | 'web_search' | 'document_creation' | 'ocr_processing' | 'temporary_chat_links' | null;
  selectedProvider: string;
  availableProviders: ProviderConfig[];
  availableCredentials: any[];
}

export interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  requiresApiKey: boolean;
  requiresOAuth: boolean;
}

export interface ToolItem {
  id: keyof ToolSettings;
  name: string;
  description: string;
  icon: LucideIcon;
  enabled: boolean;
  toolType: 'voice' | 'web_search' | 'document_creation' | 'ocr_processing' | 'temporary_chat_links';
  availableCredentials: any[];
  usesSystemKey: boolean;
}

export type ToolsTabRef = TabRef;
