-- Fix the bad connection in team_canvas_layouts JSONB
-- Run this in your Supabase SQL Editor

-- Step 1: View current connections
SELECT 
  id,
  user_id,
  workspace_id,
  jsonb_array_length(COALESCE(connections, '[]'::jsonb)) as connection_count,
  connections
FROM team_canvas_layouts
WHERE workspace_id IS NULL
ORDER BY updated_at DESC
LIMIT 5;

-- Step 2: Remove the bad connection with sourceHandle "top-target"
UPDATE team_canvas_layouts
SET 
  connections = (
    SELECT COALESCE(jsonb_agg(conn), '[]'::jsonb)
    FROM jsonb_array_elements(connections) AS conn
    WHERE (conn->>'sourceHandle') != 'top-target'
      AND NOT (conn->>'sourceHandle' LIKE '%-target' AND conn->>'sourceHandle' != 'left-target' AND conn->>'sourceHandle' != 'right-target')
  ),
  updated_at = NOW()
WHERE workspace_id IS NULL;

-- Step 3: Verify the fix
SELECT 
  id,
  user_id,
  workspace_id,
  jsonb_array_length(COALESCE(connections, '[]'::jsonb)) as connection_count,
  connections
FROM team_canvas_layouts
WHERE workspace_id IS NULL
ORDER BY updated_at DESC
LIMIT 5;

