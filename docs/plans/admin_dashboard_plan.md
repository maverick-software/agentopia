# Agentopia Admin Dashboard Plan

**Date:** 2025-04-18

## Phase 0: Foundational Prerequisites (Addressing Existing Issues)

These steps address critical issues identified in the context document (`docs/context/ai_context_2025-04-18_1919.mdc`) and are necessary before proceeding with admin features.

*   [x] **P0.1: Verify RLS Policies:** RLS confirmed ENABLED for `agents` (`auth.uid() = user_id`) and `agent_discord_connections` (`is_agent_owner(agent_id)` function). Policies are verified as secure and correctly implemented. No corrections needed.
*   [x] **P0.2: Implement Basic Logging:**
    *   [x] Create the standard logging directory: `docs/console/logs/`.
    *   [x] Updated `worker-manager` logger to write to `docs/console/logs/worker-manager-%DATE%.log`.
    *   [x] Updated `discord-worker` logger to write to `docs/console/logs/discord-worker-%DATE%.log`.
    *   [x] Confirmed basic `console` logging exists in key Supabase functions.

---

## Phase 1: Admin Dashboard Implementation

### 1. Overall Goal

To create a secure, dedicated administrative section within Agentopia that provides visibility into system health, user activity, and agent status, along with granular controls for managing users, roles, and agents.

### 2. Guiding Principles

*   **Security First:** Admin access must be strictly controlled via roles and authorization checks.
*   **Clear Separation:** Admin UI/API endpoints should be distinct from user-facing ones.
*   **Usability:** Provide an intuitive interface for administrators.
*   **Observability:** Offer clear insights into system status and potential issues.
*   **Modularity:** Build components for future extensibility.

### 3. Core Features - Work Breakdown Structure (WBS) / Checklist

*   [ ] **3.1. Admin Authentication & Authorization:**
    *   [ ] WBS 3.1.1: Define an `admin` role (e.g., using Supabase custom claims or a new `roles`/`user_roles` table).
    *   [ ] WBS 3.1.2: Implement mechanism to assign the `admin` role (manual DB assignment initially, potentially UI later). Assign an initial admin user.
    *   [ ] WBS 3.1.3: Secure admin routes/API endpoints:
        *   [ ] Frontend: Implement route guards checking for the admin role.
        *   [ ] Backend: Ensure all admin-specific Supabase functions verify the caller has the admin role.
*   [ ] **3.2. Admin Dashboard Landing Page:**
    *   [ ] WBS 3.2.1: Create a new route and page component (e.g., `/admin/dashboard`).
    *   [ ] WBS 3.2.2: Design UI layout for the admin dashboard.
    *   [ ] WBS 3.2.3: Display key system health metrics summary (links to WBS 3.6).
    *   [ ] WBS 3.2.4: Display quick stats (total users, active agents).
    *   [ ] WBS 3.2.5: Implement navigation sidebar/menu for admin sections.
*   [ ] **3.3. User Management:**
    *   [ ] WBS 3.3.1: Create User Management page component (e.g., `/admin/users`).
    *   [ ] WBS 3.3.2: Create Supabase function (`admin-get-users`) to fetch all users (requires admin role).
    *   [ ] WBS 3.3.3: Implement UI table to list users with basic details.
    *   [ ] WBS 3.3.4: Implement search/filtering for the user list.
    *   [ ] WBS 3.3.5: Implement view for individual user details (requires `admin-get-user-details` function?).
    *   [ ] WBS 3.3.6: Create Supabase function (`admin-update-user-role`) to change a user's role.
    *   [ ] WBS 3.3.7: Implement UI controls for changing user roles.
    *   [ ] WBS 3.3.8: Create Supabase function (`admin-set-user-status`) for activate/deactivate/suspend.
    *   [ ] WBS 3.3.9: Implement UI controls for changing user status.
    *   [ ] WBS 3.3.10: (Optional/Low Priority) Implement user deletion functionality.
