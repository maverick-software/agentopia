export interface CreateAgentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface AgentData {
  name: string;
  purpose: string;
  description: string;
  gender?: 'male' | 'female' | 'neutral';
  hairColor?: string;
  eyeColor?: string;
  theme: string;
  customInstructions?: string;
  mbtiType?: string;
  avatar_url?: string;
  selectedTools?: string[];
}

export interface ToolCapability {
  id: string;
  name: string;
  description: string;
  category: string;
  requiresAuth: boolean;
  authType?: 'oauth' | 'api_key';
  comingSoon?: boolean;
}
