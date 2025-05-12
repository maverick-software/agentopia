# Agentopia "Tools" Page & Workflow - UI Plan

**Date Created:** 05/11/2025
**Author:** AI Assistant (Gemini 2.5 Pro)
**Version:** 1.1 (Updated for Toolbelt & Agent-Specific Credentials)

## 1. Overarching Principles

*   **Theme:** Dark Mode (Primary), Flat Design (as per `.cursor/rules/design/UI_UX_Design.mdc`).
*   **Libraries:** Shadcn UI, Tailwind CSS, Lucide React icons.
*   **Layout:** Responsive, consistent spacing (Tailwind scale), Discord-like 3-column layout where applicable, focused views for modals and management pages.
*   **Accessibility & Usability:** Adherence to WCAG AA, clear visual hierarchy, user feedback.

## 2. Main "Tools" Dashboard (Global Toolbox Management)

*   **Purpose:** Manage "Toolboxes" (shared DigitalOcean droplets/environments) and the generic "Tool" (MCP server) *instances* available on them. **Note:** Credentialing of tools happens at the Agent level via the "Toolbelt", not here.
*   **Location:** Top-level navigation item "Tools".
*   **Page Title (H1):** "Toolboxes & Available Tools"
*   **Layout Options:** 2-column or single wide column.

### 2.1. Section: Account Toolboxes (Shared Droplets)

*   **Displays:** Information about the user's shared DigitalOcean droplets.
*   **States & UI Elements:**
    1.  **No Environment Provisioned:**
        *   Visual: Empty state graphic, `Alert` ("No Tool Environment Active").
        *   Action: `Button` (primary, large): "Provision Tool Environment".
            *   Feedback: "Provisioning in progress..." (`Progress` bar or spinner).
    2.  **Environment Provisioning:**
        *   Visual: `Card` ("Tool Environment Status") showing "Status: Provisioning..." with `Progress` bar.
    3.  **Environment Active:**
        *   Visual: `Card` ("Active Tool Environment").
            *   Content: Environment Name/ID, Status `Badge` (success) "Active", (Future V2: Basic stats).
            *   Footer: `Button` (destructive, outline): "De-provision Environment" (confirm via modal).
    4.  **Environment Error/Failed Provisioning:**
        *   Visual: `Card` ("Tool Environment Status") showing "Status: Error" (`Badge` destructive), error message.
        *   Action: `Button`: "Retry Provisioning" or "Contact Support."

### 2.2. Section: Available Tool Instances (on an Active Toolbox)

*   **Displays:** List of generic tool instances running on a selected Toolbox. These are templates/base instances that agents can later add to their Toolbelt and credentialize.
*   **States & UI Elements:**
    1.  **No Tool Instances Created on Toolbox:**
        *   Action: `Button` (primary): "+ Add New Tool to Toolbox" (opens **Modal 1a: Add Tool to Toolbox**).
    2.  **Tool Instances Exist on Toolbox:**
        *   Visual: List/grid of `ToolInstanceCard` components (representing generic instances from `tool_catalog`).
            *   `ToolInstanceCard` Details:
                *   Header: Tool Name (from catalog), Tool Type. `DropdownMenu` (ellipsis): "View Details/Logs" (V2), "Remove from Toolbox" (if no agents are actively using it via a Toolbelt).
                *   Content: Status on Toolbox `Badge` ("Ready", "Error").
                *   Footer: (No direct "Manage" here, management is about presence on Toolbox. Configuration of *agent use* is via Toolbelt).
        *   Global Action: Persistent `Button` (primary) "+ Add New Tool to Toolbox".

## 3. View: Toolbox Details (Accessed from Main Tools Dashboard)

*   **Purpose:** View health and details of a specific "Toolbox" (droplet), manage its capacity, and see a list of generic "Tool" (MCP server) instances available on it.
*   **Page Title (H2):** "Toolbox: [Toolbox Name]"
*   **Content:**
    *   Health and details of the Toolbox (droplet status, CPU, memory, storage usage - from DTMA).
    *   Options to increase storage/capacity (triggers backend requests to `account_environment_service` and potentially DigitalOcean API).
    *   List of generic "Tool" instances on this Toolbox (as in 2.2), with options to "+ Add New Tool to Toolbox" (Modal 1a) or "Remove from Toolbox".

## 4. Agent Edit Page - "Toolbelt" View

*   **Purpose:** Manage an individual agent's access to Toolboxes and the specific, credentialed Tools they can use.
*   **Location:** Tab or section within the Agent Edit page (e.g., `/agents/[agentId]/edit#toolbelt`).
*   **Page Title (H2 within Agent Edit):** "Agent Toolbelt & Capabilities"

