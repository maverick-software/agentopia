-- SendGrid Webhook Processing Tables
-- Date: August 2, 2025
-- Purpose: Create tables for webhook security, processing, and monitoring

-- Create webhook_security_configs table
CREATE TABLE IF NOT EXISTS webhook_security_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sendgrid_config_id UUID NOT NULL REFERENCES sendgrid_configurations(id) ON DELETE CASCADE,
    
    -- Security method
    security_method TEXT NOT NULL CHECK (security_method IN ('signature', 'oauth', 'both')),
    
    -- Signature verification settings
    public_key TEXT,                      -- ECDSA public key for signature verification
    public_key_created_at TIMESTAMPTZ,
    
    -- OAuth settings (if using OAuth instead of signature)
    oauth_client_id TEXT,
    oauth_client_secret_vault_id UUID,    -- Reference to vault
    oauth_token_url TEXT,
    oauth_scopes TEXT[],
    
    -- Additional security
    allowed_ips INET[],                   -- IP whitelist
    require_https BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(sendgrid_config_id)
);

-- Create webhook_logs table
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sendgrid_config_id UUID REFERENCES sendgrid_configurations(id) ON DELETE SET NULL,
    
    -- Request details
    webhook_type TEXT NOT NULL,           -- 'inbound_parse', 'event', 'bounce', etc.
    request_method TEXT NOT NULL,
    request_url TEXT NOT NULL,
    request_headers JSONB,
    request_body TEXT,                    -- Raw body for signature verification
    request_ip INET,
    
    -- Processing details
    status TEXT NOT NULL DEFAULT 'processing',  -- 'processing', 'success', 'failure', 'retry'
    processing_time_ms INTEGER,
    
    -- Security validation
    signature_valid BOOLEAN,
    signature_error TEXT,
    oauth_valid BOOLEAN,
    
    -- Response
    response_status_code INTEGER,
    response_body JSONB,
    
    -- Error handling
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create webhook_event_queue table for async processing
CREATE TABLE IF NOT EXISTS webhook_event_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sendgrid_config_id UUID NOT NULL REFERENCES sendgrid_configurations(id) ON DELETE CASCADE,
    
    -- Event details
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    webhook_log_id UUID REFERENCES webhook_logs(id),
    
    -- Processing
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
    processor_id TEXT,                    -- ID of the worker processing this
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    
    -- Error handling
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_error TEXT,
    
    -- Priority and scheduling
    priority INTEGER DEFAULT 100,         -- Lower number = higher priority
    scheduled_for TIMESTAMPTZ DEFAULT now(),
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create webhook_failed_events table for manual review
CREATE TABLE IF NOT EXISTS webhook_failed_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sendgrid_config_id UUID REFERENCES sendgrid_configurations(id) ON DELETE SET NULL,
    webhook_log_id UUID REFERENCES webhook_logs(id),
    
    -- Original event
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    
    -- Failure details
    failure_reason TEXT NOT NULL,
    failure_details JSONB,
    final_retry_count INTEGER,
    
    -- Resolution
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create webhook_metrics table for monitoring
CREATE TABLE IF NOT EXISTS webhook_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sendgrid_config_id UUID NOT NULL REFERENCES sendgrid_configurations(id) ON DELETE CASCADE,
    
    -- Time bucket
    metric_timestamp TIMESTAMPTZ NOT NULL,
    metric_interval TEXT NOT NULL CHECK (metric_interval IN ('minute', 'hour', 'day')),
    
    -- Counts
    total_webhooks INTEGER DEFAULT 0,
    successful_webhooks INTEGER DEFAULT 0,
    failed_webhooks INTEGER DEFAULT 0,
    
    -- Performance
    avg_processing_time_ms FLOAT,
    max_processing_time_ms INTEGER,
    min_processing_time_ms INTEGER,
    
    -- By type breakdown
    webhooks_by_type JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(sendgrid_config_id, metric_timestamp, metric_interval)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_logs_config_created ON webhook_logs(sendgrid_config_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_type_status ON webhook_logs(webhook_type, status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_retry ON webhook_logs(next_retry_at) WHERE status = 'retry';
CREATE INDEX IF NOT EXISTS idx_webhook_event_queue_pending ON webhook_event_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_event_queue_processing ON webhook_event_queue(processor_id) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_webhook_failed_events_unresolved ON webhook_failed_events(created_at DESC) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_webhook_metrics_lookup ON webhook_metrics(sendgrid_config_id, metric_timestamp DESC, metric_interval);

-- Enable Row Level Security
ALTER TABLE webhook_security_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_event_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_failed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their webhook configs" ON webhook_security_configs
    FOR SELECT USING (
        sendgrid_config_id IN (
            SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage webhook configs" ON webhook_security_configs
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can view their webhook logs" ON webhook_logs
    FOR SELECT USING (
        sendgrid_config_id IN (
            SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage webhook logs" ON webhook_logs
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage webhook queue" ON webhook_event_queue
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can view their failed webhooks" ON webhook_failed_events
    FOR SELECT USING (
        sendgrid_config_id IN (
            SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can resolve their failed webhooks" ON webhook_failed_events
    FOR UPDATE USING (
        sendgrid_config_id IN (
            SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view their webhook metrics" ON webhook_metrics
    FOR SELECT USING (
        sendgrid_config_id IN (
            SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
        )
    );

-- Update timestamp trigger
CREATE TRIGGER update_webhook_security_configs_updated_at
    BEFORE UPDATE ON webhook_security_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_sendgrid_updated_at();

-- Function to verify webhook signature
CREATE OR REPLACE FUNCTION verify_webhook_signature(
    p_sendgrid_config_id UUID,
    p_signature TEXT,
    p_timestamp TEXT,
    p_payload TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_public_key TEXT;
    v_timestamp_num BIGINT;
    v_current_time BIGINT;
BEGIN
    -- Get public key from config
    SELECT public_key INTO v_public_key
    FROM webhook_security_configs
    WHERE sendgrid_config_id = p_sendgrid_config_id
    AND security_method IN ('signature', 'both');
    
    IF v_public_key IS NULL THEN
        RETURN false;
    END IF;
    
    -- Verify timestamp is recent (within 5 minutes)
    BEGIN
        v_timestamp_num := p_timestamp::BIGINT;
        v_current_time := EXTRACT(EPOCH FROM now())::BIGINT;
        
        IF ABS(v_current_time - v_timestamp_num) > 300 THEN
            RETURN false;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN false;
    END;
    
    -- Note: Actual signature verification would be done in the Edge Function
    -- using crypto libraries. This is a placeholder.
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log webhook event
CREATE OR REPLACE FUNCTION log_webhook_event(
    p_config_id UUID,
    p_webhook_type TEXT,
    p_request_data JSONB,
    p_status TEXT DEFAULT 'processing'
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO webhook_logs (
        sendgrid_config_id,
        webhook_type,
        request_method,
        request_url,
        request_headers,
        request_body,
        request_ip,
        status
    ) VALUES (
        p_config_id,
        p_webhook_type,
        p_request_data->>'method',
        p_request_data->>'url',
        p_request_data->'headers',
        p_request_data->>'body',
        (p_request_data->>'ip')::inet,
        p_status
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to queue webhook event for processing
CREATE OR REPLACE FUNCTION queue_webhook_event(
    p_config_id UUID,
    p_event_type TEXT,
    p_event_data JSONB,
    p_webhook_log_id UUID DEFAULT NULL,
    p_priority INTEGER DEFAULT 100
) RETURNS UUID AS $$
DECLARE
    v_queue_id UUID;
BEGIN
    INSERT INTO webhook_event_queue (
        sendgrid_config_id,
        event_type,
        event_data,
        webhook_log_id,
        priority,
        scheduled_for
    ) VALUES (
        p_config_id,
        p_event_type,
        p_event_data,
        p_webhook_log_id,
        p_priority,
        CASE 
            WHEN p_priority < 50 THEN now()  -- High priority: immediate
            ELSE now() + interval '5 seconds' -- Normal priority: slight delay
        END
    ) RETURNING id INTO v_queue_id;
    
    RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update webhook metrics
CREATE OR REPLACE FUNCTION update_webhook_metrics(
    p_config_id UUID,
    p_webhook_type TEXT,
    p_success BOOLEAN,
    p_processing_time_ms INTEGER
) RETURNS void AS $$
DECLARE
    v_timestamp TIMESTAMPTZ;
    v_current_metrics RECORD;
BEGIN
    -- Round to current minute
    v_timestamp := date_trunc('minute', now());
    
    -- Get or create metrics record
    INSERT INTO webhook_metrics (
        sendgrid_config_id,
        metric_timestamp,
        metric_interval,
        total_webhooks,
        successful_webhooks,
        failed_webhooks,
        avg_processing_time_ms,
        max_processing_time_ms,
        min_processing_time_ms,
        webhooks_by_type
    ) VALUES (
        p_config_id,
        v_timestamp,
        'minute',
        1,
        CASE WHEN p_success THEN 1 ELSE 0 END,
        CASE WHEN NOT p_success THEN 1 ELSE 0 END,
        p_processing_time_ms,
        p_processing_time_ms,
        p_processing_time_ms,
        jsonb_build_object(p_webhook_type, 1)
    )
    ON CONFLICT (sendgrid_config_id, metric_timestamp, metric_interval) DO UPDATE SET
        total_webhooks = webhook_metrics.total_webhooks + 1,
        successful_webhooks = webhook_metrics.successful_webhooks + CASE WHEN p_success THEN 1 ELSE 0 END,
        failed_webhooks = webhook_metrics.failed_webhooks + CASE WHEN NOT p_success THEN 1 ELSE 0 END,
        avg_processing_time_ms = (
            (webhook_metrics.avg_processing_time_ms * webhook_metrics.total_webhooks + p_processing_time_ms) / 
            (webhook_metrics.total_webhooks + 1)
        ),
        max_processing_time_ms = GREATEST(webhook_metrics.max_processing_time_ms, p_processing_time_ms),
        min_processing_time_ms = LEAST(webhook_metrics.min_processing_time_ms, p_processing_time_ms),
        webhooks_by_type = webhook_metrics.webhooks_by_type || 
            jsonb_build_object(
                p_webhook_type, 
                COALESCE((webhook_metrics.webhooks_by_type->>p_webhook_type)::integer, 0) + 1
            );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle webhook retry
CREATE OR REPLACE FUNCTION schedule_webhook_retry(
    p_webhook_log_id UUID,
    p_error_message TEXT
) RETURNS void AS $$
DECLARE
    v_retry_count INTEGER;
    v_next_retry TIMESTAMPTZ;
    v_retry_delays INTEGER[] := ARRAY[60, 300, 900, 3600]; -- 1min, 5min, 15min, 1hour
BEGIN
    -- Get current retry count
    SELECT retry_count INTO v_retry_count
    FROM webhook_logs
    WHERE id = p_webhook_log_id;
    
    -- Calculate next retry time
    IF v_retry_count < array_length(v_retry_delays, 1) THEN
        v_next_retry := now() + (v_retry_delays[v_retry_count + 1] || ' seconds')::interval;
        
        -- Update webhook log
        UPDATE webhook_logs
        SET status = 'retry',
            retry_count = retry_count + 1,
            next_retry_at = v_next_retry,
            error_message = p_error_message
        WHERE id = p_webhook_log_id;
    ELSE
        -- Max retries reached, mark as failed
        UPDATE webhook_logs
        SET status = 'failure',
            error_message = p_error_message
        WHERE id = p_webhook_log_id;
        
        -- Create failed event record for manual review
        INSERT INTO webhook_failed_events (
            sendgrid_config_id,
            webhook_log_id,
            event_type,
            event_data,
            failure_reason,
            final_retry_count
        )
        SELECT 
            sendgrid_config_id,
            id,
            webhook_type,
            request_body::jsonb,
            'Max retries exceeded: ' || p_error_message,
            retry_count
        FROM webhook_logs
        WHERE id = p_webhook_log_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to aggregate metrics to hourly/daily
CREATE OR REPLACE FUNCTION aggregate_webhook_metrics()
RETURNS void AS $$
BEGIN
    -- Aggregate minute metrics to hourly (for data older than 1 hour)
    INSERT INTO webhook_metrics (
        sendgrid_config_id,
        metric_timestamp,
        metric_interval,
        total_webhooks,
        successful_webhooks,
        failed_webhooks,
        avg_processing_time_ms,
        max_processing_time_ms,
        min_processing_time_ms,
        webhooks_by_type
    )
    SELECT
        sendgrid_config_id,
        date_trunc('hour', metric_timestamp) as metric_timestamp,
        'hour' as metric_interval,
        SUM(total_webhooks),
        SUM(successful_webhooks),
        SUM(failed_webhooks),
        AVG(avg_processing_time_ms),
        MAX(max_processing_time_ms),
        MIN(min_processing_time_ms),
        jsonb_object_agg(
            webhook_type,
            SUM((webhooks_by_type->>webhook_type)::integer)
        ) FILTER (WHERE webhook_type IS NOT NULL)
    FROM (
        SELECT 
            sendgrid_config_id,
            metric_timestamp,
            total_webhooks,
            successful_webhooks,
            failed_webhooks,
            avg_processing_time_ms,
            max_processing_time_ms,
            min_processing_time_ms,
            jsonb_each_text(webhooks_by_type) as (webhook_type, count)
        FROM webhook_metrics
        WHERE metric_interval = 'minute'
        AND metric_timestamp < now() - interval '1 hour'
    ) t
    GROUP BY sendgrid_config_id, date_trunc('hour', metric_timestamp)
    ON CONFLICT (sendgrid_config_id, metric_timestamp, metric_interval) DO NOTHING;
    
    -- Delete old minute-level metrics
    DELETE FROM webhook_metrics
    WHERE metric_interval = 'minute'
    AND metric_timestamp < now() - interval '24 hours';
    
    -- Similar aggregation for daily metrics...
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT ON webhook_security_configs TO anon, authenticated;
GRANT SELECT ON webhook_logs TO anon, authenticated;
GRANT SELECT ON webhook_failed_events TO anon, authenticated;
GRANT SELECT ON webhook_metrics TO anon, authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION verify_webhook_signature(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION log_webhook_event(UUID, TEXT, JSONB, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION queue_webhook_event(UUID, TEXT, JSONB, UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_webhook_metrics(UUID, TEXT, BOOLEAN, INTEGER) TO anon, authenticated;