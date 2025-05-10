import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  // InternalDropletProvisionConfig, // Will be replaced by InternalAccountProvisionConfig
  // AgentDropletRecord, // Will be replaced by AccountEnvironmentRecord
  AccountEnvironmentRecord, // New type
  InternalAccountProvisionConfig // New type
} from './types';
import { getSupabaseAdmin } from '../../lib/supabase'; // Reverted to original relative path
import {
  createDigitalOceanDroplet,
  deleteDigitalOceanDroplet,
  getDigitalOceanDroplet,
  Droplet,
  CreateDropletServiceOptions
} from '../digitalocean_service'; // Reverted to original relative path
import { Database, Json } from '../../types/database.types'; // Reverted to original relative path
import * as crypto from 'crypto';
import { DigitalOceanResourceNotFoundError } from '../digitalocean_service/errors'; // Reverted to original relative path

/**
 * Retrieves account tool environment details from the database.
 */
async function getAccountEnvironmentDetails(userId: string): Promise<AccountEnvironmentRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('account_tool_environments') // Changed table name
    .select('*')
    .eq('user_id', userId) // Changed column name and parameter
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching account environment details for user ${userId}:`, error);
    throw new Error(`Failed to fetch account environment details: ${error.message}`);
  }

  if (!data) {
    return null;
  }
  
  // Map to AccountEnvironmentRecord type
  const accountEnvironment: AccountEnvironmentRecord = {
    id: data.id,
    user_id: data.user_id,
    do_droplet_id: data.do_droplet_id,
    // name: data.name, // If 'name' is added to AccountEnvironmentRecord and DB table
    ip_address: data.ip_address as string | null, // Assuming ip_address might be unknown from DB type
    status: data.status as AccountEnvironmentRecord['status'], // Ensure status type matches
    region_slug: data.region_slug,
    size_slug: data.size_slug,
    image_slug: data.image_slug,
    // tags: data.tags, // If 'tags' is part of AccountEnvironmentRecord and DB table
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
    last_heartbeat_at: data.last_heartbeat_at ? new Date(data.last_heartbeat_at) : null,
    error_message: data.error_message,
  };
  return accountEnvironment;
}

// ... rest of the file ...
// The old getAgentDropletDetails function should be removed or commented out.
/*
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
  
  const agentDroplet: AgentDropletRecord = {
    id: data.id,
    agent_id: data.agent_id,
    do_droplet_id: data.do_droplet_id,
    name: data.name || '', 
    ip_address: data.ip_address as string | null, 
    status: data.status, 
    region_slug: data.region_slug,
    size_slug: data.size_slug,
    image_slug: data.image_slug,
    tags: data.tags,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
    error_message: data.error_message,
  };
  return agentDroplet;
}
*/ 

// Function to create the cloud-init user data script
// This replaces the old createUserDataScript
function createUserDataScript(
  dtmaAuthToken: string, 
  accountToolEnvironmentId: string, // New parameter for account context
  agentopiaApiBaseUrl?: string, 
  dtmaGitRepo?: string, 
  dtmaGitBranch?: string
): string {
  const repoUrl = dtmaGitRepo || 'https://github.com/maverick-software/dtma-agent.git'; 
  const branch = dtmaGitBranch || 'main';
  
  const isSupabaseUrl = agentopiaApiBaseUrl?.includes('supabase.co/functions/v1');
  const isNetlifyUrl = agentopiaApiBaseUrl?.includes('netlify.app');
  
  const apiUrl = agentopiaApiBaseUrl || (
    isSupabaseUrl 
      ? 'https://txhscptzjrrudnqwavcb.supabase.co/functions/v1'  
      : (isNetlifyUrl
          ? 'https://agentopia-staging.netlify.app/functions/v1'  
          : 'http://localhost:54321/functions/v1')               
  );
  
  if (!agentopiaApiBaseUrl) {
    console.warn(`Warning: No AGENTOPIA_API_URL provided. Using default: ${apiUrl}`);
    // It's important to log this, but the script should still proceed with a default.
  }
  
  console.log('Creating user data script with configuration:');
  console.log(`- API URL: ${apiUrl}`);
  console.log(`- DTMA Repo: ${repoUrl} (branch: ${branch})`);
  console.log(`- Account Tool Environment ID: ${accountToolEnvironmentId}`);
  
  const nodeVersion = '20';
  const dtmaRunUser = 'ubuntu'; // Or another non-root user configured on the image
  const logFile = '/var/log/dtma-bootstrap.log';

  // Ensure variables are correctly escaped for the shell script HEREDOC
  return `#!/bin/bash