### 4.1. Section: Granted Toolboxes

*   **Displays:** List of "Toolboxes" this agent has been granted access to.
*   **Action:** `Button` (primary): "Manage Toolbox Access" (opens **Modal 4: Manage Agent Toolbox Access**).

### 4.2. Section: Agent's Toolbelt (Specific Credentialed Tools)

*   **Displays:** List of specific "Tool" instances the agent is configured to use, along with their credential status for this agent.
*   **States & UI Elements:**
    1.  **No Tools in Toolbelt:**
        *   Visual: Empty state message ("This agent has no tools in its Toolbelt. Add tools from granted Toolboxes.").
    2.  **Tools Exist in Toolbelt:**
        *   Visual: List/grid of `AgentToolbeltItemCard` components.
            *   `AgentToolbeltItemCard` Details:
                *   Header: Tool Name (e.g., "Gmail Send/Read"), Source Toolbox Name.
                *   Content: Credential Status for this agent (`Badge`: "Connected as agent@example.com", "Credentials Needed").
                *   Footer: `Button` (primary): "Configure Credentials & Permissions" (opens **Modal 5**).
                         `Button` (destructive outline): "Remove from Toolbelt".
*   **Global Action:** `Button` (primary): "+ Add Tool to Agent's Toolbelt" (opens **Modal 6: Add Tool to Toolbelt** - only shows tools from granted Toolboxes).

## 5. Modals (Shadcn `Dialog`)

### Modal 1a: Add Tool to Toolbox (Admin/User adding generic instance to a Toolbox)

*   **Trigger:** "+ Add New Tool to Toolbox" from Main Tools Dashboard or Toolbox Details view.
*   **`DialogTitle`:** "Add Tool to Toolbox: [Toolbox Name]"
*   **`DialogContent`:**
    *   `Select` for "Select Tool Type from Catalog": Populated from `tool_catalog` (admin-approved MCP server templates, e.g., "Zapier MCP Server", "Gmail MCP Server").
    *   (Optional) Instance Name on Toolbox (if user can name them, otherwise auto-generated).
    *   (Optional) Basic non-credential config for this generic instance if any.
*   **`DialogFooter`:** "Cancel", "Add Tool to Toolbox" (triggers DTMA to deploy/configure generic instance).

### Modal 4: Manage Agent Toolbox Access

*   **Trigger:** "Manage Toolbox Access" button on Agent Edit Page -> Toolbelt View.
*   **`DialogTitle`:** "Manage Toolbox Access for Agent: [Agent Name]"
*   **`DialogContent`:** Multi-select list of available Toolboxes in the user's account. Checkboxes indicate currently granted access.
*   **`DialogFooter`:** "Cancel", "Save Access".

### Modal 5: Configure Agent Tool Credentials & Permissions (Replaces Zapier-like flow for a specific agent)

*   **Trigger:** "Configure Credentials & Permissions" on an `AgentToolbeltItemCard`.
*   **`DialogTitle`:** "Configure [Tool Name] for Agent: [Agent Name]"
*   **`DialogContent`:** (Based on `.cursor/rules/specialty/mcp_developer_guide.mdc` and Zapier UI examples)
    1.  **Account Connection Section (Agent-Specific):**
        *   `Label`: "Connect [Tool Name] Account for [Agent Name]".
        *   `Select` to choose from *this agent's* already connected accounts for this tool type (e.g., if agent previously connected a Gmail).
        *   `Button`: "+ Connect New [Tool Name] Account for this Agent".
            *   Action: Initiates OAuth flow or secure input specific to the tool type. Credentials stored are associated with the *agent_id* and *tool_instance_id* (or a new `agent_tool_credential_id`).
    2.  **Granular Capability Permissions Section:**
        *   Lists all available capabilities/actions for this tool type (e.g., "Gmail: Send Email", "Gmail: Read Email").
        *   Each capability: `Checkbox` or `Switch` to enable/disable for this agent.
        *   (Optional) Sub-configurations per capability if needed.
*   **`DialogFooter`:** "Cancel", "Save Configuration for Agent".

### Modal 6: Add Tool to Agent's Toolbelt

*   **Trigger:** "+ Add Tool to Agent's Toolbelt" button on Agent Edit Page -> Toolbelt View.
*   **`DialogTitle`:** "Add to Agent: [Agent Name]'s Toolbelt"
*   **`DialogContent`:**
    *   `Select` or filterable list of "Available Tools from Granted Toolboxes". (Shows generic tool instances from Toolboxes the agent has access to, which are not yet in its Toolbelt).
*   **`DialogFooter`:** "Cancel", "Add to Toolbelt" (adds a placeholder to agent's toolbelt, user then clicks "Configure Credentials & Permissions"). 