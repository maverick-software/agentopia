# Agentopia Droplet Tool Management Agent (DTMA)

> **Note:** This directory contains the working source code for the DTMA. 
> The code is also published to a separate GitHub repository at https://github.com/maverick-software/dtma-agent.git
> which is used for deployment to DigitalOcean droplets.

This service runs on agent-specific DigitalOcean droplets.
Its purpose is to:

- Receive commands from the main Agentopia backend.
- Manage the lifecycle of tools (Docker containers) running on the droplet.
- Securely fetch tool secrets from the Agentopia backend.
- Report status and heartbeats back to the Agentopia backend.

## Directory Structure

- `/dtma` (this directory) - Working source code for development
- `/dtma-agent` - Cloned GitHub repository for deployment

## Setup & Running

(Details TBD - likely involves systemd service setup via cloud-init)

- Requires Node.js and Docker on the droplet.
- Reads configuration (`dtma_auth_token`, `backend_api_url`) from `/etc/dtma.conf` and/or environment variables.

### Development

```bash
npm install
npm run dev # Runs using ts-node-esm
```

### Build

```bash
npm run build # Compiles TypeScript to ./dist
```

### Start (Production)

```bash
npm start # Runs compiled code from ./dist
```

## Deployment Process

When making changes to the DTMA code:

1. Develop and test in this directory (`/dtma`)
2. Once changes are ready, push them to the GitHub repository
3. Update the environment variables if needed:
   ```
   DTMA_GIT_REPO_URL=https://github.com/maverick-software/dtma-agent.git
   DTMA_GIT_BRANCH=main
   ```
4. New droplets will pull the latest code from GitHub during provisioning 