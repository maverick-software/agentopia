-- Migration: Add Roles, User Roles, and Profiles Tables

-- 1. Create roles table
CREATE TABLE public.roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.roles IS 'Stores user roles (e.g., admin, user)';
COMMENT ON COLUMN public.roles.name IS 'Unique name of the role';

-- Add RLS policy for roles (allow authenticated read)
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read access" ON public.roles
    FOR SELECT
    TO authenticated
    USING (true);

-- 2. Create user_roles table (join table)
CREATE TABLE public.user_roles (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, role_id)
);

COMMENT ON TABLE public.user_roles IS 'Maps users to their roles';

-- Add RLS policy for user_roles (allow users to see their own roles, service_role for all)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow individual user read access" ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
-- Note: For admin functions needing to modify/read all roles, they will use service_role key


-- 3. Create profiles table
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username text UNIQUE,
    full_name text,
    avatar_url text,
    updated_at timestamp with time zone
);

COMMENT ON TABLE public.profiles IS 'Stores public profile information for users';
COMMENT ON COLUMN public.profiles.id IS 'References auth.users.id';

-- Add RLS policy for profiles (allow users full access to own profile, authenticated read for others)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow individual user CRUD access" ON public.profiles
    FOR ALL
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow authenticated read access" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);


-- 4. Seed initial roles
INSERT INTO public.roles (name, description) VALUES
    ('admin', 'Administrator with full system access'),
    ('user', 'Standard user with access to create and manage their own agents');

-- 5. (Optional) Function to automatically create a profile when a new user signs up
-- From: https://supabase.com/docs/guides/getting-started/tutorials/with-react#create-user-profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  -- Optionally assign default 'user' role here? Or handle via app logic/admin assignment.
  -- INSERT INTO public.user_roles (user_id, role_id)
  -- VALUES (new.id, (SELECT id FROM public.roles WHERE name = 'user'));
  RETURN new;
END;
$$;

-- Trigger the function after user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user(); 