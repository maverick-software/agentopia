-- Mailgun Integration Migration (Fixed - Handles Existing Objects)
-- Date: January 25, 2025
-- Purpose: Add Mailgun email service integration support

-- ============================================
-- 1. INSERT MAILGUN PROVIDER (IF NOT EXISTS)
-- ============================================

-- Insert Mailgun as an API key provider
INSERT INTO oauth_providers (
    id,
    name,
    display_name,
    authorization_endpoint,
    token_endpoint,
    scopes_supported,
    pkce_required,
    is_enabled,
    created_at
) 
SELECT
    gen_random_uuid(),
    'mailgun',
    'Mailgun Email Service',
    'https://api.mailgun.net/v3',
    'https://api.mailgun.net/v3',
    '["email_send", "email_receive", "email_analytics", "email_validate", "email_manage"]'::jsonb,
    false,
    true,
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM oauth_providers WHERE name = 'mailgun'
);

-- ============================================
-- 2. CREATE EMAIL DIRECTION ENUM
-- ============================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_direction_enum') THEN
        CREATE TYPE email_direction_enum AS ENUM ('inbound', 'outbound');
    END IF;
END$$;

-- ============================================
-- 3. CREATE MAILGUN CONFIGURATION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS mailgun_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_oauth_connection_id UUID REFERENCES user_oauth_connections(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    region VARCHAR(50) DEFAULT 'us' CHECK (region IN ('us', 'eu')),
    webhook_signing_key_id UUID,
    smtp_username VARCHAR(255),
    smtp_password_id UUID,
    webhook_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_mailgun UNIQUE(user_id),
    CONSTRAINT unique_connection_mailgun UNIQUE(user_oauth_connection_id)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_mailgun_configurations_user ON mailgun_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_mailgun_configurations_active ON mailgun_configurations(is_active);

-- Enable RLS
ALTER TABLE mailgun_configurations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view own mailgun configurations" ON mailgun_configurations;
CREATE POLICY "Users can view own mailgun configurations"
    ON mailgun_configurations FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own mailgun configurations" ON mailgun_configurations;
CREATE POLICY "Users can insert own mailgun configurations"
    ON mailgun_configurations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own mailgun configurations" ON mailgun_configurations;
CREATE POLICY "Users can update own mailgun configurations"
    ON mailgun_configurations FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own mailgun configurations" ON mailgun_configurations;
CREATE POLICY "Users can delete own mailgun configurations"
    ON mailgun_configurations FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 4. CREATE MAILGUN ROUTES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS mailgun_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailgun_config_id UUID REFERENCES mailgun_configurations(id) ON DELETE CASCADE,
    mailgun_route_id VARCHAR(255),
    priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0 AND priority <= 32767),
    expression TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_mailgun_route_id UNIQUE(mailgun_route_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mailgun_routes_config ON mailgun_routes(mailgun_config_id);
CREATE INDEX IF NOT EXISTS idx_mailgun_routes_agent ON mailgun_routes(agent_id);
CREATE INDEX IF NOT EXISTS idx_mailgun_routes_priority ON mailgun_routes(priority);
CREATE INDEX IF NOT EXISTS idx_mailgun_routes_active ON mailgun_routes(is_active);

-- Enable RLS
ALTER TABLE mailgun_routes ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies
DROP POLICY IF EXISTS "Users can view own mailgun routes" ON mailgun_routes;
CREATE POLICY "Users can view own mailgun routes"
    ON mailgun_routes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM mailgun_configurations
            WHERE mailgun_configurations.id = mailgun_routes.mailgun_config_id
            AND mailgun_configurations.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert own mailgun routes" ON mailgun_routes;
CREATE POLICY "Users can insert own mailgun routes"
    ON mailgun_routes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM mailgun_configurations
            WHERE mailgun_configurations.id = mailgun_routes.mailgun_config_id
            AND mailgun_configurations.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update own mailgun routes" ON mailgun_routes;
CREATE POLICY "Users can update own mailgun routes"
    ON mailgun_routes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM mailgun_configurations
            WHERE mailgun_configurations.id = mailgun_routes.mailgun_config_id
            AND mailgun_configurations.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM mailgun_configurations
            WHERE mailgun_configurations.id = mailgun_routes.mailgun_config_id
            AND mailgun_configurations.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete own mailgun routes" ON mailgun_routes;
CREATE POLICY "Users can delete own mailgun routes"
    ON mailgun_routes FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM mailgun_configurations
            WHERE mailgun_configurations.id = mailgun_routes.mailgun_config_id
            AND mailgun_configurations.user_id = auth.uid()
        )
    );

