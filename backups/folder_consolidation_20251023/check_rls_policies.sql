-- Check RLS policies for conversation_summary_boards
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'conversation_summary_boards';

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'conversation_summary_boards';

-- Check for any rows in the table (as service_role)
SELECT 
  conversation_id,
  user_id,
  message_count,
  created_at
FROM conversation_summary_boards
LIMIT 10;

