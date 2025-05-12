# WBS Checklist: Agent Tool Infrastructure Refactor (Shared Account Droplets)

**Project:** Agentopia Agent Tool Infrastructure Enhancement
**Date Created:** (Original Date)
**Last Modified:** 05/11/2025 (AI Assistant - Gemini 2.5 Pro)
**Author:** (Original Author), AI Assistant
**Version:** 2.1 (Incorporates refactoring of existing DO & DTMA components)

## Phase 0: Audit & Detailed Refactoring Design

- [ ] **0.1. Audit Existing DigitalOcean Integration**
    - [X] 0.1.1. Locate all existing code responsible for DigitalOcean API interactions (droplet creation, deletion, status checks).
        - **Notes:** Found in `src/services/digitalocean_service/` (uses `dots-wrapper` SDK, functions: `createDigitalOceanDroplet`, `getDigitalOceanDroplet`, `deleteDigitalOceanDroplet`, `listDigitalOceanDropletsByTag`). Client initialized in `client.ts` using `DO_API_TOKEN_VAULT_ID`. `src/services/agent_environment_service/manager.ts` uses this service for provisioning.
        - **Action:** This code is highly relevant for refactoring into the new `digitalocean_service` (WBS 2.2).
    - [X] 0.1.2. Review existing deployment scripts (e.g., for user-data, initial setup) for `agent_droplets`.
        - **Notes:** Found `createUserDataScript` function in `src/services/agent_environment_service/manager.ts`. It's a bash script installing Docker, Node.js, and cloning/building/running the current DTMA from a Git repo (default `https://github.com/maverick-software/dtma-agent.git`). Configures DTMA with token and API URL.
        - **Action:** This script needs a major overhaul for the new shared "Toolbox" DTMA. DTMA source/setup may change (e.g., Docker image for DTMA itself). Configuration will be Toolbox-specific, not agent-specific at this stage.
    - [ ] 0.1.3. Document current functionalities and identify reusable components/logic.
        - **Notes:** Functionality for DO droplet CRUD exists and is somewhat abstracted in `digitalocean_service`. User-data script provides a template for DTMA setup. Polling logic for droplet status also exists in `agent_environment_service`.
        - **Reusable Components:** Core DO API call functions in `digitalocean_service`. Parts of the user-data script structure (e.g., package installation) might be adaptable. Polling logic structure.
        - **To Refactor Heavily:** Overall provisioning flow in `agent_environment_service` (to target `account_tool_environments`), user-data script content, DTMA interaction points.
- [X] **0.2. Audit Existing DTMA Codebase(s)**
    - [X] 0.2.1. Thoroughly review the `dtma/` and `dtma-agent/` projects (structure, core logic, dependencies).
        - **Notes:** Two projects found: `dtma/` (primary TypeScript source) and `dtma-agent/` (deployment clone from `github.com/maverick-software/dtma-agent.git`). `dtma/` is a Node.js project. Key files in `dtma/src/`: `index.ts` (Express app entry), `docker_manager.ts` (Dockerode usage), `auth_middleware.ts`, `agentopia_api_client.ts`, and a `routes/` dir. Dependencies: `express`, `dockerode`.
        - **Action:** Focus refactoring on `dtma/`. Determine if `dtma-agent/` and the Git repo workflow is still desired or if DTMA will be deployed differently (e.g., as a pre-built Docker image itself).
    - [X] 0.2.2. Understand its current capabilities (tool management for single agent, communication protocol with backend, credential handling).
        - **Notes:** Designed for single-agent-per-droplet model. Capabilities: Receives commands via Express HTTP API, manages Docker container lifecycles (via `docker_manager.ts`), communicates with Agentopia backend (via `agentopia_api_client.ts`) for heartbeats and likely secret fetching (related to `fetch-tool-secrets` Supabase function). Credential handling is implicit to the single agent.
        - **Action:** Core logic for Docker interaction is reusable. Needs major refactor for multi-tool management on a shared droplet and handling agent-specific credential contexts for these tools.
    - [X] 0.2.3. Document current DTMA API, startup scripts, and configuration.
        - **Notes:** API is Express-based HTTP, routes in `dtma/src/routes/`. Startup via `createUserDataScript` (cloud-init) which sets up a `systemd` service for `node dist/index.js`. Config from `/etc/dtma.conf` (`DTMA_AUTH_TOKEN`, `AGENTOPIA_API_BASE_URL`).
        - **Action:** API needs redesign for new functions (manage multiple tools, agent-contextual calls). Startup script needs to be adapted for the new refactored DTMA. Config mechanism might need to be more flexible if DTMA itself is Dockerized.
