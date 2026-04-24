export interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  mobile_number?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export interface CountryCodeOption {
  value: string;
  label: string;
  country: 'US' | 'CA' | 'MX';
}
