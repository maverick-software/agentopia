-- Delete the problematic connection from team_canvas_layouts JSONB
-- This will remove it from the saved layout

-- First, let's see what we have
SELECT 
  id,
  user_id,
  workspace_id,
  jsonb_array_length(connections) as connection_count,
  connections
FROM team_canvas_layouts
WHERE user_id = auth.uid()
  AND workspace_id IS NULL;

-- Delete the bad connection with ID "connection_1761592165926_yeausq1ld"
-- We need to filter it out from the JSONB array
UPDATE team_canvas_layouts
SET 
  connections = (
    SELECT jsonb_agg(conn)
    FROM jsonb_array_elements(connections) AS conn
    WHERE conn->>'id' != 'connection_1761592165926_yeausq1ld'
  ),
  updated_at = NOW()
WHERE user_id = auth.uid()
  AND workspace_id IS NULL;

-- Also delete from team_connections table if it exists there
DELETE FROM team_connections
WHERE id::text = (
  SELECT id::text 
  FROM team_connections 
  WHERE created_by_user_id = auth.uid()
  LIMIT 1
);

-- Verify the fix
SELECT 
  id,
  user_id,
  workspace_id,
  jsonb_array_length(connections) as connection_count,
  connections
FROM team_canvas_layouts
WHERE user_id = auth.uid()
  AND workspace_id IS NULL;