- [X] **0.3. Audit Existing Backend Services for Tool/Droplet Management**
    - [X] 0.3.1. Review Supabase functions `heartbeat/index.ts` and `fetch-tool-secrets/index.ts`.
        - **Notes for `heartbeat/index.ts`:**
            - Receives POST from DTMA with version/status. Authenticates DTMA via `agent_droplets.dtma_auth_token`. Updates `agent_droplets` (last_heartbeat, version, status, sets to 'active' if 'creating').
            - **Refactor Action:** Major. Adapt for `account_tool_environments` authentication and update. Handle heartbeat payload for multiple tools on one Toolbox.
        - **Notes for `fetch-tool-secrets/index.ts`:**
            - DTMA POSTs `tool_instance_db_id` (from `agent_droplet_tools`) to get its secrets. Authenticates DTMA. Fetches `agent_droplet_tools.config_values.secret_vault_ids` and `tool_catalog.required_secrets_schema`. Calls Vault RPC `get_secret`. Returns `{secrets: {"ENV_VAR": "value"}}`.
            - **Refactor Action:** Major. Rename (e.g., `get-agent-tool-credentials`). DTMA will request for specific `agent_id` + `account_tool_instance_id`. Logic to use `agent_toolbelt_items` and `agent_tool_credentials` to fetch secrets from Vault.
    - [X] 0.3.2. Identify any other backend logic related to `agent_droplets` or `agent_droplet_tools`.
        - **Notes:** `manage-agent-tool-environment/index.ts` (Supabase function) found. This is a user-facing proxy. It authenticates user, verifies agent ownership, then calls an internal Node.js service (`agent_environment_service` at `NODE_BACKEND_URL`) for actual provisioning/deprovisioning of `agent_droplets`.
        - **Refactor Action:** This proxy needs to be adapted for managing "Toolboxes" (`account_tool_environments`) at user-level, calling the refactored `account_environment_service`. Agent-specific access granting to Toolboxes will be a new flow.
    - [X] 0.3.3. Document current API contracts and data flows.
        - **Notes:**
            - `heartbeat`: DTMA (POST /heartbeat, Auth: Bearer) -> Supabase Fn -> DB.
            - `fetch-tool-secrets`: DTMA (POST /fetch-tool-secrets, Auth: Bearer, Body: {tool_instance_db_id}) -> Supabase Fn -> DB & Vault -> DTMA.
            - `manage-agent-tool-environment`: User Frontend (POST/DELETE /manage-agent-tool-environment/[agentId], Auth: User JWT) -> Supabase Fn -> Internal Node Service (`agent_environment_service`) -> `digitalocean_service` & DB.
        - **Action:** All these contracts and flows will change significantly due to the new architecture (Toolboxes, Toolbelts, agent-specific credentials). New API design is covered in WBS 1.4.
- [ ] **0.4. Detailed Refactoring Plan for DTMA**
    - [ ] 0.4.1. Based on audit (0.2) and new requirements (Phase 3 of this WBS), create a specific refactoring plan for the DTMA.
        - **Notes:** Plan must address multi-tool management, agent-specific credential context, new API, and potential Dockerization of DTMA itself. Core Docker interaction via Dockerode is likely reusable.
    - [ ] 0.4.2. Decide if `dtma/` and `dtma-agent/` will be merged or if one will be deprecated.
        - **Notes:** `dtma/` is primary source. `dtma-agent/` is a deployment clone from an external Git repo. If refactored DTMA is deployed as a Docker image from `tool_catalog` (recommended), the Git repo cloning method for deployment might become obsolete. Clarify deployment strategy for the new DTMA.
- [ ] **0.5. Data Migration Strategy (if applicable)**
    - [ ] 0.5.1. Analyze if any data from `agent_droplets` or `agent_droplet_tools` needs to be migrated to the new tables.
        - **Notes for `agent_droplets`:** Contains DO droplet info, status, `dtma_auth_token`. Migration to `account_tool_environments` is complex due to architectural shift (agent-specific to user-level, new DTMA). A "fresh start" for users provisioning new Toolboxes might be simpler than direct data migration. If migrating: map `agent_id` to `user_id`, transfer `dtma_auth_token`. 
        - **Notes for `agent_droplet_tools`:** Contains agent-specific tool configs and secret vault IDs. Migration to `agent_toolbelt_items` and `agent_tool_credentials` is feasible but requires careful mapping of tool instances and re-associating secrets. Granular permissions (`agent_tool_capability_permissions`) would need to be set (default or inferred).
    - [ ] 0.5.2. If so, plan the migration script steps.
        - **Notes:** To be detailed if migration path is chosen over a fresh start approach.

## Phase 1: Foundational Design, Provider Setup & Core Database Schema

- [ ] **1.1. Finalize Cloud Provider Strategy**
    - [X] 1.1.1. Confirm DigitalOcean as primary for account-level droplets ("Toolboxes").
        - **Note:** Current codebase (`digitalocean_service`, `agent_environment_service`) already heavily utilizes DigitalOcean. This refactor assumes continuation with DO unless a new strategic decision is made.
    - [ ] 1.1.2. Review API capabilities, rate limits, and security best practices for DigitalOcean.
        - **Note:** While an existing `digitalocean_service` implies prior review, a fresh check is needed for the new shared droplet model. Consider API token security, network policies for DTMA communication, and potential rate limits if many users provision/manage Toolboxes simultaneously. Document findings relevant to `digitalocean_service` (WBS 2.2) implementation.
