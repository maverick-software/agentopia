# WBS Checklist: Agent Tool Infrastructure
**Date Created:** 05/06/2025
**Plan Name:** Agent Tool Infrastructure
**Goal:** To design and implement a system where Agentopia agents can have dedicated DigitalOcean Droplets provisioned to host their specific tools (including MCP Servers and other backend processes), allowing for modular tool management, installation, activation, and secure operation.

## Phase 1: Foundational Design & Provider Setup

### 1.1 Core Architecture & Strategy
- [ ] 1.1.1 Define: Overall architecture for agent-specific tool environments on DigitalOcean.
    - **Note:** Document data flow, Agentopia backend responsibilities, Droplet responsibilities, and user interaction points.
- [ ] 1.1.2 Research & Select: DigitalOcean API interaction library/SDK for Node.js (e.g., `digitalocean-js`, official REST API with `axios`).
- [ ] 1.1.3 Design: Standardized packaging and deployment strategy for "Tools" (e.g., Docker images, setup scripts).
    - **Note:** Consider how different tool types (MCP Servers, backend processes) will be packaged.
- [ ] 1.1.4 Design: Communication protocol between Agentopia backend and Agent Droplets (e.g., secure API on droplets, SSH-based commands, message queue).
- [ ] 1.1.5 Setup: DigitalOcean account access, API token generation, and project setup within DigitalOcean if required. Store API token securely (e.g., Agentopia backend environment variable or Vault).

### 1.2 Database Design (Supabase)
- [ ] 1.2.1 Design: Schema for `agent_droplets` table.
    - **Fields:** `id`, `agent_id` (FK to `agents`), `droplet_id` (DigitalOcean ID), `ip_address`, `status` (e.g., pending, active, error, deleted), `region`, `size`, `created_at`, `updated_at`.
- [ ] 1.2.2 Design: Schema for `agent_droplet_tools` table (tools installed on specific droplets).
    - **Fields:** `id`, `agent_droplet_id` (FK to `agent_droplets`), `tool_catalog_id` (FK to a new `tool_catalog` table, see 1.2.4), `status` (e.g., installing, active, error, pending_config), `version`, `config_details` (JSONB, for tool-specific settings like port, internal paths), `created_at`, `updated_at`.
- [ ] 1.2.3 Design: Secrets management strategy for third-party tool API keys (e.g., OpenAI API key for the Reasoning MCP Server).
    - **Note:** Leverage Supabase Vault. Design how secrets in Vault will be associated with specific `agent_droplet_tools` entries or `agent_droplets`. How does the tool on the droplet securely access its key?
- [ ] 1.2.4 Design: Schema for `tool_catalog` table (available tool types).
    - **Fields:** `id`, `tool_name` (e.g., "Reasoning MCP Server", "Data Analysis Python Backend"), `description`, `version_info` (JSONB, e.g., available versions, default version), `packaging_type` (e.g., "docker_image", "script_url"), `package_identifier` (e.g., Docker image name, script URL), `default_config_template` (JSONB).
- [ ] 1.2.5 Implement: Initial database migrations for the new tables.

### 1.3 Security Design
- [ ] 1.3.1 Design: Secure method for Agentopia backend to authenticate with and command Agent Droplets.
- [ ] 1.3.2 Design: Initial firewall configuration for Agent Droplets (e.g., allow SSH from specific IPs, allow specific tool ports).
- [ ] 1.3.3 Design: Secure retrieval of third-party API keys by tools running on the Droplet.

## Phase 2: Droplet Provisioning & Management Service (Agentopia Backend)

### 2.1 DigitalOcean API Integration
- [ ] 2.1.1 Implement: Service/module in Agentopia backend to wrap DigitalOcean API calls (create, delete, get status of Droplets using chosen SDK/library).
- [ ] 2.1.2 Implement: Error handling and retry logic for DigitalOcean API interactions.

### 2.2 Droplet Lifecycle Management
- [ ] 2.2.1 Implement: Logic to trigger Droplet provisioning when a new "Tool Environment" is requested for an agent.
    - **Note:** This includes selecting Droplet image (e.g., base OS, Docker pre-installed), region, size.
    - **Note:** Update `agent_droplets` table with Droplet details and status.
- [ ] 2.2.2 Implement: Agent Droplet bootstrap/setup script.
    - **Note:** Runs on first boot. Installs common dependencies, security updates, sets up the agent-side listener/service for tool management (from 3.1.2).
- [ ] 2.2.3 Implement: Logic to de-provision Droplets (e.g., when "Tool Environment" is deactivated or agent is deleted).
    - **Note:** Ensure tools are gracefully stopped if possible. Update `agent_droplets` table.
- [ ] 2.2.4 Implement: Periodic status checks for active Agent Droplets from Agentopia backend. Update `agent_droplets.status` if discrepancies found.

## Phase 3: Tool Installation & Activation Framework

### 3.1 Agent Droplet Tool Management Agent
- [ ] 3.1.1 Design: A lightweight agent/service running on each Agent Droplet to manage tools.
    - **Note:** Responsibilities: receive commands from Agentopia backend (install, uninstall, start, stop, configure tool), report tool status.
- [ ] 3.1.2 Implement: The Droplet Tool Management Agent (e.g., a small Node.js/Python script, or integrated into bootstrap).

### 3.2 Tool Lifecycle on Droplet
- [ ] 3.2.1 Implement: Agentopia backend logic to send "install tool X from catalog on Droplet Y" commands to the Droplet Tool Management Agent.
    - **Note:** This involves passing `package_identifier` and any initial `config_details`.
