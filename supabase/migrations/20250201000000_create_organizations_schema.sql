-- Migration: Create Organizations Schema for Multi-Tenant MCP Support
-- This migration establishes the foundation for multi-tenant MCP server management

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Organizations table - Core multi-tenant entity
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, -- URL-friendly identifier  
    settings JSONB DEFAULT '{}'::jsonb,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    max_mcp_servers INTEGER DEFAULT 5,
    max_concurrent_connections INTEGER DEFAULT 50,
    logo_url TEXT,
    website_url TEXT,
    contact_email TEXT,
    billing_email TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.organizations IS 'Multi-tenant organizations for MCP server management';
COMMENT ON COLUMN public.organizations.slug IS 'URL-friendly unique identifier for organizations';
COMMENT ON COLUMN public.organizations.max_mcp_servers IS 'Maximum number of MCP servers allowed for this organization';
COMMENT ON COLUMN public.organizations.max_concurrent_connections IS 'Maximum concurrent MCP connections allowed';

-- Organization memberships table - User-Organization relationships
CREATE TABLE public.organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    permissions JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'removed')),
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id, organization_id)
);

COMMENT ON TABLE public.organization_memberships IS 'User memberships in organizations with roles and permissions';
COMMENT ON COLUMN public.organization_memberships.role IS 'User role within the organization';
COMMENT ON COLUMN public.organization_memberships.permissions IS 'Additional specific permissions for this user';

-- Organization invitations table - Track pending invitations
CREATE TABLE public.organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
    permissions JSONB DEFAULT '[]'::jsonb,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(organization_id, email)
);

COMMENT ON TABLE public.organization_invitations IS 'Pending invitations to join organizations';

-- Organization API keys table - API access management
CREATE TABLE public.organization_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE, -- Hashed API key for security
    permissions JSONB DEFAULT '[]'::jsonb,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(organization_id, name)
);

COMMENT ON TABLE public.organization_api_keys IS 'API keys for programmatic access to organization resources';

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER handle_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_organization_memberships_updated_at
    BEFORE UPDATE ON public.organization_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX idx_organizations_slug ON public.organizations(slug);
CREATE INDEX idx_organizations_active ON public.organizations(is_active);
CREATE INDEX idx_organization_memberships_user ON public.organization_memberships(user_id);
CREATE INDEX idx_organization_memberships_org ON public.organization_memberships(organization_id);
CREATE INDEX idx_organization_memberships_status ON public.organization_memberships(status);
CREATE INDEX idx_organization_memberships_role ON public.organization_memberships(role);
CREATE INDEX idx_organization_invitations_token ON public.organization_invitations(token);
CREATE INDEX idx_organization_invitations_email ON public.organization_invitations(email);
CREATE INDEX idx_organization_invitations_expires ON public.organization_invitations(expires_at);
CREATE INDEX idx_organization_api_keys_hash ON public.organization_api_keys(key_hash);
CREATE INDEX idx_organization_api_keys_org_active ON public.organization_api_keys(organization_id, is_active);

-- Helper functions for organization management
CREATE OR REPLACE FUNCTION public.is_organization_member(
    user_id UUID,
    org_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE user_id = is_organization_member.user_id 
        AND organization_id = org_id 
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_organization_role(
    user_id UUID,
    org_id UUID
) RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM public.organization_memberships
    WHERE user_id = get_user_organization_role.user_id 
    AND organization_id = org_id 
    AND status = 'active';
    
    RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_organization_permission(
    user_id UUID,
    org_id UUID,
    permission TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    user_permissions JSONB;
BEGIN
    SELECT role, permissions INTO user_role, user_permissions
    FROM public.organization_memberships
    WHERE user_id = has_organization_permission.user_id 
    AND organization_id = org_id 
    AND status = 'active';
    
    -- Owners and admins have all permissions
    IF user_role IN ('owner', 'admin') THEN
        RETURN TRUE;
    END IF;
    
    -- Check specific permissions
    RETURN user_permissions @> jsonb_build_array(permission);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to generate API key
CREATE OR REPLACE FUNCTION public.generate_organization_api_key()
RETURNS TEXT AS $$
BEGIN
    RETURN 'agnt_' || encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Function to validate organization slug
CREATE OR REPLACE FUNCTION public.validate_organization_slug(slug TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Slug must be 3-50 characters, lowercase, alphanumeric with hyphens
    RETURN slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add constraint for slug validation
ALTER TABLE public.organizations 
ADD CONSTRAINT check_valid_slug 
CHECK (public.validate_organization_slug(slug));

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view organizations they are members of" ON public.organizations
    FOR SELECT USING (
        id IN (
            SELECT organization_id 
            FROM public.organization_memberships 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Users can create organizations" ON public.organizations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Organization owners can update their organizations" ON public.organizations
    FOR UPDATE USING (
        id IN (
            SELECT organization_id 
            FROM public.organization_memberships 
            WHERE user_id = auth.uid() 
            AND role = 'owner' 
            AND status = 'active'
        )
    );

-- RLS Policies for organization memberships
CREATE POLICY "Users can view memberships in their organizations" ON public.organization_memberships
    FOR SELECT USING (
        user_id = auth.uid() OR
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_memberships 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin') 
            AND status = 'active'
        )
    );

CREATE POLICY "Organization admins can manage memberships" ON public.organization_memberships
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_memberships 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin') 
            AND status = 'active'
        )
    );

-- RLS Policies for organization invitations
CREATE POLICY "Organization admins can manage invitations" ON public.organization_invitations
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_memberships 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin') 
            AND status = 'active'
        )
    );

-- RLS Policies for organization API keys
CREATE POLICY "Organization admins can manage API keys" ON public.organization_api_keys
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_memberships 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin') 
            AND status = 'active'
        )
    ); 