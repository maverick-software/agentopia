-- Create admin_operation_logs table for tracking admin operations
CREATE TABLE IF NOT EXISTS admin_operation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    operation TEXT NOT NULL CHECK (operation IN ('deploy', 'start', 'stop', 'restart', 'delete', 'configure')),
    server_id TEXT NOT NULL,
    server_name TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT FALSE,
    error TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_operation_logs_admin_user_id ON admin_operation_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_operation_logs_operation ON admin_operation_logs(operation);
CREATE INDEX IF NOT EXISTS idx_admin_operation_logs_server_id ON admin_operation_logs(server_id);
CREATE INDEX IF NOT EXISTS idx_admin_operation_logs_timestamp ON admin_operation_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_admin_operation_logs_success ON admin_operation_logs(success);

-- Enable RLS
ALTER TABLE admin_operation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_operation_logs
CREATE POLICY "Admin users can view all operation logs" ON admin_operation_logs
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = auth.uid() AND r.name = 'admin'
        )
    );

CREATE POLICY "Admin users can insert operation logs" ON admin_operation_logs
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = auth.uid() AND r.name = 'admin'
        )
    );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_admin_operation_logs_updated_at 
    BEFORE UPDATE ON admin_operation_logs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 