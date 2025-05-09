# WBS Checklist: Agent Tool Infrastructure
**Date Created:** 05/06/2025
**Plan Name:** Agent Tool Infrastructure
**Goal:** To design and implement a system where Agentopia agents can have dedicated DigitalOcean Droplets provisioned to host their specific tools (including MCP Servers and other backend processes), allowing for modular tool management, installation, activation, and secure operation.

## Phase 1: Foundational Design & Provider Setup

### 1.1 Core Architecture & Strategy
- [x] 1.1.1 Define: Overall architecture for agent-specific tool environments on DigitalOcean.
    - **Note 1.1.1.1 (Architectural Outline):**
        - **Goal:** Create isolated, dynamically provisioned environments on DigitalOcean Droplets for each agent that enables the "Tool Environment" feature.
        - **Components & Responsibilities:**
            - **1. Agentopia Frontend:**
                -   User toggles "Tool Environment" on/off for an agent.
                -   User manages the agent's "Toolbelt" (adding/removing/configuring tools from a catalog).
            - **2. Agentopia Backend:**
                -   Manages core DB tables (`agents`, `tool_catalog`, `agent_droplets`, `agent_droplet_tools`).
                -   Handles frontend requests.
                -   Contains **Provisioning Service:** Communicates with DigitalOcean API (via selected SDK/library) to create/delete Droplets based on `agents.tool_environment_active` status. Updates `agent_droplets` table.
                -   Contains **Tool Management Service:** Communicates with the agent running on the droplet (see below) to install/uninstall/start/stop/configure tools. Updates `agent_droplet_tools`. Manages secure secret fetching (from Vault) and delivery for tools.
                -   Contains **Agent Orchestration Logic:** (e.g., within `chat` service) Checks agent status, discovers active tool endpoints from `agent_droplet_tools`, interacts with tools (e.g., MCP calls) on the specific Droplet.
            - **3. Agent-Specific Droplet (DigitalOcean):**
                -   Standardized base image (e.g., Ubuntu + Docker).
                -   Runs a **Droplet Tool Management Agent** (service/script): Listens for commands from Agentopia Backend Tool Management Service (via secure API/SSH/etc.), executes tool lifecycle actions (docker run/stop, script execution), fetches secrets securely, reports status.
                -   Runs **Tool Instances** (e.g., Reasoning MCP Server in Docker): Configured by the Droplet Tool Management Agent, receives secrets, listens for operational requests (e.g., MCP calls from Agentopia Backend).
            - **4. Tool Catalog (`tool_catalog` table):** Defines available tools, their packaging (Docker image/script), versions, default configs.
        - **Data/Control Flow Summary:**
            -   User Action (UI) -> Agentopia Backend API -> DB Update + Provisioning/Tool Mgmt Service Action.
            -   Agentopia Tool Mgmt Service Command -> Droplet Tool Mgmt Agent.
            -   Droplet Tool Mgmt Agent -> Tool Lifecycle Control (Docker/Script).
            -   Tool Instance Status -> Droplet Tool Mgmt Agent -> Agentopia Backend (DB Update).
            -   Agent Chat -> Agentopia Orchestration -> Discover Tool Endpoint (DB Query) -> Agentopia Backend MCP Call -> Tool Instance on Droplet -> Response -> Agentopia Orchestration -> User.
    - **Note:** Document data flow, Agentopia backend responsibilities, Droplet responsibilities, and user interaction points.
- [x] 1.1.2 Research & Select: DigitalOcean API interaction library/SDK for Node.js (e.g., `digitalocean-js`, official REST API with `axios`).
    - **Note 1.1.2.1 (Selected Library):** Selected `dots-wrapper` (npm package). It is actively maintained (v3.11.16, published 2 months ago as of 05/06/2025), TypeScript-first, and provides comprehensive API coverage.
- [x] 1.1.3 Design: Standardized packaging and deployment strategy for "Tools" (e.g., Docker images, setup scripts).
    - **Note: Consider how different tool types (MCP Servers, backend processes) will be packaged.**
    - **Note 1.1.3.1 (Decision - Docker Recommended):** Docker is the recommended standard for packaging and deploying all tools on Agent Droplets. This ensures consistency, isolation, and leverages a mature ecosystem.
    - **Note 1.1.3.2 (Rationale for Docker):**
        - **Isolation:** Each tool and its dependencies run in a separate container, preventing conflicts.
        - **Consistency:** Docker images ensure tools run the same way across different environments (dev, prod, various droplets).
        - **Portability:** Standardized Docker images are easy to manage and distribute.
        - **Versioning:** Docker image tags allow for clear version management of tools.
        - **Ecosystem:** Leverages Docker Hub or private registries for image storage and distribution. The Droplets will require Docker to be installed as part of their base image/bootstrap process.
    - **Note 1.1.3.3 (Packaging Different Tool Types):**
        - **MCP Servers (Node.js, Python, etc.):** Each server will be containerized. The Dockerfile will define its runtime, dependencies, copy the application code, and expose the necessary network port. Example: `agentopia/reasoning-mcp-server:latest`.
        - **Backend Processes (e.g., Python scripts, compiled binaries):** Also to be containerized. Short-lived tasks can be run via `docker run --rm ...` while long-running services will run continuously. Example: `agentopia/data-analysis-tool:1.2.0`.
        - **Simple Scripts:** While direct execution could be an option, for consistency, even simple utility scripts should be packaged into minimal Docker containers (e.g., using an Alpine Linux base with the script and its interpreter). This standardizes tool management via the Droplet Tool Management Agent.
    - **Note 1.1.3.4 (Tool Catalog Implications):** The `tool_catalog` table will need to robustly support Docker-based deployment. Key fields will include:
        - `packaging_type`: Default to "docker_image".
        - `package_identifier`: The full Docker image name and tag (e.g., `org/tool-name:version`).
        - `default_config_template`: May include Docker-specific configurations like port mappings, volume mounts (if necessary and standardized), and environment variable templating.
