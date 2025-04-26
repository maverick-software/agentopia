# Routing Refactoring - WBS Checklist

## Phase 1: Setup & Preparation

- [X] **Create Directory Structure:**
    - [X] Create the main directory: `src/routing/`.
- [X] **Backup:** (Rule #3)
    - [X] Create a backup copy of `src/router/AppRouter.tsx` (e.g., `src/router/AppRouter_backup.tsx`) before making major changes.

## Phase 2: Component Extraction & Creation

- [X] **Extract `ProtectedRoute`:**
    - [X] Create `src/routing/ProtectedRoute.tsx`.
    - [X] Move the `ProtectedRoute` component definition (currently lines 40-60 in `src/router/AppRouter.tsx`) to `src/routing/ProtectedRoute.tsx`.
    - [X] Add necessary imports (React, Navigate, useAuth, LoadingSpinner) to `src/routing/ProtectedRoute.tsx`.
    - [X] Export the `ProtectedRoute` component.
- [X] **Extract `AdminRoute`:**
    - [ ] Create `src/routing/AdminRoute.tsx`. // Kept unchecked as file was moved, not created from scratch
    - [ ] Move the `AdminRoute` component definition (...) to `src/routing/AdminRoute.tsx`. // Kept unchecked as file was moved, not created from scratch
    - [X] Move the file `src/router/AdminRoute.tsx` to `src/routing/AdminRoute.tsx`.
    - [X] Update imports within the moved `AdminRoute.tsx` if necessary (e.g., context path). // Verified no changes needed
- [X] **Centralize Lazy Loading:**
    - [X] Create `src/routing/lazyComponents.ts`.
    - [X] Move all `const PageName = lazy(...)` definitions from `src/router/AppRouter.tsx` (lines 14-34) to `src/routing/lazyComponents.ts`.
    - [X] Export all lazy-loaded components from `lazyComponents.ts`.

## Phase 3: Route Configuration & Router Implementation

- [X] **Define Route Configuration:**
    - [X] Create `src/routing/routeConfig.tsx`.
    - [X] Define a structure (e.g., an array of objects) to represent all application routes (public, protected, admin). Each object should contain path, element, required layout (if any), protection type (public, protected, admin), and potentially other metadata.
    - [X] Import components from `src/routing/lazyComponents.ts` and potentially `src/pages/` for non-lazy components.
    - [X] Populate the configuration structure with all routes currently defined in `src/router/AppRouter.tsx` (lines 71-104).
- [X] **Implement New `AppRouter`:**
    - [X] Create `src/routing/AppRouter.tsx`.
    - [X] Implement the main `AppRouter` functional component.
    - [X] Import necessary hooks (`useAuth`), components (`Suspense`, `Routes`, `Route`, `Navigate`, `Layout`, `LoadingSpinner`), and the route configuration from `routeConfig.tsx`.
    - [X] Implement logic to dynamically generate `<Route>` elements based on the `routeConfig.tsx` structure, wrapping elements with `Layout`, `ProtectedRoute`, or `AdminRoute` as specified in the config.
    - [X] Include the `Suspense` fallback.
    - [X] Include the catch-all route (`*`).
    - [X] Export the `AppRouter` component.
- [X] **Create Index File:**
    - [X] Create `src/routing/index.ts`.
    - [X] Export the main `AppRouter` component from `src/routing/index.ts`.

## Phase 4: Integration & Cleanup

- [X] **Update Imports:**
    - [X] Update `src/main.tsx` to import `AppRouter` from `src/routing` (or `src/routing/index.ts`). // Updated src/App.tsx instead
    - [X] Check other files (e.g., `Layout.tsx`, components using `useNavigate` or `Link`) for any imports from the old `src/router/` path and update them if necessary (likely none if components were imported directly). // Verified none found
- [X] **Remove Old Router:**
    - [X] Delete the original `src/router/AppRouter.tsx` file (after verifying the new router works).
    - [X] Delete the backup file (`src/router/AppRouter_backup.tsx`).
    - [X] Delete the (now empty) `src/router/` directory.
- [X] **Testing:**
    - [X] Thoroughly test navigation for all route types:
        - [X] Public routes (e.g., `/login`, `/register`).
        - [X] Protected routes (e.g., `/dashboard`, `/agents`).
        - [X] Parameterized routes (e.g., `/agents/:agentId`, `/teams/:teamId`).
        - [X] Admin routes (e.g., `/admin`, `/admin/users`) - *Requires admin user*.
        - [X] Redirects (e.g., accessing protected route when logged out, accessing `/` when logged in).
        - [X] Catch-all route (`*`).
- [X] **Review File Lengths:**
    - [X] Check the line count of each file in `src/routing/`.
    - [ ] If any file exceeds ~450 lines, plan and execute further refactoring (e.g., splitting `routeConfig.tsx` if it becomes too large).

## Phase 5: Documentation

- [X] **Update `README.md`:**
    - [X] Update the "Project Structure" section in the root `README.md` to reflect the new `src/routing/` directory and its contents.
- [X] **Update `_change.logs`:**
    - [X] Add an entry to `src/_change.logs` or a new `src/routing/_change.logs` documenting the refactoring.