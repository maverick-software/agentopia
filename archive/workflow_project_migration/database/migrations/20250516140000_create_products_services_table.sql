-- supabase/migrations/20250516140000_create_products_services_table.sql

CREATE TABLE public.products_services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    item_type text NOT NULL CHECK (item_type IN ('Product', 'Service')),
    price numeric(10, 2) CHECK (price >= 0),
    status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Active', 'Inactive', 'Draft', 'Archived')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.products_services ENABLE ROW LEVEL SECURITY;

-- Trigger to automatically update "updated_at" timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_updated_at
    BEFORE UPDATE ON public.products_services
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Policies for products_services:
-- This is a placeholder and needs to be adjusted for your specific user authorization model.
-- For initial development, you might use a more permissive policy,
-- but ensure it's tightened for production.
CREATE POLICY "Allow authenticated users to manage products/services"
ON public.products_services
FOR ALL
TO authenticated
USING (
    -- Example: Ensure the user is associated with the client.
    -- This assumes your 'clients' table has a 'created_by' column linked to 'auth.uid()'.
    -- Adjust this condition based on your actual data model and authorization logic.
    EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = products_services.client_id
        -- AND c.created_by = auth.uid() -- Uncomment and adapt if clients are owned by users
    )
    -- Or, for a very basic setup (less secure, for dev only):
    -- true
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = products_services.client_id
        -- AND c.created_by = auth.uid() -- Uncomment and adapt
    )
    -- Or, for a very basic setup (less secure, for dev only):
    -- true
);

COMMENT ON TABLE public.products_services IS 'Stores products and services offered to clients.';
COMMENT ON COLUMN public.products_services.item_type IS 'Differentiates between a Product or a Service.';
COMMENT ON COLUMN public.products_services.status IS 'Current status of the product/service offering.'; 