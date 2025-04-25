# Agentopia - Discord Bot Integration

Agentopia allows users to create, configure, and manage AI agents via a web UI. This specific project focuses on integrating these agents with Discord, enabling them to be activated and interact within Discord servers using slash commands and mentions.

## Table of Contents

- [Project Overview](#project-overview)
- [Project Structure](#project-structure)
- [Key Components](#key-components)
- [Frontend Performance Optimizations](#frontend-performance-optimizations)
- [Deployed Endpoints & Services](#deployed-endpoints--services)
- [Database Schema](#database-schema)
- [Core Workflows](#core-workflows)
  - [Agent Activation Flow](#agent-activation-flow)
  - [Agent Deactivation Flow](#agent-deactivation-flow)
  - [Agent Message Handling Flow](#agent-message-handling-flow)
- [Development & Setup](#development--setup)
- [Known Issues](#known-issues)
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
│   ├── bugs/             # Bug reports and issues
│   ├── console/          # Console logs directory
│   │   └── logs/         # Logs from console operations
│   ├── context/          # AI context documents and checklists
│   │   └── checklists/   # Task checklists for AI assistants
│   ├── features/
│   ├── plans/
│   ├── project/
│   ├── requirements/
│   ├── __ai__.md
│   ├── _change.logs
│   └── index.md          # Index for docs folder
├── logs/                 # Application logs directory
│   └── README.md         # Logging guide and structure
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
│   │   └── chat/                        # Handles generating agent responses
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
        *   `chat`: Contains the logic for generating an agent's response when it's mentioned, involving calls to an LLM API (like OpenAI) and potentially utilizing RAG with vector stores.
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
        *   Calls the Supabase `chat` function to get responses.
        *   Handles inactivity timeouts (configured via UI/DB).
        *   Updates its status (`active`, `inactive`, `terminating`, `error`) in the `agent_discord_connections` table via the `update_worker_status` RPC function upon startup, shutdown, or error.
*   **Logging Infrastructure (`logs/`):**
    *   Provides dedicated storage for application logs.
    *   Critical for monitoring, debugging, and system maintenance.
    *   Expected log files:
        *   `worker-manager.log` - Logs from the worker manager service
        *   `discord-worker-[agentId].log` - Logs from individual Discord worker processes
        *   `supabase-functions.log` - Logs from Supabase Edge Functions

## Frontend Performance Optimizations

To improve the user experience and eliminate the white flash when navigating between pages, the application implements a multi-layered performance optimization strategy:

### Page Transition Handling

1. **Global Background Color**:
   - HTML and body elements are set with dark backgrounds in `index.css` to eliminate white flashes during initial load or transitions
   - CSS classes apply consistent theme colors to prevent jarring visual changes

2. **Enhanced Loading Indicators**:
   - The `LoadingSpinner` component in `AppRouter.tsx` uses fixed positioning with theme-matched backgrounds
   - Transition opacity effects create smooth fades instead of abrupt content changes
   - The spinner appears during component lazy-loading and page transitions

3. **Layout-level Transition Detection**:
   - The `Layout` component monitors route changes via `useLocation()` from React Router
   - Activates a transitioning state during navigation to show consistent loading indicators
   - Times out automatically to ensure the UI never gets stuck in a loading state

4. **Route Prefetching**:
   - Custom `useRoutePrefetch` hook preloads commonly accessed routes
   - Implemented in `src/hooks/useRoutePrefetch.ts` and applied in `App.tsx`
   - Reduces load time by fetching JavaScript chunks before they're needed

5. **CSS Animation Consistency**:
   - Page transition classes in `index.css` provide standardized animations
   - Components fade in/out with consistent timing and easing functions
   - Prevents layout shifts during transitions

### Implementation Details

Each optimization layer works together to create a seamless experience:

```tsx
// Example: LoadingSpinner with theme-matching background
const LoadingSpinner = () => (
  <div className="fixed inset-0 z-50 flex justify-center items-center 
                  bg-white dark:bg-gray-900 transition-opacity duration-300">
    <div className="animate-spin rounded-full h-16 w-16 
                    border-t-2 border-b-2 border-indigo-500"></div>
  </div>
);
```

```tsx
// Example: Layout transition detection
useEffect(() => {
  setIsTransitioning(true);
  const timer = setTimeout(() => setIsTransitioning(false), 300);
  return () => clearTimeout(timer);
}, [location.pathname]);
```

### Future Maintenance

When modifying the routing or adding new pages:

1. Add new frequently-accessed routes to the `routesToPrefetch` array in `useRoutePrefetch.ts`
2. Maintain consistent loading indicators across all route transitions
3. Ensure new components respect the transition animations and timing
4. Test navigation paths in both light and dark modes to verify no white flashes occur

These optimizations follow React best practices for handling component lazy-loading and route transitions, delivering a polished and professional user experience.

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

## Known Issues

1. **AuthContext.tsx Duplicate Variable Issue:**
   - Error: `Identifier 'isAdmin' has already been declared` in `AuthContext.tsx`
   - The `isAdmin` variable is defined twice in the file, causing a compilation error
   - This is preventing the application from running properly

2. **Missing Logging Infrastructure:**
   - Log directories have been created, but no actual log files exist yet
   - Logging implementation is needed to follow Rule #2 (Review the logs)

3. **Discord Integration Errors:**
   - Issues with the Discord interaction handler shown in bug reports
   - Several "Interaction secret missing or URL format incorrect" errors

4. **Oversized Files:**
   - `AgentEditPage.tsx` (1326 lines) - Well over the 500-line limit
   - `DatastoresPage.tsx` (664 lines) - Over the 500-line limit
   - These files need refactoring according to Philosophy #1 (file size limits)

5. **Previous AgentChatPage Issue:**
   - Previous work involved fixing an issue where `AgentChatPage.tsx` failed to reliably fetch agent data
   - A backup file `AgentChatPage.tsx.bak` exists, suggesting recent changes to fix this issue

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

## Development & Setup

*   **Supabase Edge Functions:** Environment variables for functions (`discord-interaction-handler`, `chat`, `generate-embedding`, etc.) are set in the Supabase project dashboard under Settings -> Edge Functions, or locally via `supabase/functions/.env` if using the CLI.
    *   `SUPABASE_URL`: Your Supabase project URL.
    *   `SUPABASE_ANON_KEY`: Your Supabase project anonymous key (used by functions called with user context).
    *   `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase project service role key (used for admin-level operations).
    *   `SUPABASE_DB_URL`: Your Supabase database connection URL (useful for some DB clients).
    *   `OPENAI_API_KEY`: Your OpenAI API key (used for `chat` and `generate-embedding` functions).
    *   `DISCORD_PUBLIC_KEY`: Your Discord application's public key (for interaction verification).
    *   `DISCORD_APP_ID`: Your Discord application's ID.
    *   `MANAGER_URL`: The URL where your `worker-manager` service is accessible (e.g., `http://localhost:8000` for local dev, or your DigitalOcean Droplet URL).
    *   `MANAGER_SECRET_KEY`: A secret key shared between the manager and Supabase functions for authentication.