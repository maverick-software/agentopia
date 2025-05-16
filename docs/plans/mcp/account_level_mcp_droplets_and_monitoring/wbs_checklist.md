# WBS Checklist: Account-Level MCP Droplets and Monitoring

**Date Created:** 2024-07-30
**Plan Name:** Account-Level MCP Droplets and Monitoring
**Goal:** To refactor the MCP droplet system from a per-agent model to a shared, account-level model, and to enhance the "Tools" page with resource monitoring and scaling capabilities.

## Phase 1: Core Backend & Database Refactoring (Account-Level Droplet)

**Goal:** Modify the backend to support a single, shared tool environment (droplet) per user account, rather than per agent.

*   **1.1. Database Schema Modification**
    *   [ ] 1.1.1. Define `account_tool_environments` table:
        *   Fields: `id` (PK), `user_id` (FK to `users`, UNIQUE), `do_droplet_id` (BIGINT, nullable), `ip_address` (INET, nullable), `status` (ENUM: 'inactive', 'pending_creation', 'creating', 'active', 'error_creation', 'pending_deletion', 'deleting', 'error_deletion', 'unresponsive', 'scaling'), `region_slug` (TEXT), `size_slug` (TEXT), `image_slug` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ), `last_heartbeat_at` (TIMESTAMPTZ, nullable), `error_message` (TEXT, nullable).
    *   [ ] 1.1.2. Define `account_tool_environment_tools` table (or refactor `agent_tool_instances`):
        *   Determine linkage to `account_tool_environments` and `agents` for tool tracking on the shared environment.
    *   [ ] 1.1.3. Create migration script for new/modified tables.
    *   [ ] 1.1.4. Plan data migration strategy for existing `agent_droplets`.

*   **1.2. Backend Service Logic Adaptation**
    *   [ ] 1.2.1. Refactor `digitalocean_service` for any changes in droplet management.
    *   [ ] 1.2.2. Refactor `agent_environment_service` to `account_environment_service` (or similar):
        *   Modify logic for `user_id` based provisioning.
        *   Update DB interactions to use `account_tool_environments`.
    *   [ ] 1.2.3. Update user data/bootstrap script for account-level droplets.

*   **1.3. Supabase Edge Function Modification**
    *   [ ] 1.3.1. Modify `manage-agent-tool-environment` to `manage-account-tool-environment`.
    *   [ ] 1.3.2. Update `heartbeat` Edge Function for `account_tool_environments`.
    *   [ ] 1.3.3. Update `fetch-tool-secrets` Edge Function for account-level environments.

## Phase 2: Droplet Tool Management Agent (DTMA) Adaptation

**Goal:** Enable the DTMA to manage tools for multiple agents of the same user on a shared droplet.

*   **2.1. DTMA Core Logic for Multi-Agent Tool Management**
    *   [ ] 2.1.1. Modify DTMA configuration for `user_id` / `account_tool_environment_id`.
    *   [ ] 2.1.2. Implement logic to handle tool commands for specific `agent_id`s on the shared environment.
    *   [ ] 2.1.3. Ensure tool isolation (ports, data) for different agents' tools.
    *   [ ] 2.1.4. Update DTMA communication for account-level status reporting.

*   **2.2. DTMA Resource Monitoring & Reporting Capabilities**
    *   [ ] 2.2.1. Implement DTMA functions for overall droplet resource collection (CPU, memory, disk, network).
    *   [ ] 2.2.2. (Optional) Implement per-tool/per-agent resource usage collection.
    *   [ ] 2.2.3. Design payload for DTMA to report resource metrics.
    *   [ ] 2.2.4. Configure DTMA for periodic resource metric reporting.

## Phase 3: Frontend UI ("Tools" Page) Refactoring & Enhancements

**Goal:** Update the "Tools" page for account-level droplet management, resource monitoring, and scaling.

