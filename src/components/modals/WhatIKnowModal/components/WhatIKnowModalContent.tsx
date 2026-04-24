import type { WhatIKnowModalProps } from '../types';
import { WhatIKnowTabs } from '../tabs/WhatIKnowTabs';

export function WhatIKnowModalContent(props: WhatIKnowModalProps) {
  return <WhatIKnowTabs {...props} />;
}
