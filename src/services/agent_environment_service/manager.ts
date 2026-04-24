import { createClient, SupabaseClient } from '@supabase/supabase-js'; // Ensure createClient is imported
import {
  InternalDropletProvisionConfig,
  AgentDropletRecord
} from './types';
import { getSupabaseAdmin } from '../../lib/supabase'; // Assuming admin client for service-to-service
import {
  createDigitalOceanDroplet,
  deleteDigitalOceanDroplet,
  getDigitalOceanDroplet, // Added import
  Droplet,
  CreateDropletServiceOptions // Added here
} from '../digitalocean_service'; // Corrected path and consolidated imports
import { Database, Json } from '../../types/database.types'; // Added Json import
import * as crypto from 'crypto';
import { DigitalOceanResourceNotFoundError } from '../digitalocean_service/errors'; // Added import

/**
 * Retrieves agent droplet details from the database.
 * Optionally refreshes data from DigitalOcean if deemed necessary.
 */
async function getAgentDropletDetails(agentId: string): Promise<AgentDropletRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('agent_droplets') // Removed 'as any'
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching droplet details for agent ${agentId}:`, error);
    throw new Error(`Failed to fetch droplet details: ${error.message}`);
  }

  if (!data) {
    return null;
  }
  
  // Data should now conform to the regenerated Database types
  const agentDroplet: AgentDropletRecord = {
    id: data.id,
    agent_id: data.agent_id,
    do_droplet_id: data.do_droplet_id,
    name: data.name || '', // name is nullable in DB type
    ip_address: data.ip_address as string | null, // ip_address is `unknown` in DB type, cast to string
    status: data.status, // status type should match AgentDropletRecord now
    region_slug: data.region_slug,
    size_slug: data.size_slug,
    image_slug: data.image_slug,
    tags: data.tags,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
    error_message: data.error_message,
    // configuration: data.configuration, // Add if AgentDropletRecord needs it
    // dtma_auth_token: data.dtma_auth_token, // Add if AgentDropletRecord needs it
    // dtma_last_known_version: data.dtma_last_known_version, // Add if AgentDropletRecord needs it
    // dtma_last_reported_status: data.dtma_last_reported_status, // Add if AgentDropletRecord needs it
  };
  return agentDroplet;
}

// Function to create the cloud-init user data script
function createUserDataScript(dtmaAuthToken: string, agentopiaApiBaseUrl?: string, dtmaGitRepo?: string, dtmaGitBranch?: string): string {
  const repoUrl = dtmaGitRepo || 'https://github.com/maverick-software/dtma-agent.git'; // Default to our managed repo
  const branch = dtmaGitBranch || 'main';
  
  // Prioritize Supabase Edge Functions URL if available
  // Determine URL type for appropriate defaults
  const isSupabaseUrl = agentopiaApiBaseUrl?.includes('supabase.co/functions/v1');
  const isNetlifyUrl = agentopiaApiBaseUrl?.includes('netlify.app');
  
  // Set a reasonable default API URL with appropriate warning
  const apiUrl = agentopiaApiBaseUrl || (
    isSupabaseUrl 
      ? 'https://txhscptzjrrudnqwavcb.supabase.co/functions/v1'  // Direct Supabase Edge Functions (preferred)
      : (isNetlifyUrl
          ? 'https://agentopia-staging.netlify.app/functions/v1'  // Netlify (fallback)
          : 'http://localhost:54321/functions/v1')               // Local development (last resort)
  );
  
  if (!agentopiaApiBaseUrl) {
    console.warn(`Warning: No AGENTOPIA_API_URL provided. Using default: ${apiUrl}`);
    console.warn('The droplet may not be able to connect to the API. Set AGENTOPIA_API_URL in your environment.');
  }
  
  // Log important information about the configuration
  console.log('Creating user data script with configuration:');
  console.log(`- API URL: ${apiUrl}`);
  console.log(`- DTMA Repo: ${repoUrl} (branch: ${branch})`);
  
  const nodeVersion = '20';
  const dtmaRunUser = 'ubuntu';
  const logFile = '/var/log/dtma-bootstrap.log';

  // Use HEREDOC for multi-line script clarity
  // Escape backticks and dollar signs intended for the shell script itself
  return `#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.
