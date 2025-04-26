# Routing Alignment & Verification - WBS Checklist

**Goal:** Verify all application pages are correctly and consistently routed using the new `src/routing/` module, addressing potential causes for pages not loading properly.

## Phase 1: Verification & Configuration Audit

- [-] **Inventory Pages:**
    - [X] List all page components found within the `src/pages/` directory.
    - [X] Compare the list against components used in `src/routing/routeConfig.tsx`.
    - [ ] **Confirm:** All necessary page components from `src/pages/` are included in `routeConfig.tsx`.
    - [ ] **Confirm:** `routeConfig.tsx` does not reference any non-existent page components.
- [X] **Audit `routeConfig.tsx` Entries:**
    - [X] Review each route object in the `appRoutes` array:
        - [X] Verify `path` is correct and matches intended URL.
        - [X] Verify `element` points to the correct page component.
        - [X] Verify `protection` (`public`, `protected`, `admin`) is correctly set for each route's access requirement.
        - [X] Verify `layout` flag (`true`/`false`) is correctly set based on whether the main `Layout` component is needed.
        - [X] Verify `children` structure for nested routes (e.g., `/admin`) is correct.
- [X] **Verify Component Imports:**
    - [X] In `src/routing/routeConfig.tsx`, ensure `AgentEditPage`, `LoginPage`, `RegisterPage`, `UnauthorizedPage` are correctly imported directly from `../pages/`.
    - [X] In `src/routing/routeConfig.tsx`, ensure all other page components are correctly imported from `./lazyComponents`.

## Phase 2: Consistency & Potential Refinements

- [X] **Review Lazy Loading Strategy:**
    - [X] Decide if `AgentEditPage` should be lazy-loaded (like other protected pages) or remain directly imported. // Decided: Lazy
    - [X] Decide if core public pages (`LoginPage`, `RegisterPage`, `HomePage`) should remain directly imported or be lazy-loaded. // Decided: Lazy
    - [X] **Action:** If changes decided, update `src/routing/lazyComponents.ts` and `src/routing/routeConfig.tsx` accordingly. // Updated
- [X] **Review Internal Navigation Consistency:**
    - [X] Search codebase (`src/components/`, `src/pages/`) for `<Link to="...">` usages.
    - [X] Search codebase for `navigate(...)` usages (from `useNavigate`).
    - [X] **Confirm:** All path strings used in links/navigation calls exactly match the `path` definitions in `src/routing/routeConfig.tsx`. Address any discrepancies. // Discrepancies found and corrected
- [X] **Consider Path Constants (Optional Refinement):**
    - [X] Decide if creating a `src/routing/paths.ts` file to define route path constants would improve maintainability and reduce errors. // Decided: Skip for now
    - [ ] **Action:** If yes, create `paths.ts`, define constants, import/use them in `routeConfig.tsx`, and update all `<Link>` / `navigate` calls to use the constants. // N/A

## Phase 3: Testing & Documentation

- [ ] **Comprehensive Testing:**
    - [ ] Run the application (`npm run dev` or similar).
    - [ ] Test navigation to **all** defined routes, paying close attention to previously problematic ones:
        - [ ] `/` (logged in / logged out)
        - [ ] `/login`, `/register`, `/unauthorized`
        - [ ] `/dashboard`
        - [ ] `/agents`, `/agents/new`
        - [ ] `/agents/:agentId` (e.g., `/agents/some-uuid-here`) - **CRITICAL CHECK**
        - [ ] `/agents/:agentId/edit`
        - [ ] `/agents/:agentId/chat` - **CRITICAL CHECK**
        - [ ] `/datastores`, `/datastores/new`, `/datastores/:datastoreId/edit`
        - [ ] `/teams`, `/teams/new`, `/teams/:teamId`, `/teams/:teamId/edit`
        - [ ] `/settings`, `/mcp`, `/monitoring`
        - [ ] `/admin`, `/admin/users`, `/admin/agents` (test with/without admin role if possible)
        - [ ] Invalid paths (catch-all route)
    - [ ] Verify correct component loads, layout appears/disappears correctly, and protection redirects work as expected.
- [ ] **Update Change Log:**
    - [ ] Add an entry to `src/routing/_change.logs` detailing the verification and any refinements made. 