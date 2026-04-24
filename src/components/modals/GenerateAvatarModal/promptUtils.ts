import { AvatarOptions } from './types';

const pickRandom = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

export const randomizeAvatarOptions = (
  pools: {
    gender: readonly AvatarOptions['gender'][];
    hair: readonly AvatarOptions['hair'][];
    eyes: readonly AvatarOptions['eyes'][];
    ethnicity: readonly AvatarOptions['ethnicity'][];
    age: readonly AvatarOptions['age'][];
    style: readonly AvatarOptions['style'][];
    theme: readonly AvatarOptions['theme'][];
  },
): AvatarOptions => {
  const gender = pickRandom(pools.gender);
  const hair = pickRandom(pools.hair);
  const eyes = pickRandom(pools.eyes);
  const ethnicity = pickRandom(pools.ethnicity);
  const style = pickRandom(pools.style);
  const theme = pickRandom(pools.theme);

  return {
    gender,
    customGender: gender === 'other' ? 'non-binary' : '',
    hair,
    customHair: hair === 'other' ? 'silver' : '',
    eyes,
    customEyes: eyes === 'other' ? 'amber' : '',
    ethnicity,
    customEthnicity: ethnicity === 'other' ? 'multiracial' : '',
    age: pickRandom(pools.age),
    style,
    customStyle: style === 'other' ? 'watercolor painting style' : '',
    theme,
    customTheme: theme === 'other' ? 'steampunk aesthetic' : '',
  };
};

export const generateAvatarPrompt = (options: AvatarOptions, agentName?: string): string => {
  const parts: string[] = [];
  parts.push(`Professional avatar for ${agentName || 'agent'}`);

  if (options.gender !== 'neutral') {
    const genderText = options.gender === 'other' ? options.customGender : options.gender;
    if (genderText) parts.push(genderText);
  }

  const ethnicityText = options.ethnicity === 'other' ? options.customEthnicity : options.ethnicity;
  if (ethnicityText && ethnicityText !== 'other') {
    if (ethnicityText === 'mixed') {
      parts.push('mixed ethnicity, diverse features');
    } else {
      parts.push(`${ethnicityText.replace('_', ' ')} ethnicity`);
    }
  }

  parts.push(options.age.replace('_', ' '));

  const hairText = options.hair === 'other' ? options.customHair : options.hair;
  if (hairText && hairText !== 'other' && hairText.trim()) {
    parts.push(`${hairText} hair`);
  }

  const eyesText = options.eyes === 'other' ? options.customEyes : options.eyes;
  if (eyesText && eyesText !== 'other' && eyesText.trim()) {
    parts.push(`${eyesText} eyes`);
  }

  let themeText = '';
  switch (options.theme) {
    case 'office':
      themeText = 'professional business setting, office environment';
      break;
    case 'android':
      themeText = 'futuristic android/robot aesthetic, high-tech design';
      break;
    case 'alien':
      themeText = 'friendly alien character, otherworldly features';
      break;
    case 'animal':
      themeText = 'anthropomorphic animal character, friendly and approachable';
      break;
    case 'fantasy':
      themeText = 'fantasy character, magical or mystical elements';
      break;
    case 'other':
      themeText = options.customTheme.trim();
      break;
  }
  if (themeText.length > 0) parts.push(themeText);

  let styleText = '';
  switch (options.style) {
    case 'photorealistic':
      styleText = 'photorealistic, high quality, detailed, realistic rendering';
      break;
    case 'cartoon':
      styleText = 'cartoon style, friendly and approachable, animated, stylized';
      break;
    case '3d_animation':
      styleText = '3D animated style, Pixar-like, modern 3D rendering, computer graphics';
      break;
    case 'other':
      styleText = options.customStyle.trim();
      break;
  }
  if (styleText.length > 0) parts.push(styleText);

  parts.push('portrait orientation, centered composition, professional lighting, clean background');
  return parts.join(', ');
};