- [ ] **1.2. Database Schema Definition & Implementation (Supabase)**
    - [ ] 1.2.0. **Action:** Archive/Deprecate old tables (`agent_droplets`, `agent_droplet_tools`) once new schema is stable and data (if any) is migrated.
        - **Note:** Decision on data migration (0.5) will influence when this can be done. Old tables should be backed up before deprecation/deletion.
    - [ ] 1.2.1. `account_tool_environments` (Toolboxes) - *Potentially refactor/evolve from existing `account_tool_environments` table if it matches closely after audit.*
        - **Note:** Audit found an existing `account_tool_environments` table (migration `20240730120000_create_account_tool_environments_table.sql`). This WBS definition should be considered the target state; reconcile fields and plan modification script if evolving the existing table. Otherwise, plan for new table and data migration/fresh start.
        - (Fields as per WBS v2.0)
    - [ ] 1.2.2. `tool_catalog` (Admin-curated list of available "Tools") - *Likely new, but check if any similar concept existed.*
        - (Fields as per WBS v2.0)
    - [ ] 1.2.3. `account_tool_instances` (Generic "Tool" instances on a "Toolbox")
        - [ ] `id` (PK, uuid)
        - [ ] `account_tool_environment_id` (FK to `account_tool_environments.id`)
        - [ ] `tool_catalog_id` (FK to `tool_catalog.id`)
        - [ ] `instance_name_on_toolbox` (User-defined or auto-generated, e.g., "My Zapier Instance 1")
        - [ ] `status_on_toolbox` (ENUM: `pending_deploy`, `deploying`, `running`, `stopped`, `error`, `pending_delete`, `deleting`)
        - [ ] `port_mapping_json` (e.g., `{"container_port": 8080, "host_port": 49152}`)
        - [ ] `last_heartbeat_from_dtma` (timestamp, nullable)
        - [ ] `version` (string, taken from catalog at time of deploy)
        - [ ] `base_config_override_json` (User overrides for non-credential config, if any)
        - [ ] `created_at`, `updated_at`
        - [ ] Indexes: `account_tool_environment_id`, `tool_catalog_id`.
    - [ ] **NEW: 1.2.4. `agent_toolbox_access`** (Link agents to Toolboxes they can use)
        - [ ] `id` (PK, uuid)
        - [ ] `agent_id` (FK to `agents.id`)
        - [ ] `account_tool_environment_id` (FK to `account_tool_environments.id`)
        - [ ] `granted_at` (timestamp)
        - [ ] Unique constraint on (`agent_id`, `account_tool_environment_id`)
    - [ ] **NEW: 1.2.5. `agent_toolbelt_items`** (Specific tools an agent has in its "Toolbelt")
        - [ ] `id` (PK, uuid)
        - [ ] `agent_id` (FK to `agents.id`)
        - [ ] `account_tool_instance_id` (FK to `account_tool_instances.id` - the generic instance on a Toolbox)
        - [ ] `is_active_for_agent` (boolean, agent can toggle on/off without losing config)
        - [ ] `created_at`, `updated_at`
        - [ ] Unique constraint on (`agent_id`, `account_tool_instance_id`)
    - [ ] **NEW: 1.2.6. `agent_tool_credentials`** (Stores agent-specific credentials for a tool in their Toolbelt)
        - [ ] `id` (PK, uuid)
        - [ ] `agent_toolbelt_item_id` (FK to `agent_toolbelt_items.id`)
        - [ ] `credential_type` (e.g., 'oauth2', 'api_key', defined by `tool_catalog.required_secrets_schema`)
        - [ ] `encrypted_credentials` (Stored in Supabase Vault, reference here or direct Vault link)
        - [ ] `account_identifier` (e.g., masked email like `user@gm***.com`, for display)
        - [ ] `last_validated_at` (timestamp, nullable)
        - [ ] `status` (ENUM: `active`, `revoked`, `requires_reauth`, `error`)
        - [ ] `created_at`, `updated_at`
    - [ ] **NEW: 1.2.7. `agent_tool_capability_permissions`** (Granular permissions for an agent per tool in their Toolbelt)
        - [ ] `id` (PK, uuid)
        - [ ] `agent_toolbelt_item_id` (FK to `agent_toolbelt_items.id`)
        - [ ] `capability_name` (string, e.g., "gmail_send", from `tool_catalog.required_capabilities_schema`)
        - [ ] `is_allowed` (boolean)
        - [ ] `created_at`, `updated_at`
        - [ ] Unique constraint on (`agent_toolbelt_item_id`, `capability_name`)
    - [ ] 1.2.8. Create Supabase migration script(s) for all new/modified tables, ENUMs, FKs, RLS policies, and indexes.
        - **Note:** Crucially, define appropriate Row Level Security (RLS) policies for all tables containing user_id or agent_id to ensure data isolation and security. E.g., users should only see their own `account_tool_environments`; agents (or users managing them) should only interact with relevant `agent_toolbelt_items`, etc.
    - [ ] 1.2.9. Apply migration script and test.
