-- Migration: Alter public.users table to remove the role column and its constraints

-- Drop the check constraint if it exists
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT conname, pg_get_constraintdef(oid) AS condef
        FROM pg_constraint
        WHERE conrelid = 'public.users'::regclass AND contype = 'c' -- 'c' for CHECK constraint
    LOOP
        IF constraint_record.condef LIKE '%role%' THEN
            RAISE NOTICE 'Dropping CHECK constraint "%" on public.users with definition: %', constraint_record.conname, constraint_record.condef;
            EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT ' || quote_ident(constraint_record.conname);
        END IF;
    END LOOP;

    -- As a fallback, explicitly try to drop a common known name if the loop didn't catch it (e.g. if the definition didn't contain 'role' but it's known)
    -- However, the loop should be more reliable. This is more of a safeguard.
    BEGIN
        ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
        RAISE NOTICE 'Attempted to drop users_role_check (IF EXISTS) as a fallback.';
    EXCEPTION WHEN undefined_object THEN
        RAISE NOTICE 'Fallback constraint users_role_check not found.';
    END;
END $$;

-- Drop the role column itself
ALTER TABLE public.users
DROP COLUMN IF EXISTS role;

COMMENT ON TABLE public.users IS 'The "role" column has been removed from public.users. Global user roles are now managed in public.profiles.global_role.'; 