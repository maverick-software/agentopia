import { CreateToolboxUserDataScriptOptions } from './manager.types.ts';

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createToolboxUserDataScript(options: CreateToolboxUserDataScriptOptions): string {
  const { dtmaBearerToken, agentopiaApiBaseUrl, backendToDtmaApiKey, dtmaDockerImageUrl } = options;

  console.log('Creating user data script for Dockerized DTMA with configuration:');
  console.log(`- Agentopia API URL: ${agentopiaApiBaseUrl}`);
  console.log(`- DTMA Docker Image: ${dtmaDockerImageUrl}`);

  const logFile = '/var/log/dtma-bootstrap.log';

  return `#!/bin/bash
set -e
set -x

LOG_FILE="${logFile}"
touch "\${LOG_FILE}"
exec &> >(tee -a "\${LOG_FILE}")

DTMA_CONTAINER_NAME="dtma_manager"
export DEBIAN_FRONTEND=noninteractive

echo "--- Starting DTMA Docker Setup Script ---"

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

echo "--- Deploying Agentopia Backend Server Container ---"
BACKEND_CONTAINER_NAME="agentopia_backend"

docker stop "\${BACKEND_CONTAINER_NAME}" || true
docker rm "\${BACKEND_CONTAINER_NAME}" || true

echo "Pulling Agentopia Backend Docker image: ${options.backendDockerImageUrl}..."
docker pull "${options.backendDockerImageUrl}"

echo "Running Agentopia Backend Server container..."
docker run -d \
  --name "\${BACKEND_CONTAINER_NAME}" \
  --restart always \
  -p 3000:3000 \
  --link dtma_manager:dtma \
  -e PORT=3000 \
  -e INTERNAL_API_SECRET='${options.internalApiSecret}' \
  -e BACKEND_TO_DTMA_API_KEY='${options.backendToDtmaApiKey}' \
  -e DO_API_TOKEN='${options.doApiToken}' \
  -e SUPABASE_URL='${options.agentopiaApiBaseUrl}' \
  -e SUPABASE_SERVICE_ROLE_KEY='${options.supabaseServiceRoleKey}' \
  -e DTMA_URL='http://dtma:30000' \
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \
  "${options.backendDockerImageUrl}"

echo "Waiting for backend server to start..."
sleep 5

echo "Checking backend server status..."
docker ps | grep agentopia_backend || echo "Backend server container not running!"
docker logs agentopia_backend --tail 10 || echo "Could not get backend server logs"

echo "--- Complete Docker Setup Finished ---"
`;
}
