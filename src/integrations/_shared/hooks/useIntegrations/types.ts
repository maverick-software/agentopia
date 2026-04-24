export interface IntegrationCategory {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  display_order: number;
  total_integrations?: number;
  available_integrations?: number;
  user_connected_integrations?: number;
}

export interface Integration {
  id: string;
  category_id: string;
  name: string;
  description: string;
  icon_name: string;
  status: 'available' | 'beta' | 'coming_soon' | 'deprecated';
  agent_classification?: 'tool' | 'channel';
  is_popular: boolean;
  documentation_url?: string;
  display_order: number;
  user_connection_status?: 'connected' | 'disconnected' | 'error' | 'pending';
  user_connection_count?: number;
}

export interface UserIntegration {
  id: string;
  user_id: string;
  integration_id: string;
  connection_name?: string;
  connection_status: 'connected' | 'disconnected' | 'error' | 'pending';
  configuration: Record<string, any>;
  last_sync_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface IntegrationStats {
  total_available_integrations: number;
  total_connected_integrations: number;
  total_categories: number;
  recent_connections: number;
}