- [ ] **1.3. Security Design**
    - [ ] 1.3.1. DTMA <-> Backend communication: Define/Refine authentication (`dtma_bearer_token` on `account_tool_environments`).
        - **Note:** Confirm `dtma_bearer_token` is securely generated during Toolbox provisioning (by `account_environment_service`), stored hashed or encrypted if direct DB access by DTMA is not used, or simply passed to DTMA at startup. Refactored DTMA must use this token for all calls to backend (e.g., `get-agent-tool-credentials`, `heartbeat`). The backend must validate this token against `account_tool_environments`.
    - [ ] 1.3.2. Agent -> Tool Instance communication: Design secure method for passing agent context to DTMA/Tool Instance for credential association.
        - **Note:** Detail the flow. Preferred approach: Agentopia backend (e.g., Supabase function called by agent/UI) authenticates the agent, then makes a secure, server-to-server call to the DTMA on the appropriate Toolbox. This call to DTMA must include `agent_id`, `account_tool_instance_id` (the generic tool instance on the Toolbox), and the actual tool payload/command. The DTMA uses this context to fetch agent-specific credentials via `get-agent-tool-credentials` and then invokes the target tool container with those credentials.
    - [ ] 1.3.3. Secrets Management: Confirm Supabase Vault for `agent_tool_credentials`. Define precise flow for backend retrieving secrets and DTMA receiving/using them (as per `magic_toolbox_mcp.mdc` principles).
        - **Note:** Confirmed: Supabase Vault for `agent_tool_credentials.encrypted_credentials`. 
        - **Flow:** 
            1. User connects account via UI (Agent Toolbelt Modal 5). 
            2. Backend (`toolbelt_service`) handles OAuth/key input, encrypts secret, stores in Vault, saves Vault ID to `agent_tool_credentials`.
            3. DTMA (on agent tool request) calls `get-agent-tool-credentials` backend function, passing its `dtma_bearer_token`, `agent_id`, and `account_tool_instance_id`.
            4. Backend validates DTMA, finds `agent_toolbelt_item` then `agent_tool_credentials`, gets Vault ID, calls Vault RPC `get_secret()`.
            5. Backend returns decrypted secret to DTMA.
            6. DTMA injects secret ephemerally into the tool container (e.g., env var for process scope). Secret must not persist on droplet filesystem outside of this. Tool instance must be designed to accept credentials this way.
- [ ] **1.4. API Design (Refinement Pass)**
    - [ ] 1.4.1. Sketch API endpoints for Agentopia Backend (Supabase Edge Functions) based on refactored services.
        - **Note:** Key User-Facing Endpoints (prefix: `/api/v1` or similar):
            - Toolbox Mgmt: `POST /toolboxes`, `GET /toolboxes`, `GET /toolboxes/{id}`, `DELETE /toolboxes/{id}`.
            - Generic Tools on Toolbox: `POST /toolboxes/{id}/tools`, `GET /toolboxes/{id}/tools`, `DELETE /toolboxes/{id}/tools/{toolInstanceId}`.
            - Agent Toolbelt: `POST /agents/{id}/toolbelt/toolbox-access`, `POST /agents/{id}/toolbelt/items`, `GET /agents/{id}/toolbelt/items`, `DELETE /agents/{id}/toolbelt/items/{itemId}`.
            - Agent Credentials & Permissions: `POST /agents/{id}/toolbelt/items/{itemId}/credentials`, `GET /agents/{id}/toolbelt/items/{itemId}/credentials`, `POST /agents/{id}/toolbelt/items/{itemId}/permissions`.
        - **Note:** DTMA-Facing Backend Endpoints:
            - `POST /dtma/heartbeat` (auth: `dtma_bearer_token`).
            - `POST /dtma/get-agent-tool-credentials` (auth: `dtma_bearer_token`, body: `{agentId, accountToolInstanceId}`).
    - [ ] 1.4.2. Sketch API endpoints for the refactored DTMA.
        - **Note:** Backend-Facing DTMA Endpoints (DTMA hosts these, Agentopia backend calls them):
            - `POST /tools` (deploy generic tool from catalog, body: `{toolCatalogId, instanceName, baseConfig}`).
            - `DELETE /tools/{toolInstanceIdOnDroplet}` (remove generic tool).
            - `POST /tools/{toolInstanceIdOnDroplet}/start`.
            - `POST /tools/{toolInstanceIdOnDroplet}/stop`.
            - `GET /status` (Toolbox health, all managed tool statuses).
            - `POST /tools/{toolInstanceIdOnDroplet}/execute` (Execute tool capability for an agent. Body: `{agentId, capabilityName, payload}`). DTMA handles fetching credentials for this `agentId` + `toolInstanceIdOnDroplet` combo.

