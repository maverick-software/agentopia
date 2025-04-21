# Agentopia - Discord Bot Integration

Agentopia allows users to create, configure, and manage AI agents via a web UI. This specific project focuses on integrating these agents with Discord, enabling them to be activated and interact within Discord servers using slash commands and mentions.

## Table of Contents

- [Project Overview](#project-overview)
- [Project Structure](#project-structure)
- [Key Components](#key-components)
- [Deployed Endpoints & Services](#deployed-endpoints--services)
- [Database Schema](#database-schema)
- [Core Workflows](#core-workflows)
  - [Agent Activation Flow](#agent-activation-flow)
  - [Agent Deactivation Flow](#agent-deactivation-flow)
  - [Agent Message Handling Flow](#agent-message-handling-flow)
- [Development & Setup](#development--setup)
- [Current Status & Next Steps](#current-status--next-steps)
- [Deployment](#deployment)

## Project Overview

*   **Goal:** Provide a platform for creating AI agents that can operate within Discord.
*   **Core Technologies:** React/Vite (Frontend), Supabase (Database, Auth, Edge Functions), Node.js/TypeScript (Backend Services), Discord.js, PM2 (Process Management), DigitalOcean (Droplet for Backend Services).
*   **Key Features:**
    *   Web UI for agent creation and configuration.
    *   Discord integration setup (Bot Token, App ID, etc.).
    *   `/activate` slash command to bring agents online in a server.
    *   Agent responses when mentioned (`@AgentName`).
    *   Management of agent worker processes.
    *   **User Account Management:** Supports user registration, login, and profile management (via Supabase Auth).
    *   **Admin Interface:** Provides administrative controls for managing users and system settings (details pending).
    *   Digital Ocean Login -     ssh -i c:/users/<user>/ssh_key_filename root@165.22.172.98

## Project Structure

```
.
├── .cursor/              # Cursor AI configuration/rules
├── .git/                 # Git repository data
├── docs/                 # Project documentation (protocols, context, checklists, bugs)
│   ├── bugs/
│   ├── context/
│   ├── features/
│   ├── plans/
│   ├── project/
│   ├── requirements/
│   ├── __ai__.md
│   ├── _change.logs
│   └── index.md          # Index for docs folder
├── node_modules/         # Node.js dependencies (managed by package.json)
├── public/               # Static assets for Vite frontend
├── scripts/              # Utility scripts
├── services/             # Backend microservices (run on DigitalOcean Droplet)
│   ├── discord-worker/   # Node.js process that connects to Discord Gateway as a specific agent
│   └── worker-manager/   # Node.js service to manage/launch discord-worker instances via PM2 API
├── src/                  # Frontend source code (React/Vite)
│   ├── components/       # Reusable UI components
│   ├── contexts/         # React contexts (e.g., Auth)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Library initializations (e.g., Supabase)
│   ├── pages/            # Page components (e.g., AgentEdit, Dashboard)
│   └── types/            # Shared TypeScript type definitions for frontend
├── supabase/             # Supabase specific files
│   ├── functions/        # Supabase Edge Functions
│   │   ├── discord-interaction-handler/ # Handles incoming interactions (commands, autocomplete) from Discord
│   │   ├── manage-discord-worker/     # Handles start/stop requests from the UI
│   │   ├── register-agent-commands/     # Registers slash commands with Discord
│   │   └── chat/                        # (Likely) Handles generating agent responses
│   └── migrations/       # Database migration files
│   └── seed.sql          # Initial database seeding (if applicable)
├── utils/                # General utility functions (shared across project if needed)
├── .env                  # Root environment variables (primarily for frontend/Vite)
├── .gitignore            # Git ignore rules
├── ecosystem.config.js   # PM2 configuration (used by worker-manager, potentially for itself)
├── eslint.config.js      # ESLint configuration
├── index.html            # Main HTML entry point for Vite frontend
├── logs.txt              # Temporary log file used during recent debugging
├── package-lock.json     # NPM dependency lock file
├── package.json          # Project dependencies and scripts
├── page.tsx              # Root frontend component/entry point
├── postcss.config.js     # PostCSS configuration (for Tailwind)
├── README.md             # This file
├── tailwind.config.js    # Tailwind CSS configuration
├── tsconfig.app.json     # TypeScript config for the frontend app
├── tsconfig.json         # Base TypeScript configuration
├── tsconfig.node.json    # TypeScript config for Node.js parts (services)
└── vite.config.ts        # Vite build tool configuration
```

## Key Components

*   **Frontend (`src/`):**
    *   Built with React, Vite, and TypeScript.
    *   Styled with Tailwind CSS.
    *   **Entry Point:** `src/main.tsx` renders `src/App.tsx`, which handles routing and context providers (like `AuthContext`).
    *   **User Features:** Allows users to register, log in (via Supabase Auth), create/edit agents (name, personality, instructions), and configure Discord connection details (Bot Token, App ID, Public Key, timeout).
    *   **Admin Features:** Includes an admin interface for user management and potentially other system-level configurations.
    *   Initiates activation/deactivation requests via the `manage-discord-worker` Supabase function.
    *   Interacts with the Supabase database via the Supabase JS client.
    *   **Note:** The previous functionality to select a specific Discord channel for the agent has been removed. Future updates will allow managing the agent's presence across multiple servers via a dedicated interface.
*   **Supabase Backend (`supabase/`):**
    *   **Database:** Stores agent configurations (`agents` table), Discord connection details and status (`agent_discord_connections` table), user data, etc. Uses Row Level Security (RLS), with specific bypasses managed via `SECURITY DEFINER` functions. RLS policies are confirmed enabled and correctly implemented (see RLS section below).
    *   **Authentication:** Handles user login/signup.
    *   **Edge Functions:** Serverless functions for handling specific backend tasks.
        *   `manage-discord-worker`: Receives requests from the frontend UI to start or stop a specific agent's Discord worker. Calls the `worker-manager` service.
        *   `discord-interaction-handler`: Receives HTTPS requests from Discord for interactions (e.g., slash commands like `/activate`). Verifies request signatures, fetches data from Supabase DB, and may also call the `worker-manager` service (e.g., for activation via slash command).
        *   `register-agent-commands`: Registers the necessary slash commands (e.g., `/activate`) with Discord's API for specific agents/guilds.
        *   `chat`: (Presumed) Contains the logic for generating an agent's response when it's mentioned, likely involving calls to an LLM API (e.g., OpenAI).
    *   **Database Functions:**
        *   `update_worker_status` (`SECURITY DEFINER`): Allows the `discord-worker` (running potentially with limited Supabase permissions/anon key) to update its own status in the `agent_discord_connections` table, bypassing RLS for this specific action. Called via RPC (`supabase.rpc(...)`).
*   **Backend Services (`services/`):**
    *   Designed to run persistently on a separate server (e.g., DigitalOcean Droplet) managed by PM2.
    *   Written in Node.js and TypeScript.
    *   **`worker-manager`**:
        *   A Node.js service (potentially an Express API, or simpler script).
        *   Listens for requests from Supabase functions (`manage-discord-worker`, `discord-interaction-handler`) to start/stop workers.
        *   Uses the **PM2 programmatic API** (`pm2.start`, `pm2.stop`) to manage the lifecycle of `discord-worker` processes.
        *   Launches `discord-worker` instances using `ts-node` directly.
    *   **`discord-worker`**:
        *   A Node.js process launched and managed by the `worker-manager` via PM2.
        *   Connects to the Discord Gateway using a specific agent's bot token.
        *   Listens for mentions of the agent within Discord channels.
        *   Calls the Supabase `chat` function (presumably) to get responses.
        *   Handles inactivity timeouts (configured via UI/DB).
        *   Updates its status (`active`, `inactive`, `terminating`, `error`) in the `agent_discord_connections` table via the `update_worker_status` RPC function upon startup, shutdown, or error.

## Deployed Endpoints & Services

*   **Git Repository:** `[Your Git Repository URL]` (Please update this link)
*   **Frontend (Netlify):** [`https://agentopia.netlify.app/`](https://agentopia.netlify.app/)
*   **Worker Manager (DigitalOcean):** `http://165.22.172.98:8000` (Note: Runs on a Droplet, IP: `165.22.172.98`, Port: `8000`)
*   **Supabase Project:** `[Your Supabase Project Dashboard URL]` (Contains Database, Auth, Edge Functions)

## Database Schema

Based on the provided schema diagram, the core tables are:

*   **`auth.users`**: Standard Supabase table for user authentication.
*   **`agents`**: Stores the main configuration for each AI agent.
    *   `id`: Primary Key.
    *   `user_id`: Foreign Key referencing `auth.users.id` (owner of the agent).
    *   `name`: Agent's display name.
    *   `description`: Description of the agent.
    *   `personality`: Instructions defining the agent's behavior/persona.
    *   `active`: Boolean indicating if the agent is generally active (may not reflect Discord connection status).
    *   `discord_channel`, `system_instructions`, `discord_bot_token_id`, `discord_user_id`: Fields likely related to Discord setup, potentially including secrets or IDs.
    *   `created_at`, `updated_at`: Timestamps.
*   **`agent_discord_connections`**: Tracks the specific connection details and status for an agent within a Discord server (guild). **Note:** This table is being modified to support multi-server enabling/disabling instead of a single guild/channel connection per agent.
    *   `id`: Primary Key.
    *   `agent_id`: Foreign Key referencing `agents.id`.
    *   `guild_id`: The ID of the Discord server (guild) the agent is connected to.
    *   `is_enabled`: (New) Boolean indicating if the connection for this specific guild is active.
    *   `discord_app_id`, `discord_public_key`: Discord application credentials.
    *   `inactivity_timeout_ms`: Timeout duration for the worker process.
    *   `worker_status`: Tracks the current state of the `discord-worker` process (e.g., `inactive`, `connecting`, `active`, `terminating`, `error`). Updated via RPC.
    *   `created_at`: Timestamp.
*   **`datastores`**: Represents collections of data (e.g., documents for RAG).
    *   `id`: Primary Key.
    *   `user_id`: Foreign Key referencing `auth.users.id` (owner of the datastore).
    *   `name`, `description`, `type`, `config`: Configuration details for the datastore.
    *   `similarity_metric`, `similarity_threshold`, `max_results`: Parameters likely for vector search/RAG.
    *   `created_at`, `updated_at`: Timestamps.
*   **`agent_datastores`**: A join table linking agents to the datastores they can access.
    *   `agent_id`: Foreign Key referencing `agents.id`.
    *   `datastore_id`: Foreign Key referencing `datastores.id`.
    *   `created_at`: Timestamp.
*   **`mcp_configurations`**: (MCP likely stands for 'Multi-Cloud Proxy' or similar) Configuration settings for agents related to backend infrastructure/proxying.
    *   `id`: Primary Key.
    *   `agent_id`: Foreign Key referencing `agents.id`.
    *   `is_enabled`: Whether this configuration is active.
    *   `created_at`, `updated_at`: Timestamps.
*   **`mcp_servers`**: Defines available backend servers/endpoints the MCP can use.
    *   `id`: Primary Key.
    *   `config_id`: Foreign Key referencing `mcp_configurations.id`.
    *   `name`: Server name.
    *   `endpoint_url`: The URL of the backend server.
    *   `vault_id`, `vault_item_id`: References to secrets stored potentially in HashiCorp Vault (or similar).
    *   `timeout_ms`, `max_retries`, `retry_backoff_ms`, `priority`, `is_active`, `capabilities`: Parameters defining server behavior, health, and features.
    *   `created_at`, `updated_at`: Timestamps.
*   **`user_secrets`**: Seems to link users to secrets stored in a vault, likely referenced by `mcp_servers`.
    *   `id`: Primary Key.
    *   `user_id`: Foreign Key referencing `auth.users.id`.
    *   `vault_id`, `vault_item_id`: References to secrets.
    *   `created_at`, `updated_at`: Timestamps.

**Relationships:**

*   A `user` can have multiple `agents`, `datastores`, and `user_secrets`.
*   An `agent` belongs to one `user`.
*   An `agent` can have multiple `agent_discord_connections` (one per guild/connection).
*   An `agent` can be associated with multiple `datastores` via `agent_datastores`.
*   An `agent` can have one `mcp_configurations` record.
*   An `mcp_configurations` record can have multiple `mcp_servers`.
*   An `mcp_server` references secrets likely detailed further via `user_secrets` and the associated user.

### Row Level Security (RLS) Policies (Verified 2025-04-18)

RLS is confirmed ENABLED and correctly implemented on the relevant tables:

**`agents` Table:**
*   Policy: `Allow full access to own agents`
*   Role: `authenticated`
*   Commands: `ALL`
*   Expression: `auth.uid() = user_id` (for both `USING` and `WITH CHECK`)
*   *Ensures users can only interact with their own agents.*

**`agent_discord_connections` Table:**
*   Policy: `Allow full access to connections for own agents`
*   Role: `authenticated`
*   Commands: `ALL`
*   Expression: `is_agent_owner(agent_id)` (for both `USING` and `WITH CHECK`)
*   *Ensures users can only interact with connections belonging to agents they own (via the `is_agent_owner` SQL function).*

*(Previous documentation noting multiple insecure policies was outdated/incorrect).*

## Core Workflows

### Agent Activation Flow

This diagram shows how an agent is activated, typically initiated from the **Agentopia UI**.

```mermaid
sequenceDiagram
    participant User via UI
    participant Agentopia Frontend
    participant Supabase Edge Function (manage-discord-worker)
    participant DigitalOcean Droplet (Worker Manager)
    participant PM2
    participant DigitalOcean Droplet (Discord Worker - New Process)
    participant Discord API / Gateway
    participant Supabase DB (RPC: update_worker_status)

    User via UI->>Agentopia Frontend: Clicks 'Activate' button for an agent
    Agentopia Frontend->>Supabase Edge Function (manage-discord-worker): Sends Request (POST /manage-discord-worker {agentId, action: 'start'})
    Supabase Edge Function (manage-discord-worker)->>Supabase DB: Query agent details (token, timeout, etc.)
    Supabase DB-->>Supabase Edge Function (manage-discord-worker): Returns Agent Details
    Supabase Edge Function (manage-discord-worker)->>DigitalOcean Droplet (Worker Manager): Sends Start Request (e.g., POST /start {agentId, botToken, timeout})
    Supabase Edge Function (manage-discord-worker)-->>Agentopia Frontend: Responds with ACK/Status
    Agentopia Frontend->>User via UI: Updates UI (e.g., "Activating...")
    DigitalOcean Droplet (Worker Manager)->>PM2: Calls pm2.start(script: 'discord-worker/src/worker.ts', args: [agentId, botToken, timeout], name: agentId, interpreter: 'ts-node')
    PM2->>DigitalOcean Droplet (Discord Worker - New Process): Spawns new TS process via ts-node
    DigitalOcean Droplet (Discord Worker - New Process)->>Supabase DB (RPC: update_worker_status): Calls RPC to set status='connecting'
    DigitalOcean Droplet (Discord Worker - New Process)->>Discord API / Gateway: Connects to Gateway using Bot Token
    Discord API / Gateway-->>DigitalOcean Droplet (Discord Worker - New Process): Connection successful (READY event)
    DigitalOcean Droplet (Discord Worker - New Process)->>Supabase DB (RPC: update_worker_status): Calls RPC to set status='active'
    Note over DigitalOcean Droplet (Discord Worker - New Process), Discord API / Gateway: Agent is now online and listening
```

*(Note: Activation might also be triggerable via `/activate` slash command, which would involve `discord-interaction-handler` instead of `manage-discord-worker` initially).*

### Agent Deactivation Flow

This diagram shows how an agent is deactivated, typically initiated from the **Agentopia UI**.

```mermaid
sequenceDiagram
    participant User via UI
    participant Agentopia Frontend
    participant Supabase Edge Function (manage-discord-worker)
    participant DigitalOcean Droplet (Worker Manager)
    participant PM2
    participant DigitalOcean Droplet (Discord Worker - Running Process)
    participant Discord API / Gateway
    participant Supabase DB (RPC: update_worker_status)

    User via UI->>Agentopia Frontend: Clicks 'Deactivate' button for an agent
    Agentopia Frontend->>Supabase Edge Function (manage-discord-worker): Sends Request (POST /manage-discord-worker {agentId, action: 'stop'})
    Supabase Edge Function (manage-discord-worker)->>DigitalOcean Droplet (Worker Manager): Sends Stop Request (e.g., POST /stop {agentId})
    Supabase Edge Function (manage-discord-worker)-->>Agentopia Frontend: Responds with ACK/Status
    Agentopia Frontend->>User via UI: Updates UI (e.g., "Deactivating...")
    DigitalOcean Droplet (Worker Manager)->>PM2: Calls pm2.stop(agentId)
    PM2->>DigitalOcean Droplet (Discord Worker - Running Process): Sends SIGINT signal to process
    DigitalOcean Droplet (Discord Worker - Running Process)->>Supabase DB (RPC: update_worker_status): Calls RPC to set status='terminating' (in shutdown handler)
    DigitalOcean Droplet (Discord Worker - Running Process)->>Discord API / Gateway: Disconnects from Gateway
    DigitalOcean Droplet (Discord Worker - Running Process)->>Supabase DB (RPC: update_worker_status): Calls RPC to set status='inactive' (before exit)
    Note over DigitalOcean Droplet (Discord Worker - Running Process): Process exits gracefully
```

### Agent Message Handling Flow

This diagram shows how an agent responds when mentioned in Discord.

```mermaid
sequenceDiagram
    participant User in Discord
    participant Discord API / Gateway
    participant DigitalOcean Droplet (Discord Worker)
    participant Supabase Edge Function (Chat)
    participant LLM API (e.g., OpenAI)
    participant Supabase DB

    User in Discord->>Discord API / Gateway: Sends message mentioning @AgentName
    Discord API / Gateway->>DigitalOcean Droplet (Discord Worker): Forwards MESSAGE_CREATE event
    DigitalOcean Droplet (Discord Worker)->>Supabase Edge Function (Chat): Calls function with message content, context, agent details
    Supabase Edge Function (Chat)->>Supabase DB: (Optional) Fetch agent personality, history
    Supabase DB-->>Supabase Edge Function (Chat): Return data
    Supabase Edge Function (Chat)->>LLM API (e.g., OpenAI): Request completion based on prompt
    LLM API (e.g., OpenAI)-->>Supabase Edge Function (Chat): Returns generated response
    Supabase Edge Function (Chat)-->>DigitalOcean Droplet (Discord Worker): Returns response text
    DigitalOcean Droplet (Discord Worker)->>Discord API / Gateway: Sends response message to channel
    Discord API / Gateway->>User in Discord: Displays agent's message
```

## Development & Setup

To set up and run this project locally for development purposes, follow these steps:

**Prerequisites:**

*   **Node.js:** (Version 18.x or later recommended) - Download from [nodejs.org](https://nodejs.org/)
*   **npm:** (Usually included with Node.js)
*   **Git:** For cloning the repository.
*   **Supabase Account:** Required for the database, auth, and edge functions. Get started at [supabase.com](https://supabase.com/).
*   **Supabase CLI:** (Optional but recommended for local function development) Install via npm: `npm install supabase --save-dev` or follow [official instructions](https://supabase.com/docs/guides/cli).
*   **Discord Application & Bot:** You'll need a Discord application with a bot user created. Find instructions in the [Discord Developer Portal](https://discord.com/developers/docs/intro).

**1. Clone the Repository:**

```bash
git clone [Your Git Repository URL] # Replace with actual URL
cd [repository-directory-name]
```

**2. Install Dependencies:**

Install dependencies for the root (frontend), worker-manager, and discord-worker.

```bash
# From the root directory
npm install

# Navigate to worker-manager service
cd services/worker-manager
npm install
cd ../..

# Navigate to discord-worker service
cd services/discord-worker
npm install
cd ../..
```

**3. Environment Variables:**

Environment variables are crucial for connecting services. Create `.env` files in the following locations and populate them with your specific keys and URLs. **Never commit `.env` files to Git.**

*   **Root Directory (`./.env`):** For the Vite frontend.
    *   `VITE_SUPABASE_URL`: Your Supabase project URL.
    *   `VITE_SUPABASE_ANON_KEY`: Your Supabase project anonymous key.

*   **Worker Manager (`./services/worker-manager/.env`):**
    *   `PORT`: Port the manager service will listen on (e.g., `8000`).
    *   `SUPABASE_URL`: Your Supabase project URL.
    *   `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase project service role key (**Keep this secret!**).
    *   `MANAGER_SECRET_KEY`: A secret key shared between the manager and Supabase functions for authentication (**Generate a strong secret**).
    *   `WORKER_SCRIPT_PATH`: Path to the discord-worker entry point (e.g., `../discord-worker/src/worker.ts`). Used by PM2.

*   **Discord Worker (`./services/discord-worker/.env`):**
    *   `SUPABASE_URL`: Your Supabase project URL.
    *   `SUPABASE_ANON_KEY`: Your Supabase project **anonymous key** (used for calling the `update_worker_status` RPC function).
    *   `OPENAI_API_KEY`: (If using OpenAI for the `chat` function) Your OpenAI API key.

*   **Supabase Edge Functions:** Environment variables for functions (`discord-interaction-handler`, `chat`, etc.) are set in the Supabase project dashboard under Settings -> Edge Functions, or locally via `supabase/functions/.env` if using the CLI.
    *   `DISCORD_PUBLIC_KEY`: Your Discord application's public key.
    *   `DISCORD_APP_ID`: Your Discord application's ID.
    *   `SUPABASE_URL`: Your Supabase project URL.
    *   `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase project service role key.
    *   `MANAGER_URL`: The URL where your `worker-manager` service is accessible (e.g., `http://localhost:8000` for local dev, or your DigitalOcean Droplet URL).
    *   `MANAGER_SECRET_KEY`: The same secret key used in the `worker-manager` .env.
    *   `OPENAI_API_KEY`: (For the `chat` function, if applicable) Your OpenAI API key.

**4. Running Locally:**

*   **Frontend (Vite Dev Server):**
    ```bash
    # From the root directory
    npm run dev
    ```
    Access the frontend at `http://localhost:5173` (or the port specified by Vite).

*   **Worker Manager (using ts-node for development):**
    ```bash
    # From the root directory
    cd services/worker-manager
    npx ts-node src/manager.ts
    ```

*   **Discord Worker:** This is typically *not* run directly in development, as the `worker-manager` spawns it. Ensure the `WORKER_SCRIPT_PATH` in the manager's `.env` points correctly to the worker's entry point (either compiled JS or TS source if using ts-node).

*   **Supabase Edge Functions (using Supabase CLI):**
    ```bash
    # From the root directory
    # Ensure Docker Desktop is running
    supabase start # Starts local Supabase instance (DB, Auth, Storage)
    supabase functions serve --env-file ./supabase/functions/.env
    ```
    This serves your functions locally, typically accessible via `http://localhost:54321/functions/v1/`. Update `MANAGER_URL` in function envs accordingly.

**5. Supabase Database Types:**

To ensure type safety when interacting with the Supabase database from the frontend, TypeScript types are generated based on your database schema.

*   **Location:** The generated types are stored in `src/types/database.types.ts`.
*   **Generation/Update:** Run the following command whenever your database schema changes:
    ```bash
    supabase gen types typescript --linked > src/types/database.types.ts
    ```
    *(Note: This requires you to be logged in (`supabase login`) and linked to your project (`supabase link`)).*
*   **Automation (Recommended):** Add a script to your root `package.json` for convenience:
    ```json
    // package.json
    {
      "scripts": {
        // ... other scripts
        "sync-types": "supabase gen types typescript --linked > src/types/database.types.ts"
      }
    }
    ```
    Then you can simply run `npm run sync-types`.

**Note:** For local development involving Discord interactions, you'll need a way to expose your local Supabase functions endpoint and potentially your worker-manager service to the internet so Discord can send webhooks. Tools like `ngrok` or the `Cloudflare Tunnel` can achieve this.

## Current Status & Next Steps

*   **Status:** The agent activation/deactivation workflow is functional. The `worker-manager` uses PM2 API to manage `discord-worker` processes. RLS issues with status updates resolved via `update_worker_status` RPC. The Discord channel selection UI/feature has been removed.
*   **Immediate Next Steps:**
    1.  **Re-enable RLS:** Row Level Security was disabled on `agent_discord_connections` and `agents` tables during debugging. It needs to be **re-enabled** in the Supabase dashboard. The `update_worker_status` function should allow status updates to continue working correctly.
    2.  **Verify Deactivation:** Thoroughly test the agent deactivation flow from the UI.
    3.  **Multi-Server UI:** Implement the frontend UI for managing agent presence across multiple Discord servers (enable/disable per server).
    4.  **Backend Multi-Server Logic:** Update `manage-discord-worker` and `discord-interaction-handler` functions to handle the new multi-server activation/deactivation model based on the `is_enabled` flag in `agent_discord_connections`.
    5.  **Review RLS (`agents` table):** Determine if RLS policies are needed for the `agents` table (e.g., users can only see/edit their own agents) and implement them.
    6.  **Establish Logging:** Create the standard log directory (`./logs/`) and implement robust logging within the `worker-manager` and `discord-worker` services, adhering to project conventions (RULE #2).
    7.  **Code Cleanup:** Remove temporary diagnostic logs added during troubleshooting.

## Deployment

*   **Frontend:** Typically deployed via a static hosting provider like Netlify or Vercel, connected to the Git repository.
*   **Supabase:** Functions and database changes are deployed using the Supabase CLI (`supabase functions deploy`, `supabase db push`) or via Git integration if configured.
*   **Backend Services (`worker-manager`):**
    *   Requires a server environment (like a DigitalOcean Droplet) with Node.js and PM2 installed (`npm install pm2 -g`).
    *   Copy the `services/worker-manager` and `services/discord-worker` directories to the server.
    *   Install dependencies on the server (`npm install` in both directories).
    *   Compile TypeScript (if not using `ts-node` in production): `npm run build` (assuming build scripts in `package.json`).
    *   Configure the production `.env` file for `worker-manager`.
    *   Start the `worker-manager` using PM2: `pm2 start path/to/services/worker-manager/dist/manager.js --name worker-manager` (or similar, potentially using an `ecosystem.config.js` file for more options).
    *   Ensure the server's firewall allows traffic on the port the `worker-manager` listens on (e.g., 8000).
*   **Discord Worker:** This is typically *not* run directly in production, as the `worker-manager` spawns it. Ensure the `WORKER_SCRIPT_PATH` in the manager's `.env` points correctly to the worker's entry point.

## Known Issues & Current Priorities (as of 2025-04-18)

Based on the latest analysis (`docs/context/ai_context_2025-04-18_1919.mdc`):

1.  ~~RLS Policies Need Review (Critical): Row Level Security is enabled for `agents` and `agent_discord_connections`, but the existing policies require review and correction in Supabase to ensure security and proper function.~~ *(Resolved: RLS Verified Correct)*
2.  **Missing Standard Logging:** ~~The expected logging directory (`docs/console/logs/`) does not exist.~~ Structured logging needs implementation across backend services/functions. *(Partially resolved: Directory created, service loggers updated, function logging basic)*.
3.  **Documentation Mismatch:** `docs/index.md` lists an incorrect frontend entry point (`page.tsx` instead of `src/main.tsx`). (Corrected in this README).
4.  **Informal Bug Tracking:** The `docs/bugs/` directory currently contains log dumps rather than structured bug reports. A formal process/template is needed.
5.  **Testing Required:** The recently refactored Discord configuration UI (`DiscordConnect.tsx`, `DiscordModals.tsx`) requires thorough end-to-end testing.
6.  **Potential Code Cleanup:** Review needed to remove any leftover diagnostic code from previous debugging sessions.