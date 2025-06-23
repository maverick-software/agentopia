ALTER TABLE public.clients
ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Optional: If you want to make it NOT NULL, you would first need to ensure all existing rows have a value.
-- Then you could run:
-- ALTER TABLE public.clients
-- ALTER COLUMN created_by SET NOT NULL;
--
-- COMMENT ON COLUMN public.clients.created_by IS 'The user ID of the authenticated user who created the client record. Defaults to auth.uid().';
