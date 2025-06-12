const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mzcvdilmavlpttqncutj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16Y3ZkaWxtYXZscHR0cW5jdXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMyNTgzNTQsImV4cCI6MjA0ODgzNDM1NH0.bHhNzfcQ_ufEGNKLe-7OejllsxWAY8gvDxzkcCKZHmM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdminRoles() {
  console.log('Checking admin roles...');
  
  // Check if admin role exists
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('*')
    .eq('name', 'admin');
    
  console.log('Admin role:', roles, rolesError);
  
  // Check user roles
  const { data: userRoles, error: userRolesError } = await supabase
    .from('user_roles')
    .select(`
      user_id,
      roles!inner (
        name
      )
    `)
    .eq('roles.name', 'admin');
    
  console.log('Users with admin role:', userRoles, userRolesError);
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('Current user:', user?.id, userError);
}

checkAdminRoles(); 