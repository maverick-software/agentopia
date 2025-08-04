-- SendGrid Email Routing and Rules Tables
-- Date: August 2, 2025
-- Purpose: Create tables for email routing rules and inbound email storage

-- Create email_routing_rules table
CREATE TABLE IF NOT EXISTS email_routing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sendgrid_config_id UUID NOT NULL REFERENCES sendgrid_configurations(id) ON DELETE CASCADE,
    agent_id UUID,  -- If null, applies to all agents
    
    -- Rule definition
    rule_name TEXT NOT NULL,
    priority INTEGER DEFAULT 100,  -- Lower number = higher priority
    
    -- Conditions (all must match)
    conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    /* Example conditions:
    {
        "from": {"contains": "@important-client.com"},
        "subject": {"matches": "^URGENT:"},
        "to": {"equals": "support@myapp.com"},
        "has_attachment": true,
        "body": {"contains": "invoice"}
    }
    */
    
    -- Actions
    actions JSONB NOT NULL DEFAULT '{}'::jsonb,
    /* Example actions:
    {
        "forward_to": "escalation@myapp.com",
        "add_labels": ["urgent", "client"],
        "trigger_webhook": "https://myapp.com/urgent-handler",
        "auto_reply_template": "urgent_acknowledgment",
        "assign_to_agent": "agent-uuid",
        "stop_processing": false
    }
    */
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_matched_at TIMESTAMPTZ,
    match_count INTEGER DEFAULT 0
);

-- Create inbound_emails table
CREATE TABLE IF NOT EXISTS inbound_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sendgrid_config_id UUID NOT NULL REFERENCES sendgrid_configurations(id) ON DELETE CASCADE,
    agent_id UUID,  -- Agent that received the email
    
    -- Email data
    message_id TEXT NOT NULL,        -- SendGrid message ID
    from_email TEXT NOT NULL,
    from_name TEXT,
    to_emails TEXT[] NOT NULL,
    cc_emails TEXT[],
    bcc_emails TEXT[],
    subject TEXT,
    
    -- Content
    text_body TEXT,
    html_body TEXT,
    headers JSONB,
    attachments JSONB DEFAULT '[]'::jsonb,
    /* Attachment format:
    [
        {
            "filename": "document.pdf",
            "content_type": "application/pdf",
            "size": 12345,
            "storage_url": "path/to/stored/file",
            "content_id": "optional-cid-for-inline"
        }
    ]
    */
    
    -- Processing
    routing_rules_applied UUID[],    -- IDs of rules that matched
    processed_at TIMESTAMPTZ DEFAULT now(),
    processing_status TEXT DEFAULT 'processed' CHECK (processing_status IN ('processed', 'failed', 'pending', 'quarantined')),
    processing_errors JSONB,
    
    -- Email metadata
    spam_score FLOAT,
    spf_check TEXT,
    dkim_check TEXT,
    envelope JSONB,                  -- SMTP envelope data
    charsets JSONB,                  -- Character encoding info
    raw_webhook_data JSONB,          -- Original webhook payload (for debugging)
    
    -- Threading
    in_reply_to TEXT,                -- Message-ID this is replying to
    references TEXT[],               -- Chain of message IDs
    thread_id UUID,                  -- Internal thread grouping
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create scheduled_email_actions table
CREATE TABLE IF NOT EXISTS scheduled_email_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sendgrid_config_id UUID NOT NULL REFERENCES sendgrid_configurations(id) ON DELETE CASCADE,
    inbound_email_id UUID REFERENCES inbound_emails(id) ON DELETE CASCADE,
    agent_id UUID,
    
    -- Action details
    action_type TEXT NOT NULL,       -- 'send_reminder', 'escalate', 'auto_reply', etc.
    action_params JSONB NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    executed_at TIMESTAMPTZ,
    execution_result JSONB,
    retry_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create email_labels table for organizing emails
CREATE TABLE IF NOT EXISTS email_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sendgrid_config_id UUID NOT NULL REFERENCES sendgrid_configurations(id) ON DELETE CASCADE,
    
    label_name TEXT NOT NULL,
    label_color TEXT DEFAULT '#808080',  -- Hex color
    description TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(sendgrid_config_id, label_name)
);

