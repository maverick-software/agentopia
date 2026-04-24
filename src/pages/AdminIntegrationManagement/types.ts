export interface OAuthProvider {
  id: string;
  name: string;
  display_name: string;
  authorization_endpoint: string;
  token_endpoint: string;
  revoke_endpoint: string | null;
  discovery_endpoint: string | null;
  scopes_supported: string[];
  pkce_required: boolean;
  client_credentials_location: string;
  is_enabled: boolean;
  configuration_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface OAuthProviderFormData {
  name: string;
  display_name: string;
  authorization_endpoint: string;
  token_endpoint: string;
  revoke_endpoint: string;
  discovery_endpoint: string;
  scopes_supported: string;
  pkce_required: boolean;
  client_credentials_location: string;
  configuration_metadata: string;
  status: 'true' | 'false';
}
