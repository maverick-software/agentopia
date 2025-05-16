# WBS Checklist: Agent Tool Infrastructure Refactor (Shared Account Droplets)

**Project:** Agentopia Agent Tool Infrastructure Enhancement
**Date Created:** (Original Date)
**Last Modified:** 05/11/2025 (AI Assistant - Gemini 2.5 Pro)
**Author:** (Original Author), AI Assistant
**Version:** 2.1 (Incorporates refactoring of existing DO & DTMA components)

## Phase 0: Audit & Detailed Refactoring Design

- [ ] **0.1. Audit Existing DigitalOcean Integration**
    - [ ] 0.1.1. Locate all existing code responsible for DigitalOcean API interactions (droplet creation, deletion, status checks).
    - [ ] 0.1.2. Review existing deployment scripts (e.g., for user-data, initial setup) for `agent_droplets`.
    - [ ] 0.1.3. Document current functionalities and identify reusable components/logic.
- [ ] **0.2. Audit Existing DTMA Codebase(s)**
    - [ ] 0.2.1. Thoroughly review the `dtma/` and `dtma-agent/` projects (structure, core logic, dependencies).
    - [ ] 0.2.2. Understand its current capabilities (tool management for single agent, communication protocol with backend, credential handling).
    - [ ] 0.2.3. Document current DTMA API, startup scripts, and configuration.
- [ ] **0.3. Audit Existing Backend Services for Tool/Droplet Management**
    - [ ] 0.3.1. Review Supabase functions `heartbeat/index.ts` and `fetch-tool-secrets/index.ts`.
    - [ ] 0.3.2. Identify any other backend logic related to `agent_droplets` or `agent_droplet_tools`.
    - [ ] 0.3.3. Document current API contracts and data flows.
- [ ] **0.4. Detailed Refactoring Plan for DTMA**
    - [ ] 0.4.1. Based on audit (0.2) and new requirements (Phase 3 of this WBS), create a specific refactoring plan for the DTMA.
    - [ ] 0.4.2. Decide if `dtma/` and `dtma-agent/` will be merged or if one will be deprecated.
- [ ] **0.5. Data Migration Strategy (if applicable)**
    - [ ] 0.5.1. Analyze if any data from `agent_droplets` or `agent_droplet_tools` needs to be migrated to the new tables.
    - [ ] 0.5.2. If so, plan the migration script steps.

## Phase 1: Foundational Design, Provider Setup & Core Database Schema

- [ ] **1.1. Finalize Cloud Provider Strategy**
    - [ ] 1.1.1. Confirm DigitalOcean as primary for account-level droplets ("Toolboxes").
    - [ ] 1.1.2. Review API capabilities, rate limits, and security best practices for DigitalOcean.
- [ ] **1.2. Database Schema Definition & Implementation (Supabase)**
    - [ ] 1.2.0. **Action:** Archive/Deprecate old tables (`agent_droplets`, `agent_droplet_tools`) once new schema is stable and data (if any) is migrated.
    - [ ] 1.2.1. `account_tool_environments` (Toolboxes)
        - [ ] `id` (PK, uuid)
        - [ ] `user_id` (FK to `users.id`)
        - [ ] `droplet_id` (DigitalOcean droplet ID, nullable if provisioning)
        - [ ] `name` (User-defined name for the Toolbox, e.g., "My Main Toolbox")
        - [ ] `region` (DigitalOcean region)
        - [ ] `size_slug` (DigitalOcean droplet size)
        - [ ] `status` (ENUM: `pending_provision`, `provisioning`, `active`, `error`, `pending_deprovision`, `deprovisioning`, `archived`)
        - [ ] `dtma_bearer_token` (Securely stored, for DTMA to authenticate with backend)
        - [ ] `public_ip_address` (nullable)
        - [ ] `created_at`, `updated_at`
        - [ ] Indexes: `user_id`, `status`.
    - [ ] 1.2.2. `tool_catalog` (Admin-curated list of available "Tools")
        - [ ] `id` (PK, uuid)
        - [ ] `name` (e.g., "Zapier Connection", "Gmail Reader/Sender")
        - [ ] `description` (text)
        - [ ] `docker_image_url` (Path to the Docker image, e.g., in GHCR or Docker Hub)
        - [ ] `default_config_json_schema` (JSON schema for basic configuration, if any, non-credential related)
        - [ ] `required_capabilities_schema` (JSON schema defining capabilities the tool offers, e.g., `{"gmail_send": "Send Email", "gmail_read": "Read Email"}`)
        - [ ] `required_secrets_schema` (JSON schema defining what kind of secrets this tool needs at the *agent* level, e.g., OAuth for Gmail)
        - [ ] `version` (string)
        - [ ] `is_enabled` (boolean, for admin to toggle availability)
        - [ ] `created_at`, `updated_at`
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
    - [ ] 1.2.9. Apply migration script and test.
