import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ChatMessage } from '../components/ChatMessage';
import AIThinkingIndicator, { AIState, ToolExecutionStatus } from '../components/AIThinkingIndicator';
import type { Message } from '../types';
import type { Database } from '../types/database.types';

type Agent = Database['public']['Tables']['agents']['Row'];

export function AgentChatPage() {
  // console.log("[AgentChatPage] Component rendering start."); // Cleaned log

  const { user } = useAuth();
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true); // Start loading true
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // AI State tracking
  const [aiState, setAiState] = useState<AIState | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolExecutionStatus | null>(null);
  const [showAIIndicator, setShowAIIndicator] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchAgentAttempts = useRef(0);
  const MAX_FETCH_ATTEMPTS = 5;
  const isMounted = useRef(true); // Track mount status for async operations
  const fetchInProgress = useRef(false); // Ref to track if a fetch is already in progress
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // AI State Management Functions
  const startAIProcessing = useCallback(() => {
    setShowAIIndicator(true);
    setAiState('thinking');
    setCurrentTool(null);
  }, []);

  const updateAIState = useCallback((newState: AIState, toolInfo?: Partial<ToolExecutionStatus>) => {
    setAiState(newState);
    if (toolInfo) {
      setCurrentTool(prev => ({ ...prev, ...toolInfo } as ToolExecutionStatus));
    }
  }, []);

  const completeAIProcessing = useCallback((success: boolean = true) => {
    setAiState(success ? 'completed' : 'failed');
    // The AIThinkingIndicator will auto-hide after 3 seconds
    setTimeout(() => {
      setShowAIIndicator(false);
      setAiState(null);
      setCurrentTool(null);
    }, 3500);
  }, []);

  // Simulate AI processing phases
  const simulateAIProcessing = useCallback(async () => {
    // Phase 1: Thinking
    updateAIState('thinking');
    await new Promise(resolve => setTimeout(resolve, 800));

    // Phase 2: Analyzing tools
    updateAIState('analyzing_tools');
    await new Promise(resolve => setTimeout(resolve, 600));

    // Phase 3: Check if we might execute a tool (simulate tool detection)
    const mightUseTool = input.toLowerCase().includes('send') || 
                         input.toLowerCase().includes('email') ||
                         input.toLowerCase().includes('gmail') ||
                         input.toLowerCase().includes('read') ||
                         input.toLowerCase().includes('check');

    if (mightUseTool) {
      // Phase 4: Tool execution
      updateAIState('executing_tool', {
        toolName: 'gmail_send_message',
        provider: 'gmail',
        status: 'executing',
        startTime: new Date(),
      });
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Phase 5: Processing results
      updateAIState('processing_results', {
        status: 'completed',
        endTime: new Date(),
      });
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Phase 6: Generating response
    updateAIState('generating_response');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, [input, updateAIState]);

  // Effect to handle component unmount for async operations
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // Abort any ongoing fetch if component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        // console.log('[AgentChatPage] Unmounting: Aborted ongoing fetch.'); // Optional log
      }
    };
  }, []);

  // Main Effect for Fetching Agent Data - Modified to run on render and use fetchInProgress guard
  useEffect(() => {
    // console.log("[AgentFetchEffect] Running due to render/mount.") // Debug log

    // Guard against multiple simultaneous fetches
    if (fetchInProgress.current) {
      // console.log("[AgentFetchEffect] Skipping: Fetch already in progress.");
      return;
    }

    // Define the fetch function directly inside the effect
    const fetchAgent = async (attempt = 1) => {
      // Check using the correct parameter name: agentId
      // This check is crucial now as the effect runs more often
      if (!agentId || !user?.id) {
        // console.log("[fetchAgent] Skipping: missing agentId or user.id"); // Cleaned log
        // Only set loading false if we *know* we shouldn't fetch yet.
        // Don't set loading=false here unconditionally, as a valid fetch might start later.
        // Consider setting loading only when a fetch *starts* or definitively *fails*.
        return;
      }

      // If we proceed, mark fetch as in progress
      fetchInProgress.current = true;
      setLoading(true); // Set loading true when a valid fetch attempt starts
      setError(null); // Clear previous errors on new attempt

      if (attempt > MAX_FETCH_ATTEMPTS) {
        console.warn(`[fetchAgent] Max fetch attempts (${MAX_FETCH_ATTEMPTS}) reached for agent ${agentId}.`);
        if (isMounted.current) {
            setError(`Failed to load agent details after ${MAX_FETCH_ATTEMPTS} attempts.`);
            setLoading(false);
        }
        return;
      }

      // console.log(`[fetchAgent] Attempt ${attempt} for agent ${agentId}`); // Cleaned log

      // Use a local abort controller for this specific fetch attempt
      const controller = new AbortController();
      abortControllerRef.current = controller; // Store controller to allow cancellation

      try {
        // console.log(`[fetchAgent] Querying Supabase for agent id: ${agentId}, user_id: ${user.id}`); // Cleaned log
        const { data, error: fetchError } = await supabase
          .from('agents')
          .select('*')
          .eq('id', agentId)
          .eq('user_id', user.id)
          .single(); // Removed .abortSignal() as it's not directly supported here

        // console.log("[fetchAgent] Supabase query completed.", { data, fetchError }); // Cleaned log

        if (!isMounted.current) {
             console.log("[fetchAgent] Unmounted after Supabase query returned.");
             return; // Prevent further processing if unmounted
        }

        if (fetchError) {
          // Check if component is still mounted *before* throwing or processing error
          if (!isMounted.current) {
              console.log("[fetchAgent] Unmounted after Supabase query returned an error.");
              return;
          }
          if (fetchError.name === 'AbortError') {
             console.log('[fetchAgent] Fetch aborted.');
             return; // Stop execution if aborted
          }
          console.error("[fetchAgent] Supabase error:", fetchError);
          throw new Error(fetchError.message || 'Failed to fetch agent data from database.');
        }

        if (!data) {
          console.warn("[fetchAgent] Agent not found or access denied.");
          throw new Error('Agent not found or you do not have permission to access it.');
        }

        // Check if component is still mounted before updating state
        if (isMounted.current) {
            // console.log("[fetchAgent] Setting agent state with data:", data); // Cleaned log
            setAgent(data);
            setLoading(false);
            setError(null); // Clear error on success
            fetchAgentAttempts.current = 0; // Reset attempts on success
            // console.log("[fetchAgent] Fetch successful."); // Cleaned log
        } else {
             console.log("[fetchAgent] Component unmounted before setting state.");
        }

      } catch (err: any) {
         if (!isMounted.current) {
             console.log("[fetchAgent] Unmounted during error handling.");
             return;
         }
         // Don't check for AbortError here specifically, rely on isMounted

        console.error('[fetchAgent] Error caught:', err);
        const isRetryable = attempt < MAX_FETCH_ATTEMPTS;
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(`Failed to load agent details. ${isRetryable ? `Retrying... (${attempt}/${MAX_FETCH_ATTEMPTS})` : `Max attempts reached.`} Error: ${message}`);
        setLoading(false); // Stop loading on error

        if (isRetryable) {
            const delay = 2000 * attempt; // Exponential backoff
            // console.log(`[fetchAgent] Scheduling retry in ${delay}ms`); // Cleaned log
            setTimeout(() => {
                if (isMounted.current) { // Check mount status again before retrying
                   fetchAgent(attempt + 1);
                }
            }, delay);
        } else {
             console.error('[fetchAgent] Max fetch attempts reached after error.');
        }
      } finally {
         // Clean up abort controller ref if this was the active controller and component still mounted
         if (isMounted.current && abortControllerRef.current === controller) {
            abortControllerRef.current = null;
         }
         // IMPORTANT: Reset fetchInProgress flag only when fetch completes (success or final error)
         if (isMounted.current) {
             fetchInProgress.current = false;
         }
         // setLoading(false); // Loading is handled within try/catch/retry logic now
      }
    };

    // Trigger the fetch only if agentId and user.id are available
    if (agentId && user?.id) {
        // Reset attempts count *only* when we initiate a new fetch sequence
        fetchAgentAttempts.current = 0;
        fetchAgent(1); // Start fetch with attempt 1
    } else {
        // If required IDs aren't present yet, ensure loading is false
        setLoading(false);
    }

    // Cleanup function still relevant for aborting on unmount
    return () => {
      if (abortControllerRef.current) {
        // console.log('[AgentFetchEffect Cleanup] Aborting active fetch on unmount/re-render.'); // Optional log
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // Reset fetch in progress flag if the effect re-runs and cancels an ongoing fetch
      // Although the guard should prevent re-entry, this is a safeguard
      // fetchInProgress.current = false; // Let the finally block handle this
    };
  // NO DEPENDENCIES: Effect runs on every render. Guarded by fetchInProgress and agentId/user.id checks.
  }, []); // <-- Dependency array removed

  // Effect for scrolling messages
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Effect to fetch chat history
  useEffect(() => {
    const fetchHistory = async () => {
      if (!agentId || !user?.id) return;

      setIsHistoryLoading(true);
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .or(`sender_agent_id.eq.${agentId},sender_user_id.eq.${user.id}`)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (data) {
          const formattedMessages: Message[] = data.map((msg: any) => ({
            role: msg.sender_agent_id ? 'assistant' : 'user',
            content: msg.content,
            timestamp: new Date(msg.created_at),
            agentId: msg.sender_agent_id,
            userId: msg.sender_user_id,
          }));
          setMessages(formattedMessages);
        }
      } catch (err) {
        console.error("Failed to fetch chat history:", err);
        setError("Could not load chat history.");
      } finally {
        setIsHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [agentId, user?.id]);


  // Submit Message Handler - Enhanced with AI state tracking
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !agent || sending || !user?.id) return; // Added user?.id check

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    // Use a local abort controller for the chat request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setSending(true);
      setError(null);
      
      // Start AI processing indicator
      startAIProcessing();
      
      const inputContent = input.trim();
      setInput('');

      // Add user message immediately for responsiveness
      setMessages(prev => [...prev, userMessage]);
      // Scroll after adding user message
      requestAnimationFrame(scrollToBottom);

      // Run AI processing simulation in parallel with actual request
      const processingPromise = simulateAIProcessing();


      // Get the current session and access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
          throw new Error(`Authentication error: ${sessionError?.message || 'Could not get session token.'}`);
      }
      const accessToken = session.access_token;

      const requestBody = {
        agentId: agent.id,
        message: inputContent
      };
      // console.log("Sending chat request body:", requestBody); // Cleaned log

      // Wait for both the API response and the processing simulation
      const [response] = await Promise.all([
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal, // Use the local abort controller's signal
        }),
        processingPromise
      ]);

      if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Chat API error:', { status: response.status, statusText: response.statusText, error: errorData });
        throw new Error(errorData.error || `Chat service failed: ${response.statusText} (Status: ${response.status})`);
      }

      const responseData = await response.json();
      const assistantReply = responseData.message;

      if (typeof assistantReply !== 'string') {
          console.error('Invalid response format from chat API:', responseData);
          throw new Error('Received an invalid response format from the chat service.');
      }

      // Complete AI processing successfully
      completeAIProcessing(true);

      const assistantMessage: Message = {
        role: 'assistant',
        content: assistantReply,
        timestamp: new Date(),
      };

      // Check mount status before setting state
      if (isMounted.current) {
           setMessages(prev => [...prev, assistantMessage]);
           // Scroll after adding assistant message
           requestAnimationFrame(scrollToBottom);
      } else {
           console.log("[handleSubmit] Component unmounted before adding assistant message.");
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[handleSubmit] Chat request cancelled.');
        // Complete AI processing as failed
        completeAIProcessing(false);
        // If aborted, remove the optimistic user message if needed (depends on desired UX)
        // setMessages(prev => prev.filter(msg => msg !== userMessage));
      } else {
        console.error('Error submitting chat message:', err);
        // Complete AI processing as failed
        completeAIProcessing(false);
        if (isMounted.current) {
             setError(`Failed to send message: ${err.message}. Please try again.`);
             // Remove the optimistic user message on error
             setMessages(prev => prev.filter(msg => msg !== userMessage));
        }
      }
    } finally {
      // Check mount status before setting state
      if (isMounted.current) {
          setSending(false);
      }
      // Clean up abort controller ref if this was the active controller
      if (abortControllerRef.current === controller) {
         abortControllerRef.current = null;
      }
    }
  // Dependencies for chat submission
  }, [input, agent, sending, user?.id, scrollToBottom, startAIProcessing, simulateAIProcessing, completeAIProcessing]); // Added AI processing functions


  // Render logic below
  if (!user) {
    // console.log("[AgentChatPage] No user found, redirecting or showing sign-in message."); // Cleaned log
    // Optional: Redirect to login or show a more prominent message
    // useEffect(() => { navigate('/login'); }, [navigate]); // Example redirect
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Please sign in to chat with agents.</div>
      </div>
    );
  }

  // Loading state specifically for the agent fetch
  if (loading && !agent) {
      return (
          <div className="flex flex-col flex-1 h-full max-w-4xl w-full mx-auto p-6 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              <p className="text-gray-400 mt-2">Loading agent details...</p>
          </div>
      );
  }

  // Error state specifically for the agent fetch (if agent hasn't loaded)
   if (error && !agent) {
      return (
          <div className="flex flex-col flex-1 h-full max-w-4xl w-full mx-auto p-6 items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="text-red-400 mt-2 text-center">Error loading agent: {error}</p>
              {/* Optional: Add a retry button */}
              {/* <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-700">Retry</button> */}
          </div>
      );
   }

   // Agent not found state (after loading finished without error, but no agent data)
   if (!loading && !agent) {
        return (
          <div className="flex flex-col flex-1 h-full max-w-4xl w-full mx-auto p-6 items-center justify-center">
              <AlertCircle className="h-8 w-8 text-yellow-500" />
              <p className="text-yellow-400 mt-2 text-center">Agent not found or could not be loaded.</p>
          </div>
      );
   }


  return (
    <div className="flex flex-col flex-1 h-full max-w-4xl w-full mx-auto">
      {/* Header can go here if needed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {isHistoryLoading ? (
           <div className="flex h-full items-center justify-center">
             <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
           </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p>No messages yet. Send the first one!</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <ChatMessage 
              key={`${message.role}-${index}-${message.timestamp.toISOString()}`} 
              message={message} 
            />
          ))
        )}
        
        {/* AI Thinking Indicator */}
        {showAIIndicator && aiState && (
          <AIThinkingIndicator
            state={aiState}
            currentTool={currentTool || undefined}
            agentName={agent?.name || 'Agent'}
            onComplete={() => {
              setShowAIIndicator(false);
              setAiState(null);
              setCurrentTool(null);
            }}
          />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-background border-t p-4">
        <form onSubmit={handleSubmit} className="flex space-x-4 items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={agent ? `Message ${agent.name}...` : "Loading agent..."}
            className="flex-1 bg-muted border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            disabled={sending || !agent}
            aria-label="Chat message input"
          />
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-lg px-4 h-12 flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-ring"
            disabled={sending || !agent || !input.trim()}
            aria-label="Send message"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}