export interface GenerateAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName?: string;
  onAvatarGenerated: (avatarUrl: string) => void;
}

export interface AvatarOptions {
  gender: 'male' | 'female' | 'neutral' | 'other';
  customGender: string;
  hair: 'blonde' | 'brown' | 'black' | 'red' | 'gray' | 'other';
  customHair: string;
  eyes: 'blue' | 'green' | 'brown' | 'hazel' | 'gray' | 'other';
  customEyes: string;
  ethnicity: 'caucasian' | 'african' | 'asian' | 'hispanic' | 'middle_eastern' | 'mixed' | 'other';
  customEthnicity: string;
  age: 'young_adult' | 'middle_aged' | 'elderly';
  style: 'photorealistic' | 'cartoon' | '3d_animation' | 'artistic' | 'other';
  customStyle: string;
  theme: 'office' | 'android' | 'alien' | 'animal' | 'fantasy' | 'other';
  customTheme: string;
}