*   [ ] **3.4. Role Management:**
    *   [ ] WBS 3.4.1: Define initial roles (`admin`, `user`) in the chosen mechanism (claims/table).
    *   [ ] WBS 3.4.2: (Optional) Create UI to *view* defined roles and perhaps their high-level permissions (likely static display initially).
*   [ ] **3.5. Agent Management (Admin Level):**
    *   [ ] WBS 3.5.1: Create Agent Management page component (e.g., `/admin/agents`).
    *   [ ] WBS 3.5.2: Create Supabase function (`admin-get-agents`) to fetch all agents across all users.
    *   [ ] WBS 3.5.3: Implement UI table to list all agents.
    *   [ ] WBS 3.5.4: Implement search/filtering for the agent list.
    *   [ ] WBS 3.5.5: Implement view for individual agent details (config, owner, status).
    *   [ ] WBS 3.5.6: Create mechanism for admin to force-deactivate worker (e.g., Supabase function calling `worker-manager` endpoint).
    *   [ ] WBS 3.5.7: Implement UI control for admin force-deactivation.
    *   [ ] WBS 3.5.8: Create mechanism for admin to disable agent config globally.
    *   [ ] WBS 3.5.9: Implement UI control for admin agent disabling.
*   [ ] **3.6. System Health Monitoring:**
    *   [ ] WBS 3.6.1: Create System Health page component (e.g., `/admin/health`).
    *   [ ] WBS 3.6.2: Display Supabase status (potentially iframe/link to status.supabase.com).
    *   [ ] WBS 3.6.3: Add secure status endpoint to `worker-manager` service (reports PM2 status of managed processes).
    *   [ ] WBS 3.6.4: Create Supabase function (`admin-get-worker-status`) to securely call the `worker-manager` status endpoint.
    *   [ ] WBS 3.6.5: Implement UI to display status of backend services (`worker-manager`, `discord-worker` instances).
    *   [ ] WBS 3.6.6: Implement mechanism to fetch/display recent errors from logs (requires P0.2 logging improvements and potentially a log aggregation solution or DB logging table).
    *   [ ] WBS 3.6.7: Investigate displaying Supabase function invocation/error rates (via Supabase API or dashboard link).
*   [ ] **3.7. (Optional) Global Settings Management:**
    *   [ ] WBS 3.7.1: Design and create DB table (`global_settings`?).
    *   [ ] WBS 3.7.2: Create Supabase functions (`admin-get-settings`, `admin-update-setting`).
    *   [ ] WBS 3.7.3: Create UI page for viewing/modifying settings.
*   [ ] **3.8. (Optional) Audit Logging:**
    *   [ ] WBS 3.8.1: Design and create DB table (`admin_actions_log`).
    *   [ ] WBS 3.8.2: Add logging calls to relevant admin Supabase functions (role changes, user status changes, agent disables, etc.).
    *   [ ] WBS 3.8.3: Create UI page to view the audit log with filtering.

### 4. Architecture Considerations

*   **Frontend:** New `/admin` route section, role guards, dedicated admin components, calls to new admin Supabase functions.
*   **Backend (Supabase Functions):** New `admin-*` functions requiring admin role check via JWT/session. Use `service_role` key internally where necessary for cross-user data access.
*   **Backend (Services):** New secure HTTP status endpoint on `worker-manager` callable by admin functions.
*   **Database:** Potential new tables (`roles`, `user_roles`, `global_settings`, `admin_actions_log`). RLS needed for these tables.

### 5. Documentation

*   [ ] Update `README.md` and `docs/index.md` to reference the new admin section.
*   [ ] Add specific documentation within `docs/` detailing admin features and usage.

### 6. Testing

*   [ ] Thoroughly test all admin functionalities.
*   [ ] Test security restrictions: ensure non-admins cannot access admin UI or API endpoints.
*   [ ] Test edge cases (e.g., suspending a user with active agents). 