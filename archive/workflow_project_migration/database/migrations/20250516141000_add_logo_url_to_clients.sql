-- Add logo_url column to clients table

ALTER TABLE public.clients
ADD COLUMN logo_url TEXT NULL;

-- Optional: Add a comment to the column
COMMENT ON COLUMN public.clients.logo_url IS 'Stores the public URL of the client_s logo stored in Supabase Storage.'; 