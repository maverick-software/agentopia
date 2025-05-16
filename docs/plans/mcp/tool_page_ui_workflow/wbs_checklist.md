# WBS Checklist: Tools Page UI & Workflow Implementation

**Project:** Agentopia Tools Page UI & Workflow Enhancement
**Date Created:** 05/11/2025
**Author:** AI Assistant (Gemini 2.5 Pro)
**Version:** 1.1 (Updated for Toolbelt & Agent-Specific Credentials)

## Phase 1: Foundational Components & Setup (Shared Components)

- [ ] **1.1. Define Shared Types/Interfaces for UI**
    - [ ] Define TypeScript interfaces for `Toolbox` (formerly ToolEnvironment) display properties.
    - [ ] Define TypeScript interfaces for `GenericToolInstanceOnToolbox` display properties.
    - [ ] Define TypeScript interfaces for `AgentToolbeltItem` display properties.
    - [ ] Define TypeScript interfaces for `ToolCapability` display properties.
    - [ ] Define TypeScript interfaces for `ToolCatalogEntry` display properties.
    - [ ] Define TypeScript interfaces for `AgentCredential` display properties.
- [ ] **1.2. Develop Base Layout Components (if not existing)**
    - [ ] Create/Verify main page layout component (e.g., `ToolsPageLayout`) for global Toolbox management.
    - [ ] Create/Verify layout for Agent Edit Page sections, including the new "Toolbelt" area.
    - [ ] Ensure responsive design breakpoints are handled.
- [ ] **1.3. Icon Integration**
    - [ ] Ensure Lucide React icons are correctly set up and readily usable.
    - [ ] Identify and list all necessary icons for the new UI elements.

## Phase 2: Main "Tools" Dashboard UI (`/tools` page - Global Toolbox Management)

- [ ] **2.1. Account Toolboxes Section**
    - [ ] 2.1.1. UI for "No Toolbox Provisioned" state.
        - [ ] Display empty state, `Alert`.
        - [ ] "Provision Toolbox" `Button` & feedback.
        - [ ] Hook to `account_environment_service`.
    - [ ] 2.1.2. UI for "Toolbox Provisioning" state.
        - [ ] `Card` with status & `Progress` bar.
    - [ ] 2.1.3. UI for "Toolbox Active" state.
        - [ ] `Card` with Toolbox details, success `Badge`.
        - [ ] "De-provision Toolbox" `Button` & confirmation.
        - [ ] Hook to `account_environment_service`.
    - [ ] 2.1.4. UI for "Toolbox Error" state.
        - [ ] `Card` with error `Badge` & message.
        - [ ] "Retry Provisioning" / "Contact Support" buttons.
- [ ] **2.2. Available Tool Instances Section (on a selected Toolbox)**
    - [ ] 2.2.1. UI for "No Generic Tool Instances on Toolbox" state.
        - [ ] Empty state message.
        - [ ] "+ Add New Tool to Toolbox" `Button` (triggers Modal 1a).
    - [ ] 2.2.2. Implement `GenericToolInstanceCard` component (for display on Toolbox Details & Main Dashboard).
        - [ ] Display Tool Name (from catalog), Type.
        - [ ] `DropdownMenu` actions: "View Details/Logs" (V2), "Remove from Toolbox".
        - [ ] Status on Toolbox `Badge`.
    - [ ] 2.2.3. List/grid display for `GenericToolInstanceCard` components.
    - [ ] 2.2.4. Persistent "+ Add New Tool to Toolbox" `Button`.
- [ ] **2.3. Data Fetching & State Management for Global Tools Dashboard** (No major change from v1.0, but entities are Toolboxes & Generic Tool Instances).

## Phase 3: "Toolbox Details" View UI (`/tools/toolboxes/[toolboxId]` page)

- [ ] **3.1. Page Structure & Header**
    - [ ] Implement page layout.
    - [ ] Header: Toolbox Name, Status.
- [ ] **3.2. Toolbox Health & Details Section**
    - [ ] Display CPU, memory, storage usage (from DTMA).
    - [ ] UI for "Increase Storage/Capacity" actions.
- [ ] **3.3. Generic Tool Instances on this Toolbox Section**
    - [ ] Re-use/adapt UI from 2.2 (list of `GenericToolInstanceCard`).
    - [ ] "+ Add New Tool to Toolbox" `Button` (Modal 1a).
    - [ ] "Remove from Toolbox" actions.
- [ ] **3.4. Data Fetching & State for Toolbox Details**

## Phase 4: Agent Edit Page - "Toolbelt" UI (`/agents/[agentId]/edit#toolbelt`)