## Phase 2: Droplet Provisioning & Management Service (Agentopia Backend)

- [ ] **2.1. Service Implementation (`account_environment_service`)**
    - [ ] 2.1.0. **Refactor/Develop:** Based on audit (0.1, 0.3), determine if this is a heavy refactor of existing service logic or a new build using some audited components.
        - **Note:** This will be a **heavy refactor** of the existing `agent_environment_service/manager.ts` logic. While the concept of orchestrating droplet provisioning is similar, it must be adapted to manage user-level `account_tool_environments` ("Toolboxes") instead of agent-specific `agent_droplets`. It will reuse the (to be refactored) `digitalocean_service` for DO API calls. User-data script generation will need to target the new, refactored DTMA. Core CUD operations on the new `account_tool_environments` table will be new.
    - [ ] 2.1.1. CRUD for `account_tool_environments` ("Toolboxes").
        - **Note:** Implement functions within `account_environment_service` for: 
            - Create: Insert new Toolbox record (called by provisioning logic 2.1.2) with initial status, user_id, name, config, generated `dtma_bearer_token`.
            - Read: Get Toolbox by ID, list Toolboxes for a user (respect RLS).
            - Update: For status changes, `droplet_id`, `public_ip_address`, DTMA status from heartbeat.
            - Delete: Soft delete (e.g., mark as `archived` or `pending_deprovision`). Actual DO droplet deletion in 2.1.3.
    - [ ] 2.1.2. Logic for provisioning a new DigitalOcean droplet (Toolbox).
        - [ ] **Refactor/Integrate:** Use/adapt audited `digitalocean_service` or DO API interaction code.
            - **Note:** This involves calling the (to-be-refactored) `digitalocean_service.createDigitalOceanDroplet`. Parameters like name (e.g., `toolbox-[userId]-[timestamp]`), region, size, image (base OS with Docker), tags (e.g., `toolbox`, `user:[userId]`) will be for the shared Toolbox. The critical `user_data` parameter will be from the refactored script (see next point).
        - [ ] Securely generate `dtma_bearer_token`.
            - **Note:** Generate a unique, cryptographically strong token (e.g., `crypto.randomBytes`) per Toolbox. This token is stored in `account_tool_environments.dtma_bearer_token` and passed to the DTMA via the user-data script.
        - [ ] **Refactor/Create:** Initial DTMA deployment script/user-data for the *new* DTMA version.
            - **Note:** Major refactor of existing `createUserDataScript`. New script should:
                1. Assume base OS image has Docker, or install Docker reliably.
                2. Pull the *refactored DTMA Docker image* (URL from env var or config, this image is a build artifact of the refactored DTMA project from WBS Phase 3).
                3. Run the DTMA Docker container, passing `DTMA_BEARER_TOKEN` (from this provisioning step) and `AGENTOPIA_API_BASE_URL` as environment variables to the container.
                4. Ensure the DTMA container is configured with `restart=always`.
                5. Basic logging setup for user-data script execution.
        - **Note:** This task also includes polling for droplet active status (reusing pattern from old `provisionAgentDroplet` but using refactored `digitalocean_service.getDigitalOceanDroplet`) and updating the `account_tool_environments` record with `droplet_id`, `public_ip_address`, and status `active` on success.
    - [ ] 2.1.3. Logic for de-provisioning a Toolbox.
        - **Note:** Refactor of existing `deprovisionAgentDroplet` from `agent_environment_service/manager.ts`. Takes `account_tool_environment_id`. 
            1. Fetch `account_tool_environments` record.
            2. If `droplet_id` exists, call refactored `digitalocean_service.deleteDigitalOceanDroplet(dropletId)`.
            3. Handle errors, including if droplet already deleted on DO.
            4. Update `account_tool_environments` status to `deprovisioned` (or `deleted`), clear `droplet_id`, `public_ip_address`, `dtma_bearer_token`.
            5. Consider if DTMA needs pre-deletion notification/cleanup (likely not for current stateless Dockerized tools; assume direct DO deletion is sufficient for now).
    - [ ] 2.1.4. Status update logic (polling or webhook from refactored DTMA).
        - **Note:** This primarily refers to how the `account_environment_service` (likely via the refactored `heartbeat` Supabase function - WBS 2.3.1) processes incoming heartbeats from the refactored DTMA. 
            1. `heartbeat` function authenticates DTMA via `dtma_bearer_token` (from `account_tool_environments`).
            2. Updates `account_tool_environments` with `last_heartbeat_at`, DTMA version, overall Toolbox health (e.g., disk/CPU from DTMA payload).
            3. DTMA heartbeat payload must now include status for all generic `account_tool_instances` it manages. The `heartbeat` function (or a subsequent process) updates `account_tool_instances.status_on_toolbox` and `runtime_details` for each.
            4. Consider an additional on-demand polling mechanism where backend can call DTMA's `/status` endpoint (WBS 1.4.2) if heartbeats are missed or for immediate checks by user UI.
    - [ ] 2.1.5. (V2) Logic for resizing/upgrading a Toolbox.
        - **Note:** (V2 Feature) This would involve:
            1. `account_environment_service` calling a new function in `digitalocean_service` (e.g., `resizeDroplet(dropletId, newSizeSlug)`).
            2. Informing user of potential downtime (droplet reboot is typical for resize).
            3. Ensuring DTMA and tool containers (with `restart=always`) handle reboots gracefully.
            4. Clarifying if this includes disk resize (more complex, usually no shrink) or just CPU/RAM.
            5. Updating `account_tool_environments.size_slug` on success.
            6. UI elements to select new size and manage the process.
