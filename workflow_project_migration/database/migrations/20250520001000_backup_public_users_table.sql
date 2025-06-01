-- Migration: Backup public.users table before refactoring roles

CREATE TABLE public.users_backup_20250520 AS TABLE public.users;

COMMENT ON TABLE public.users_backup_20250520 IS 'Backup of public.users table taken on 2025-05-20 before refactoring the user role system.'; 