- [ ] **4.1. "Granted Toolboxes" Section**
    - [ ] UI to display list of Toolboxes agent has access to.
    - [ ] "Manage Toolbox Access" `Button` (triggers Modal 4).
- [ ] **4.2. "Agent's Toolbelt" Section (Specific Credentialed Tools)**
    - [ ] 4.2.1. UI for "No Tools in Toolbelt" state.
    - [ ] 4.2.2. Implement `AgentToolbeltItemCard` component.
        - [ ] Display Tool Name, Source Toolbox Name.
        - [ ] Credential Status `Badge` for this agent.
        - [ ] "Configure Credentials & Permissions" `Button` (triggers Modal 5).
        - [ ] "Remove from Toolbelt" `Button`.
    - [ ] 4.2.3. List/grid display for `AgentToolbeltItemCard` components.
    - [ ] 4.2.4. "+ Add Tool to Agent's Toolbelt" `Button` (triggers Modal 6).
- [ ] **4.3. Data Fetching & State Management for Agent Toolbelt View.**

## Phase 5: Modals UI & Logic (Revised & New Modals)

- [ ] **5.1. Modal 1a: Add Tool to Toolbox (`Dialog`)**
    - [ ] `DialogTitle`: "Add Tool to Toolbox: [Toolbox Name]".
    - [ ] `Select` for Tool Type from `tool_catalog`.
    - [ ] (Optional) Instance Name input.
    - [ ] (Optional) Basic non-credential config inputs.
    - [ ] Footer: "Cancel", "Add Tool to Toolbox" buttons.
    - [ ] Hook to service call for DTMA to deploy generic instance.
- [ ] **5.2. Modal 4: Manage Agent Toolbox Access (`Dialog`)**
    - [ ] `DialogTitle`: "Manage Toolbox Access for Agent: [Agent Name]".
    - [ ] Multi-select list of user's Toolboxes with checkboxes.
    - [ ] Footer: "Cancel", "Save Access".
    - [ ] Hook to backend service for `agent_toolbox_access`.
- [ ] **5.3. Modal 5: Configure Agent Tool Credentials & Permissions (`Dialog`)**
    - [ ] `DialogTitle`: "Configure [Tool Name] for Agent: [Agent Name]".
    - [ ] Account Connection Section (Agent-Specific):
        - [ ] `Label`, `Select` for agent's existing connected accounts for this tool type.
        - [ ] "+ Connect New [Tool Name] Account for this Agent" `Button`.
        - [ ] Implement OAuth/secure input flow for new connections (store against agent & tool type/instance).
    - [ ] Granular Capability Permissions Section:
        - [ ] List capabilities for the tool type.
        - [ ] `Checkbox`/`Switch` per capability.
    - [ ] Footer: "Cancel", "Save Configuration for Agent".
    - [ ] Hook to backend for `agent_tool_credentials` and `agent_tool_capability_permissions`.
- [ ] **5.4. Modal 6: Add Tool to Agent's Toolbelt (`Dialog`)**
    - [ ] `DialogTitle`: "Add to Agent: [Agent Name]'s Toolbelt".
    - [ ] `Select` or filterable list of available generic tools from agent's granted Toolboxes.
    - [ ] Footer: "Cancel", "Add to Toolbelt".
    - [ ] Hook to backend to create `agent_toolbelt_item` (initially uncredentialed).

## Phase 6: Styling, Theming & Final Review (Renumbered, content largely same as v1.0's Phase 5)

- [ ] **6.1. Apply Dark Mode Theme**
    - [ ] Ensure all new components and views correctly implement the dark mode HSL variables from UI/UX guidelines.
    - [ ] Test hover, focus, active states for all interactive elements.
- [ ] **6.2. Light Mode Theme (Optional)**
    - [ ] If light mode is supported, ensure all components adapt correctly.
- [ ] **6.3. Responsiveness Testing**
    - [ ] Test all new UI across specified breakpoints (Mobile, Tablet, Desktop, Ultra-wide).
    - [ ] Ensure content legibility and component reflow.
- [ ] **6.4. Accessibility Review (WCAG AA)**
    - [ ] Check color contrast.
    - [ ] Ensure keyboard navigability for all interactive elements.
    - [ ] Verify ARIA attributes where necessary.
- [ ] **6.5. Code Review & Refinement**
    - [ ] Review component structure for reusability (Atomic Design principles).
    - [ ] Check for consistent use of Tailwind CSS and Shadcn UI components.
    - [ ] Ensure code clarity and adherence to project standards.

## Phase 7: Documentation & Handover (Renumbered, content largely same as v1.0's Phase 6)

- [ ] **7.1. Update UI Component Documentation**
- [ ] **7.2. Create/Update User-Facing Guides** 