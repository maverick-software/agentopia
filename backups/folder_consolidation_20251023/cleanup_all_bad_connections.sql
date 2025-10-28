-- Clean up ALL bad connections from team_canvas_layouts
-- This removes any connection with an invalid sourceHandle (ending with -target, except valid target handles)

UPDATE team_canvas_layouts
SET 
  connections = (
    SELECT COALESCE(jsonb_agg(conn), '[]'::jsonb)
    FROM jsonb_array_elements(connections) AS conn
    WHERE NOT (
      -- Remove connections where sourceHandle ends with '-target' 
      -- UNLESS it's 'left-target' or 'right-target' (which are valid target handles, not source handles)
      (conn->>'sourceHandle') LIKE '%-target'
      AND (conn->>'sourceHandle') != 'left-target'
      AND (conn->>'sourceHandle') != 'right-target'
    )
  ),
  updated_at = NOW()
WHERE workspace_id IS NULL;

-- Verify the cleanup
SELECT 
  id,
  user_id,
  jsonb_array_length(COALESCE(connections, '[]'::jsonb)) as connection_count,
  connections
FROM team_canvas_layouts
WHERE workspace_id IS NULL
ORDER BY updated_at DESC
LIMIT 5;

