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

## Project Structure

*(High-level overview, see inline comments in the structure below for more details)*

```
.
├── .cursor/              # Cursor AI configuration, rules (incl. UI/UX Design.mdc)
├── docs/                 # Project documentation (protocols, context, plans, bugs)
├── logs/                 # Application logs directory (Needs Implementation)
├── public/               # Static assets for Vite frontend
├── services/             # Backend microservices (run on DigitalOcean Droplet)
│   ├── discord-worker/   # Connects specific agent to Discord Gateway
│   └── worker-manager/   # Manages discord-worker instances via PM2 API
├── src/                  # Frontend source code (React/Vite)
│   ├── components/       # Reusable UI components (incl. /ui with Shadcn)
│   ├── contexts/         # React contexts (Auth, DB)
│   ├── hooks/            # Custom React hooks (useWorkspaces, useChatMessages, etc.)
│   ├── lib/              # Library initializations (Supabase client, utils)
│   ├── pages/            # Page components
│   ├── routing/          # Routing configuration (AppRouter, routeConfig)
│   └── types/            # Shared TypeScript type definitions for frontend
├── supabase/             # Supabase specific files
│   ├── functions/        # Supabase Edge Functions (chat, discord handlers, etc.)
│   └── migrations/       # Database migration files
├── .env                  # Frontend/Vite environment variables (see .env.example)
├── .gitignore            # Git ignore rules
├── ecosystem.config.js   # PM2 configuration (for services)
├── index.html            # Main HTML entry point for Vite frontend
├── package.json          # Project dependencies and scripts
├── README.md             # This file
├── tailwind.config.js    # Tailwind CSS configuration
├── vite.config.ts        # Vite build tool configuration
└── ... (tsconfig files, etc.)
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

## Backend Services

Located in `services/`. These are designed for persistent execution on a server (e.g., DigitalOcean Droplet) managed by PM2.

*   `worker-manager`: Listens for requests (e.g., from `manage-discord-worker`) and uses the PM2 API to start/stop `discord-worker` processes for individual agents.
*   `discord-worker`: A Node.js process connecting a specific agent to the Discord Gateway, listening for mentions, calling the `chat` function, and sending responses back to Discord.

## Core Workflows

*   **Workspace Chat:** User sends message -> Frontend calls `chat` function -> Function fetches context (history, members, settings, RAG, MCP) -> Sends context to LLM -> Saves user & agent message -> Returns response to frontend -> Frontend displays message via Realtime subscription.
*   **Discord Agent Activation:** User clicks activate -> Frontend calls `manage-discord-worker` -> Function calls `worker-manager` service -> Manager starts `discord-worker` process via PM2.
*   **Discord Mention:** Discord sends mention event -> `discord-worker` receives event -> Calls `chat` function -> Function generates response -> Worker sends response back to Discord channel.

## Known Issues & Refactoring

*   **Missing Logs:** Critical logging across services and functions needs implementation.
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
*   **Immediate Focus:** 
    *   Continue thorough testing of Workspace features (chat, settings, member management, context limits)
    *   Address any remaining UI glitches or inconsistencies
    *   Complete improvements to the Discord integration workflow
*   **Future:** Implement robust logging, refactor remaining large components, potentially enhance Team-based workspace access logic.

## Deployment

*   **Frontend:** Static deployment (Netlify, Vercel).
*   **Supabase:** Deploy functions and DB migrations via CLI or Git integration.
*   **Backend Services:** Requires Node.js/PM2 environment (e.g., DigitalOcean Droplet). See previous README section for detailed steps on setting up `worker-manager` with PM2.