set -x # Print commands and their arguments as they are executed.

# --- Log File Setup ---
LOG_FILE="${logFile}"
touch "\${LOG_FILE}"
chown "${dtmaRunUser}":"${dtmaRunUser}" "\${LOG_FILE}"
exec &> >(tee -a "\${LOG_FILE}") # Redirect stdout/stderr to file and console

# --- Variables ---
AGENTOPIA_DIR="/opt/agentopia"
DTMA_DIR="\${AGENTOPIA_DIR}/dtma"
DTMA_CONFIG_FILE="/etc/dtma.conf"
DTMA_SERVICE_FILE="/etc/systemd/system/dtma.service"
NODE_VERSION="${nodeVersion}"
DTMA_AUTH_TOKEN_VALUE="${dtmaAuthToken}" # Injected from function arg
AGENTOPIA_API_URL_VALUE="${apiUrl}" # Injected from function arg
DTMA_REPO_URL="${repoUrl}" # Injected from function arg
DTMA_BRANCH="${branch}" # Injected from function arg
RUN_USER="${dtmaRunUser}" # Injected from function arg

export DEBIAN_FRONTEND=noninteractive

echo "--- Starting DTMA Setup Script ---"
echo "Using API URL: ${apiUrl}"
echo "Using DTMA repo: ${repoUrl} (branch: ${branch})"

# --- Install Prerequisites ---
echo "Installing prerequisites..."
apt-get update -y
apt-get install -y apt-transport-https ca-certificates curl software-properties-common git gpg

# Install Docker
echo "Installing Docker..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Attempt to add user to docker group, continue if it fails (e.g. user not yet fully created in some edge cases)
echo "Adding user \${RUN_USER} to Docker group..."
usermod -aG docker "\${RUN_USER}" || echo "Warning: Failed to add user \${RUN_USER} to docker group. This might be an issue if script is not run as root or user doesn't exist yet."


# Install Node.js
echo "Installing Node.js v\${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_\${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# --- Configure DTMA ---
echo "Creating DTMA config file at \${DTMA_CONFIG_FILE}..."
mkdir -p "$(dirname "\${DTMA_CONFIG_FILE}")"
# Ensure directory is owned by run user before creating file in it if it didn't exist
chown "\${RUN_USER}":"\${RUN_USER}" "$(dirname "\${DTMA_CONFIG_FILE}")"

echo "DTMA_AUTH_TOKEN=\${DTMA_AUTH_TOKEN_VALUE}" > "\${DTMA_CONFIG_FILE}"
echo "AGENTOPIA_API_BASE_URL=\${AGENTOPIA_API_URL_VALUE}" >> "\${DTMA_CONFIG_FILE}"
chmod 600 "\${DTMA_CONFIG_FILE}"
chown "\${RUN_USER}":"\${RUN_USER}" "\${DTMA_CONFIG_FILE}"

# --- Fetch and Build DTMA Code ---
echo "Cloning DTMA repository from \${DTMA_REPO_URL} branch \${DTMA_BRANCH}..."
mkdir -p "\${AGENTOPIA_DIR}"
chown "\${RUN_USER}":"\${RUN_USER}" "\${AGENTOPIA_DIR}"

# Clone as the RUN_USER
echo "Attempting to clone as user \${RUN_USER}..."
sudo -u "\${RUN_USER}" git clone --branch "\${DTMA_BRANCH}" "\${DTMA_REPO_URL}" "\${DTMA_DIR}"

