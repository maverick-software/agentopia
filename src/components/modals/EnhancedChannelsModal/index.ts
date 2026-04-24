import { EnhancedChannelsModalContent } from './components/EnhancedChannelsModalContent';
import { useEnhancedChannelsModal } from './hooks/useEnhancedChannelsModal';
import type { EnhancedChannelsModalProps } from './types';

export function EnhancedChannelsModal(rawProps: EnhancedChannelsModalProps) {
  const props = useEnhancedChannelsModal(rawProps);
  return EnhancedChannelsModalContent(props);
}

export type { EnhancedChannelsModalProps } from './types';