- [ ] **1.3. Security Design**
    - [ ] 1.3.1. DTMA <-> Backend communication: Define/Refine authentication (`dtma_bearer_token` on `account_tool_environments`).
    - [ ] 1.3.2. Agent -> Tool Instance communication: Design secure method for passing agent context to DTMA/Tool Instance for credential association.
    - [ ] 1.3.3. Secrets Management: Confirm Supabase Vault for `agent_tool_credentials`. Define precise flow for backend retrieving secrets and DTMA receiving/using them (as per `magic_toolbox_mcp.mdc` principles).
- [ ] **1.4. API Design (Refinement Pass)**
    - [ ] 1.4.1. Refine/Define API endpoints for Agentopia Backend (Supabase Edge Functions) based on refactored services.
    - [ ] 1.4.2. Refine/Define API endpoints for the refactored DTMA.

## Phase 2: Droplet Provisioning & Management Service (Agentopia Backend)

- [ ] **2.1. Service Implementation (`account_environment_service`)**
    - [ ] 2.1.0. **Refactor/Develop:** Based on audit (0.1, 0.3), determine if this is a heavy refactor of existing service logic or a new build using some audited components.
    - [ ] 2.1.1. CRUD for `account_tool_environments` ("Toolboxes").
    - [ ] 2.1.2. Logic for provisioning a new DigitalOcean droplet (Toolbox).
        - [ ] **Refactor/Integrate:** Use/adapt audited `digitalocean_service` or DO API interaction code.
        - [ ] Securely generate `dtma_bearer_token`.
        - [ ] **Refactor/Create:** Initial DTMA deployment script/user-data for the *new* DTMA version.
    - [ ] 2.1.3. Logic for de-provisioning a Toolbox.
    - [ ] 2.1.4. Status update logic (polling or webhook from refactored DTMA).
    - [ ] 2.1.5. (V2) Logic for resizing/upgrading a Toolbox.
- [ ] **2.2. `digitalocean_service` Wrapper (Refactor/Consolidate)**
    - [ ] 2.2.1. **Consolidate/Refactor:** Ensure all DO API interactions (create, delete, status, list sizes/regions) are centralized in this service, using audited code where possible.
    - [ ] 2.2.2. Robust error handling and retry logic.
- [ ] **2.3. Backend Services Refactoring (Heartbeat, Secrets)**
    - [ ] 2.3.1. **Refactor `heartbeat` function:**
        - [ ] Authenticate DTMA based on `account_tool_environments.dtma_bearer_token`.
        - [ ] Update status for `account_tool_environments` and potentially `account_tool_instances` based on payload from new DTMA.
    - [ ] 2.3.2. **Refactor `fetch-tool-secrets` function:**
        - [ ] Rename to e.g., `get-agent-tool-credentials`.
        - [ ] DTMA requests credentials for a *specific agent* attempting to use a *specific tool instance* in their Toolbelt.
        - [ ] Backend authenticates DTMA.
        - [ ] Backend verifies agent's permission (`agent_toolbelt_items`, `agent_tool_capability_permissions`).
        - [ ] Backend retrieves encrypted credentials from `agent_tool_credentials` (via Supabase Vault) and returns them (or a short-lived access token for them).

