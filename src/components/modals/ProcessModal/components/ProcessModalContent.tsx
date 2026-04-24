import type { ProcessModalProps } from '../types';
import { ProcessModalTabs } from '../tabs/ProcessModalTabs';

export function ProcessModalContent(props: ProcessModalProps) {
  return <ProcessModalTabs {...props} />;
}