- [ ] **2.2. `digitalocean_service` Wrapper (Refactor/Consolidate)**
    - [ ] 2.2.1. **Consolidate/Refactor:** Ensure all DO API interactions (create, delete, status, list sizes/regions) are centralized in this service, using audited code where possible.
        - **Note:** Audit (0.1.1) confirmed `src/services/digitalocean_service/` (with `droplets.ts`, `client.ts`) already exists and uses `dots-wrapper`. This task involves: 
            1. Making this service the *sole* interface for DO API calls for Toolbox operations.
            2. Reviewing and adapting existing functions (`createDigitalOceanDroplet`, `getDigitalOceanDroplet`, `deleteDigitalOceanDroplet`, `listDigitalOceanDropletsByTag`) for Toolbox requirements. Ensure `CreateDropletServiceOptions` aligns.
            3. Adding any missing DO API wrapper functions if needed (e.g., general filtered list).
            4. Maintaining robust client initialization (`getDOClient` from `client.ts` using `DO_API_TOKEN_VAULT_ID`).
    - [ ] 2.2.2. Robust error handling and retry logic.
        - **Note:** Existing service uses a `callWithRetry` utility. Review and enhance this: 
            1. Ensure it handles common DO API errors (rate limits, temporary issues) appropriately.
            2. Consistent use of custom errors like `DigitalOceanServiceError`, `DigitalOceanResourceNotFoundError` for clarity.
- [ ] **2.3. Backend Services Refactoring (Heartbeat, Secrets)**
    - [ ] 2.3.1. **Refactor `heartbeat` function:**
        - **Note:** Based on audit (0.3.1). Path: `supabase/functions/heartbeat/index.ts`.
            1. Modify to authenticate DTMA using `dtma_bearer_token` against `account_tool_environments` table.
            2. Update `account_tool_environments` with `last_heartbeat_at`, `dtma_last_known_version`, and overall Toolbox health metrics (e.g., disk/CPU) received from DTMA payload.
            3. Process new DTMA heartbeat payload which should include status for all generic `account_tool_instances` it manages on the Toolbox. Iterate through these and update corresponding `account_tool_instances.status_on_toolbox` and `runtime_details`.
            4. If `account_tool_environments.status` was `provisioning`, update to `active` upon first successful heartbeat.
    - [ ] 2.3.2. **Refactor `fetch-tool-secrets` function:**
        - **Note:** Based on audit (0.3.1 & 1.3.3). Path: `supabase/functions/fetch-tool-secrets/index.ts`.
            1. Rename function to e.g., `get-agent-tool-credentials`.
            2. DTMA authenticates with its `dtma_bearer_token` (from `account_tool_environments`).
            3. DTMA request body: `{ agentId, accountToolInstanceId }` (where `accountToolInstanceId` is the ID of the generic tool on the Toolbox).
            4. Backend logic: 
                a. Validate DTMA token. 
                b. Find `agent_toolbelt_item` linking `agentId` and `accountToolInstanceId`.
                c. Use `agent_toolbelt_item.id` to query `agent_tool_credentials` for the agent's specific credential(s) for this tool.
                d. Retrieve encrypted secret(s) from Supabase Vault (using Vault IDs from `agent_tool_credentials`).
                e. Return decrypted secret(s) to DTMA, keyed by expected environment variable names (from `tool_catalog.required_secrets_schema` if helpful).

## Phase 2A: Tool Instance & Toolbelt Management (Agentopia Backend)

