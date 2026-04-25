import type React from 'react';

export interface SourcesTabProps {
  agentId: string;
  agentData?: any;
  onAgentUpdated?: (updatedData: any) => void;
}

export interface OneDriveCredential {
  connection_id: string;
  external_username: string | null;
  connection_name: string | null;
  scopes_granted: string[];
  connection_status: string;
}

export interface OneDrivePermission {
  id: string;
  connection_id: string;
  is_active: boolean;
  allowed_scopes: string[];
}