## Phase 2A: Tool Instance & Toolbelt Management (Agentopia Backend)

- [ ] **NEW: 2A.1. `tool_instance_service` (Manages generic `account_tool_instances` on a Toolbox)** (Largely new, may use some patterns from old `agent_droplet_tools` logic if any existed beyond DB).
    - (Tasks as per WBS v2.0)
- [ ] **NEW: 2A.2. `toolbelt_service` (Manages agent-specific Toolbelts, credentials, permissions)** (Largely new service).
    - (Tasks as per WBS v2.0, with emphasis on integrating with Supabase Vault for `agent_tool_credentials`)

## Phase 3: Droplet Tool Management Agent (DTMA) - Node.js App on Droplet (Major Refactor)

- [ ] **3.0. Implement Refactoring Plan (from 0.4)**
    - [ ] 3.0.1. Setup new/refactored project structure for the unified DTMA.
    - [ ] 3.0.2. Migrate/integrate reusable code from existing `dtma/` and `dtma-agent/` projects.
- [ ] **3.1. DTMA Core Application Refactor**
    - [ ] 3.1.1. Refactor HTTP server to align with new API contract (1.4.2).
    - [ ] 3.1.2. Implement authentication using `dtma_bearer_token` received at startup.
- [ ] **3.2. Tool Instance Lifecycle Management (Refactor for Multi-Tool & Agent Context)**
    - [ ] 3.2.1. Refactor Docker image pulling logic (from `tool_catalog.docker_image_url`).
    - [ ] 3.2.2. Refactor Docker container run logic:
        - [ ] Manage multiple, distinct tool instances on the same droplet.
        - [ ] Port allocation for multiple instances.
        - [ ] Mechanism to receive agent-specific context (e.g., agent ID, requested capability) with execution requests.
    - [ ] 3.2.3. Refactor Docker container stop, remove, restart logic for multiple instances.
- [ ] **3.3. Status Reporting & Heartbeat (Refactor)**
    - [ ] 3.3.1. Refactor API endpoint for Agentopia backend to query overall DTMA status and status of individual `account_tool_instances` it manages.
    - [ ] 3.3.2. Refactor heartbeat payload to include status of all managed tool instances and overall droplet health.
- [ ] **3.4. Secure Credential Handling (Implement for Agent-Specific Credentials)**
    - [ ] 3.4.1. Implement logic to receive agent context with tool execution requests.
    - [ ] 3.4.2. Implement secure call to the refactored backend service (e.g., `get-agent-tool-credentials`) to fetch credentials for the specific agent and tool.
    - [ ] 3.4.3. Securely inject/provide these credentials to the target Dockerized tool instance *only for the scope of the requesting agent's operation*. The tool instance must be designed to accept these.
    - [ ] 3.4.4. Ensure credentials are not persisted insecurely on the DTMA or droplet long-term.
- [ ] **3.5. Initial Deployment & Update Strategy for the *Refactored* DTMA.**

## Phase 4: Frontend UI Refactoring & Enhancements (Agentopia Web App)
    - (Tasks remain as per `docs/plans/mcp/Tool_Page_UI_Workflow/wbs_checklist.md` v1.1, which already details the new UI. This phase focuses on connecting that UI to the refactored backend.)
    - [ ] 4.1. Integrate UI components with **refactored and new** backend services (Phase 2, 2A, 2.3).

## Phase 5: Agent Interaction with Tools (Core Agent Logic Refactor)
    - (Tasks as per WBS v2.0, but emphasizing refactor of any existing tool interaction logic)

## Phase 6: Monitoring, Scaling, Advanced Features (V2+)
    - (Tasks as per WBS v2.0)

## Phase 7: Testing & QA
    - (Tasks as per WBS v2.0, but with increased focus on testing refactored components and data integrity if migration occurred)

## Phase 8: Deployment & Documentation
    - (Tasks as per WBS v2.0)
---
*(This WBS v2.1 now heavily emphasizes auditing and refactoring existing components based on discovered code structure for DigitalOcean interactions and DTMA projects.)*