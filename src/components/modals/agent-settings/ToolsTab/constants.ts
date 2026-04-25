import { FileText, MessageCircle, ScanText, Search, Volume2 } from 'lucide-react';
import type { ProviderConfig, ToolItem, ToolSettings } from './types';

export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  voice_enabled: false,
  web_search_enabled: false,
  document_creation_enabled: false,
  ocr_processing_enabled: false,
  temporary_chat_links_enabled: false,
};

export const PROVIDER_CONFIGS: Record<string, ProviderConfig[]> = {
  ocr_processing: [
    {
      id: 'azure-document-intelligence',
      name: 'Azure Document Intelligence',
      description: "Microsoft's enterprise-grade document analysis and text extraction service",
      requiresApiKey: true,
      requiresOAuth: false,
    },
    {
      id: 'mistral-ocr',
      name: 'Mistral OCR',
      description: 'Advanced AI-powered OCR and document processing with structured output',
      requiresApiKey: true,
      requiresOAuth: false,
    },
  ],
  voice: [
    { id: 'elevenlabs', name: 'ElevenLabs', description: 'High-quality AI voice synthesis', requiresApiKey: true, requiresOAuth: false },
    { id: 'openai_tts', name: 'OpenAI TTS', description: 'OpenAI text-to-speech', requiresApiKey: true, requiresOAuth: false },
    { id: 'azure_speech', name: 'Azure Speech', description: 'Microsoft Azure Speech Services', requiresApiKey: true, requiresOAuth: false },
  ],
  web_search: [
    { id: 'serper_api', name: 'Serper API', description: 'Google Search API via Serper', requiresApiKey: true, requiresOAuth: false },
    { id: 'serpapi', name: 'SerpAPI', description: 'Google Search results API', requiresApiKey: true, requiresOAuth: false },
    { id: 'brave_search', name: 'Brave Search', description: 'Privacy-focused search API', requiresApiKey: true, requiresOAuth: false },
  ],
  document_creation: [
    { id: 'google_docs', name: 'Google Docs', description: 'Create and edit Google Documents', requiresApiKey: false, requiresOAuth: true },
    { id: 'microsoft_office', name: 'Microsoft Office', description: 'Create and edit Office documents', requiresApiKey: false, requiresOAuth: true },
    { id: 'notion', name: 'Notion', description: 'Create and manage Notion pages', requiresApiKey: true, requiresOAuth: false },
  ],
  temporary_chat_links: [
    { id: 'temporary_chat_internal', name: 'Temporary Chat Links', description: 'Create public chat links for anonymous users', requiresApiKey: false, requiresOAuth: false },
  ],
};

export const PROVIDERS_BY_TOOL: Record<string, string[]> = {
  web_search: ['serper_api', 'serpapi', 'brave_search'],
  voice: ['elevenlabs'],
  document_creation: ['google_docs', 'microsoft_office', 'notion'],
  ocr_processing: ['mistral_ai', 'azure-document-intelligence'],
  temporary_chat_links: ['temporary_chat_internal'],
};

export function buildTools(
  settings: ToolSettings,
  getAvailableCredentials: (toolType: string) => any[],
): ToolItem[] {
  return [
    {
      id: 'voice_enabled',
      name: 'Voice Synthesis',
      description: 'Enable text-to-speech capabilities for agent responses',
      icon: Volume2,
      enabled: settings.voice_enabled,
      availableCredentials: getAvailableCredentials('voice'),
      toolType: 'voice',
      usesSystemKey: false,
    },
    {
      id: 'web_search_enabled',
      name: 'Web Search',
      description: 'Allow agent to search the web for current information',
      icon: Search,
      enabled: settings.web_search_enabled,
      availableCredentials: [],
      toolType: 'web_search',
      usesSystemKey: true,
    },
    {
      id: 'document_creation_enabled',
      name: 'Document Creation',
      description: 'Enable agent to create and edit documents, code files, and artifacts (inline preview with Canvas mode)',
      icon: FileText,
      enabled: settings.document_creation_enabled,
      availableCredentials: [],
      toolType: 'document_creation',
      usesSystemKey: false,
    },
    {
      id: 'ocr_processing_enabled',
      name: 'Read Documents',
      description: 'Enable text extraction from PDFs and images',
      icon: ScanText,
      enabled: settings.ocr_processing_enabled,
      availableCredentials: [],
      toolType: 'ocr_processing',
      usesSystemKey: true,
    },
    {
      id: 'temporary_chat_links_enabled',
      name: 'Temporary Chat Links',
      description: 'Create public chat links for anonymous users (employee check-ins, customer support)',
      icon: MessageCircle,
      enabled: settings.temporary_chat_links_enabled,
      availableCredentials: [],
      toolType: 'temporary_chat_links',
      usesSystemKey: false,
    },
  ];
}
