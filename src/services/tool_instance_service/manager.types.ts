import type { Database, Json } from '../../types/database.types.ts';

export type AccountToolInstanceRecord = Database['public']['Tables']['account_tool_instances']['Row'];
export type AccountToolInstanceInsert = Database['public']['Tables']['account_tool_instances']['Insert'];
export type AccountToolInstanceUpdate = Database['public']['Tables']['account_tool_instances']['Update'];
export type AccountToolInstallationStatusEnum = Database['public']['Enums']['account_tool_installation_status_enum'];
export type AccountToolEnvironmentRecord = Database['public']['Tables']['account_tool_environments']['Row'];
export type ToolCatalogRecord = Database['public']['Tables']['tool_catalog']['Row'];

export interface CreateToolInstanceOptions {
  account_tool_environment_id: string;
  tool_catalog_id: string;
  instance_name_on_toolbox: string;
  base_config_override_json?: Json;
  status_on_toolbox: AccountToolInstallationStatusEnum;
}

export type UpdateToolInstanceOptions = Omit<
  Partial<AccountToolInstanceUpdate>,
  'id' | 'created_at' | 'account_tool_environment_id' | 'tool_catalog_id'
>;

export interface DeployToolOptions {
  userId: string;
  accountToolEnvironmentId: string;
  toolCatalogId: string;
  instanceNameOnToolbox: string;
  baseConfigOverrideJson?: Json;
}

export interface ManageToolInstanceOptions {
  userId: string;
  accountToolInstanceId: string;
  accountToolEnvironmentId: string;
}
