# Chat Rooms & Channels - Implementation Plan

## 1. Goals

*   Implement a multi-user chat system within Agentopia, mimicking key features of Discord (Servers/Rooms, Channels, Members, Realtime Messages).
*   Integrate AI agents as participants within these chat rooms.
*   Provide basic context (current room, channel, members) to agents operating within a channel.
*   Lay the foundation for future agent task execution initiated from chat.
*   Ensure the system aligns with the broader Agentopia vision of mixing human and AI collaboration.

## 2. Architecture Overview

*   **Frontend:** React (Vite + TypeScript) using components, hooks, and context for state management.
*   **Backend (Database & Auth):** Supabase PostgreSQL for data storage (rooms, channels, members, messages) and user authentication.
*   **Backend (API Layer):** Supabase Edge Functions will initially handle API requests from the frontend (e.g., creating rooms/channels, fetching data). Custom React Hooks (`src/hooks/`) will abstract these calls.
*   **Backend (Realtime):** Supabase Realtime will be used for broadcasting new messages and potentially membership updates within channels.
*   **Agent Integration:** Agents (running potentially as separate processes managed elsewhere, e.g., `discord-worker`) will interact via the database and potentially specific API functions/tools. Context will be injected into agent prompts or provided via dedicated tools.

## 3. Key Features (Scope for this WBS)

*   **Chat Rooms:** Creation, listing, basic settings (name).
*   **Chat Channels:** Creation within rooms, listing, naming, optional topic.
*   **Membership:** Adding/removing users, agents, and teams to rooms. Viewing members.
*   **Messaging:** Sending/receiving realtime messages within channels. Displaying message history.
*   **Agent Context:** Providing `current_room_id`, `current_channel_id`, and `room_members` list to agents.
*   **Basic Agent Tools:** `get_room_members`, `list_room_channels`, updated `search_chat_history` (scoped to channel).

## 4. Phasing (Reflected in WBS Checklist)

1.  **Database Schema:** Define and migrate all necessary tables, RLS policies, and helper functions. (Now Complete)
2.  **Backend & API Layer:** Implement React hooks and potentially Supabase functions to interact with the database schema for rooms, channels, members, and messages.
3.  **Frontend UI:** Develop React components for displaying rooms, channels, members, and the chat interface itself. Integrate hooks for data fetching and actions.
4.  **Agent Integration & Tools:** Ensure context injection works and implement the defined agent tools.
5.  **Testing & Refinement:** Thoroughly test all features, including RLS, realtime updates, and agent interactions. Refine UI/UX.
6.  **Future Enhancements (Placeholders):** Note items like agent task execution framework, external agents, and architectural review for future planning.

## 5. Assumptions & Dependencies

*   Existing Supabase project setup.
*   Existing user authentication system (Supabase Auth).
*   Existing `teams` table structure (referenced by `user_team_memberships`).
*   The `is_room_member` helper function (created in Phase 1) works correctly.
*   Agent execution environment exists separately and can be provided with necessary context/tools. 