-- ============================================
-- 5. CREATE EMAIL LOGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailgun_message_id VARCHAR(255),
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    direction email_direction_enum NOT NULL,
    from_address VARCHAR(255),
    to_address VARCHAR(255),
    subject TEXT,
    status VARCHAR(50),
    event_data JSONB,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT check_direction CHECK (direction IN ('inbound', 'outbound'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_agent ON email_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_direction ON email_logs(direction);
CREATE INDEX IF NOT EXISTS idx_email_logs_processed ON email_logs(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_mailgun_id ON email_logs(mailgun_message_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies
DROP POLICY IF EXISTS "Users can view own email logs" ON email_logs;
CREATE POLICY "Users can view own email logs"
    ON email_logs FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert email logs" ON email_logs;
CREATE POLICY "Service role can insert email logs"
    ON email_logs FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view email logs for their agents" ON email_logs;
CREATE POLICY "Users can view email logs for their agents"
    ON email_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.id = email_logs.agent_id
            AND agents.user_id = auth.uid()
        )
    );

-- ============================================
-- 6. CREATE OR REPLACE HELPER FUNCTIONS
-- ============================================

-- Function to get Mailgun configuration for a user
CREATE OR REPLACE FUNCTION get_user_mailgun_config(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    domain VARCHAR(255),
    region VARCHAR(50),
    webhook_url VARCHAR(500),
    is_active BOOLEAN,
    api_key_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mc.id,
        mc.domain,
        mc.region,
        mc.webhook_url,
        mc.is_active,
        uoc.vault_access_token_id as api_key_id
    FROM mailgun_configurations mc
    JOIN user_oauth_connections uoc ON mc.user_oauth_connection_id = uoc.id
    WHERE mc.user_id = p_user_id
    AND mc.is_active = true
    LIMIT 1;
END;
$$;

-- Function to get Mailgun routes for a user
CREATE OR REPLACE FUNCTION get_user_mailgun_routes(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    mailgun_route_id VARCHAR(255),
    priority INTEGER,
    expression TEXT,
    action TEXT,
    description TEXT,
    agent_id UUID,
    agent_name VARCHAR(255),
    is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mr.id,
        mr.mailgun_route_id,
        mr.priority,
        mr.expression,
        mr.action,
        mr.description,
        mr.agent_id,
        a.name as agent_name,
        mr.is_active
    FROM mailgun_routes mr
    JOIN mailgun_configurations mc ON mr.mailgun_config_id = mc.id
    LEFT JOIN agents a ON mr.agent_id = a.id
    WHERE mc.user_id = p_user_id
    ORDER BY mr.priority ASC;
END;
$$;

-- Function to log email activity
CREATE OR REPLACE FUNCTION log_email_activity(
    p_mailgun_message_id VARCHAR(255),
    p_agent_id UUID,
    p_user_id UUID,
    p_direction email_direction_enum,
    p_from_address VARCHAR(255),
    p_to_address VARCHAR(255),
    p_subject TEXT,
    p_status VARCHAR(50),
    p_event_data JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO email_logs (
        mailgun_message_id,
        agent_id,
        user_id,
        direction,
        from_address,
        to_address,
        subject,
        status,
        event_data,
        processed_at
    ) VALUES (
        p_mailgun_message_id,
        p_agent_id,
        p_user_id,
        p_direction,
        p_from_address,
        p_to_address,
        p_subject,
        p_status,
        p_event_data,
        NOW()
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;

-- ============================================
-- 7. ADD UPDATED_AT TRIGGERS
-- ============================================

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate triggers
DROP TRIGGER IF EXISTS update_mailgun_configurations_updated_at ON mailgun_configurations;
CREATE TRIGGER update_mailgun_configurations_updated_at
    BEFORE UPDATE ON mailgun_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mailgun_routes_updated_at ON mailgun_routes;
CREATE TRIGGER update_mailgun_routes_updated_at
    BEFORE UPDATE ON mailgun_routes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. GRANT PERMISSIONS
-- ============================================

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON mailgun_configurations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mailgun_routes TO authenticated;
GRANT SELECT ON email_logs TO authenticated;
GRANT INSERT ON email_logs TO service_role;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_user_mailgun_config(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_mailgun_routes(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_email_activity(VARCHAR, UUID, UUID, email_direction_enum, VARCHAR, VARCHAR, TEXT, VARCHAR, JSONB) TO service_role;

-- ============================================
-- 9. ADD COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE mailgun_configurations IS 'Stores Mailgun API configuration and settings for each user';
COMMENT ON TABLE mailgun_routes IS 'Defines email routing rules for inbound emails via Mailgun';
COMMENT ON TABLE email_logs IS 'Logs all email activity (sent and received) through Mailgun';

COMMENT ON COLUMN mailgun_configurations.domain IS 'The Mailgun domain for sending emails';
COMMENT ON COLUMN mailgun_configurations.region IS 'Mailgun region (us or eu)';
COMMENT ON COLUMN mailgun_routes.priority IS 'Route priority (0-32767, lower = higher priority)';
COMMENT ON COLUMN mailgun_routes.expression IS 'Mailgun route expression for matching emails';
COMMENT ON COLUMN mailgun_routes.action IS 'Action to take when route matches';
COMMENT ON COLUMN email_logs.direction IS 'Whether email was inbound or outbound';

-- ============================================
-- Migration complete!
-- ============================================
