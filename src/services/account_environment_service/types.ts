import { Database, Json } from '../../../types/database.types'; // Adjusted path

// Align with the ENUM defined in the migration for account_tool_environments.status
export type AccountEnvironmentStatus =
  Database['public']['Enums']['account_tool_environment_status_enum'];

// Represents a record from the account_tool_environments table
export interface AccountEnvironmentRecord {
  id: string; // UUID
  user_id: string; // UUID, FK to auth.users
  do_droplet_id: number | null;
  do_droplet_name?: string | null; // Actual name assigned by DigitalOcean
  name?: string; // Optional, if we decide to have a DO name separate from a generated one
  ip_address: string | null;
  status: AccountEnvironmentStatus;
  region_slug: string;
  size_slug: string;
  image_slug: string;
  tags?: string[]; // Assuming tags might be stored or used
  created_at: Date;
  updated_at: Date;
  last_heartbeat_at?: Date | null;
  error_message?: string | null;
  // Any other relevant fields from account_tool_environments table
}

// Configuration for provisioning an account-level droplet internally
export interface InternalAccountProvisionConfig {
  userId: string; // Key change: user_id instead of agent_id
  region: string;
  size: string;
  image: string;
  ssh_keys?: string[];
  backups?: boolean;
  ipv6?: boolean;
  monitoring?: boolean;
  tags?: string[];
  vpc_uuid?: string;
  with_droplet_agent?: boolean; // Default to true for DTMA
  // Add any other specific config needed for account environments
}

// Existing types that might be deprecated or refactored:
/*
export type AgentDropletStatus =
  Database['public']['Enums']['droplet_status_enum'];

export interface AgentDropletRecord {
  id: string;
  agent_id: string;
  do_droplet_id: number | null;
  name: string;
  ip_address: string | null;
  status: AgentDropletStatus;
  region_slug: string;
  size_slug: string;
  image_slug: string;
  tags?: string[] | null; 
  created_at: Date;
  updated_at: Date;
  error_message?: string | null;
  configuration?: Json | null; 
  dtma_auth_token?: string | null;
  dtma_last_known_version?: string | null;
  dtma_last_reported_status?: Json | null;
}

export interface InternalDropletProvisionConfig {
  agentId: string;
  region: string;
  size: string;
  image: string;
  ssh_keys?: string[];
  backups?: boolean;
  ipv6?: boolean;
  user_data?: string;
  monitoring?: boolean;
  tags?: string[];
  vpc_uuid?: string;
  with_droplet_agent?: boolean;
}
*/ 