-- Create email_label_assignments junction table
CREATE TABLE IF NOT EXISTS email_label_assignments (
    inbound_email_id UUID NOT NULL REFERENCES inbound_emails(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES email_labels(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    assigned_by UUID REFERENCES auth.users(id),
    PRIMARY KEY (inbound_email_id, label_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_routing_rules_priority ON email_routing_rules(sendgrid_config_id, priority) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_routing_rules_agent ON email_routing_rules(agent_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_inbound_emails_recent ON inbound_emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_agent ON inbound_emails(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_from ON inbound_emails(from_email);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_message_id ON inbound_emails(message_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_thread ON inbound_emails(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_pending ON scheduled_email_actions(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_label_assignments ON email_label_assignments(inbound_email_id);

-- Enable Row Level Security
ALTER TABLE email_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_email_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_label_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_routing_rules
CREATE POLICY "Users can manage their routing rules" ON email_routing_rules
    FOR ALL USING (
        sendgrid_config_id IN (
            SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for inbound_emails
CREATE POLICY "Users can view their inbound emails" ON inbound_emails
    FOR SELECT USING (
        sendgrid_config_id IN (
            SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage inbound emails" ON inbound_emails
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for scheduled_email_actions
CREATE POLICY "Users can view their scheduled actions" ON scheduled_email_actions
    FOR SELECT USING (
        sendgrid_config_id IN (
            SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their scheduled actions" ON scheduled_email_actions
    FOR ALL USING (
        sendgrid_config_id IN (
            SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage scheduled actions" ON scheduled_email_actions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for email_labels
CREATE POLICY "Users can manage their labels" ON email_labels
    FOR ALL USING (
        sendgrid_config_id IN (
            SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for email_label_assignments
CREATE POLICY "Users can manage label assignments" ON email_label_assignments
    FOR ALL USING (
        inbound_email_id IN (
            SELECT id FROM inbound_emails WHERE sendgrid_config_id IN (
                SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
            )
        )
    );

-- Update timestamp triggers
CREATE TRIGGER update_email_routing_rules_updated_at
    BEFORE UPDATE ON email_routing_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_sendgrid_updated_at();

CREATE TRIGGER update_scheduled_email_actions_updated_at
    BEFORE UPDATE ON scheduled_email_actions
    FOR EACH ROW
    EXECUTE FUNCTION update_sendgrid_updated_at();

-- Function to process inbound email
CREATE OR REPLACE FUNCTION process_inbound_email(
    p_webhook_data JSONB,
    p_sendgrid_config_id UUID
) RETURNS UUID AS $$
DECLARE
    v_email_id UUID;
    v_agent_id UUID;
    v_to_address TEXT;
    v_local_part TEXT;
    v_domain TEXT;
BEGIN
    -- Extract primary recipient
    v_to_address := p_webhook_data->>'to';
    
    -- Parse email address
    IF v_to_address ~ '^([^@]+)@([^@]+)$' THEN
        v_local_part := substring(v_to_address from '^([^@]+)@');
        v_domain := substring(v_to_address from '@([^@]+)$');
        
        -- Find agent by email address
        SELECT agent_id INTO v_agent_id
        FROM agent_email_addresses
        WHERE local_part = v_local_part
        AND domain = v_domain
        AND sendgrid_config_id = p_sendgrid_config_id
        AND is_active = true;
    END IF;
    
    -- Insert email record
    INSERT INTO inbound_emails (
        sendgrid_config_id,
        agent_id,
        message_id,
        from_email,
        from_name,
        to_emails,
        cc_emails,
        subject,
        text_body,
        html_body,
        headers,
        spam_score,
        spf_check,
        dkim_check,
        envelope,
        charsets,
        raw_webhook_data
    ) VALUES (
        p_sendgrid_config_id,
        v_agent_id,
        COALESCE(p_webhook_data->>'message_id', gen_random_uuid()::text),
        p_webhook_data->>'from',
        p_webhook_data->>'from_name',
        string_to_array(p_webhook_data->>'to', ','),
        CASE WHEN p_webhook_data->>'cc' IS NOT NULL 
            THEN string_to_array(p_webhook_data->>'cc', ',') 
            ELSE NULL 
        END,
        p_webhook_data->>'subject',
        p_webhook_data->>'text',
        p_webhook_data->>'html',
        p_webhook_data->'headers',
        CASE WHEN p_webhook_data->>'spam_score' IS NOT NULL 
            THEN (p_webhook_data->>'spam_score')::float 
            ELSE NULL 
        END,
        p_webhook_data->>'SPF',
        p_webhook_data->>'dkim',
        p_webhook_data->'envelope',
        p_webhook_data->'charsets',
        p_webhook_data
    ) RETURNING id INTO v_email_id;
    
    -- Apply routing rules
    PERFORM apply_email_routing_rules(v_email_id);
    
    RETURN v_email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to apply routing rules
CREATE OR REPLACE FUNCTION apply_email_routing_rules(p_email_id UUID)
RETURNS void AS $$
DECLARE
    v_email RECORD;
    v_rule RECORD;
    v_applied_rules UUID[] = '{}';
    v_stop_processing BOOLEAN = false;
BEGIN
    -- Get email details
    SELECT * INTO v_email FROM inbound_emails WHERE id = p_email_id;
    
    -- Get applicable routing rules
    FOR v_rule IN 
        SELECT * FROM email_routing_rules 
        WHERE sendgrid_config_id = v_email.sendgrid_config_id
        AND is_active = true
        AND (agent_id IS NULL OR agent_id = v_email.agent_id)
        ORDER BY priority ASC, created_at ASC
    LOOP
        -- Check if rule conditions match
        IF evaluate_routing_conditions(v_rule.conditions, v_email) THEN
            -- Execute rule actions
            PERFORM execute_routing_actions(v_rule.actions, p_email_id);
            
            -- Track applied rule
            v_applied_rules := array_append(v_applied_rules, v_rule.id);
            
            -- Update rule statistics
            UPDATE email_routing_rules 
            SET last_matched_at = now(), 
                match_count = match_count + 1
            WHERE id = v_rule.id;
            
            -- Check if we should stop processing
            IF (v_rule.actions->>'stop_processing')::boolean THEN
                v_stop_processing := true;
                EXIT;
            END IF;
        END IF;
    END LOOP;
    
    -- Update email with applied rules
    UPDATE inbound_emails 
    SET routing_rules_applied = v_applied_rules 
    WHERE id = p_email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to evaluate routing conditions
CREATE OR REPLACE FUNCTION evaluate_routing_conditions(
    p_conditions JSONB,
    p_email RECORD
) RETURNS BOOLEAN AS $$
DECLARE
    v_key TEXT;
    v_condition JSONB;
    v_operator TEXT;
    v_value TEXT;
BEGIN
    -- If no conditions, always match
    IF p_conditions = '{}'::jsonb THEN
        RETURN true;
    END IF;
    
    -- Check each condition
    FOR v_key, v_condition IN SELECT * FROM jsonb_each(p_conditions)
    LOOP
        -- Extract operator and value
        v_operator := jsonb_object_keys(v_condition) LIMIT 1;
        v_value := v_condition->>v_operator;
        
        -- Evaluate based on field and operator
        CASE v_key
            WHEN 'from' THEN
                IF NOT evaluate_text_condition(p_email.from_email, v_operator, v_value) THEN
                    RETURN false;
                END IF;
            WHEN 'subject' THEN
                IF NOT evaluate_text_condition(p_email.subject, v_operator, v_value) THEN
                    RETURN false;
                END IF;
            WHEN 'body' THEN
                IF NOT evaluate_text_condition(
                    COALESCE(p_email.text_body, '') || ' ' || COALESCE(p_email.html_body, ''), 
                    v_operator, 
                    v_value
                ) THEN
                    RETURN false;
                END IF;
            WHEN 'has_attachment' THEN
                IF (v_value::boolean) != (jsonb_array_length(p_email.attachments) > 0) THEN
                    RETURN false;
                END IF;
            ELSE
                -- Unknown condition, skip
                NULL;
        END CASE;
    END LOOP;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Helper function for text condition evaluation
CREATE OR REPLACE FUNCTION evaluate_text_condition(
    p_text TEXT,
    p_operator TEXT,
    p_value TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    CASE p_operator
        WHEN 'equals' THEN
            RETURN p_text = p_value;
        WHEN 'contains' THEN
            RETURN p_text ILIKE '%' || p_value || '%';
        WHEN 'matches' THEN
            RETURN p_text ~ p_value;
        WHEN 'starts_with' THEN
            RETURN p_text ILIKE p_value || '%';
        WHEN 'ends_with' THEN
            RETURN p_text ILIKE '%' || p_value;
        ELSE
            RETURN false;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to execute routing actions
CREATE OR REPLACE FUNCTION execute_routing_actions(
    p_actions JSONB,
    p_email_id UUID
) RETURNS void AS $$
DECLARE
    v_label TEXT;
    v_label_id UUID;
BEGIN
    -- Add labels if specified
    IF p_actions ? 'add_labels' THEN
        FOR v_label IN SELECT * FROM jsonb_array_elements_text(p_actions->'add_labels')
        LOOP
            -- Get or create label
            INSERT INTO email_labels (sendgrid_config_id, label_name)
            SELECT sendgrid_config_id, v_label
            FROM inbound_emails
            WHERE id = p_email_id
            ON CONFLICT (sendgrid_config_id, label_name) DO NOTHING
            RETURNING id INTO v_label_id;
            
            -- Assign label to email
            INSERT INTO email_label_assignments (inbound_email_id, label_id)
            VALUES (p_email_id, v_label_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
    
    -- Schedule auto-reply if specified
    IF p_actions ? 'auto_reply_template' THEN
        INSERT INTO scheduled_email_actions (
            sendgrid_config_id,
            inbound_email_id,
            agent_id,
            action_type,
            action_params,
            scheduled_for
        )
        SELECT 
            sendgrid_config_id,
            id,
            agent_id,
            'auto_reply',
            jsonb_build_object('template_id', p_actions->>'auto_reply_template'),
            now() + interval '1 minute'
        FROM inbound_emails
        WHERE id = p_email_id;
    END IF;
    
    -- Additional actions can be implemented here
    -- - forward_to
    -- - trigger_webhook
    -- - assign_to_agent
    -- etc.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT ON email_routing_rules TO anon, authenticated;
GRANT SELECT ON inbound_emails TO anon, authenticated;
GRANT SELECT ON scheduled_email_actions TO anon, authenticated;
GRANT SELECT ON email_labels TO anon, authenticated;
GRANT SELECT ON email_label_assignments TO anon, authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION process_inbound_email(JSONB, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_email_routing_rules(UUID) TO anon, authenticated;