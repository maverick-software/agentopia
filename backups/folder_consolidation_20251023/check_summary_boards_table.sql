-- Check if conversation_summary_boards table exists and its structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'conversation_summary_boards'
ORDER BY ordinal_position;

-- Check if there are any rows
SELECT COUNT(*) as row_count FROM conversation_summary_boards;

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'conversation_summary_boards';

