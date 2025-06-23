-- Migration: Create team_member_assigned_roles join table

CREATE TABLE public.team_member_assigned_roles (
    team_member_auth_user_id UUID NOT NULL, -- FK to auth.users.id
    client_id UUID NOT NULL, -- FK to clients.id
    client_defined_role_id UUID NOT NULL REFERENCES public.client_defined_roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT now() NOT NULL,

    PRIMARY KEY (team_member_auth_user_id, client_id, client_defined_role_id),
    -- Establishes a link to a specific team membership instance.
    -- Assumes a UNIQUE constraint (auth_user_id, client_id) exists on public.team_members table.
    FOREIGN KEY (team_member_auth_user_id, client_id) REFERENCES public.team_members (auth_user_id, client_id) ON DELETE CASCADE
);

-- Note: This table typically does not have an 'updated_at' column as rows are usually inserted/deleted
-- rather than updated in place for a join table representing assignments. 