- [x] 1.1.4 Design: Communication protocol between Agentopia backend and Agent Droplets (e.g., secure API on droplets, SSH-based commands, message queue).
    - **Note 1.1.4.1 (Decision - Secure API on Droplet Recommended):** A secure HTTP/S API exposed by the Droplet Tool Management Agent on each agent-specific droplet is the recommended communication protocol for the Agentopia backend to manage tools on the droplet.
    - **Note 1.1.4.2 (Rationale):**
        - **Standardization:** Uses well-understood HTTP/S and RESTful or RPC-style principles.
        - **Simplicity:** Easier to implement and debug compared to a full message queue system for this specific use case.
        - **Request/Response:** Naturally fits the command-and-control nature (e.g., install tool, get status).
    - **Note 1.1.4.3 (Key Design Aspects):**
        - **Protocol:** HTTPS exclusively.
        - **Authentication:** Agentopia backend will authenticate to the Droplet Agent's API using a unique, long-lived bearer token. This token will be generated by Agentopia during droplet provisioning and securely passed to the Droplet Agent (e.g., via cloud-init user data).
        - **API Endpoints (Illustrative):**
            - `POST /tools/install` (Body: { tool_catalog_id, version, config_overrides })
            - `POST /tools/{installed_tool_id}/start`
            - `POST /tools/{installed_tool_id}/stop`
            - `DELETE /tools/{installed_tool_id}`
            - `GET /tools/{installed_tool_id}/status`
            - `GET /tools` (List installed tools and their statuses)
            - `POST /tools/{installed_tool_id}/configure` (Body: { config_updates })
        - **Request/Response Format:** JSON.
        - **Discovery:** Agentopia backend will use the droplet's IP address (from `agent_droplets` table) and a standardized port (e.g., `30000` - to be determined) for the Droplet Tool Management Agent's API.
        - **Security Considerations:**
            - Droplet firewall must be configured to allow inbound traffic on the management API port, ideally restricted to Agentopia backend IP(s) if possible, or otherwise rely on strong API token authentication.
            - The Droplet Tool Management Agent itself must be a hardened application.
    - **Note 1.1.4.4 (Alternatives Considered & Rejected for now):**
        - **SSH-based commands:** Less structured, harder to manage state and complex data exchange.
        - **Message Queue:** Adds infrastructural complexity (message broker) for the primary command/control flow. Could be considered for future asynchronous eventing *from* droplets if needed, but not for the core management API.
- [x] 1.1.5 Setup: DigitalOcean account access, API token generation, and project setup within DigitalOcean if required. Store API token securely (e.g., Agentopia backend environment variable or Vault).
    - **Note 1.1.5.1 (Action Required by Team):** This task requires manual setup within the DigitalOcean account and Supabase Vault. The AI cannot perform these actions directly.
    - **Note 1.1.5.2 (Steps for Team):**
        - **1. Confirm/Ensure DigitalOcean Account Access:** Verify access to the appropriate DigitalOcean account.
        - **2. Generate DigitalOcean API Token:**
            - Log in to the DigitalOcean control panel.
            - Navigate to `API` (usually under `Manage` or in account settings).
            - Click `Generate New Token`.
            - **Token Name:** Use a descriptive name (e.g., `agentopia-tool-droplet-manager`).
            - **Scopes/Permissions:** Grant **Read and Write** permissions. At a minimum, this is required for Droplets (create, delete, list, get status). Consider if other permissions like Firewalls might be needed later, but start with least privilege for Droplets.
            - **Expiration:** Choose an appropriate expiration or no expiration. If non-expiring, ensure strict access control to where it's stored.
            - **IMPORTANT: Copy the generated token immediately.** DigitalOcean will not show it again.
        - **3. DigitalOcean Project Setup (Recommended):**
            - In the DigitalOcean control panel, create a new Project (e.g., `Agentopia-Tool-Environments`) if one doesn't exist. Assign newly created resources (like droplets for tools) to this project for better organization and billing clarity.
        - **4. Securely Store API Token in Supabase Vault:**
            - Navigate to your Supabase project dashboard.
            - Go to `Vault` (or `Secrets` section).
            - Add a new secret. Name it descriptively (e.g., `DIGITALOCEAN_API_TOKEN`).
            - Paste the copied API token as the secret value.
            - Ensure appropriate access controls are set for this secret within Supabase if applicable, so only the necessary backend services can retrieve it.
    - **Note 1.1.5.3 (Agentopia Backend Integration):** The Agentopia backend's "Provisioning Service" will need to be configured to securely fetch this `DIGITALOCEAN_API_TOKEN` from Supabase Vault when making calls to the DigitalOcean API via the `dots-wrapper` library.