*   **3.1. API Client (`toolEnvironments.ts`) Updates**
    *   [ ] 3.1.1. Refactor activation/deactivation functions to account-level (e.g., `activateAccountToolEnvironment`).
    *   [ ] 3.1.2. Refactor status fetching to account-level (e.g., `fetchAccountDropletStatus`).
    *   [ ] 3.1.3. Add `fetchAccountDropletResourceUsage()` API client function.
    *   [ ] 3.1.4. Add `requestAccountDropletScaling(newSizeSlug: string)` API client function.

*   **3.2. "Tools" Page (`MCPPage.tsx`) Core Logic Refactoring**
    *   [ ] 3.2.1. Remove "Select Agent" dropdown; MCP environment is account-wide.
    *   [ ] 3.2.2. Update state management for single account-level environment.
    *   [ ] 3.2.3. Modify `fetchDropletStatus` to use new account-level API function.
    *   [ ] 3.2.4. Modify `toggleDropletActivation` to use new account-level API functions.

*   **3.3. UI for Droplet Resource Monitoring**
    *   [ ] 3.3.1. Design "Environment Monitoring" section.
    *   [ ] 3.3.2. Implement periodic calls to `fetchAccountDropletResourceUsage()`.
    *   [ ] 3.3.3. Display CPU usage.
    *   [ ] 3.3.4. Display Memory usage.
    *   [ ] 3.3.5. Display Disk/Storage usage.
    *   [ ] 3.3.6. (Optional) Display Network I/O.
    *   [ ] 3.3.7. (Optional) Implement charts for historical usage.

*   **3.4. UI for Droplet Scaling**
    *   [ ] 3.4.1. Design "Environment Scaling" section.
    *   [ ] 3.4.2. Display current droplet size.
    *   [ ] 3.4.3. Provide selection for available droplet sizes.
    *   [ ] 3.4.4. Implement "Scale Up/Down" button.
    *   [ ] 3.4.5. Call `requestAccountDropletScaling()` on action.
    *   [ ] 3.4.6. Display feedback during scaling.
    *   [ ] 3.4.7. Handle scaling request errors.

## Phase 4: Backend Support for Scaling & Resource Reporting

**Goal:** Implement backend logic for scaling requests and resource metrics.

*   **4.1. DigitalOcean Service Enhancements for Scaling**
    *   [ ] 4.1.1. Add function in `digitalocean_service.ts` to resize a droplet.
    *   [ ] 4.1.2. Handle status updates to `account_tool_environments.status` during scaling.

*   **4.2. New Backend Endpoints**
    *   [ ] 4.2.1. Create `report-droplet-resource-usage` endpoint (Supabase Edge Function/backend route).
        *   Accepts metrics from DTMA.
        *   Stores metrics.
    *   [ ] 4.2.2. Create `get-droplet-resource-usage` endpoint.
        *   Serves resource metrics for UI.
    *   [ ] 4.2.3. Create `scale-account-droplet` endpoint.
        *   Accepts `newSizeSlug`.
        *   Calls `digitalocean_service` to resize.
        *   Updates status in `account_tool_environments`.

## Phase 5: Testing & Deployment

*   **5.1. Comprehensive Testing**
    *   [ ] 5.1.1. Test account-level droplet provisioning/de-provisioning.
    *   [ ] 5.1.2. Test multi-agent tools on shared droplet.
    *   [ ] 5.1.3. Verify resource monitoring accuracy.
    *   [ ] 5.1.4. Test droplet scaling.
    *   [ ] 5.1.5. Test data migration (if applicable).
*   **5.2. Documentation Updates**
    *   [ ] 5.2.1. Update backend documentation.
    *   [ ] 5.2.2. Update DTMA documentation.
    *   [ ] 5.2.3. Update frontend/UI documentation.
*   **5.3. Deployment**
    *   [ ] 5.3.1. Plan deployment, considering migration and scaling downtime. 