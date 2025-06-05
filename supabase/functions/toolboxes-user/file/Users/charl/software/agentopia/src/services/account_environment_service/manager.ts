// Local type definition to avoid external import linter issues
// This matches the SupabaseClient interface used in this file
import { createDigitalOceanDroplet, deleteDigitalOceanDroplet, getDigitalOceanDroplet } from '../digitalocean_service/index.ts'; // Adjusted path, added .ts extension
import { DigitalOceanResourceNotFoundError } from '../digitalocean_service/errors.ts'; // Adjusted path, added .ts extension
// import * as crypto from 'crypto'; // Remove Node.js crypto import
import { ToolInstanceService } from '../tool_instance_service/manager.ts'; // Corrected extension to .ts
// Helper function for converting Uint8Array to hex string
function bytesToHex(bytes) {
  return Array.from(bytes, (byte)=>byte.toString(16).padStart(2, '0')).join('');
}
export class AccountEnvironmentService {
  supabase;
  toolInstanceService;
  constructor(supabaseClient){
    this.supabase = supabaseClient;
    this.toolInstanceService = new ToolInstanceService(supabaseClient); // Instantiate here
  }
  // --- Internal Helper: User Data Script --- (WBS 2.1.2)
  _createToolboxUserDataScript(options) {
    const { dtmaBearerToken, agentopiaApiBaseUrl, backendToDtmaApiKey, dtmaDockerImageUrl } = options;
    // Simplified and aligned with WBS 2.1.2 notes for Dockerized DTMA
    console.log('Creating user data script for Dockerized DTMA with configuration:');
    console.log(`- Agentopia API URL: ${agentopiaApiBaseUrl}`);
    console.log(`- DTMA Docker Image: ${dtmaDockerImageUrl}`);
    // dtmaBearerToken and backendToDtmaApiKey are sensitive, not logged directly here but used below.
    const logFile = '/var/log/dtma-bootstrap.log';
    return `#!/bin/bash
set -e 
set -x 

LOG_FILE="${logFile}"
touch "\${LOG_FILE}"
exec &> >(tee -a "\${LOG_FILE}") 

DTMA_CONTAINER_NAME="dtma_manager"

# Ensure DEBIAN_FRONTEND is set for non-interactive apt installs
export DEBIAN_FRONTEND=noninteractive

echo "--- Starting DTMA Docker Setup Script ---"

# Create ubuntu user if it doesn't exist (some DO images don't have it)
if ! id "ubuntu" &>/dev/null; then
    echo "Creating ubuntu user..."
    useradd -m -s /bin/bash ubuntu
    usermod -aG sudo ubuntu
    echo "ubuntu:ubuntu" | chpasswd
    echo "ubuntu ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
    echo "Ubuntu user created successfully."
else
    echo "Ubuntu user already exists."
fi

RUN_USER="ubuntu"
chown "\${RUN_USER}:\${RUN_USER}" "\${LOG_FILE}"

# Install Docker if not present (basic check, image should ideally have it)
if ! command -v docker &> /dev/null
then
    echo "Docker not found. Installing Docker..."
    apt-get update -y
    apt-get install -y apt-transport-https ca-certificates curl software-properties-common gnupg
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    usermod -aG docker "\${RUN_USER}" || echo "Warning: Failed to add user \${RUN_USER} to docker group."
    systemctl start docker
    systemctl enable docker
    echo "Docker installation complete."
else
    echo "Docker already installed."
fi

echo "Stopping and removing existing DTMA container (if any)..."
docker stop "\${DTMA_CONTAINER_NAME}" || true
docker rm "\${DTMA_CONTAINER_NAME}" || true

echo "Pulling DTMA Docker image: ${dtmaDockerImageUrl}..."
docker pull "${dtmaDockerImageUrl}"

echo "Running DTMA Docker container: ${dtmaDockerImageUrl}..."
docker run -d \
  --name "\${DTMA_CONTAINER_NAME}" \
  --restart always \
  -p 30000:30000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e DTMA_BEARER_TOKEN='${dtmaBearerToken}' \
  -e AGENTOPIA_API_BASE_URL='${agentopiaApiBaseUrl}' \
  -e BACKEND_TO_DTMA_API_KEY='${backendToDtmaApiKey}' \
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \
  "${dtmaDockerImageUrl}"

echo "Waiting for DTMA to start..."
sleep 10

echo "Checking DTMA container status..."
docker ps | grep dtma_manager || echo "DTMA container not running!"
docker logs dtma_manager --tail 20 || echo "Could not get DTMA logs"

echo "--- DTMA Docker Setup Script Finished ---"
`;
  }
  // --- CRUD for account_tool_environments (WBS 2.1.1) ---
  async createToolboxEnvironment(userId, name, regionSlug, sizeSlug, imageSlug, dtmaBearerToken, initialStatus, description) {
    const insertData = {
      user_id: userId,
      name,
      description,
      region_slug: regionSlug,
      size_slug: sizeSlug,
      image_slug: imageSlug,
      dtma_bearer_token: dtmaBearerToken,
      status: initialStatus
    };
    const { data, error } = await this.supabase.from('account_tool_environments').insert(insertData).select().single();
    if (error) {
      console.error('Error creating Toolbox environment record:', error);
      throw new Error(`Failed to create Toolbox environment record: ${error.message}`);
    }
    if (!data) {
      throw new Error('Failed to create Toolbox environment record: No data returned.');
    }
    return data;
  }
  async getToolboxEnvironmentById(toolboxId) {
    const { data, error } = await this.supabase.from('account_tool_environments').select('*').eq('id', toolboxId).maybeSingle();
    if (error) {
      console.error(`Error fetching Toolbox by ID (${toolboxId}):`, error);
      throw new Error(`Failed to fetch Toolbox by ID: ${error.message}`);
    }
    return data;
  }
  // Specifically for user context, ensuring user_id match
  async getToolboxEnvironmentByIdForUser(userId, toolboxId) {
    const { data, error } = await this.supabase.from('account_tool_environments').select('*').eq('id', toolboxId).eq('user_id', userId).maybeSingle();
    if (error) {
      console.error(`Error fetching Toolbox by ID (${toolboxId}) for user (${userId}):`, error);
      throw new Error(`Failed to fetch Toolbox for user: ${error.message}`);
    }
    return data;
  }
  async getToolboxEnvironmentsByUserId(userId) {
    const { data, error } = await this.supabase.from('account_tool_environments').select('*').eq('user_id', userId).order('created_at', {
      ascending: false
    });
    if (error) {
      console.error(`Error fetching Toolboxes for user (${userId}):`, error);
      throw new Error(`Failed to fetch Toolboxes for user: ${error.message}`);
    }
    return data || [];
  }
  async updateToolboxEnvironment(toolboxId, updates) {
    // Ensure `updated_at` is handled by the database trigger `trigger_set_timestamp`.
    const { data, error } = await this.supabase.from('account_tool_environments').update(updates).eq('id', toolboxId).select().single();
    if (error) {
      console.error(`Error updating Toolbox (${toolboxId}):`, error);
      throw new Error(`Failed to update Toolbox: ${error.message}`);
    }
    if (!data) {
      throw new Error('Failed to update Toolbox: No data returned or Toolbox not found.');
    }
    return data;
  }
  // --- Provisioning and Deprovisioning Logic --- (WBS 2.1.2, 2.1.3)
  async provisionToolboxForUser(userId, options) {
    console.log(`Provisioning new Toolbox for user ${userId} with options:`, options);
    // WBS 2.1.2: Generate DTMA Bearer Token (secure random string)
    // const dtmaBearerToken = crypto.randomBytes(32).toString('hex'); // Old Node.js way
    const randomBytesArray = new Uint8Array(32);
    crypto.getRandomValues(randomBytesArray); // Uses Deno's global crypto object
    const dtmaBearerToken = bytesToHex(randomBytesArray);
    console.log('Generated DTMA Bearer Token.');
    const imageSlugToUse = options.imageSlug || 'ubuntu-22-04-x64'; // Example default
    // 2. Create initial Toolbox record in DB
    let toolboxRecord = await this.createToolboxEnvironment(userId, options.name, options.regionSlug, options.sizeSlug, imageSlugToUse, dtmaBearerToken, 'pending_provision', options.description);
    const toolboxId = toolboxRecord.id;
    try {
      // 3. Get necessary config for user-data script
      // These should come from environment variables or a config service/file
      const agentopiaApiBaseUrl = Deno.env.get('AGENTOPIA_API_URL') || 'http://localhost:54321/functions/v1';
      const backendToDtmaApiKey = Deno.env.get('BACKEND_TO_DTMA_API_KEY');
      const dtmaDockerImageUrl = Deno.env.get('DTMA_DOCKER_IMAGE_URL');
      if (!backendToDtmaApiKey) throw new Error('BACKEND_TO_DTMA_API_KEY is not configured.');
      if (!dtmaDockerImageUrl) throw new Error('DTMA_DOCKER_IMAGE_URL is not configured.');
      // 4. Create user-data script
      const userDataScript = this._createToolboxUserDataScript({
        dtmaBearerToken,
        agentopiaApiBaseUrl,
        backendToDtmaApiKey,
        dtmaDockerImageUrl
      });
      // 5. Construct droplet name and tags
      const dropletName = `toolbox-${userId.substring(0, 8)}-${toolboxId.substring(0, 8)}`;
      const tags = [
        'agentopia-toolbox',
        `user-${userId}`,
        `toolbox-${toolboxId}`
      ];
      // 6. Update DB status to 'provisioning'
      toolboxRecord = await this.updateToolboxEnvironment(toolboxId, {
        status: 'provisioning'
      });
      // 7. Call DigitalOcean service to create droplet
      console.log(`Creating DigitalOcean droplet: ${dropletName}`);
      const doDroplet = await createDigitalOceanDroplet({
        name: dropletName,
        region: options.regionSlug,
        size: options.sizeSlug,
        image: imageSlugToUse,
        user_data: userDataScript,
        tags: tags,
        ssh_keys: (Deno.env.get('DO_SSH_KEY_FINGERPRINTS') || '').split(',').filter(Boolean)
      });
      if (!doDroplet || !doDroplet.id) {
        throw new Error('DigitalOcean droplet creation failed or returned no ID.');
      }
      console.log(`Droplet ${doDroplet.id} created. Updating DB record.`);
      // 8. Update DB with do_droplet_id
      toolboxRecord = await this.updateToolboxEnvironment(toolboxId, {
        do_droplet_id: doDroplet.id.toString()
      });
      // 9. Poll for active status and IP (Simplified polling loop)
      // Production consideration: Use a more robust polling mechanism or background job.
      let dropletActive = false;
      let publicIpAddress = null;
      const maxPollAttempts = 30; // ~5 minutes if 10s interval
      const pollIntervalMs = 10000;
      for(let i = 0; i < maxPollAttempts; i++){
        await new Promise((resolve)=>setTimeout(resolve, pollIntervalMs));
        console.log(`Polling attempt ${i + 1} for droplet ${doDroplet.id}...`);
        const currentDropletState = await getDigitalOceanDroplet(doDroplet.id);
        if (currentDropletState && currentDropletState.status === 'active') {
          const ipv4Network = currentDropletState.networks?.v4?.find((net)=>net.type === 'public');
          if (ipv4Network && ipv4Network.ip_address) {
            publicIpAddress = ipv4Network.ip_address;
            dropletActive = true;
            console.log(`Droplet ${doDroplet.id} is active with IP: ${publicIpAddress}`);
            break;
          }
        }
        if (currentDropletState && (currentDropletState.status === 'errored' || currentDropletState.status === 'archived')) {
          throw new Error(`Droplet ${doDroplet.id} entered unexpected state: ${currentDropletState.status}`);
        }
      }
      if (!dropletActive || !publicIpAddress) {
        throw new Error(`Droplet ${doDroplet.id} did not become active or assign IP within timeout.`);
      }
      // 10. On success: Update DB with public_ip_address and status 'awaiting_heartbeat'
      toolboxRecord = await this.updateToolboxEnvironment(toolboxId, {
        public_ip_address: publicIpAddress,
        status: 'awaiting_heartbeat',
        provisioning_error_message: null
      });
      console.log(`Toolbox ${toolboxId} provisioned successfully. Status: awaiting_heartbeat.`);
    } catch (error) {
      console.error(`Error during Toolbox provisioning (${toolboxId}):`, error);
      await this.updateToolboxEnvironment(toolboxId, {
        status: 'error_provisioning',
        provisioning_error_message: error.message || 'Unknown provisioning error'
      }).catch((updateError)=>console.error('Failed to update Toolbox status to error_provisioning:', updateError));
      // Re-throw the original error to be handled by the caller (e.g., the Edge Function)
      throw error;
    }
    return toolboxRecord;
  }
  async deprovisionToolbox(toolboxId, userId) {
    console.log(`Deprovisioning Toolbox ${toolboxId} (User context: ${userId || 'N/A'})`);
    const toolboxRecord = await this.getToolboxEnvironmentById(toolboxId);
    if (!toolboxRecord) {
      return {
        success: false,
        message: `Toolbox ${toolboxId} not found.`
      };
    }
    // Optional: Ownership check if userId is provided
    if (userId && toolboxRecord.user_id !== userId) {
      console.warn(`User ${userId} attempted to deprovision Toolbox ${toolboxId} owned by ${toolboxRecord.user_id}. Denying.`);
      return {
        success: false,
        message: 'Access denied: You do not own this Toolbox.'
      };
    }
    if (toolboxRecord.status === 'deprovisioned' || toolboxRecord.status === 'deprovisioning') {
      console.log(`Toolbox ${toolboxId} is already ${toolboxRecord.status}. No action needed.`);
      return {
        success: true,
        finalStatus: toolboxRecord.status
      };
    }
    await this.updateToolboxEnvironment(toolboxId, {
      status: 'deprovisioning'
    });
    try {
      if (toolboxRecord.do_droplet_id) {
        console.log(`Deleting DigitalOcean droplet ${toolboxRecord.do_droplet_id} for Toolbox ${toolboxId}...`);
        await deleteDigitalOceanDroplet(toolboxRecord.do_droplet_id);
        console.log(`Droplet ${toolboxRecord.do_droplet_id} deleted successfully from DigitalOcean.`);
      } else {
        console.log(`No DigitalOcean droplet ID found for Toolbox ${toolboxId}. Skipping DO deletion.`);
      }
      // DELETE the database record completely instead of marking as deprovisioned
      const { error: deleteError } = await this.supabase.from('account_tool_environments').delete().eq('id', toolboxId);
      if (deleteError) {
        console.error(`Failed to delete Toolbox record from DB for ${toolboxId}:`, deleteError);
        return {
          success: false,
          message: `DB deletion failed after DO deletion: ${deleteError.message}`
        };
      }
      console.log(`Toolbox ${toolboxId} completely deleted from database.`);
      return {
        success: true,
        message: 'Toolbox deprovisioned and deleted from database.'
      };
    } catch (error) {
      console.error(`Error during Toolbox deprovisioning (${toolboxId}):`, error);
      let errorMessage = 'Unknown deprovisioning error';
      if (error instanceof DigitalOceanResourceNotFoundError) {
        console.warn(`Droplet for Toolbox ${toolboxId} (DO ID: ${toolboxRecord.do_droplet_id}) not found on DigitalOcean. Assuming already deleted.`);
        // Still DELETE the database record even if droplet not found
        const { error: deleteError } = await this.supabase.from('account_tool_environments').delete().eq('id', toolboxId);
        if (deleteError) {
          console.error(`Failed to delete Toolbox record from DB after DO not found for ${toolboxId}:`, deleteError);
          return {
            success: false,
            message: `DB deletion failed: ${deleteError.message}`
          };
        }
        console.log(`Toolbox ${toolboxId} deleted from database (droplet was already gone).`);
        return {
          success: true,
          message: 'Droplet not found on provider, toolbox deleted from database.'
        };
      }
      errorMessage = error.message || errorMessage;
      await this.updateToolboxEnvironment(toolboxId, {
        status: 'error_deprovisioning',
        provisioning_error_message: errorMessage.substring(0, 200)
      }).catch((updateError)=>console.error('Failed to update Toolbox status to error_deprovisioning:', updateError));
      return {
        success: false,
        message: errorMessage,
        finalStatus: 'error_deprovisioning'
      };
    }
  }
  // --- Status Update Logic --- (WBS 2.1.4)
  async refreshToolboxStatusFromDtma(toolboxId, userId// For ownership/authorization check if called directly by user endpoint
  ) {
    console.log(`Refreshing Toolbox status from DTMA for ID: ${toolboxId}`);
    const toolboxRecord = userId ? await this.getToolboxEnvironmentByIdForUser(userId, toolboxId) : await this.getToolboxEnvironmentById(toolboxId);
    if (!toolboxRecord) {
      throw new Error('Toolbox environment not found or user not authorized.');
    }
    if (toolboxRecord.status === 'deprovisioned' || toolboxRecord.status === 'pending_deprovision') {
      console.warn(`Toolbox ${toolboxId} is in state ${toolboxRecord.status}, skipping DTMA status refresh.`);
      return toolboxRecord;
    }
    if (!toolboxRecord.do_droplet_id) {
      throw new Error('Toolbox droplet ID is not set. Cannot refresh status from DTMA.');
    }
    // Get current droplet information from DigitalOcean API instead of using stored IP
    let currentDropletIP;
    try {
      console.log(`Fetching current droplet information for ID: ${toolboxRecord.do_droplet_id}`);
      const { getDigitalOceanDroplet } = await import('../digitalocean_service/index.ts');
      const dropletInfo = await getDigitalOceanDroplet(toolboxRecord.do_droplet_id);
      // Get the public IPv4 address from the networks
      const publicNetworks = dropletInfo.networks?.v4?.filter((network)=>network.type === 'public');
      if (!publicNetworks || publicNetworks.length === 0) {
        throw new Error('No public IPv4 address found for droplet');
      }
      currentDropletIP = publicNetworks[0].ip_address;
      console.log(`Current droplet IP from DigitalOcean API: ${currentDropletIP}`);
      // Update the stored IP if it's different
      if (currentDropletIP !== toolboxRecord.public_ip_address) {
        console.log(`Updating stored IP from ${toolboxRecord.public_ip_address} to ${currentDropletIP}`);
        await this.updateToolboxEnvironment(toolboxId, {
          public_ip_address: currentDropletIP
        });
        toolboxRecord.public_ip_address = currentDropletIP; // Update local record
      }
    } catch (dropletError) {
      console.error(`Failed to get current droplet IP for ${toolboxRecord.do_droplet_id}:`, dropletError.message);
      // Fall back to stored IP if DigitalOcean API fails, but log the issue
      if (!toolboxRecord.public_ip_address) {
        throw new Error('Cannot determine droplet IP address and no stored IP available.');
      }
      console.warn(`Falling back to stored IP address: ${toolboxRecord.public_ip_address}`);
      currentDropletIP = toolboxRecord.public_ip_address;
    }
    const dtmaPort = Deno.env.get('DTMA_PORT') || '30000'; // Fixed to match actual DTMA port
    const backendToDtmaApiKeyFromEnv = Deno.env.get('BACKEND_TO_DTMA_API_KEY'); // Renamed to avoid conflict
    if (!backendToDtmaApiKeyFromEnv) {
      console.error('CRITICAL: BACKEND_TO_DTMA_API_KEY is not configured. Cannot refresh status from DTMA.');
      throw new Error('Internal configuration error: Missing DTMA API key.');
    }
    const dtmaStatusUrl = `http://${currentDropletIP}:${dtmaPort}/status`;
    let dtmaStatusResponse;
    try {
      dtmaStatusResponse = await fetch(dtmaStatusUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${backendToDtmaApiKeyFromEnv}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (networkError) {
      console.error(`Network error fetching DTMA status from ${dtmaStatusUrl}:`, networkError.message);
      // Potentially update toolbox status to 'unresponsive' or 'error_contacting_dtma'
      await this.updateToolboxEnvironment(toolboxId, {
        status: 'unresponsive',
        dtma_health_details_json: {
          error: `Network error: ${networkError.message}`
        }
      });
      throw new Error(`Failed to connect to DTMA: ${networkError.message}`);
    }
    if (!dtmaStatusResponse.ok) {
      const errorBody = await dtmaStatusResponse.text();
      console.error(`DTMA status endpoint ${dtmaStatusUrl} returned error ${dtmaStatusResponse.status}: ${errorBody}`);
      // Potentially update toolbox status
      await this.updateToolboxEnvironment(toolboxId, {
        status: 'unresponsive',
        dtma_health_details_json: {
          error: `DTMA API error ${dtmaStatusResponse.status}: ${errorBody}`
        }
      });
      throw new Error(`DTMA returned error: ${dtmaStatusResponse.status}`);
    }
    let dtmaStatusPayload;
    try {
      dtmaStatusPayload = await dtmaStatusResponse.json();
    } catch (parseError) {
      console.error(`Error parsing JSON response from DTMA ${dtmaStatusUrl}:`, parseError.message);
      await this.updateToolboxEnvironment(toolboxId, {
        status: 'unresponsive',
        dtma_health_details_json: {
          error: `DTMA JSON parse error: ${parseError.message}`
        }
      });
      throw new Error('Failed to parse DTMA status response.');
    }
    console.log('Received DTMA status payload:', JSON.stringify(dtmaStatusPayload, null, 2));
    // Update toolbox environment with general DTMA health
    const toolboxUpdates = {
      dtma_last_known_version: dtmaStatusPayload.dtma_version,
      dtma_health_details_json: dtmaStatusPayload.system_metrics,
      last_heartbeat_at: new Date().toISOString(),
      status: toolboxRecord.status === 'awaiting_heartbeat' || toolboxRecord.status === 'provisioning' ? 'active' : toolboxRecord.status
    };
    const updatedToolboxRecord = await this.updateToolboxEnvironment(toolboxId, toolboxUpdates);
    // Now, update individual tool instances based on the DTMA report
    if (dtmaStatusPayload.tool_instances && Array.isArray(dtmaStatusPayload.tool_instances)) {
      const instanceUpdatePromises = dtmaStatusPayload.tool_instances.map(async (dtmaInstance)=>{
        if (!dtmaInstance.account_tool_instance_id) {
          console.warn('DTMA status contained a tool instance without an account_tool_instance_id. Skipping:', dtmaInstance);
          return null;
        }
        try {
          // Prepare runtime_details to be stored in account_tool_instances
          const runtimeDetails = {
            reported_by_dtma_at: new Date().toISOString(),
            status_on_toolbox: dtmaInstance.status,
            container_id: dtmaInstance.container_id,
            instance_name_on_toolbox: dtmaInstance.instance_name_on_toolbox
          };
          if (dtmaInstance.metrics) {
            runtimeDetails.metrics = dtmaInstance.metrics;
          }
          return this.toolInstanceService.updateToolInstanceDetailsFromDtmaReport(dtmaInstance.account_tool_instance_id, dtmaInstance.status, runtimeDetails, toolboxUpdates.last_heartbeat_at || undefined);
        } catch (instanceUpdateError) {
          console.error(`Error processing update for instance ${dtmaInstance.account_tool_instance_id}:`, instanceUpdateError.message);
          return null; // Continue with other instances
        }
      });
      const results = await Promise.allSettled(instanceUpdatePromises);
      results.forEach((result)=>{
        if (result.status === 'rejected') {
          console.error('Failed to update a tool instance from DTMA report (within Promise.allSettled):', result.reason);
        } else if (result.status === 'fulfilled' && result.value === null) {
        // This case is already logged by updateToolInstanceDetailsFromDtmaReport if DB update fails or not found
        }
      });
    } else {
      console.log(`No tool instances reported by DTMA for toolbox ${toolboxId}, or format is incorrect.`);
    }
    return updatedToolboxRecord;
  }
}
