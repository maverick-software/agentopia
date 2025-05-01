import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, AlertCircle, CheckCircle2, Loader2, Menu, Users } from 'lucide-react';
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
import { Button } from '@/components/ui/button';

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
  
  // --- ADD State for Responsive Sidebars ---
  const [isChannelSidebarOpen, setIsChannelSidebarOpen] = useState(false);
  const [isMemberSidebarOpen, setIsMemberSidebarOpen] = useState(false);
  // --- End State --- 

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

  // --- Refactored Message Fetching Logic --- 
  const fetchMessagesForChannel = useCallback(async (isRefresh: boolean = false) => {
    if (!channelId || !workspaceId) {
        console.log("[fetchMessagesForChannel] Skipping fetch: channelId or workspaceId missing.");
        setMessages([]);
        setLoadingMessages(false);
        return;
    }
    console.log(`[fetchMessagesForChannel] Fetching messages (isRefresh: ${isRefresh}) for channel ${channelId}...`);
    // Only set loading on initial load, not on refresh
    if (!isRefresh) {
      setLoadingMessages(true);
    }
    // Always clear page errors before fetch attempt
    setPageError(null); 
    try {
        const { data, error } = await supabase.rpc('get_chat_messages_with_details', {
            p_channel_id: channelId
        });
        if (error) throw new Error(error.message || 'Failed to fetch messages.');
        if (isMounted.current) {
            const fetchedMessages: Message[] = (data || []).map((msg: any) => {
                // Extract agent name from the agent property if it exists
                const agentName = msg.agent && typeof msg.agent === 'object' ? msg.agent.name : null;
                console.log("Message agent data:", msg.agent, "Extracted name:", agentName);
                
                return {
                    id: msg.id, 
                    role: msg.sender_agent_id ? 'assistant' : 'user',
                    content: msg.content,
                    timestamp: new Date(msg.created_at),
                    userId: msg.sender_user_id,
                    agentId: msg.sender_agent_id,
                    agentName: agentName, 
                };
            });
            console.log("[fetchMessagesForChannel] Mapped messages:", fetchedMessages);
            setMessages(fetchedMessages);
            // Only set loading false if it was set true initially (or always set false?)
            // Let's always set it false to be safe, covers initial load and potential refresh edge cases.
            setLoadingMessages(false); 
        }
    } catch (err: any) {
        if (isMounted.current) {
            console.error("Error in fetchMessagesForChannel:", err);
            setPageError(`Failed to load messages: ${err.message}`);
            setMessages([]);
            setLoadingMessages(false); // Ensure loading is false on error
        }
    }
  }, [channelId, workspaceId]); // Dependencies: channelId, workspaceId

  // --- useEffect to fetch messages when channelId changes --- 
  useEffect(() => {
    // Call for initial load (isRefresh = false by default)
    fetchMessagesForChannel();
  }, [fetchMessagesForChannel]); // Depend on the useCallback function

  // --- ADD New Callback for WorkspaceChat --- 
  const handleMessageSent = useCallback((userMessage: Message, agentReply?: Message | null) => {
    console.log("[WorkspacePage] handleMessageSent called.");
    setMessages(prev => [...prev, userMessage]);
    requestAnimationFrame(scrollToBottom);
    
    const refreshTimeout = setTimeout(() => {
      console.log("[WorkspacePage] Triggering message refetch after send...");
      // Call fetch with isRefresh = true
      fetchMessagesForChannel(true); 
    }, 3000);

    return () => clearTimeout(refreshTimeout);
    
  }, [scrollToBottom, fetchMessagesForChannel]);

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
    <div className="flex w-full h-full bg-gray-900 overflow-hidden p-4">
      <div className="flex w-full h-full mx-auto gap-4">
        {/* --- Toggle Buttons for Small Screens --- */}
        <Button 
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 z-50 md:hidden bg-gray-800 hover:bg-gray-700 text-white rounded-md"
          onClick={() => setIsChannelSidebarOpen(!isChannelSidebarOpen)}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle Channels</span>
        </Button>
        {/* Member Toggle */}
        <Button 
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 md:hidden bg-gray-800 hover:bg-gray-700 text-white rounded-md"
          onClick={() => setIsMemberSidebarOpen(!isMemberSidebarOpen)}
        >
          <Users className="h-5 w-5" />
          <span className="sr-only">Toggle Members</span>
        </Button>
        {/* --- End Toggle Buttons --- */}

        {/* --- Left Column: Navigation / Channel List --- */}
        <div className={`
          fixed md:relative top-0 left-0 h-full z-40 
          w-64 md:w-60 lg:w-64
          bg-gray-800 border-r border-gray-700 rounded-lg
          transition-transform duration-200 ease-in-out transform 
          ${isChannelSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0 md:z-auto md:flex-shrink-0
          shadow-lg md:shadow-none
        `}>
          <ChannelListSidebar roomId={workspaceId ?? ''} />
        </div>

        {/* --- Center Column: Main Content / Chat Area --- */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-800 rounded-lg shadow-md">
          {/* --- Message List --- */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-700/10 rounded-t-lg"> 
            {loadingMessages ? (
                <LoadingSpinner />
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-400 pt-10">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg, index) => (
                <ChatMessage key={msg.id || index} message={msg} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* --- Chat Input Area --- */}
          <div className="px-4 py-3 bg-gray-800 border-t border-gray-700 rounded-b-lg">
            <WorkspaceChatInput 
               workspaceId={workspaceId ?? ''}
               channelId={channelId ?? null}
               members={workspaceMembers}
               onMessageSent={handleMessageSent}
            />
          </div>
        </div>

        {/* --- Right Column: Contextual Information / Member List --- */}
        <div className={`
          fixed md:relative top-0 right-0 h-full z-40 
          w-64 md:w-60 lg:w-64
          bg-gray-800 border-l border-gray-700 rounded-lg
          transition-transform duration-200 ease-in-out transform 
          ${isMemberSidebarOpen ? 'translate-x-0' : 'translate-x-full'} 
          md:translate-x-0 md:z-auto md:flex-shrink-0
          shadow-lg md:shadow-none
        `}>
            <WorkspaceMemberSidebar 
                workspaceId={workspaceId ?? ''} 
                members={workspaceMembers} 
                onAddAgent={addAgentMember}
            />
        </div>
      </div>
    </div>
  );
}

// Added placeholder fetchMessages function (needs implementation similar to useChatMessages hook)
async function fetchMessages(sessionId: string) {
    console.log(`Placeholder: Fetch messages for ${sessionId}`);
    // Implement actual fetch logic here if not using useChatMessages hook directly
    return []; 
} 