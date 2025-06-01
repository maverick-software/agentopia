-- Migration: Create ENUM types for user roles and team member status

-- Global roles for users within the platform
CREATE TYPE public.global_user_role AS ENUM (
    'SUPER_ADMIN',
    'DEVELOPER',
    'SUPPORT_REP',
    'CLIENT'
);

-- Status for team member invitations/membership
CREATE TYPE public.team_member_status AS ENUM (
    'PENDING',
    'ACTIVE',
    'INACTIVE'
); 