if [ -d "\${DTMA_DIR}" ]; then
  cd "\${DTMA_DIR}"
  echo "Current directory: $(pwd)"
  echo "Listing directory contents:"
  ls -la
  
  echo "Installing DTMA dependencies as user \${RUN_USER}..."
  # Run npm install as the RUN_USER in the DTMA_DIR
  sudo -u "\${RUN_USER}" bash -c "cd \${DTMA_DIR} && npm install --production --unsafe-perm"
  
  echo "Building DTMA as user \${RUN_USER}..."
  sudo -u "\${RUN_USER}" bash -c "cd \${DTMA_DIR} && npm run build"
  
  echo "Ensuring \${DTMA_DIR} is owned by \${RUN_USER} post-build..."
  chown -R "\${RUN_USER}":"\${RUN_USER}" "\${DTMA_DIR}"
else
  echo "Error: Failed to clone DTMA repository into \${DTMA_DIR}." >&2
  exit 1
fi

# --- Set up systemd Service ---
echo "Creating systemd service file \${DTMA_SERVICE_FILE}..."
cat <<EOF > "\${DTMA_SERVICE_FILE}"
[Unit]
Description=Agentopia Droplet Tool Management Agent
After=network.target docker.service
Requires=docker.service

[Service]
EnvironmentFile=\${DTMA_CONFIG_FILE}
WorkingDirectory=\${DTMA_DIR}
ExecStart=/usr/bin/node dist/index.js
Restart=always
User=\${RUN_USER}
StandardOutput=journal
StandardError=journal
SyslogIdentifier=dtma

[Install]
WantedBy=multi-user.target
EOF

# --- Enable and Start Service ---
echo "Enabling and starting DTMA service..."
systemctl daemon-reload
systemctl enable dtma.service
systemctl start dtma.service

