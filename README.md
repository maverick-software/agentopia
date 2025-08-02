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

## Project Overview

*   **Goal:** Provide a platform for creating AI agents that can operate within Discord, collaborate within **Workspaces**, and leverage external tools (MCP) and knowledge (RAG).
*   **Focus:** Web UI for management, Workspace-centric collaboration, optional Discord integration.

## Features

*   User Authentication (Supabase Auth)
*   Agent Creation & Configuration
*   Team Management
*   Datastore Management (Pinecone RAG)
*   Knowledge Graph Integration (GetZep) for advanced memory, contextual understanding, and reasoning.
*   **🆕 Secure Secret Management:** Built-in Supabase Vault integration for secure API key storage and management
*   **🆕 Gmail Integration:** Complete OAuth-based Gmail integration allowing agents to send emails on behalf of users
*   **🆕 Web Research Capabilities:** Integrated web search, page scraping, and content summarization through multiple providers (Serper API, SerpAPI, Brave Search)
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
*   **🆕 `create-secret`**: Securely creates and stores API keys and sensitive data in Supabase Vault with proper CORS handling.
*   **🆕 `web-search-api`**: Handles web search, page scraping, and content summarization for agent research capabilities.
*   **🆕 `gmail-oauth`**: Manages Gmail OAuth authentication flow for email integration.
*   **🆕 `gmail-api`**: Executes Gmail operations like sending emails on behalf of authenticated users.

## Secure Secret Management (Supabase Vault)

Agentopia implements a comprehensive secret management system using Supabase Vault to securely store and manage API keys, OAuth tokens, and other sensitive data. This system ensures that secrets are encrypted at rest and only accessible through secure, server-side operations.

### VaultService Class

The `VaultService` class (`src/services/VaultService.ts`) provides a centralized, reusable interface for all secret management operations:

```typescript
const vaultService = new VaultService(supabaseClient);

// Create a new secret
const secretId = await vaultService.createSecret(
  'api_key_name',
  'secret_value',
  'Description of the secret'
);

// Retrieve a secret
const secretValue = await vaultService.getSecret(secretId);
```

### Database Functions

The system includes secure database functions for secret operations:

*   **`public.create_vault_secret`**: Server-side function for creating encrypted secrets
*   **`public.get_secret`**: Secure retrieval of decrypted secrets from the vault

### Security Features

*   **Encryption at Rest**: All secrets are stored using authenticated encryption
*   **Server-Side Only**: Secrets are never exposed to client-side code
*   **Edge Function Integration**: Uses Supabase Edge Functions for secure secret operations
*   **CORS Protection**: Proper cross-origin request handling for production deployments
*   **Access Control**: Row-level security ensures users can only access their own secrets

### Usage Across Integrations

The VaultService is used throughout the application for:

*   **API Key Storage**: Web search provider API keys (Serper, SerpAPI, Brave Search)
*   **OAuth Token Management**: Gmail and other OAuth integration tokens
*   **Service Credentials**: Database connection strings and service account keys
*   **Custom Integrations**: Extensible for any future API or service integrations

## Web Research Integration

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
*   **`agent_oauth_permissions`**: Agent-specific OAuth scope permissions

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
*   **Large Files:** 
    *   Some frontend page components may exceed recommended size limits and could benefit from refactoring (e.g., `src/pages/agents/[agentId]/edit.tsx`, `src/pages/DatastoresPage.tsx` - line counts need re-verification).
    *   The core `supabase/functions/chat/index.ts` function is ~695 lines and should be reviewed for refactoring.
*   **Suboptimal Tokenizer:** The `ContextBuilder` in `supabase/functions/chat/context_builder.ts` uses a basic character count for token estimation; consider replacing with `tiktoken` for accuracy.
*   **Team Membership Access:** The `fetchWorkspaces` hook doesn't currently grant workspace access based on Team membership; this might need enhancement.
*   **UI Component Completeness:** Ensure all necessary Shadcn UI components are created/installed.

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