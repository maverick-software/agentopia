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
- [Knowledge Transfer & Handoff Documentation](#knowledge-transfer--handoff-documentation)
- [Deployment](#deployment)
- [Integrations & Capabilities](#integrations--capabilities)
 - [August 2025 Stabilization Notes](#august-2025-stabilization-notes)

## Recent Security Updates

### 🔒 Critical Security Fix: Integration Permissions System (January 2025)

Fixed a **critical security vulnerability** where agents could access tools and credentials they weren't explicitly authorized to use. This was caused by parallel permission systems creating security bypasses.

#### **🚨 The Problem: Rogue Tool Access**
- Agents could access Gmail tools without proper authorization
- Old MCP (Model Context Protocol) cache was bypassing the unified permission system
- Tool name collisions (multiple `send_email` tools) caused incorrect routing
- Critical example: Agent Angela was accessing Gmail without permission while having legitimate SMTP access

#### **✅ The Solution: Unified Permission Architecture**

**1. Namespaced Tool System:**
- `gmail_send_email` (Gmail-specific email sending)
- `smtp_send_email` (SMTP server email sending)  
- `sendgrid_send_email` (SendGrid API email sending)
- `mailgun_send_email` (Mailgun API email sending)

**2. Database-Driven Authorization:**
- Agents only see tools they're explicitly authorized for in `agent_integration_permissions`
- Permissions checked at both tool discovery and execution time
- Zero bypass mechanisms - no parallel systems

**3. Secure Credential Management:**
- All credentials encrypted in Supabase Vault (no plain-text storage)
- Vault-based token retrieval for OAuth systems
- Service role authentication required for all decryption

#### **🗑️ What Was Removed & Why**

**Removed Components:**
- **Old MCP Tools Cache**: Entries in `mcp_tools_cache` that bypassed authorization
- **Deprecated SMTP Tables**: `agent_smtp_permissions` and `smtp_configurations` (replaced by unified `agent_integration_permissions`)
- **Gmail MCP Connections**: Old `agent_mcp_connections` entries that allowed unauthorized Gmail access
- **Plain-Text Fallbacks**: Eliminated all plain-text credential storage mechanisms

**Why Removed:**
- **Security Bypass**: Old systems allowed agents to see and use tools without proper authorization
- **Data Inconsistency**: Multiple permission systems created conflicting authorization states  
- **Maintenance Burden**: Parallel systems made security validation impossible to guarantee
- **Compliance Risk**: Plain-text storage violated enterprise security standards

#### **🎯 Gmail Integration Resolution**

**The Issue:**
Agent Angela was successfully sending Gmail emails despite:
- No Gmail OAuth connection in the database
- No Gmail permissions granted via UI
- No valid Gmail credentials in Supabase Vault

**Root Cause Analysis:**
1. **Parallel Permission Systems**: Old MCP cache contained Gmail tools accessible to all agents
2. **Credential Bypass**: Gmail API function was using insecure token retrieval methods
3. **Permission Validation Gaps**: Tool discovery didn't validate agent-specific permissions

**The Fix:**
1. **Eliminated MCP Bypass**: Removed all Gmail tools from `mcp_tools_cache` 
2. **Secured Token Retrieval**: Updated `gmail-api` Edge Function to use `vault_decrypt` RPC
3. **Unified Permission Checks**: All tool access now goes through `agent_integration_permissions`
4. **Namespaced Tool Routing**: Gmail tools now have unique names preventing collision with SMTP tools

#### **🛡️ Result: True Zero-Trust Architecture**

**Before Fix:**
```
Agent → Sees all tools → Can execute any tool (security bypass)
```

**After Fix:**
```  
Agent → Database Permission Check → Authorized Tools Only → Vault-Secured Execution
```

**Security Validation:**
- ✅ Angela with SMTP permission: Sees only `smtp_send_email` 
- ✅ Angela without Gmail permission: Cannot see `gmail_send_email`
- ✅ No tool name collisions: Each provider has unique tool names
- ✅ No credential bypass: All secrets require vault decryption

**Example**: Angela with SMTP permission can no longer access Gmail tools - she literally doesn't know they exist!

See `docs/fixes/CRITICAL_MCP_BYPASS_FIX.md` and `docs/fixes/tool_authorization_system_fixed.md` for complete technical details.

## Project Overview

*   **Goal:** Provide a platform for creating AI agents that can operate within Discord, collaborate within **Workspaces**, and leverage external tools (MCP) and knowledge (RAG).
*   **Focus:** Web UI for management, Workspace-centric collaboration, optional Discord integration.

## Features

*   User Authentication (Supabase Auth)
*   Agent Creation & Configuration
*   **🆕 Enhanced Team Management:** Modern team creation with modal-based workflow, comprehensive team details with descriptions and member management, and streamlined edit functionality
*   Datastore Management (Pinecone RAG)
*   Knowledge Graph Integration (GetZep) for advanced memory, contextual understanding, and reasoning.
*   Agent‑scoped datastore credentials via `agent_datastores` (per‑agent Pinecone/GetZep configs used by chat at runtime)
*   **🆕 Secure Secret Management:** Built-in Supabase Vault integration for secure API key storage and management
*   **🆕 Gmail Integration:** Complete OAuth-based Gmail integration allowing agents to send emails on behalf of users
*   **🆕 SendGrid Integration:** Complete API-based SendGrid integration with agent inboxes, smart routing, and webhook processing for sending and receiving emails
*   **🆕 Web Research Capabilities:** Integrated web search, page scraping, and content summarization through multiple providers (Serper API, SerpAPI, Brave Search)
*   **🆕 Mailgun Integration:** API-based Mailgun integration with validation, analytics, inbound routing, and agent authorization flow
*   **🆕 Task Scheduling System:** Comprehensive automated task scheduling with one-time and recurring tasks, multi-step workflows, timezone support, and Edge Function execution
*   **🆕 Zapier MCP Integration:** Universal tool connectivity allowing agents to access 8,000+ apps through Zapier's Model Context Protocol servers
*   **Workspace Collaboration:**
    *   Create/Manage Workspaces
    *   Manage Workspace Members (Users, Agents, Teams)
    *   Manage Workspace Channels
    *   Real-time Chat within Workspace Channels
    *   Configurable Agent Context Window (Size & Token Limit)
*   MCP (Multi-Cloud Proxy) Integration
*   Agent Mentions (`@AgentName`) within Chat
*   **🆕 Enhanced Chat Experience with AI Process Transparency:**
    *   Real-time AI thinking process indicators with step-by-step visibility
    *   Expandable "Thoughts" sections showing actual AI responses, tool calls, and results
    *   Integrated debugging capabilities for prompt verification and troubleshooting
    *   Persistent chat history with seamless message state management
    *   Professional Claude-style UI with gradient effects and seamless message bubbles
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
    *   `PINECONE_API_KEY`: Optional fallback. Prefer agent‑scoped credentials in `datastores.config` linked via `agent_datastores`.
    *   `PINECONE_INDEX` / `PINECONE_ENVIRONMENT`: Optional fallbacks when no agent datastore is linked.
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

## Design System & Theme Management

Agentopia implements a comprehensive, accessible theming system supporting both light and dark modes with WCAG AA compliance.

### 🎨 **UI Foundation**
*   **UI Library:** Shadcn UI built on Radix UI primitives
*   **Styling:** Tailwind CSS utility-first framework
*   **Icons:** Lucide React
*   **Accessibility:** WCAG AA compliant with 4.5:1+ contrast ratios
*   **Default Theme:** Light mode with professional, clean appearance

### 🎯 **Theme Architecture**

#### **CSS Variable System**
All themes are managed through CSS custom properties in `src/index.css`:

```css
:root {
  /* Light Mode Theme (Default) */
  --background: 0 0% 100%;           /* Pure white */
  --foreground: 240 10% 3.9%;       /* Deep charcoal text */
  --primary: 221.2 83.2% 53.3%;     /* Vibrant blue */
  --sidebar-background: 210 40% 98%; /* Very light gray */
  --dashboard-card: 0 0% 100%;       /* White cards */
  /* ... additional variables */
}

.dark {
  /* Dark Mode Theme */
  --background: 215 28% 9%;          /* Dark bluish-gray */
  --foreground: 210 20% 98%;         /* Light text */
  /* ... dark mode overrides */
}
```

#### **Theme Categories**

**Core Theme Variables:**
- `--background` / `--foreground` - Base page colors
- `--primary` / `--primary-foreground` - Primary action colors
- `--secondary` / `--secondary-foreground` - Secondary elements
- `--muted` / `--muted-foreground` - Subtle backgrounds and text
- `--card` / `--card-foreground` - Card container colors
- `--border` / `--input` / `--ring` - Interactive element styling

**Specialized Component Variables:**
- `--sidebar-*` - Sidebar navigation theming
- `--dashboard-*` - Dashboard card and stat theming  
- `--chat-*` - Chat interface message bubbles
- `--warning` / `--success` - State indication colors

### 🔧 **Modifying Themes**

#### **Adding New Colors**
1. **Define in CSS variables** (`src/index.css`):
   ```css
   :root {
     --my-custom-color: 200 100% 50%;     /* Light mode */
   }
   
   .dark {
     --my-custom-color: 200 80% 40%;      /* Dark mode */
   }
   ```

2. **Use in Tailwind classes**:
   ```tsx
   <div className="bg-my-custom-color text-my-custom-color-foreground">
     Custom themed content
   </div>
   ```

#### **Updating Existing Colors**
Modify the HSL values in `src/index.css` for the appropriate theme:

```css
/* Example: Change primary color to green */
:root {
  --primary: 142.1 76.2% 36.3%;      /* Green primary */
}
```

#### **Component Theming**
Components use CSS variable-based Tailwind classes:

```tsx
// ✅ Correct - Uses theme variables
<Card className="bg-card border-border text-card-foreground">

// ❌ Incorrect - Hardcoded colors  
<Card className="bg-white border-gray-200 text-black">
```

### 📁 **File Structure for Theme Modifications**

#### **Primary Theme Files:**
- `src/index.css` - **Main theme definitions** (CSS variables for both light/dark modes)
- `tailwind.config.js` - Tailwind CSS configuration and color mappings
- `src/App.tsx` - Theme application logic (currently defaults to light mode)

#### **Component Examples:**
- `src/components/Sidebar.tsx` - Sidebar theming implementation
- `src/pages/DashboardPage.tsx` - Dashboard card theming
- `src/pages/AdminDashboardPage.tsx` - Admin interface theming

#### **Documentation:**
- `docs/plans/light_mode_implementation/` - **Complete theming implementation documentation**
- `docs/plans/light_mode_implementation/research/3.1_light_theme_color_palette.md` - Color specifications
- `docs/plans/light_mode_implementation/research/3.3_component_visual_specifications.md` - Component styling guidelines

### 🛠️ **Development Workflow**

#### **Theme Development Process:**
1. **Backup First:** All theme modifications include automatic backups in `./backups/`
2. **CSS Variables:** Modify colors in `src/index.css` 
3. **Component Updates:** Update components to use CSS variable classes
4. **Testing:** Verify accessibility compliance and visual consistency
5. **Documentation:** Update theme documentation as needed

#### **Safe Modification Guidelines:**
- **Always create backups** before theme changes (stored in `./backups/`)
- **Use CSS variables** instead of hardcoded Tailwind colors
- **Maintain WCAG AA compliance** (4.5:1 contrast minimum)
- **Test both light and dark modes** when adding new components
- **Follow existing naming conventions** for new CSS variables

#### **Component Theming Checklist:**
- [ ] Replace hardcoded colors (`bg-gray-800`) with variables (`bg-card`)
- [ ] Add proper border styling (`border-border`)
- [ ] Include hover states (`hover:bg-accent`)
- [ ] Ensure text contrast (`text-foreground`, `text-muted-foreground`)
- [ ] Add focus indicators for accessibility (`focus:ring-ring`)

### 🎨 **Color System Reference**

#### **Light Mode Palette:**
- **Backgrounds:** Pure white (`#ffffff`) with subtle gray accents
- **Text:** Deep charcoal (`#0f172a`) for optimal readability
- **Primary:** Vibrant blue (`#3b82f6`) for interactive elements
- **Borders:** Light gray (`#e2e8f0`) for subtle definition
- **Vibrant Icons:** 11-color professional palette with semantic meaning (purple dashboard, blue agents, green memory, orange workflows, teal integrations, red credentials, indigo teams, cyan workspaces, pink projects, gray settings, amber monitoring)

#### **Dark Mode Palette:**
- **Backgrounds:** Dark bluish-gray (`#0f172a`) 
- **Text:** Light with blue tint (`#f8fafc`)
- **Primary:** Same blue (`#3b82f6`) for consistency
- **Borders:** Medium gray (`#334155`) for definition

#### **Status Colors:**
- **Success:** Green (`#22c55e`) for positive actions
- **Warning:** Amber (`#f59e0b`) for caution states  
- **Destructive:** Red (`#ef4444`) for dangerous actions
- **Muted:** Gray (`#64748b`) for secondary information

### 🔄 **Theme Switching (Future)**
The architecture supports dynamic theme switching:
- CSS variables enable instant theme changes via class toggles
- `ThemeContext` implementation planned for user preference storage
- localStorage integration for theme persistence across sessions

For detailed implementation guidance, see the comprehensive documentation in `docs/plans/light_mode_implementation/`.

## Database Schema

Uses PostgreSQL managed by Supabase. Key tables include `users`, `agents`, `teams`, `team_members`, `workspaces`, `workspace_members`, `chat_channels`, `chat_messages`, `datastores`, `agent_datastores`, `mcp_configurations`, `mcp_servers`.

*   **Relationships:** Workspaces link members (users, agents, teams). Channels belong to workspaces. Messages belong to channels. Agents can be linked to datastores and MCP configurations.
*   **RLS:** Row Level Security is enforced on most tables to control data access based on user roles and workspace membership.
*   **Migrations:** Located in `supabase/migrations/`.
*   **🔄 Database-Driven Integration Capabilities:** `integration_capabilities` table provides dynamic capability management
    - **Columns:** `integration_id`, `capability_key`, `display_label`, `display_order`, timestamps
    - **Purpose:** Drives all capability badges in UI for both tools and channels (NO hardcoding)
    - **Tool Naming:** Uses specific tool names (e.g., `smtp_send_email`, `gmail_send_email`) for proper routing
    - **UI Integration:** Frontend components fetch capabilities via database queries, fallback to hardcoded only on error
    - **RLS:** Readable by everyone; managed per integration

## 🔧 Integration Capabilities System (Database-Driven)

Agentopia implements a **database-first integration capabilities system** that eliminates hardcoded tool definitions in favor of dynamic, data-driven capability management.

### 🎯 **Core Principles**
- **Zero Hardcoding**: All integration capabilities stored in `integration_capabilities` database table
- **Dynamic Loading**: UI components fetch capabilities via database queries at runtime
- **Specific Tool Names**: Each tool has unique identifiers (e.g., `smtp_send_email`, `gmail_send_email`) for proper routing
- **Graceful Fallback**: Hardcoded definitions only used as emergency fallback if database query fails

### 🏗️ **Architecture**

#### **Database Table: `integration_capabilities`**
```sql
integration_capabilities: {
  integration_id: uuid,           -- Links to integrations table
  capability_key: text,           -- Specific tool name (e.g., 'smtp_send_email')
  display_label: text,            -- Human-readable label (e.g., 'Send Email')
  display_order: integer,         -- Sort order for UI display
  created_at: timestamptz,
  updated_at: timestamptz
}
```

#### **Frontend Implementation**
```typescript
// ✅ Database-first approach
useEffect(() => {
  const loadCapabilities = async () => {
    const { data } = await supabase
      .from('integration_capabilities')
      .select('integration_id, capability_key, display_label, display_order')
      .in('integration_id', integrationIds)
      .order('display_order');
    
    setCapabilitiesByIntegrationId(mapCapabiliesToIntegrations(data));
  };
}, [integrations, supabase]);

// ❌ Old hardcoded approach (removed)
// const CAPABILITIES = {
//   smtp: [{ id: 'send_email', label: 'Send Email' }]  // NO LONGER USED
// };
```

### 🔄 **Tool Naming Convention**
All tools follow a **provider-specific naming pattern** to prevent collisions:

| Provider | Tool Name | Display Label | Purpose |
|----------|-----------|---------------|---------|
| **SMTP** | `smtp_send_email` | Send Email | Send via SMTP server |
| **Gmail** | `gmail_send_email` | Send Email | Send via Gmail API |
| **SendGrid** | `sendgrid_send_email` | Send Email | Send via SendGrid API |
| **Mailgun** | `mailgun_send_email` | Send Email | Send via Mailgun API |

### 📊 **Benefits**
- **Maintainability**: Add new capabilities via database inserts, no code changes required
- **Consistency**: Single source of truth for all integration capabilities
- **Scalability**: Support unlimited integrations without frontend code modifications  
- **Flexibility**: Capability labels and ordering configurable per deployment
- **Performance**: Database queries cached and optimized for fast UI rendering

### 🛠️ **Developer Guidelines**
1. **Never hardcode capabilities** in frontend components
2. **Always query database first** for capability information
3. **Use specific tool names** that include provider prefix
4. **Provide fallback only** for emergency scenarios (database unavailable)
5. **Update database** when adding new integration capabilities

## Supabase Functions

Located in `supabase/functions/`. These are serverless functions handling specific backend tasks:

*   `chat`: Core logic for generating AI agent responses. Advanced Chat V2 highlights:
    * Per‑agent datastore resolution (`agent_datastores → datastores.config` preferred over env vars)
    * Working memory/history with configurable size (`options.context.max_messages` 0–100)
    * Context Engine optimization + compression
    * Memory retrieval before reasoning/tool use:
      - Episodic → vector search (Pinecone)
      - Semantic → knowledge graph (GetZep) when connected; concept search fallback
     * Assistant prompt injection of labeled memory sections (`EPISODIC MEMORY` / `SEMANTIC MEMORY`)
     * Reasoning stage operates on `context_window.sections` with Markov path + metrics for the Process Modal
     * Robust LLM Router fallback: if `shared/llm/router.ts` is unavailable or `resolveAgent` fails, the function falls back to OpenAI with tools (August 2025)
*   `discord-interaction-handler`: Handles incoming webhooks from Discord for slash commands (like `/activate`) and autocomplete.
*   `manage-discord-worker`: Provides an endpoint for the frontend to request starting/stopping specific agent Discord workers via the `worker-manager` service.
*   `register-agent-commands`: Registers necessary Discord slash commands for agents.
*   **🆕 `create-secret`**: Securely creates and stores API keys and sensitive data in Supabase Vault with proper CORS handling.
*   **🆕 `web-search-api`**: Handles web search, page scraping, and content summarization for agent research capabilities.
*   **🆕 `gmail-oauth`**: Manages Gmail OAuth authentication flow for email integration.
*   **🆕 `gmail-api`**: Executes Gmail operations on behalf of authenticated users. Supported actions: `send_email`, `read_emails` (optional body preview), `search_emails`, and `email_actions` (mark_read, mark_unread, archive, unarchive, star, unstar, delete, delete_forever).
*   **🆕 `sendgrid-api`**: Executes SendGrid operations including email sending, templates, analytics, and agent inbox management.
*   **🆕 `sendgrid-inbound`**: Processes inbound emails via SendGrid Inbound Parse webhook with smart routing and auto-reply capabilities.
*   **🆕 `agent-tasks`**: Manages CRUD operations for agent task scheduling, including cron expression calculation, timezone handling, and next run time computation.
*   **🆕 `task-executor`**: Executes scheduled and event-based tasks, triggered via pg_cron on a 5-minute interval for automated task processing.

Also see database RPCs used by integrations UI:

- `grant_agent_integration_permission(p_agent_id uuid, p_connection_id uuid, p_allowed_scopes text[], p_permission_level text)`
- `revoke_agent_integration_permission(p_permission_id uuid)`
- `get_agent_integration_permissions(p_agent_id uuid)` — returns provider_name, external_username, allowed_scopes, is_active for the agent’s authorized connections

## 🔐 Centralized Secure Secrets Management (Enterprise-Grade)

Agentopia implements an **enterprise-grade centralized secrets management system** using Supabase Vault that ensures zero plain-text storage of sensitive data. This system provides military-grade encryption for all API keys, OAuth tokens, and sensitive credentials with complete audit trails and compliance controls.

### 🎯 **System Architecture**

All sensitive credentials are stored in a **centralized vault system** with no exceptions:

| Integration Type | Storage Method | Encryption | Status |
|-----------------|---------------|------------|--------|
| **OAuth Tokens** | `user_integration_credentials` | ✅ Vault UUID | **SECURE** |
| **API Keys** | `user_integration_credentials` | ✅ Vault UUID | **SECURE** |
| **Service Credentials** | Supabase Vault | ✅ AES Encryption | **SECURE** |
| **Database Tokens** | Supabase Vault | ✅ AES Encryption | **SECURE** |

### 🛡️ **Zero Plain-Text Policy**

**CRITICAL SECURITY PRINCIPLE**: No sensitive data is ever stored in plain text.

```typescript
// ✅ SECURE: How credentials are stored
const { data: vaultId } = await supabase.rpc('create_vault_secret', {
  p_secret: apiKeyOrToken,
  p_name: `${provider}_${type}_${userId}_${timestamp}`,
  p_description: `${provider} credential for user ${userId}`
});

// Store only the vault UUID - never the actual secret
{
  vault_access_token_id: vaultId,     // UUID like 'dc067ffc-59df-4770-a18e-0f05d85ee6e7'
  encrypted_access_token: null,        // NO plain text storage
  credential_type: 'oauth' | 'api_key'
}

// ❌ FORBIDDEN: Plain text storage has been eliminated
// encrypted_access_token: 'sk-abc123...'  // This pattern is banned
```

### 🔧 **VaultService Class - Centralized API**

The `VaultService` class (`src/services/VaultService.ts`) provides the **single source of truth** for all secret operations:

```typescript
import { VaultService } from '@/services/VaultService';

const vaultService = new VaultService(supabaseClient);

// Create encrypted secret
const secretId = await vaultService.createSecret(
  'provider_api_key_user123_1641234567890',
  'sk-actual-secret-value',
  'OpenAI API key for user 123 - Created: 2025-01-25'
);

// Retrieve decrypted secret (server-side only)
const secretValue = await vaultService.getSecret(secretId);
```

### 🗄️ **Database Schema - Unified Integration Credentials**

**NEW TABLE NAME**: `user_integration_credentials` (renamed from `user_oauth_connections`)

```sql
-- Centralized table for ALL integration credentials
CREATE TABLE user_integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  oauth_provider_id uuid NOT NULL,
  credential_type 'oauth' | 'api_key' NOT NULL,
  
  -- SECURE STORAGE: Only vault UUIDs stored
  vault_access_token_id text,    -- Vault UUID for token/key
  vault_refresh_token_id text,   -- Vault UUID for refresh token (OAuth only)
  encrypted_access_token text,   -- DEPRECATED: Always NULL in new system
  encrypted_refresh_token text,  -- DEPRECATED: Always NULL in new system
  
  -- Metadata and status
  connection_name text NOT NULL,
  connection_status text DEFAULT 'active',
  token_expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### 🔍 **Vault Functions - Server-Side Security**

**Core RPC Functions:**

1. **`public.create_vault_secret(p_secret TEXT, p_name TEXT, p_description TEXT)`**
   - **Purpose**: Encrypt and store secrets in Supabase Vault
   - **Access**: Service role only - never client-side
   - **Returns**: Vault UUID for database storage

2. **`public.vault_decrypt(vault_id TEXT)`**
   - **Purpose**: Decrypt secrets from vault by UUID
   - **Access**: Service role only - never client-side
   - **Security**: No fallback to plain text (removed for security)

```sql
-- Example usage (server-side only)
SELECT public.create_vault_secret(
  'sk-abc123def456...',
  'openai_api_key_user123_1641234567890',
  'OpenAI API key for user 123'
); -- Returns: '550e8400-e29b-41d4-a716-446655440000'

SELECT public.vault_decrypt(
  '550e8400-e29b-41d4-a716-446655440000'
); -- Returns: 'sk-abc123def456...' (decrypted value)
```

### 🎨 **UI Components - Secure Integration**

All UI components have been updated to use vault storage:

**Enhanced Tools Modal** (`src/components/modals/EnhancedToolsModal.tsx`):
```typescript
// ✅ SECURE: API key creation process
const { data: vaultSecretId, error: vaultError } = await supabase.rpc('create_vault_secret', {
  p_secret: apiKey,
  p_name: `${selectedProvider}_api_key_${user.id}_${Date.now()}`,
  p_description: `${selectedProvider} API key for user ${user.id}`
});

// Store only the vault UUID
await supabase.from('user_integration_credentials').insert({
  vault_access_token_id: vaultSecretId,  // ✅ Vault UUID only
  encrypted_access_token: null,           // ✅ No plain text
  credential_type: 'api_key'
});
```

**Integration Setup Modal** (`src/components/integrations/IntegrationSetupModal.tsx`):
```typescript
// ✅ SECURE: OAuth token storage
const { data: accessTokenId } = await supabase.rpc('create_vault_secret', {
  p_secret: tokens.access_token,
  p_name: `oauth_access_${provider}_${userId}_${timestamp}`,
  p_description: `OAuth access token for ${provider}`
});

const { data: refreshTokenId } = await supabase.rpc('create_vault_secret', {
  p_secret: tokens.refresh_token,
  p_name: `oauth_refresh_${provider}_${userId}_${timestamp}`,
  p_description: `OAuth refresh token for ${provider}`
});
```

### 🛡️ **Security Compliance & Standards**

#### **HIPAA Compliance ✅**
- **PHI Protection**: All credentials encrypted at rest using AES
- **Access Controls**: Service role required for decryption
- **Audit Trails**: All vault operations logged with timestamps
- **Data Classification**: Credentials properly classified as sensitive

#### **SOC 2 Type II ✅**
- **Security (CC6.0)**: Encryption and key management implemented
- **Confidentiality (CC9.0)**: Vault ensures data confidentiality
- **Processing Integrity (CC8.0)**: Input validation enforced
- **Availability (CC7.0)**: Credentials accessible when needed

#### **ISO 27001/27002 ✅**
- **A.8 Asset Management**: Credentials classified and inventoried
- **A.9 Access Control**: Role-based access implemented
- **A.10 Cryptography**: Industry-standard AES encryption
- **A.12 Operations Security**: Secure storage procedures

### 🔄 **Migration & Legacy Cleanup**

**Completed Security Upgrades:**
- ✅ **Gmail OAuth**: Migrated from plain text to vault storage
- ✅ **Web Search APIs**: All API keys now vault-encrypted
- ✅ **UI Components**: Updated to use `create_vault_secret()` exclusively
- ✅ **Fallback Removal**: Eliminated plain text fallback mechanisms
- ✅ **Database Cleanup**: Removed all plain text credential records

### 📊 **Usage Across Integrations**

The centralized vault system is used for:

| Integration | Credential Type | Vault Usage | Security Status |
|------------|----------------|-------------|----------------|
| **Gmail** | OAuth tokens | ✅ Access & refresh tokens encrypted | **SECURE** |
| **Serper API** | API key | ✅ Vault UUID storage | **SECURE** |
| **SerpAPI** | API key | ✅ Vault UUID storage | **SECURE** |
| **Brave Search** | API key | ✅ Vault UUID storage | **SECURE** |
| **Pinecone** | API key | ✅ Vault UUID storage | **SECURE** |
| **SendGrid** | API key | ✅ Vault UUID storage | **SECURE** |
| **Mailgun** | API key | ✅ Vault UUID storage | **SECURE** |
| **MCP Servers** | Auth configs | ✅ No sensitive data stored | **SECURE** |

### 🎯 **Developer Implementation Pattern**

For all new integrations, follow this **mandatory security pattern**:

```typescript
// 1. Create vault secret
const { data: vaultId, error } = await supabase.rpc('create_vault_secret', {
  p_secret: sensitiveValue,
  p_name: `${provider}_${type}_${userId}_${Date.now()}`,
  p_description: `${provider} ${type} for user ${userId} - Created: ${new Date().toISOString()}`
});

if (error || !vaultId) {
  throw new Error(`Failed to secure credential: ${error?.message}`);
}

// 2. Store only the vault UUID
await supabase.from('user_integration_credentials').insert({
  vault_access_token_id: vaultId,     // ✅ Store vault UUID only
  encrypted_access_token: null,        // ✅ Never store plain text
  credential_type: 'api_key',
  // ... other metadata
});

// 3. Retrieve when needed (server-side only)
const { data: decrypted } = await supabase.rpc('vault_decrypt', {
  vault_id: storedVaultId
});
```

### 🔍 **Security Verification**

Run this query to verify system security:

```sql
-- Verify all credentials are using vault encryption
SELECT 
  credential_type,
  COUNT(*) as total,
  COUNT(CASE WHEN vault_access_token_id ~ '^[0-9a-f]{8}-' THEN 1 END) as vault_stored,
  COUNT(CASE WHEN vault_access_token_id !~ '^[0-9a-f]{8}-' THEN 1 END) as plain_text
FROM user_integration_credentials
GROUP BY credential_type;

-- Expected result: plain_text = 0 for all types
```

### 🎉 **Enterprise-Ready Status**

**CONFIRMED**: Agentopia's secrets management system is **enterprise-grade** and ready for:
- **Enterprise deployment** with full security compliance
- **SOC 2 audit preparation** with complete audit trails
- **HIPAA compliance** for healthcare integrations
- **ISO 27001 certification** with proper controls
- **Zero-trust architecture** with no plain text storage

This system provides **military-grade security** for all sensitive credentials while maintaining developer-friendly APIs and seamless user experience.

## 📧 SMTP Email Integration

Agentopia implements a sophisticated SMTP email system that allows agents to send emails through any SMTP server with proper configuration management and secure credential storage.

### **How SMTP Integration Works**

**1. Integration Setup Process:**
- Users navigate to the **Integrations page** and select **SMTP**
- Choose from pre-configured providers (SMTP.com, Gmail, Outlook, etc.) or configure custom SMTP servers
- Enter SMTP server details: hostname, port, username, password, and email settings
- System stores complete SMTP configuration as JSON in **Supabase Vault** for maximum security
- Connection metadata (host, port, settings) stored in `user_integration_credentials.connection_metadata`

**2. Agent Permission System:**
- Users grant agents access to SMTP tools through the **Channels modal** in agent chat
- Permissions stored in `agent_integration_permissions` table with specific tool scopes
- Each agent sees only `smtp_send_email` tool (with unique naming to prevent conflicts)

**3. Email Sending Process:**
```
User: "Send an email to john@example.com about the meeting"
↓
Agent uses smtp_send_email tool
↓
universal-tool-executor routes to smtp-api Edge Function
↓
smtp-api discovers user's SMTP configuration from connection_metadata
↓
Decrypts password from Supabase Vault using vault_decrypt RPC
↓
Creates nodemailer transporter with complete SMTP config
↓
Sends email and returns success/failure result
```

**4. Configuration Storage Architecture:**
- **Vault Storage**: Password encrypted in Supabase Vault (referenced by `vault_access_token_id`)
- **Metadata Storage**: SMTP server settings (host, port, secure, from_email) in `connection_metadata` JSONB column
- **Backward Compatibility**: Supports both new JSON configs and legacy password-only formats

**5. Provider Presets:**
Pre-configured settings for popular providers with correct hostnames and ports:
- **SMTP.com**: `send.smtp.com:2525` (corrected from previous `smtp.smtp.com`)
- **Gmail**: `smtp.gmail.com:587` with App Password instructions
- **Outlook**: `smtp-mail.outlook.com:587`
- **Yahoo**: `smtp.mail.yahoo.com:587`
- **Custom**: Manual configuration for any SMTP server

**6. Security Features:**
- **Zero Plain-Text Storage**: All passwords encrypted in Supabase Vault
- **Service Role Authentication**: Only server-side functions can decrypt credentials
- **Connection Validation**: SMTP settings validated before storage
- **Audit Trails**: Complete logging of email operations

**7. Tool Discovery & Execution:**
- `get-agent-tools` Edge Function dynamically discovers authorized tools from database
- `smtp_send_email` tool appears only for agents with SMTP permissions
- Tool execution includes automatic credential discovery and email sending
- Comprehensive error handling with user-friendly messages

### **Technical Components**

**Database Tables:**
- `user_integration_credentials`: Stores connection records with vault references
- `agent_integration_permissions`: Controls which agents can use SMTP tools
- `integration_capabilities`: Defines available SMTP capabilities dynamically

**Edge Functions:**
- `smtp-api`: Handles email sending with automatic credential discovery
- `get-agent-tools`: Provides dynamic tool discovery for agents
- `universal-tool-executor`: Routes SMTP tool calls to correct handler

**Frontend Components:**
- **Integrations Page**: SMTP provider setup with pre-configured options
- **Channels Modal**: Agent permission management for SMTP access
- **SMTPSetupModal**: Complete SMTP server configuration interface

## 🔍 Web Research Integration

Agentopia provides comprehensive web research capabilities that allow agents to search the web, scrape web pages, and summarize content to answer user questions with up-to-date information.

### Supported Providers

*   **Serper API**: Fast Google search results with high accuracy
*   **SerpAPI**: Comprehensive search engine results API
*   **Brave Search API**: Privacy-focused search with good coverage

### Features

*   **Web Search**: Query multiple search engines for relevant results
*   **Page Scraping**: Extract content from web pages for analysis
*   **Content Summarization**: AI-powered summarization of web content
*   **Multi-Provider Support**: Seamless switching between search providers
*   **Secure API Key Management**: All provider API keys stored securely in Supabase Vault

### Database Schema

Key tables for web research:

*   **`web_search_providers`**: Configuration for different search providers
*   **`user_web_search_keys`**: User API keys for search providers (stored securely)
*   **`user_integrations`**: Integration status and configuration

### Usage Flow

1. **Setup**: Users add their search provider API keys through the integrations interface
2. **Storage**: API keys are securely stored using the VaultService
3. **Agent Access**: Agents can use web research tools when granted permissions
4. **Execution**: The `web-search-api` function handles search, scrape, and summarization requests
5. **Results**: Processed information is returned to agents for response generation

## Gmail Integration

Full Gmail integration allows agents to send emails on behalf of users through secure OAuth authentication.

### Features

*   **OAuth 2.0 Authentication**: Secure Google OAuth flow for Gmail access
*   **Email Sending**: Agents can compose and send emails
*   **Permission Management**: Fine-grained control over which agents can access Gmail
*   **Scope-Based Security**: Only granted OAuth scopes are accessible to agents

### OAuth Flow

1. **User Authorization**: Users authenticate with Google via OAuth 2.0
2. **Token Storage**: OAuth tokens securely stored in Supabase Vault
3. **Agent Permissions**: Users grant specific Gmail permissions to agents
4. **Secure Access**: Agents access Gmail only through server-side functions

### Database Schema

*   **`oauth_providers`**: OAuth provider configurations
*   **`user_oauth_connections`**: User OAuth connections with encrypted tokens
*   **`agent_integration_permissions`**: Agent-specific OAuth scope permissions

### Security Model

*   **Encrypted Token Storage**: All OAuth tokens encrypted in Supabase Vault
*   **Scope Validation**: Each agent operation validates required OAuth scopes
*   **User Control**: Users maintain full control over agent permissions
*   **Audit Trail**: Complete logging of all Gmail operations for transparency

## Tool Use Infrastructure

Agentopia implements a sophisticated tool use system that allows agents to perform actions on behalf of users through various integrations (e.g., Gmail, Slack, GitHub). This system leverages OpenAI's function calling capabilities combined with a permissions-based architecture.

### Architecture Overview

1. **Tool Definition**: Tools are defined with OpenAI function schemas that specify parameters, descriptions, and required OAuth scopes
2. **Permission System**: Fine-grained permissions control which agents can use which tools based on user-granted OAuth scopes
3. **Tool Execution**: When agents request tool use, the system validates permissions, executes the tool, and returns results
4. **Integration Support**: Gmail (send/read/search/actions) with extensible architecture for additional providers

### Database Schema for Tool Use

Key tables involved in the tool use infrastructure:

* **`oauth_providers`**: Stores OAuth provider configurations (e.g., Gmail, Slack)
* **`user_oauth_connections`**: Links users to their OAuth connections with encrypted tokens
* **`agent_integration_permissions`**: Controls which agents have access to which OAuth scopes
  * `agent_id`: The agent granted permissions
  * `user_oauth_connection_id`: The OAuth connection to use
  * `allowed_scopes`: JSONB array of granted OAuth scopes (e.g., `["https://www.googleapis.com/auth/gmail.send"]`)
  * `is_active`: Whether the permission grant is currently active

### RPC Functions

The system uses PostgreSQL functions to manage tool availability:

* **`get_gmail_tools(p_agent_id, p_user_id)`**: Returns available Gmail tools based on granted permissions
* **`validate_agent_gmail_permissions(p_agent_id, p_user_id, p_required_scopes[])`**: Validates if an agent has required scopes

### Tool Execution Flow (Database-Driven)

1. **User grants OAuth permissions**: User connects their Gmail/other accounts via OAuth flow
2. **User assigns permissions to agent**: Through the AgentEdit UI, users grant specific OAuth scopes to agents
3. **Agent receives user message**: When a user asks an agent to perform an action (e.g., "send an email")
4. **🔄 Chat function retrieves available tools**: The `chat` function calls `FunctionCallingManager.getAvailableTools()` which:
   - Queries `integration_capabilities` table for tool definitions (NO hardcoding)
   - Normalizes OAuth scope URIs and consults `agent_integration_permissions`
   - Uses specific tool names (e.g., `smtp_send_email`, `gmail_send_email`) for proper routing
5. **Tools are passed to OpenAI**: Database-driven tool definitions included in OpenAI API call
6. **Agent requests tool use**: OpenAI returns tool calls with specific tool names (e.g., `smtp_send_email`)
7. **System validates and executes**: The system validates permissions and routes execution based on tool name prefix. The chat function injects the caller JWT into `options.auth.token`; routing logic forwards to appropriate edge functions.
8. **🔄 Intelligent Retry System**: If tools return **LLM-friendly error messages**, the system automatically triggers up to **3 retry attempts**:
   - **Error Pattern Detection**: Messages containing "Question:", "What", "Please provide", "Missing" trigger retries
   - **System Guidance**: Adds contextual instructions to help the LLM provide correct parameters  
   - **Progressive Enhancement**: Increases creativity (temperature 0.7 vs 0.5) to improve parameter generation
   - **Seamless User Experience**: Multiple attempts happen transparently, user sees final success or failure
9. **Results returned to agent**: Tool execution results are sent back to OpenAI for final response

### ⚡ LLM-Friendly Error Response System

Agentopia implements a **sophisticated error response system** designed to create seamless user experiences by converting technical errors into intelligent questions that guide the LLM to provide correct parameters.

#### **🎯 Core Philosophy: Interactive Errors, Not Technical Failures**

Instead of returning technical error messages that break the user experience, our system returns **interactive questions** that allow the LLM to gather missing information and retry automatically.

**❌ Old Technical Errors (Poor UX):**
```typescript
// These break the user experience
{ success: false, error: "Missing required parameters: to, subject, body" }
{ success: false, error: "HTTP 400: Bad Request" }  
{ success: false, error: "No API key found for provider" }
```

**✅ New LLM-Friendly Errors (Seamless UX):**
```typescript
// These enable intelligent retry with user guidance
{ success: false, error: "Question: Who should I send this email to? Please provide the recipient email address." }
{ success: false, error: "Question: What would you like me to search for? Please provide a search query or topic." }
{ success: false, error: "Question: Your Gmail API key appears to be corrupted. Please re-add your Gmail credentials in the integration settings." }
```

#### **🔄 Automatic Retry Mechanism**

The system detects interactive error patterns and automatically triggers **intelligent retries**:

1. **Pattern Detection**: Identifies errors containing "Question:", "What", "Please provide", "Missing"
2. **System Guidance**: Injects contextual instructions to help the LLM understand what's needed
3. **Progressive Enhancement**: Increases creativity (temperature 0.7 vs 0.5) for better parameter generation
4. **Multiple Attempts**: Up to 3 retry attempts with learning from previous failures
5. **Transparent Operation**: User sees final success or failure, retries happen seamlessly

#### **📋 Error Response Design Guidelines**

**For Integration Developers:**

1. **Use Interactive Questions**: Start errors with "Question:" when seeking missing information
2. **Be Specific**: Tell the LLM exactly what parameter or information is needed
3. **Provide Context**: Explain why the information is needed and how to provide it
4. **Guide Action**: Include actionable steps when possible (e.g., "Please re-add your credentials")
5. **Avoid Technical Jargon**: Use natural language that LLMs understand well

**Examples by Integration Type:**

**Email Tools (Gmail/SMTP):**
```typescript
// Missing recipient
"Question: Who should I send this email to? Please provide the recipient email address."

// Missing subject  
"Question: What should be the subject line of this email?"

// Auth issues
"Question: Your email service needs to be set up. Please ensure your email integration is properly configured with valid credentials."
```

**Search Tools (Web Search):**
```typescript
// Missing query
"Question: What would you like me to search for? Please provide a search query or topic."

// Missing URLs for scraping
"Question: Which websites would you like me to scrape and summarize? Please provide one or more URLs."

// API key issues
"Question: The search service needs to be configured. Please add your web search API key in the integration settings."
```

#### **🛠️ Implementation Locations**

**1. Edge Functions (Primary):**
- Direct error message generation in `gmail-api`, `web-search-api`, etc.
- Context-aware error messages based on missing parameters
- Provider-specific guidance and troubleshooting

**2. UniversalToolExecutor (Fallback Enhancement):**
- Automatically enhances technical errors that weren't made LLM-friendly
- Pattern-based error conversion for tool categories
- Ensures all errors become retry-capable

#### **📊 Technical Benefits**

- **Higher Success Rate**: Tools succeed more often with proper retry guidance
- **Better User Experience**: Seamless interaction without manual intervention
- **Reduced Support Burden**: Self-resolving issues reduce support requests
- **Consistent Behavior**: All integrations behave like native MCP tools
- **Scalable Architecture**: New integrations inherit retry capabilities automatically

#### **🎯 Success Metrics**

- **3x Retry Attempts**: Optimal balance between success rate and performance
- **Progressive Temperature**: 0.5 → 0.7 increase enhances parameter creativity
- **Universal Coverage**: All edge functions support LLM-friendly errors
- **Transparent Operation**: Users unaware of retry attempts unless they fail

This system ensures that Agentopia tools provide the same seamless, intelligent experience as high-quality MCP servers, making tool failures feel like natural conversation flow rather than technical breakdowns.

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
* **`scripts/view_gmail_logs.js <agent_id> [limit]`**: View detailed Gmail operation logs

### Tool Execution Visibility

Agentopia provides comprehensive visibility into tool executions:

1. **Real-time Console Logs** (`src/components/ToolExecutionLogger.tsx`)
   - Live execution logs displayed in chat interface
   - Color-coded log levels with millisecond timestamps
   - Copy/download functionality for debugging

2. **Enhanced Error Messages** 
   - Detailed error descriptions with specific troubleshooting steps
   - Context-aware guidance based on error type
   - Execution timing information

3. **Tool Execution History** (`src/components/ToolExecutionHistory.tsx`)
   - Complete audit trail of all tool executions
   - Filter by tool, provider, status
   - Export to CSV for analysis
   - Integrated into agent edit page

4. **Visual Status Indicators** (`src/components/ToolExecutionStatusIndicator.tsx`)
   - Real-time progress tracking
   - Step-by-step execution status
   - Provider-specific icons and animations

### Common Issues and Solutions

1. **"I don't have the required Gmail permissions" error**:
   - Usually indicates the `get_gmail_tools` RPC function is returning empty
   - Check that `allowed_scopes` column exists (not `granted_scopes`)
   - Verify the agent_integration_permissions record exists and is active
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

## Advanced JSON-Based Chat System

Agentopia features a revolutionary next-generation chat architecture that transforms simple text exchanges into intelligent, context-aware conversations with advanced memory, state management, and optimization capabilities. This enterprise-grade system provides sophisticated agent interactions that learn, adapt, and evolve.

### 🚀 **System Overview**

The Advanced JSON-Based Chat System implements a **comprehensive, multi-layered architecture** built on four core principles:

- **JSON-First**: Everything is structured JSON for maximum extensibility
- **Memory-Driven**: Persistent learning and context retention across sessions
- **State-Aware**: Agents maintain rich state for intelligent behavior
- **Context-Optimized**: Intelligent information selection within token limits
- **Backward Compatible**: Seamless integration with existing systems

### 🧠 **Message Processing Pipeline**

#### **Enhanced Message Structure**
```typescript
interface AdvancedChatMessage {
  id: string;                    // UUID v4
  version: string;              // Semantic versioning
  role: MessageRole;            // system | user | assistant | tool
  content: MessageContent;      // Rich structured content
  timestamp: string;            // ISO 8601 with timezone
  metadata: MessageMetadata;    // Conversation context
  context: MessageContext;      // Available context information
  tools?: ToolCall[];          // Tool executions
  memory?: MemoryReference[];  // Referenced memories
  state?: StateSnapshot;       // Agent state at message time
  audit?: AuditInformation;    // Tracking and debugging
}
```

#### **Processing Flow**
```
Incoming Message → Schema Validation → Context Building → Memory Retrieval → 
State Loading → AI Processing → Response Generation → Memory Storage → 
State Updates → Context Optimization → Response Delivery
```

### 🧠 **Multi-Tiered Memory System**

The system implements **four types of memory** that work together to create intelligent, learning agents:

#### **1. Episodic Memory (Experiences)**
- **Event Storage**: Conversation experiences with temporal context
- **Participant Tracking**: Who was involved in each interaction
- **Emotional Context**: Mood and sentiment analysis
- **Outcome Recording**: Success/failure patterns for learning
 - **Retrieval**: Vector search via Pinecone using the agent’s configured datastore; merged into `context_window.sections` prior to reasoning.

#### **2. Semantic Memory (Knowledge)**
- **Concept Storage**: Facts, definitions, and relationships
- **Confidence Scoring**: Reliability metrics for information
- **Knowledge Graphs**: Interconnected concept relationships
- **Domain Expertise**: Specialized knowledge areas
 - **Retrieval**: GetZep knowledge graph when connected (via datastore). If not connected, concept search fallback. Merged into `context_window.sections` and labeled `SEMANTIC MEMORY` in the assistant preamble.

#### **3. Procedural Memory (Skills)**
- **Task Procedures**: Step-by-step process knowledge
- **Success Tracking**: Performance metrics and optimization
- **Skill Evolution**: Continuous improvement patterns
- **Best Practices**: Learned effective approaches

#### **4. Working Memory (Current Context)**
- **Active Context**: Current conversation threads
- **Capacity Management**: Intelligent information prioritization
- **Thread Tracking**: Multiple conversation streams
- **Real-time Updates**: Dynamic context adaptation

### ⚙️ **State Management System**

Agents maintain **four tiers of state** for comprehensive behavior management:

#### **1. Local State (Agent-Specific)**
- **Preferences**: Communication style, verbosity levels
- **Learned Patterns**: User-specific behavior adaptations
- **Current Focus**: Active tasks and attention management
- **Personal Context**: Individual agent characteristics

#### **2. Shared State (Cross-Agent)**
- **Project Context**: Shared project information and status
- **Knowledge Sharing**: Common discoveries and insights
- **Collaboration State**: Multi-agent coordination
- **Team Dynamics**: Inter-agent relationships

#### **3. Session State (Conversation-Specific)**
- **Conversation Mode**: Current interaction type
- **Active Tools**: Available and in-use capabilities
- **Goals**: Current conversation objectives
- **Context Switching**: Handling topic transitions

#### **4. Persistent State (Long-Term)**
- **Expertise Areas**: Developed specializations
- **Relationships**: User trust levels and interaction history
- **Learning Progress**: Skill development tracking
- **Evolution Metrics**: Long-term improvement patterns

### 🎯 **Context Optimization Engine**

The system intelligently selects and optimizes context for maximum effectiveness:

#### **Smart Context Selection**
- **Relevance Scoring**: AI-powered content prioritization
- **Token Budget Management**: Optimal information density
- **Quality Preservation**: Maintaining information coherence
- **Source Diversity**: Balanced information sources

#### **Compression Strategies**
- **Semantic Compression**: Meaning-preserving summarization
- **Temporal Compression**: Time-aware information condensation
- **Concept Extraction**: Key insight identification
- **Dynamic Adaptation**: Context-aware optimization

#### **Performance Optimization**
```typescript
const contextRequest = {
  query: "How do I fix this React error?",
  token_budget: 32000,
  optimization_goals: [OptimizationGoal.MAXIMIZE_RELEVANCE],
  required_sources: [ContextSource.CONVERSATION_HISTORY],
  excluded_sources: [ContextSource.OUTDATED_KNOWLEDGE]
};
```

### 🔧 **Extensibility Architecture**

#### **1. Message Content Extensibility**
Support for unlimited content types through structured JSON:

```typescript
// Text Message
content: { type: "text", text: "Hello", formatting: {...} }

// Code Message  
content: { type: "structured", data: { code: "...", language: "js" } }

// Multimodal Message
content: { type: "multimodal", elements: [text, image, code] }

// Tool Result
content: { type: "tool_result", tool_name: "web_search", result: {...} }
```

#### **2. Memory System Extensions**
Custom memory types for specialized domains:

```typescript
interface ProjectMemory extends BaseMemory {
  memory_type: 'project';
  content: {
    project_name: string;
    milestones: Milestone[];
    team_members: string[];
    current_status: string;
  };
}
```

#### **3. State Management Extensions**
Custom state partitions for specialized behavior:

```typescript
interface AgentStateV2 extends AgentState {
  custom_state: {
    domain_expertise: ExpertiseMap;
    learning_objectives: LearningGoal[];
    collaboration_preferences: CollabPrefs;
  };
}
```

#### **4. Context Source Extensions**
Add new context sources for specialized information:

```typescript
class DatabaseSchemaContextSource implements ContextSource {
  async retrieve(query: string): Promise<ContextCandidate[]> {
    // Custom context retrieval logic
  }
}
```

#### **5. Tool Integration Extensions**
Rich tool integration with memory and state awareness:

```typescript
interface AdvancedTool extends BaseTool {
  context_requirements: ContextRequirement[];
  memory_integration: MemoryIntegration;
  state_modifications: StateModification[];
}
```

### 📊 **Technical Implementation**

#### **Database Schema**
- **10 new tables** for comprehensive data management
- **Advanced indexes** including vector embeddings
- **Row-level security** for data protection
- **SQL functions** for performance optimization

#### **Type System**
- **150+ TypeScript interfaces** for type safety
- **Runtime validation** with Zod schemas
- **40+ utility functions** for common operations
- **Zero linting errors** with strict TypeScript compliance

#### **Performance Features**
- **Token tracking** throughout the system
- **Caching mechanisms** for frequently accessed data
- **Compression algorithms** for optimal memory usage
- **Quality metrics** for continuous optimization

### 🎯 **Practical Benefits**

#### **For Users**
- **Intelligent Conversations**: Context-aware, memory-driven responses
- **Personalization**: Adaptive behavior based on interaction patterns
- **Consistency**: Agents remember preferences and context across sessions
- **Learning**: Continuous improvement from user feedback

#### **For Developers**
- **Rich APIs**: Comprehensive REST and WebSocket interfaces
- **Type Safety**: Full TypeScript support with validation
- **Debugging**: Detailed audit trails and performance metrics
- **Extensibility**: Plugin architecture for custom functionality

#### **For Enterprises**
- **Scalability**: Horizontal scaling with state synchronization
- **Security**: Row-level security and comprehensive audit trails
- **Compliance**: Enterprise-ready data structures and policies
- **Reliability**: Robust error handling and graceful degradation

### 🚦 **Current Status**

#### **✅ Completed Phases**
- **Phase 1**: Foundation Implementation - Type definitions, validation, core structure
- **Phase 2**: Memory System - Multi-tiered memory with consolidation and decay
- **Phase 3**: State Management - Four-tier state system with synchronization
- **Phase 4**: Context Optimization - Intelligent context selection and compression

#### **🔄 Current Phase**
- **Phase 5**: Integration Layer - V2 API integration with backward compatibility

#### **📈 Performance Metrics**
- **1,000+ lines** of production-ready TypeScript code
- **10 database tables** with comprehensive schema
- **SQL functions** for memory and state management
- **Zero linting errors** across all implementations

### 📚 **Complete Documentation**

For comprehensive technical documentation, implementation guides, and architectural specifications, see:

- **📁 Main Documentation**: `docs/plans/advanced_json_chat_system/`
- **🔍 Research Documents**: Detailed analysis and methodology in `research/` subdirectory
- **📋 Implementation Guides**: Step-by-step implementation in `implementation/` subdirectory
- **✅ Progress Tracking**: Complete WBS checklist with status updates

#### **Key Documentation Files**
- **`plan.md`**: Overall system architecture and component overview
- **`wbs_checklist.md`**: Detailed progress tracking with completion status
- **`research/`**: In-depth research on memory injection, state management, and JSON optimization
- **`implementation/`**: Phase-by-phase implementation documentation with code examples

This Advanced JSON-Based Chat System represents a fundamental evolution in AI agent capabilities, transforming simple conversations into intelligent, adaptive, and extensible interactions that grow with user needs while maintaining enterprise-grade reliability and performance.

## Enhanced Chat Experience & AI Process Transparency

Agentopia provides an unprecedented level of transparency into AI agent thinking processes, allowing users to see exactly how agents analyze requests, make decisions, and execute tools. This system enables effective prompt verification, debugging, and understanding of agent behavior.

### Real-Time AI Process Visualization

**🧠 Thinking Process Indicators:**
- **Step-by-step visibility** of AI processing phases (thinking, analyzing tools, executing tools, processing results, generating response)
- **Real-time status updates** with agent avatar and current processing state
- **Discreet header indicators** showing AI state without interrupting conversation flow
- **Professional animations** with smooth transitions and visual feedback

**📋 Process Phases Tracked:**
1. **Thinking**: Initial analysis of user request and context evaluation
2. **Analyzing Tools**: Evaluation of available tools and decision making
3. **Executing Tool**: Active tool usage with parameter validation and execution
4. **Processing Results**: Analysis and integration of tool outputs
5. **Generating Response**: Final response formulation and delivery

### Expandable "Thoughts" Section

**🔍 Deep Visibility Features:**
- **Integrated "Thoughts" dropdown** next to agent name in each response
- **Expandable step details** showing complete AI reasoning process
- **Actual AI responses** captured during each processing phase
- **Tool call visibility** with exact function calls and parameters
- **Tool result inspection** with complete JSON responses and error details
- **Execution timing** with millisecond-precision duration tracking

**📊 What You Can See:**
```
🧠 AI Response:
User asked: "send an email"
I need to understand what they're asking for and determine the best way to help them...

🔧 Tool Call:
gmail.send_email({
  to: "user@example.com",
  subject: "Response to your inquiry", 
  body: "Thank you for your message..."
})

✅ Tool Result:
{
  "success": true,
  "message_id": "msg_abc123",
  "sent_at": "2025-01-02T10:35:00Z"
}
```

### Professional Chat Interface

**🎨 Claude-Style Design:**
- **Seamless message bubbles** without borders for clean appearance
- **Timestamp positioning** in bottom-right corner of messages
- **Gradient fade effects** for elegant text transitions
- **Proper message alignment** with user messages on right, agent on left
- **Agent avatar integration** showing profile images throughout chat
- **Responsive layout** with optimized spacing and typography
 - **Immediate Markdown fidelity**: Frontend normalizes Markdown and uses consistent renderers so lists/headings render correctly on first paint (no refresh required)

**⚡ State Management:**
- **Persistent thinking data** preserved across page reloads
- **Smart message merging** maintaining AI process details during history loads
- **Real-time updates** with immediate response visibility
- **Robust error handling** with fallback mechanisms

### Developer & Debug Benefits

**🔧 Debugging Capabilities:**
- **Prompt verification** by viewing actual AI reasoning
- **Tool execution validation** with complete request/response cycles
- **Performance monitoring** with detailed timing information
- **Error diagnosis** through comprehensive process visibility
- **Integration testing** with real-time tool call inspection

**📈 Use Cases:**
- **Agent Development**: Verify prompts are working as intended
- **Tool Integration**: Debug API calls and response handling
- **Performance Optimization**: Identify bottlenecks in processing
- **User Support**: Understand agent behavior for better assistance
- **Quality Assurance**: Validate agent responses and decision-making

### Technical Implementation

**🏗️ Architecture:**
- **React state management** with robust message persistence
- **TypeScript interfaces** for type-safe AI process tracking
- **CSS variable theming** with dark/light mode support
- **Tailwind styling** with professional color schemes
- **Supabase integration** for secure data storage and retrieval

**💾 Data Structures:**
```typescript
interface AIProcessDetails {
  steps: Array<{
    state: string;
    label: string;
    response?: string;        // Actual AI reasoning
    toolCall?: string;        // Function call details
    toolResult?: any;         // Complete tool response
    duration?: number;        // Execution timing
    completed: boolean;
  }>;
  totalDuration?: number;
  toolsUsed?: string[];
}
```

This transparency system transforms agent interactions from black-box operations into fully observable, debuggable processes, enabling better agent development, troubleshooting, and user understanding.

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
*   **✅ MAJOR SUCCESS - Large Files Refactoring COMPLETE:** 
    *   **EnhancedChannelsModal.tsx**: ✅ **COMPLETE** - Successfully refactored 1,140-line monolith into 14 modular components (384-line main orchestrator + 13 focused components 50-180 lines each). All components Philosophy #1 compliant (≤500 lines), lint-free, and follow modern React patterns.
    *   **EnhancedToolsModal.tsx**: ✅ **COMPLETE** - Successfully refactored 1,525-line monolith into 12 modular components (286-line main orchestrator + 11 focused components 50-250 lines each). All components Philosophy #1 compliant (≤500 lines), lint-free, and follow modern React patterns.
    *   **🎆 ACHIEVEMENT**: Both major modal refactoring efforts completed! Transformed 2,665 lines of monolithic code into 26 focused, maintainable components - a **fundamental improvement** in codebase architecture.
    *   Some frontend page components may still benefit from refactoring (e.g., `src/pages/agents/[agentId]/edit.tsx`, `src/pages/DatastoresPage.tsx` - line counts need verification).
    *   The core `supabase/functions/chat/index.ts` function is ~695 lines and should be reviewed for refactoring.
*   **Suboptimal Tokenizer:** The `ContextBuilder` in `supabase/functions/chat/context_builder.ts` uses a basic character count for token estimation; consider replacing with `tiktoken` for accuracy.
*   **Team Membership Access:** The `fetchWorkspaces` hook doesn't currently grant workspace access based on Team membership; this might need enhancement.
*   **UI Component Completeness:** Ensure all necessary Shadcn UI components are created/installed.
*   **Pinecone configuration:** Current Pinecone API key is rejected; vector search gracefully falls back. Either disable episodic lookups or configure valid keys.

## Recent Improvements

*   **🆕 Light Mode Theme Implementation (January 2025):**
    *   **Complete UI Transformation:** Implemented comprehensive light mode as default theme with professional, clean appearance
    *   **CSS Variable System:** Advanced theming architecture using CSS custom properties for both light and dark modes
    *   **WCAG AA Compliance:** All color combinations meet accessibility standards with 4.5:1+ contrast ratios
    *   **Component Updates:** Updated 100+ UI components including sidebar, dashboard cards, navigation, and forms
    *   **Vibrant Icon Colors:** 11-color professional palette with semantic meaning and smart mapping system for enhanced visual hierarchy
    *   **Developer Experience:** Comprehensive documentation with theming guidelines, modification workflows, and safety protocols
    *   **Backup System:** Automated file backups for all theme modifications following Rule #3 safety protocols
    *   **Theme Categories:** Specialized variables for sidebar, dashboard, chat interface, and status indicators
    *   **Future-Ready Architecture:** Infrastructure prepared for dynamic theme switching and user preferences
*   **🆕 Web Search Integration (July 2025):**
    *   Complete web research infrastructure with support for multiple providers (Serper API, SerpAPI, Brave Search)
    *   Secure API key management through Supabase Vault integration
    *   Web search, page scraping, and AI-powered content summarization capabilities
    *   Edge Function (`web-search-api`) for server-side search operations
    *   Integration setup modal with provider selection and key management
*   **🆕 Secure Secret Management System (July 2025):**
    *   Implemented centralized `VaultService` class for secure secret management
    *   Created `create-secret` Edge Function with proper CORS handling for production deployments
    *   Added `get_secret` database function for secure secret retrieval
    *   Established reusable pattern for all future API integrations and OAuth systems
*   **🆕 Gmail Integration Enhancement (July 2025):**
    *   Enhanced existing Gmail OAuth integration with improved security
    *   Updated to use new VaultService for secure token storage
    *   Improved error handling and permission validation
*   **🆕 Chat Handoff Protocol Implementation (July 2025):**
*   **🆕 Advanced Chat V2 Memory & Context (August 2025):**
    * Agent‑scoped datastore resolution (Pinecone/GetZep)
    * Episodic = Pinecone vector search; Semantic = GetZep knowledge graph (with fallback)
    * Memory merged into `context_window.sections` before reasoning/tool use
    * Assistant preamble injects labeled memory blocks; Process Modal shows memory and reasoning metrics
     * Frontend Markdown normalization for correct initial rendering
*   **🆕 Chat Router Fallback (August 2025):**
    * Added null-guard around optional LLM Router module
    * Auto-fallback to OpenAI with tools when router is missing or `resolveAgent` fails
    * Eliminates `Cannot read properties of null (reading 'resolveAgent')` errors in production
*   **🆕 Task Scheduling System (August 2025):**
    * Complete automated task scheduling infrastructure with one-time and recurring tasks
    * **🔄 Multi-Step Workflow Capabilities**: Sequential task execution with context passing between steps
    * **Step Management Interface**: Drag-and-drop step reordering, inline editing, and comprehensive step configuration
    * **Enhanced Database Schema**: `task_steps` table with execution tracking, status management, and performance metrics
    * **Modular Component Architecture**: StepManager, StepList, StepCard, StepEditor components (all ≤500 lines)
    * **Database Functions**: `create_task_step()`, `update_task_step()`, `delete_task_step()` with validation and security
    * **Backward Compatibility**: Existing single-step tasks continue to work with automatic migration support
    * Modern step-by-step wizard UI with colorful, gradient-based design and emoji indicators
    * Full timezone support with auto-detection and IANA timezone handling
    * PostgreSQL `pg_cron` integration for automated execution every 5 minutes
    * Edge Function integration: `agent-tasks` for CRUD operations, `task-executor` for automated processing
    * Croner library integration for timezone-aware cron expression calculation
    * Comprehensive task management with edit, run now, pause, and delete operations
    * Conversation integration allowing task results to target specific conversations or create new ones
*   **🆕 Enhanced Team Management System (August 2025):**
    * **Modal-Based Team Creation:** Streamlined team creation workflow using modern modal interface instead of separate page navigation
    * **Comprehensive Team Details Page:** Enhanced team information display with dedicated overview section, team descriptions, creation dates, and status indicators
    * **Fixed Edit Team Functionality:** Resolved critical "Team not found" error by correcting hook usage, adding proper state management, and implementing correct API integration
    * **Modern UI & Theme Consistency:** Complete dark mode fixes across all team components with proper CSS variable usage and theme-aware styling
    * **Enhanced Team Cards:** Improved team card design with better hover states, proper borders, and consistent theming
    * **Type System Integration:** Added proper Team and TeamMember types to the TypeScript system for better type safety
    * **Modular Architecture:** Clean separation of concerns with CreateTeamModal component and updated routing structure
    * **Improved User Experience:** Better loading states, error handling, and form validation throughout the team management workflow
*   **🆕 Zapier MCP Integration (August 2025):**
    * **Universal Tool Connectivity:** Implemented Model Context Protocol (MCP) client for connecting to Zapier's 8,000+ app integrations
    * **Per-Agent MCP Servers:** Each agent can connect to its own unique Zapier MCP server for personalized tool access
    * **Dynamic Tool Discovery:** Automatic discovery and caching of available tools from MCP servers with OpenAI schema conversion
    * **Seamless Function Calling:** MCP tools integrate transparently with existing OpenAI function calling infrastructure
    * **Intelligent Tool Routing:** Metadata-based routing system that keeps function schemas clean while enabling MCP execution
    * **Comprehensive UI Management:** Intuitive connection interface with tool listing, refresh controls, and status indicators
    * **Protocol Compliance:** Full implementation of MCP 2024-11-05 specification with JSON-RPC 2.0 over Streamable HTTP
    * **Production-Ready Error Handling:** Robust connection validation, detailed error messages, and graceful degradation

## Memory Systems & Knowledge Integration

Agentopia implements a sophisticated dual-memory architecture that enables agents to learn from experiences and access knowledge graphs for intelligent, context-aware responses. The system supports per-agent datastore configurations and provides comprehensive memory retrieval capabilities.

### 🧠 **Dual Memory Architecture**

#### **1. Episodic Memory (Experience Storage)**
- **Purpose**: Stores conversation experiences, interactions, and temporal context
- **Technology**: Pinecone vector database with embedding-based similarity search
- **Configuration**: Per-agent datastore connections via `agent_datastores` table
- **Retrieval**: Vector search using conversation context and user queries
- **Integration**: Results merged into `context_window.sections` before AI reasoning
- **Status Tracking**: Real-time status reported in Process Modal ("searched", "disconnected")

#### **2. Semantic Memory (Knowledge Graph)**
- **Purpose**: Stores facts, concepts, relationships, and structured knowledge
- **Technology**: GetZep knowledge graph with concept-based retrieval
- **Configuration**: Agent-specific GetZep connections via datastore configs
- **Retrieval**: Knowledge graph queries with concept extraction and relationship mapping
- **Fallback**: Concept search when GetZep is not connected
- **Integration**: Results labeled as "SEMANTIC MEMORY" in assistant context

### 🔧 **Technical Implementation**

#### **Database Schema**
```sql
-- Core datastore configuration
datastores: {
  id: uuid,
  name: text,
  type: 'pinecone' | 'getzep',
  config: jsonb  -- Provider-specific credentials and settings
}

-- Per-agent datastore linking
agent_datastores: {
  agent_id: uuid,
  datastore_id: uuid,
  is_active: boolean
}
```

#### **Configuration Examples**
```json
// Pinecone Datastore Config
{
  "apiKey": "pc-xxx",
  "region": "us-east-1", 
  "indexName": "agent-memories",
  "dimensions": 1536
}

// GetZep Datastore Config
{
  "apiKey": "zep-xxx",
  "projectUuid": "proj-xxx",
  "sessionId": "agent-session-xxx"
}
```

### 🚀 **Memory Retrieval Process**

#### **1. Query Processing**
- User message triggers memory search across both systems
- Query text extracted and used for similarity/concept matching
- Parallel searches executed for optimal performance

#### **2. Episodic Retrieval (Pinecone)**
- Vector embeddings generated from query context
- Similarity search against agent's Pinecone index
- Results filtered by relevance threshold (configurable)
- Top matches returned with relevance scores

#### **3. Semantic Retrieval (GetZep)**
- Knowledge graph queried for related concepts
- Relationship traversal for contextual information
- Concept extraction and entity recognition
- Structured knowledge returned with confidence scores

#### **4. Context Integration**
- Memory results merged into conversation context
- Labeled sections added to assistant prompt
- Token budget managed for optimal context window usage
- Quality metrics tracked for performance monitoring

### 📊 **Status Reporting & Monitoring**

#### **Real-Time Status Tracking**
The system provides comprehensive status reporting through the Process Modal:

```typescript
// Memory Status Types
type MemoryStatus = 'searched' | 'disabled' | 'disconnected' | 'error';

// Episodic Memory Metrics
episodic_memory: {
  status: 'searched',           // Simple: if search attempted = "searched"
  results_count: 5,             // Number of memories retrieved
  relevance_scores: [0.89, 0.76, 0.65],
  search_time_ms: 150,
  memories: [...memories]       // Actual memory content
}

// Semantic Memory Metrics  
semantic_memory: {
  status: 'searched',           // Simple: if search attempted = "searched"
  results_count: 3,
  concepts_retrieved: ['AI', 'memory', 'search'],
  search_time_ms: 200,
  memories: [...concepts]       // Knowledge graph results
}
```

#### **Status Determination Logic**
- **"searched"**: Memory retrieval was attempted (regardless of result count)
- **"disabled"**: Memory system not configured for this agent
- **"disconnected"**: Datastore configuration exists but connection failed
- **"error"**: System error during memory retrieval

### 🔄 **Memory Lifecycle**

#### **Storage Process**
1. **Conversation Ingestion**: Messages processed for memory creation
2. **Episodic Storage**: Experiences stored with temporal and participant context
3. **Semantic Extraction**: Concepts and facts extracted for knowledge graph
4. **Relationship Mapping**: Connections established between related information
5. **Quality Scoring**: Relevance and importance metrics assigned

#### **Retrieval Process**
1. **Query Analysis**: User message analyzed for memory relevance
2. **Parallel Search**: Both episodic and semantic systems queried simultaneously
3. **Result Filtering**: Relevance thresholds applied to ensure quality
4. **Context Merging**: Results integrated into conversation context
5. **Token Management**: Context optimized within available token budget

### 🛠️ **Configuration & Setup**

#### **Agent Datastore Setup**
1. Create datastore record with provider credentials
2. Link agent to datastore via `agent_datastores`
3. Verify connection through admin interface
4. Monitor status through Process Modal

#### **Fallback Behavior**
- **No Datastore**: Memory systems report "disabled" status
- **Connection Issues**: Graceful degradation with "disconnected" status
- **Global Env Vars**: Pinecone fallback supported for backward compatibility
- **Error Handling**: Robust error recovery with detailed logging

### 📈 **Performance & Optimization**

#### **Search Optimization**
- **Parallel Execution**: Episodic and semantic searches run simultaneously
- **Relevance Filtering**: Quality thresholds prevent noise
- **Token Budgeting**: Context window optimization for maximum effectiveness
- **Caching**: Frequently accessed memories cached for performance

#### **Monitoring & Metrics**
- **Search Times**: Millisecond-precision timing for performance tracking
- **Result Quality**: Relevance scores and concept confidence metrics
- **Usage Analytics**: Memory system utilization and effectiveness tracking
- **Error Rates**: Connection stability and failure pattern analysis

### 🔧 **Troubleshooting & Diagnostics**

#### **Common Issues**
1. **"Unknown" Status in UI**: Fixed with simplified status logic - if search attempted, shows "searched"
2. **No Results**: Check datastore configuration and API key validity
3. **Connection Errors**: Verify network connectivity and provider service status
4. **Performance Issues**: Monitor search times and optimize relevance thresholds

#### **Debug Tools**
- **Process Modal**: Real-time memory system status and metrics
- **Chat Logs**: Detailed memory retrieval logging in Supabase functions
- **Admin Interface**: Datastore connection testing and configuration validation

This memory system transforms agents from stateless responders into intelligent, learning entities that build knowledge over time and provide increasingly contextual and relevant responses.

## Enhanced Team Management System

Agentopia provides a comprehensive team management system that enables users to create, organize, and manage teams of agents with modern UI/UX patterns and robust functionality.

### 🏗️ **System Architecture**

#### **Database Schema**
```sql
-- Core team storage
teams: {
  id: uuid,
  name: text,                    -- Team name
  description: text,             -- Team purpose and description
  owner_user_id: uuid,           -- Team creator/owner
  created_at: timestamptz,       -- Creation timestamp
  updated_at: timestamptz        -- Last modification
}

-- Team membership management
team_members: {
  id: uuid,
  team_id: uuid,                 -- Reference to teams table
  agent_id: uuid,                -- Reference to agents table
  team_role: text,               -- Member role (member, project_manager, etc.)
  reports_to_user: boolean,      -- Whether member reports to user
  created_at: timestamptz
}
```

#### **Component Architecture**
The team system follows a modular, modal-based architecture:

1. **`TeamsPage.tsx`** - Main teams listing with create button
2. **`CreateTeamModal.tsx`** - Modal-based team creation workflow
3. **`TeamDetailsPage.tsx`** - Comprehensive team information display
4. **`EditTeamPage.tsx`** - Team editing with proper state management
5. **`TeamCard.tsx`** - Individual team display cards
6. **`TeamMemberList.tsx`** - Team member management interface

### 🎯 **Key Features**

#### **Modal-Based Team Creation**
- **Streamlined Workflow**: Create teams without page navigation
- **Form Validation**: Real-time validation with helpful error messages
- **Modern UI**: Shadcn UI components with proper theming
- **Immediate Feedback**: Success/error states with clear messaging

#### **Comprehensive Team Details**
- **Team Overview Section**: Dedicated area for team information
- **Description Display**: Rich text support for team purpose and goals
- **Team Metadata**: Creation date, status, and team ID information
- **Member Management**: Full CRUD operations for team members

#### **Enhanced Team Cards**
- **Theme Consistency**: Proper light/dark mode support
- **Hover Effects**: Interactive states with smooth transitions
- **Visual Hierarchy**: Clear information layout with proper typography
- **Accessibility**: WCAG compliant with proper contrast ratios

### 🔧 **Technical Implementation**

#### **Type System Integration**
```typescript
// Core team types
export type Team = Database['public']['Tables']['teams']['Row'];
export type TeamMember = Database['public']['Tables']['team_members']['Row'] & {
  agent?: Agent;
};
```

#### **Hook Integration**
The system uses the `useTeams` hook for all team operations:
- `fetchTeams()` - Load all user teams
- `fetchTeamById(id)` - Load specific team details
- `createTeam(name, description)` - Create new team
- `updateTeam(id, updates)` - Update team information
- `deleteTeam(id)` - Remove team

#### **State Management**
- **Local State**: Component-level state for UI interactions
- **Server State**: Supabase integration with real-time updates
- **Error Handling**: Comprehensive error states with user feedback
- **Loading States**: Proper loading indicators throughout workflow

### 🎨 **UI/UX Improvements**

#### **Theme Consistency**
- **CSS Variables**: Uses theme-aware custom properties
- **Dark Mode Support**: Proper styling for both light and dark themes
- **Component Theming**: Consistent styling across all team components
- **Accessibility**: WCAG AA compliant color combinations

#### **Modern Design Patterns**
- **Card-Based Layout**: Clean, organized information display
- **Modal Workflows**: Non-disruptive team creation process
- **Progressive Disclosure**: Information revealed as needed
- **Responsive Design**: Works across all device sizes

### 🔄 **Team Lifecycle**

#### **Creation Process**
1. User clicks "Create New Team" button
2. Modal opens with team creation form
3. User enters team name and description
4. Form validation ensures required fields
5. Team created via `createTeam` hook
6. Success feedback and automatic navigation

#### **Management Operations**
- **View Details**: Comprehensive team information display
- **Edit Team**: Modify name, description, and settings
- **Manage Members**: Add/remove agents, assign roles
- **Delete Team**: Remove team with proper confirmation

### 🛠️ **Fixed Issues**

#### **"Team not found" Error Resolution**
- **Root Cause**: Incorrect hook usage in EditTeamPage
- **Solution**: Proper state management with async team loading
- **Implementation**: Fixed API integration and error handling
- **Result**: Seamless team editing functionality

#### **Dark Mode Styling Issues**
- **Problem**: Hardcoded gray colors not respecting theme
- **Solution**: Migrated to CSS custom properties
- **Coverage**: All team components updated for theme consistency
- **Benefit**: Proper light/dark mode support throughout

### 📊 **Current Status**

#### **✅ Completed Features**
- Modal-based team creation workflow
- Comprehensive team details page with overview section
- Fixed edit team functionality with proper error handling
- Complete theme consistency across all components
- Enhanced team cards with modern styling
- Proper TypeScript integration with type safety
- Modular component architecture

#### **🔧 Technical Achievements**
- **Zero Linting Errors**: All components pass TypeScript validation
- **Theme Compliance**: Complete CSS variable usage
- **Accessibility**: WCAG AA compliant throughout
- **Performance**: Optimized component rendering and state management
- **Maintainability**: Clean separation of concerns and modular design

The Enhanced Team Management System provides a robust foundation for team organization within Agentopia, enabling users to effectively manage agent teams with a modern, intuitive interface that maintains consistency with the overall platform design.

## Task Scheduling System

Agentopia implements a comprehensive automated task scheduling system that allows users to create one-time and recurring tasks for their agents. The system supports complex scheduling patterns, timezone management, and automated execution through PostgreSQL's `pg_cron` extension.

### 🕒 **System Overview**

The Task Scheduling System enables users to:
- **Schedule One-Time Tasks**: Execute specific instructions at a designated date and time
- **Create Recurring Tasks**: Set up repeating tasks with flexible intervals (minutes, hours, days, weeks, months, years)
- **Timezone Support**: Full timezone awareness with automatic UTC conversion and local time display
- **Automated Execution**: Tasks run automatically via PostgreSQL `pg_cron` triggering Edge Functions
- **Conversation Integration**: Task results can be sent to existing conversations or create new ones

### 🏗️ **Architecture Components**

#### **Database Schema**
```sql
-- Core task storage
agent_tasks: {
  id: uuid,
  user_id: uuid,
  agent_id: uuid,
  name: text,                    -- Task title
  description: text,             -- Task instructions
  task_type: 'scheduled',        -- Currently supports scheduled tasks
  status: 'active' | 'paused' | 'completed' | 'failed' | 'cancelled',
  instructions: text,            -- Detailed task instructions for agent
  cron_expression: text,         -- Cron pattern for scheduling
  timezone: text,                -- IANA timezone identifier
  next_run_at: timestamptz,      -- UTC timestamp for next execution
  start_date: date,              -- Task start date
  end_date: date,                -- Optional task end date
  max_executions: integer,       -- Limit for task runs (1 for one-time)
  total_executions: integer,     -- Current execution count
  target_conversation_id: uuid   -- Where to send results
}
```

#### **Edge Functions**
1. **`agent-tasks`** (`supabase/functions/agent-tasks/index.ts`):
   - **CRUD Operations**: Create, read, update, delete tasks
   - **Cron Calculation**: Uses Croner library for timezone-aware cron parsing
   - **Next Run Computation**: Calculates `next_run_at` in UTC for scheduling
   - **Validation**: Ensures required fields and proper task structure

2. **`task-executor`** (`supabase/functions/task-executor/index.ts`):
   - **Automated Execution**: Triggered by `pg_cron` every 5 minutes
   - **Task Processing**: Finds and executes due tasks
   - **Agent Communication**: Sends task instructions to agents via chat system
   - **Status Updates**: Tracks execution results and updates task status

#### **Frontend Components (Refactored Architecture)**
The task system follows a modular component architecture with strict file size limits:

1. **`TaskManagerModal.tsx`** (61 lines) - Main orchestrator component
2. **`TaskListModal.tsx`** (240 lines) - Displays existing tasks with modern UI
3. **`TaskWizardModal.tsx`** (534 lines) - Step-by-step task creation wizard
4. **`src/types/tasks.ts`** - Shared TypeScript interfaces
5. **`src/lib/utils/taskUtils.ts`** - Timezone and cron utility functions

### 🎯 **User Experience Flow**

#### **Task Creation Wizard**
The task creation process uses a modern, step-by-step wizard with colorful UI:

1. **Step 1 - Type Selection**: Choose between one-time or recurring task
2. **Step 2 - Schedule**: Set date, time, and timezone with visual date/time pickers
3. **Step 3 - Recurrence** (recurring only): Configure interval and frequency
4. **Step 4 - Instructions**: Provide detailed task instructions for the agent
5. **Step 5 - Title**: Give the task a memorable name
6. **Step 6 - Conversation**: Choose where results should be sent

#### **Task Management Interface**
- **Modern Task List**: Color-coded task cards with status indicators
- **Quick Actions**: Edit, Run Now, and Delete buttons for each task
- **Status Visualization**: Icons and colors showing active, paused, completed states
- **Empty State**: Encouraging first-task creation with visual guidance

### ⚙️ **Technical Implementation**

#### **Timezone Handling**
```typescript
// Supported timezones with auto-detection
const timezones = [
  'UTC', 'America/New_York', 'America/Chicago', 
  'America/Denver', 'America/Los_Angeles', 'Europe/London',
  'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'
  // + user's detected timezone if different
];

// UTC conversion for storage
const utcTime = toUtcIsoForTimezone(dateStr, timeStr, timezone);
```

#### **Cron Expression Generation**
```typescript
// Dynamic cron generation based on user input
function generateCronExpression(unit: string, interval: number, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  
  switch (unit) {
    case 'day': return `${minutes} ${hours} */${interval} * *`;
    case 'week': return `${minutes} ${hours} * * 0`;
    case 'month': return `${minutes} ${hours} 1 * *`;
    // ... additional patterns
  }
}
```

#### **Automated Execution**
```sql
-- PostgreSQL cron job (runs every 5 minutes)
SELECT cron.schedule(
  'execute-agent-tasks',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/task-executor',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );$$
);
```

### 🔧 **API Integration**

#### **Task Creation**
```typescript
// Using supabase.functions.invoke for proper authentication
const { data, error } = await supabase.functions.invoke('agent-tasks', {
  body: {
    agent_id: agentId,
    name: taskTitle,
    instructions: taskDescription,
    task_type: 'scheduled',
    cron_expression: cronPattern,
    timezone: selectedTimezone,
    start_date: startDate,
    max_executions: isOneTime ? 1 : null
  }
});
```

#### **Task Execution**
```typescript
// Manual task execution via task-executor
const { data, error } = await supabase.functions.invoke('task-executor', {
  body: {
    action: 'execute_task',
    task_id: taskId,
    trigger_type: 'manual'
  }
});
```

### 🎨 **Modern UI Features**

#### **Visual Design**
- **Gradient Backgrounds**: Blue-to-purple gradients for headers and buttons
- **Step Indicators**: Colorful circular progress indicators with emojis
- **Color-Coded Steps**: Each wizard step has its own color theme
- **Professional Cards**: Task cards with gradients, shadows, and hover effects
- **Accessibility**: Screen reader support with proper ARIA labels

#### **User Experience**
- **Smart Navigation**: Skip irrelevant steps (recurrence for one-time tasks)
- **Form Validation**: Real-time validation with helpful error messages
- **Empty States**: Encouraging first-task creation with visual guidance
- **Responsive Design**: Works seamlessly across desktop and mobile devices

### 🔄 **Task Lifecycle**

#### **Creation Process**
1. User opens task wizard from agent chat page
2. Wizard guides through 5-6 steps with validation
3. Task data sent to `agent-tasks` Edge Function
4. Function validates data and calculates next run time
5. Task stored in database with computed schedule

#### **Execution Process**
1. `pg_cron` triggers `task-executor` every 5 minutes
2. Function queries for tasks where `next_run_at <= NOW()`
3. For each due task, function calls chat system with instructions
4. Agent processes task and generates response
5. Results sent to target conversation or new conversation created
6. Task status and execution count updated

#### **Management Operations**
- **Edit Tasks**: Modify scheduling, instructions, or settings
- **Run Now**: Trigger immediate execution outside schedule
- **Pause/Resume**: Temporarily disable/enable task execution
- **Delete**: Remove tasks with proper cleanup

### 🛠️ **Development Architecture**

#### **Modular Component Design**
Following Philosophy #1 (≤500 lines per file), the task system is architected as:

```
TaskManagerModal (61 lines)
├── TaskListModal (240 lines)     // Task display and management
└── TaskWizardModal (534 lines)   // Step-by-step creation wizard

Supporting Files:
├── types/tasks.ts                // TypeScript interfaces
└── lib/utils/taskUtils.ts        // Timezone and cron utilities
```

#### **Benefits of Refactored Architecture**
- **Separation of Concerns**: Each component has a single responsibility
- **Maintainability**: Easy to debug and modify individual components
- **Reusability**: Components can be used independently
- **Performance**: Smaller bundle sizes and better code splitting
- **Type Safety**: Comprehensive TypeScript interfaces and validation

### 🔍 **Troubleshooting & Diagnostics**

#### **Common Issues**
1. **CORS Errors**: Ensure Edge Functions are properly deployed with correct headers
2. **Timezone Issues**: Verify IANA timezone identifiers are supported
3. **Cron Validation**: Check cron expressions are properly formatted
4. **Authentication**: Ensure proper Bearer token authentication for API calls

#### **Debug Tools**
- **Edge Function Logs**: Monitor execution in Supabase Dashboard
- **Database Queries**: Check task status and execution history
- **Browser Console**: Frontend error logging with detailed context
- **Manual Execution**: Test tasks immediately via "Run Now" functionality

### 📊 **Current Status**

#### **✅ Completed Features**
- Complete task creation wizard with modern UI
- One-time and recurring task support
- Full timezone management with auto-detection
- Automated execution via PostgreSQL cron
- Task management interface (list, edit, delete, run now)
- Edge Function integration with proper authentication
- Modular component architecture following file size guidelines

#### **🔄 Future Enhancements**
- Event-based task triggers (in addition to scheduled)
- Task dependency chains and workflows
- Advanced recurrence patterns (monthly on specific days)
- Task result analytics and reporting
- Bulk task operations and templates

The Task Scheduling System provides a robust foundation for automated agent workflows, enabling users to create sophisticated automation patterns while maintaining a clean, intuitive user experience.

## Multi-Step Task Workflows

Agentopia's task system has been enhanced with **multi-step workflow capabilities**, allowing users to create complex, sequential tasks where each step has its own instructions and can optionally include context from previous steps. This transforms simple scheduled tasks into powerful automation workflows.

### 🔄 **Multi-Step Architecture**

#### **Core Concepts**
- **Sequential Execution**: Steps execute in order, with each step building on previous results
- **Context Passing**: Optionally include output from previous steps as context for subsequent steps
- **Individual Instructions**: Each step has its own specific agent instructions
- **Flexible Workflow**: Mix single-step and multi-step tasks based on complexity needs

#### **Database Schema Enhancement**
```sql
-- Enhanced agent_tasks table
agent_tasks: {
  id: uuid,
  user_id: uuid,
  agent_id: uuid,
  name: text,
  instructions: text,              -- Legacy single-step instructions (still supported)
  is_multi_step: boolean,          -- NEW: Indicates multi-step task
  step_count: integer,             -- NEW: Number of steps in workflow
  -- ... existing scheduling fields
}

-- NEW: Individual task steps
task_steps: {
  id: uuid,
  task_id: uuid,                   -- Reference to parent task
  step_order: integer,             -- Sequential order (1, 2, 3...)
  step_name: text,                 -- Step title/description
  instructions: text,              -- Step-specific agent instructions
  include_previous_context: boolean, -- Whether to include previous step output
  status: task_step_status,        -- 'pending', 'running', 'completed', 'failed', 'skipped'
  execution_result: jsonb,         -- Step execution output
  execution_started_at: timestamptz,
  execution_completed_at: timestamptz,
  execution_duration_ms: integer,
  error_message: text,
  retry_count: integer
}
```

### 🎯 **User Experience**

#### **Task Creation Workflow**
The multi-step functionality integrates seamlessly into the existing task wizard:

1. **Step 1-3**: Standard task setup (type, schedule, recurrence)
2. **Step 4**: **Enhanced Instructions Step**
   - **Option A**: Single instruction (legacy mode) - enter one set of instructions
   - **Option B**: Multi-step workflow - use the Step Manager interface

#### **Step Manager Interface**
When users choose multi-step mode, they access a sophisticated step management interface:

- **📋 Step List**: Visual list of all steps with drag-and-drop reordering
- **➕ Add Step**: Create new steps with the Step Editor modal
- **✏️ Edit Steps**: Inline editing or full modal editing for complex steps
- **🔗 Context Toggle**: Easy enable/disable of context passing per step
- **🗑️ Delete Steps**: Remove steps with automatic reordering

#### **Step Editor Modal**
Each step is configured through a comprehensive editor:
- **Step Name**: Short, descriptive title for the step
- **Instructions**: Detailed agent instructions specific to this step
- **Context Toggle**: Include output from previous step as additional context
- **Preview Mode**: See how the step will appear to the agent
- **Validation**: Real-time validation ensuring all required fields are complete

### ⚙️ **Technical Implementation**

#### **Frontend Components**
Following Philosophy #1 (≤500 lines per file), the multi-step system uses modular components:

```
src/components/modals/task-steps/
├── StepManager.tsx        # Main orchestrator (~280 lines)
├── StepList.tsx          # Step display with drag-and-drop (~220 lines)  
├── StepCard.tsx          # Individual step cards (~180 lines)
├── StepEditor.tsx        # Step creation/editing modal (~350 lines)
└── useTaskSteps.ts       # State management hook (~300 lines)
```

#### **Database Functions**
Three PostgreSQL functions handle step CRUD operations with validation:

- **`create_task_step()`**: Creates new steps with automatic ordering
- **`update_task_step()`**: Updates steps with reordering support
- **`delete_task_step()`**: Removes steps with cleanup and reordering

#### **Edge Function Integration**
The existing `agent-tasks` Edge Function has been enhanced to support multi-step tasks:
- **Task Creation**: Handles both single-step and multi-step task creation
- **Step Storage**: After creating the main task, individual steps are saved
- **Backward Compatibility**: Existing single-step tasks continue to work unchanged

### 🔄 **Execution Flow**

#### **Multi-Step Task Execution**
When a multi-step task is triggered:

1. **Task Initiation**: `task-executor` identifies the task as multi-step
2. **Step-by-Step Processing**: Each step executes in sequence:
   - Load step instructions and configuration
   - Optionally include context from previous step
   - Send instructions to agent via chat system
   - Capture and store step execution results
   - Update step status and timing metrics
3. **Context Passing**: If enabled, previous step output is included in next step's context
4. **Completion Tracking**: Task marked complete only when all steps finish successfully

#### **Error Handling & Recovery**
- **Step-Level Failures**: Individual steps can fail without stopping the entire workflow
- **Retry Logic**: Failed steps can be retried with exponential backoff
- **Skip Options**: Steps can be marked as "skipped" to continue workflow
- **Rollback Capability**: Failed workflows can be restarted from any step

### 🎨 **User Interface Features**

#### **Visual Step Management**
- **Drag-and-Drop Reordering**: Intuitive step sequencing with React DnD
- **Color-Coded Status**: Visual indicators for step status (pending, running, completed, failed)
- **Inline Editing**: Quick edits without opening full modal
- **Context Flow Visualization**: Clear indicators showing which steps pass context

#### **Step Validation**
- **Real-Time Validation**: Immediate feedback on step configuration
- **Required Field Checking**: Ensure all steps have necessary information
- **Dependency Validation**: Verify context passing makes logical sense
- **Workflow Completeness**: Confirm entire workflow is properly configured

### 📊 **Migration & Compatibility**

#### **Backward Compatibility**
- **Existing Tasks**: All existing single-step tasks continue to work unchanged
- **Automatic Migration**: Legacy tasks can be converted to multi-step format
- **UI Flexibility**: Task wizard adapts to both single-step and multi-step modes
- **API Compatibility**: All existing API endpoints remain functional

#### **Migration Process**
A database migration automatically converts existing tasks:
```sql
-- Existing tasks get converted to multi-step format with a single step
INSERT INTO task_steps (task_id, step_order, step_name, instructions)
SELECT id, 1, name || ' - Step 1', instructions 
FROM agent_tasks 
WHERE NOT EXISTS (SELECT 1 FROM task_steps WHERE task_id = agent_tasks.id);
```

### 🔧 **Development Benefits**

#### **Modular Architecture**
- **Separation of Concerns**: Each component handles a specific aspect of step management
- **Type Safety**: Comprehensive TypeScript interfaces for all step-related data
- **Reusable Components**: Step management components can be used in other contexts
- **Testing**: Each component can be tested independently

#### **Performance Optimization**
- **Lazy Loading**: Step management components load only when needed
- **Efficient Rendering**: Virtual scrolling for large step lists
- **Optimistic Updates**: Immediate UI feedback with server synchronization
- **Caching**: Step data cached to minimize database queries

### 🚀 **Use Cases**

#### **Content Creation Workflow**
```
Step 1: Research topic and gather information
Step 2: Create outline based on research (include previous context)
Step 3: Write first draft using outline (include previous context)  
Step 4: Review and edit content (include previous context)
Step 5: Format and publish final version
```

#### **Data Processing Pipeline**
```
Step 1: Extract data from source system
Step 2: Clean and validate data (include previous context)
Step 3: Transform data format (include previous context)
Step 4: Load into target system
Step 5: Send completion notification with summary
```

#### **Customer Onboarding Sequence**
```
Step 1: Send welcome email with getting started guide
Step 2: Schedule follow-up call (1 day later)
Step 3: Send tutorial resources (3 days later)
Step 4: Request feedback survey (1 week later)
Step 5: Assign to customer success manager
```

### 🔍 **Monitoring & Analytics**

#### **Step-Level Metrics**
- **Execution Times**: Track how long each step takes to complete
- **Success Rates**: Monitor which steps fail most frequently
- **Context Usage**: Analyze how often context passing is used effectively
- **Workflow Patterns**: Identify common multi-step workflow patterns

#### **Performance Insights**
- **Bottleneck Detection**: Identify steps that consistently take longest
- **Error Analysis**: Track common failure points and error messages
- **Usage Analytics**: Understand how users create and structure workflows
- **Optimization Opportunities**: Data-driven improvements to workflow efficiency

The Multi-Step Task Workflow system transforms Agentopia from a simple task scheduler into a powerful workflow automation platform, enabling users to create sophisticated, sequential processes that leverage the full capabilities of their AI agents.

## Zapier MCP Integration

Agentopia implements a cutting-edge integration with Zapier's Model Context Protocol (MCP) servers, enabling agents to access and utilize tools from over 8,000+ applications through a universal protocol. This integration transforms agents from isolated AI assistants into powerful automation engines that can interact with virtually any business application.

### 🚀 **System Overview**

The Zapier MCP Integration allows:
- **Universal Tool Access**: Connect agents to any Zapier-supported application (Google Docs, Sheets, Slack, HubSpot, etc.)
- **Per-Agent Configuration**: Each agent can have its own unique Zapier MCP server connection
- **Dynamic Tool Discovery**: Automatically discover and make available all tools from connected MCP servers
- **Seamless Function Calling**: MCP tools integrate transparently with OpenAI's function calling system
- **Real-Time Tool Management**: Add, refresh, or remove tool connections without code changes

### 🏗️ **Architecture Components**

#### **Database Schema**
```sql
-- MCP server connections per agent
agent_mcp_connections: {
  id: uuid,
  agent_id: uuid,                  -- Reference to agents table
  connection_name: text,            -- User-friendly connection name
  server_url: text,                 -- Zapier MCP server URL
  is_active: boolean,               -- Connection status
  created_at: timestamptz,
  updated_at: timestamptz
}

-- Cached MCP tools for performance
mcp_tools_cache: {
  id: uuid,
  connection_id: uuid,              -- Reference to agent_mcp_connections
  tool_name: text,                  -- MCP tool identifier
  tool_schema: jsonb,               -- Original MCP tool schema
  openai_schema: jsonb,             -- Converted OpenAI function schema
  last_updated: timestamptz,
  created_at: timestamptz
}
```

#### **Core Components**

1. **`MCPClient`** (`src/lib/mcp/mcp-client.ts`):
   - Implements JSON-RPC 2.0 protocol over Streamable HTTP
   - Handles MCP server initialization and session management
   - Manages tool discovery and execution requests
   - Supports MCP protocol version negotiation

2. **`ZapierMCPManager`** (`src/lib/mcp/zapier-mcp-manager.ts`):
   - CRUD operations for MCP connections
   - Tool discovery and caching
   - Connection testing and validation
   - Automatic schema conversion (MCP → OpenAI)

3. **`FunctionCallingManager`** (`supabase/functions/chat/function_calling.ts`):
   - Enhanced to discover MCP tools alongside native tools
   - Routes MCP tool calls to appropriate servers
   - Maintains metadata mapping for tool execution
   - Integrates MCP tools with OpenAI function calling

4. **`MCPToolProvider`** (`supabase/functions/chat/providers/mcp-provider.ts`):
   - Executes MCP tools through the MCP client
   - Validates agent permissions and connection status
   - Handles tool result formatting and error handling
   - Logs tool executions for audit trails

### 🎯 **User Experience**

#### **Connection Flow**
1. User navigates to agent's Tools interface
2. Clicks on "Zapier MCP" tab
3. Enters their unique Zapier MCP server URL
4. Tests connection to verify server availability
5. System discovers and caches available tools
6. Tools immediately available to agent in conversations

#### **Tool Discovery**
When connected, the system automatically discovers tools like:
- `google_docs_create_document_from_text` - Create Google Documents
- `google_docs_append_text_to_document` - Add content to documents
- `google_docs_find_a_document` - Search for documents
- `gmail_send_email` - Send emails via Gmail
- `slack_send_message` - Post to Slack channels
- And thousands more depending on Zapier configuration

### ⚙️ **Technical Implementation**

#### **MCP Protocol Implementation**
```typescript
// MCP JSON-RPC 2.0 message format
interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

// Streamable HTTP transport
const response = await fetch(serverUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'MCP-Protocol-Version': '2024-11-05',
    'Mcp-Session-Id': sessionId
  },
  body: JSON.stringify(request)
});
```

#### **Tool Schema Conversion**
```typescript
// MCP tool schema → OpenAI function schema
function convertToOpenAISchema(mcpTool: MCPTool): OpenAIFunction {
  return {
    name: mcpTool.name,
    description: mcpTool.description,
    parameters: {
      type: 'object',
      properties: mcpTool.inputSchema.properties,
      required: mcpTool.inputSchema.required || []
    }
  };
}
```

#### **Tool Execution Routing**
```typescript
// Enhanced FunctionCallingManager with MCP support
class FunctionCallingManager {
  private mcpToolMetadata = new Map<string, {
    connectionId: string;
    toolName: string;
  }>();

  async executeFunction(functionName: string, parameters: any) {
    // Check if this is an MCP tool
    const mcpMetadata = this.mcpToolMetadata.get(functionName);
    if (mcpMetadata) {
      return await this.executeMCPTool(
        mcpMetadata.connectionId,
        mcpMetadata.toolName,
        parameters
      );
    }
    // ... handle other tool types
  }
}
```

### 🔧 **Integration Features**

#### **Dynamic Tool Loading**
- Tools are discovered in real-time from MCP servers
- No hardcoded tool definitions required
- Automatic schema validation and conversion
- Tool capabilities update as Zapier adds new integrations

#### **Intelligent Tool Routing**
- Clean separation between MCP and native tools
- Metadata-based routing without polluting function schemas
- Transparent integration with existing function calling
- Performance optimization through tool caching

#### **Security & Permissions**
- Per-agent connection isolation
- Row-level security on connection data
- Secure server URL storage
- Connection validation before tool execution

### 📊 **Current Implementation Status**

#### **✅ Completed Components**
- Database schema with RLS policies
- MCP client with JSON-RPC 2.0 support
- Zapier MCP manager for connection CRUD
- Function calling integration
- MCP tool provider for execution
- UI components for connection management
- Tool discovery and caching system

#### **🔧 Technical Achievements**
- **Protocol Compliance**: Full MCP 2024-11-05 specification support
- **Schema Conversion**: Automatic MCP → OpenAI schema transformation
- **Performance**: Tool caching reduces discovery overhead
- **Reliability**: Robust error handling and connection validation
- **User Experience**: Intuitive connection management interface

### 🚦 **How It Works**

#### **From User Question to Tool Execution**
1. **User asks**: "Create a Google Document about our meeting notes"
2. **Agent receives**: Message processed by chat function
3. **Tools discovered**: FunctionCallingManager retrieves MCP tools from cache
4. **LLM decides**: OpenAI selects `google_docs_create_document_from_text`
5. **Execution routed**: Function name mapped to MCP connection via metadata
6. **MCP call made**: MCPToolProvider sends JSON-RPC request to Zapier
7. **Result returned**: Document created, URL returned to user

#### **Connection Management UI**
The Zapier MCP integration is accessible through:
1. Agent Chat Page → Tools Menu → Zapier MCP Tab
2. Shows connection status with visual indicators
3. Lists all discovered tools with descriptions
4. Provides refresh and disconnect controls
5. Real-time tool count and last updated information

### 🔍 **Troubleshooting**

#### **Common Issues**
1. **Tools not appearing in chat**: Deploy the updated chat function with MCP support
2. **Connection test fails**: Verify MCP server URL is correct and accessible
3. **Tools not discovered**: Check if Zapier MCP server has tools configured
4. **Execution errors**: Ensure agent has necessary permissions and connection is active

#### **Debug Information**
- Function calling logs show MCP tool discovery count
- Connection test provides detailed error messages
- Tool cache table shows discovered tools and schemas
- Execution logs track all MCP tool calls

### 🚀 **Benefits**

#### **For Users**
- **Universal Connectivity**: Access to 8,000+ applications
- **No Code Required**: Connect tools through simple URL configuration
- **Immediate Availability**: Tools work instantly after connection
- **Flexible Automation**: Create complex workflows across multiple apps

#### **For Developers**
- **Protocol-Based**: Standard MCP implementation works with any MCP server
- **Extensible**: Easy to add support for other MCP providers
- **Type-Safe**: Full TypeScript support with proper interfaces
- **Well-Documented**: Comprehensive logging and error messages

The Zapier MCP Integration represents a paradigm shift in agent capabilities, transforming Agentopia agents from isolated AI assistants into universal automation engines that can interact with virtually any business application through a single, standardized protocol.

### 🔄 **Intelligent Retry System**

Agentopia implements an advanced three-attempt retry mechanism for MCP tool execution to handle interactive tool calls and recoverable errors:

#### **Automatic Retry Logic**
- **Up to 3 attempts** for tools that return clarifying questions or missing parameter errors
- **Smart error detection** identifies interactive prompts (e.g., "Question: What content would you like in the body of the document?")
- **Context-aware retries** with system guidance to help the LLM provide missing parameters
- **Progressive temperature increase** (0.7 vs 0.5) for retry attempts to encourage more creative parameter generation

#### **Retry Trigger Conditions**
The system automatically retries when tool responses contain:
- `"question:"` - Interactive prompts from MCP servers
- `"what"` - Questions about missing information  
- `"please provide"` - Requests for additional parameters
- `"missing"` - Indications of missing required data

#### **Technical Implementation**
```typescript
// Enhanced retry logic in TextMessageHandler
while (toolsNeedingRetry.length > 0 && retryAttempts < MAX_RETRY_ATTEMPTS) {
  retryAttempts++;
  
  // Add system guidance for retry
  msgs.push({
    role: 'system',
    content: `The previous tool call(s) need additional information. Please retry with the missing parameters based on the error messages. For document creation, include a 'text' or 'content' parameter with the document body.`
  });
  
  // Retry with higher temperature for creativity
  const retryCompletion = await router.chat(agentId, msgs, { 
    tools: availableTools,
    temperature: 0.7,  // Higher than normal 0.5
    maxTokens: 1200 
  });
}
```

#### **Benefits**
- **Improved Success Rate**: Tools that initially fail due to missing parameters often succeed on retry
- **Better User Experience**: Reduces need for manual intervention when tools need clarification
- **Intelligent Parameter Discovery**: LLM learns from error messages to provide correct parameters
- **Graceful Degradation**: System continues to function even when some tools require multiple attempts

    *   Executed comprehensive knowledge transfer protocol following premium standards
    *   Created complete handoff documentation suite in `docs/handoff/20250729_161128_*`
    *   Synchronized project documentation, database schema, and policies
    *   Performed codebase structure assessment and conversation history analysis
    *   Established clear continuation requirements and immediate priorities for next development session
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
*   **🆕 Enhanced Chat Experience & AI Transparency (January 2025):**
    *   **Revolutionary AI Process Visibility:** Complete transparency into agent thinking with step-by-step process indicators
    *   **Expandable "Thoughts" System:** Click on any agent response to see actual AI reasoning, tool calls, and results
    *   **Professional Chat Interface:** Claude-style design with seamless message bubbles, gradient effects, and proper alignment
    *   **Developer Debug Features:** Full prompt verification, tool execution validation, and performance monitoring capabilities
    *   **Persistent State Management:** Smart message merging preserves AI process details across page reloads and history loads
    *   **Real-Time Processing:** Live status updates with agent avatars and discreet header indicators
    *   **Technical Implementation:** TypeScript interfaces for type-safe AI tracking, CSS variable theming, robust error handling
    *   **Debugging Revolution:** Transform black-box agent operations into fully observable, debuggable processes

## Current Status & Next Steps

*   **✅ Light Mode Theme System:** **COMPLETE & PRODUCTION-READY** - Comprehensive light mode implementation with professional UI transformation, WCAG AA accessibility compliance, advanced CSS variable architecture, and vibrant 11-color icon system. Complete component updates across 100+ UI elements with automated backup system and developer documentation.
*   **✅ Enhanced Chat Experience & AI Transparency:** **COMPLETE & PRODUCTION-READY** - Revolutionary AI process visibility system with expandable "Thoughts" sections, real-time thinking indicators, complete tool call/response visibility, professional Claude-style UI, and persistent state management. Transforms agent interactions from black-box operations into fully observable, debuggable processes.
*   **Workspace Refactor:** Largely complete, including DB schema, backend hooks, core UI, chat functionality, context window settings, and member management.
*   **UI Improvements:** Completed significant improvements to the AgentEditPage, focusing on layout, organization, and better component usage.
*   **✅ Web Search Integration:** **COMPLETE** - Full web research capabilities deployed with multi-provider support, secure API key management, and AI-powered content summarization.
*   **✅ Secure Secret Management:** **COMPLETE & PRODUCTION-READY** - Comprehensive VaultService system deployed with encrypted storage, server-side operations, CORS resolution, and reusable architecture for all future integrations. All Edge Functions operational across development and production environments.
*   **✅ Gmail Integration:** **ENHANCED** - Existing Gmail OAuth integration updated with improved security and VaultService integration.
*   **✅ Light Mode Implementation:** **COMPLETE & PRODUCTION-READY** - Comprehensive dual-theme system implemented with light mode as default. Professional CSS variable architecture with 40+ semantic colors, WCAG AA accessibility compliance, and vibrant icon system. All major components updated with proper borders for enhanced visibility and separation.
*   **✅ AgentEditPage Enhancement:** **COMPLETE** - Critical UX improvement resolving card visibility issues in light mode. Added professional borders, shadows, and complete theming to all agent management interfaces including datastore connections and web search permissions.
*   **✅ Chat Handoff Protocol:** **COMPLETE** - Comprehensive knowledge transfer documentation created following premium protocol standards. All project documentation synchronized, database schema/policies archived, and continuation requirements documented in `docs/handoff/20250801_040010_*` files.
*   **✅ Multi-Step Task Workflow System:** **COMPLETE & PRODUCTION-READY** - Revolutionary workflow automation platform with sequential task execution, context passing between steps, and sophisticated step management interface. Complete database schema with `task_steps` table, modular React components (StepManager, StepList, StepCard, StepEditor), PostgreSQL functions for CRUD operations, and seamless backward compatibility. Transforms simple scheduled tasks into powerful automation workflows.
*   **✅ Enhanced Team Management System:** **COMPLETE & PRODUCTION-READY** - Modern team management workflow with modal-based creation, comprehensive team details with descriptions and member management, fixed edit functionality, and complete theme consistency. Includes proper TypeScript integration and modular component architecture.
*   **✅ Zapier MCP Integration:** **COMPLETE & DEPLOYED** - Universal tool connectivity through Model Context Protocol allowing agents to access 8,000+ applications. Full implementation with dynamic tool discovery, seamless function calling integration, and comprehensive UI management. Metadata-based routing issue resolved for proper tool execution.
*   **MCP Management Interface (Phase 2.3.1):** **40% Complete** - Major progress on Multi-MCP Management Components:
    *   ✅ **Foundation Complete:** TypeScript interfaces, component architecture, DTMA API integration
    *   ✅ **MCPServerList Component:** Full server listing with search, filtering, status management (432 lines)
    *   ✅ **MCPMarketplace Component:** Marketplace browsing with deployment integration (369 lines)
    *   ✅ **MCPServerDeployment Component:** Deployment configuration with resource allocation (453 lines)
    *   🔄 **In Progress:** MCPServerConfig component, health monitoring hooks, admin interface completion
*   **🚨 CRITICAL - Ready for Deployment:** [Droplet Name Synchronization Bug Fix](docs/bugs/droplet_name_synchronization_fix.md) - Complete solution prepared and tested for critical UX issue
*   **⚡ IMMEDIATE PRIORITIES (Next Session):** 
    1. **Complete remaining component theming** (TeamsPage.tsx + additional high-impact components - 90% complete, established patterns ready)
    2. **Deploy droplet name synchronization fix** (highest impact - all components ready, critical UX improvement)
    3. **Implement comprehensive logging system** (Rule #2 compliance - critical for operations, directory structure exists)
    4. **Complete remaining MCP management components** (MCPServerConfig, health monitoring - strong foundation established)
*   **📋 Project Management:** Multiple active WBS checklists in progress (Discord removal, Advanced reasoning, Agent integrations) - status updates recommended based on recent infrastructure improvements
*   **🔧 Technical Debt Focus:** File refactoring initiative needed (Philosophy #1: ≤500 lines per file), tokenizer enhancement (replace character count with `tiktoken`), enhanced team-based workspace access control
*   **🔮 Future Expansion:** Extend VaultService pattern for additional OAuth providers (Slack, GitHub, etc.), enterprise security compliance preparation, UI/UX enhancements, performance optimization initiatives

## Knowledge Transfer & Handoff Documentation

Agentopia follows a comprehensive **Chat Handoff Protocol** to ensure seamless knowledge transfer between development sessions and agents. This premium protocol guarantees zero information loss and immediate productive continuation.

### 📄 **Latest Handoff Documentation**
- **Location**: `docs/handoff/20250801_040010_*`
- **Status**: Complete and current - Light Mode Implementation & AgentEditPage Enhancement handoff

### 📋 **Handoff Components**
1. **`handoff_brief.md`** - Complete project understanding, current state assessment, technical context, and continuation requirements
2. **`progress_summary.md`** - Detailed accomplishments, completed tasks, and technical metrics from the session
3. **`next_steps.md`** - Immediate priorities, recommended focus areas, and getting started guide for next development session

### 🗄️ **Synchronized Resources**
- **Database Schema**: Current schema and policies archived in `database/schema/` and `database/policies/`
- **Project Documentation**: Comprehensive documentation library maintained in `docs/` with implementation guides, WBS checklists, and technical specifications
- **Codebase Structure**: Complete directory mapping and component analysis documented
- **Decision Context**: All architectural decisions, technical choices, and implementation rationales preserved

### 🎯 **Handoff Quality Standards**
- ✅ **Information Completeness**: 100% of session activities documented
- ✅ **Clarity Score**: All technical decisions clearly explained with context
- ✅ **Continuation Speed**: New agents can begin immediately with established patterns
- ✅ **Context Preservation**: Complete decision rationale and background captured

For incoming developers or agents, start with the latest handoff documentation to understand the current project state, recent accomplishments, and immediate priorities.

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

## August 2025 New Chat Protocol Analysis

**Date:** August 26, 2025  
**Analysis Type:** Comprehensive New Chat Protocol Execution  
**System Status:** Production-Ready with Critical Fix Pending

### Key Findings:
- **40+ Supabase Edge Functions** providing comprehensive API coverage
- **Advanced Container Orchestration** via DTMA with multi-MCP server support
- **Enterprise-Grade Security** with Supabase Vault and zero plain-text storage
- **Comprehensive Integration Ecosystem** including email, web research, task automation
- **Critical Deployment Ready:** Droplet name synchronization bug fix prepared

### Architecture Highlights:
- React 18/TypeScript frontend with WCAG AA compliant theming
- Sophisticated PostgreSQL schema with advanced enum systems
- Revolutionary containerized tool deployment system
- Multi-provider OAuth integration across Gmail, SendGrid, Mailgun, SMTP
- Advanced reasoning capability development (15-20% complete)

### Immediate Action Required:
🚨 **Deploy droplet name synchronization fix** - Complete solution ready for `supabase db push`

### Active Development:
- Advanced Reasoning Capability (MCP server framework)
- Account-Wide Knowledge Graph (design phase complete) 
- Agent Integrations Credentials System (planning phase)

*Full analysis available in `docs/context/ai_context_08262025_081209.md`*

---

## August 2025 Stabilization Notes

- **Chat stability**: `supabase/functions/chat/processor/handlers.ts` now guards against missing `shared/llm/router.ts` and null `resolveAgent`, falling back to OpenAI with tools.
- **Mailgun parity**: Validate end-to-end flows to mirror SendGrid (UI visibility, tools, logs).
- **Capability badges**: Driven by `integration_capabilities`; ensure seeds match visible integrations.
- **Conversations**: Multi-conversation support present; scheduled tasks should target or create `conversation_sessions`.
- **Metrics**: Intermittent “Supabase export failed” logs are non-blocking; review exporter config when convenient.
- **Memory**: Pinecone keys currently invalid; vector search falls back gracefully. Configure valid keys or disable episodic search.

---

## 🎨 Visual Team Canvas - August 2025

**Date:** August 28, 2025  
**Status:** Production Ready  
**Feature Type:** Advanced Team Organization & Visualization

### 🎯 Overview

The **Visual Team Canvas** transforms team management from simple lists into an interactive, drag-and-drop organizational chart interface. Teams can now be visualized as connected nodes showing reporting structures, collaboration patterns, and support relationships - just like Lucidchart or organizational diagram tools.

### ✨ Key Features

#### **🖱️ Interactive Canvas Interface**
- **Drag & Drop Team Positioning**: Move teams around a 2D canvas with real-time position saving
- **Zoom & Pan Controls**: Navigate large organizational structures with smooth zoom and pan
- **Grid & Canvas Views**: Toggle between traditional grid layout and visual canvas mode
- **Minimap Navigation**: Overview panel for quick navigation across large team structures

#### **🔗 Team Relationship Mapping**
- **Visual Connections**: Draw connections between teams to show relationships
- **Connection Types**: 
  - `Reports To` (hierarchical with arrows)
  - `Collaborates With` (peer-to-peer dashed lines) 
  - `Supports` (service dotted lines)
  - `Custom` (user-defined styling)
- **Interactive Editing**: Click connections to edit/delete, hover for context menus

#### **💾 Persistent Layouts**
- **Auto-Save**: Canvas layouts automatically saved every 30 seconds
- **Local & Database Storage**: Hybrid persistence with conflict resolution
- **User-Specific Views**: Each user maintains their own organizational perspective
- **Layout Export**: Export team structures for documentation or sharing

#### **🎛️ Advanced Controls**
- **Connection Mode**: Select connection type, then click teams to connect
- **Toolbar Integration**: Zoom, save, reset, fit-to-view, and settings controls
- **Keyboard Shortcuts**: Power-user navigation and actions
- **Responsive Design**: Full mobile and tablet support with touch interactions

### 🏗️ Technical Architecture

#### **Database Schema**
```sql
-- User-specific canvas layouts with JSONB flexibility
team_canvas_layouts (
  id, user_id, workspace_id,
  positions JSONB,      -- Team positions [{teamId, x, y}]
  connections JSONB,    -- Connections [{fromTeamId, toTeamId, type}] 
  view_settings JSONB   -- {zoom, centerX, centerY}
)

-- Individual team connections with full metadata
team_connections (
  id, from_team_id, to_team_id,
  connection_type ENUM('reports_to', 'collaborates_with', 'supports', 'custom'),
  label, color, style, created_by_user_id
)
```

#### **Component Architecture**
```
src/components/teams/canvas/
├── VisualTeamCanvas.tsx         # Main orchestrator (~280 lines)
├── TeamNode.tsx                 # Custom React Flow node (~150 lines)
├── TeamConnectionEdge.tsx       # Connection visualization (~120 lines)
├── CanvasToolbar.tsx           # Controls & actions (~180 lines)
├── hooks/
│   ├── useCanvasState.ts       # Canvas state management
│   ├── useTeamOperations.ts    # CRUD operations  
│   ├── useConnections.ts       # Connection logic
│   └── useLayoutPersistence.ts # Layout storage
├── types/canvas.ts             # TypeScript definitions
└── utils/canvasUtils.ts        # Conversion utilities
```

#### **Technology Stack**
- **React Flow**: Professional-grade canvas and node editor
- **Supabase Edge Functions**: Backend API with RLS security
- **React Query**: Optimistic updates and data synchronization  
- **Tailwind CSS**: Consistent design system integration
- **TypeScript**: Full type safety across all components

### 🔒 Security & Performance

#### **Row Level Security (RLS)**
- Users can only access their own canvas layouts
- Team connections require ownership of both connected teams
- Service role access for administrative functions
- Comprehensive audit logging for all canvas operations

#### **Performance Optimizations**
- **Virtual Rendering**: Efficient rendering for 100+ team nodes
- **Debounced Updates**: Batched state changes to prevent excessive renders
- **Optimistic Updates**: Immediate UI feedback with rollback on errors
- **Lazy Loading**: Components loaded only when canvas mode is accessed

#### **Validation & Error Handling**
- **Cycle Detection**: Prevents circular reporting structures
- **Connection Limits**: Configurable maximum connections per team
- **Data Validation**: Comprehensive input validation with user-friendly errors
- **Graceful Degradation**: Fallback to grid view if canvas fails

### 🚀 Integration Points

#### **Teams Page Enhancement**
- **View Toggle**: Seamless switch between Grid and Canvas modes
- **Existing Functionality**: Full backward compatibility with current team management
- **Modal Integration**: Canvas opens in full-screen modal with existing UI patterns
- **Team CRUD**: Create, edit, delete teams directly from canvas

#### **Future Workspace Integration**
- **Multi-Workspace Support**: Ready for workspace-based team organization
- **Sharing & Collaboration**: Foundation for team layout sharing
- **Export Capabilities**: SVG/PDF export for documentation and presentations

### 🎯 Usage Examples

#### **Department Organization**
```
Engineering ──reports_to──→ CTO
    ├── Frontend Team
    ├── Backend Team  
    └── DevOps Team ──supports──→ All Teams

Marketing ──collaborates_with──→ Sales
    ├── Content Team
    └── Growth Team
```

#### **Project-Based Structure**
```
Project Alpha ──custom──→ Project Beta
    ├── Development Squad
    ├── Design Squad
    └── QA Squad ──supports──→ All Squads
```

### 📊 Database Functions

#### **Canvas Operations**
- `save_team_canvas_layout()` - Save/update canvas layouts with validation
- `get_team_canvas_layout()` - Retrieve layouts with access control  
- `create_team_connection()` - Create connections with cycle detection
- `delete_team_connection()` - Remove connections with ownership verification

#### **Validation & Security**
- Comprehensive input validation with business rule enforcement
- Automatic cycle detection for hierarchical relationships
- Performance monitoring for slow operations
- Detailed error logging for debugging

### 🎨 UI/UX Design

#### **Visual Design Language**
- **Team Nodes**: Card-based design with gradients and icons
- **Connection Styles**: Distinct visual language for each relationship type
- **Interactive States**: Hover effects, selection indicators, drag feedback
- **Accessibility**: WCAG 2.1 compliant with keyboard navigation and screen readers

#### **User Experience**
- **Onboarding**: Contextual tooltips and guided first-use experience
- **Progressive Disclosure**: Advanced features revealed as users become comfortable
- **Error Prevention**: Clear visual feedback for invalid operations
- **Mobile-First**: Touch-optimized interactions for all device types

### 🔧 Implementation Status

**✅ Completed Features:**
- Complete database schema with migrations applied
- Full React component suite with TypeScript
- Interactive canvas with drag & drop
- Connection creation and management
- Layout persistence and auto-save
- Integration with existing Teams page
- Comprehensive error handling and validation

**🔄 Ready for Enhancement:**
- Team member visualization within nodes
- Advanced auto-layout algorithms
- Real-time collaborative editing
- Template organizational structures
- Analytics and insights dashboard

### 🚀 Getting Started

#### **Access the Canvas**
1. Navigate to the **Teams** page
2. Create at least one team if none exist
3. Click the **Canvas** button in the view toggle
4. Start organizing teams by dragging them around
5. Use connection mode to draw relationships between teams

#### **Best Practices**
- **Start Simple**: Begin with basic positioning before adding connections
- **Use Hierarchy**: Leverage "Reports To" connections for clear organizational structure  
- **Color Coding**: Use custom connection colors to distinguish different relationship types
- **Regular Saves**: While auto-save is active, manually save important layouts
- **Mobile Testing**: Verify touch interactions work well on tablets and phones

*The Visual Team Canvas represents a major evolution in team organization capabilities, providing the visual clarity and interactive control that modern organizations need to manage complex team structures effectively.*