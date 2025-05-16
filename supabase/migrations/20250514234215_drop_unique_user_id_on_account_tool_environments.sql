-- Migration: Drop unique constraint on user_id for account_tool_environments
-- This allows a user to have multiple toolbox environments.

-- Step 1: Drop the existing unique constraint on user_id
-- We use IF EXISTS to prevent an error if the constraint was already removed
-- or has a slightly different auto-generated name (though account_tool_environments_user_id_key is typical).
ALTER TABLE public.account_tool_environments
DROP CONSTRAINT IF EXISTS account_tool_environments_user_id_key;

-- Optional Step 2: Add a different unique constraint if needed.
-- For example, if a user should not have two toolboxes with the same name.
-- If toolbox names don't need to be unique per user, or if 'name' is not the correct column,
-- you can omit or modify this section.
--
-- ALTER TABLE public.account_tool_environments
-- ADD CONSTRAINT account_tool_environments_user_id_name_key UNIQUE (user_id, name);
--
-- Replace 'name' with the actual column name for the toolbox name if you use this.

-- End of migration
