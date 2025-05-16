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
    - [X] 0.1.3. Document current functionalities and identify reusable components/logic.
        - **Notes:** Functionality for DO droplet CRUD exists and is somewhat abstracted in `digitalocean_service`. User-data script provides a template for DTMA setup. Polling logic for droplet status also exists in `agent_environment_service`.
        - **Reusable Components:** Core DO API call functions in `digitalocean_service`. Parts of the user-data script structure (e.g., package installation) might be adaptable. Polling logic structure.
        - **To Refactor Heavily:** Overall provisioning flow in `agent_environment_service` (to target `account_tool_environments`), user-data script content, DTMA interaction points.
        - **Decision/Outcome:** Documentation and identification complete as per notes.
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
    - [X] 0.4.1. Based on audit (0.2) and new requirements (Phase 3 of this WBS), create a specific refactoring plan for the DTMA.
        - **Notes:** Plan must address multi-tool management, agent-specific credential context, new API, and potential Dockerization of DTMA itself. Core Docker interaction via Dockerode is likely reusable.
        - **Decision/Outcome:** Phase 3 of this WBS document *constitutes* the specific refactoring plan for the DTMA. The principles noted above will guide its implementation.
    - [X] 0.4.2. Decide if `dtma/` and `dtma-agent/` will be merged or if one will be deprecated.
        - **Notes:** `dtma/` is primary source. `dtma-agent/` is a deployment clone from an external Git repo.
        - **Decision/Outcome:** The refactored DTMA will be developed in the `dtma/` project and deployed as a Docker image. Consequently, the `dtma-agent/` project and its Git repo cloning deployment method will be deprecated. This aligns with the strategy of Dockerizing the DTMA as indicated in WBS 2.1.2 and Phase 3.
- [ ] **0.5. Data Migration Strategy (if applicable)**
    - [X] 0.5.1. Analyze if any data from `agent_droplets` or `agent_droplet_tools` needs to be migrated to the new tables.
        - **Notes for `agent_droplets`:** Contains DO droplet info, status, `dtma_auth_token`. Migration to `account_tool_environments` is complex due to architectural shift (agent-specific to user-level, new DTMA).
        - **Notes for `agent_droplet_tools`:** Contains agent-specific tool configs and secret vault IDs. Migration to `agent_toolbelt_items` and `agent_tool_credentials` is feasible but requires careful mapping.
        - **Decision/Outcome:** A "fresh start" approach will be adopted. No data will be migrated from `agent_droplets` or `agent_droplet_tools` to the new tables (`account_tool_environments`, `agent_toolbelt_items`, etc.). This simplifies the transition given the significant architectural changes. Users will provision new "Toolboxes" and configure their tools within the new system. Old tables will be backed up and then archived/deprecated (see 1.2.0).
    - [X] 0.5.2. If so, plan the migration script steps.
        - **Notes:** To be detailed if migration path is chosen over a fresh start approach.
        - **Decision/Outcome:** Not applicable due to the "fresh start" approach decided in 0.5.1. No migration scripts will be developed for `agent_droplets` or `agent_droplet_tools` data.

## Phase 1: Foundational Design, Provider Setup & Core Database Schema

- [ ] **1.1. Finalize Cloud Provider Strategy**
    - [X] 1.1.1. Confirm DigitalOcean as primary for account-level droplets ("Toolboxes").
        - **Note:** Current codebase (`digitalocean_service`, `agent_environment_service`) already heavily utilizes DigitalOcean. This refactor assumes continuation with DO unless a new strategic decision is made.
    - [X] 1.1.2. Review API capabilities, rate limits, and security best practices for DigitalOcean.
        - **Note:** While an existing `digitalocean_service` implies prior review, a fresh check is needed for the new shared droplet model. Consider API token security, network policies for DTMA communication, and potential rate limits if many users provision/manage Toolboxes simultaneously. Document findings relevant to `digitalocean_service` (WBS 2.2) implementation.
        - **Action/Findings:** (Review Pending - to be completed before Phase 2.2 implementation)
            - **API Token Security:** Standard DO API tokens. Recommendation: Utilize least-privilege principles if granular token scopes are available and applicable for the operations performed by `digitalocean_service`. Secure storage via existing Vault mechanism for `DO_API_TOKEN_VAULT_ID` is appropriate.
            - **Network Policies:** Droplets should be provisioned with DigitalOcean Cloud Firewalls. Default policy: Deny all inbound except SSH (from trusted IPs if possible) and the specific port range required for DTMA's external API (if any, for backend communication) and potentially for inter-toolbox communication if planned. Outbound traffic should also be restricted if feasible.
            - **Rate Limits:** Consult current DO API documentation for rate limits on droplet creation, deletion, and status checks. Implement appropriate backoff/retry logic in `digitalocean_service` (as noted in WBS 2.2.2) to handle potential rate limiting gracefully, especially if anticipating bursts of provisioning activity.
            - **Security Best Practices:** Follow standard DO recommendations: SSH key authentication, regular OS patching on the base image for Toolboxes, consider VPC for private networking between Toolboxes and other internal services if applicable. User-data scripts should be carefully vetted for security.
            - **Relevance to `digitalocean_service` (2.2):** Findings will directly inform the error handling, security configurations (e.g., firewall rules applied post-provisioning if managed via API), and operational robustness of this service.