- [ ] **NEW: 2A.1. `tool_instance_service` (Manages generic `account_tool_instances` on a Toolbox)** (Largely new, may use some patterns from old `agent_droplet_tools` logic if any existed beyond DB).
    - [ ] 2A.1.1. CRUD for `account_tool_instances`.
        - **Note:** New service methods. Create (on add tool to Toolbox UI action), Read (list for Toolbox, get by ID), Update (status from DTMA, port maps), Delete (soft delete; actual removal via DTMA).
    - [ ] 2A.1.2. Logic to command DTMA to deploy a tool from `tool_catalog` onto a Toolbox.
        - **Note:** Service receives user request (e.g., via Supabase Fn proxy). Inputs: `account_tool_environment_id`, `tool_catalog_id`, `instance_name_on_toolbox`, `base_config_override_json`. Fetches Toolbox IP/DTMA endpoint. Fetches `tool_catalog.docker_image_url`. Calls DTMA's `POST /tools` endpoint with tool details. Updates `account_tool_instances` status to `deploying`.
    - [ ] 2A.1.3. Logic to command DTMA to remove/stop/start a generic tool instance on a Toolbox.
        - **Note:** Service receives user request. Calls DTMA endpoints: `DELETE /tools/{id}`, `POST /tools/{id}/start`, `POST /tools/{id}/stop`. Updates `account_tool_instances` status.
    - [ ] 2A.1.4. Handle status updates from DTMA (via heartbeat or direct reporting).
        - **Note:** Primarily handled by refactored `heartbeat` Supabase function (WBS 2.3.1) which updates `account_tool_instances` based on DTMA payload. This service might have utility functions to interpret/refresh status if needed, or act on reported errors.
