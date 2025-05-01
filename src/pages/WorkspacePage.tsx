import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ChatMessage } from '../components/ChatMessage';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { Workspace } from './WorkspacesListPage'; // Assuming exported from list page
import type { Message } from '../types'; // Remove Agent type import, might need Member type later
import ChannelListSidebar from '@/components/ChannelListSidebar'; // <-- Import Sidebar
import { useChatChannels } from '@/hooks/useChatChannels'; // Import the hook

// Define a simple type for workspace members based on the table structure
interface WorkspaceMember {
  id: string;
  user_id: string | null;
  agent_id: string | null;
  role: string | null;
  // Add joined profile/agent details later if needed
}

// Rename component to WorkspacePage
export function WorkspacePage() { 
  // console.log("[WorkspacePage] Component rendering start."); 

  const { user } = useAuth();
  const { roomId: workspaceId, channelId } = useParams<{ roomId: string, channelId?: string }>(); // Get channelId too
  const navigate = useNavigate();
  const { channels, loading: channelsLoading } = useChatChannels(workspaceId ?? null); // Use the hook here too
  
  // State for workspace details
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  // Remove placeholder agent state
  // const [agent, setAgent] = useState<Agent | null>(null); 
  // Add state for workspace members
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  // Separate loading states
  const [loadingWorkspace, setLoadingWorkspace] = useState(true); 
  const [loadingMessages, setLoadingMessages] = useState(true); // Add if fetching messages
  // Add loading state for members if needed, or combine with workspace loading
  const [loadingMembers, setLoadingMembers] = useState(true); 
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // const fetchWorkspaceAttempts = useRef(0);
  // const fetchAgentAttempts = useRef(0); // Still placeholder
  const MAX_FETCH_ATTEMPTS = 5;
  const isMounted = useRef(true); 
  const fetchWorkspaceInProgress = useRef(false); // Specific flag for workspace fetch

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

  // Effect to fetch Workspace details and Members
  useEffect(() => {
    if (fetchWorkspaceInProgress.current) return;
    
    const fetchWorkspaceData = async (attempt = 1) => { 
      if (!workspaceId || !user?.id) return;

      fetchWorkspaceInProgress.current = true;
      setLoadingWorkspace(true); 
      setLoadingMembers(true); 
      setError(null); 

      if (attempt > MAX_FETCH_ATTEMPTS) {
        console.warn(`[fetchWorkspaceData] Max fetch attempts reached for workspace ${workspaceId}.`);
        if (isMounted.current) {
            setError(`Failed to load workspace details after ${MAX_FETCH_ATTEMPTS} attempts.`);
            setLoadingWorkspace(false);
        }
        fetchWorkspaceInProgress.current = false; 
        return;
      }
      
      console.log(`[fetchWorkspaceData] Attempt ${attempt} fetching workspace ${workspaceId}...`);

      try {
        const { data: workspaceInfo, error: workspaceError } = await supabase
          .from('workspaces')
          .select('id, name, created_at, owner_user_id')
          .eq('id', workspaceId)
          .maybeSingle();

        if (workspaceError) throw workspaceError;
        if (!workspaceInfo) throw new Error('Workspace not found or access denied.');
        
        if (isMounted.current) {
            setWorkspace(workspaceInfo);
            setLoadingWorkspace(false);
        } else {
            fetchWorkspaceInProgress.current = false;
            return;
        }

        console.log(`[fetchWorkspaceData] Fetching members for workspace ${workspaceId}...`);
        const { data: membersData, error: membersError } = await supabase
           .from('workspace_members')
           .select('id, user_id, agent_id, role')
           .eq('workspace_id', workspaceId);

        if (membersError) {
          console.warn("Failed to fetch workspace members:", membersError);
        }
        
        if (!isMounted.current) return; 

        setWorkspaceMembers(membersData || []); 
        setLoadingMembers(false);
        setError(null);
        fetchWorkspaceInProgress.current = false;
        
        console.log(`[fetchWorkspaceData] Fetching initial messages for workspace ${workspaceId}, channel ${channelId}... (Placeholder)`);
        // TODO: Implement actual message fetching based on channelId
        setLoadingMessages(false);

      } catch (err: any) {
         if (!isMounted.current) return;
         console.error('[fetchWorkspaceData] Error caught:', err);
         setError(`Failed to load workspace data or members: ${err.message}`);
         setLoadingWorkspace(false);
         setLoadingMembers(false); 
         setLoadingMessages(false); 
         fetchWorkspaceInProgress.current = false;
      }
    };

    if (workspaceId && user?.id) {
        fetchWorkspaceData(1); 
    } else {
        setLoadingWorkspace(false);
        setLoadingMembers(false);
        setLoadingMessages(false);
        setError('Workspace ID or User ID is missing.'); // Provide error if no ID
    }

  }, [workspaceId, user?.id, channelId]); // Add channelId dependency

  // *** NEW useEffect: Navigate to first channel if none selected ***
  useEffect(() => {
    // Only run if workspace data is loaded, channels are loaded, 
    // we are NOT currently loading messages, AND no channelId is in the URL
    if (!loadingWorkspace && !channelsLoading && !channelId && channels && channels.length > 0) {
      const firstChannelId = channels[0].id;
      console.log(`[WorkspacePage] No channelId in URL, navigating to first channel: ${firstChannelId}`);
      navigate(`/workspaces/${workspaceId}/channels/${firstChannelId}`, { replace: true });
    }
    // Add dependencies: workspaceId, channelId, channels, channelsLoading, loadingWorkspace, navigate
  }, [workspaceId, channelId, channels, channelsLoading, loadingWorkspace, navigate]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // TODO: Refactor handleSubmit to handle multiple potential responding agents?
  //       Or determine the primary responding agent for the workspace.
  //       Needs to send `roomId` (our `workspaceId`) to the backend.
  //       Needs to use `workspaceMembers` instead of `agent`.
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending || !user?.id || !workspaceId || !channelId || workspaceMembers.length === 0) { // Added channelId check
        console.warn("Submit cancelled: Check input, user, workspaceId, channelId, sending status, or members.");
        setError("Cannot send message. Ensure you are in a channel and the workspace has members.");
        return; 
    }

    console.log("Workspace Members:", workspaceMembers);
    const targetAgentId = null; // Replace with actual logic later
    
    if (!targetAgentId) {
      setError("Could not determine which agent should respond in this workspace.");
      console.error("handleSubmit: Failed to determine target agent from members:", workspaceMembers);
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    // --- Temporarily Commented Out Fetch --- 
    /*
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
        // agentId: agent.id, // Which agent should respond? Needs logic. Use targetAgentId
        agentId: targetAgentId, 
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
          // agentId: agent.id, // Associate response with the agent - use targetAgentId
          agentId: targetAgentId,
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
    */
    // --- End Temp Comment --- 

    // Placeholder to simulate sending
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    requestAnimationFrame(scrollToBottom);
    console.warn("handleSubmit: Chat fetch call is temporarily disabled until agent selection logic is implemented.");

  }, [input, sending, user?.id, workspaceId, channelId, workspaceMembers, scrollToBottom]); // Add channelId dependency

  // Render loading state for the whole page until workspace/members are loaded
  if (loadingWorkspace || loadingMembers || channelsLoading) {
    return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;
  }

  // Handle case where workspace couldn't be loaded or wasn't found
  if (error && !workspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-500">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p className="text-xl font-semibold">Error Loading Workspace</p>
        <p>{error}</p>
        <button onClick={() => navigate('/workspaces')} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
          Back to Workspaces
        </button>
      </div>
    );
  }
  
  // Ensure workspaceId is available before rendering sidebar
  if (!workspaceId) {
      return <div className="text-red-500 p-4">Error: Workspace ID is missing from URL.</div>; 
  }

  return (
    // Add padding and rounded corners to this container
    <div className="flex flex-1 h-full overflow-hidden bg-gray-800 rounded-lg p-3 shadow-lg"> 
      
      {/* Channel Sidebar */}
      {/* Adjust sidebar styling slightly if needed due to parent padding */}
      <ChannelListSidebar roomId={workspaceId} /> 

      {/* Main Chat Area Container */}
      {/* Remove bg-gray-900 if parent has bg-gray-800 */}
      <div className="flex-1 flex flex-col overflow-hidden ml-3"> {/* Add margin-left */}

        {/* Message List Area */}
        {/* Ensure background contrast if needed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 bg-gray-900 rounded-t-lg"> {/* Added bg and rounded top */}
          {loadingMessages ? (
              <LoadingSpinner />
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500">No messages in this channel yet.</div>
          ) : (
            messages.map((msg, index) => (
              <ChatMessage key={index} message={msg} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {/* Ensure background contrast */}
        <div className="p-4 border-t border-gray-700 bg-gray-800 rounded-b-lg"> {/* Added rounded bottom */} 
          {/* ... error display and form ... */} 
          {error && !workspace && (
            <div className="text-red-500 text-sm mb-2">Error: {error}</div>
          )}
          <form onSubmit={handleSubmit} className="flex items-center space-x-2">
             {/* ... input and button ... */} 
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..." 
              className="flex-1 p-2 rounded bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={sending || !workspace || !channelId} // Also disable if no channelId
            />
            <button
              type="submit"
              disabled={sending || !input.trim() || !workspace || !channelId} // Also disable if no channelId
              className="p-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </form>
        </div>
      </div>

      {/* Optional Right Sidebar for Members List - Add later */}
      
    </div>
  );
}

// Added placeholder fetchMessages function (needs implementation similar to useChatMessages hook)
async function fetchMessages(sessionId: string) {
    console.log(`Placeholder: Fetch messages for ${sessionId}`);
    // Implement actual fetch logic here if not using useChatMessages hook directly
    return []; 
} 