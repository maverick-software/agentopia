-- Migration: Enable RLS and implement initial policies for profiles and clients

-- Enable RLS for relevant tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_defined_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_member_assigned_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public.profiles table

-- Users can view their own profile.
CREATE POLICY "Profiles: Enable read access for own user" 
ON public.profiles
FOR SELECT 
USING (auth.uid() = auth_user_id);

-- Users can update their own profile.
CREATE POLICY "Profiles: Enable update access for own user" 
ON public.profiles
FOR UPDATE 
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- Super Admins, Developers, and Support Reps can view all profiles.
CREATE POLICY "Profiles: Admins/Support can read all profiles" 
ON public.profiles
FOR SELECT 
USING (
    public.is_super_admin(auth.uid()) OR 
    public.is_developer(auth.uid()) OR 
    public.is_support_rep(auth.uid())
);

-- Super Admins and Developers can update any profile (e.g., for administrative changes).
CREATE POLICY "Profiles: SuperAdmins/Developers can update any profile" 
ON public.profiles
FOR UPDATE
USING (public.is_super_admin(auth.uid()) OR public.is_developer(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_developer(auth.uid()));

-- Super Admins and Developers can delete profiles (use with caution).
CREATE POLICY "Profiles: SuperAdmins/Developers can delete any profile" 
ON public.profiles
FOR DELETE
USING (public.is_super_admin(auth.uid()) OR public.is_developer(auth.uid()));

-- RLS Policies for public.clients table

-- Client role users (owners) can select their own client record (identified by owner_auth_user_id).
CREATE POLICY "Clients: Owners can read their own client record" 
ON public.clients
FOR SELECT
USING (auth.uid() = owner_auth_user_id AND public.is_client_role(auth.uid()));

-- Client role users (owners) can update their own client record.
CREATE POLICY "Clients: Owners can update their own client record" 
ON public.clients
FOR UPDATE
USING (auth.uid() = owner_auth_user_id AND public.is_client_role(auth.uid()))
WITH CHECK (auth.uid() = owner_auth_user_id AND public.is_client_role(auth.uid()));

-- Super Admins, Developers, and Support Reps can view all client records.
CREATE POLICY "Clients: Admins/Support can read all client records" 
ON public.clients
FOR SELECT
USING (
    public.is_super_admin(auth.uid()) OR 
    public.is_developer(auth.uid()) OR 
    public.is_support_rep(auth.uid())
);

-- Super Admins and Developers can create new client records.
CREATE POLICY "Clients: SuperAdmins/Developers can create client records" 
ON public.clients
FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_developer(auth.uid()));

-- Super Admins and Developers can update any client record.
CREATE POLICY "Clients: SuperAdmins/Developers can update any client record" 
ON public.clients
FOR UPDATE
USING (public.is_super_admin(auth.uid()) OR public.is_developer(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_developer(auth.uid()));

-- Super Admins and Developers can delete client records (use with extreme caution, consider soft deletes).
CREATE POLICY "Clients: SuperAdmins/Developers can delete client records" 
ON public.clients
FOR DELETE
USING (public.is_super_admin(auth.uid()) OR public.is_developer(auth.uid()));

-- Note: These are initial policies. More granular policies, especially for team members
-- and for other tables, will be added. Ensure a default-deny stance by not having permissive
-- public access policies unless explicitly intended. 