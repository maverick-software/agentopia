# Agentopia Droplet Tool Management Agent (DTMA)

This service runs on agent-specific DigitalOcean droplets.
Its purpose is to:

- Receive commands from the main Agentopia backend.
- Manage the lifecycle of tools (Docker containers) running on the droplet.
- Securely fetch tool secrets from the Agentopia backend.
- Report status and heartbeats back to the Agentopia backend.

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