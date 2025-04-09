import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDatabase } from '../contexts/DatabaseContext';
import { supabase } from '../lib/supabase';
import { ChatMessage } from '../components/ChatMessage';
import type { Message, Agent } from '../types';

interface ConnectionStatus {
  database: boolean;
  openai: boolean;
  loading: boolean;
  databaseError: string | null;
  openaiError: string | null;
}

export function AgentChat() {
  const { user } = useAuth();
  const { isConnected: isDatabaseConnected } = useDatabase();
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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    database: false,
    openai: false,
    loading: true,
    databaseError: null,
    openaiError: null
  });
  const fetchAgentAttempts = useRef(0);
  const MAX_FETCH_ATTEMPTS = 5;

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Check OpenAI connection
  const checkOpenAIConnection = useCallback(async () => {
    try {
      // Get the current session and access token
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        console.error('No access token found for health check');
        return {
          isConnected: false,
          error: 'Authentication error: User not logged in?'
        };
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat/health`, {
        headers: {
          // Use the access token for authorization
          'Authorization': `Bearer ${accessToken}`,
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('OpenAI health check failed:', {
          status: response.status,
          statusText: response.statusText,
          error
        });
        return {
          isConnected: false,
          error: `OpenAI service error: ${response.statusText}`
        };
      }

      const data = await response.json();
      return {
        isConnected: data.status === 'healthy',
        error: data.status !== 'healthy' ? 'OpenAI service is not healthy' : null
      };
    } catch (err) {
      console.error('OpenAI health check error:', {
        error: err,
        message: err.message,
        name: err.name,
        stack: err.stack
      });
      return {
        isConnected: false,
        error: `OpenAI service error: ${err.message}`
      };
    }
  }, []);

  // Check connections periodically
  useEffect(() => {
    let mounted = true;
    let interval: NodeJS.Timeout;

    const checkConnections = async () => {
      if (!mounted) return;

      setConnectionStatus(prev => ({ ...prev, loading: true }));
      
      // Check OpenAI connection independently
      const openaiStatus = await checkOpenAIConnection();
      
      if (!mounted) return;

      setConnectionStatus({
        database: isDatabaseConnected,
        openai: openaiStatus.isConnected,
        loading: false,
        databaseError: !isDatabaseConnected ? 'Database connection failed' : null,
        openaiError: openaiStatus.error
      });
    };

    // Initial check
    checkConnections();

    // Set up periodic checks
    interval = setInterval(checkConnections, 30000); // Check every 30 seconds

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isDatabaseConnected, checkOpenAIConnection]);

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
    fetchAgentAttempts.current = 0; // Reset before initial sequence
    fetchAgent(true); // Trigger initial call

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort(); // Keep chat abort logic
      }
    };
  }, [id, user, fetchAgent]);

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

      const chatMessages = messages.map(({ role, content }) => ({ role, content }));
      chatMessages.push({ role: userMessage.role, content: userMessage.content });

      // Get the current session and access token
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error('Authentication error: User not logged in?');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          // Use the access token for authorization
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatMessages,
          agentId: agent.id,
        }),
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

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body received');
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === 'assistant') {
            lastMessage.content = buffer;
          }
          return newMessages;
        });
      }

      scrollToBottom();
    } catch (err) {
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

  const ConnectionStatusIndicator = () => (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h2 className="text-lg font-semibold mb-3">System Status</h2>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span>Database Connection</span>
          {connectionStatus.loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : connectionStatus.database ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
        </div>
        {connectionStatus.databaseError && (
          <div className="text-sm text-red-400 ml-6">
            {connectionStatus.databaseError}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span>OpenAI Service</span>
          {connectionStatus.loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : connectionStatus.openai ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
        </div>
        {connectionStatus.openaiError && (
          <div className="text-sm text-red-400 ml-6">
            {connectionStatus.openaiError}
          </div>
        )}
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Please sign in to chat with agents.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => navigate('/agents')}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold">
          {loading ? 'Loading...' : agent ? `Chat with ${agent.name}` : 'Chat'}
        </h1>
      </div>

      <ConnectionStatusIndicator />

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md mb-4">
          {error}
        </div>
      )}

      <div className="flex-1 bg-gray-800 rounded-lg p-4 overflow-y-auto mb-4 space-y-4">
        {messages.map((message, index) => (
          <ChatMessage key={`${message.role}-${index}`} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex space-x-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          disabled={sending || !connectionStatus.database || !connectionStatus.openai}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending || !connectionStatus.database || !connectionStatus.openai}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[48px] transition-colors"
        >
          {sending ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
    </div>
  );
}