### 1.2 Database Design (Supabase)
- [x] 1.2.1 Design: Schema for `agent_droplets` table.
    - **Fields:** `id`, `agent_id` (FK to `agents`), `droplet_id` (DigitalOcean ID), `ip_address`, `status` (e.g., pending, active, error, deleted), `region`, `size`, `created_at`, `updated_at`.
    - **Note 1.2.1.1 (Detailed Schema Design):**
        - **Table Name:** `agent_droplets`
        - **Purpose:** Stores information about DigitalOcean Droplets provisioned for an agent's tool environment.
        - **Enum Type for Status:**
          ```sql
          CREATE TYPE droplet_status_enum AS ENUM (
              'pending_creation',
              'creating',
              'active',
              'error_creation',
              'pending_deletion',
              'deleting',
              'deleted',
              'error_deletion',
              'unresponsive'
          );
          ```
        - **Columns:**
            - `id`: `UUID`, PK, `default gen_random_uuid()`
            - `agent_id`: `UUID`, FK to `public.agents(id)`, `NOT NULL`, `UNIQUE`
            - `do_droplet_id`: `BIGINT`, `UNIQUE` (once populated, should be `NOT NULL` after creation confirmed)
            - `ip_address`: `INET`, `NULLABLE`
            - `status`: `droplet_status_enum`, `NOT NULL`, `default 'pending_creation'`
            - `region_slug`: `TEXT`, `NOT NULL` (e.g., `nyc3`)
            - `size_slug`: `TEXT`, `NOT NULL` (e.g., `s-1vcpu-1gb`)
            - `image_slug`: `TEXT`, `NOT NULL` (e.g., `ubuntu-22-04-x64-docker`)
            - `do_created_at`: `TIMESTAMPTZ`, `NULLABLE` (Timestamp from DigitalOcean)
            - `last_heartbeat_at`: `TIMESTAMPTZ`, `NULLABLE` (Timestamp of last successful contact with Droplet Tool Management Agent)
            - `error_message`: `TEXT`, `NULLABLE` (For error states)
            - `created_at`: `TIMESTAMPTZ`, `NOT NULL`, `default now()`
            - `updated_at`: `TIMESTAMPTZ`, `NOT NULL`, `default now()` (auto-update via trigger recommended)
        - **Indexes:**
            - On `agent_id`
            - On `do_droplet_id`
            - On `status`
- [x] 1.2.2 Design: Schema for `agent_droplet_tools` table (tools installed on specific droplets).
    - **Fields:** `id`, `agent_droplet_id` (FK to `agent_droplets`), `tool_catalog_id` (FK to a new `tool_catalog` table, see 1.2.4), `status` (e.g., installing, active, error, pending_config), `version`, `config_details` (JSONB, for tool-specific settings like port, internal paths), `created_at`, `updated_at`.
    - **Note 1.2.2.1 (Detailed Schema Design):**
        - **Table Name:** `agent_droplet_tools`
        - **Purpose:** Manages lifecycle and configuration of tools installed on an agent's DigitalOcean Droplet.
        - **Enum Type for Status:**
          ```sql
          CREATE TYPE tool_installation_status_enum AS ENUM (
              'pending_install',
              'installing',
              'active',
              'error_install',
              'pending_uninstall',
              'uninstalling',
              'uninstalled',
              'error_uninstall',
              'pending_config',
              'stopped',
              'starting',
              'stopping',
              'error_runtime',
              'disabled'
          );
          ```
        - **Columns:**
            - `id`: `UUID`, PK, `default gen_random_uuid()`
            - `agent_droplet_id`: `UUID`, FK to `public.agent_droplets(id)`, `NOT NULL`
            - `tool_catalog_id`: `UUID`, FK to `public.tool_catalog(id)`, `NOT NULL`
            - `version_to_install`: `TEXT`, `NOT NULL` (e.g., "1.0.2", "latest")
            - `actual_installed_version`: `TEXT`, `NULLABLE` (Reported by Droplet Agent)
            - `status`: `tool_installation_status_enum`, `NOT NULL`, `default 'pending_install'`
            - `config_values`: `JSONB`, `NULLABLE`, `default '{}'` (Resolved config for this instance)
            - `runtime_details`: `JSONB`, `NULLABLE`, `default '{}'` (Info from Droplet Agent, e.g., port, container ID)
            - `error_message`: `TEXT`, `NULLABLE` (For error states)
            - `enabled`: `BOOLEAN`, `NOT NULL`, `default true` (Administratively enabled/disabled)
            - `created_at`: `TIMESTAMPTZ`, `NOT NULL`, `default now()`
            - `updated_at`: `TIMESTAMPTZ`, `NOT NULL`, `default now()` (auto-update via trigger recommended)
        - **Indexes:**
            - On `agent_droplet_id`
            - On `tool_catalog_id`
            - On `status`
