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
// Import the new member sidebar
import WorkspaceMemberSidebar from '@/components/workspaces/WorkspaceMemberSidebar';
// Import the new members hook
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
// Import the new chat input component
import { WorkspaceChatInput } from '@/components/WorkspaceChatInput'; 

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
  const { channels, loading: channelsLoading } = useChatChannels(workspaceId ?? null); 
  // Use the new hook to get members AND mutation functions
  const { 
    members: workspaceMembers, 
    loading: membersLoading, 
    error: membersError,
    addAgentMember, // Get mutation functions from this instance
    // addTeamMember, 
    // addUserMember 
  } = useWorkspaceMembers(workspaceId ?? null);
  
  // State for workspace details
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  // Remove placeholder agent state
  // const [agent, setAgent] = useState<Agent | null>(null); 
  // Add state for workspace members
  // const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);

  const [messages, setMessages] = useState<Message[]>([]);
  // REMOVE input state - handled by WorkspaceChat
  // const [input, setInput] = useState('');
  
  // Loading states
  const [loadingWorkspace, setLoadingWorkspace] = useState(true); 
  const [loadingMessages, setLoadingMessages] = useState(false); // Initialize to false
  // REMOVE sending state - handled by WorkspaceChat
  // const [sending, setSending] = useState(false);
  // REMOVE error state related to sending - handled by WorkspaceChat
  // const [error, setError] = useState<string | null>(null);
  // Keep general page-level error state if needed
  const [pageError, setPageError] = useState<string | null>(null); 
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // REMOVE abortControllerRef - handled by WorkspaceChat
  // const abortControllerRef = useRef<AbortController | null>(null);
  const isMounted = useRef(true); 
  const fetchWorkspaceInProgress = useRef(false); // Specific flag for workspace fetch
  const MAX_FETCH_ATTEMPTS = 5;

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (fetchWorkspaceInProgress.current) {
        fetchWorkspaceInProgress.current = false;
      }
    };
  }, []);

  // Effect to fetch Workspace details (Remove member fetching logic from here)
  useEffect(() => {
    // fetchWorkspaceInProgress ref might still be useful if other async ops happen here
    // but let's simplify for now and assume only workspace detail fetch here.
    const fetchWorkspaceDetails = async (attempt = 1) => { 
      if (!workspaceId || !user?.id) return;

      // fetchWorkspaceInProgress.current = true; // Flag not needed if only one fetch
      setLoadingWorkspace(true); 
      // setLoadingMembers(true); // Member loading handled by useWorkspaceMembers hook
      setPageError(null); // Clear previous errors

      if (attempt > MAX_FETCH_ATTEMPTS) {
        console.warn(`[fetchWorkspaceDetails] Max fetch attempts reached for workspace ${workspaceId}.`);
        if (isMounted.current) {
            setPageError(`Failed to load workspace details after ${MAX_FETCH_ATTEMPTS} attempts.`);
            setLoadingWorkspace(false);
        }
        // fetchWorkspaceInProgress.current = false; 
        return;
      }
      
      console.log(`[fetchWorkspaceDetails] Attempt ${attempt} fetching workspace ${workspaceId}...`);

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
            setPageError(null); // Clear pageError on success
        } 
        // else {
        //     fetchWorkspaceInProgress.current = false;
        //     return;
        // }

        // // Member fetching is now handled by the useWorkspaceMembers hook 
        // console.log(`[fetchWorkspaceData] Fetching members for workspace ${workspaceId}...`);
        // ... (removed member fetch query) ...
        // setWorkspaceMembers(membersData || []); 
        // setLoadingMembers(false);
        
        // Message fetching logic might depend on workspace/channel load, handle separately
        // console.log(`[fetchWorkspaceData] Fetching initial messages... (Placeholder)`);
        // setLoadingMessages(false); 

      } catch (err: any) {
         if (!isMounted.current) return;
         console.error('[fetchWorkspaceDetails] Error caught:', err);
         setPageError(`Failed to load workspace details: ${err.message}`);
         setLoadingWorkspace(false); 
         // Ensure other loading states are false if they depend on this failing?
         // setLoadingMembers(false); 
         // setLoadingMessages(false); 
         // fetchWorkspaceInProgress.current = false;
      }
    };

    if (workspaceId && user?.id) {
        fetchWorkspaceDetails(1); 
    } else {
        setLoadingWorkspace(false);
        // setLoadingMembers(false); 
        // setLoadingMessages(false);
        if (!workspaceId) setPageError('Workspace ID is missing from URL.');
        else if (!user?.id) setPageError('User ID is missing.');
    }

  }, [workspaceId, user?.id]); // Removed channelId dependency here, manage message fetching separately

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

  // --- NEW: useEffect to fetch messages when channelId changes --- 
  useEffect(() => {
    const fetchChannelMessages = async () => {
        if (!channelId || !workspaceId) {
            console.log("[fetchChannelMessages] Skipping fetch: channelId or workspaceId missing.");
            setMessages([]); // Clear messages if no channel selected
            setLoadingMessages(false);
            return;
        }

        console.log(`[fetchChannelMessages] Fetching messages for channel ${channelId}...`);
        setLoadingMessages(true);
        setPageError(null); // Clear previous errors

        try {
            // Use the RPC function to get messages with details
            const { data, error } = await supabase.rpc('get_chat_messages_with_details', {
                p_channel_id: channelId
            });

            if (error) {
                console.error("Error fetching messages via RPC:", error);
                throw new Error(error.message || 'Failed to fetch messages.');
            }

            if (isMounted.current) {
                // Transform the RPC result (which includes nested profiles) into the Message type
                const fetchedMessages: Message[] = (data || []).map((msg: any) => ({
                    role: msg.sender_agent_id ? 'assistant' : 'user',
                    content: msg.content,
                    timestamp: new Date(msg.created_at),
                    userId: msg.sender_user_id,
                    agentId: msg.sender_agent_id,
                    // Include user/agent details if needed later
                    // userName: msg.user_profile?.full_name,
                    // agentName: msg.agent_profile?.name,
                }));
                setMessages(fetchedMessages);
                setLoadingMessages(false);
            }
        } catch (err: any) {
            if (isMounted.current) {
                console.error("Error in fetchChannelMessages:", err);
                setPageError(`Failed to load messages: ${err.message}`);
                setMessages([]); // Clear messages on error
                setLoadingMessages(false);
            }
        }
    };

    fetchChannelMessages();

  }, [channelId, workspaceId]); // Dependency array includes channelId and workspaceId
  
  // --- ADD New Callback for WorkspaceChat --- 
  const handleMessageSent = useCallback((userMessage: Message, agentReply?: Message | null) => {
    console.log("[WorkspacePage] handleMessageSent called.");
    // Optimistically add the user's message
    setMessages(prev => [...prev, userMessage]);
    requestAnimationFrame(scrollToBottom); // Scroll after adding user message
    
    // TODO: Trigger a refetch of messages after a short delay to get agent reply
    // This is simpler than trying to handle the agentReply passed back.
    // We can use React Query's invalidateQueries or a simple setTimeout + refetch function.
    // Example using a placeholder refetch function:
    // setTimeout(() => {
    //   console.log("[WorkspacePage] Triggering message refetch after send...");
    //   // fetchChannelMessages(); // Need to adapt fetchChannelMessages or create a dedicated refetch
    // }, 1000); // Delay to allow backend processing

  }, [scrollToBottom]); // Dependency array

  // Loading states combined
  const isLoading = loadingWorkspace || channelsLoading; // Initial page load

  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  // Use pageError for general page loading issues
  if (pageError && !workspace) { // Show critical error only if workspace failed to load
      return <div className="p-4 text-red-600">Error: {pageError}</div>;
  }

  if (!workspace) {
    return <div className="p-4 text-orange-500">Workspace not found or access denied.</div>;
  }

  return (
    // --- Outer Container --- 
    // Make background transparent, add padding and spacing between children
    <div className="flex h-screen bg-transparent p-3 space-x-3">
      {/* Left Sidebar for Channels (Width is likely handled internally) */}
      <ChannelListSidebar roomId={workspaceId ?? ''} />

      {/* --- Center Chat Area Container --- */}
      {/* Apply styles similar to sidebars: bg, rounded, shadow, height */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-800 rounded-lg shadow-md">
        {/* Header (Keep similar style, maybe adjust bg/text if needed) */}
        {/* FIX: Remove card background/text to match container */}
        <header className="p-4 border-b border-gray-700 shadow-sm rounded-t-lg">
          <h1 className="text-xl font-semibold text-white">{workspace.name} - #{channels.find(c => c.id === channelId)?.name || 'Select Channel'}</h1> {/* Explicitly set text white */} 
          {pageError && <p className="text-xs text-destructive mt-1">{pageError}</p>}
        </header>

        {/* --- Message List --- */}
        {/* Change background for better contrast, adjust padding/spacing */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900"> {/* Changed bg */} 
          {loadingMessages ? (
              <LoadingSpinner />
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500 pt-10"> {/* Adjusted text color */} 
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg, index) => (
              <ChatMessage key={index} message={msg} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* --- Chat Input Area --- */}
        {/* Ensure input area styles fit, maybe change its bg? */}
        {/* Let's change WorkspaceChatInput's internal form bg to bg-gray-800 to match */}
        {/* We'll need to edit WorkspaceChatInput.tsx for that */}
        <WorkspaceChatInput 
           workspaceId={workspaceId ?? ''}
           channelId={channelId ?? null}
           members={workspaceMembers}
           onMessageSent={handleMessageSent}
        />
        
      </div>

      {/* Right Sidebar for Members (Width handled internally) */}
      <WorkspaceMemberSidebar 
          workspaceId={workspaceId ?? ''} 
          members={workspaceMembers} 
          onAddAgent={addAgentMember}
      />
    </div>
  );
}

// Added placeholder fetchMessages function (needs implementation similar to useChatMessages hook)
async function fetchMessages(sessionId: string) {
    console.log(`Placeholder: Fetch messages for ${sessionId}`);
    // Implement actual fetch logic here if not using useChatMessages hook directly
    return []; 
} 