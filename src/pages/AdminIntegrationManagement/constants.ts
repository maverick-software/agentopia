import { AlertCircle, CheckCircle } from 'lucide-react';

export const hiddenProviders = [
  'brave_search',
  'brave_search_api',
  'contact_management',
  'conversation_memory',
  'internal_system',
  'temporary_chat_internal',
  'google',
  'microsoft',
  'ocr_space',
  'ocrspace',
  'openai',
  'serpapi',
  'serp_api',
  'mistral_ai',
  'serper_api',
];

export const statusBadgeConfig = {
  enabled: {
    className: 'bg-success/10 text-success border border-success/20',
    label: 'Enabled',
    Icon: CheckCircle,
  },
  disabled: {
    className: 'bg-destructive/10 text-destructive border border-destructive/20',
    label: 'Disabled',
    Icon: AlertCircle,
  },
};
