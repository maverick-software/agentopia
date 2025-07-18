# Agentopia - Agent Creation & Collaboration Platform

Agentopia allows users to create, configure, and manage AI agents via a web UI. These agents can collaborate within Workspaces, interact with Discord, leverage external tools (MCP), and access knowledge bases (RAG).

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the App](#running-the-app)
- [Design System](#design-system)
- [Database Schema](#database-schema)
- [Supabase Functions](#supabase-functions)
- [Tool Use Infrastructure](#tool-use-infrastructure)
- [Backend Services](#backend-services)
- [Core Workflows](#core-workflows)
- [Known Issues & Refactoring](#known-issues--refactoring)
- [Recent Improvements](#recent-improvements)
- [Current Status & Next Steps](#current-status--next-steps)
- [Deployment](#deployment)

## Project Overview

*   **Goal:** Provide a platform for creating AI agents that can operate within Discord, collaborate within **Workspaces**, and leverage external tools (MCP) and knowledge (RAG).
*   **Focus:** Web UI for management, Workspace-centric collaboration, optional Discord integration.

## Features

*   User Authentication (Supabase Auth)
*   Agent Creation & Configuration
*   Team Management
*   Datastore Management (Pinecone RAG)
*   Knowledge Graph Integration (GetZep) for advanced memory, contextual understanding, and reasoning.
*   **Workspace Collaboration:**
    *   Create/Manage Workspaces
    *   Manage Workspace Members (Users, Agents, Teams)
    *   Manage Workspace Channels
    *   Real-time Chat within Workspace Channels
    *   Configurable Agent Context Window (Size & Token Limit)
*   MCP (Multi-Cloud Proxy) Integration
*   Agent Mentions (`@AgentName`) within Chat
*   Admin Interface
*   (Optional) Discord Integration:
    *   Activate/Deactivate agents in Discord servers
    *   Agent responses via Discord mentions

## Tech Stack

*   **Frontend:** React, Vite, TypeScript, Tailwind CSS, Shadcn UI, Lucide React
*   **Backend/DB:** Supabase (PostgreSQL, Auth, Edge Functions, Realtime, Vault)
*   **AI:** OpenAI (Embeddings, Chat Completions)
*   **Vector DB:** Pinecone
*   **Discord Integration:** Discord.js (Node.js)
*   **Backend Services Host:** DigitalOcean Droplet (Managed by PM2)
*   **Process Management:** PM2
*   **Knowledge Graph:** GetZep

## Project Structure

*(High-level overview of the Agentopia monorepo)*

```
.
├── .bolt/                # Bolt local development environment configuration
├── .cursor/              # Cursor AI configuration, rules, and context
├── .git/                 # Git version control files (typically hidden)
├── archived/             # Archived or deprecated code and resources
├── backups/              # Backup files
├── database/             # Database related files (e.g., local seeds, schemas - distinct from supabase/migrations)
├── discord-gateway-client/ # Client for interacting with Discord Gateway (potential core for discord-worker)
├── dist/                 # Build output directory (e.g., for frontend or services)
├── docs/                 # Project documentation (protocols, context, plans, ADRs)
├── dtma/                 # Droplet Tool Management Agent (DTMA) related code/configuration
├── dtma-agent/           # Code for the DTMA agent that runs on provisioned droplets
├── logs/                 # Application and service logs
├── node_modules/         # Project dependencies (typically hidden and not version controlled)
├── public/               # Static assets for the Vite frontend (images, fonts, etc.)
├── scripts/              # Utility scripts for development, deployment, or tasks
├── services/             # Backend microservices
│   ├── discord-worker/   # Connects a specific agent to Discord Gateway
│   ├── reasoning-mcp-server/ # Server for Multi-Cloud Proxy (MCP) reasoning capabilities
│   └── worker-manager/   # Manages discord-worker instances (e.g., via PM2 API)
├── src/                  # Frontend source code (React/Vite/TypeScript)
│   ├── app/              # Next.js 13+ app directory structure (if migrating/using)
│   ├── components/       # Reusable UI components (incl. /ui with Shadcn)
│   ├── contexts/         # React contexts (Authentication, Database, etc.)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Library initializations (Supabase client, utility functions)
│   ├── pages/            # Page components (may be partially or fully replaced by /app)
│   ├── styles/           # Global styles and Tailwind base configuration
│   └── types/            # Shared TypeScript type definitions
├── supabase/             # Supabase specific backend files
│   ├── functions/        # Supabase Edge Functions (serverless backend logic)
│   └── migrations/       # Database schema migration files
├── utils/                # General utility functions shared across the project
├── .env                  # Example or local environment variables (SHOULD NOT BE COMMITTED if it contains secrets)
├── .gitignore            # Specifies intentionally untracked files that Git should ignore
├── components.json       # Configuration for Shadcn UI components
├── eslint.config.js      # ESLint configuration file
├── index.html            # Main HTML entry point for the Vite frontend
├── package.json          # Defines project dependencies and scripts
├── postcss.config.js     # PostCSS configuration
├── README.md             # This file - project overview and developer guide
├── tailwind.config.js    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript compiler options for the project
├── tsconfig.app.json     # TypeScript compiler options specific to the frontend app
├── tsconfig.node.json    # TypeScript compiler options for Node.js parts (e.g., scripts, services)
└── vite.config.ts        # Vite build tool configuration
```

## Getting Started

### Prerequisites

*   Node.js (v18 or higher recommended)
*   npm or yarn
*   Supabase Account & Project
*   (Optional) DigitalOcean Account & Droplet (for backend services)
*   (Optional) Discord Application & Bot Token (for Discord features)
*   (Optional) OpenAI API Key
*   (Optional) Pinecone API Key & Environment

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd Agentopia
    ```
2.  Install frontend dependencies:
    ```bash
    npm install
    ```
3.  (If running backend services) Install dependencies for services:
    ```bash
    cd services/discord-worker && npm install && cd ../..
    cd services/worker-manager && npm install && cd ../..
    ```

### Environment Variables

1.  **Frontend:** Create a `.env` file in the root directory based on `.env.example` (if provided) or the variables below:
    *   `VITE_SUPABASE_URL`: Your Supabase project URL.
    *   `VITE_SUPABASE_ANON_KEY`: Your Supabase project anonymous key.
2.  **Supabase Functions:** Configure environment variables in the Supabase project dashboard (Settings -> Edge Functions):
    *   `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase project service role key.
    *   `OPENAI_API_KEY`: Your OpenAI API key.
    *   `DISCORD_PUBLIC_KEY`: (If using Discord) Your Discord application's public key.
    *   `DISCORD_APP_ID`: (If using Discord) Your Discord application's ID.
    *   `PINECONE_API_KEY`: (If using Pinecone) Your Pinecone API key.
    *   `PINECONE_ENVIRONMENT`: (If using Pinecone) Your Pinecone environment.
    *   `MANAGER_URL`: (If using backend services) URL of the deployed `worker-manager`.
    *   `MANAGER_SECRET_KEY`: Shared secret between Supabase functions and `worker-manager`.
3.  **(Optional) Backend Services:** Create `.env` files within `services/worker-manager` and `services/discord-worker` containing necessary secrets (Supabase keys, Discord tokens, Manager key, etc.).

### Running the App

1.  **Start the Frontend Development Server:**
    ```bash
    npm run dev
    ```
    The application will typically be available at `http://localhost:5173` (or the next available port).
2.  **(Optional) Deploy Supabase Functions:**
    ```bash
    # Ensure Supabase CLI is installed and linked to your project
    supabase functions deploy --project-ref <your-project-ref>
    ```
3.  **(Optional) Run Backend Services:** Refer to the [Deployment](#deployment) section for running services on a server with PM2.

## Design System

*   **UI Library:** Shadcn UI built on Radix UI primitives.
*   **Styling:** Tailwind CSS utility-first framework.
*   **Icons:** Lucide React.
*   **Color Theme:** Primarily a dark mode theme with a distinct bluish-gray background (`--background: 215 28% 9%`). Light mode is also defined.
*   **Reference:** See `.cursor/rules/design/UI_UX_Design.mdc` for detailed HSL values and design guidelines.

## Database Schema

Uses PostgreSQL managed by Supabase. Key tables include `users`, `agents`, `teams`, `workspaces`, `workspace_members`, `chat_channels`, `chat_messages`, `datastores`, `agent_datastores`, `mcp_configurations`, `mcp_servers`.

*   **Relationships:** Workspaces link members (users, agents, teams). Channels belong to workspaces. Messages belong to channels. Agents can be linked to datastores and MCP configurations.
*   **RLS:** Row Level Security is enforced on most tables to control data access based on user roles and workspace membership.
*   **Migrations:** Located in `supabase/migrations/`.

## Supabase Functions

Located in `supabase/functions/`. These are serverless functions handling specific backend tasks:

*   `chat`: Core logic for generating AI agent responses, including history management, RAG (via Pinecone), MCP integration, and applying context window settings.
*   `discord-interaction-handler`: Handles incoming webhooks from Discord for slash commands (like `/activate`) and autocomplete.
*   `manage-discord-worker`: Provides an endpoint for the frontend to request starting/stopping specific agent Discord workers via the `worker-manager` service.
*   `register-agent-commands`: Registers necessary Discord slash commands for agents.

## Tool Use Infrastructure

Agentopia implements a sophisticated tool use system that allows agents to perform actions on behalf of users through various integrations (e.g., Gmail, Slack, GitHub). This system leverages OpenAI's function calling capabilities combined with a permissions-based architecture.

### Architecture Overview

1. **Tool Definition**: Tools are defined with OpenAI function schemas that specify parameters, descriptions, and required OAuth scopes
2. **Permission System**: Fine-grained permissions control which agents can use which tools based on user-granted OAuth scopes
3. **Tool Execution**: When agents request tool use, the system validates permissions, executes the tool, and returns results
4. **Integration Support**: Currently supports Gmail with extensible architecture for additional providers

### Database Schema for Tool Use

Key tables involved in the tool use infrastructure:

* **`oauth_providers`**: Stores OAuth provider configurations (e.g., Gmail, Slack)
* **`user_oauth_connections`**: Links users to their OAuth connections with encrypted tokens
* **`agent_oauth_permissions`**: Controls which agents have access to which OAuth scopes
  * `agent_id`: The agent granted permissions
  * `user_oauth_connection_id`: The OAuth connection to use
  * `allowed_scopes`: JSONB array of granted OAuth scopes (e.g., `["https://www.googleapis.com/auth/gmail.send"]`)
  * `is_active`: Whether the permission grant is currently active

### RPC Functions

The system uses PostgreSQL functions to manage tool availability:

* **`get_gmail_tools(p_agent_id, p_user_id)`**: Returns available Gmail tools based on granted permissions
* **`validate_agent_gmail_permissions(p_agent_id, p_user_id, p_required_scopes[])`**: Validates if an agent has required scopes

### Tool Execution Flow

1. **User grants OAuth permissions**: User connects their Gmail/other accounts via OAuth flow
2. **User assigns permissions to agent**: Through the AgentEdit UI, users grant specific OAuth scopes to agents
3. **Agent receives user message**: When a user asks an agent to perform an action (e.g., "send an email")
4. **Chat function retrieves available tools**: The `chat` function calls `FunctionCallingManager.getAvailableTools()`
5. **Tools are passed to OpenAI**: Available tools are included in the OpenAI API call as function definitions
6. **Agent requests tool use**: OpenAI returns tool calls in its response
7. **System validates and executes**: The system validates permissions and executes the requested tools
8. **Results returned to agent**: Tool execution results are sent back to OpenAI for final response

### Gmail Integration Example

The Gmail integration demonstrates the complete tool use flow:

```javascript
// Tool definition (from function_calling.ts)
const GMAIL_MCP_TOOLS = {
  send_email: {
    name: 'send_email',
    description: 'When a user asks to send an email, use this tool.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Email body content' }
      },
      required: ['to', 'subject', 'body']
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.send']
  }
}
```

### Testing and Diagnostics

Several utility scripts help diagnose and test the tool use infrastructure:

* **`scripts/find_gmail_agents.js`**: Lists all agents with Gmail permissions
* **`scripts/diagnose_gmail_tools.js <agent_id>`**: Detailed diagnostics for a specific agent's Gmail tool availability
* **`scripts/check_oauth_schema.js`**: Verifies the database schema for OAuth tables
* **`scripts/test_gmail_tools_availability.js`**: End-to-end test of Gmail tool availability

### Common Issues and Solutions

1. **"I don't have the required Gmail permissions" error**:
   - Usually indicates the `get_gmail_tools` RPC function is returning empty
   - Check that `allowed_scopes` column exists (not `granted_scopes`)
   - Verify the agent_oauth_permissions record exists and is active
   - Run `scripts/diagnose_gmail_tools.js <agent_id>` for detailed diagnostics

2. **Tools not appearing in chat**:
   - Ensure the OAuth connection is active in `user_oauth_connections`
   - Verify the `oauth_providers` table has the correct provider entry
   - Check chat function logs for tool availability count

### Extending the System

To add new tool providers:

1. Add provider to `oauth_providers` table
2. Implement OAuth flow in `supabase/functions/[provider]-oauth`
3. Define tools in `function_calling.ts` following the `GMAIL_MCP_TOOLS` pattern
4. Add execution logic in `FunctionCallingManager`
5. Create provider-specific API handler in `supabase/functions/[provider]-api`

## Backend Services

Located in `services/`. These are designed for persistent execution on a server (e.g., DigitalOcean Droplet) managed by PM2.

*   `worker-manager`: Listens for requests (e.g., from `manage-discord-worker`) and uses the PM2 API to start/stop `discord-worker` processes for individual agents.
*   `discord-worker`: A Node.js process connecting a specific agent to the Discord Gateway, listening for mentions, calling the `chat` function, and sending responses back to Discord.
*   `reasoning-mcp-server`: Provides advanced reasoning capabilities by leveraging a Knowledge Graph (GetZep) for complex queries and context persistence.

## Core Workflows

*   **Workspace Chat:** User sends message -> Frontend calls `chat` function -> Function fetches context (history, members, settings, RAG, MCP) -> Sends context to LLM -> Saves user & agent message -> Returns response to frontend -> Frontend displays message via Realtime subscription.
*   **Discord Agent Activation:** User clicks activate -> Frontend calls `manage-discord-worker` -> Function calls `worker-manager` service -> Manager starts `discord-worker` process via PM2.
*   **Discord Mention:** Discord sends mention event -> `discord-worker` receives event -> Calls `chat` function -> Function generates response -> Worker sends response back to Discord channel.

## Known Issues & Refactoring

*   **Missing Logs:** Critical logging across services and functions needs implementation.
*   **✅ ENHANCED: Containerized Backend Architecture (June 19, 2025):**
    *   **Previous Issue:** MCP deployment required manual SSH access and local backend server
    *   **Revolutionary Solution:** **Backend server as default container alongside DTMA**
    *   **New Self-Contained Architecture:** 
        *   🐳 **Backend Server Container**: `agentopia/backend:latest` deployed on every droplet
        *   🔗 **Container Communication**: DTMA (port 30000) + Backend (port 3000) with direct linking
        *   🚀 **Zero Manual Intervention**: Complete automation without SSH access required
        *   📦 **Self-Contained Droplets**: Each droplet runs complete autonomous stack
        *   ⚡ **Enhanced Deployment**: Updated `_createToolboxUserDataScript` deploys both containers automatically
    *   **Technical Implementation:**
        *   ✅ Built production-ready `agentopia/backend:latest` Docker image
        *   ✅ Enhanced deployment script with dual-container orchestration
        *   ✅ Container-to-container communication via Docker linking
        *   ✅ Complete environment variable configuration system
        *   ✅ Health monitoring for both DTMA and backend containers
    *   **Benefits Achieved:** 
        *   🎯 **True Automation**: MCP deployment fully automated end-to-end
        *   🔒 **Self-Contained**: No external dependencies or manual intervention
        *   📈 **Horizontal Scaling**: Each agent gets complete autonomous stack
        *   🐛 **Easier Debugging**: All logs and services co-located
        *   ⚡ **Better Performance**: Local container communication eliminates network latency
    *   **Status:** ✅ **ARCHITECTURE COMPLETE** - Ready for production deployment
    *   **Documentation:** `docs/plans/docker_container_deployment_fix/implementation/enhanced_deployment_architecture.md`
*   **Large Files:** 
    *   Some frontend page components may exceed recommended size limits and could benefit from refactoring (e.g., `src/pages/agents/[agentId]/edit.tsx`, `src/pages/DatastoresPage.tsx` - line counts need re-verification).
    *   The core `supabase/functions/chat/index.ts` function is ~695 lines and should be reviewed for refactoring.
*   **Suboptimal Tokenizer:** The `ContextBuilder` in `supabase/functions/chat/context_builder.ts` uses a basic character count for token estimation; consider replacing with `tiktoken` for accuracy.
*   **Team Membership Access:** The `fetchWorkspaces` hook doesn't currently grant workspace access based on Team membership; this might need enhancement.
*   **UI Component Completeness:** Ensure all necessary Shadcn UI components are created/installed.

## Recent Improvements

*   **Agent Edit Page Refactor:**
    *   Fixed double sidebar issue by removing redundant Layout wrapper that was applied both at the route level and component level
    *   Solved scrolling issues by fixing `overflow-y-auto` in Layout component and replacing Monaco editor with Shadcn UI's Textarea
    *   Restructured component with modals for DatastoreSelector, AgentInstructions, and ProfileImageEditor
    *   Made the profile image larger with more discreet controls
    *   Added a Tools section for future integrations
    *   Moved Active toggle to Discord card header for better UX
*   **Discord Integration:**
    *   Fixed Discord integration by properly implementing the useAgentDiscordConnection hook
    *   Improved error handling and added connection status indicators
    *   Moved the Discord component to the right column for better layout
*   **Folder Structure:**
    *   Moved AgentEditPage to `/src/pages/agents/[agentId]/edit.tsx` following file-based routing conventions
    *   Archived old duplicate files to prevent conflicts
*   **Component Improvements:**
    *   Added the Badge component for status indicators
    *   Fixed typing issues with newly installed components

## Current Status & Next Steps

*   **Workspace Refactor:** Largely complete, including DB schema, backend hooks, core UI, chat functionality, context window settings, and member management.
*   **UI Improvements:** Completed significant improvements to the AgentEditPage, focusing on layout, organization, and better component usage.
*   **MCP Management Interface (Phase 2.3.1):** **40% Complete** - Major progress on Multi-MCP Management Components:
    *   ✅ **Foundation Complete:** TypeScript interfaces, component architecture, DTMA API integration
    *   ✅ **MCPServerList Component:** Full server listing with search, filtering, status management (432 lines)
    *   ✅ **MCPMarketplace Component:** Marketplace browsing with deployment integration (369 lines)
    *   ✅ **MCPServerDeployment Component:** Deployment configuration with resource allocation (453 lines)
    *   🔄 **In Progress:** MCPServerConfig component, health monitoring hooks, admin interface completion
*   **🚨 CRITICAL - Ready for Deployment:** [Droplet Name Synchronization Bug Fix](docs/bugs/droplet_name_synchronization_fix.md) - Complete solution prepared and tested for critical UX issue
*   **Immediate Focus:** 
    *   **Deploy droplet name synchronization fix** (highest impact - all components ready)
    *   **Implement comprehensive logging system** (Rule #2 compliance - critical for operations)
    *   Complete remaining MCP management components (MCPServerConfig, health monitoring)
    *   Finalize admin marketplace management interface
    *   Continue thorough testing of Workspace features (chat, settings, member management, context limits)
*   **Future:** Link Supabase project for proper CLI functionality, refactor remaining large components, enhance Team-based workspace access logic.

## Deployment

*   **Frontend:** Static deployment (Netlify, Vercel).
*   **Supabase:** Deploy functions and DB migrations via CLI or Git integration.
*   **Backend Services:** Requires Node.js/PM2 environment (e.g., DigitalOcean Droplet). See previous README section for detailed steps on setting up `worker-manager` with PM2.

## Agent Tool Infrastructure (Refactored for Shared Account-Level Droplets)

The Agent Tool Infrastructure has been **refactored** to support a new model where Agentopia user accounts can have a **shared DigitalOcean Droplet** provisioned. This shared droplet is capable of hosting multiple, isolated tool instances (e.g., MCP Servers, other backend processes) that can be utilized by agents belonging to that user account.

This marks a shift from the previous model of one droplet per agent.

### Key Architectural Changes:

*   **Account-Level Shared Droplets:** One DigitalOcean droplet per user account that enables the "Tool Environment" feature.
*   **Multiple Tool Instances:** The shared droplet will host multiple tool instances (e.g., MCP servers), typically as Docker containers.
*   **Droplet Tool Management Agent (DTMA):** A lightweight agent (planned as a Node.js application) runs on the account droplet. It manages the lifecycle of tool instances, handles secure secret fetching, and reports status to the Agentopia backend.
*   **New Backend Services:**
    *   `account_environment_service`: Manages the lifecycle of the shared account droplet.
    *   `tool_instance_service`: Manages individual tool instances on an account's droplet.
*   **Updated Database Schema:** Includes new tables like `account_tool_environments`, `tool_catalog`, `account_tool_instances`, and `agent_tool_instance_links` to support this new model.

### Detailed Plan & Work Breakdown Structure (WBS):

For a comprehensive understanding of the new architecture, including detailed designs, API specifications, and a full task breakdown, please refer to the **Work Breakdown Structure document**:

*   **WBS Location:** `docs/plans/agent_tool_infrastructure/wbs_checklist.md`

This document is the primary source of truth for the ongoing development of this feature.

### API Keys and Configuration (Legacy Section - Review WBS for current needs)

**Note:** The environment variables listed below were for the *previous* per-agent droplet infrastructure. While some (like `DO_API_TOKEN`) are still relevant, the overall configuration strategy, especially for the DTMA and its communication with the Agentopia backend, is now defined in the WBS. **Please consult the WBS (section 1.1.5, 3.1.1.5, 3.2.2.2) for the most up-to-date configuration requirements.**

```bash
# DigitalOcean API Configuration
DO_API_TOKEN=your_digitalocean_api_token # Still needed

# Droplet Configuration (Defaults might be managed differently now - see WBS)
# DO_DEFAULT_REGION=nyc3
# DO_DEFAULT_SIZE=s-1vcpu-1gb
# DO_DEFAULT_IMAGE=ubuntu-22-04-x64
# DO_DEFAULT_SSH_KEY_IDS=your_ssh_key_ids_comma_separated
# DO_BACKUP_ENABLED=false
# DO_MONITORING=true

# DTMA Configuration (Specifics defined in WBS - e.g. passed via user_data)
# DTMA_GIT_REPO_URL=https://github.com/maverick-software/dtma-agent.git # May still be used
# DTMA_GIT_BRANCH=main

# Agentopia API URL (DTMA now calls Supabase Edge Functions directly)
AGENTOPIA_API_URL=https://your-project-id.supabase.co/functions/v1 # IMPORTANT: Use direct Supabase URL
VITE_SUPABASE_URL=https://your-project-id.supabase.co

# API Security (Internal API secret for backend-to-backend, DTMA uses its own token)
# INTERNAL_API_SECRET=generate_this_securely_with_crypto_randomBytes
```

### Setting Up DigitalOcean API Token

This process remains largely the same:
1. Log in to the DigitalOcean control panel
2. Navigate to API → Generate New Token
3. Name: `agentopia-tool-droplet-manager` (or similar)
4. Scopes: Select Read and Write permissions for Droplets.
5. Copy the generated token immediately.
6. Store this token securely, ideally in Supabase Vault, to be accessed by the Agentopia backend. (Refer to WBS 1.1.5.2)

### Testing Your Configuration (Legacy Scripts - May Need Updates)

**Note:** The scripts mentioned below (`check-do-token.js`, `offline-deployment-test.js`) were for the previous infrastructure. They may need to be updated or new testing scripts developed to align with the `account_environment_service` and the new DTMA interactions.

```bash
# node scripts/check-do-token.js # Verify this script's relevance
```

```bash
# node scripts/offline-deployment-test.js # Verify this script's relevance
```

### Deployment Notes (Updated)

- The DTMA (Droplet Tool Management Agent) on the shared account droplet communicates directly with **Supabase Edge Functions**.
- Configure `AGENTOPIA_API_URL` (or a similar variable used by the DTMA, as per WBS 3.1.1.5 and 3.2.2.2) to point directly to your Supabase Edge Functions URL.
- Ensure robust firewall configurations (e.g., DigitalOcean Cloud Firewalls) and security measures are in place for the account-level DigitalOcean droplets, managed as per the designs in WBS Phase 1.3.