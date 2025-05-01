import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Loader2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/types';
import type { WorkspaceMemberDetail } from '@/hooks/useWorkspaceMembers';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// RENAME interface
interface WorkspaceChatInputProps {
  workspaceId: string;
  channelId: string | null;
  members: WorkspaceMemberDetail[]; // Pass members for mention suggestions
  onMessageSent: (userMessage: Message, agentReply?: Message | null) => void; // Callback after sending/receiving
}

// RENAME function
export function WorkspaceChatInput({ workspaceId, channelId, members, onMessageSent }: WorkspaceChatInputProps) {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // --- ADD State for Mentions ---
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<WorkspaceMemberDetail[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null); // Ref for input element
  // --- End State for Mentions ---

  // Adapted handleSubmit logic
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending || !user?.id || !workspaceId || !channelId) {
      console.warn("Submit cancelled: Check input, user, workspaceId, channelId, or sending status.");
      return;
    }

    // Use the stored selectedAgentId
    const agentIdToSend = selectedAgentId; 

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      userId: user.id
    };
    
    const messageContent = input.trim();
    setInput(''); // Clear input immediately
    setSelectedAgentId(null); // Clear selected agent
    setShowSuggestions(false); // Hide suggestions
    setMentionQuery(null); // Clear mention query

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setSending(true);
      setError(null);
      
      // --- Call the parent's onMessageSent optimistically ---
      // Note: At this point, we don't have the agent reply yet.
      // The parent component (WorkspacePage) will handle adding the user message
      // and then potentially refreshing the list later to get the agent reply.
      // We might adjust this callback later.
      onMessageSent(userMessage, null); 

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error(`Authentication error: ${sessionError?.message || 'Could not get session token.'}`);
      }
      const accessToken = session.access_token;

      // Send message to backend function
      const requestBody = {
        agentId: agentIdToSend, // Use the selected agent ID (or null)
        message: messageContent,
        roomId: workspaceId, // Pass workspaceId as roomId
        channelId: channelId,
      };
      console.log("[ChatInput] Sending chat request body:", requestBody);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      abortControllerRef.current = null; // Clear controller ref

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          // Ignore JSON parsing error if response is not JSON
        }
        console.error(`[ChatInput] HTTP error! Status: ${response.status}`, errorData);
        throw new Error(errorData?.error || `HTTP error ${response.status}`);
      }

      const result = await response.json();
      console.log("[ChatInput] Received response:", result);

      // If the backend handled an agent and sent a reply back:
      if (result.reply && result.agentId) {
        const agentReplyMessage: Message = {
          role: 'assistant',
          content: result.reply,
          timestamp: new Date(), // Use current time, backend doesn't return timestamp
          agentId: result.agentId // Include responding agent ID
        };
        // Notify parent about the agent's reply (optional, parent might just refetch)
        // onMessageSent(userMessage, agentReplyMessage); // Consider if needed
      } 
      // If it was a user-only message, the backend returns { success: true }
      else if (result.success) {
         console.log("[ChatInput] User-only message saved successfully by backend.");
      }
      
      // Parent component (WorkspacePage) should handle invalidating the query
      // to refresh the message list, which will include both user message and agent reply (if any)
      // We don't need to manually add the agent reply here if parent refetches.

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[ChatInput] Fetch aborted.');
        setError('Message sending cancelled.');
      } else {
        console.error('[ChatInput] Error sending message:', err);
        setError('Failed to send message: ' + err.message);
        // Consider reverting optimistic update if needed, though refetch might handle it
      }
    } finally {
      if (isMounted.current) {
        setSending(false);
      }
    }
  }, [input, sending, user?.id, workspaceId, channelId, onMessageSent, selectedAgentId]);
  
  // Check mount status
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // --- ADD onChange Handler for Mentions ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentValue = e.target.value;
    setInput(currentValue);
    setError(null); // Clear error on input change

    const mentionMatch = currentValue.match(/@(\S*)$/); // Match @ followed by non-whitespace

    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      setMentionQuery(query);
      
      // Filter members who are agents and match the query
      const filteredAgents = members.filter(member => 
        member.agent_id && // Must be an agent member
        member.agent && // Agent details must exist
        member.agent.name?.toLowerCase().includes(query)
      );
      
      setSuggestions(filteredAgents);
      setShowSuggestions(filteredAgents.length > 0);
      setSelectedAgentId(null); // Clear previous selection while typing mention
    } else {
      // If no mention pattern detected, hide suggestions
      setShowSuggestions(false);
      setMentionQuery(null);
      setSuggestions([]);
      // Important: Don't clear selectedAgentId here, 
      // it should only be cleared on submit or if the @mention is deleted/changed
    }
  };
  // --- End onChange Handler ---

  // --- ADD Handler for Selecting a Suggestion ---
  const handleSelectSuggestion = (selectedMember: WorkspaceMemberDetail) => {
    if (!selectedMember.agent || !selectedMember.agent_id) return; // Should not happen if suggestions are filtered correctly

    // Replace the partial mention with the full name + space
    setInput(prevInput => prevInput.replace(/@\S*$/, `@${selectedMember.agent?.name} `));
    
    setSelectedAgentId(selectedMember.agent_id);
    setShowSuggestions(false);
    setMentionQuery(null);
    setSuggestions([]);

    // Focus the input after selection
    inputRef.current?.focus();
  };
  // --- End Selection Handler ---

  return (
    <form onSubmit={handleSubmit} className="sticky bottom-0 left-0 right-0 bg-gray-800 px-4 py-3 border-t border-gray-700">
      {/* --- Wrap Input with Popover --- */}
      <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
        <div className="relative flex items-center">
          <PopoverTrigger asChild>
            <Input
              ref={inputRef}
              type="text"
              placeholder="Type your message or @mention an agent..."
              value={input}
              onChange={handleInputChange}
              disabled={sending || !channelId}
              className="flex-grow pr-12"
              autoComplete="off"
              // Prevent default browser suggestions while typing mention
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                 if (showSuggestions && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Tab')) {
                   // TODO: Handle keyboard navigation within suggestions if desired
                   e.preventDefault(); // Prevent cursor movement/submit while popover is open
                 }
              }}
            />
          </PopoverTrigger>
          <Button
            type="submit"
            size="icon"
            disabled={sending || !input.trim() || !channelId}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <PopoverContent 
          className="p-0 w-[--radix-popover-trigger-width] max-h-48 overflow-y-auto shadow-md"
          // Avoid stealing focus, allow clicking suggestions
          onOpenAutoFocus={(e) => e.preventDefault()} 
        >
          {suggestions.length === 0 && mentionQuery !== null ? (
            <div className="p-2 text-sm text-muted-foreground">No matching agents found.</div>
          ) : (
            suggestions.map((suggestion) => (
              <div
                key={suggestion.id} // Use workspace_member id as key
                className="p-2 text-sm hover:bg-muted cursor-pointer flex items-center"
                onClick={() => handleSelectSuggestion(suggestion)}
                // Prevent click from blurring input if needed
                onMouseDown={(e) => e.preventDefault()} 
              >
                {/* Optionally show agent avatar/icon */}
                {/* <Bot size={16} className="mr-2 text-blue-500 flex-shrink-0" /> */} 
                <span className="truncate">{suggestion.agent?.name || 'Unnamed Agent'}</span>
              </div>
            ))
          )}
        </PopoverContent>
      </Popover>
      {/* --- End Popover Wrapper --- */}

      {error && (
        <p className="mt-2 text-sm text-destructive flex items-center">
          <AlertCircle className="h-4 w-4 mr-1" />
          {error}
        </p>
      )}
    </form>
  );
} 