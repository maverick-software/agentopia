import { EnhancedToolsModalContent } from './components/EnhancedToolsModalContent';
import { useEnhancedToolsModal } from './hooks/useEnhancedToolsModal';
import type { EnhancedToolsModalProps } from './types';

export function EnhancedToolsModal(rawProps: EnhancedToolsModalProps) {
  const props = useEnhancedToolsModal(rawProps);
  return EnhancedToolsModalContent(props);
}

export type { EnhancedToolsModalProps } from './types';
