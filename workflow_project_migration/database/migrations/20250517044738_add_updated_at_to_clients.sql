-- Add updated_at column to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create or replace the trigger to automatically update updated_at on row modification
-- (Assuming the function public.update_updated_at_column() already exists as seen in schema dump)
DROP TRIGGER IF EXISTS handle_clients_updated_at ON public.clients;
CREATE TRIGGER handle_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON COLUMN public.clients.updated_at IS 'Timestamp of the last update to the client record.';
