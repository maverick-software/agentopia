-- Migration: Setup profile images storage bucket and RLS policies
-- Timestamp: 20250520001501 (Renamed from 20250519144213)

BEGIN;

-- 1. Ensure the 'profile-images' bucket exists and is configured.
-- This attempts to insert the bucket. If it already exists, it updates its public status,
-- file size limit, and allowed MIME types to ensure they are correctly set.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-images', 
    'profile-images', 
    true, 
    5242880, -- 5MB limit (5 * 1024 * 1024)
    ARRAY['image/jpeg', 'image/png', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Drop existing policies for this bucket to ensure a clean slate and avoid conflicts.
-- This makes the migration idempotent if it needs to be re-run or modified.
DROP POLICY IF EXISTS "Allow public read access to profile images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload to own profile-images folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow update of own avatar in profile-images folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete of own avatar in profile-images folder" ON storage.objects;

-- 4. RLS Policies for 'profile-images' bucket on storage.objects table.

-- Policy: Allow public read access to files in 'profile-images' bucket.
-- This makes avatar URLs publicly accessible if the bucket is public.
CREATE POLICY "Allow public read access to profile images"
ON storage.objects FOR SELECT
TO anon, authenticated -- Allows anyone (anonymous and authenticated users) to read
USING (bucket_id = 'profile-images');

-- Policy: Allow authenticated users to upload (insert) new avatars into their own folder.
-- The file path is expected to be '{user_id}/filename.ext'.
CREATE POLICY "Allow authenticated upload to own profile-images folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images' AND
  auth.uid() = (string_to_array(name, '/'))[1]::uuid
  -- Optional: You could add more checks here, e.g., for file size or type, if desired,
  -- though bucket-level settings (file_size_limit, allowed_mime_types) often cover this.
);

-- Policy: Allow authenticated users to update (overwrite) their own avatar.
CREATE POLICY "Allow update of own avatar in profile-images folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  auth.uid() = (string_to_array(name, '/'))[1]::uuid
)
WITH CHECK ( -- Ensures the user is still the owner of the path during update
  bucket_id = 'profile-images' AND
  auth.uid() = (string_to_array(name, '/'))[1]::uuid
);

-- Policy: Allow authenticated users to delete their own avatar.
CREATE POLICY "Allow delete of own avatar in profile-images folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  auth.uid() = (string_to_array(name, '/'))[1]::uuid
);

COMMIT; 