## WBS Checklist: UI Refactor - Toolbox & Agent Toolbelt

**Project:** Agentopia UI - Toolbox & Agent Toolbelt Integration
**Date Created:** (Today's Date)
**Author:** AI Assistant (Gemini 2.5 Pro)
**Version:** 1.0

---

**Phase UI.0: Foundation & Global Changes**

*   [x] **UI.0.1: Global Terminology Update**
    *   [x] UI.0.1.1: Search and replace "MCP Server" with "Toolbox" in all relevant UI text, labels, and component names. (Includes file renames: MCPPage.tsx -> ToolboxesPage.tsx; McpServerModal.tsx -> ToolboxModal.tsx; AgentMcpSection.tsx -> AgentToolboxSection.tsx)
    *   [ ] UI.0.1.2: Review and update any related iconography or visual cues if necessary. (Current icons `<Server />` and `<ServerOff />` considered acceptable for now).
*   [ ] **UI.0.2: Agent Context Strategy & Implementation**
    *   [ ] UI.0.2.1: Design mechanism for selecting/displaying the current `agentId` when in Toolbox detail views (for configuring Toolbelt items).
        *   *Options: Persistent dropdown, context inherited from a parent "Agent Configuration" page, etc.*
    *   [ ] UI.0.2.2: Implement the selected agent context provider/hook/state management.
    *   [ ] UI.0.2.3: Ensure components needing `agentId` for API calls can access it.
*   [ ] **UI.0.3: API Client & Utility Updates**
    *   [ ] UI.0.3.1: Ensure frontend API client/utility functions are updated or created to call the new `/toolboxes-user`, `/toolbox-tools`, and `/agent-toolbelt` endpoints.
    *   [ ] UI.0.3.2: Add/Update TypeScript types for API payloads and responses for these new endpoints on the frontend.

---

**Phase UI.1: Toolbox Management (User-Level)**
*(Corresponds to the main list view, similar to `mcp_server_step_1.png`)*

*   [ ] **UI.1.1: Toolbox List View**
    *   [ ] UI.1.1.1: Create/Update component to display a list of user's Toolboxes.
        *   *Data points: Name, Status, Region, Size.*
    *   [ ] UI.1.1.2: Implement API call `GET /toolboxes-user/toolboxes` to fetch data.
    *   [ ] UI.1.1.3: Implement navigation to individual Toolbox Detail View.
    *   [ ] UI.1.1.4: Display "No Toolboxes" message and primary action if list is empty.
*   [ ] **UI.1.2: New Toolbox Creation**
    *   [ ] UI.1.2.1: Create/Update "New Toolbox" modal/dialog (adapting `mcp_server_step_2.png`).
        *   *Fields: Toolbox Name, Region (dropdown), Size (dropdown), Description (optional).*
        *   *(Optional) Field: "Grant Initial Access to Agent" (dropdown of user's agents).*
    *   [ ] UI.1.2.2: Implement API call `POST /toolboxes-user/toolboxes`.
    *   [ ] UI.1.2.3: (If agent access field added) Implement follow-up API call `POST /agent-toolbelt/agents/{agentId}/toolbelt/toolbox-access`.
    *   [ ] UI.1.2.4: Handle loading states and feedback during provisioning.
*   [ ] **UI.1.3: Toolbox Actions (from List View or Detail View)**
    *   [ ] UI.1.3.1: Implement "Deprovision Toolbox" functionality.
        *   API: `DELETE /toolboxes-user/toolboxes/{toolboxId}`.
        *   Include confirmation dialog.
    *   [ ] UI.1.3.2: Implement "Refresh Toolbox Status" functionality.
        *   API: `POST /toolboxes-user/toolboxes/{toolboxId}/refresh-status`.

---

**Phase UI.2: Toolbox Detail View - Deployed Services (Tool Instances)**
*(Focuses on the "Configure" tab part for managing generic services on the Toolbox, adapting `mcp_server_step_3.png` and `mcp_server_step_4.png`)*

*   [ ] **UI.2.1: Toolbox Detail Page Structure**
    *   [ ] UI.2.1.1: Create main page/component for `toolboxes/[toolboxId]`.
    *   [ ] UI.2.1.2: Implement Tabs component (e.g., "Setup", "Access", "History").
    *   [ ] UI.2.1.3: Fetch and display basic Toolbox details (name, status, etc.).
        *   API: `GET /toolboxes-user/toolboxes/{toolboxId}`.
*   [ ] **UI.2.2: "Setup" Tab - Deployed Services List**
    *   [ ] UI.2.2.1: Create component to list "Deployed Services" (Tool Instances) on the current Toolbox.
        *   *Data points: Instance Name, Base Tool (from catalog), Status on Toolbox, Ports.*
    *   [ ] UI.2.2.2: Implement API call `GET /toolbox-tools/toolboxes/{toolboxId}/tools` to fetch list.
*   [ ] **UI.2.3: Deploy New Service (Tool Instance)**
    *   [ ] UI.2.3.1: Implement "+ Deploy New Service" button and associated modal/dialog (adapting `mcp_server_step_4.png`).
    *   [ ] UI.2.3.2: Fetch and display `tool_catalog` for selection.
        *   *Consider if a dedicated API for `GET /tool-catalog` is needed or if it's part of another response.*
    *   [ ] UI.2.3.3: Form for `instance_name_on_toolbox`, optional `port_mapping_json`, `base_config_override_json`.
    *   [ ] UI.2.3.4: Implement API call `POST /toolbox-tools/toolboxes/{toolboxId}/tools`.
*   [ ] **UI.2.4: Manage Deployed Service Instance Actions**
    *   [ ] UI.2.4.1: Implement "Start Service" functionality.
        *   API: `POST /toolbox-tools/toolboxes/{toolboxId}/tools/{instanceNameOnToolbox}/start`.
    *   [ ] UI.2.4.2: Implement "Stop Service" functionality.
        *   API: `POST /toolbox-tools/toolboxes/{toolboxId}/tools/{instanceNameOnToolbox}/stop`.
    *   [ ] UI.2.4.3: Implement "Delete Service" functionality.
        *   API: `DELETE /toolbox-tools/toolboxes/{toolboxId}/tools/{instanceNameOnToolbox}`.
        *   Include confirmation.

---

**Phase UI.3: Toolbox Detail View - Agent Toolbelt Configuration**
*(Focuses on the agent-specific part of the "Setup" tab, using the selected `currentAgentId` context. Adapts `mcp_server_step_5.png`, `mcp_server_step_6.png`, `mcp_server_step_7.png`)*

*   [ ] **UI.3.1: "Setup" Tab - Agent Toolbelt Section UI**
    *   [ ] UI.3.1.1: Create UI section titled "Agent Toolbelt for `[currentAgentName]`". This section is visible/active when an agent context is selected.
    *   [ ] UI.3.1.2: For each "Deployed Service" listed in UI.2.2, display its status relative to the `currentAgentId`'s Toolbelt.
        *   Fetch `GET /agent-toolbelt/agents/{currentAgentId}/toolbelt/items`.
        *   Match `account_tool_instance_id` to link Toolbelt items to Deployed Services.
*   [ ] **UI.3.2: Add Service to Agent Toolbelt**
    *   [ ] UI.3.2.1: Implement "Add to `[currentAgentName]`'s Toolbelt" button/action if a Deployed Service is not yet linked.
    *   [ ] UI.3.2.2: API call `POST /agent-toolbelt/agents/{currentAgentId}/toolbelt/items` (payload: `{ account_tool_instance_id }`).
*   [ ] **UI.3.3: Manage Agent Toolbelt Item Credentials**
    *   [ ] UI.3.3.1: Display credential status (masked ID, status `active`/`revoked`, `last_validated_at`).
        *   API: `GET /agent-toolbelt/agents/{currentAgentId}/toolbelt/items/{toolbeltItemId}/credentials`.
    *   [ ] UI.3.3.2: Implement "Manage Credentials" button and modal (adapting `mcp_server_step_6.png`).
        *   Allows connecting new account or selecting existing.
    *   [ ] UI.3.3.3: API call `PUT /agent-toolbelt/agents/{currentAgentId}/toolbelt/items/{toolbeltItemId}/credentials` (payload: `{ credential_value, ... }`).
    *   [ ] UI.3.3.4: API call `DELETE /agent-toolbelt/agents/{currentAgentId}/toolbelt/items/{toolbeltItemId}/credentials`.
*   [ ] **UI.3.4: Manage Agent Toolbelt Item Permissions**
    *   [ ] UI.3.4.1: Implement "Manage Permissions" button and modal/view (adapting capability list from `mcp_server_step_5.png`).
    *   [ ] UI.3.4.2: Fetch and display capabilities for the base tool from `tool_catalog`.
    *   [ ] UI.3.4.3: Fetch current permissions for the agent + toolbelt item.
        *   API: `GET /agent-toolbelt/agents/{currentAgentId}/toolbelt/items/{toolbeltItemId}/permissions`.
    *   [ ] UI.3.4.4: Allow toggling `is_allowed` for each capability.
    *   [ ] UI.3.4.5: API call `PUT /agent-toolbelt/agents/{currentAgentId}/toolbelt/items/{toolbeltItemId}/permissions`.
*   [ ] **UI.3.5: Manage Agent Toolbelt Item Activation**
    *   [ ] UI.3.5.1: Implement toggle for `is_active_for_agent`.
    *   [ ] UI.3.5.2: API call `PUT /agent-toolbelt/agents/{currentAgentId}/toolbelt/items/{toolbeltItemId}` (payload: `{ is_active_for_agent: true/false }`).
*   [ ] **UI.3.6: Remove Service from Agent Toolbelt**
    *   [ ] UI.3.6.1: Implement "Remove from `[currentAgentName]`'s Toolbelt" button/action.
    *   [ ] UI.3.6.2: API call `DELETE /agent-toolbelt/agents/{currentAgentId}/toolbelt/items/{toolbeltItemId}`.
    *   Include confirmation.

---

**Phase UI.4: Auxiliary Toolbox Views**

*   [ ] **UI.4.1: "Access" / "Connections" Tab**
    *   [ ] UI.4.1.1: Display core Toolbox details (IP, region, size - for admin reference).
    *   [ ] UI.4.1.2: List agents who have access to this Toolbox.
        *   API: Fetch `agent_toolbox_access` records for the current `toolboxId`.
    *   [ ] UI.4.1.3: Implement UI to grant/revoke agent access to the Toolbox.
        *   API: `POST /agent-toolbelt/agents/{agentId}/toolbelt/toolbox-access`
        *   API: `DELETE /agent-toolbelt/agents/{agentId}/toolbelt/toolbox-access/{accessId}` (or by agentId+toolboxId).
*   [ ] **UI.4.2: "History" Tab**
    *   [ ] UI.4.2.1: Design and implement display for Toolbox-level events (provisioning, DTMA heartbeats if relevant, errors).
        *   *Consider if new backend logging/event sourcing is needed for this or if it uses existing data.*
    *   [ ] UI.4.2.2: (Optional) If an agent context is selected, filter/display that agent's specific tool usage history *on this Toolbox*.

---

**Phase UI.5: Testing & Refinement**

*   [ ] **UI.5.1: Component-Level Testing**
    *   [ ] UI.5.1.1: Write unit/integration tests for new critical UI components (modals, list items, configuration forms).
*   [ ] **UI.5.2: End-to-End Flow Testing**
    *   [ ] UI.5.2.1: Test full user flow: Create Toolbox -> Deploy Service -> Grant Agent Access -> Agent Connects Credentials -> Agent Sets Permissions -> Agent (conceptually) uses tool.
    *   [ ] UI.5.2.2: Test all edge cases and error handling (API errors, provisioning failures shown in UI).
*   [ ] **UI.5.3: UI/UX Review & Iteration**
    *   [ ] UI.5.3.1: Review against mockups and user experience goals.
    *   [ ] UI.5.3.2: Gather feedback and iterate on design and flow.
*   [ ] **UI.5.4: Accessibility Check**
    *   [ ] UI.5.4.1: Perform basic accessibility checks (keyboard navigation, ARIA attributes if needed).

--- 