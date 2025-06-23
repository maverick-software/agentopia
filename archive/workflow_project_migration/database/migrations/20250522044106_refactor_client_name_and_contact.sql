-- Step 1: Add the new primary_contact_name column
ALTER TABLE public.clients
ADD COLUMN primary_contact_name TEXT NULL;

-- Step 2: Copy existing contact names (from current 'name' column) to 'primary_contact_name'
-- Only update if 'name' is not null and (for safety) if primary_contact_name is currently null
UPDATE public.clients
SET primary_contact_name = name
WHERE name IS NOT NULL AND primary_contact_name IS NULL;

-- Step 3: Copy existing business names (from 'business_name' column) to 'name' column
-- Only update if 'business_name' is not null
UPDATE public.clients
SET name = business_name
WHERE business_name IS NOT NULL;

-- Step 4: (Optional but recommended for clarity) Make 'business_name' nullable
-- as new code should use 'name' for business name and 'primary_contact_name' for the contact.
-- We will not drop it yet to ensure no data loss and allow for rollback if needed.
ALTER TABLE public.clients
ALTER COLUMN business_name DROP NOT NULL;

-- Step 5: Ensure 'name' (which is now business name) remains NOT NULL (it should be already, but as a safeguard)
ALTER TABLE public.clients
ALTER COLUMN name SET NOT NULL;

COMMENT ON COLUMN public.clients.name IS 'The official business name of the client.';
COMMENT ON COLUMN public.clients.primary_contact_name IS 'The name of the primary contact person for this client.';
COMMENT ON COLUMN public.clients.business_name IS '''Legacy column for business name. New implementations should use ''''name'''' for business name. This column will be removed in a future migration.''';
