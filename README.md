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

*   **Goal:** Provide a platform for creating AI agents that can operate within Discord, collaborate within **Workspaces**, and leverage external tools (MCP) and knowledge (RAG).
*   **Core Technologies:** React/Vite (Frontend), Supabase (Database, Auth, Edge Functions, Vault), Node.js/TypeScript (Backend Services), Discord.js, PM2 (Process Management), DigitalOcean (Droplet for Backend Services).
*   **Key Features:**
    *   Web UI for agent creation and configuration.
    *   **Workspace-based Collaboration:** Manage members (users, agents, teams), channels, and chat within dedicated workspaces.
    *   Discord integration setup (Bot Token, App ID, etc.) per agent.
    *   `/activate` slash command to bring agents online in a server.
    *   Agent responses when mentioned (`@AgentName`).
    *   Management of agent worker processes (`worker-manager`, `discord-worker`).
    *   User Account Management: Registration, login, profiles (via Supabase Auth).
    *   Admin Interface: User and system management (accessed via account dropdown).
    *   RAG via Datastores (e.g., Pinecone).
    *   Multi-Cloud Proxy (MCP) integration.
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
│   ├── plans/            # Feature development plans & WBS checklists
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
│   ├── routing/          # Application routing configuration and components
│   │   ├── index.ts      # Exports main AppRouter
│   │   ├── AppRouter.tsx # Main router component using routeConfig
│   │   ├── ProtectedRoute.tsx # Authentication guard component
│   │   ├── AdminRoute.tsx # Admin role guard component
│   │   ├── routeConfig.tsx # Centralized route definitions
│   │   └── lazyComponents.ts # Lazy loading definitions
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
    *   **Entry Point:** `src/main.tsx` -> `src/App.tsx` -> `Layout.tsx`.
    *   **User Features:** User auth, agent management, team management, datastore management, **Workspace creation/management/chat**. Provides focused workspace view (hiding main sidebar).
    *   **Admin Features:** Accessed via account dropdown in main sidebar (if user has admin role).
    *   Initiates agent activation/deactivation via `manage-discord-worker`.
    *   Interacts with Supabase via JS client & custom hooks.
*   **Supabase Backend (`supabase/`):**
    *   **Database:** Stores configurations for users, agents, teams, workspaces, channels, members, connections, datastores, MCP, etc. See [`database/README.md`](./database/README.md) for details. Uses RLS extensively.
    *   **Authentication:** Handles user login/signup.
    *   **Edge Functions:**
        *   `manage-discord-worker`: UI -> Worker Manager bridge for start/stop.
        *   `discord-interaction-handler`: Discord Interaction Webhook (sig verify, autocomplete, `/activate` -> Worker Manager).
        *   `register-agent-commands`: Registers slash commands.
        *   `chat`: Core LLM/RAG/MCP logic, called by `discord-worker`.
    *   **Database Functions:** RLS helpers (`is_workspace_member`, etc.), `update_worker_status` (RPC for worker self-update).
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
*   **Logging Infrastructure (`logs/`, `docs/console/logs/`):**
    *   **Status:** Currently **NOT IMPLEMENTED**. Log directories are empty.
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

The database utilizes PostgreSQL managed by Supabase. Core entities include users, profiles, roles, teams, agents, datastores, **workspaces, workspace members, chat channels, messages**, and MCP components.

**For a detailed breakdown, refer to:** [`database/README.md`](./database/README.md)

### Row Level Security (RLS) Policies

RLS is enabled on most tables. Key policies include:
*   Users manage their own profiles, agents, datastores.
*   Agents can update their own status (`agent_discord_connections`) via RPC.
*   Workspace access controlled by ownership and `workspace_members` table (via `is_workspace_member` helper).
*   `chat_channels` access **needs RLS correction** (pending migration) to allow members SELECT/INSERT.
*   Admin roles bypass RLS where necessary (e.g., via `SECURITY DEFINER` functions or specific admin policies).

## Known Issues

*   **Missing Logs:** Logging is not implemented (violates Rule #2).
*   **Large Files:** `src/pages/AgentEditPage.tsx` and `src/pages/DatastoresPage.tsx` exceed size limits (violates Philosophy #1).
*   ~~**`chat_channels` RLS:** Needs correction migration to allow members SELECT/INSERT access (causes 403 errors).~~ *(Fixed by `20250428180438...`)*
*   ~~**Frontend Build Error (`AuthContext.tsx`):** Potential duplicate `isAdmin` variable (unverified).~~ *(Likely resolved or unrelated to current state)*
*   **Workspace Chat `handleSubmit`:** Needs refactoring to determine responding agent based on `workspaceMembers`.
*   ~~**Infinite Render Loop (WorkspaceChatInput):** Previously caused by complex state interactions with Radix Popover during @mention suggestions. Resolved by refining state management and debouncing logic.~~ *(Fixed)*
*   ~~**ERR_INSUFFICIENT_RESOURCES:** Previously caused by an infinite loop in `useChatMessages` hook due to incorrect `useEffect` dependency array. Resolved by removing `fetchMessages` and `subscribeToNewMessages` from dependencies.~~ *(Fixed)*
*   ~~**Duplicate Sidebar Layout:** Previously caused by `AppRouter` and `App` both attempting to apply the main `Layout`. Resolved by removing layout logic from `AppRouter`.~~ *(Fixed)*
*   ~~**Incorrect Background Color:** Previously caused by `index.css` overriding theme variables. Resolved by applying `bg-background` correctly.~~ *(Fixed)*

## Current Status & Next Steps

*   **Workspace Refactor:** Phase 1 (DB), Phase 2 (Hooks/API), and significant parts of Phase 3 (UI Components, Routing, Layout) are complete.
*   **Immediate Next Step:** Verify the remaining unchecked items in Phase 3 of the WBS checklist, particularly the `/chat` function logic and the `WorkspaceMemberManager` component implementation.
*   **Pending WBS Tasks:** Complete Phase 3, proceed to Phase 4 (Testing) and Phase 5 (Context Enhancements).

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