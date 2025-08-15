import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import Croner from 'https://esm.sh/croner@4'

// Helper function to calculate next run time using croner
function calculateNextRunTime(cronExpression: string, timezone: string = 'UTC'): string | null {
  try {
    const cronJob = new Croner(cronExpression, { timezone });
    const nextRun = (cronJob as any).nextRun ? (cronJob as any).nextRun() : (cronJob as any).next();
    return nextRun ? nextRun.toISOString() : null;
  } catch (error) {
    console.error('Error calculating next run time:', error);
    return null;
  }
}

interface Database {
  public: {
    Tables: {
      agent_tasks: {
        Row: {
          id: string
          agent_id: string
          user_id: string
          name: string
          description: string | null
          task_type: 'scheduled' | 'event_based'
          status: 'active' | 'paused' | 'completed' | 'failed' | 'cancelled'
          instructions: string
          selected_tools: any[]
          cron_expression: string | null
          timezone: string
          next_run_at: string | null
          last_run_at: string | null
          event_trigger_type: string | null
          event_trigger_config: any
          total_executions: number
          successful_executions: number
          failed_executions: number
          max_executions: number | null
          start_date: string | null
          end_date: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Update: {
          total_executions?: number
          successful_executions?: number
          failed_executions?: number
          last_run_at?: string
          next_run_at?: string
          status?: 'active' | 'paused' | 'completed' | 'failed' | 'cancelled'
        }
      }
      agent_task_executions: {
        Row: {
          id: string
          task_id: string
          agent_id: string
          status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          trigger_type: string
          trigger_data: any
          instructions_used: string
          tools_used: any[]
          started_at: string | null
          completed_at: string | null
          duration_ms: number | null
          output: string | null
          tool_outputs: any[]
          error_message: string | null
          metadata: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_id: string
          agent_id: string
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          trigger_type: string
          trigger_data?: any
          instructions_used: string
          tools_used?: any[]
          started_at?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          output?: string | null
          tool_outputs?: any[]
          error_message?: string | null
          metadata?: any
        }
        Update: {
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          started_at?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          output?: string | null
          tool_outputs?: any[]
          error_message?: string | null
          metadata?: any
        }
      }
      agents: {
        Row: {
          id: string
          user_id: string
          name: string
          system_instructions: string | null
          assistant_instructions: string | null
        }
      }
    }
  }
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin') || req.headers.get('origin') || ''
    return new Response('ok', { headers: corsHeaders(origin) })
  }

  try {
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)
    const url = new URL(req.url)
    const method = req.method

    switch (method) {
      case 'POST': {
        let body: any = null;
        try { body = await req.json(); } catch { body = null; }
        // Default to scheduled run if no body/action provided
        if (!body || !body.action || body.action === 'execute_scheduled_tasks' || body.action === 'scheduled') {
          return await executeScheduledTasks(supabase)
        }
        if (body.action === 'execute_task') {
          return await executeSpecificTask(supabase, body.task_id, body.trigger_type, body.trigger_data)
        } else if (body.action === 'execute_event_task') {
          return await executeEventBasedTask(supabase, body.event_type, body.event_data)
        }
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        )
      }
      case 'GET':
        // Allow scheduled invocation via GET
        return await executeScheduledTasks(supabase)
      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Error in task-executor function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders(req.headers.get('origin') || ''), 'Content-Type': 'application/json' } }
    )
  }
})