- [ ] **1.2. Database Schema Definition & Implementation (Supabase)**
    - [ ] 1.2.0. **Action:** Archive/Deprecate old tables (`agent_droplets`, `agent_droplet_tools`) once new schema is stable and data (if any) is migrated.
        - **Note:** Decision on data migration (0.5) will influence when this can be done. Old tables should be backed up before deprecation/deletion.
    - [X] 1.2.1. `account_tool_environments` (Toolboxes) - *Potentially refactor/evolve from existing `account_tool_environments` table if it matches closely after audit.*
        - **Note:** Audit found an existing `account_tool_environments` table (migration `20240730120000_create_account_tool_environments_table.sql`). This WBS definition (target fields: `id`, `user_id`, `name`, `description`, `do_droplet_id`, `public_ip_address`, `dtma_bearer_token`, `region_slug`, `size_slug`, `status` (ENUM), `last_heartbeat_from_dtma`, `dtma_last_known_version`, `dtma_health_details_json`, `created_at`, `updated_at`) is the target state.
        - **Decision/Plan:** The existing `public.account_tool_environments` table will be MODIFIED. A Supabase migration script (part of 1.2.8) will be created to:
            - Add new columns: `name` (TEXT, user-defined), `description` (TEXT, nullable), `dtma_bearer_token` (TEXT, nullable, for DTMA to auth with backend), `dtma_last_known_version` (TEXT, nullable), `dtma_health_details_json` (JSONB, nullable).
            - Rename existing column `ip_address` to `public_ip_address`.
            - Reconcile the `account_tool_environment_status_enum` values with WBS target: `pending_provision`, `provisioning`, `active`, `error_provisioning`, `pending_deprovision`, `deprovisioning`, `deprovisioned`, `error_deprovisioning`, `unresponsive`. Consider keeping `inactive` and `scaling` from existing enum.
            - Retain existing columns: `id`, `user_id`, `do_droplet_id`, `region_slug`, `size_slug`, `last_heartbeat_at` (maps to `last_heartbeat_from_dtma`), `created_at`, `updated_at`.
            - **Action Item:** Confirm necessity and retain/add `image_slug` (TEXT, for base OS image of the droplet) to WBS target fields if it was an oversight. It is likely still needed.
            - **Action Item:** Confirm necessity and retain/add `error_message` (TEXT, for environment-level errors like provisioning failures) to WBS target fields. This seems useful as distinct from `dtma_health_details_json`.
        - (Fields as per WBS v2.0)
    - [X] 1.2.2. `tool_catalog` (Admin-curated list of available "Tools") - *Likely new, but check if any similar concept existed.*
        - **Note:** While a `grep_search` did not find an explicit `CREATE TABLE` statement for `public.tool_catalog` in *.sql files, the existing `account_tool_environment_active_tools` table (from migration `20240730120000...`) has a foreign key to `public.tool_catalog(id)`. This implies the table is expected.
        - **Decision/Plan:** This table will be formally defined as per the fields specified in WBS v2.0 (referenced here). A Supabase migration script for its CREATION will be developed as part of WBS 1.2.8. If a pre-existing `tool_catalog` table is discovered later with a conflicting schema, this plan will be revised; otherwise, assume creation of a new table as per WBS v2.0 specs.
        - (Fields as per WBS v2.0)
    - [X] 1.2.3. `account_tool_instances` (Generic "Tool" instances on a "Toolbox")
        - **Note:** The existing table `public.account_tool_environment_active_tools` (from migration `20240730120000_create_account_tool_environments_table.sql`) serves a very similar purpose to the target `account_tool_instances`.
        - **Decision/Plan:** The existing `public.account_tool_environment_active_tools` table will be MODIFIED to become `public.account_tool_instances`. A Supabase migration script (part of 1.2.8) will be created to:
            - Rename the table from `account_tool_environment_active_tools` to `account_tool_instances`.
            - Add new columns:
                - `instance_name_on_toolbox` (TEXT, user-defined or auto-generated)
                - `port_mapping_json` (JSONB, e.g., `{"container_port": 8080, "host_port": 49152}`)
                - `last_heartbeat_from_dtma` (TIMESTAMPTZ, nullable, for this specific tool instance)
            - Modify existing columns:
                - Rename `status` to `status_on_toolbox` and reconcile its ENUM `account_tool_installation_status_enum` with the target WBS ENUM: `pending_deploy`, `deploying`, `running`, `stopped`, `error`, `pending_delete`, `deleting`. (The existing ENUM is more detailed; decide which states to keep/map).
                - Consolidate/Rename `version_to_install` and `actual_installed_version` into a single `version` (TEXT, taken from catalog at time of deploy, can be updated by DTMA).
                - Rename `config_values` (JSONB) to `base_config_override_json` (JSONB).
            - Retain existing columns: `id`, `account_tool_environment_id`, `tool_catalog_id`, `created_at`, `updated_at`.
            - **Action Item:** Decide on fate of existing columns `runtime_details` (JSONB), `error_message` (TEXT), and `enabled` (BOOLEAN). `error_message` for the instance is useful. `runtime_details` might be superseded by DTMA-level health or specific heartbeat data. `enabled` can likely be mapped to `status_on_toolbox` values (e.g., 'stopped').
        - [ ] `id` (PK, uuid)
    - [X] **NEW: 1.2.4. `agent_toolbox_access`** (Link agents to Toolboxes they can use)
        - **Decision/Plan:** This is a NEW table. A Supabase migration script for its CREATION will be developed as part of WBS 1.2.8, using the fields defined below.
        - [X] `id` (PK, uuid)
        - [X] `agent_id` (FK to `agents.id`)
        - [X] `account_tool_environment_id` (FK to `account_tool_environments.id`)
        - [X] `granted_at` (timestamp)
        - [X] Unique constraint on (`agent_id`, `account_tool_environment_id`)
    - [X] **NEW: 1.2.5. `agent_toolbelt_items`** (Specific tools an agent has in its "Toolbelt")
        - **Decision/Plan:** This is a NEW table. A Supabase migration script for its CREATION will be developed as part of WBS 1.2.8, using the fields defined below.
        - [X] `id` (PK, uuid)
        - [X] `agent_id` (FK to `agents.id`)
        - [X] `account_tool_instance_id` (FK to `account_tool_instances.id` - the generic instance on a Toolbox)
        - [X] `is_active_for_agent` (boolean, agent can toggle on/off without losing config)
        - [X] `created_at`, `updated_at`
        - [X] Unique constraint on (`agent_id`, `account_tool_instance_id`)
    - [X] **NEW: 1.2.6. `agent_tool_credentials`** (Stores agent-specific credentials for a tool in their Toolbelt)
        - **Decision/Plan:** This is a NEW table. A Supabase migration script for its CREATION will be developed as part of WBS 1.2.8, using the fields defined below.
        - [X] `id` (PK, uuid)
        - [X] `agent_toolbelt_item_id` (FK to `agent_toolbelt_items.id`)
        - [X] `credential_type` (e.g., 'oauth2', 'api_key', defined by `tool_catalog.required_secrets_schema`)
        - [X] `encrypted_credentials` (Stored in Supabase Vault, reference here or direct Vault link)
        - [X] `account_identifier` (e.g., masked email like `user@gm***.com`, for display)
        - [X] `last_validated_at` (timestamp, nullable)
        - [X] `status` (ENUM: `active`, `revoked`, `requires_reauth`, `error`)
        - [X] `created_at`, `updated_at`
    - [X] **NEW: 1.2.7. `agent_tool_capability_permissions`** (Granular permissions for an agent per tool in their Toolbelt)
        - **Decision/Plan:** This is a NEW table. A Supabase migration script for its CREATION will be developed as part of WBS 1.2.8, using the fields defined below.
        - [X] `id` (PK, uuid)
        - [X] `agent_toolbelt_item_id` (FK to `agent_toolbelt_items.id`)
        - [X] `capability_name` (string, e.g., "gmail_send", from `tool_catalog.required_capabilities_schema`)
        - [X] `is_allowed` (boolean)
        - [X] `created_at`, `updated_at`
        - [X] Unique constraint on (`agent_toolbelt_item_id`, `capability_name`)
    - [X] 1.2.8. Create Supabase migration script(s) for all new/modified tables, ENUMs, FKs, RLS policies, and indexes.
        - **Note:** Crucially, define appropriate Row Level Security (RLS) policies for all tables containing user_id or agent_id to ensure data isolation and security. E.g., users should only see their own `account_tool_environments`; agents (or users managing them) should only interact with relevant `agent_toolbelt_items`, etc.
        - **Implementation:** Created new migration file `supabase/migrations/20250512000000_refactor_tool_schema.sql` which includes:
            - Modification of `account_tool_environments` and `account_tool_installation_status_enum`, `account_tool_environment_status_enum`.
            - Renaming `account_tool_environment_active_tools` to `account_tool_instances` and modifying its structure.
            - Creation of new tables: `tool_catalog`, `agent_toolbox_access`, `agent_toolbelt_items`, `agent_tool_credentials` (with new ENUM `agent_tool_credential_status_enum`), `agent_tool_capability_permissions`.
            - Definition of PKs, FKs, indexes, comments, and RLS policies for all affected tables.
            - Application of `trigger_set_timestamp()` for `updated_at` columns.
    - [X] 1.2.9. Apply migration script and test.
        - **Action:** The migration script `supabase/migrations/20250512000000_refactor_tool_schema.sql` is ready.
        - **Instruction for Cloud Supabase:** Apply this script manually via the Supabase Studio SQL Editor. After application, thorough testing of the schema changes (tables, columns, ENUMs, RLS policies, triggers) is required.
        - **Status:** Pending manual application and testing by the user.
