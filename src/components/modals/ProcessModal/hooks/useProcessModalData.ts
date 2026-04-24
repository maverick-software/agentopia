import React from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import type { ProcessModalDataState } from '../types';

export function useProcessModalData(
  isOpen: boolean,
  processingDetails: any,
): ProcessModalDataState {
  const [localSummaryInfo, setLocalSummaryInfo] = React.useState<any>(null);
  const [localRecentMessages, setLocalRecentMessages] = React.useState<any[]>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generationStatus, setGenerationStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [generationMessage, setGenerationMessage] = React.useState('');

  React.useEffect(() => {
    setLocalSummaryInfo(processingDetails?.summary_info || null);
    setLocalRecentMessages(processingDetails?.recent_messages_used || []);
  }, [processingDetails]);

  React.useEffect(() => {
    if (!isOpen) return;
    fetchContextData(processingDetails, setLocalSummaryInfo, setLocalRecentMessages);
  }, [isOpen, processingDetails?.conversation_id]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (generationStatus === 'idle') return;
    const timer = setTimeout(() => {
      setGenerationStatus('idle');
      setGenerationMessage('');
    }, 5000);
    return () => clearTimeout(timer);
  }, [generationStatus]);

  return {
    localSummaryInfo,
    localRecentMessages,
    setLocalSummaryInfo,
    setLocalRecentMessages,
    isGenerating,
    generationStatus,
    generationMessage,
    setIsGenerating,
    setGenerationStatus,
    setGenerationMessage,
  };
}

function getConversationId(processingDetails: any): string | null {
  let conversationId = processingDetails?.conversation_id;
  if (!conversationId) {
    const params = new URLSearchParams(window.location.search);
    conversationId = params.get('conv');
  }
  return conversationId || null;
}

async function fetchContextData(
  processingDetails: any,
  setLocalSummaryInfo: (value: any) => void,
  setLocalRecentMessages: (value: any[]) => void,
) {
  try {
    const conversationId = getConversationId(processingDetails);
    if (!conversationId) return;

    const { data: summaryBoard, error: summaryError } = await supabase
      .from('conversation_summary_boards')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (!summaryError && summaryBoard) {
      setLocalSummaryInfo({
        summary: summaryBoard.current_summary,
        facts_count: summaryBoard.important_facts?.length || 0,
        action_items_count: summaryBoard.action_items?.length || 0,
        pending_questions_count: summaryBoard.pending_questions?.length || 0,
        message_count: summaryBoard.message_count,
        last_updated: summaryBoard.last_updated,
      });
    }

    const { data: recentMsgs } = await supabase
      .from('chat_messages_v2')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentMsgs && recentMsgs.length > 0) {
      setLocalRecentMessages(
        recentMsgs.reverse().map((msg: any) => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : msg.content?.text || '',
          timestamp: msg.created_at,
        })),
      );
    }
  } catch (error) {
    console.error('[ProcessModal] Error fetching context data:', error);
  }
}

export async function generateConversationContext(args: {
  processingDetails: any;
  onSuccess: (summaryInfo: any, recentMessages: any[]) => void;
}) {
  const conversationId = getConversationId(args.processingDetails);
  if (!conversationId) throw new Error('No conversation ID available');

  const { data: messages, error: msgError } = await supabase
    .from('chat_messages_v2')
    .select('sender_agent_id')
    .eq('conversation_id', conversationId)
    .not('sender_agent_id', 'is', null)
    .limit(1);
  if (msgError) throw msgError;
  if (!messages || messages.length === 0) throw new Error('No messages found for this conversation');

  const agentId = messages[0].sender_agent_id;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase.functions.invoke('conversation-summarizer', {
    body: {
      conversation_id: conversationId,
      agent_id: agentId,
      user_id: user.id,
      force_full_summary: true,
      manual_trigger: true,
    },
  });
  if (error) throw error;

  const { data: summaryBoard } = await supabase
    .from('conversation_summary_boards')
    .select('*')
    .eq('conversation_id', conversationId)
    .maybeSingle();

  const { data: recentMsgs } = await supabase
    .from('chat_messages_v2')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!summaryBoard) {
    toast.error('Failed to fetch summary from database.');
    return;
  }

  const summaryInfo = {
    summary: summaryBoard.current_summary,
    facts_count: summaryBoard.important_facts?.length || 0,
    action_items_count: summaryBoard.action_items?.length || 0,
    pending_questions_count: summaryBoard.pending_questions?.length || 0,
    message_count: summaryBoard.message_count,
    last_updated: summaryBoard.last_updated,
  };

  const recentMessages = (recentMsgs || []).reverse().map((msg: any) => ({
    role: msg.role,
    content: typeof msg.content === 'string' ? msg.content : msg.content?.text || '',
    timestamp: msg.created_at,
  }));

  args.onSuccess(summaryInfo, recentMessages);
}
