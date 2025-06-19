# Agentopia Droplet Tool Management Agent (DTMA)

> **Important:** This directory is a clone of the GitHub repository at https://github.com/maverick-software/dtma-agent.git
> used for deployment to DigitalOcean droplets. The primary development should occur in the `/dtma` directory
> of the main Agentopia project.

## Repository Purpose

This repository contains the code for the Droplet Tool Management Agent (DTMA) which runs on agent-specific DigitalOcean droplets.
It is specifically designed to be:

1. Cloned by DigitalOcean droplets during provisioning
2. Built and run as a systemd service on those droplets

## Directory Structure in Agentopia Project

- `/dtma` - Primary working source code for development
- `/dtma-agent` (this directory) - Cloned GitHub repository for deployment

## Agent Functionality

The DTMA service:

- Receives commands from the main Agentopia backend
- Manages the lifecycle of tools (Docker containers) running on the droplet
- Securely fetches tool secrets from the Agentopia backend
- Reports status and heartbeats back to the Agentopia backend

## Setup & Running on Droplets

- Automatically installed by the bootstrap script during droplet provisioning
- Runs as a systemd service
- Requires Node.js and Docker on the droplet
- Reads configuration (`dtma_auth_token`, `backend_api_url`) from `/etc/dtma.conf` and/or environment variables

## Development Commands

```bash
npm install
npm run dev     # Runs using ts-node-esm for development
npm run build   # Compiles TypeScript to ./dist
npm start       # Runs compiled code from ./dist
```

## Publishing Updates

When making changes to the DTMA code:

1. Develop and test in the primary `/dtma` directory 
2. Copy and commit changes to this repository
3. Push to GitHub
4. New droplets will pull the latest code during provisioning
5. Existing droplets may need manual updates or redeployment 