- [ ] 3.2.2 Implement: Droplet Tool Management Agent logic to handle tool installation based on `packaging_type` (e.g., `docker pull && docker run`, download and execute script).
- [ ] 3.2.3 Implement: Mechanism for installed tools (especially MCP servers) on the Droplet to report their operational endpoint(s) and status back to Agentopia (via Droplet Tool Management Agent or directly if designed).
    - **Note:** Agentopia updates `agent_droplet_tools.config_details` (e.g., with port, local IP) and `agent_droplet_tools.status`.
- [ ] 3.2.4 Implement: Agentopia backend logic and Droplet Agent logic for tool uninstallation/removal.
- [ ] 3.2.5 Implement: Agentopia backend logic and Droplet Agent logic for starting/stopping specific tools.

### 3.3 Secrets Injection for Tools
- [ ] 3.3.1 Implement: Secure process for the Droplet Tool Management Agent to fetch necessary API keys/secrets from a secure endpoint on Agentopia backend (which gets them from Supabase Vault) and provide them to the specific tool instance (e.g., as environment variables during Docker run, or in a config file).

**==> Return Point Reminder <==**
**Upon substantial completion of Phase 3 (Tool Installation & Activation Framework), especially items 3.2.3 (Endpoint Discovery) and 3.3.1 (Secrets Injection), the necessary infrastructure components should be in place to proceed with the Agentopia-side integration of specific tools.**
**Return to: `docs/plans/advanced_reasoning_capability/wbs_checklist.md`**
**Resume at: Phase 2.A (Agentopia Client-Side Integration for Reasoning MCP)**
**============================**

## Phase 4: Agentopia UI/UX for Tool Environment & Toolbelt Management

### 4.1 Tool Catalog Display
- [ ] 4.1.1 Backend: API endpoint in Agentopia to list tools from `tool_catalog`.
- [ ] 4.1.2 Frontend: UI page/section to display available tool types from the catalog (name, description).

### 4.2 Agent-Specific Tool Environment Management
- [ ] 4.2.1 Database: Add `tool_environment_active` (boolean, default FALSE) to `agents` table. Create migration.
- [ ] 4.2.2 Backend: RPC/API in Agentopia to toggle `agents.tool_environment_active`.
    - **Note:** Toggling to TRUE initiates Droplet provisioning (Phase 2.2.1). Toggling to FALSE initiates de-provisioning (Phase 2.2.3).
- [ ] 4.2.3 Frontend: UI element (e.g., in Agent settings) to "Enable Tool Environment" for an agent.
    - **Note:** Clearly explain implications (costs, provisioning time).

### 4.3 Agent Toolbelt Management (Interaction with `agent_droplet_tools`)
- [ ] 4.3.1 Backend: API endpoints in Agentopia to:
    - List installed/active tools for an agent's Droplet.
    - Add a tool from catalog to an agent's Droplet (triggers Phase 3.2.1).
    - Remove a tool from an agent's Droplet (triggers Phase 3.2.4).
    - Configure an installed tool (e.g., update specific config, manage associated secrets - triggers Phase 3.3.1 for secrets).
- [ ] 4.3.2 Frontend: "Toolbelt" section in Agent Edit Page to display and manage installed tools.
    - **Note:** Show tool name, status, version. Provide actions: Add, Remove, Configure.
- [ ] 4.3.3 Frontend: UI for adding a tool from catalog to agent's toolbelt.
- [ ] 4.3.4 Frontend: UI for tool-specific configuration (if any) and secrets management (linking to/providing values for keys defined in `tool_catalog.default_config_template` or tool-specific needs).

### 4.4 Tool Capability Reflection in Agent Context
- [ ] 4.4.1 Design: How an "active" tool on an agent's Droplet (e.g., Reasoning MCP Server) makes its capabilities known to the agent's core reasoning/chat processing logic in Agentopia.
    - **Note:** E.g., Agentopia backend queries `agent_droplet_tools` and their configs (like MCP endpoint) to inform its orchestration logic.
- [ ] 4.4.2 Frontend: (If applicable) Display active tools or their capabilities in the agent's "Context" window or a similar informational area.

## Phase 5: Security, Logging, Monitoring & Testing

### 5.1 Security Hardening
- [ ] 5.1.1 Review and implement: All security designs from Phase 1.3.
- [ ] 5.1.2 Conduct: Security review of the entire tool provisioning and management lifecycle.

### 5.2 Logging & Monitoring
- [ ] 5.2.1 Implement: Agentopia backend logging for all Droplet and tool lifecycle events (provisioning, installation, errors).
- [ ] 5.2.2 Implement: Standardized logging format/shipping for tools running on Agent Droplets (if possible, to a central location or made easily accessible).
- [ ] 5.2.3 Setup: Basic monitoring for Agent Droplet health (CPU, memory, disk) and for the Droplet Tool Management Agent.

### 5.3 Testing
- [ ] 5.3.1 Unit Tests: For Agentopia backend services (Droplet provisioning, tool command sending).
- [ ] 5.3.2 Unit Tests: For Droplet Tool Management Agent logic.
- [ ] 5.3.3 Integration Tests:
    - Agentopia backend <-> DigitalOcean API.
    - Agentopia backend <-> Droplet Tool Management Agent.
    - Full tool installation flow for a sample tool (e.g., a simple MCP echo server).
- [ ] 5.3.4 E2E Tests: User enables Tool Environment -> Droplet provisions -> User adds a tool -> Tool becomes active -> User deactivates/removes tool -> Droplet de-provisions.

## Phase 6: Documentation
- [ ] 6.1 Document: Overall architecture of the Agent Tool Infrastructure.
- [ ] 6.2 Document: How to package a new tool for use with this system.
- [ ] 6.3 Document: Admin/DevOps procedures for managing the system (e.g., monitoring, troubleshooting DigitalOcean resources).
- [ ] 6.4 Update: User-facing documentation on how to enable and use tools for their agents.