echo "--- DTMA setup complete ---"
`;
}

const MAX_POLL_ATTEMPTS = 30; // e.g., 30 attempts * 10 seconds = 5 minutes max wait
const POLL_INTERVAL_MS = 10000; // 10 seconds

/**
 * Provisions a new DigitalOcean droplet for an agent based on the determined configuration.
 * This is an internal helper function.
 */
async function provisionAgentDroplet(
  agentId: string,
  provisionConfig: InternalDropletProvisionConfig
): Promise<AgentDropletRecord> {
  const supabase = getSupabaseAdmin();
  const uniqueDropletName = `agent-${agentId}-env-${Date.now().toString().slice(-6)}`;
  const dtmaAuthToken = crypto.randomBytes(32).toString('hex');

  const dtmaRepoUrl = process.env.DTMA_GIT_REPO_URL;
  const dtmaGitBranch = process.env.DTMA_GIT_BRANCH;
  const agentopiaApiUrl = process.env.AGENTOPIA_API_URL;

  // Remove the requirement for DTMA_GIT_REPO_URL
  // Use a default GitHub URL if not provided (you can create a public repo for this)
  const defaultGitRepo = 'https://github.com/agentopia/dtma.git'; // Replace with your actual public repo
  const effectiveRepoUrl = dtmaRepoUrl || defaultGitRepo;
  
  const userDataScript = createUserDataScript(dtmaAuthToken, agentopiaApiUrl, effectiveRepoUrl, dtmaGitBranch);

  const doOptions: CreateDropletServiceOptions = {
    name: uniqueDropletName,
    region: provisionConfig.region,
    size: provisionConfig.size,
    image: provisionConfig.image, 
    ssh_keys: provisionConfig.ssh_key_ids,
    tags: provisionConfig.tags || [`agent-id:${agentId}`],
    user_data: userDataScript,
    vpc_uuid: provisionConfig.vpc_uuid,
    ipv6: provisionConfig.enable_ipv6 ?? false,
    monitoring: provisionConfig.monitoring ?? true,
    with_droplet_agent: provisionConfig.with_droplet_agent ?? true,
  };

  let initialDropletResponse: Droplet;
  try {
    console.log(`Attempting to create DigitalOcean droplet "${uniqueDropletName}"...`);
    initialDropletResponse = await createDigitalOceanDroplet(doOptions);
    console.log(`DigitalOcean droplet creation initiated: ID ${initialDropletResponse.id}, Name: ${initialDropletResponse.name}, Status: ${initialDropletResponse.status}`);
  } catch (error) {
    console.error(`Failed to create DigitalOcean droplet for agent ${agentId}:`, error);
    // TODO: Update agent_droplets record with error_creation status if one was preemptively created
    throw error; 
  }

  // Poll for active status
  let attempts = 0;
  let currentDropletState = initialDropletResponse;
  while (attempts < MAX_POLL_ATTEMPTS && currentDropletState.status !== 'active') {
    attempts++;
    console.log(`Polling droplet ${currentDropletState.id} status (Attempt ${attempts}/${MAX_POLL_ATTEMPTS}). Current status: ${currentDropletState.status}. Waiting ${POLL_INTERVAL_MS / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    try {
      currentDropletState = await getDigitalOceanDroplet(currentDropletState.id);
    } catch (pollError) {
      console.error(`Error polling droplet ${currentDropletState.id} status:`, pollError);
      // If polling itself fails (e.g. network, or droplet disappears during polling after creation error from DO perspective)
      // We might want to break or throw, depending on how critical immediate status is.
      // For now, if it was a ResourceNotFound, assume it truly vanished post-creation signal.
      if (pollError instanceof DigitalOceanResourceNotFoundError) {
        console.error(`Droplet ${currentDropletState.id} disappeared during polling. Aborting.`);
        throw new Error(`Droplet ${currentDropletState.id} was not found during status polling.`);
      }
      // For other poll errors, we might log and let the loop continue or break.
      // Let's break and rely on the status from last successful poll or initial creation.
      break; 
    }
  }

  if (currentDropletState.status !== 'active') {
    console.error(`Droplet ${currentDropletState.id} did not become active after ${attempts} attempts. Last status: ${currentDropletState.status}`);
    // TODO: Update agent_droplets record with error_creation status
    throw new Error(`Droplet ${currentDropletState.id} failed to become active. Last status: ${currentDropletState.status}`);
  }

  console.log(`Droplet ${currentDropletState.id} is now active.`);

  interface IPV4NetworkInterface { 
    ip_address: string;
    netmask: string;
    gateway: string;
    type: 'public' | 'private';
  }

  const publicIpV4 = (currentDropletState.networks.v4 as IPV4NetworkInterface[]).find(
    (net: IPV4NetworkInterface) => net.type === 'public'
  )?.ip_address;

  if (!publicIpV4) {
    console.warn(`Droplet ${currentDropletState.id} is active but no public IPv4 address found.`);
    // This might be an issue, decide if to throw or proceed with null IP
  }

  type AgentDropletInsert = Database['public']['Tables']['agent_droplets']['Insert'];
  
  const mapDOStatusToInternalStatus = (doStatus: string): Database['public']['Enums']['droplet_status_enum'] => {
    switch (doStatus) {
      case 'new': return 'creating';
      case 'active': return 'active';
      case 'off': return 'unresponsive';
      case 'archive': return 'deleted';
      default: console.warn(`Unknown DO status: ${doStatus}`); return 'unresponsive';
    }
  };

  const newDropletRecord: AgentDropletInsert = {
    agent_id: agentId,
    do_droplet_id: currentDropletState.id,
    name: currentDropletState.name,
    ip_address: publicIpV4 || null, 
    status: mapDOStatusToInternalStatus(currentDropletState.status), // Should be 'active' here
    region_slug: currentDropletState.region.slug,
    size_slug: currentDropletState.size_slug,
    image_slug: typeof currentDropletState.image.slug === 'string' ? currentDropletState.image.slug :
                  (currentDropletState.image.name || provisionConfig.image),
    tags: currentDropletState.tags || provisionConfig.tags,
    configuration: provisionConfig as unknown as Json, 
    dtma_auth_token: dtmaAuthToken, 
    dtma_last_known_version: null,
    dtma_last_reported_status: null,
  };

  const { data: insertedData, error: insertError } = await supabase
    .from('agent_droplets')
    .insert(newDropletRecord)
    .select()
    .single();

  if (insertError) {
    console.error(
      `Failed to insert agent droplet record DB for agent ${agentId}, DO ID ${currentDropletState.id}:`,
      insertError
    );
    throw new Error(
      `DB insert failed after droplet creation: ${insertError.message}`
    );
  }

  if (!insertedData) {
    throw new Error('DB insert returned no data after droplet creation.');
  }
  
  const resultRecord: AgentDropletRecord = {
    id: insertedData.id,
    agent_id: insertedData.agent_id,
    do_droplet_id: insertedData.do_droplet_id,
    name: insertedData.name || '', 
    ip_address: insertedData.ip_address as string | null,
    status: insertedData.status, 
    region_slug: insertedData.region_slug,
    size_slug: insertedData.size_slug,
    image_slug: insertedData.image_slug,
    tags: insertedData.tags,
    created_at: new Date(insertedData.created_at),
    updated_at: new Date(insertedData.updated_at),
    error_message: insertedData.error_message,
  };
  return resultRecord;
}

