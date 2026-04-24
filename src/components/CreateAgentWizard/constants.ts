import { Bot, MessageSquare, Palette, Settings, User } from 'lucide-react';
import { ToolCapability } from './types';

export const THEMES = [
  { id: 'professional', name: 'Professional', description: 'Business attire, confident pose' },
  { id: 'business-casual', name: 'Business Casual', description: 'Smart casual, approachable' },
  { id: 'futuristic', name: 'Futuristic', description: 'Sci-fi, high-tech aesthetic' },
  { id: 'alien', name: 'Alien', description: 'Otherworldly, unique features' },
  { id: 'animal', name: 'Animal', description: 'Anthropomorphic animal character' },
  { id: 'custom', name: 'Custom', description: 'Your own creative vision' },
];

export const MBTI_TYPES = [
  { type: 'INTJ', name: 'The Architect', description: 'Imaginative and strategic thinkers' },
  { type: 'INTP', name: 'The Thinker', description: 'Innovative inventors with unquenchable thirst for knowledge' },
  { type: 'ENTJ', name: 'The Commander', description: 'Bold, imaginative and strong-willed leaders' },
  { type: 'ENTP', name: 'The Debater', description: 'Smart and curious thinkers who love intellectual challenges' },
  { type: 'INFJ', name: 'The Advocate', description: 'Creative and insightful, inspired and independent' },
  { type: 'INFP', name: 'The Mediator', description: 'Poetic, kind and altruistic, always eager to help' },
  { type: 'ENFJ', name: 'The Protagonist', description: 'Charismatic and inspiring leaders' },
  { type: 'ENFP', name: 'The Campaigner', description: 'Enthusiastic, creative and sociable free spirits' },
  { type: 'ISTJ', name: 'The Logistician', description: 'Practical and fact-minded, reliable and responsible' },
  { type: 'ISFJ', name: 'The Protector', description: 'Warm-hearted and dedicated, always ready to protect loved ones' },
  { type: 'ESTJ', name: 'The Executive', description: 'Excellent administrators, unsurpassed at managing things or people' },
  { type: 'ESFJ', name: 'The Consul', description: 'Extraordinarily caring, social and popular people' },
  { type: 'ISTP', name: 'The Virtuoso', description: 'Bold and practical experimenters, masters of all kinds of tools' },
  { type: 'ISFP', name: 'The Adventurer', description: 'Flexible and charming artists, always ready to explore new possibilities' },
  { type: 'ESTP', name: 'The Entrepreneur', description: 'Smart, energetic and perceptive, truly enjoy living on the edge' },
  { type: 'ESFP', name: 'The Entertainer', description: 'Spontaneous, energetic and enthusiastic people' },
];

export const HAIR_COLORS = ['Black', 'Brown', 'Blonde', 'Red', 'Gray', 'White', 'Blue', 'Purple', 'Green'];
export const EYE_COLORS = ['Brown', 'Blue', 'Green', 'Hazel', 'Gray', 'Amber', 'Violet', 'Red'];

export const AVAILABLE_TOOLS: ToolCapability[] = [
  {
    id: 'email',
    name: 'Email',
    description: 'Send and manage emails',
    category: 'Communication',
    requiresAuth: true,
    authType: 'oauth',
  },
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Search the internet for information',
    category: 'Research',
    requiresAuth: false,
  },
  {
    id: 'document_creation',
    name: 'Document Creation',
    description: 'Create, edit, and manage documents',
    category: 'Productivity',
    requiresAuth: false,
  },
  {
    id: 'sms',
    name: 'SMS',
    description: 'Send and receive text messages',
    category: 'Communication',
    requiresAuth: true,
    authType: 'api_key',
    comingSoon: true,
  },
  {
    id: 'voice',
    name: 'Voice',
    description: 'Voice calls and audio processing',
    category: 'Communication',
    requiresAuth: true,
    authType: 'api_key',
    comingSoon: true,
  },
];

export const WIZARD_STEPS = [
  { id: 1, title: 'Name', description: 'Agent Name', icon: Bot, key: 'name' },
  { id: 2, title: 'Purpose', description: 'What should this agent be good at?', icon: MessageSquare, key: 'purpose' },
  { id: 3, title: 'Tools', description: 'Select agent capabilities', icon: Settings, key: 'tools' },
  { id: 4, title: 'Theme', description: 'Choose appearance theme', icon: Palette, key: 'theme' },
  { id: 5, title: 'Customize', description: 'Physical attributes & personality', icon: User, key: 'customize' },
];
