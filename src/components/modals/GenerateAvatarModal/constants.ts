import { AvatarOptions } from './types';

export const DEFAULT_AVATAR_OPTIONS: AvatarOptions = {
  gender: 'neutral',
  customGender: '',
  hair: 'brown',
  customHair: '',
  eyes: 'brown',
  customEyes: '',
  ethnicity: 'mixed',
  customEthnicity: '',
  age: 'young_adult',
  style: 'photorealistic',
  customStyle: '',
  theme: 'office',
  customTheme: '',
};

export const RANDOM_OPTION_POOLS = {
  gender: ['male', 'female', 'neutral', 'other'] as const,
  hair: ['blonde', 'brown', 'black', 'red', 'gray', 'other'] as const,
  eyes: ['blue', 'green', 'brown', 'hazel', 'gray', 'other'] as const,
  ethnicity: ['caucasian', 'african', 'asian', 'hispanic', 'middle_eastern', 'mixed', 'other'] as const,
  age: ['young_adult', 'middle_aged', 'elderly'] as const,
  style: ['photorealistic', 'cartoon', '3d_animation', 'other'] as const,
  theme: ['office', 'android', 'alien', 'animal', 'fantasy', 'other'] as const,
};

