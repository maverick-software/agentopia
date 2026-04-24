import type { Database } from '../../types/database.types.ts';

export type AccountToolEnvironmentRecord = Database['public']['Tables']['account_tool_environments']['Row'];
export type AccountToolEnvironmentInsert = Database['public']['Tables']['account_tool_environments']['Insert'];
export type AccountToolEnvironmentUpdate = Database['public']['Tables']['account_tool_environments']['Update'];
export type AccountToolEnvironmentStatusEnum = Database['public']['Enums']['account_tool_environment_status_enum'];

export interface ProvisionToolboxOptions {
  name: string;
  regionSlug: string;
  sizeSlug: string;
  description?: string;
  imageSlug?: string;
}

export interface CreateToolboxUserDataScriptOptions {
  dtmaBearerToken: string;
  agentopiaApiBaseUrl: string;
  backendToDtmaApiKey: string;
  dtmaDockerImageUrl: string;
  backendDockerImageUrl: string;
  internalApiSecret: string;
  doApiToken: string;
  supabaseServiceRoleKey: string;
}
