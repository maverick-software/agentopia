## UI Refactor Plan: "MCP Server" to "Toolbox" and Agent Toolbelt Integration

**1. Goal:**
Refactor the existing "MCP Server" section of the Agentopia UI (currently resembling the "Zapier MCP" mockups) to align with the new backend architecture. This involves introducing concepts of user-owned "Toolboxes" (formerly MCP Servers), generic "Deployed Services" (Tool Instances) running on these Toolboxes, and agent-specific "Toolbelt Items" which allow agents to connect credentials and manage permissions for those Deployed Services.

**2. Scope:**
The refactor will touch upon the following UI areas and functionalities:
    *   Global renaming of "MCP Server" to "Toolbox".
    *   **Toolbox Management (User-Level):**
        *   Listing user's Toolboxes with status.
        *   Creation of new Toolboxes (provisioning flow).
        *   Deprovisioning of Toolboxes.
        *   Refreshing Toolbox status.
    *   **Toolbox Detail View:**
        *   Displaying selected Toolbox information.
        *   Managing "Deployed Services" (Tool Instances) on the Toolbox:
            *   Listing deployed services.
            *   Deploying new services from a catalog.
            *   Starting, stopping, and deleting deployed service instances.
        *   Managing "Agent Toolbelt" configurations for a selected agent in context of the Toolbox:
            *   Linking an agent to a deployed service (creating a Toolbelt Item).
            *   Managing agent-specific credentials for a Toolbelt Item.
            *   Managing agent-specific permissions (capabilities) for a Toolbelt Item.
            *   Activating/deactivating a Toolbelt Item for an agent.
    *   **Agent Context:** Implementing a clear and intuitive way for the user to select or be aware of the current agent context when performing agent-specific configurations (Toolbelt).
    *   Adapting "Connect" and "History" views for Toolboxes.

**3. UI Framework & Components:**
    *   Leverage existing React, Vite, TypeScript, Tailwind CSS, and Shadcn UI components.
    *   Create new reusable components as needed for Toolbox lists, deployed service lists, agent toolbelt configurations, and associated modals/dialogs.

**4. API Integration:**
    *   Utilize the already defined and implemented Supabase Edge Functions:
        *   `toolboxes-user` (for user-level Toolbox management).
        *   `toolbox-tools` (for managing generic Tool Instances on a Toolbox).
        *   `agent-toolbelt` (for agent-specific configurations).
        *   APIs for fetching `tool_catalog` and agent lists.

**5. Deliverables:**
    *   Updated UI screens reflecting the new terminology and functionality.
    *   A clear user flow for provisioning Toolboxes, deploying services onto them, and configuring agents to use these services.
    *   Documentation (as part of this WBS or separate) for the new UI components and flows. 