async function getAgentById(agentId: string): Promise<Database['public']['Tables']['agents']['Row'] | null> {
  // Use getSupabaseAdmin() instead of the module-level supabase client
  const supabaseClient = getSupabaseAdmin(); 
  if (!supabaseClient) throw new Error('Supabase admin client not initialized for getAgentById.');
  
  const { data, error } = await supabaseClient
    .from('agents') 
    .select('id, tool_environment_enabled, name, description, personality, assistant_instructions, system_instructions, active, user_id, discord_bot_token_id, discord_bot_key, discord_user_id, discord_channel, created_at, updated_at') 
    .eq('id', agentId)
    .single();

  if (error) {
    console.error(`[AgentEnvService] Error fetching agent ${agentId}:`, error);
    if (error.code === 'PGRST116') return null; 
    throw new Error(`Failed to fetch agent details for ${agentId}: ${error.message}`);
  }
  return data;
}

/**
 * Ensures that a tool environment (DigitalOcean droplet) is ready for the given agent.
 * Provisions one if necessary.
 * This is the primary entry point for this service regarding droplet readiness.
 */
export async function ensureToolEnvironmentReady(
  agentId: string
  // tenantId: string, // If we need tenant context for rules, configs
): Promise<AgentDropletRecord | null> {
  const agent = await getAgentById(agentId); // Check agent eligibility
  if (!agent) {
    // console.warn(`[AgentEnvService] Agent ${agentId} not found.`);
    // Depending on policy, either throw error or return null
    // For now, if agent not found, we can't proceed.
    throw new Error(`Agent ${agentId} not found, cannot ensure tool environment.`);
  }
  // The `agents` table from the provided database.types.ts does not have `tool_environment_enabled`
  // Assuming this check is handled elsewhere or the type needs an update for this field.
  // if (!agent.tool_environment_enabled) {
  //   console.warn(`[AgentEnvService] Tool environment not enabled for agent ${agentId}.`);
  //   return null; // Or throw new Error (`Tool environment not enabled for agent ${agentId}`);
  // }

  const existingDroplet = await getAgentDropletDetails(agentId);
  if (existingDroplet) {
    if (existingDroplet.status !== 'error' && existingDroplet.status !== 'deleted') {
      return existingDroplet;
    }
  }

  const defaultConfig: InternalDropletProvisionConfig = {
    region: process.env.DO_DEFAULT_REGION || 'nyc3',
    size: process.env.DO_DEFAULT_SIZE || 's-1vcpu-1gb', 
    image: process.env.DO_DEFAULT_IMAGE || 'ubuntu-22-04-x64-docker', 
    ssh_key_ids: process.env.DO_DEFAULT_SSH_KEY_IDS?.split(',').map(id => id.trim()).filter(id => id) || [],
    tags: ['agent-tool-environment', `agent:${agentId}`],
    monitoring: true,
    with_droplet_agent: true,
  };

  if (defaultConfig.ssh_key_ids.length === 0) {
      console.warn(`No SSH key IDs configured for agent ${agentId} droplet provisioning.`);
  }
  
  console.log(`Provisioning new droplet for agent ${agentId} with config:`, defaultConfig);
  return provisionAgentDroplet(agentId, defaultConfig);
}