- [x] 1.2.3 Design: Secrets management strategy for third-party tool API keys (e.g., OpenAI API key for the Reasoning MCP Server).
    - **Note:** Leverage Supabase Vault. Design how secrets in Vault will be associated with specific `agent_droplet_tools` entries or `agent_droplets`. How does the tool on the droplet securely access its key?
    - **Note 1.2.3.1 (Core Principles):**
        - All sensitive third-party API keys are stored exclusively in Supabase Vault.
        - Secrets are never stored in plain text in database tables like `agent_droplet_tools` or `tool_catalog`.
        - The principle of least privilege should apply to accessing secrets.
    - **Note 1.2.3.2 (Association of Secrets with Tools):**
        - **1. Definition in `tool_catalog`:** The `tool_catalog` entry for each tool will define a schema of *expected secret keys* that the tool requires to function (e.g., `[{"name": "OPENAI_API_KEY", "description": "OpenAI API Key for LLM calls", "env_var_name": "OPENAI_API_KEY"}]`). This could be part of `default_config_template` or a dedicated field like `required_secrets_schema`.
        - **2. Mapping during Tool Configuration:** When a user adds/configures a tool for their agent (creating/updating an `agent_droplet_tools` entry), the Agentopia backend will facilitate mapping these required secret keys to specific secrets stored in Supabase Vault. The `agent_droplet_tools.config_values` might store non-sensitive references or placeholders, or the Agentopia backend maintains this mapping internally/derives it based on user setup for that tool instance.
    - **Note 1.2.3.3 (Secure Retrieval by Tool on Droplet - Recommended Flow):**
        - **Runtime Retrieval via Droplet Tool Management Agent:** This is the preferred method.
        - **Flow:**
            - a. The Droplet Tool Management Agent (DTMA), before starting a specific tool instance (e.g., a Docker container), identifies the secrets required for that tool based on its configuration (derived from `tool_catalog` and `agent_droplet_tools`).
            - b. The DTMA makes a secure, authenticated API call (HTTPS) to a dedicated endpoint on the Agentopia backend (e.g., `/api/v1/agent-tool-secrets/{agent_droplet_tool_id}`). The DTMA authenticates using its unique token (as per 1.1.4 design).
            - c. The Agentopia backend verifies the DTMA's identity and its authorization to fetch secrets for the specified `agent_droplet_tool_id`.
            - d. The Agentopia backend retrieves the actual secret values from Supabase Vault based on the mapping established during tool configuration.
            - e.  The Agentopia backend transmits the secret values securely (over HTTPS) back to the DTMA on the droplet.
            - f. The DTMA receives the secret values and injects them directly into the tool's runtime environment (e.g., as environment variables when executing `docker run -e SECRET_NAME=secret_value ...`). Secrets should be held in memory and not written to disk on the droplet by the DTMA if avoidable.
        - **Note 1.2.3.4 (Security Considerations):**
            - The Agentopia backend API endpoint for serving secrets must be robustly secured and audited.
            - The communication channel between DTMA and Agentopia backend must be encrypted (HTTPS).
            - The DTMA itself is a critical component and must be hardened.
            - Secrets in Supabase Vault must have appropriate access controls.
            - Consider mechanisms for secret rotation and how updates in Vault propagate to running tools (likely requires a tool restart initiated by Agentopia via the DTMA).
- [x] 1.2.4 Design: Schema for `tool_catalog` table (available tool types).
    - **Fields:** `id`, `tool_name` (e.g., "Reasoning MCP Server", "Data Analysis Python Backend"), `description`, `version_info` (JSONB, e.g., available versions, default version), `packaging_type` (e.g., "docker_image", "script_url"), `package_identifier` (e.g., Docker image name, script URL), `default_config_template` (JSONB).
    - **Note 1.2.4.1 (Detailed Schema Design):**
        - **Table Name:** `tool_catalog`
        - **Purpose:** Defines available tools, their packaging, versions, and default configurations.
        - **Enum Type for `packaging_type`:**
          ```sql
          CREATE TYPE tool_packaging_type_enum AS ENUM (
              'docker_image'
          );
          ```
        - **Enum Type for `status`:**
          ```sql
          CREATE TYPE catalog_tool_status_enum AS ENUM (
              'available',
              'beta',
              'experimental',
              'deprecated',
              'archived'
          );
          ```
        - **Columns:**
            - `id`: `UUID`, PK, `default gen_random_uuid()`
            - `tool_name`: `TEXT`, `NOT NULL`, `UNIQUE`
            - `description`: `TEXT`, `NULLABLE`
            - `developer_org_name`: `TEXT`, `NULLABLE`
            - `categories`: `TEXT[]`, `NULLABLE` (e.g., `{"mcp_server", "reasoning"}`)
            - `icon_url`: `TEXT`, `NULLABLE`
            - `documentation_url`: `TEXT`, `NULLABLE`
            - `packaging_type`: `tool_packaging_type_enum`, `NOT NULL`, `default 'docker_image'`
            - `package_identifier`: `TEXT`, `NOT NULL` (e.g., Docker image `organization/image_name`)
            - `version_info`: `JSONB`, `NOT NULL`, `default '{"available_versions": ["latest"], "default_version": "latest"}'` (See WBS notes for example structure including `version_details` and `package_identifier_override`)
            - `default_config_template`: `JSONB`, `NULLABLE`, `default '{}'` (Schema and default values for tool config - see WBS notes)
            - `required_secrets_schema`: `JSONB`, `NULLABLE`, `default '[]'` (Schema for required secrets, e.g., `[{"name": "API_KEY", "env_var_name": "TOOL_API_KEY"}]`)
            - `resource_requirements`: `JSONB`, `NULLABLE`, `default '{}'` (e.g., `{"min_ram_mb": 512}`)
            - `status`: `catalog_tool_status_enum`, `NOT NULL`, `default 'available'`
            - `created_at`: `TIMESTAMPTZ`, `NOT NULL`, `default now()`
            - `updated_at`: `TIMESTAMPTZ`, `NOT NULL`, `default now()` (auto-update via trigger recommended)
        - **Indexes:**
            - On `tool_name` (unique)
            - On `categories` (GIN index)
            - On `status`