- [ ] **NEW: 2A.2. `toolbelt_service` (Manages agent-specific Toolbelts, credentials, permissions)** (Largely new service).
    - [ ] 2A.2.1. CRUD for `agent_toolbox_access`.
        - **Note:** Manages agent grants to Toolboxes (UI Modal 4). Create (link agent to Toolbox), Read (list agent's Toolboxes), Delete (unlink).
    - [ ] 2A.2.2. CRUD for `agent_toolbelt_items`.
        - **Note:** Manages specific generic `account_tool_instances` added to an agent's Toolbelt (UI Modal 6 & Toolbelt card). Create (link agent to `account_tool_instance`), Read, Delete.
    - [ ] 2A.2.3. CRUD for `agent_tool_credentials` (integrating with Supabase Vault).
        - **Note:** Critical for agent-specific credentialing (UI Modal 5). 
            - Create/Update: Handles OAuth flows (setup redirect URI to a Supabase Fn/endpoint managed by this service), receives tokens/keys, encrypts, stores in Supabase Vault, creates/updates `agent_tool_credentials` with Vault ID, `agent_toolbelt_item_id`, type, identifier, status.
            - Read: For UI status display (not raw secrets).
            - Delete: Revoke OAuth, delete Vault secret, delete/mark `agent_tool_credentials` record.
        - [ ] Handle OAuth flows for connecting external accounts (e.g., Google) on behalf of an agent.
            - **Note:** This sub-task is the core of the credential connection. Requires backend endpoints to initiate OAuth and handle callbacks, then secure storage via Vault.
    - [ ] 2A.2.4. CRUD for `agent_tool_capability_permissions`.
        - **Note:** Manages enabled/disabled capabilities for a tool in an agent's Toolbelt (UI Modal 5).
    - [ ] 2A.2.5. Logic to prepare and provide necessary context/credentials to an agent when it attempts to use a tool (via DTMA or direct to a Supabase function the agent calls).
        - **Note:** This service's role is to *manage the data* that the refactored `get-agent-tool-credentials` Supabase function (WBS 2.3.2) uses. The `get-agent-tool-credentials` function is the component that directly provides credentials to an authenticated DTMA for an agent's tool use.

## Phase 3: Droplet Tool Management Agent (DTMA) - Node.js App on Droplet (Major Refactor)

- [ ] **3.0. Implement Refactoring Plan (from 0.4)**
    - [ ] 3.0.1. Setup new/refactored project structure for the unified DTMA.
        - **Note:** Work will occur in the existing `dtma/` project (primary source). Clean up, update dependencies. Decision from 0.4.2 (Git clone vs. Docker image for DTMA deployment) will dictate if a `Dockerfile` is added here. This choice impacts user-data script (2.1.2) and DTMA update strategy (3.5).
    - [ ] 3.0.2. Migrate/integrate reusable code from existing `dtma/` and `dtma-agent/` projects.
        - **Note:** 
            - `docker_manager.ts`: Core Docker CRUD logic (pull, run, stop, rm via Dockerode) is reusable. Adapt to manage multiple named containers per `account_tool_instances` deployment, handle dynamic port mapping, and facilitate injection of agent-specific context/credentials into tool containers.
            - `auth_middleware.ts`: Concept of authenticating backend requests to DTMA is reusable. Adapt to use the `dtma_bearer_token` of the Toolbox this DTMA serves (passed at DTMA startup).
            - `agentopia_api_client.ts`: Reusable for DTMA to call backend. Update to use new backend endpoints (e.g., refactored `/dtma/heartbeat`, `/dtma/get-agent-tool-credentials`).
- [ ] **3.1. DTMA Core Application Refactor**
    - [ ] 3.1.1. Refactor HTTP server to align with new API contract (1.4.2).
        - **Note:** Update Express app in `dtma/src/index.ts` and route handlers in `dtma/src/routes/` to implement the DTMA API endpoints defined in WBS 1.4.2 (e.g., `POST /tools` for deploy, `DELETE /tools/{id}`, `POST /tools/{id}/execute`, `GET /status`, etc.). Route handlers will call refactored `docker_manager.ts` and other logic.
    - [ ] 3.1.2. Implement authentication using `dtma_bearer_token` received at startup.
        - **Note:** Refactor `dtma/src/auth_middleware.ts`. The DTMA will receive its `dtma_bearer_token` (associated with the Toolbox it manages) at startup (e.g., as env var). This middleware must validate incoming Bearer tokens (from Agentopia backend requests) against this known token.
- [ ] **3.2. Tool Instance Lifecycle Management (Refactor for Multi-Tool & Agent Context)**
    - [ ] 3.2.1. Logic to pull Docker image specified in `tool_catalog_id`.
    - [ ] 3.2.2. Logic to run Docker container with specified config, port mapping.
        - [ ] Securely receive and inject agent-specific credentials (from backend, for a specific agent's session/call) into the container's environment at runtime if needed, or ensure tool can fetch them.
    - [ ] 3.2.3. Logic to stop, remove, restart Docker containers.
    - [ ] 3.2.4. Port allocation management on the droplet.
- [ ] **3.3. Status Reporting & Heartbeat**
    - [ ] 3.3.1. API endpoint for Agentopia backend to query DTMA/instance status.
    - [ ] 3.3.2. Scheduled task to send heartbeat and basic droplet/instance metrics to Agentopia backend.
        - [ ] Droplet metrics: CPU, memory, disk usage.
        - [ ] Per-instance metrics (if possible via Docker stats): CPU, memory usage.
- [ ] **3.4. Secure Credential Handling (Agent-Specific)**
    - [ ] 3.4.1. If DTMA brokers calls: Logic to receive an agent-identifying token/context.
    - [ ] 3.4.2. Logic to request the specific agent's credentials for that tool from the Agentopia backend (short-lived).
    - [ ] 3.4.3. Mechanism to pass these credentials to the correct running tool instance for the scope of the agent's request. This is critical and complex. The tool instance itself must be designed to accept/use these per-request credentials.
- [ ] **3.5. Initial Deployment & Update Strategy for DTMA itself.**

## Phase 4: Frontend UI Refactoring & Enhancements (Agentopia Web App)
    - (Tasks remain as per `docs/plans/mcp/Tool_Page_UI_Workflow/wbs_checklist.md` v1.1, which already details the new UI. This phase focuses on connecting that UI to the refactored backend.)
    - [ ] 4.1. Integrate UI components with **refactored and new** backend services (Phase 2, 2A, 2.3).

## Phase 5: Agent Interaction with Tools (Core Agent Logic Refactor)

- [ ] **5.1. Agent's Tool Usage Workflow**
    - [ ] 5.1.1. When an agent needs to use a tool:
        - [ ] Agent (or Agentopia backend on its behalf) identifies the target tool from its Toolbelt.
        - [ ] Request is routed to the appropriate `account_tool_instance` on the correct `account_tool_environment` (Toolbox).
        - [ ] **Crucial:** Agent-specific context (identifying the agent and thus its credentials for that tool) must be securely passed with the request to the DTMA/Tool instance.
    - [ ] 5.1.2. The target MCP server (Tool instance) uses the provided agent-specific credentials to perform the action.
- [ ] **5.2. Update Agent Core Logic**
    - [ ] Modify agent's internal "tool selection" and "tool execution" logic to use the new Toolbelt structure.
    - [ ] Ensure agents can only access tools and capabilities permitted in their `agent_tool_capability_permissions`.

## Phase 6: Monitoring, Scaling, Advanced Features (V2+)

- [ ] **6.1. Admin UI for `tool_catalog` management.**
- [ ] **6.2. Advanced Monitoring Dashboard** (for users to see Toolbox/Tool health).
- [ ] **6.3. Auto-scaling/Notification for Toolbox resource limits.**
- [ ] **6.4. Centralized logging for DTMA and Tool Instances.**

## Phase 7: Testing & QA

- [ ] **7.1. Unit tests for backend services and DTMA modules.**
- [ ] **7.2. Integration tests for: Backend <-> DTMA, Agent <-> Tool Instance.**
- [ ] **7.3. End-to-end UI testing for all user workflows.**
- [ ] **7.4. Security audit (especially credential handling).**
- [ ] **7.5. Performance and load testing.**

## Phase 8: Deployment & Documentation

- [ ] **8.1. Deployment scripts/CI-CD updates.**
- [ ] **8.2. Update all relevant developer documentation.**
- [ ] **8.3. Update user-facing documentation.**
---
*(Original content of the WBS prior to this version should be reviewed to ensure no critical, still-relevant tasks were inadvertently removed if this version replaces it entirely. This version attempts to be comprehensive for the new model.)*