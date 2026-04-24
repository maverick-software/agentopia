import type { EnhancedChannelsModalProps } from './EnhancedChannelsModalCanonical';
import { EnhancedChannelsModalCanonical } from './EnhancedChannelsModalCanonical';

export function EnhancedChannelsModalRefactored(props: EnhancedChannelsModalProps) {
  return <EnhancedChannelsModalCanonical {...props} />;
}