/**
 * De-provisions (deletes) the DigitalOcean droplet for an agent.
 */
export async function deprovisionAgentDroplet(
  agentId: string
): Promise<{ success: boolean; message?: string }> {
  const supabase = getSupabaseAdmin();

  const agentDroplet = await getAgentDropletDetails(agentId);

  if (!agentDroplet || !agentDroplet.do_droplet_id) {
    console.log(`No active droplet found for agent ${agentId} to deprovision, or missing DO ID.`);
    return { success: true, message: 'No active droplet to deprovision or missing DO ID.' };
  }

  try {
    console.log(`Attempting to delete DigitalOcean droplet ID ${agentDroplet.do_droplet_id} for agent ${agentId}...`);
    await deleteDigitalOceanDroplet(agentDroplet.do_droplet_id);
    console.log(`DigitalOcean droplet ID ${agentDroplet.do_droplet_id} deletion initiated.`);
  } catch (error: any) {
    console.error(
      `Failed to delete DigitalOcean droplet ID ${agentDroplet.do_droplet_id} for agent ${agentId}:`,
      error
    );
    if (error instanceof DigitalOceanResourceNotFoundError) { // Updated check
        console.warn(`Droplet ${agentDroplet.do_droplet_id} not found on DigitalOcean (caught DigitalOceanResourceNotFoundError). Assuming already deleted.`);
    } else {
      // TODO: Convert to a custom service error for other DigitalOceanServiceError types?
      console.error('Unhandled error during DO droplet deletion:', error);
      return { success: false, message: `DO API error: ${error.message || 'Unknown error'}` };
    }
  }

  const updatePayload = {
    status: 'deleted' as const, // Use const assertion for type safety with enum
    ip_address: null,
    updated_at: new Date().toISOString(),
    dtma_auth_token: null,
    dtma_last_known_version: null,
    dtma_last_reported_status: null,
  };

  const { error: updateError } = await supabase
    .from('agent_droplets')
    .update(updatePayload)
    .eq('id', agentDroplet.id);

  if (updateError) {
    console.error(
      `Failed to update agent droplet status to 'deleted' DB for agent ${agentId}, DO ID ${agentDroplet.do_droplet_id}:`,
      updateError
    );
    return { success: false, message: `DB update failed after DO deletion: ${updateError.message}` };
  }

  console.log(`Agent droplet ID ${agentDroplet.id} status updated to 'deleted' in DB.`);
  return { success: true, message: 'Droplet deprovisioned and DB record updated.' };
}

// TODO:
// - Consider more robust status management (enum for statuses).
// - Add functions for starting/stopping/rebooting droplets if needed later.
// - Implement heartbeat mechanism (WBS 2.1.5).
// - Enhance error handling and logging consistently.
// - Configuration management for droplet specs (region, size, image, SSH keys) - avoid hardcoding.

// TODO:
// - Implement mapDOStatusToInternalStatus if DO status strings differ from your enum
// - Refine logic for determining droplet config in ensureToolEnvironmentReady
// - Implement logic to wait or check droplet status more thoroughly after creation if IP/full readiness is needed immediately.
// - Consider atomicity/locking if multiple processes could try to provision for the same agent. 