async function executeScheduledTasks(supabase: any) {
  console.log('Executing scheduled tasks...')

  // Find all scheduled tasks that are due to run
  const now = new Date().toISOString()
  const { data: dueTasks, error: fetchError } = await supabase
    .from('agent_tasks')
    .select(`
      *,
      agents (
        id,
        name,
        system_instructions,
        assistant_instructions
      )
    `)
    .eq('task_type', 'scheduled')
    .eq('status', 'active')
    .lte('next_run_at', now)
    .not('next_run_at', 'is', null)

  if (fetchError) {
    console.error('Error fetching due tasks:', fetchError)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch due tasks', details: fetchError.message }),
      { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }

  console.log(`Found ${dueTasks?.length || 0} due tasks`)

  const results = []
  for (const task of dueTasks || []) {
    try {
      // Check if task has reached max executions
      if (task.max_executions && task.total_executions >= task.max_executions) {
        await supabase
          .from('agent_tasks')
          .update({ status: 'completed' })
          .eq('id', task.id)
        continue
      }

      // Check if task is within date range
      const now = new Date()
      if (task.start_date && new Date(task.start_date) > now) {
        continue
      }
      if (task.end_date && new Date(task.end_date) < now) {
        await supabase
          .from('agent_tasks')
          .update({ status: 'completed' })
          .eq('id', task.id)
        continue
      }

      const result = await executeTask(supabase, task, 'scheduled', {})
      results.push({ task_id: task.id, result })

      // Calculate next run time using croner
      const nextRun = calculateNextRunTime(task.cron_expression!, task.timezone)
      
      // Update task statistics and next run time
      await supabase
        .from('agent_tasks')
        .update({
          total_executions: task.total_executions + 1,
          successful_executions: result.success ? task.successful_executions + 1 : task.successful_executions,
          failed_executions: result.success ? task.failed_executions : task.failed_executions + 1,
          last_run_at: now,
          next_run_at: nextRun
        })
        .eq('id', task.id)

    } catch (error) {
      console.error(`Error executing task ${task.id}:`, error)
      results.push({ task_id: task.id, error: error.message })
    }
  }

  return new Response(
    JSON.stringify({ 
      message: 'Scheduled tasks execution completed',
      results,
      processed_count: results.length
    }),
    { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
  )
}

async function executeSpecificTask(supabase: any, taskId: string, triggerType: string, triggerData: any = {}) {
  if (!taskId) {
    return new Response(
      JSON.stringify({ error: 'Task ID is required' }),
      { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }

  // Fetch the task
  const { data: task, error: fetchError } = await supabase
    .from('agent_tasks')
    .select(`
      *,
      agents (
        id,
        name,
        system_instructions,
        assistant_instructions
      )
    `)
    .eq('id', taskId)
    .single()

  if (fetchError || !task) {
    return new Response(
      JSON.stringify({ error: 'Task not found' }),
      { status: 404, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }

  if (task.status !== 'active') {
    return new Response(
      JSON.stringify({ error: 'Task is not active' }),
      { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }

  try {
    const result = await executeTask(supabase, task, triggerType, triggerData)
    
    // Update task statistics
    await supabase
      .from('agent_tasks')
      .update({
        total_executions: task.total_executions + 1,
        successful_executions: result.success ? task.successful_executions + 1 : task.successful_executions,
        failed_executions: result.success ? task.failed_executions : task.failed_executions + 1,
        last_run_at: new Date().toISOString()
      })
      .eq('id', task.id)

    return new Response(
      JSON.stringify({ 
        message: 'Task executed successfully',
        execution_id: result.execution_id,
        success: result.success,
        output: result.output,
        conversation_id: result.conversation_id
      }),
      { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error(`Error executing task ${taskId}:`, error)
    return new Response(
      JSON.stringify({ error: 'Task execution failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }
}

async function executeEventBasedTask(supabase: any, eventType: string, eventData: any) {
  console.log(`Executing event-based tasks for event: ${eventType}`)

  // Find all event-based tasks that match this event type
  const { data: matchingTasks, error: fetchError } = await supabase
    .from('agent_tasks')
    .select(`
      *,
      agents (
        id,
        name,
        system_instructions,
        assistant_instructions
      )
    `)
    .eq('task_type', 'event_based')
    .eq('status', 'active')
    .eq('event_trigger_type', eventType)

  if (fetchError) {
    console.error('Error fetching event-based tasks:', fetchError)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch event-based tasks', details: fetchError.message }),
      { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }

  console.log(`Found ${matchingTasks?.length || 0} matching event-based tasks`)

  const results = []
  for (const task of matchingTasks || []) {
    try {
      // Check if task matches event conditions
      if (!matchesEventConditions(task.event_trigger_config, eventData)) {
        continue
      }

      // Check if task has reached max executions
      if (task.max_executions && task.total_executions >= task.max_executions) {
        await supabase
          .from('agent_tasks')
          .update({ status: 'completed' })
          .eq('id', task.id)
        continue
      }

      const result = await executeTask(supabase, task, 'event', eventData)
      results.push({ task_id: task.id, result })

      // Update task statistics
      await supabase
        .from('agent_tasks')
        .update({
          total_executions: task.total_executions + 1,
          successful_executions: result.success ? task.successful_executions + 1 : task.successful_executions,
          failed_executions: result.success ? task.failed_executions : task.failed_executions + 1,
          last_run_at: new Date().toISOString()
        })
        .eq('id', task.id)

    } catch (error) {
      console.error(`Error executing event-based task ${task.id}:`, error)
      results.push({ task_id: task.id, error: error.message })
    }
  }

  return new Response(
    JSON.stringify({ 
      message: 'Event-based tasks execution completed',
      event_type: eventType,
      results,
      processed_count: results.length
    }),
    { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
  )
}

async function executeTask(supabase: any, task: any, triggerType: string, triggerData: any) {
  const startTime = Date.now()
  console.log(`Executing task: ${task.name} (${task.id})`)

  // Create execution record
  const { data: execution, error: execError } = await supabase
    .from('agent_task_executions')
    .insert({
      task_id: task.id,
      agent_id: task.agent_id,
      status: 'running',
      trigger_type: triggerType,
      trigger_data: triggerData,
      instructions_used: task.instructions,
      tools_used: task.selected_tools,
      started_at: new Date().toISOString(),
      metadata: {
        agent_name: task.agents?.name,
        trigger_type: triggerType
      }
    })
    .select()
    .single()

  if (execError) {
    throw new Error(`Failed to create execution record: ${execError.message}`)
  }

  try {
    // Post a v2 user message into chat_messages_v2 and invoke chat to get assistant reply
    const conversationId = task.conversation_id || (task.event_trigger_config && task.event_trigger_config.conversation_id) || crypto.randomUUID()
    const sessionId = crypto.randomUUID()

    // Ensure a session row exists so the sidebar can display it immediately (update-or-insert without unique constraint)
    try {
      const base = {
        agent_id: task.agent_id,
        user_id: task.user_id,
        title: 'New Conversation',
        status: 'active' as const,
        last_active: new Date().toISOString(),
      };
      const upd = await (supabase as any)
        .from('conversation_sessions')
        .update(base)
        .eq('conversation_id', conversationId)
        .select('conversation_id');
      if (!upd || !Array.isArray(upd.data) || upd.data.length === 0) {
        await (supabase as any)
          .from('conversation_sessions')
          .insert({ conversation_id: conversationId, ...base });
      }
    } catch (_e) { /* non-fatal */ }

    // Insert the scheduled user message (visible in UI)
    const { error: insertMsgErr } = await supabase
      .from('chat_messages_v2')
      .insert({
        conversation_id: conversationId,
        session_id: sessionId,
        channel_id: null,
        role: 'user',
        content: { type: 'text', text: task.instructions },
        sender_user_id: task.user_id,
        sender_agent_id: null,
        metadata: { target_agent_id: task.agent_id, source: 'scheduler', task_id: task.id, trigger_type: triggerType },
        context: { agent_id: task.agent_id, user_id: task.user_id, conversation_id: conversationId, session_id: sessionId }
      })
    if (insertMsgErr) throw insertMsgErr

    // Call chat edge function to produce assistant reply (service role, act-as)
    const chatUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/chat'
    const chatResp = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'X-Agentopia-Service': 'task-executor',
      },
      body: JSON.stringify({
        version: '2.0.0',
        message: { role: 'user', content: { type: 'text', text: task.instructions } },
        context: { agent_id: task.agent_id, user_id: task.user_id, conversation_id: conversationId, session_id: sessionId },
        options: { context: { max_messages: 20 } }
      })
    })
    if (!chatResp.ok) {
      const errTxt = await chatResp.text()
      throw new Error(`chat invocation failed: ${chatResp.status} ${errTxt}`)
    }
    const chatData = await chatResp.json()
    const output = typeof chatData?.data?.message?.content?.text === 'string' ? chatData.data.message.content.text : 'Task executed. Reply generated.'

    // Touch conversation_sessions to ensure it appears in lists immediately
    try {
      const base2 = {
        agent_id: task.agent_id,
        user_id: task.user_id,
        status: 'active' as const,
        last_active: new Date().toISOString(),
      };
      const upd2 = await (supabase as any)
        .from('conversation_sessions')
        .update(base2)
        .eq('conversation_id', conversationId)
        .select('conversation_id');
      if (!upd2 || !Array.isArray(upd2.data) || upd2.data.length === 0) {
        await (supabase as any)
          .from('conversation_sessions')
          .insert({ conversation_id: conversationId, ...base2 });
      }
    } catch (_e) { /* non-fatal */ }
    
    const completedAt = new Date().toISOString()
    const duration = Date.now() - startTime

    // Update execution record with success
    await supabase
      .from('agent_task_executions')
      .update({
        status: 'completed',
        completed_at: completedAt,
        duration_ms: duration,
        output: output,
        tool_outputs: [], // Would contain actual tool outputs
        conversation_id: conversationId,
      })
      .eq('id', execution.id)

    return {
      success: true,
      output: output,
      conversation_id: conversationId,
      execution_id: execution.id,
      duration_ms: duration
    }

  } catch (error) {
    console.error(`Task execution failed for ${task.id}:`, error)
    
    const completedAt = new Date().toISOString()
    const duration = Date.now() - startTime

    // Update execution record with failure
    await supabase
      .from('agent_task_executions')
      .update({
        status: 'failed',
        completed_at: completedAt,
        duration_ms: duration,
        error_message: error.message,
      })
      .eq('id', execution.id)

    return {
      success: false,
      error: error.message,
      execution_id: execution.id,
      duration_ms: duration
    }
  }
}

async function simulateAgentExecution(task: any, triggerData: any): Promise<string> {
  // This is a placeholder for actual agent execution
  // In practice, this would:
  // 1. Set up the agent with the given instructions
  // 2. Provide access to the selected tools
  // 3. Execute the agent with the trigger data as context
  // 4. Return the agent's response
  
  await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate work
  
  const contextInfo = triggerData && Object.keys(triggerData).length > 0 
    ? `\n\nContext: ${JSON.stringify(triggerData, null, 2)}`
    : ''
  
  return `Task "${task.name}" executed successfully.${contextInfo}\n\nAgent completed the task: ${task.instructions}`
}

function matchesEventConditions(eventConfig: any, eventData: any): boolean {
  // This is a simplified condition matcher
  // In practice, this would implement complex condition logic
  
  if (!eventConfig || Object.keys(eventConfig).length === 0) {
    return true // No conditions means always match
  }

  // Example condition matching logic
  if (eventConfig.filters) {
    for (const [key, expectedValue] of Object.entries(eventConfig.filters)) {
      if (eventData[key] !== expectedValue) {
        return false
      }
    }
  }

  return true
} 