- [ ] **1.3. Security Design**
    - [X] 1.3.1. DTMA <-> Backend communication: Define/Refine authentication (`dtma_bearer_token` on `account_tool_environments`).
        - **Note:** Confirm `dtma_bearer_token` is securely generated during Toolbox provisioning (by `account_environment_service`), stored hashed or encrypted if direct DB access by DTMA is not used, or simply passed to DTMA at startup. Refactored DTMA must use this token for all calls to backend (e.g., `get-agent-tool-credentials`, `heartbeat`). The backend must validate this token against `account_tool_environments`.
        - **Refinement & Plan:**
            - **Token Generation:** `account_environment_service` (WBS 2.1.2) will generate a cryptographically strong unique random string for each new `account_tool_environment`.
            - **Token Storage:** Stored as plaintext in `account_tool_environments.dtma_bearer_token`. Access to this column/table is restricted by RLS (primarily service_role access).
            - **Token Delivery to DTMA:** Passed to DTMA at startup via user-data script (as env var or config file).
            - **DTMA Usage:** DTMA will send this token in the `Authorization: Bearer <token>` header for all backend API calls.
            - **Backend Validation:** Supabase Edge Functions (e.g., refactored `heartbeat`, `get-agent-tool-credentials`) will extract the Bearer token, query `account_tool_environments` for a match, and authenticate the DTMA if found. Reject otherwise.
            - **Action Item:** Add a UNIQUE constraint to the `dtma_bearer_token` column in the `account_tool_environments` table to ensure token uniqueness and allow efficient lookup. This will require a new database migration.
    - [X] 1.3.2. Agent -> Tool Instance communication: Design secure method for passing agent context to DTMA/Tool Instance for credential association.
        - **Note:** Detail the flow. Preferred approach: Agentopia backend (e.g., Supabase function called by agent/UI) authenticates the agent, then makes a secure, server-to-server call to the DTMA on the appropriate Toolbox. This call to DTMA must include `agent_id`, `account_tool_instance_id` (the generic tool instance on the Toolbox), and the actual tool payload/command. The DTMA uses this context to fetch agent-specific credentials via `get-agent-tool-credentials` and then invokes the target tool container with those credentials.
        - **Detailed Flow & Decision:**
            - **1. Agent Intention & Initial Call:** Agent/UI initiates a tool capability request (with `agent_id`, `account_tool_instance_id`, `capability_name`, `payload`) to a secure Agentopia backend endpoint (new Supabase Edge Function).
            - **2. Backend Auth & AuthZ:** Backend authenticates the agent, verifies `agent_id` has access to `account_tool_instance_id` (via `agent_toolbox_access`, `agent_toolbelt_items`), and permission for `capability_name` (via `agent_tool_capability_permissions`).
            - **3. Backend to DTMA Call (Server-to-Server):**
                - Backend retrieves Toolbox IP/port.
                - Backend calls DTMA's `/tools/{toolInstanceIdOnDroplet}/execute` endpoint (WBS 1.4.2).
                - **Payload to DTMA:** `{ agent_id, account_tool_instance_id, capability_name, payload }`.
                - **Authentication (Backend to DTMA):** The backend includes a dedicated system-level API key (e.g., `BACKEND_TO_DTMA_API_KEY`) in an `Authorization: Bearer <BACKEND_TO_DTMA_API_KEY>` header. This key is provisioned to all DTMAs at startup. The DTMA's auth middleware (WBS 3.1.2) validates this token. This is distinct from the `dtma_bearer_token` (which is for DTMA-to-Backend auth).
            - **4. DTMA Receives Call & Fetches Credentials:**
                - DTMA authenticates the backend using `BACKEND_TO_DTMA_API_KEY`.
                - DTMA calls backend's `get-agent-tool-credentials` function (WBS 2.3.2), authenticating itself with its own `dtma_bearer_token`. Request includes `{ agent_id, account_tool_instance_id }`.
                - Backend returns decrypted agent-specific credentials.
            - **5. DTMA Executes Tool with Credentials:**
                - DTMA injects credentials ephemerally into the target tool container (e.g., as env vars for this execution).
                - DTMA commands the tool container to execute the capability with the payload.
            - **6. Response & Cleanup:** Tool responds to DTMA, DTMA to backend, backend to agent/UI. DTMA ensures credential cleanup.
    - [X] 1.3.3. Secrets Management: Confirm Supabase Vault for `agent_tool_credentials`. Define precise flow for backend retrieving secrets and DTMA receiving/using them (as per `magic_toolbox_mcp.mdc` principles).
        - **Note:** Confirmed: Supabase Vault for `agent_tool_credentials.encrypted_credentials`. 
        - **Flow:**
            1. User connects account via UI (Agent Toolbelt Modal 5). 
            2. Backend (`toolbelt_service`) handles OAuth/key input, encrypts secret, stores in Vault, saves Vault ID to `agent_tool_credentials`.
            3. DTMA (on agent tool request) calls `get-agent-tool-credentials` backend function, passing its `dtma_bearer_token`, `agent_id`, and `account_tool_instance_id`.
            4. Backend validates DTMA, finds `agent_toolbelt_item` then `agent_tool_credentials`, gets Vault ID, calls Vault RPC `get_secret()`.
            5. Backend returns decrypted secret to DTMA.
            6. DTMA injects secret ephemerally into the tool container (e.g., env var for process scope). Secret must not persist on droplet filesystem outside of this. Tool instance must be designed to accept credentials this way.