set -e 
set -x 

LOG_FILE="${logFile}"
touch "\${LOG_FILE}"
chown "${dtmaRunUser}":"${dtmaRunUser}" "\${LOG_FILE}"
exec &> >(tee -a "\${LOG_FILE}") 

AGENTOPIA_DIR="/opt/agentopia"
DTMA_DIR="\${AGENTOPIA_DIR}/dtma"
DTMA_CONFIG_FILE="/etc/dtma.conf"
DTMA_SERVICE_FILE="/etc/systemd/system/dtma.service"
NODE_VERSION="${nodeVersion}"
DTMA_AUTH_TOKEN_VALUE="${dtmaAuthToken}" 
AGENTOPIA_API_URL_VALUE="${apiUrl}"
ACCOUNT_TOOL_ENV_ID_VALUE="${accountToolEnvironmentId}" # Renamed for clarity in script
DTMA_REPO_URL="${repoUrl}" 
DTMA_BRANCH="${branch}" 
RUN_USER="${dtmaRunUser}" 

export DEBIAN_FRONTEND=noninteractive

echo "--- Starting DTMA Setup Script ---"
echo "Using API URL: \${AGENTOPIA_API_URL_VALUE}"
echo "Using Account Tool Environment ID: \${ACCOUNT_TOOL_ENV_ID_VALUE}"
echo "Using DTMA repo: \${DTMA_REPO_URL} (branch: \${DTMA_BRANCH})"

apt-get update -y
apt-get install -y apt-transport-https ca-certificates curl software-properties-common git gpg

echo "Installing Docker..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

usermod -aG docker "\${RUN_USER}" || echo "Warning: Failed to add user \${RUN_USER} to docker group."

echo "Installing Node.js v\${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_\${NODE_VERSION}.x | bash -
apt-get install -y nodejs

echo "Creating DTMA config file at \${DTMA_CONFIG_FILE}..."
mkdir -p "$(dirname "\${DTMA_CONFIG_FILE}")"
chown "\${RUN_USER}":"\${RUN_USER}" "$(dirname "\${DTMA_CONFIG_FILE}")"

echo "DTMA_AUTH_TOKEN=\${DTMA_AUTH_TOKEN_VALUE}" > "\${DTMA_CONFIG_FILE}"
echo "AGENTOPIA_API_BASE_URL=\${AGENTOPIA_API_URL_VALUE}" >> "\${DTMA_CONFIG_FILE}"
echo "ACCOUNT_TOOL_ENVIRONMENT_ID=\${ACCOUNT_TOOL_ENV_ID_VALUE}" >> "\${DTMA_CONFIG_FILE}" 
chmod 600 "\${DTMA_CONFIG_FILE}"
chown "\${RUN_USER}":"${dtmaRunUser}" "\${DTMA_CONFIG_FILE}"

echo "Cloning DTMA repository from \${DTMA_REPO_URL} branch \${DTMA_BRANCH}..."
mkdir -p "\${AGENTOPIA_DIR}"
chown "\${RUN_USER}":"\${RUN_USER}" "\${AGENTOPIA_DIR}"

sudo -u "\${RUN_USER}" git clone --branch "\${DTMA_BRANCH}" "\${DTMA_REPO_URL}" "\${DTMA_DIR}"

if [ -d "\${DTMA_DIR}" ]; then
  cd "\${DTMA_DIR}"
  echo "Current directory: $(pwd)"
  ls -la
  
  echo "Installing DTMA dependencies as user \${RUN_USER}..."
  sudo -u "\${RUN_USER}" bash -c "cd \${DTMA_DIR} && npm install --production --unsafe-perm"
  
  echo "Building DTMA as user \${RUN_USER}..."
  sudo -u "\${RUN_USER}" bash -c "cd \${DTMA_DIR} && npm run build"
  
  chown -R "\${RUN_USER}":"\${RUN_USER}" "\${DTMA_DIR}"
else
  echo "Error: Failed to clone DTMA repository into \${DTMA_DIR}." >&2
  exit 1
fi

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

systemctl daemon-reload
systemctl enable dtma.service
systemctl start dtma.service

echo "--- DTMA setup complete ---"
`;
}

// ... rest of manager.ts ...
// The old function signature for createUserDataScript that only took dtmaAuthToken
// and other optional params but not accountToolEnvironmentId should be removed or updated.

// ... rest of the file ... 