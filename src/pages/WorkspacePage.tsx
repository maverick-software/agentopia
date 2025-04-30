import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ChatMessage } from '../components/ChatMessage';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { Workspace } from './WorkspacesListPage'; // Assuming exported from list page
import type { Message } from '../types'; // Remove Agent type import, might need Member type later

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
  // Correctly extract roomId from URL parameters
  const { roomId: workspaceId } = useParams<{ roomId: string }>(); // Use roomId here
  const navigate = useNavigate();
  
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
      setLoadingMembers(true); // Start loading members too
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
      const controller = new AbortController();
      // Do we need an abort controller specifically for this? Maybe not if it's quick.

      try {
        // Fetch workspace data first 
        const { data: workspaceInfo, error: workspaceError } = await supabase
          .from('workspaces')
          .select('id, name, created_at, owner_user_id') // Select needed fields
          .eq('id', workspaceId)
          .maybeSingle(); // Use maybeSingle to handle not found gracefully

        if (workspaceError) throw workspaceError;
        if (!workspaceInfo) throw new Error('Workspace not found or access denied.');
        
        // Set workspace state immediately after fetching it
        if (isMounted.current) {
            setWorkspace(workspaceInfo);
            setLoadingWorkspace(false); // Workspace loading done here
        } else {
            fetchWorkspaceInProgress.current = false;
            return; // Exit if unmounted
        }

        // Fetch workspace members associated with this workspace
        console.log(`[fetchWorkspaceData] Fetching members for workspace ${workspaceId}...`);
        const { data: membersData, error: membersError } = await supabase
           .from('workspace_members')
           .select('id, user_id, agent_id, role') // Fetch basic member info
           .eq('workspace_id', workspaceId);

        if (membersError) {
          // Log error but potentially continue, maybe workspace has no members yet?
          console.warn("Failed to fetch workspace members:", membersError);
          // Decide if this should be a hard error or just result in an empty list
          // throw membersError; 
        }
        
        if (!isMounted.current) return; 

        // Set members state (even if null/empty from error or no members)
        setWorkspaceMembers(membersData || []); 
        setLoadingMembers(false); // Members loading done
        
        // Remove placeholder agent fetch logic
        // console.log(`[fetchWorkspaceData] Fetching agents for workspace ${workspaceId}... (Placeholder)`);
        // const { data: placeholderAgent, error: agentError } = await supabase
        //    .from('agents')
        //    .select('*')
        //    .eq('user_id', user.id) // Placeholder logic
        //    .limit(1)
        //    .single();
        // if (agentError) console.warn("Agent placeholder fetch failed:", agentError); // Non-critical
        
        // Remove placeholder agent state setting
        // setAgent(placeholderAgent); // Set placeholder agent state
        setError(null); 
        // fetchAgentAttempts.current = 0; // Remove agent attempts logic
        fetchWorkspaceInProgress.current = false;
        
        // TODO: Fetch initial messages for the workspace/default channel
        console.log(`[fetchWorkspaceData] Fetching initial messages for workspace ${workspaceId}... (Placeholder)`);
        setLoadingMessages(false); // Assume messages loaded/or handle separately

      } catch (err: any) {
         if (!isMounted.current) return;
         console.error('[fetchWorkspaceData] Error caught:', err);
         // Handle retry logic similar to before, or simplify
         setError(`Failed to load workspace data or members: ${err.message}`);
         setLoadingWorkspace(false); // Ensure all loading stops on error
         setLoadingMembers(false); 
         setLoadingMessages(false); 
         fetchWorkspaceInProgress.current = false;
      }
    };

    if (workspaceId && user?.id) {
        // fetchAgentAttempts.current = 0; // Remove
        fetchWorkspaceData(1); 
    } else {
        setLoadingWorkspace(false);
        setLoadingMembers(false); // Ensure loading stops if no ID/user
        setLoadingMessages(false);
    }

    // No cleanup needed for abort controller here if not used

  }, [workspaceId, user?.id]); // Depend on workspaceId and user.id

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
    // Use workspaceId, ensure an agent is selected/determined for response
    // Temporarily disable sending if no members/logic yet, or keep old logic?
    // For now, let's prevent sending if the old 'agent' logic isn't met,
    // as the agent determination logic needs rework based on members.
    // if (!input.trim() || !agent || sending || !user?.id || !workspaceId) return; 
    if (!input.trim() || sending || !user?.id || !workspaceId || workspaceMembers.length === 0) {
        console.warn("Submit cancelled: Missing input, user, workspaceId, sending, or no members found.");
        // Add user feedback here if needed
        return; 
    }

    // Determine which agent should respond based on workspaceMembers - COMPLEX LOGIC NEEDED HERE
    // Placeholder: Just log members for now and don't proceed with sending to chat func yet
    console.log("Workspace Members:", workspaceMembers);
    const targetAgentId = null; // Replace with actual logic later
    // --- END OF TEMPORARY LOGIC ---
    
    // If no agent can be determined, prevent sending
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

    // ... (rest of handleSubmit needs significant changes based on targetAgentId) ...
    // ... temporarily commenting out the fetch call until agent logic is solid ...

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
  }, [input, sending, user?.id, workspaceId, scrollToBottom, workspaceMembers]); // Use workspaceMembers in dependencies

  // Update loading check to include members
  if (loadingWorkspace || loadingMembers) {
    return <div className="flex justify-center items-center h-full"><LoadingSpinner /></div>; 
  }

  if (error) {
     return <div className="text-red-500 p-4">Error loading workspace: {error}</div>;
  }
  
  if (!workspace) {
     return <div className="text-yellow-500 p-4">Workspace not found or access denied.</div>;
  }

  // Existing chat UI can be wrapped or modified to show workspace.name in a header
  return (
    <div className="flex flex-col h-full">
      {/* Simple Header Example */}
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-semibold">{workspace.name}</h1>
        {/* Add other controls like settings link here later */}
      </div>
      
      {/* Existing Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <ChatMessage key={index} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Existing Input Area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
          {/* ... input elements ... */}
      </form>
      {/* Display sending state or specific errors */} 
      {/* ... */} 
    </div>
  );
}

// Added placeholder fetchMessages function (needs implementation similar to useChatMessages hook)
async function fetchMessages(sessionId: string) {
    console.log(`Placeholder: Fetch messages for ${sessionId}`);
    // Implement actual fetch logic here if not using useChatMessages hook directly
    return []; 
} 