- [X] **1.4. API Design (Refinement Pass)**
    - [X] 1.4.1. Sketch API endpoints for Agentopia Backend (Supabase Edge Functions) based on refactored services.
        - **Refined Endpoint List:**
        - **Key User-Facing Endpoints (prefix: `/api/v1` or similar):**
            - Toolbox Mgmt:
                - `POST /toolboxes`
                - `GET /toolboxes`
                - `GET /toolboxes/{toolboxId}`
                - `DELETE /toolboxes/{toolboxId}`
            - Generic Tools on Toolbox:
                - `POST /toolboxes/{toolboxId}/tools`
                - `GET /toolboxes/{toolboxId}/tools`
                - `DELETE /toolboxes/{toolboxId}/tools/{toolInstanceId}`
            - Agent Toolbelt:
                - `POST /agents/{agentId}/toolbelt/toolbox-access` (Link agent to Toolbox)
                - `DELETE /agents/{agentId}/toolbelt/toolbox-access/{toolboxAccessId}` (Unlink agent from Toolbox)
                - `GET /agents/{agentId}/toolbelt/toolbox-access` (List Toolboxes agent has access to)
                - `POST /agents/{agentId}/toolbelt/items` (Add a tool instance from an accessible Toolbox to agent's toolbelt)
                - `GET /agents/{agentId}/toolbelt/items` (List items in agent's toolbelt)
                - `DELETE /agents/{agentId}/toolbelt/items/{toolbeltItemId}` (Remove item from toolbelt)
            - Agent Credentials & Permissions:
                - `POST /agents/{agentId}/toolbelt/items/{toolbeltItemId}/credentials` (Add/Update credentials)
                - `GET /agents/{agentId}/toolbelt/items/{toolbeltItemId}/credentials` (Get credential status/identifiers)
                - `DELETE /agents/{agentId}/toolbelt/items/{toolbeltItemId}/credentials/{credentialId}` (Delete credential)
                - `POST /agents/{agentId}/toolbelt/items/{toolbeltItemId}/permissions` (Set capability permissions)
                - `GET /agents/{agentId}/toolbelt/items/{toolbeltItemId}/permissions` (Get capability permissions)
        - **DTMA-Facing Backend Endpoints:**
            - `POST /dtma/heartbeat` (Auth: `dtma_bearer_token`)
            - `POST /dtma/get-agent-tool-credentials` (Auth: `dtma_bearer_token`, Body: `{agentId, accountToolInstanceId}`)
        - **Agent-Facing Backend Endpoint (for initiating tool execution):**
            - `POST /agents/{agentId}/tools/{toolbeltItemId}/execute` (Auth: Agent JWT, Body: `{ capabilityName, payload }`)
    - [X] 1.4.2. Sketch API endpoints for the refactored DTMA.
        - **Refined DTMA API Endpoint List (DTMA hosts these, Agentopia backend calls them, Auth: `BACKEND_TO_DTMA_API_KEY`):**
            - **`POST /tools`**
                - **Purpose:** Deploy new tool instance.
                - **Body:** `{ dockerImageUrl: string, instanceNameOnToolbox: string, accountToolInstanceId: string, baseConfigOverrideJson?: object, requiredEnvVars?: string[] }`
            - **`DELETE /tools/{instanceNameOnToolbox}`**
                - **Purpose:** Remove/delete tool instance.
            - **`POST /tools/{instanceNameOnToolbox}/start`**
                - **Purpose:** Start a stopped tool instance.
            - **`POST /tools/{instanceNameOnToolbox}/stop`**
                - **Purpose:** Stop a running tool instance.
            - **`GET /status`**
                - **Purpose:** Get DTMA/Toolbox health and status of all managed tool instances.
                - **Response:** `{ dtmaVersion: string, systemMetrics: object, toolInstances: [{ accountToolInstanceId: string, instanceNameOnToolbox: string, status: string, metrics?: object }] }`
            - **`POST /tools/{instanceNameOnToolbox}/execute`**
                - **Purpose:** Execute a tool capability for an agent.
                - **Body:** `{ agentId: string, accountToolInstanceId: string, capabilityName: string, payload: object }`

## Phase 2: Droplet Provisioning & Management Service (Agentopia Backend)

- [X] **2.1. Service Implementation (`account_environment_service`)**
    - [X] 2.1.0. **Refactor/Develop:** Based on audit (0.1, 0.3), determine if this is a heavy refactor of existing service logic or a new build using some audited components.
        - **Note:** This will be a **heavy refactor** of the existing `agent_environment_service/manager.ts` logic. While the concept of orchestrating droplet provisioning is similar, it must be adapted to manage user-level `account_tool_environments` ("Toolboxes") instead of agent-specific `agent_droplets`. It will reuse the (to be refactored) `digitalocean_service` for DO API calls. User-data script generation will need to target the new, refactored DTMA. Core CUD operations on the new `account_tool_environments` table will be new.
    - [X] 2.1.1. CRUD for `account_tool_environments` ("Toolboxes").
        - **Note:** Implement functions within `account_environment_service` for:
            - Create: Insert new Toolbox record (called by provisioning logic 2.1.2) with initial status, user_id, name, config, generated `dtma_bearer_token`.
            - Read: Get Toolbox by ID, list Toolboxes for a user (respect RLS).
            - Update: For status changes, `droplet_id`, `public_ip_address`, DTMA status from heartbeat.
            - Delete: Soft delete (e.g., mark as `archived` or `pending_deprovision`). Actual DO droplet deletion in 2.1.3.
        - **Defined CRUD Functions (within `AccountEnvironmentService`):**
            - **`createToolboxEnvironment(userId, name, regionSlug, sizeSlug, imageSlug, dtmaBearerToken, initialStatus, description?)`**: Inserts new record. Returns `AccountToolEnvironmentRecord`.
            - **`getToolboxEnvironmentById(toolboxId)`**: Retrieves by ID. Returns `AccountToolEnvironmentRecord | null`.
            - **`getToolboxEnvironmentsByUserId(userId)`**: Retrieves all for a user. Returns `AccountToolEnvironmentRecord[]`.
            - **`updateToolboxEnvironment(toolboxId, updateData)`**: Updates specified fields. Returns updated `AccountToolEnvironmentRecord`.
            - **`markToolboxEnvironmentForDeprovision(toolboxId)`**: Sets status to `pending_deprovision` or similar. Returns updated `AccountToolEnvironmentRecord`.
    - [X] 2.1.2. Logic for provisioning a new DigitalOcean droplet (Toolbox).
        - [X] Securely generate `dtma_bearer_token`.
            - **Note:** Generate a unique, cryptographically strong token (e.g., `crypto.randomBytes(32).toString('hex')`) per Toolbox. This token is stored in `account_tool_environments.dtma_bearer_token` and passed to the DTMA via the user-data script.
            - **Decision:** Token will be generated by the main provisioning function within `AccountEnvironmentService` before creating the DB record.
        - [X] **Refactor/Create:** Initial DTMA deployment script/user-data for the *new* DTMA version.
            - **Note:** Major refactor of existing `createUserDataScript`. New script should:
                1. Assume base OS image has Docker, or install Docker reliably.
                2. Pull the *refactored DTMA Docker image* (URL from env var or config, this image is a build artifact of the refactored DTMA project from WBS Phase 3).
                3. Run the DTMA Docker container, passing `DTMA_BEARER_TOKEN` (from this provisioning step), `AGENTOPIA_API_BASE_URL`, and `BACKEND_TO_DTMA_API_KEY` as environment variables to the container.
                4. Ensure the DTMA container is configured with `restart=always`.
                5. Basic logging setup for user-data script execution.
            - **New `createToolboxUserDataScript` Design:**
                - **Inputs:** `dtmaBearerToken`, `agentopiaApiBaseUrl`, `backendToDtmaApiKey`, `dtmaDockerImageUrl`.
                - **Script Actions:** Log setup, ensure Docker, `docker pull`, `docker stop/rm dtma || true`, `docker run -d --name dtma --restart always` with env vars (`DTMA_BEARER_TOKEN`, `AGENTOPIA_API_BASE_URL`, `BACKEND_TO_DTMA_API_KEY`), Docker socket mount, logging drivers, and the `dtmaDockerImageUrl`.
        - **Note:** This task also includes polling for droplet active status (reusing pattern from old `provisionAgentDroplet` but using refactored `digitalocean_service.getDigitalOceanDroplet`) and updating the `account_tool_environments` record with `droplet_id`, `public_ip_address`, and status `active` on success.
        - **Overall Provisioning Logic (`provisionToolboxForUser` function):**
            - **Inputs:** `userId`, `name`, `regionSlug`, `sizeSlug`, `imageSlug`, `description?`.
            - **Steps:**
                1. Generate `dtmaBearerToken` (`crypto.randomBytes`).
                2. Call `createToolboxEnvironment` (from 2.1.1) with initial status `pending_provision`.
                3. Retrieve `AGENTOPIA_API_URL`, `BACKEND_TO_DTMA_API_KEY`, `DTMA_DOCKER_IMAGE_URL` from config.
                4. Call `createToolboxUserDataScript` (defined above).
                5. Construct droplet name (e.g., `toolbox-[userId]-[toolboxId]`) and tags.
                6. Update DB status to `provisioning`.
                7. Call `digitalocean_service.createDigitalOceanDroplet` with all options.
                8. Update DB with `do_droplet_id`.
                9. Poll `digitalocean_service.getDigitalOceanDroplet` for active status and IP.
                10. On success: Update DB with `public_ip_address` and status `awaiting_heartbeat`.
                11. On failure (creation or polling): Update DB status to `error_provisioning` with message.
            - **Returns:** Final `AccountToolEnvironmentRecord`.
    - [X] 2.1.3. Logic for de-provisioning a Toolbox.
        - **Note:** Refactor of existing `deprovisionAgentDroplet` from `agent_environment_service/manager.ts`. Takes `account_tool_environment_id`.
            1. Fetch `account_tool_environments` record.
            2. If `droplet_id` exists, call refactored `digitalocean_service.deleteDigitalOceanDroplet(dropletId)`.
            3. Handle errors, including if droplet already deleted on DO.
            4. Update `account_tool_environments` status to `deprovisioned` (or `deleted`), clear `droplet_id`, `public_ip_address`, `dtma_bearer_token`.
            5. Consider if DTMA needs pre-deletion notification/cleanup (likely not for current stateless Dockerized tools; assume direct DO deletion is sufficient for now).
        - **`deprovisionToolbox` Function Outline (within `AccountEnvironmentService`):**
            - **Inputs:** `toolboxId: string`, `userId?: string` (for optional ownership check).
            - **Returns:** `Promise<{ success: boolean; message?: string; finalStatus?: AccountToolEnvironmentStatusEnum }> `
            - **Steps:**
                1. Fetch `toolboxRecord` using `getToolboxEnvironmentById`.
                2. Handle not found or (optional) ownership mismatch.
                3. Check if already in a final deprovisioned state; if so, return success.
                4. Update DB status to `pending_deprovision` (or `deprovisioning`).
                5. If `do_droplet_id` exists:
                    - Call `digitalocean_service.deleteDigitalOceanDroplet(do_droplet_id)`.
                    - Handle `DigitalOceanResourceNotFoundError` (droplet already gone) gracefully.
                    - On other errors, update DB status to `error_deprovisioning` and return failure.
                6. Update DB: status to `deprovisioned`, clear `do_droplet_id`, `public_ip_address`, `dtma_bearer_token`, and other DTMA/heartbeat related fields.
                7. Return success.
    - [X] 2.1.4. Status update logic (polling or webhook from refactored DTMA).
        - **Note:** This primarily refers to how the `account_environment_service` (likely via the refactored `heartbeat` Supabase function - WBS 2.3.1) processes incoming heartbeats from the refactored DTMA. 
            1. `heartbeat` function authenticates DTMA via `dtma_bearer_token` (from `account_tool_environments`).
            2. Updates `account_tool_environments` with `last_heartbeat_at`, DTMA version, overall Toolbox health (e.g., disk/CPU from DTMA payload).
            3. DTMA heartbeat payload must now include status for all generic `account_tool_instances` it manages. The `heartbeat` function (or a subsequent process) updates `account_tool_instances.status_on_toolbox` and `runtime_details` for each.
            4. Consider an additional on-demand polling mechanism where backend can call DTMA's `/status` endpoint (WBS 1.4.2) if heartbeats are missed or for immediate checks by user UI.
        - **Plan for Status Update Logic:**
            - **`updateToolboxEnvironment` (from 2.1.1):** Already supports updating `last_heartbeat_at`, `dtma_last_known_version`, `dtma_health_details_json`, `status`.
            - **Status Transition Logic:**
                - `awaiting_heartbeat` -> `active`: Handled by `heartbeat` function (WBS 2.3.1) on first successful heartbeat.
                - `active` -> `unresponsive`: Handled by a separate monitoring mechanism/scheduled task (outside scope of this service's direct functions for now).
            - **New Function: `refreshToolboxStatusFromDtma(toolboxId: string)` (within `AccountEnvironmentService`):**
                - **Purpose:** On-demand refresh of Toolbox status by querying DTMA.
                - **Inputs:** `toolboxId: string`.
                - **Actions:** Get `toolboxRecord`; call DTMA's `GET /status` endpoint (using `BACKEND_TO_DTMA_API_KEY`); parse response; call `updateToolboxEnvironment` with updated health data. (Interaction with `tool_instance_service` for individual tool statuses from DTMA payload to be detailed in WBS 2A.1.4).
                - **Returns:** Updated `AccountToolEnvironmentRecord`.
    - [X] 2.1.5. (V2) Logic for resizing/upgrading a Toolbox. Status: `Planned (V2)`
        - **Note:** (V2 Feature) This would involve:
            1. `account_environment_service` calling a new function in `digitalocean_service` (e.g., `resizeDroplet(dropletId, newSizeSlug)`).
            2. Informing user of potential downtime (droplet reboot is typical for resize).
            3. Ensuring DTMA and tool containers (with `restart=always`) handle reboots gracefully.
            4. Clarifying if this includes disk resize (more complex, usually no shrink) or just CPU/RAM.
            5. Updating `account_tool_environments.size_slug` on success.
            6. UI elements to select new size and manage the process.
        - **High-Level Plan (V2 Feature):**
            - **Function:** `AccountEnvironmentService.resizeToolbox(toolboxId: string, newSizeSlug: string)`
            - **Assumed Scope for initial V2:** CPU/RAM resize (Disk resize is more complex and deferred further).
            - **Core Steps:**
                1. Pre-checks (Toolbox state, `newSizeSlug` validation).
                2. DB update: status to `resizing` (or `pending_resize`).
                3. Call a new `digitalocean_service.resizeDroplet(dropletId, newSizeSlug)` method (which handles DO API specifics like power off/on, resize action, wait).
                4. DB update on success: status to `active`/`awaiting_heartbeat`, update `size_slug`.
                5. DB update on failure: status to `error_resizing`.
            - **Open Questions for V2 Detailed Design:** Exact DO API for disk vs. CPU/RAM resize, rollback strategies, clear user communication.
- [X] **2.2. `digitalocean_service` Wrapper (Refactor/Consolidate)**
    - [X] 2.2.1. **Consolidate/Refactor:** Ensure all DO API interactions (create, delete, status, list sizes/regions) are centralized in this service, using audited code where possible.
        - **Note:** Audit (0.1.1) confirmed `src/services/digitalocean_service/` (with `droplets.ts`, `client.ts`) already exists and uses `dots-wrapper`. This task involved: 
            1. Making this service the *sole* interface for DO API calls for Toolbox operations.
            2. Reviewing and adapting existing functions (`createDigitalOceanDroplet`, `getDigitalOceanDroplet`, `deleteDigitalOceanDroplet`, `listDigitalOceanDropletsByTag`) for Toolbox requirements. Confirmed `CreateDropletServiceOptions` alignment.
            3. Adding the `resizeDigitalOceanDroplet(dropletId: number, newSizeSlug: string): Promise<Action>` function to `droplets.ts` for the V2 resize capability (WBS 2.1.5).
            4. Maintaining robust client initialization (`getDOClient` from `client.ts` using `DO_API_TOKEN_VAULT_ID`).
    - [X] 2.2.2. **Testing/Validation:** Outline how this centralized service will be unit/integration tested, especially the new resize function. (Focus on mocked DO calls).
        - **Note: Testing Outline:**
            - **Unit Testing:**
                - Mock `getDOClient` to return a mock `DotsApiClient`.
                - Mock `dots-wrapper` methods (`droplet.createDroplets`, `getDroplet`, etc.) using Jest (`jest.fn()`).
                - Test Cases for each function in `droplets.ts`: Success, API errors (simulated from `dots-wrapper`), unexpected API response formats.
                - Verify correct parameters are passed to `dots-wrapper` and responses are transformed correctly.
                - Throw custom `DigitalOceanServiceError` or `DigitalOceanResourceNotFoundError` as appropriate.
                - Test `callWithRetry` invocation and behavior (e.g., underlying API call fails then succeeds).
                - Specific focus on `resizeDigitalOceanDroplet`: test successful initiation, API errors, unexpected response formats.
            - **Integration Testing (Limited Scope):**
                - Avoid extensive live API tests in CI/CD due to cost/speed.
                - Consider contract testing (e.g., Pact) if feasible.
                - Primarily rely on manual/staging environment testing when features consuming this service are developed.
            - **Tooling:** Jest.
- [ ] **2.3. Backend Services Refactoring (Heartbeat, Secrets)**
    - [X] 2.3.1. **Refactor `heartbeat` function:**
        - **Note:** Based on audit (0.3.1). Path: `supabase/functions/heartbeat/index.ts`.
            1. Modified to authenticate DTMA using `dtma_bearer_token` against `account_tool_environments` table.
            2. Updated `account_tool_environments` with `last_heartbeat_at`, `dtma_last_known_version`, and `dtma_health_details_json` (from DTMA payload's `system_status`).
            3. Processed new DTMA heartbeat payload (`tool_statuses` array) to iterate and update corresponding `account_tool_instances` with `status_on_toolbox`, `runtime_details`, and `last_heartbeat_from_dtma`.
            4. If `account_tool_environments.status` was `provisioning` or `awaiting_heartbeat`, updated to `active` upon successful heartbeat.
            5. Implemented using `Promise.allSettled` for robust update of multiple `account_tool_instances`.
    - [X] 2.3.2. **Refactor `fetch-tool-secrets` function:**
        - **Note:** Based on audit (0.3.1 & 1.3.3). Path changed from `supabase/functions/fetch-tool-secrets/index.ts` to `supabase/functions/get-agent-tool-credentials/index.ts`.
            1. Renamed function directory and internal logging to `get-agent-tool-credentials`.
            2. DTMA authenticates with its `dtma_bearer_token` by querying `account_tool_environments`.
            3. DTMA request body changed to `{ agentId: string, accountToolInstanceId: string }`.
            4. Backend logic refactored:
                a. Validated DTMA token against `account_tool_environments.dtma_bearer_token`.
                b. Fetched `agent_toolbelt_item` linking `agentId` and `accountToolInstanceId`, including `tool_catalog.required_secrets_schema` via a join.
                c. Used `agent_toolbelt_item.id` to query active `agent_tool_credentials`.
                d. Retrieved encrypted secrets from Supabase Vault using Vault IDs from `agent_tool_credentials.encrypted_credentials`, mapping them based on `required_secrets_schema`.
                e. Returned decrypted secrets to DTMA, keyed by `env_var_name`.
            5. Addressed TypeScript linter errors for `any` and `unknown` types.

## Phase 2A: Tool Instance & Toolbelt Management (Agentopia Backend)

- [X] **2A.1. `tool_instance_service` (Backend)**
    - [X] 2A.1.1. CRUD operations for `account_tool_instances`.
    - [X] 2A.1.2. `deployToolToToolbox(userId, toolboxId, toolCatalogId, instanceName, configOverrides)`
    - [X] 2A.1.3. `removeToolFromToolbox(userId, toolInstanceId)`, `startToolOnToolbox(userId, toolInstanceId)`, `stopToolOnToolbox(userId, toolInstanceId)`
    - [ ] 2A.1.4. `refreshInstanceStatusFromDtma(toolInstanceId)` (Placeholder - depends on DTMA API)
- [X] **NEW: 2A.2. `toolbelt_service` (Manages agent-specific Toolbelts, credentials, permissions)** (Largely new service).
    - [X] 2A.2.1. CRUD for `agent_toolbelt_items`
        - [X] `ToolbeltService.addToolToAgentToolbelt(options)`
        - [X] `ToolbeltService.getAgentToolbeltItemById(id)`
        - [X] `ToolbeltService.getAgentToolbeltItems(agentId)`
        - [X] `ToolbeltService.updateAgentToolbeltItem(id, updates)`
        - [X] `ToolbeltService.removeToolFromAgentToolbelt(id)` (Noting `ON DELETE CASCADE` for related credentials/permissions)
    - [X] 2A.2.2. Logic for Agent Tool Credentials (`agent_tool_credentials`)
        - [X] `ToolbeltService.connectAgentToolCredential(options)`
        - [X] `ToolbeltService.getAgentToolCredentialsForToolbeltItem(agentToolbeltItemId)`
        - [X] `ToolbeltService.getAgentToolCredentialById(id)`
        - [X] `ToolbeltService.updateAgentToolCredentialStatus(id, status, newCredentialValue?)` (Now supports credential value updates using `create_vault_secret` and `delete_vault_secret` RPCs for full cleanup of old secrets)
        - [X] `ToolbeltService.removeAgentToolCredential(id)` (Now uses `delete_vault_secret` RPC for full Vault secret cleanup)
    - [X] 2A.2.3. Logic for Agent Tool Capability Permissions (`agent_tool_capability_permissions`)
        - [X] `ToolbeltService.setAgentToolCapabilityPermission(options)` (Upsert logic)
        - [X] `ToolbeltService.getAgentToolCapabilityPermissions(agentToolbeltItemId)`
        - [X] `ToolbeltService.checkAgentToolCapabilityPermission(agentToolbeltItemId, capabilityName)` (Convenience method)
    - [X] 2A.2.4. Logic to prepare and provide necessary context/credentials to an agent when it attempts to use a tool (via DTMA or direct to a Supabase function the agent calls).
        - **Note:** This service's role is to *manage the data* that the refactored `get-agent-tool-credentials` Supabase function (WBS 2.3.2) uses. The `get-agent-tool-credentials` function is the component that directly provides credentials to an authenticated DTMA for an agent's tool use.
- [X] **2A.3. API Endpoint Implementation (Agentopia Backend)**
    - [X] 2A.3.1. Implement User-Facing API Endpoints (Toolbox, Tool Instance, Toolbelt)
        - [X] `POST /users/me/toolboxes` (Calls `account_environment_service.provisionToolboxForUser`)
        - [X] `GET /users/me/toolboxes` (Calls `account_environment_service.getUserToolboxes` -> `getToolboxEnvironmentsByUserId`)
        - [X] `GET /users/me/toolboxes/{toolboxId}` (Calls `account_environment_service.getUserToolboxById` -> `getToolboxEnvironmentByIdForUser`)
        - [X] `DELETE /users/me/toolboxes/{toolboxId}` (Calls `account_environment_service.deprovisionToolbox`)
        - [X] `POST /users/me/toolboxes/{toolboxId}/refresh-status` (Calls `account_environment_service.refreshToolboxStatusFromDtma`)
        - [X] `POST /toolboxes/{toolboxId}/tools` (Calls `tool_instance_service.deployToolToToolbox`)
        - [X] `GET /toolboxes/{toolboxId}/tools` (Calls `tool_instance_service.getToolInstancesForToolbox`)
        - [X] `GET /toolboxes/{toolboxId}/tools/{toolInstanceId}` (Calls `tool_instance_service.getToolInstanceById`)
        - [X] `DELETE /toolboxes/{toolboxId}/tools/{toolInstanceId}` (Calls `tool_instance_service.removeToolFromToolbox`)
        - [X] `POST /toolboxes/{toolboxId}/tools/{toolInstanceId}/start` (Calls `tool_instance_service.startToolOnToolbox`)
        - [X] `POST /toolboxes/{toolboxId}/tools/{toolInstanceId}/stop` (Calls `tool_instance_service.stopToolOnToolbox`)
        - [X] `GET /agents/{agentId}/toolbelt/items` (Calls `toolbelt_service.getAgentToolbeltItems` via `agent-toolbelt` function)
        - [X] `POST /agents/{agentId}/toolbelt/items` (Calls `toolbelt_service.addToolToAgentToolbelt` via `agent-toolbelt` function)
        - [X] `DELETE /agents/{agentId}/toolbelt/items/{toolbeltItemId}` (Calls `toolbelt_service.removeToolFromAgentToolbelt` via `agent-toolbelt` function)
        - [X] `POST /agents/{agentId}/toolbelt/items/{toolbeltItemId}/credentials` (Calls `toolbelt_service.connectAgentToolCredential` via `agent-toolbelt` function)
        - [X] `GET /agents/{agentId}/toolbelt/items/{toolbeltItemId}/credentials` (Calls `toolbelt_service.getAgentToolCredentialsForToolbeltItem` via `agent-toolbelt` function)
        - [X] `DELETE /agents/{agentId}/toolbelt/items/{toolbeltItemId}/credentials/{credentialId}` (Calls `toolbelt_service.removeAgentToolCredential` via `agent-toolbelt` function)
        - [X] `POST /agents/{agentId}/toolbelt/items/{toolbeltItemId}/permissions` (Calls `toolbelt_service.setAgentToolCapabilityPermission` via `agent-toolbelt` function)
        - [X] `GET /agents/{agentId}/toolbelt/items/{toolbeltItemId}/permissions` (Calls `toolbelt_service.getAgentToolCapabilityPermissions` via `agent-toolbelt` function)
        - [X] `POST /agents/{agentId}/toolbelt/toolbox-access` (Manages `agent_toolbox_access` via `agent-toolbelt` function)
        - [X] `GET /agents/{agentId}/toolbelt/toolbox-access` (Manages `agent_toolbox_access` via `agent-toolbelt` function)
        - [X] `DELETE /agents/{agentId}/toolbelt/toolbox-access/{toolboxAccessId}` (Manages `agent_toolbox_access` via `agent-toolbelt` function)

## Phase 3: Droplet Tool Management Agent (DTMA) - Node.js App on Droplet (Major Refactor)

- [X] **3.0. Implement Refactoring Plan (from 0.4)**
    - [X] 3.0.1. Setup new/refactored project structure for the unified DTMA.
        - **Note:** Work will occur in the existing `dtma/` project (primary source). Clean up, update dependencies. Decision from 0.4.2 (Git clone vs. Docker image for DTMA deployment) will dictate if a `Dockerfile` is added here. This choice impacts user-data script (2.1.2) and DTMA update strategy (3.5).
        - **Actions Completed:** `.dockerignore` and `Dockerfile` created. `dist/` folder cleaned.
    - [X] 3.0.2. Migrate/integrate reusable code from existing `dtma/` and `dtma-agent/` projects.
        - **Note:** 
            - `docker_manager.ts`: Core Docker CRUD logic (pull, run, stop, rm via Dockerode) is reusable. Adapt to manage multiple named containers per `account_tool_instances` deployment, handle dynamic port mapping, and facilitate injection of agent-specific context/credentials into tool containers. **Action:** `executeInContainer` function added for credential injection per execution.
            - `auth_middleware.ts`: Concept of authenticating backend requests to DTMA is reusable. Adapt to use the `dtma_bearer_token` of the Toolbox this DTMA serves (passed at DTMA startup). **Action:** Refactored to use `BACKEND_TO_DTMA_API_KEY` from env var. Exported function renamed to `authenticateBackendRequest`.
            - `agentopia_api_client.ts`: Reusable for DTMA to call backend. Update to use new backend endpoints (e.g., refactored `/dtma/heartbeat`, `/dtma/get-agent-tool-credentials`). **Action:** Refactored to use `DTMA_BEARER_TOKEN` from env var for its own auth to backend, updated endpoints and payloads for `sendHeartbeat` and `getAgentToolCredentials`.
- [ ] **3.1. DTMA Core Application Refactor**
    - [X] 3.1.1. Refactor HTTP server to align with new API contract (1.4.2).
        - **Note:** Update Express app in `dtma/src/index.ts` and route handlers in `dtma/src/routes/` to implement the DTMA API endpoints defined in WBS 1.4.2 (e.g., `POST /tools` for deploy, `DELETE /tools/{id}`, `POST /tools/{id}/execute`, `GET /status`, etc.). Route handlers will call refactored `docker_manager.ts` and other logic.
        - **Actions Completed:** `dtma/src/index.ts` updated with `GET /status` endpoint and `managedInstances` map. `dtma/src/routes/tool_routes.ts` refactored with new API: `POST /tools`, `DELETE /tools/{instanceNameOnToolbox}`, `POST /tools/{instanceNameOnToolbox}/start`, `POST /tools/{instanceNameOnToolbox}/stop`, `POST /tools/{instanceNameOnToolbox}/execute`.
    - [X] 3.1.2. Implement authentication using `dtma_bearer_token` received at startup.
        - **Note:** Refactor `dtma/src/auth_middleware.ts`. The DTMA will receive its `dtma_bearer_token` (associated with the Toolbox it manages) at startup (e.g., as env var). This middleware must validate incoming Bearer tokens (from Agentopia backend requests) against this known token. **Correction:** This WBS item was mistyped. `auth_middleware.ts` uses `BACKEND_TO_DTMA_API_KEY` (system-to-system). The `dtma_bearer_token` is used by `agentopia_api_client.ts` for DTMA-to-Backend calls. Both are now sourced from env vars.
- [ ] **3.2. Tool Instance Lifecycle Management (Refactor for Multi-Tool & Agent Context)**
    - [X] 3.2.1. Logic to pull Docker image specified in `tool_catalog_id`. (Covered by `POST /tools` route using `pullImage`)
    - [X] 3.2.2. Logic to run Docker container with specified config, port mapping. (Covered by `POST /tools` route using `createAndStartContainer`)
        - [X] Securely receive and inject agent-specific credentials (from backend, for a specific agent's session/call) into the container's environment at runtime if needed, or ensure tool can fetch them. (Covered by `POST /tools/{instanceNameOnToolbox}/execute` route using `executeInContainer`)
    - [X] 3.2.3. Logic to stop, remove, restart Docker containers. (Covered by `/stop`, `/remove`, `/start` routes)
    - [ ] 3.2.4. Port allocation management on the droplet.
- [X] **3.3. Status Reporting & Heartbeat**
    - [X] 3.3.1. API endpoint for Agentopia backend to query DTMA/instance status. (Implemented as `GET /status` in `index.ts`)
    - [X] 3.3.2. Scheduled task to send heartbeat and basic droplet/instance metrics to Agentopia backend. (Implemented in `index.ts` `startHeartbeat`, using `getSystemStatus` and `getManagedToolInstanceStatuses`)
        - [X] Droplet metrics: CPU, memory, disk usage. (Covered by `getSystemStatus`)
        - [X] Per-instance metrics (if possible via Docker stats): CPU, memory usage. (Currently reports inspect data; direct stats is a TODO in `GET /status` and could be added to heartbeat)
- [X] **3.4. Secure Credential Handling (Agent-Specific)**
    - [X] 3.4.1. If DTMA brokers calls: Logic to receive an agent-identifying token/context. (Handled in `POST /execute` body)
    - [X] 3.4.2. Logic to request the specific agent's credentials for that tool from the Agentopia backend (short-lived). (Implemented in `POST /execute` via `getAgentToolCredentials`)
    - [X] 3.4.3. Mechanism to pass these credentials to the correct running tool instance for the scope of the agent's request. This is critical and complex. The tool instance itself must be designed to accept/use these per-request credentials. (Implemented in `POST /execute` via `executeInContainer` by passing credentials as env vars for the exec process)
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