- [x] 1.2.5 Implement: Initial database migrations for the new tables.
    - **Note 1.2.5.1 (Migration Script Created):** The SQL migration script `supabase/migrations/20250506000000_create_tool_infrastructure_tables.sql` has been created. It includes definitions for:
        - ENUM types: `droplet_status_enum`, `tool_installation_status_enum`, `tool_packaging_type_enum`, `catalog_tool_status_enum`.
        - Tables: `agent_droplets`, `tool_catalog`, `agent_droplet_tools` with specified columns, primary keys, foreign keys (with `ON DELETE CASCADE`/`RESTRICT` as appropriate), defaults, and indexes.
        - A common function `trigger_set_timestamp()` and associated triggers on each table to auto-update `updated_at` columns.
    - **Note 1.2.5.2 (Next Steps for Team):**
        - Review the generated migration script for correctness and completeness.
        - Adjust the timestamp in the filename if necessary to ensure correct migration order.
        - Apply the migration to the Supabase development environment using `supabase db push` (or `supabase migration up` after squashing if that workflow is used).
        - Test the schema changes.

### 1.3 Security Design
- [x] 1.3.1 Design: Secure method for Agentopia backend to authenticate with and command Agent Droplets.
    - **Note 1.3.1.1 (Chosen Method - Per-Droplet Bearer Token over HTTPS):** This design builds upon the communication protocol decided in 1.1.4.
    - **Note 1.3.1.2 (Authentication Flow & Token Management):**
        - **1. Token Generation:** Agentopia backend generates a unique, strong bearer token when a new droplet is provisioned for an `agent_droplets` record.
        - **2. Secure Token Delivery to Droplet Agent (DTMA):** The token is passed to the droplet via DigitalOcean's `user-data` (cloud-init script) at creation. The cloud-init script makes it securely available to the DTMA (e.g., file with restricted permissions or environment variable for the DTMA process).
        - **3. Secure Token Storage by Agentopia Backend:** The Agentopia backend securely stores this generated token (e.g., encrypted in its database, associated with the `agent_droplets` record, or in a system-level vault) to use for authenticating its API calls *to* that specific DTMA.
        - **4. API Authentication:** All API calls from Agentopia backend to the DTMA will include this token in the `Authorization: Bearer <token>` header.
        - **5. Token Validation by DTMA:** The DTMA validates the received bearer token against the one it was provisioned with.
    - **Note 1.3.1.3 (Communication Security):**
        - **HTTPS Exclusively:** All communication between Agentopia backend and DTMA API must be over HTTPS.
        - **TLS Certificates:** The DTMA must use TLS certificates. For production, these should be from a trusted CA (e.g., Let's Encrypt). Self-signed certificates might be acceptable for internal/dev if the Agentopia backend HTTP client is configured to trust them specifically, but CA-signed is preferred.
    - **Note 1.3.1.4 (Network & OS Level Security):**
        - **Droplet Firewall:** Configure droplet firewall (e.g., `ufw`, DigitalOcean Cloud Firewall) to allow inbound traffic on the DTMA API port *only* from known Agentopia backend IP addresses if possible. If backend IPs are dynamic, robust application-level authentication (token + HTTPS) is critical.
        - **Principle of Least Privilege for DTMA:** The DTMA process on the droplet should run with the minimum necessary operating system permissions to perform its tasks (e.g., manage specified Docker containers/tool scripts).
        - **Note 1.3.1.5 (Token Scope):** The bearer token is specific to a single droplet, providing implicit scoping. It cannot be used to command other droplets.
- [x] 1.3.2 Design: Initial firewall configuration for Agent Droplets (e.g., allow SSH from specific IPs, allow specific tool ports).
    - **Note 1.3.2.1 (Strategy - DigitalOcean Cloud Firewalls):** Utilize DigitalOcean Cloud Firewalls as the primary mechanism, managed by the Agentopia backend where dynamic rules are needed.
    - **Note 1.3.2.2 (Default Policy):**
        - **Inbound:** Deny all by default.
        - **Outbound:** Allow all by default (for OS updates, Docker Hub, calls to Agentopia backend, etc.).
    - **Note 1.3.2.3 (Standard Inbound Rules - Applied via a Base Firewall Policy):**
        - **1. SSH (Port 22/TCP):**
            - **Source:** Restricted to specific Agentopia administrative static IP addresses/ranges (e.g., Bastion Host, VPN).
            - **Purpose:** Emergency administrative access and debugging. NOT for automated management.
        - **2. Droplet Tool Management Agent (DTMA) API (Port e.g., 30000/TCP - TBD):**
            - **Source:** Restricted to known Agentopia backend static IP address(es)/ranges.
            - **Purpose:** Allows Agentopia backend to send commands to the DTMA.
        - **3. ICMP (Ping - Optional):**
            - **Source:** Restricted to known Agentopia backend/monitoring IP address(es)/ranges.
            - **Purpose:** Basic network health checks.
    - **Note 1.3.2.4 (Tool-Specific Inbound Rules - Dynamically Managed by Agentopia Backend):**
        - For tools (e.g., MCP Servers) that require direct inbound connections from the Agentopia backend:
            - When such a tool is activated on a droplet, the Agentopia backend (e.g., Tool Management Service) will use the DigitalOcean API (`dots-wrapper`) to add a rule to the droplet's effective firewall configuration.
            - **Port:** Specific to the tool (defined in `tool_catalog` or discovered from `agent_droplet_tools.runtime_details`).
            - **Source:** Restricted to known Agentopia backend static IP address(es)/ranges.
            - When the tool is deactivated/uninstalled, the Agentopia backend will remove this firewall rule.
    - **Note 1.3.2.5 (Implementation Detail):**
        - A base DigitalOcean Cloud Firewall policy (e.g., "agent-droplet-base-policy") containing the standard rules (SSH, DTMA API, ICMP) can be created and applied to all agent droplets using a common tag.
        - Tool-specific rules would then be added/removed from this base policy or a more granular, droplet-specific firewall setup managed by the backend.
- [x] 1.3.3 Design: Secure retrieval of third-party API keys by tools running on the Droplet.
    - **Note 1.3.3.1 (Reference to Existing Design):** The strategy for secure retrieval of third-party API keys by tools on droplets is detailed in WBS item `1.2.3 (Design: Secrets management strategy...)`. This item confirms that design fulfills this requirement.
    - **Note 1.3.3.2 (Key Principles for Secure Retrieval):**
        - **No Direct Droplet/Tool Access to Supabase Vault:** Neither the Droplet Tool Management Agent (DTMA) nor the tools themselves will directly query Supabase Vault.
        - **Agentopia Backend as Sole Vault Intermediary:** The Agentopia backend is the only system component authorized to fetch raw secret values from Supabase Vault for this purpose.
        - **Secure Transit via DTMA Request:**
            - The DTMA requests the specific secret values needed for a tool instance from a dedicated, secure (HTTPS, authenticated via DTMA's unique token) API endpoint on the Agentopia backend.
            - The Agentopia backend, upon successful authorization, retrieves the secret(s) from Vault and transmits them to the DTMA.
        - **Secure Injection by DTMA:** The DTMA injects the received secrets into the tool's runtime environment (e.g., as environment variables for a Docker container at startup) without persisting them unnecessarily on the droplet's disk.
        - **End-to-End Security:** The overall security relies on: secure storage in Vault, authenticated and encrypted communication channels (DTMA <-> Agentopia Backend), and the DTMA acting as a trusted, hardened agent on the droplet.

## Phase 2: Droplet Provisioning & Management Service (Agentopia Backend)

### 2.1 Backend: DigitalOcean Provisioning & Management Service
- [x] 2.1.1 Implement: DigitalOcean API Wrapper Service (`digitalocean_service`).
    - **Note:** Create client, implement functions for create, get, delete droplets, list droplets by tag. Base path: `src/services/digitalocean_service/`.
    - **Files:** `client.ts`, `droplets.ts`, `types.ts`, `index.ts` (and potentially `firewalls.ts`, `volumes.ts` later).
    - **Status:** [COMPLETED]
- [x] 2.1.2 Implement: Error handling and retry logic within `digitalocean_service` (e.g., using `exponential-backoff`).
    - **Status:** [IN PROGRESS] -> [COMPLETED] - Basic structure implemented, needs real-world error pattern verification.
- [x] 2.1.3 Implement: Agent Environment Orchestration Service (`agent_environment_service`).
    - **Note:** Handles logic for `ensureToolEnvironmentReady` (checks DB, provisions if needed via `digitalocean_service`), `getAgentDropletDetails`, `provisionAgentDroplet`, `deprovisionAgentDroplet`.
    - **Files:** `manager.ts`, `types.ts`, `index.ts`. Base path: `src/services/agent_environment_service/`.
    - **Status:** [COMPLETED]
    - **Note 2.1.3.1 (Caveat):** Implemented using temporary `any` casts for Supabase interactions due to outdated `database.types.ts`. Requires `database.types.ts` to be regenerated and casts removed. Affected by linter issues with `digitalocean_service` import path in current user's `manager.ts`.
- [x] 2.1.4 Implement: Database interaction logic within `agent_environment_service` for `agent_droplets` table (CRUD operations, status updates).
    - **Status:** [COMPLETED] (Implemented as part of 2.1.3)
    - **Note 2.1.4.1 (Caveat):** Subject to the same caveats as 2.1.3 regarding outdated `database.types.ts` and temporary `any` casts.
- [x] 2.1.5 Implement: Heartbeat mechanism from Droplet Tool Management Agent (DTMA) to Agentopia backend (updating `agent_droplets.last_heartbeat_at` and `status`).
    - **Status:** [COMPLETED] - Supabase Edge Function `supabase/functions/heartbeat/index.ts` created. Requires user review, env var setup, CORS, deployment, and testing.
    - **Note 2.1.5.1:** Assumes `database.types.ts` will be made available in `supabase/functions/_shared/` for Edge Function use.
- [x] 2.1.6 Implement: Secure endpoint on Agentopia backend for DTMA to call for fetching tool secrets from Vault.
    - **Status:** [COMPLETED] - Supabase Edge Function `supabase/functions/fetch-tool-secrets/index.ts` created.
    - **Note 2.1.6.1 (Action Required):** Requires refinement of secret mapping logic (how `tool_catalog.required_secrets_schema` or `agent_droplet_tools.config_values` maps required secret names to specific Vault IDs for an instance).
    - **Note 2.1.6.2:** Requires user review, env var setup, CORS, deployment, testing, and assumes `database.types.ts` availability in `_shared`.

### 2.2 Droplet Lifecycle Management
- [ ] 2.2.1 Implement: Logic to trigger Droplet provisioning when a new "Tool Environment" is requested for an agent.
    - **Note:** This includes selecting Droplet image (e.g., base OS, Docker pre-installed), region, size.
    - **Note:** Update `agent_droplets` table with Droplet details and status.
    - [x] 2.2.1.1 Design & Implement: Supabase Edge Function (e.g., manage-agent-tool-environment) for frontend to call.
        - **Status:** [PARTIALLY COMPLETE]
        - **Note:** Edge function `manage-agent-tool-environment/index.ts` created (05/08/2025).
        - [x] 2.2.1.1.1 Define: API contract (e.g., POST /api/v1/agents/{agentId}/tool-environment).
            - **Status:** [COMPLETE] (Defined as POST /api/v1/manage-agent-tool-environment/{agentId})
        - [x] 2.2.1.1.2 Implement: User authentication & agent ownership authorization in Edge Function.
            - **Status:** [COMPLETE] (Implemented 05/08/2025)
        - [ ] 2.2.1.1.3 Implement: Internal authenticated call from Edge Function to Node.js backend service that invokes ensureToolEnvironmentReady.
            - **Note:** Helper `callInternalNodeService` sketched in Edge Function.
    - [ ] 2.2.1.2 Implement: Internal Node.js backend endpoint (e.g., POST /internal/agents/{agentId}/ensure-tool-environment) called by Edge Function, which in turn calls `agent_environment_service.ensureToolEnvironmentReady`.
    - [x] 2.2.1.3 Implement: Frontend UI on Agent Edit Page - "Activate Tool Environment" toggle.
        - **Status:** [PARTIALLY COMPLETE]
        - **Note:** UI (Switch, state, handler, status display) added to `src/pages/agents/[agentId]/edit.tsx` (05/08/2025).
        - [ ] 2.2.1.3.1 Refine: State management for toggle, status display (including fetching initial status from `agent_droplets`).
            - **Note:** Initial status fetch from `agent_droplets` added to `useEffect` (05/08/2025).
        - [x] 2.2.1.3.2 Implement: Frontend API client function (e.g., in `src/lib/api/toolEnvironments.ts`) to call the Edge Function.
            - **Status:** [COMPLETE] (Created `src/lib/api/toolEnvironments.ts` and integrated 05/08/2025)
        - [ ] 2.2.1.3.3 Refine: UI logic for toggle interaction, loading states, and comprehensive feedback.
- [ ] 2.2.2 Implement: Agent Droplet bootstrap/setup script.
- [ ] 2.2.3 Implement: Logic to de-provision Droplets (e.g., when "Tool Environment" is deactivated or agent is deleted).
    - **Note:** Ensure tools are gracefully stopped if possible. Update `agent_droplets` table.
    - [x] 2.2.3.1 Design & Implement: Supabase Edge Function endpoint for de-provisioning (e.g., DELETE /api/v1/agents/{agentId}/tool-environment within `manage-agent-tool-environment` function).
        - **Status:** [PARTIALLY COMPLETE]
        - **Note:** Covered by `manage-agent-tool-environment/index.ts` (handling DELETE) created (05/08/2025).
        - [x] 2.2.3.1.1 Define: API contract.
            - **Status:** [COMPLETE] (Defined as DELETE /api/v1/manage-agent-tool-environment/{agentId})
        - [x] 2.2.3.1.2 Implement: User authentication & agent ownership authorization in Edge Function.
            - **Status:** [COMPLETE] (Covered by 2.2.1.1.2)
        - [ ] 2.2.3.1.3 Implement: Internal authenticated call from Edge Function to Node.js backend service that invokes deprovisionAgentDroplet.
            - **Note:** Helper `callInternalNodeService` (for DELETE) sketched in Edge Function.
    - [ ] 2.2.3.2 Implement: Internal Node.js backend endpoint (e.g., DELETE /internal/agents/{agentId}/tool-environment) called by Edge Function, which in turn calls `agent_environment_service.deprovisionAgentDroplet`.
    - [x] 2.2.3.3 Implement: Frontend UI on Agent Edit Page - "Deactivate Tool Environment" via toggle.
        - **Status:** [PARTIALLY COMPLETE]
        - **Note:** Covered by UI changes in 2.2.1.3.x.
- [ ] 2.2.4 Implement: Periodic status checks for active Agent Droplets from Agentopia backend. Update `agent_droplets.status`

## Phase 3: Droplet Tool Management Agent (DTMA) & Tool Deployment

### 3.1 DTMA Implementation
- [x] 3.1.1 Design: DTMA architecture, API definition, security model.
    - **Status:** [COMPLETED]
    - **Note 3.1.1.1 (Architecture):** Lightweight agent on droplet, bridge between Agentopia backend and Docker tools.
    - **Note 3.1.1.2 (Tech Stack):** Node.js recommended (Express/Fastify, axios/node-fetch, dockerode).
    - **Note 3.1.1.3 (DTMA API - Inbound):** Listens on HTTPS (e.g., port 30000). Requires Bearer token auth (`dtma_auth_token`). Endpoints: POST /tools/install, POST /tools/start, POST /tools/stop, DELETE /tools/uninstall, GET /status.
    - **Note 3.1.1.4 (Agentopia API - Outbound Calls):** Calls Agentopia backend `POST /api/v1/heartbeat` and `POST /api/v1/fetch-tool-secrets` using its `dtma_auth_token`.
    - **Note 3.1.1.5 (Configuration):** Reads `dtma_auth_token` from `/etc/dtma.conf` (set by cloud-init). Reads Agentopia API base URL from env var/config.
    - **Note 3.1.1.6 (Security):** HTTPS for own API, token auth, secure secret handling (via Agentopia API), Docker socket permissions, runs as non-root if possible.
    - **Note 3.1.1.7 (Bootstrap):** Requires Node.js, Docker installed on droplet. DTMA needs installation & setup as a service (e.g., systemd) via `user_data`.
- [x] 3.1.2 Implement: DTMA basic scaffolding (Node.js project setup, simple HTTP server).
    - **Status:** [LARGELY COMPLETE] - `dtma/src/index.ts` sets up Express server. Project structure in place.
- [x] 3.1.3 Implement: DTMA interaction with Docker (using e.g., `dockerode` library).
    - **Status:** [LARGELY COMPLETE] - `dtma/src/docker_manager.ts` implements core Docker operations.
- [x] 3.1.4 Implement: DTMA API endpoints (install, start, stop, uninstall tools based on backend commands).
    - **Status:** [LARGELY COMPLETE] - `dtma/src/routes/tool_routes.ts` defines `/tools/install, /start, /stop, /uninstall, /status`.
- [x] 3.1.5 Implement: DTMA logic for securely fetching secrets from Agentopia backend API.
    - **Status:** [LARGELY COMPLETE] - Implemented in `/tools/start` endpoint via `agentopia_api_client.ts`.
- [ ] 3.1.6 Implement: DTMA logic for sending heartbeat/status updates to Agentopia backend API.
    - **Status:** [PARTIALLY COMPLETE] - Heartbeat sending is implemented in `index.ts` via `agentopia_api_client.ts`. 
    - **Note 3.1.6.1 (Gaps):** Payload is missing `system_status` (CPU, Mem, Disk) and detailed `tool_statuses` (from Docker manager). These are marked as TODOs in `dtma/src/index.ts`.

### 3.2 Droplet Bootstrap & DTMA Setup
- [x] 3.2.1 Define: Droplet base image and initial setup requirements (OS, Docker, Node.js, DTMA dependencies).
    - **Note 3.2.1.1 (Base Image):** Ubuntu 22.04 LTS (or latest stable LTS).
    - **Note 3.2.1.2 (Pre-installed/Bootstrapped):**
        - Docker Engine
        - Node.js (version compatible with DTMA, e.g., v18, v20)
        - Git
        - `curl`, `gnupg` (for adding repositories)
        - Standard build tools if DTMA needs compilation (`build-essential` or similar).
    - **Note 3.2.1.3 (User):** A dedicated user for running the DTMA service (e.g., `dtma_user` or use `ubuntu` if appropriate).
- [x] 3.2.2 Implement: Bootstrap script (`user_data` for DigitalOcean) to install Docker, Node.js, clone DTMA, install dependencies, build DTMA (if necessary), and set up DTMA config file (`/etc/dtma.conf` with auth token).
    - **Note 3.2.2.1 (Implementation Details):** Implemented in `agent_environment_service/manager.ts` within the `createUserDataScript` function.
    - **Note 3.2.2.2 (Enhancements 2025-05-08):** Refined script to include logging to `/var/log/dtma-bootstrap.log`. Parameters for DTMA Git Repo URL and Agentopia API URL are now used more robustly and have more realistic defaults (though they should be overridden by environment variables `DTMA_GIT_REPO_URL` and `AGENTOPIA_API_URL` in the backend service).
    - **Note 3.2.2.3 (Linter):** The TypeScript linter shows false positive errors on lines where shell variables (e.g., `\${DTMA_DIR}`) are used within `bash -c "..."` commands inside the template literal. This is due to the linter misinterpreting the correctly escaped shell variable as a TypeScript template variable. The generated script is expected to be correct.
- [ ] 3.2.3 Test and refine: The bootstrap script on a sample DO Droplet.
    - **Tasks:**
        - Manually provision a DO droplet with the generated `user_data`.
        - SSH into the droplet.
        - Verify Docker installation and status.
        - Verify Node.js installation and version.
        - Verify DTMA code is cloned to the correct directory (e.g., `/opt/agentopia/dtma`).
        - Verify DTMA dependencies are installed (`node_modules` present).
        - Verify DTMA build is successful (`dist` folder present if applicable).
        - Verify DTMA config file (`/etc/dtma.conf`) is created with the correct auth token and API URL.
        - Verify `dtma.service` `systemd` unit file is created in `/etc/systemd/system/`.
        - Verify `dtma` service is enabled and running (`systemctl status dtma`).
        - Check DTMA logs (`journalctl -u dtma` and `/var/log/dtma-bootstrap.log`).
        - Ensure the DTMA agent starts and attempts to send a heartbeat.
- [ ] 3.2.4 Implement: `systemd` service configuration for DTMA to ensure it runs on startup and restarts on failure.
    - **Note 3.2.4.1:** This is part of the `createUserDataScript` (WBS 3.2.2). Verification will occur during WBS 3.2.3.