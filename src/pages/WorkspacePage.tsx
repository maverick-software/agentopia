import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ChatMessage } from '../components/ChatMessage';
import type { Message, Agent } from '../types'; // Might need Team/Workspace types later

// Rename component to WorkspacePage
export function WorkspacePage() { 
  // console.log("[WorkspacePage] Component rendering start."); 

  const { user } = useAuth();
  // Correctly extract roomId from URL parameters
  const { roomId: workspaceId } = useParams<{ roomId: string }>(); // Use roomId here
  const navigate = useNavigate();
  
  // TODO: Fetch workspace data instead of agent data initially
  // const [workspace, setWorkspace] = useState<Workspace | null>(null); // Example
  const [agent, setAgent] = useState<Agent | null>(null); // Keep for now, need to determine responding agent logic
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true); 
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // const fetchWorkspaceAttempts = useRef(0); // TODO: Rename ref
  const fetchAgentAttempts = useRef(0);
  const MAX_FETCH_ATTEMPTS = 5;
  const isMounted = useRef(true); 
  const fetchInProgress = useRef(false); 

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // TODO: Refactor this effect to fetch Workspace details and potentially the list of agents in the team/workspace
  useEffect(() => {
    // console.log("[WorkspaceFetchEffect] Running due to render/mount.") // Debug log

    if (fetchInProgress.current) {
      // console.log("[WorkspaceFetchEffect] Skipping: Fetch already in progress.");
      return;
    }
    
    // Use workspaceId now
    const fetchInitialData = async (attempt = 1) => { 
      if (!workspaceId || !user?.id) {
        // console.log("[fetchInitialData] Skipping: missing workspaceId or user.id"); 
        return;
      }

      fetchInProgress.current = true;
      setLoading(true); 
      setError(null); 

      if (attempt > MAX_FETCH_ATTEMPTS) {
        console.warn(`[fetchInitialData] Max fetch attempts (${MAX_FETCH_ATTEMPTS}) reached for workspace ${workspaceId}.`);
        if (isMounted.current) {
            setError(`Failed to load workspace details after ${MAX_FETCH_ATTEMPTS} attempts.`);
            setLoading(false);
        }
        fetchInProgress.current = false; // Reset flag on final failure
        return;
      }
      
      // console.log(`[fetchInitialData] Attempt ${attempt} for workspace ${workspaceId}`); 

      const controller = new AbortController();
      abortControllerRef.current = controller; 

      try {
        // TODO: Fetch workspace data first (e.g., name, team_id)
        console.log(`[fetchInitialData] Fetching workspace ${workspaceId}... (Placeholder)`);
        // const { data: workspaceInfo, error: workspaceError } = await supabase
        //   .from('workspaces')
        //   .select('*') 
        //   .eq('id', workspaceId)
        //   .single(); 
        // if (workspaceError) throw workspaceError;
        // if (!workspaceInfo) throw new Error('Workspace not found or access denied.');
        
        // TODO: Fetch team members/agents associated with this workspace/team
        console.log(`[fetchInitialData] Fetching agents for workspace ${workspaceId}... (Placeholder)`);
        // For now, let's just fetch *one* agent associated with the user as a placeholder
        // In reality, we need to know which agent(s) are *in* this workspace/team.
        const { data: placeholderAgent, error: agentError } = await supabase
           .from('agents')
           .select('*')
           .eq('user_id', user.id) // Placeholder logic
           .limit(1)
           .single();
        
        if (agentError) throw agentError;
        if (!placeholderAgent) throw new Error('Could not find an agent for this workspace (placeholder logic).');

        if (!isMounted.current) return; 

        // setWorkspace(workspaceInfo); // Set workspace state
        setAgent(placeholderAgent); // Set placeholder agent state
        setLoading(false);
        setError(null); 
        // fetchWorkspaceAttempts.current = 0; // Reset attempts
        fetchAgentAttempts.current = 0; 
        fetchInProgress.current = false; // Reset flag on success
        
        // TODO: Fetch initial messages for the workspace
        console.log(`[fetchInitialData] Fetching initial messages for workspace ${workspaceId}... (Placeholder)`);
        // Example call:
        // await fetchMessages(workspaceId); 

      } catch (err: any) {
        if (!isMounted.current) return;

        console.error('[fetchInitialData] Error caught:', err);
        const isRetryable = attempt < MAX_FETCH_ATTEMPTS;
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(`Failed to load workspace data. ${isRetryable ? `Retrying... (${attempt}/${MAX_FETCH_ATTEMPTS})` : `Max attempts reached.`} Error: ${message}`);
        setLoading(false); 

        if (isRetryable) {
            const delay = 2000 * attempt; 
            setTimeout(() => {
                if (isMounted.current) { 
                   fetchInitialData(attempt + 1);
                }
            }, delay);
        } else {
             console.error('[fetchInitialData] Max fetch attempts reached after error.');
             fetchInProgress.current = false; // Reset flag on final failure
        }
      } finally {
         if (isMounted.current && abortControllerRef.current === controller) {
            abortControllerRef.current = null;
         }
         // Do not reset fetchInProgress here if a retry is scheduled
      }
    };

    if (workspaceId && user?.id) {
        // fetchWorkspaceAttempts.current = 0;
        fetchAgentAttempts.current = 0;
        fetchInitialData(1); 
    } else {
        setLoading(false);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [workspaceId, user?.id]); // Depend on workspaceId and user.id

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // TODO: Refactor handleSubmit to handle multiple potential responding agents?
  //       Or determine the primary responding agent for the workspace.
  //       Needs to send `roomId` (our `workspaceId`) to the backend.
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    // Use workspaceId, ensure an agent is selected/determined for response
    if (!input.trim() || !agent || sending || !user?.id || !workspaceId) return; 

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setSending(true);
      setError(null);
      setInput('');

      setMessages(prev => [...prev, userMessage]);
      requestAnimationFrame(scrollToBottom);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
          throw new Error(`Authentication error: ${sessionError?.message || 'Could not get session token.'}`);
      }
      const accessToken = session.access_token;

      // Send roomId (workspaceId) and the ID of the agent expected to respond
      const requestBody = {
        agentId: agent.id, // Which agent should respond? Needs logic.
        message: userMessage.content,
        roomId: workspaceId, // Send the workspace ID
        // channelId: null, // Set if applicable
        // members: [], // Add if needed
      };
      console.log("Sending chat request body:", requestBody); 

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal // Add abort signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        console.error("Chat API Error Response:", errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.reply) {
        const agentMessage: Message = {
          role: 'assistant',
          content: data.reply,
          timestamp: new Date(),
          agentId: agent.id, // Associate response with the agent
        };
        setMessages(prev => [...prev, agentMessage]);
      } else {
         throw new Error("Received empty reply from agent.");
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Chat request aborted.');
        setError('Chat request timed out or was cancelled.');
      } else {
        console.error('Error sending message:', err);
        setError(`Failed to get response: ${err.message}`);
        // Optionally revert optimistic user message update on error
      }
    } finally {
      setSending(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [input, agent, sending, user?.id, workspaceId, scrollToBottom]); // Add dependencies

  // TODO: Update rendering logic to show workspace info, agent list?
  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-gray-800 p-4 shadow-md flex items-center justify-between">
        {loading ? (
          <div className="animate-pulse flex items-center space-x-3">
            <div className="h-8 w-8 bg-gray-700 rounded-full"></div>
            <div className="h-4 bg-gray-700 rounded w-32"></div>
          </div>
        ) : agent ? (
          <div className="flex items-center space-x-3">
            {/* <img src={agent.avatar_url || '/default-avatar.png'} alt={agent.name} className="w-8 h-8 rounded-full" /> */}
            <h1 className="text-xl font-semibold">Chat with {agent.name} (in Workspace: {workspaceId})</h1> 
          </div>
        ) : (
           <h1 className="text-xl font-semibold text-red-500">Workspace Loading Error</h1>
        )}
        {/* Add other header elements like back button or settings if needed */}
         <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white">
           Back
         </button>
      </header>
      
      {/* Error Display */}
       {error && (
         <div className="bg-red-900 border-l-4 border-red-500 text-red-100 p-4 m-4 rounded-r-lg shadow-md" role="alert">
           <p className="font-bold flex items-center"><AlertCircle className="mr-2"/> Error</p>
           <p>{error}</p>
         </div>
       )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && !messages.length && (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          </div>
        )}
        {!loading && !messages.length && !error && (
            <div className="text-center text-gray-500 pt-10">Start the conversation!</div>
        )}
        {messages.map((msg, index) => (
          <ChatMessage key={index} message={msg} agent={agent} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <footer className="bg-gray-800 p-4">
        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Send a message..."
            disabled={sending || loading || !!error}
            className="flex-1 p-3 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim() || loading || !!error}
            className="p-3 bg-indigo-600 rounded-lg text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
          </button>
        </form>
      </footer>
    </div>
  );
}

// Added placeholder fetchMessages function (needs implementation similar to useChatMessages hook)
async function fetchMessages(sessionId: string) {
    console.log(`Placeholder: Fetch messages for ${sessionId}`);
    // Implement actual fetch logic here if not using useChatMessages hook directly
    return []; 
} 