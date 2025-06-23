-- RLS Policies for client-logos bucket

-- 1. Public Read Access for Logos
-- Allows anyone to view/download files from the client-logos bucket.
CREATE POLICY "Public Read Access for client-logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'client-logos');

-- 2. Authenticated Users Can Upload Logos
-- Allows any authenticated user to upload new files to the client-logos bucket.
CREATE POLICY "Authenticated User Upload for client-logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'client-logos');

-- 3. Authenticated Users Can Update Logos
-- Allows any authenticated user to update existing files within the client-logos bucket.
-- Security Note: This is a permissive policy. Ideally, users should only be able to update logos they "own".
CREATE POLICY "Authenticated User Update for client-logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'client-logos')
WITH CHECK (bucket_id = 'client-logos');

-- 4. Authenticated Users Can Delete Logos
-- Allows any authenticated user to delete files from the client-logos bucket.
-- Security Note: Similar to updates, this is permissive.
CREATE POLICY "Authenticated User Delete for client-logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'client-logos'); 