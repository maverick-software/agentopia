import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface ConversationItem {
  conversation_id: string;
  title?: string | null;
  last_active?: string | null;
  message_count?: number | null;
  last_message?: string | null;
  last_message_at?: string | null;
}

export function useConversations(agentId: string | null, userId: string | null) {
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!agentId || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('conversation_sessions')
        .select('conversation_id, title, last_active, message_count, status')
        .eq('agent_id', agentId)
        .eq('status', 'active')
        .order('last_active', { ascending: false })
        .limit(50);
      if (err) throw err;
      const baseItems: ConversationItem[] = (data || []).map(r => ({
        conversation_id: r.conversation_id,
        title: r.title ?? null,
        last_active: r.last_active ?? null,
        message_count: r.message_count ?? null,
        last_message: null,
        last_message_at: null,
      }));
      // Enrich with latest message preview/time
      const enriched = await Promise.all(baseItems.map(async (it) => {
        try {
          const { data: msg } = await supabase
            .from('chat_messages_v2')
            .select('content, created_at')
            .eq('conversation_id', it.conversation_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          const preview = typeof (msg as any)?.content === 'string' ? (msg as any).content : ((msg as any)?.content?.text ?? null);
          return { ...it, last_message: preview || null, last_message_at: (msg as any)?.created_at || null } as ConversationItem;
        } catch (_e) {
          return it;
        }
      }));
      setItems(enriched);
    } catch (e: any) {
      setError(e?.message || 'Failed to load conversations');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [agentId, userId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime updates for conversation list
  useEffect(() => {
    if (!agentId) return;
    const channel = supabase.channel(`conversation_sessions:${agentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_sessions', filter: `agent_id=eq.${agentId}` }, () => {
        fetchConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [agentId, fetchConversations]);

  const createConversation = useCallback(async (title?: string | null) => {
    // Creating a conversation is implicit: we just return a new UUID and let first message create a session row
    const id = crypto.randomUUID();
    if (title) {
      // Best-effort: insert a session row to save title early
      await supabase.from('conversation_sessions').insert({
        conversation_id: id,
        user_id: userId,
        agent_id: agentId,
        title,
      });
    }
    return id;
  }, [agentId, userId]);

  const renameConversation = useCallback(async (conversationId: string, title: string) => {
    if (!conversationId) return;
    await supabase.from('conversation_sessions')
      .upsert({ conversation_id: conversationId, agent_id: agentId, user_id: userId, title })
      .eq('conversation_id', conversationId);
    await fetchConversations();
  }, [agentId, userId, fetchConversations]);

  const archiveConversation = useCallback(async (conversationId: string) => {
    if (!conversationId) return;
    try {
      const { error: upErr } = await supabase.from('conversation_sessions')
        .update({ status: 'abandoned', ended_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('agent_id', agentId || undefined);
      if (upErr) throw upErr;
      // Optimistically remove from local list
      setItems(prev => prev.filter(i => i.conversation_id !== conversationId));
      // Ensure consistency
      await fetchConversations();
    } catch (e: any) {
      setError(e?.message || 'Failed to archive conversation');
    }
  }, [agentId, fetchConversations]);

  return { items, loading, error, refresh: fetchConversations, createConversation, renameConversation, archiveConversation };
}


