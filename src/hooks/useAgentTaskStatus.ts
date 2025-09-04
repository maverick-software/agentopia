import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface TaskExecution {
  id: string;
  task_id: string;
  agent_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string | null;
  completed_at: string | null;
  conversation_id?: string;
}

interface UseAgentTaskStatusReturn {
  runningTasks: string[]; // Array of task IDs currently running
  completedTasks: string[]; // Array of task IDs recently completed
  isAgentBusy: boolean; // True if any task is running for this agent
  taskExecutions: TaskExecution[];
}

export function useAgentTaskStatus(agentId: string | null): UseAgentTaskStatusReturn {
  const [taskExecutions, setTaskExecutions] = useState<TaskExecution[]>([]);
  const [subscription, setSubscription] = useState<RealtimeChannel | null>(null);

  const fetchRecentExecutions = useCallback(async () => {
    if (!agentId) return;

    try {
      const { data, error } = await supabase
        .from('agent_task_executions')
        .select('id, task_id, agent_id, status, started_at, completed_at, metadata')
        .eq('agent_id', agentId)
        .gte('started_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
        .order('started_at', { ascending: false });

      if (error) {
        console.error('Error fetching task executions:', error);
        return;
      }

      setTaskExecutions(data || []);
    } catch (error) {
      console.error('Error in fetchRecentExecutions:', error);
    }
  }, [agentId]);

  // Set up real-time subscription
  useEffect(() => {
    if (!agentId) {
      setTaskExecutions([]);
      return;
    }

    // Initial fetch
    fetchRecentExecutions();

    // Set up real-time subscription for task executions
    const channel = supabase
      .channel(`agent-task-executions-${agentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_task_executions',
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          console.log('Task execution change:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newExecution = payload.new as TaskExecution;
            setTaskExecutions(prev => [newExecution, ...prev.slice(0, 9)]); // Keep last 10
          } else if (payload.eventType === 'UPDATE') {
            const updatedExecution = payload.new as TaskExecution;
            setTaskExecutions(prev => 
              prev.map(exec => exec.id === updatedExecution.id ? updatedExecution : exec)
            );
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to agent task executions for agent ${agentId}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Task execution subscription error:', err);
        }
      });

    setSubscription(channel);

    return () => {
      if (channel) {
        console.log(`Unsubscribing from agent task executions for agent ${agentId}`);
        supabase.removeChannel(channel);
      }
    };
  }, [agentId, fetchRecentExecutions]);

  // Calculate derived state
  const runningTasks = taskExecutions
    .filter(exec => exec.status === 'running')
    .map(exec => exec.task_id);

  const completedTasks = taskExecutions
    .filter(exec => exec.status === 'completed' && exec.completed_at)
    .map(exec => exec.task_id);

  const isAgentBusy = runningTasks.length > 0;

  return {
    runningTasks,
    completedTasks,
    isAgentBusy,
    taskExecutions,
  };
}
