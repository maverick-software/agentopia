import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

/**
 * ChatPage - Universal chat interface using the Gofr system agent
 * 
 * This page provides a ChatGPT-like experience where users can chat
 * without needing to select a specific agent. It uses the system-wide
 * Gofr agent that is accessible to all users.
 * 
 * The page:
 * 1. Fetches the Gofr agent ID from the database
 * 2. Creates or retrieves an existing conversation with Gofr
 * 3. Redirects to the AgentChatPage with the appropriate parameters
 */
export function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initializeGofrChat() {
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get the Gofr agent ID using the database function
        const { data: gofrAgentData, error: agentError } = await supabase
          .rpc('get_gofr_agent_id');

        if (agentError) {
          console.error('Error fetching Gofr agent:', agentError);
          setError('Unable to load Gofr chat. Please try again.');
          return;
        }

        if (!gofrAgentData) {
          console.error('Gofr agent not found');
          setError('Gofr chat agent is not available. Please contact support.');
          return;
        }

        const gofrAgentId = gofrAgentData;

        // Check if user has an existing conversation with Gofr
        // Note: Using chat_messages_v2 table
        const { data: existingConversations, error: convError } = await supabase
          .from('chat_messages_v2')
          .select('conversation_id')
          .eq('agent_id', gofrAgentId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (convError) {
          console.error('Error checking existing conversations:', convError);
        }

        // If there's an existing conversation, navigate to it
        if (existingConversations && existingConversations.length > 0) {
          const conversationId = existingConversations[0].conversation_id;
          navigate(`/agents/${gofrAgentId}/chat?conv=${conversationId}`, { replace: true });
        } else {
          // Navigate to new conversation with Gofr
          navigate(`/agents/${gofrAgentId}/chat`, { replace: true });
        }

      } catch (err) {
        console.error('Error initializing Gofr chat:', err);
        setError('An unexpected error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    initializeGofrChat();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-muted-foreground">Loading Gofr chat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center max-w-md p-6">
          <div className="text-destructive text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-semibold mb-2">Unable to Load Chat</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => navigate('/agents')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Go to Agents
          </button>
        </div>
      </div>
    );
  }

  return null; // Should never reach here due to navigation
}

export default ChatPage;

