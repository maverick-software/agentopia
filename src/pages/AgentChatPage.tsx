import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ChatMessage } from '../components/ChatMessage';
import type { Message, Agent } from '../types';

export function AgentChat() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchAgentAttempts = useRef(0);
  const MAX_FETCH_ATTEMPTS = 5;

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Fetch Agent Effect
  const fetchAgent = useCallback(async (isInitialCall = true) => {
    if (!id || !user) return;

    let currentAttempt = fetchAgentAttempts.current + 1;
    if (isInitialCall) { currentAttempt = 1; fetchAgentAttempts.current = 0; }
    fetchAgentAttempts.current = currentAttempt;

    if (currentAttempt > MAX_FETCH_ATTEMPTS) {
      console.warn(`Max fetch attempts (${MAX_FETCH_ATTEMPTS}) reached for agent ${id} in chat. Aborting.`);
      setError(`Failed to load agent details after ${MAX_FETCH_ATTEMPTS} attempts.`);
      setLoading(false);
      return;
    }
    console.log(`Fetching agent ${id} for chat... Attempt ${currentAttempt}`);

    try {
      setError(null);
      setLoading(true);

      const { data, error: fetchError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error('Agent not found or access denied');

      setAgent(data);
      setLoading(false);
      if (isInitialCall) fetchAgentAttempts.current = 0; // Reset on success
    } catch (err: any) {
      console.error('Error in fetchAgent:', err);
      if (currentAttempt < MAX_FETCH_ATTEMPTS) {
        const delay = 2000;
        setTimeout(() => fetchAgent(false), delay); // Retry
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(`Failed to load agent details. Retrying... (${currentAttempt}/${MAX_FETCH_ATTEMPTS}): ${message}`);
      } else {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(`Failed to load agent details after ${MAX_FETCH_ATTEMPTS} attempts: ${message}`);
        console.error('Max fetch attempts reached for agent in chat after error.');
        setLoading(false);
      }
    }
  }, [id, user]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    console.log('Agent fetch effect triggered.');
    if (id && user) {
      fetchAgentAttempts.current = 0; 
      fetchAgent(true); 
    }
    
    // Cleanup function
    return () => {
      console.log('AgentChat component unmounting or id/user changed. Aborting requests.');
      if (abortControllerRef.current) {
        abortControllerRef.current.abort(); 
      }
    };
  // Dependencies ONLY id and user - fetchAgent is stable based on these
  }, [id, user]); 

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !agent || sending) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    try {
      setSending(true);
      setError(null);
      setInput('');

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      setMessages(prev => [...prev, userMessage]);

      abortControllerRef.current = new AbortController();

      // Get the current session and access token
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error('Authentication error: User not logged in?');
      }

      // --- MODIFIED: Send payload expected by the updated backend ---
      const requestBody = {
        agentId: agent.id,
        message: userMessage.content // Send only the latest user message content
        // authorId, channelId, guildId are not available/relevant here
      };
      console.log("Sending request body:", requestBody);
      // --- END MODIFICATION ---

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          // Use the access token for authorization
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody), // Use the modified request body
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Chat API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      const assistantReply = responseData.reply; 

      if (typeof assistantReply !== 'string') {
          throw new Error('Invalid response format from chat API');
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: assistantReply,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      scrollToBottom();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Request was cancelled');
      } else {
        console.error('Error in chat:', {
          error: err,
          message: err.message,
          name: err.name,
          stack: err.stack
        });
        setError('Failed to get response. Please try again.');
        setMessages(prev => prev.filter(msg => msg !== userMessage));
      }
    } finally {
      setSending(false);
      abortControllerRef.current = null;
    }
  }, [input, agent, messages, scrollToBottom]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Please sign in to chat with agents.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full max-w-4xl w-full mx-auto p-6">
      {error && (
        <div className="mb-4">
          <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md">
            {error}
          </div>
        </div>
      )}

      <div 
        className={`flex-1 overflow-y-auto mb-4 ${
          messages.length === 0 ? 'flex flex-col items-center justify-center' : 'space-y-4'
        }`}
      >
        {messages.length === 0 && !loading && agent ? (
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-gray-400">{agent.name}</h2>
          </div>
        ) : (
          messages.map((message, index) => (
            <ChatMessage key={`${message.role}-${index}`} message={message} />
          ))
        )}
        {loading && messages.length === 0 && <Loader2 className="h-8 w-8 animate-spin text-gray-500" />}
        <div ref={messagesEndRef} />
      </div>

      <div className="sticky bottom-0 bg-gray-900 pt-2 pb-2">
        <form onSubmit={handleSubmit} className="flex space-x-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={agent ? `Message ${agent.name}...` : "Type your message..."}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            disabled={sending || loading || !agent}
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            disabled={sending || loading || !agent || !input.trim()}
            aria-label="Send message"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}