export interface GmailConnection {
  id: string;
  external_username: string;
  scopes_granted: string[];
  connection_status: 'active' | 'error' | 'expired';
  connection_metadata: {
    user_name: string;
    user_picture: string;
    last_connected: string;
  };
  configuration: {
    require_confirmation_for_send: boolean;
    allow_delete_operations: boolean;
    restrict_to_specific_labels: string[];
  };
}

export interface AgentGmailPermission {
  id: string;
  agent_id: string;
  allowed_scopes: string[];
  is_active: boolean;
  granted_at: string;
  usage_limits: {
    max_emails_per_day: number;
    max_api_calls_per_hour: number;
  };
}

export interface GmailOperationLog {
  id: string;
  agent_id: string;
  operation_type: string;
  operation_params: any;
  operation_result: any;
  status: 'success' | 'error' | 'unauthorized';
  error_message?: string;
  quota_consumed: number;
  execution_time_ms: number;
  created_at: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}
