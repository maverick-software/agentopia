# WBS Checklist: Agent Tool Infrastructure
**Date Created:** 05/06/2025
**Plan Name:** Agent Tool Infrastructure
**Goal:** To design and implement a system where Agentopia user accounts can have a shared DigitalOcean Droplet provisioned to host multiple tool instances (including MCP Servers and other backend processes). This shared droplet will allow multiple agents belonging to the same user account to connect to specific tool instances, enabling modular tool management, installation, activation, and secure operation.

## Phase 1: Foundational Design & Provider Setup

### 1.1 Core Architecture & Strategy
- [x] 1.1.1 Define: Overall architecture for agent-specific tool environments on DigitalOcean.
    - **Note 1.1.1.1 (Architectural Outline - REVISED for Account-Level Shared Droplets):**
        - **Goal:** Create a shared, dynamically provisioned environment on a DigitalOcean Droplet for each user account that enables the "Tool Environment" feature. This droplet will host multiple tool instances, accessible by agents belonging to that account.
        - **Components & Responsibilities:**
            - **1. Agentopia Frontend:**
                -   User manages account-level "Tool Environment" (activation/deactivation).
                -   User manages the "Toolbelt" (adding/removing/configuring tool *blueprints* from a catalog that can be instantiated on the account droplet).
                -   User/Agent links specific agents to active tool *instances* running on the account droplet.
            - **2. Agentopia Backend:**
                -   Manages core DB tables (`users`, `agents`, `tool_catalog`, `account_tool_environments`, `account_tool_instances`, `agent_tool_instance_links`).
                -   Handles frontend requests.
                -   Contains **Provisioning Service:** Communicates with DigitalOcean API to create/delete account-level Droplets based on `account_tool_environments` status. Updates `account_tool_environments` table.
                -   Contains **Tool Instance Management Service:** Communicates with the Droplet Tool Management Agent (DTMA) on the account droplet to manage the lifecycle (start/stop/configure) of individual tool *instances* (e.g., MCP server processes). Updates `account_tool_instances` table. Manages secure secret fetching (from Vault) and delivery for tool instances.
                -   Contains **Agent Orchestration Logic:** (e.g., within `chat` service) Checks agent status, discovers active tool instance endpoints (e.g., specific MCP server host:port) from `account_tool_instances` (via `agent_tool_instance_links`), interacts with tools on the account droplet.
            - **3. Account-Specific Shared Droplet (DigitalOcean):**
                -   Standardized base image (e.g., Ubuntu + Docker).
                -   Runs a **Droplet Tool Management Agent (DTMA)** service: Listens for commands from Agentopia Backend Tool Instance Management Service, executes tool instance lifecycle actions (e.g., `docker run` with specific ports/configs for each MCP server process), manages port allocation for instances, fetches secrets securely for instances, reports status of the droplet and all managed tool instances.
                -   Runs **Tool Instances** (e.g., multiple Reasoning MCP Server processes, each in its own Docker container on a unique port): Configured by the DTMA, receives secrets, listens for operational requests (e.g., MCP calls from Agentopia Backend via an agent).
            - **4. Tool Catalog (`tool_catalog` table):** Defines available tool *blueprints*, their packaging (Docker image/script), versions, default configs, required secrets.
        - **Data/Control Flow Summary (for an MCP Server instance):**
            -   User Action (UI) -> Agentopia Backend API -> DB Update + Provisioning/Tool Instance Mgmt Service Action.
            -   Agentopia Tool Instance Mgmt Service Command (e.g., "start MCP server for agent X on account Y's droplet") -> DTMA.
            -   DTMA -> Allocates port, starts MCP server process (Docker container) with specific config -> Updates `account_tool_instances` via Agentopia backend.
            -   Agent links to this specific instance (via `agent_tool_instance_links`).
            -   Agent Chat -> Agentopia Orchestration -> Discover specific MCP instance host:port (DB Query) -> Agentopia Backend MCP Call -> Specific MCP Server process on Account Droplet -> Response -> Agentopia Orchestration -> User.
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
    - **Note 1.1.4.5 (API Communication Direction - Implementation Decision):**
        - **Direct Supabase Edge Functions Access:** DTMA agents on droplets will communicate directly with Supabase Edge Functions at the URL `https://{project-id}.supabase.co/functions/v1`.
        - This bypasses the Netlify frontend completely for the agent-to-backend communication path.
        - Benefits: Lower latency, more reliable (eliminates a network hop), better security (direct backend communication).
        - Implementation: Set `AGENTOPIA_API_BASE_URL` in the DTMA config to point directly to the Supabase Edge Functions URL, not the Netlify frontend URL.
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
- [x] 1.2.1 Design: Schema for `account_tool_environments` table.
    - **Fields:** `id`, `user_id` (FK to `auth.users`), `do_droplet_id` (DigitalOcean ID), `ip_address`, `status` (e.g., pending, active, error, deleted), `region`, `size`, `created_at`, `updated_at`.
    - **Note 1.2.1.1 (Detailed Schema Design - REVISED):**
        - **Table Name:** `account_tool_environments`
        - **Purpose:** Stores information about DigitalOcean Droplets provisioned for a user account's shared tool environment.
        - **Enum Type for Status (can reuse `droplet_status_enum` if appropriate, or define a new one if states differ significantly for account-level):**
          ```sql
          CREATE TYPE account_environment_status_enum AS ENUM (
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
            - `user_id`: `UUID`, FK to `auth.users(id)`, `NOT NULL`, `UNIQUE` (One tool environment droplet per user)
            - `do_droplet_id`: `BIGINT`, `UNIQUE` (once populated, should be `NOT NULL` after creation confirmed)
            - `ip_address`: `INET`, `NULLABLE`
            - `status`: `account_environment_status_enum`, `NOT NULL`, `default 'pending_creation'`
            - `region_slug`: `TEXT`, `NOT NULL` (e.g., `nyc3`)
            - `size_slug`: `TEXT`, `NOT NULL` (e.g., `s-1vcpu-1gb`)
            - `image_slug`: `TEXT`, `NOT NULL` (e.g., `ubuntu-22-04-x64-docker`)
            - `do_created_at`: `TIMESTAMPTZ`, `NULLABLE` (Timestamp from DigitalOcean)
            - `last_heartbeat_at`: `TIMESTAMPTZ`, `NULLABLE` (Timestamp of last successful contact with Droplet Tool Management Agent)
            - `error_message`: `TEXT`, `NULLABLE` (For error states)
            - `created_at`: `TIMESTAMPTZ`, `NOT NULL`, `default now()`
            - `updated_at`: `TIMESTAMPTZ`, `NOT NULL`, `default now()` (auto-update via trigger recommended)
        - **Indexes:**
            - On `user_id`
            - On `do_droplet_id`
            - On `status`
- [ ] 1.2.2 Design: Schema for `account_tool_instances` table (tool instances running on account droplets).
    - **Fields:** `id`, `account_tool_environment_id` (FK to `account_tool_environments`), `tool_catalog_id` (FK to `tool_catalog`), `status` (e.g., starting, running, stopped, error), `port` (network port on the droplet), `config_details` (JSONB), `created_at`, `updated_at`.
    - **Note 1.2.2.1 (Detailed Schema Design - NEW):**
        - **Table Name:** `account_tool_instances`
        - **Purpose:** Manages lifecycle and runtime configuration of individual tool instances (e.g., MCP server processes) running on an account's shared DigitalOcean Droplet.
        - **Enum Type for Status:**
          ```sql
          CREATE TYPE tool_instance_status_enum AS ENUM (
              'pending_start',
              'starting',
              'running',
              'stopping',
              'stopped',
              'error_runtime',
              'pending_removal',
              'removed'
          );
          ```
        - **Columns:**
            - `id`: `UUID`, PK, `default gen_random_uuid()`
            - `account_tool_environment_id`: `UUID`, FK to `public.account_tool_environments(id)`, `NOT NULL`
            - `tool_catalog_id`: `UUID`, FK to `public.tool_catalog(id)`, `NOT NULL`
            - `instance_name`: `TEXT`, `NULLABLE` (User-defined friendly name for this instance, e.g., "My Main Reasoning Server")
            - `version_to_run`: `TEXT`, `NOT NULL` (e.g., "1.0.2", "latest")
            - `actual_running_version`: `TEXT`, `NULLABLE` (Reported by DTMA)
            - `status`: `tool_instance_status_enum`, `NOT NULL`, `default 'pending_start'`
            - `config_values_override`: `JSONB`, `NULLABLE`, `default '{}'` (Specific config overrides for this instance beyond catalog defaults)
            - `runtime_details`: `JSONB`, `NULLABLE`, `default '{}'` (Info from DTMA, e.g., assigned port, container ID, specific endpoints)
            - `error_message`: `TEXT`, `NULLABLE` (For error states)
            - `created_at`: `TIMESTAMPTZ`, `NOT NULL`, `default now()`
            - `updated_at`: `TIMESTAMPTZ`, `NOT NULL`, `default now()` (auto-update via trigger recommended)
        - **Indexes:**
            - On `account_tool_environment_id`
            - On `tool_catalog_id`
            - On `status`
- [ ] 1.2.2A Design: Schema for `agent_tool_instance_links` table (linking agents to specific tool instances).
    - **Fields:** `id`, `agent_id` (FK to `agents`), `account_tool_instance_id` (FK to `account_tool_instances`), `is_active_link`, `created_at`.
    - **Note 1.2.2A.1 (Detailed Schema Design - NEW):**
        - **Table Name:** `agent_tool_instance_links`
        - **Purpose:** Connects an agent to a specific running tool instance on an account's shared droplet. An agent might be linked to multiple tool instances.
        - **Columns:**
            - `id`: `UUID`, PK, `default gen_random_uuid()`
            - `agent_id`: `UUID`, FK to `public.agents(id)`, `NOT NULL`
            - `account_tool_instance_id`: `UUID`, FK to `public.account_tool_instances(id)`, `NOT NULL`
            - `link_activated_at`: `TIMESTAMPTZ`, `NULLABLE` (When this specific link became active for the agent)
            - `link_deactivated_at`: `TIMESTAMPTZ`, `NULLABLE` (If the link is made inactive)
            - `created_at`: `TIMESTAMPTZ`, `NOT NULL`, `default now()`
            - `updated_at`: `TIMESTAMPTZ`, `NOT NULL`, `default now()`
        - **Constraints:**
            - `UNIQUE(agent_id, account_tool_instance_id)` (An agent can only be linked to a specific instance once)
        - **Indexes:**
            - On `agent_id`
            - On `account_tool_instance_id`
- [x] 1.2.3 Design: Secrets management strategy for third-party tool API keys (e.g., OpenAI API key for the Reasoning MCP Server).
    - **Note:** Leverage Supabase Vault. Design how secrets in Vault will be associated with specific `account_tool_instances` entries or `account_tool_environments`. How does the tool on the droplet securely access its key?
    - **Note 1.2.3.1 (Core Principles):**
        - All sensitive third-party API keys are stored exclusively in Supabase Vault.
        - Secrets are never stored in plain text in database tables like `account_tool_instances` or `tool_catalog`.
        - The principle of least privilege should apply to accessing secrets.
    - **Note 1.2.3.2 (Association of Secrets with Tools):**
        - **1. Definition in `tool_catalog`:** The `tool_catalog` entry for each tool will define a schema of *expected secret keys* that the tool requires to function (e.g., `[{"name": "OPENAI_API_KEY", "description": "OpenAI API Key for LLM calls", "env_var_name": "OPENAI_API_KEY"}]`). This could be part of `default_config_template` or a dedicated field like `required_secrets_schema`.
        - **2. Mapping during Tool *Instance* Configuration:** When a user configures/starts an *instance* of a tool for their account (creating/updating an `account_tool_instances` entry), the Agentopia backend will facilitate mapping these required secret keys to specific secrets stored in Supabase Vault. The `account_tool_instances.config_values_override` might store non-sensitive references or placeholders, or the Agentopia backend maintains this mapping internally/derives it based on user setup for that tool instance.
    - **Note 1.2.3.3 (Secure Retrieval by Tool on Droplet - Recommended Flow):**
        - **Runtime Retrieval via Droplet Tool Management Agent:** This is the preferred method.
        - **Flow:**
            - a. The Droplet Tool Management Agent (DTMA), before starting a specific tool instance (e.g., a Docker container), identifies the secrets required for that tool based on its configuration (derived from `tool_catalog` and `account_tool_instances`).
            - b. The DTMA makes a secure, authenticated API call (HTTPS) to a dedicated endpoint on the Agentopia backend (e.g., `/api/v1/account-tool-secrets/{account_tool_instance_id}`). The DTMA authenticates using its unique token (as per 1.1.4 design, associated with the `account_tool_environment`).
            - c. The Agentopia backend verifies the DTMA's identity and its authorization to fetch secrets for the specified `account_tool_instance_id`.
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
    - **Note 1.2.5.1 (Migration Script Created - NEEDS REVISION):** The SQL migration script `supabase/migrations/20250506000000_create_tool_infrastructure_tables.sql` was previously created for the per-agent model. It needs to be **revised or replaced** to include definitions for:
        - ENUM types: `account_environment_status_enum`, `tool_instance_status_enum` (and confirm if `tool_packaging_type_enum`, `catalog_tool_status_enum` are still accurate).
        - Tables: `account_tool_environments`, `account_tool_instances`, `agent_tool_instance_links`, and `tool_catalog` (review `tool_catalog` for any changes needed to support the instance model).
        - Ensure all columns, primary keys, foreign keys (with appropriate `ON DELETE` behavior), defaults, and indexes are correctly defined for the new schema.
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
            - **Port:** Specific to the tool (defined in `tool_catalog` or discovered from `account_tool_instances.runtime_details`).
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

### 2.1 Backend: DigitalOcean Provisioning & Management Service for Account Environments
- [x] 2.1.1 Implement: DigitalOcean API Wrapper Service (`digitalocean_service`).
    - **Note:** Create client, implement functions for create, get, delete droplets, list droplets by tag. Base path: `src/services/digitalocean_service/`.
    - **Files:** `client.ts`, `droplets.ts`, `types.ts`, `index.ts` (and potentially `firewalls.ts`, `volumes.ts` later).
    - **Status:** [COMPLETED]
- [x] 2.1.2 Implement: Error handling and retry logic within `digitalocean_service` (e.g., using `exponential-backoff`).
    - **Status:** [COMPLETED] - Basic structure implemented, needs real-world error pattern verification.
- [ ] 2.1.3 Implement: Account Environment Orchestration Service (`account_environment_service`).
    - **Note:** Handles logic for `ensureAccountToolEnvironmentReady` (checks DB, provisions if needed via `digitalocean_service` for a user account), `getAccountEnvironmentDetails`, `provisionAccountEnvironment`, `deprovisionAccountEnvironment`. This service manages the lifecycle of the shared droplet for a user account.
    - **Files:** `manager.ts`, `types.ts`, `index.ts`. Base path: `src/services/account_environment_service/` (rename from `agent_environment_service`).
    - **Status:** [NEEDS REFACTORING from agent_environment_service]
    - **Note 2.1.3.1 (Refactoring Scope):** Adapt existing `agent_environment_service` to `account_environment_service`. Change function signatures and logic to operate on `user_id` and `account_tool_environments` table instead of `agent_id` and `agent_droplets`.
- [x] 2.1.4 Implement: Database interaction logic within `account_environment_service` for `account_tool_environments` table (CRUD operations, status updates).
    - **Status:** [NEEDS REFACTORING from agent_environment_service] (Logic to be adapted as part of 2.1.3 refactoring)
    - **Note 2.1.4.1 (Caveat):** Subject to the same caveats as 2.1.3 regarding outdated `database.types.ts` and temporary `any` casts if not yet resolved.
- [x] 2.1.5 Implement: Heartbeat mechanism from Droplet Tool Management Agent (DTMA) to Agentopia backend (updating `account_tool_environments.last_heartbeat_at` and `status`).
    - **Status:** [COMPLETED] - Supabase Edge Function `supabase/functions/heartbeat/index.ts` created. Payload needs to be updated to include `account_tool_environment_id` instead of `agent_droplet_id`, and DTMA needs to report status of multiple tool instances.
    - **Note 2.1.5.1:** Assumes `database.types.ts` will be made available in `supabase/functions/_shared/` for Edge Function use. DTMA will send `account_tool_environment_id` (obtained from its config) and a list of statuses for managed tool instances.
- [x] 2.1.6 Implement: Secure endpoint on Agentopia backend for DTMA to call for fetching tool secrets from Vault.
    - **Status:** [COMPLETED] - Supabase Edge Function `supabase/functions/fetch-tool-secrets/index.ts` created.
    - **Note 2.1.6.1 (Action Required):** Endpoint needs to expect `account_tool_instance_id` to fetch secrets for a specific tool instance. Logic for mapping `tool_catalog.required_secrets_schema` or `account_tool_instances.config_values_override` to Vault IDs needs to ensure it works per instance.
    - **Note 2.1.6.2:** Requires user review, env var setup, CORS, deployment, testing, and assumes `database.types.ts` availability in `_shared`.

### 2.2 Droplet Lifecycle Management
- [ ] 2.2.1 Implement: Logic to trigger Account Tool Environment (Droplet) provisioning when a user enables it for their account.
    - **Note:** This includes selecting Droplet image, region, size. Update `account_tool_environments` table.
    - [ ] 2.2.1.1 Design & Implement: Supabase Edge Function (e.g., `manage-account-tool-environment`) for frontend to call.
        - **Status:** [NEEDS REVISION from manage-agent-tool-environment]
        - **Note:** Adapt existing `manage-agent-tool-environment` Edge Function. It will operate on `user_id` (from JWT) or `account_id`.
        - [ ] 2.2.1.1.1 Define: API contract (e.g., POST /api/v1/tool-environment/manage - body contains `action: 'enable' | 'disable'`).
            - **Status:** [NEEDS REVISION]
        - [ ] 2.2.1.1.2 Implement: User authentication in Edge Function.
            - **Status:** [LARGELY COMPLETE, confirm user scope]
        - [ ] 2.2.1.1.3 Implement: Internal authenticated call from Edge Function to Node.js backend service that invokes `account_environment_service.ensureAccountToolEnvironmentReady` or `deprovisionAccountEnvironment`.
            - **Status:** [NEEDS REVISION]
    - [ ] 2.2.1.2 Implement: Internal Node.js backend endpoint (e.g., POST /internal/tool-environment/ensure) called by Edge Function.
        - **Status:** [NEEDS REVISION]
    - [ ] 2.2.1.3 Implement: Frontend UI on Account Settings Page or Dedicated "Tools" Page - "Activate My Tool Environment" toggle/button.
        - **Status:** [NEW TASK / SIGNIFICANT REVISION of previous agent-level UI]
        - [ ] 2.2.1.3.1 Design: UI for account-level tool environment activation and status display.
        - [ ] 2.2.1.3.2 Implement: State management for toggle/button, status display (fetching initial status from `account_tool_environments`).
        - [ ] 2.2.1.3.3 Implement: Frontend API client function (e.g., in `src/lib/api/accountToolEnvironments.ts`) to call the new Edge Function.
        - [ ] 2.2.1.3.4 Refine: UI logic for interaction, loading states, and comprehensive feedback.
- [x] 2.2.2 Implement: Account Droplet bootstrap/setup script (`user_data`).
    - **Status:** [LARGELY COMPLETE] (from `agent_environment_service/manager.ts` `createUserDataScript`)
    - **Note:** Script needs to ensure DTMA receives `account_tool_environment_id` (instead of `agent_droplet_id`) and is aware it's managing a shared environment. Logging and config paths might need slight adjustments if any. The core DTMA installation process should remain similar.
- [ ] 2.2.3 Implement: Logic to de-provision Account Tool Environment Droplet (e.g., when user deactivates it).
    - **Note:** Ensure DTMA attempts to gracefully stop all tool instances. Update `account_tool_environments` table.
    - [ ] 2.2.3.1 Design & Implement: Supabase Edge Function endpoint for de-provisioning (within `manage-account-tool-environment` function with `action: 'disable'`).
        - **Status:** [NEEDS REVISION]
        - [ ] 2.2.3.1.1 Define: API contract (Covered by 2.2.1.1.1).
        - [ ] 2.2.3.1.2 Implement: User authentication (Covered by 2.2.1.1.2).
        - [ ] 2.2.3.1.3 Implement: Internal call to backend service for `deprovisionAccountEnvironment` (Covered by 2.2.1.1.3).
    - [ ] 2.2.3.2 Implement: Internal Node.js backend endpoint for de-provisioning (Covered by 2.2.1.2).
    - [ ] 2.2.3.3 Implement: Frontend UI for deactivation (Covered by 2.2.1.3).
- [x] 2.2.4 Implement: Periodic status checks for active Account Tool Environments from Agentopia backend. Update `account_tool_environments.status`.
    - **Status:** [LARGELY COMPLETE] (Heartbeat mechanism will serve this purpose, backend logic might need to interpret DTMA heartbeats to update overall environment status).
- [ ] 2.2.5 Implement: Automated deployment verification tests for account-level environments.
    - **Status:** [NEEDS REVISION]
    - **Note:** Scripts like `check-environment.js` and `deploy-agent-droplet.js` need to be adapted for account-level provisioning and the new multi-instance model.

## Phase 2A: Tool Instance Management (Agentopia Backend)

- [ ] 2A.1 Design: Backend Service for Tool Instance Management (`tool_instance_service`).
    - **Note:** This service will handle creating, starting, stopping, and deleting tool instances on an account's shared droplet by communicating with the DTMA.
    - **Responsibilities:**
        - Validate requests against `tool_catalog` and `account_tool_environments`.
        - Interact with DTMA via a client (needs a DTMA client/API wrapper).
        - Manage CRUD operations for `account_tool_instances` table.
        - Manage CRUD operations for `agent_tool_instance_links` table.
    - **Files:** `manager.ts`, `types.ts`, `index.ts` (e.g., `src/services/tool_instance_service/`).
- [ ] 2A.2 Implement: `tool_instance_service` basic structure.
- [ ] 2A.3 Implement: Logic in `tool_instance_service` to request DTMA to start a new tool instance (e.g., an MCP server process).
    - **Note:** Includes telling DTMA which tool from catalog, version, any specific config overrides, and potentially suggested port or letting DTMA allocate port.
    - **Note:** DTMA will respond with actual port and other runtime details, which get stored in `account_tool_instances.runtime_details`.
- [ ] 2A.4 Implement: Logic in `tool_instance_service` to request DTMA to stop/remove a tool instance.
- [ ] 2A.5 Implement: Database interaction logic for `account_tool_instances` and `agent_tool_instance_links` within `tool_instance_service`.
- [ ] 2A.6 Design & Implement: Supabase Edge Function(s) for frontend to manage tool instances and agent links.
    - **Examples:** `POST /api/v1/tool-instances` (start new), `DELETE /api/v1/tool-instances/{instance_id}`, `POST /api/v1/agent-links` (link agent to instance), `DELETE /api/v1/agent-links/{link_id}`.
    - **Note:** These will call the internal `tool_instance_service`.
- [ ] 2A.7 Implement: Frontend UI for managing tool instances on the account droplet.
    - **Note:** Display list of available tools from catalog, allow starting new instances, show running instances with their status/ports.
    - **Note:** Allow configuring specific instances (if applicable).
- [ ] 2A.8 Implement: Frontend UI for linking agents to specific running tool instances.
    - **Note:** Likely on agent configuration page, select from available `account_tool_instances` for that user.