import type { EnhancedToolsModalProps } from '../types';
import { EnhancedToolsTabs } from '../tabs/EnhancedToolsTabs';

export function EnhancedToolsModalContent(props: EnhancedToolsModalProps) {
  return <EnhancedToolsTabs {...props} />;
}
