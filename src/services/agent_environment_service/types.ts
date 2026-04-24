/**
 * Configuration for provisioning a new DigitalOcean droplet for an agent,
 * determined by the platform (admin settings, agent tier, tool requirements).
 */
export interface InternalDropletProvisionConfig {
  region: string;         // e.g., 'nyc3'
  size: string;           // e.g., 's-1vcpu-1gb' (Droplet size slug)
  image: string;          // e.g., 'ubuntu-22-04-x64-docker' (Image slug or ID)
  ssh_key_ids: (string | number)[]; // Array of DigitalOcean SSH key IDs or fingerprints for admin access
  user_data?: string;      // Cloud-init script for bootstrapping
  tags: string[];         // Tags to apply to the droplet (e.g., ['agent-environment', 'agent-id:xyz'])
  vpc_uuid?: string;       // Optional VPC UUID to launch the droplet in
  enable_ipv6?: boolean;
  monitoring?: boolean;
  with_droplet_agent?: boolean; // DigitalOcean's monitoring agent, usually true
}

/**
 * Represents a record from the agent_droplets table (simplified).
 * Actual type should align with the database schema.
 */
export interface AgentDropletRecord {
  id: string; // UUID
  agent_id: string; // UUID
  do_droplet_id: number | null;
  name: string; // The name of the droplet in DigitalOcean
  ip_address: string | null;
  status: string; // Should match droplet_status_enum values or DO status strings
  region_slug: string;
  size_slug: string;
  image_slug: string; // Or image ID/name
  tags: string[] | null; // Tags associated with the droplet
  created_at: Date;
  updated_at: Date;
  error_message?: string | null;
  // ... any other relevant fields from the agent_droplets table
} 