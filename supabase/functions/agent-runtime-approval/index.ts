import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: auth } = token
      ? await supabase.auth.getUser(token)
      : { data: { user: null } } as any;

    if (!auth?.user?.id) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json();
    const approvalId = body.approval_id;
    const decision = body.decision;
    if (!approvalId || !['approved', 'denied', 'cancelled'].includes(decision)) {
      return json({ error: 'approval_id and valid decision are required' }, 400);
    }

    const { data, error } = await supabase
      .from('agent_tool_approvals')
      .update({
        status: decision,
        decided_by: auth.user.id,
        decided_at: new Date().toISOString(),
      })
      .eq('id', approvalId)
      .eq('user_id', auth.user.id)
      .select('*')
      .single();

    if (error) return json({ error: error.message }, 400);

    await supabase.from('agent_run_events').insert({
      run_state_id: data.run_state_id,
      user_id: data.user_id,
      agent_id: data.agent_id,
      conversation_id: data.conversation_id,
      session_id: data.session_id,
      stream: 'approval',
      event_type: decision,
      payload: { approval_id: approvalId, tool_name: data.tool_name },
    });

    return json({ success: true, approval: data });
  } catch (error: any) {
    return json({ error: error?.message || 'Internal server error' }, 500);
  }
});

function json(body: Record<string, any>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
