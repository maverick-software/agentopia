import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, AlertCircle, CheckCircle2, Loader2, ArrowLeft, Settings, MoreVertical, Copy, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { ChatMessage } from '../components/ChatMessage';
import AIThinkingIndicator, { AIState, ToolExecutionStatus } from '../components/AIThinkingIndicator';
import { ToolExecutionLogger } from '../components/ToolExecutionLogger';
import type { Message } from '../types';
import type { Database } from '../types/database.types';

type Agent = Database['public']['Tables']['agents']['Row'];

export function AgentChatPage() {
  const { user } = useAuth();
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
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
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // Max height in pixels
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

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
        toolName: 'send_email',
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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Fetch agent details
  useEffect(() => {
    const fetchAgent = async () => {
      if (!agentId || !user || fetchInProgress.current) return;
      
      fetchInProgress.current = true;
      fetchAgentAttempts.current++;
      
      try {
        setLoading(true);
        setError(null);
        
        const controller = new AbortController();
        abortControllerRef.current = controller;
        
        const { data, error } = await supabase
          .from('agents')
          .select('*')
          .eq('id', agentId)
          .eq('user_id', user.id)
          .single();
        
        if (error) {
          if (error.code === 'PGRST116') {
            throw new Error('Agent not found or you do not have permission to access it.');
          }
          throw error;
        }
        
        if (!isMounted.current) {
          console.log('[fetchAgent] Unmounted after Supabase query returned.');
          return;
        }
        
        setAgent(data);
      } catch (err) {
        if (!isMounted.current) return;
        
        const errorMessage = err instanceof Error ? err.message : 'Failed to load agent';
        setError(errorMessage);
        console.error('Error fetching agent:', err);
      } finally {
        if (isMounted.current) {
          setLoading(false);
          fetchInProgress.current = false;
        }
      }
    };

    fetchAgent();
  }, [agentId, user]);

  // Fetch chat history
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
    if (!input.trim() || !agent || sending || !user?.id) return;

    const messageText = input.trim();
    setInput('');
    setSending(true);

    // Add user message immediately
    const userMessage: Message = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      userId: user.id,
    };

    setMessages(prev => [...prev, userMessage]);
    scrollToBottom();

    try {
      setSending(true);
      setError(null);
      
      // Start AI processing indicator
      startAIProcessing();
      
      // Save user message to database
      const { error: saveError } = await supabase
        .from('chat_messages')
        .insert({
          content: messageText,
          sender_user_id: user.id,
          sender_agent_id: null,
        });

      if (saveError) throw saveError;

      // Run AI processing simulation in parallel with actual request
      const processingPromise = simulateAIProcessing();

      // Create abort controller for this request
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Get the current session and access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
          throw new Error(`Authentication error: ${sessionError?.message || 'Could not get session token.'}`);
      }
      const accessToken = session.access_token;

      const requestBody = {
        agentId: agent.id,
        message: messageText
      };

      // Wait for both the API response and the processing simulation
      const [response] = await Promise.all([
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        }),
        processingPromise
      ]);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Chat API error response:', { status: response.status, errorText });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('Chat API response:', responseData);
      
      // The chat function returns { message: string, agent: object }
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
        agentId: agent.id,
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
      setSending(false);
    }
  }, [input, agent, sending, user?.id, scrollToBottom, startAIProcessing, simulateAIProcessing, completeAIProcessing]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  // Loading state
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-[hsl(215,28%,9%)]">
        <div className="text-center">
          <div className="text-[hsl(210,20%,98%)] text-lg">Please sign in to chat with agents.</div>
        </div>
      </div>
    );
  }

  if (loading && !agent) {
    return (
      <div className="flex items-center justify-center h-screen bg-[hsl(215,28%,9%)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(210,15%,70%)] mx-auto mb-4" />
          <div className="text-[hsl(210,20%,98%)]">Loading agent...</div>
        </div>
      </div>
    );
  }

  if (error && !agent) {
    return (
      <div className="flex items-center justify-center h-screen bg-[hsl(215,28%,9%)]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-4" />
          <div className="text-red-400 mb-4">Error loading agent: {error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!loading && !agent) {
    return (
      <div className="flex items-center justify-center h-screen bg-[hsl(215,28%,9%)]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-yellow-400 mx-auto mb-4" />
          <div className="text-yellow-400">Agent not found.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shadow-sm">
                  <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/agents')}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {agent?.name?.charAt(0)?.toUpperCase() || 'A'}
                </span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">{agent?.name || 'Agent'}</h1>
                <p className="text-sm text-muted-foreground">AI Assistant</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-2 hover:bg-accent rounded-lg transition-colors">
              <RefreshCw className="h-5 w-5 text-muted-foreground" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 hover:bg-accent rounded-lg transition-colors">
                  <MoreVertical className="h-5 w-5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => navigate(`/agents/${agentId}/edit`)}
                  className="cursor-pointer"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto">
          {isHistoryLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md mx-auto px-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-lg font-medium">
                    {agent?.name?.charAt(0)?.toUpperCase() || 'A'}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Chat with {agent?.name || 'Agent'}
                </h3>
                <p className="text-muted-foreground mb-6">
                  Start a conversation with your AI assistant. Ask questions, get help, or just chat!
                </p>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="p-3 bg-card rounded-lg text-left border border-border shadow-sm">
                    <div className="font-medium text-foreground">💡 Try asking:</div>
                    <div className="text-muted-foreground mt-1">"What can you help me with?"</div>
                  </div>
                  <div className="p-3 bg-card rounded-lg text-left border border-border shadow-sm">
                    <div className="font-medium text-foreground">🔍 Or request:</div>
                    <div className="text-muted-foreground mt-1">"Help me analyze this data"</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-4 py-6">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}-${message.timestamp.toISOString()}`}
                    className="flex items-start space-x-4"
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {message.role === 'user' ? (
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {user?.email?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {agent?.name?.charAt(0)?.toUpperCase() || 'A'}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      <div className="mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {message.role === 'user' ? 'You' : (agent?.name || 'Assistant')}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {message.timestamp.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      <div className="text-foreground leading-relaxed">
                        <ChatMessage 
                          message={message} 
                          members={agent ? [{
                            id: agent.id,
                            agent_id: agent.id,
                            agent: {
                              id: agent.id,
                              name: agent.name
                            }
                          } as any] : []} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Typing indicator */}
                {sending && (
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {agent?.name?.charAt(0)?.toUpperCase() || 'A'}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {agent?.name || 'Assistant'}
                        </span>
                      </div>
                      <div className="flex space-x-1 items-center">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
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
                
                {/* Tool Execution Logger */}
                <ToolExecutionLogger
                  isExecuting={aiState === 'executing_tool'}
                  currentTool={currentTool?.toolName}
                  className="mt-4"
                  autoScroll={true}
                />
              </div>
              <div ref={messagesEndRef} />
            </div>
          )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-end space-x-3">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${agent?.name || 'Agent'}...`}
                  className="w-full resize-none border border-border bg-input text-foreground placeholder-muted-foreground rounded-2xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={sending || !agent}
                  rows={1}
                  style={{ minHeight: '48px', maxHeight: '200px' }}
                />
                <button
                  type="submit"
                  disabled={sending || !agent || !input.trim()}
                  className="absolute right-2 bottom-2 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </form>
          <div className="text-xs text-muted-foreground text-center mt-2">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}