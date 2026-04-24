import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { EYE_COLORS, HAIR_COLORS, MBTI_TYPES } from './constants';
import { AIWizardContent } from './AIWizardContent';
import { ManualWizardContent } from './ManualWizardContent';
import { AgentData, CreateAgentWizardProps } from './types';

export function CreateAgentWizard({ open, onOpenChange }: CreateAgentWizardProps) {
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [showAIWizard, setShowAIWizard] = useState(true);
  const [agentData, setAgentData] = useState<AgentData>({
    name: '',
    purpose: '',
    description: '',
    theme: '',
    mbtiType: '',
    selectedTools: [],
  });

  const supabase = useSupabaseClient();
  const navigate = useNavigate();

  const updateAgentData = (updates: Partial<AgentData>) => {
    setAgentData((prev) => ({ ...prev, ...updates }));
  };

  const resetWizard = () => {
    setStep(1);
    setShowAIWizard(true);
    setAgentData({
      name: '',
      purpose: '',
      description: '',
      theme: '',
      mbtiType: '',
      selectedTools: [],
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    resetWizard();
  };

  const generateDescription = async (purpose: string): Promise<string> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No valid session found');
      const { data, error } = await supabase.functions.invoke('generate-agent-description', {
        body: { purpose, agentName: agentData.name },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Failed to generate description');
      return data.description;
    } catch (error) {
      console.error('Error generating description:', error);
      return `An AI assistant specialized in ${purpose.toLowerCase()}. This agent is designed to provide expert guidance, answer questions, and assist with tasks related to ${purpose.toLowerCase()}. With a focus on accuracy and helpfulness, this agent combines knowledge with practical problem-solving skills.`;
    }
  };

  const generateAgentImage = async (payload: AgentData): Promise<string> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No valid session found');
      const { data, error } = await supabase.functions.invoke('generate-agent-image', {
        body: {
          theme: payload.theme,
          gender: payload.gender,
          hairColor: payload.hairColor,
          eyeColor: payload.eyeColor,
          customInstructions: payload.customInstructions,
          agentName: payload.name,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Failed to generate image');
      return data.imageUrl;
    } catch (error) {
      console.error('Error generating image:', error);
      return 'https://via.placeholder.com/400x400/6366f1/ffffff?text=AI+Agent';
    }
  };

  const createAgent = async (payload: AgentData, aiGenerated = false) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('No valid session found');

    const avatarUrl = payload.avatar_url || await generateAgentImage(payload);
    const { data, error } = await supabase.functions.invoke('create-agent', {
      body: {
        name: payload.name.trim(),
        description: payload.description,
        avatar_url: avatarUrl,
        personality: payload.mbtiType || 'helpful',
        metadata: {
          purpose: payload.purpose,
          theme: payload.theme,
          gender: payload.gender,
          hairColor: payload.hairColor,
          eyeColor: payload.eyeColor,
          mbtiType: payload.mbtiType,
          customInstructions: payload.customInstructions,
          ...(aiGenerated ? { aiGenerated: true } : {}),
        },
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error || !data?.success) throw new Error(error?.message || data?.error || 'Failed to create agent');
    return { agent: data.agent, reasoningGranted: data.reasoning_permissions_granted, avatarUrl };
  };

  const handleAIConfig = async (config: any) => {
    setCreating(true);
    setGeneratingImage(true);
    try {
      const payload: AgentData = {
        name: config.name || '',
        purpose: config.purpose || '',
        description: config.description || '',
        theme: config.theme || 'professional',
        customInstructions: config.customInstructions || '',
        mbtiType: config.mbtiType || '',
        gender: config.gender,
        hairColor: config.hairColor,
        eyeColor: config.eyeColor,
        selectedTools: config.selectedTools || [],
      };

      toast.success('Configuration generated! Creating agent...');
      const result = await createAgent(payload, true);
      toast.success(`${payload.name} created successfully!`);
      if (result.reasoningGranted) {
        toast.success('Advanced reasoning capabilities enabled!', { duration: 3000 });
      }
      onOpenChange(false);
      resetWizard();
      navigate(`/agents/${result.agent.id}/chat`);
    } catch (error: any) {
      console.error('Error creating agent:', error);
      toast.error(`Failed to create agent: ${error.message}`);
    } finally {
      setCreating(false);
      setGeneratingImage(false);
    }
  };

  const handleCreate = async () => {
    if (!agentData.theme) {
      toast.error('Please select a theme for your agent');
      return;
    }
    setCreating(true);
    setGeneratingImage(true);
    try {
      const result = await createAgent(agentData);
      updateAgentData({ avatar_url: result.avatarUrl });
      toast.success(`${agentData.name} created successfully!`);
      if (result.reasoningGranted) {
        toast.success('Advanced reasoning capabilities enabled!', { duration: 3000 });
      }
      onOpenChange(false);
      resetWizard();
      navigate(`/agents/${result.agent.id}/chat`);
    } catch (error: any) {
      console.error('Error creating agent:', error);
      toast.error(`Failed to create agent: ${error.message}`);
    } finally {
      setCreating(false);
      setGeneratingImage(false);
    }
  };

  const handleNext = async () => {
    if (step === 1 && !agentData.name.trim()) return toast.error('Please enter an agent name');
    if (step === 2 && !agentData.purpose.trim()) return toast.error('Please describe what your agent should be good at');
    if (step === 4 && !agentData.theme) return toast.error('Please select a theme');
    if (step === 5) return handleCreate();
    setStep((prev) => prev + 1);
  };

  const handleEnhanceWithAI = async () => {
    if (!agentData.purpose.trim()) {
      toast.error('Please enter a purpose first');
      return;
    }
    setGeneratingDescription(true);
    try {
      const description = await generateDescription(agentData.purpose);
      updateAgentData({ purpose: description });
      toast.success('Enhanced with AI!');
    } catch (error) {
      console.error('Error enhancing with AI:', error);
      toast.error('Failed to enhance with AI. Please try again.');
    } finally {
      setGeneratingDescription(false);
    }
  };

  const generateRandomAttributes = () => {
    updateAgentData({
      gender: Math.random() > 0.5 ? 'female' : 'male',
      hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
      eyeColor: EYE_COLORS[Math.floor(Math.random() * EYE_COLORS.length)],
      mbtiType: MBTI_TYPES[Math.floor(Math.random() * MBTI_TYPES.length)].type,
    });
  };

  if (showAIWizard) {
    return (
      <AIWizardContent
        open={open}
        creating={creating}
        generatingImage={generatingImage}
        onOpenChange={onOpenChange}
        onSwitchToManual={() => setShowAIWizard(false)}
        onClose={handleClose}
        onConfigGenerated={handleAIConfig}
      />
    );
  }

  return (
    <ManualWizardContent
      open={open}
      step={step}
      creating={creating}
      generatingDescription={generatingDescription}
      generatingImage={generatingImage}
      agentData={agentData}
      onOpenChange={onOpenChange}
      onClose={handleClose}
      onBack={() => setStep((prev) => Math.max(1, prev - 1))}
      onNext={handleNext}
      onUpdateAgentData={updateAgentData}
      onEnhanceWithAI={handleEnhanceWithAI}
      onGenerateRandomAttributes={generateRandomAttributes}
    />
  );
}
