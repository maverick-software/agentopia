import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, AlertCircle, CheckCircle2, Loader2, ArrowLeft, MoreVertical, Copy, RefreshCw, UserPlus, User, Brain, BookOpen, Wrench, MessageSquare, Target } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useAgents } from '../hooks/useAgents';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { TeamAssignmentModal } from '../components/modals/TeamAssignmentModal';
import { AboutMeModal } from '../components/modals/AboutMeModal';
import { HowIThinkModal } from '../components/modals/HowIThinkModal';
import { WhatIKnowModal } from '../components/modals/WhatIKnowModal';
import { ToolsModal } from '../components/modals/ToolsModal';
import { EnhancedChannelsModal } from '../components/modals/EnhancedChannelsModal';
import { EnhancedToolsModal } from '../components/modals/EnhancedToolsModal';
import { TasksModal } from '../components/modals/TasksModal';
import { HistoryModal } from '../components/modals/HistoryModal';
import { ChatMessage } from '../components/ChatMessage';
import { AIState, ToolExecutionStatus } from '../components/AIThinkingIndicator';
import { DiscreetAIStatusIndicator } from '../components/DiscreetAIStatusIndicator';
import { InlineThinkingIndicator } from '../components/InlineThinkingIndicator';
import type { Message } from '../types';
import type { Database } from '../types/database.types';

type Agent = Database['public']['Tables']['agents']['Row'];

export function AgentChatPage() {
  const { user } = useAuth();
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { updateAgent } = useAgents();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTeamAssignmentModal, setShowTeamAssignmentModal] = useState(false);
  const [showAboutMeModal, setShowAboutMeModal] = useState(false);
  const [showHowIThinkModal, setShowHowIThinkModal] = useState(false);
  const [showWhatIKnowModal, setShowWhatIKnowModal] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [showChannelsModal, setShowChannelsModal] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // AI State tracking
  const [aiState, setAiState] = useState<AIState | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolExecutionStatus | null>(null);
  const [showAIIndicator, setShowAIIndicator] = useState(false);
  const [processSteps, setProcessSteps] = useState<Array<{
    state: AIState;
    label: string;
    duration?: number;
    details?: string;
    completed: boolean;
    startTime?: Date;
  }>>([]);
  const [thinkingMessageIndex, setThinkingMessageIndex] = useState<number | null>(null);
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
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ 
            behavior: 'smooth',
            block: 'end'
          });
        }
      });
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    // Only auto-scroll if we're not in loading state and have messages
    if (!isHistoryLoading && messages.length > 0) {
      // Use multiple methods to ensure scrolling works reliably
      const scrollToBottomReliably = () => {
        if (messagesEndRef.current) {
          // Method 1: scrollIntoView with smooth behavior
          messagesEndRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'end' 
          });
          
          // Method 2: Fallback with direct scroll
          const container = messagesEndRef.current.parentElement;
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        }
      };

      // Execute immediately
      scrollToBottomReliably();
      
      // Also execute after a brief delay to handle late DOM updates
      setTimeout(scrollToBottomReliably, 50);
    }
  }, [messages, isHistoryLoading]);

  // Ensure scroll to bottom when history loading completes
  useEffect(() => {
    if (!isHistoryLoading && messages.length > 0) {
      // Additional scroll after loading state changes
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ 
            behavior: 'auto', // Instant scroll for initial load
            block: 'end' 
          });
        }
      }, 100);
    }
  }, [isHistoryLoading, messages.length]);

  // AI State Management Functions
  const startAIProcessing = useCallback(() => {
    setShowAIIndicator(true);
    setAiState('thinking');
    setCurrentTool(null);
    setProcessSteps([]);
    
    // Add thinking message to chat
    const thinkingMessage: Message = {
      role: 'thinking',
      content: 'Processing your request...',
      timestamp: new Date(),
      agentId: agent?.id,
      userId: user?.id,
      metadata: { isCompleted: false },
      aiProcessDetails: { steps: [], toolsUsed: [] }
    };
    
    setMessages(prev => {
      const newMessages = [...prev, thinkingMessage];
      setThinkingMessageIndex(newMessages.length - 1);
      return newMessages;
    });
  }, [agent?.id, user?.id]);

  const updateAIState = useCallback((newState: AIState, toolInfo?: Partial<ToolExecutionStatus>) => {
    setAiState(newState);
    if (toolInfo) {
      setCurrentTool(prev => ({ ...prev, ...toolInfo } as ToolExecutionStatus));
    }
    
    // Add step to process tracking
    const stepLabel = {
      'thinking': 'Analyzing your message',
      'analyzing_tools': 'Checking available tools',
      'executing_tool': toolInfo?.toolName ? `Using ${toolInfo.toolName}` : 'Executing tool',
      'processing_results': 'Processing tool results',
      'generating_response': 'Generating response'
    }[newState] || 'Processing';
    
    setProcessSteps(prev => {
      const existingIndex = prev.findIndex(step => step.state === newState);
      const newStep = {
        state: newState,
        label: stepLabel,
        startTime: new Date(),
        completed: false,
        details: toolInfo?.provider ? `Using ${toolInfo.provider}` : undefined
      };
      
      if (existingIndex >= 0) {
        // Update existing step
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...newStep };
        return updated;
      } else {
        // Add new step and mark previous as completed
        const updated = prev.map(step => ({ ...step, completed: true }));
        return [...updated, newStep];
      }
    });
  }, []);

  const completeAIProcessing = useCallback((success: boolean = true) => {
    setAiState(success ? 'completed' : 'failed');
    
    // Mark all steps as completed
    setProcessSteps(prev => prev.map(step => ({ ...step, completed: true })));
    
    // Update thinking message to completed state (keep it visible as "Thoughts")
    if (thinkingMessageIndex !== null) {
      setMessages(prev => {
        const updated = [...prev];
        if (updated[thinkingMessageIndex]?.role === 'thinking') {
          updated[thinkingMessageIndex] = {
            ...updated[thinkingMessageIndex],
            metadata: { isCompleted: true },
            aiProcessDetails: {
              steps: processSteps.map(step => ({ ...step, completed: true })),
              totalDuration: Date.now() - (processSteps[0]?.startTime?.getTime() || Date.now()),
              toolsUsed: processSteps.filter(s => s.details).map(s => s.details || '')
            }
          };
        }
        return updated;
      });
    }
    
    // Clean up state
    setTimeout(() => {
      setShowAIIndicator(false);
      setAiState(null);
      setCurrentTool(null);
      setThinkingMessageIndex(null);
    }, 500);
  }, [thinkingMessageIndex, processSteps]);

  const completeAIProcessingWithResponse = useCallback((responseContent: string) => {
    setAiState('completed');
    
    // Mark all steps as completed
    setProcessSteps(prev => prev.map(step => ({ ...step, completed: true })));
    
    // Convert thinking message to assistant response with thoughts
    if (thinkingMessageIndex !== null) {
      setMessages(prev => {
        const updated = [...prev];
        if (updated[thinkingMessageIndex]?.role === 'thinking') {
          // Convert to assistant message with thinking details
          updated[thinkingMessageIndex] = {
            role: 'assistant',
            content: responseContent,
            timestamp: new Date(),
            agentId: agent?.id,
            userId: user?.id,
            metadata: { isCompleted: true },
            aiProcessDetails: {
              steps: processSteps.map(step => ({ ...step, completed: true })),
              totalDuration: Date.now() - (processSteps[0]?.startTime?.getTime() || Date.now()),
              toolsUsed: processSteps.filter(s => s.details).map(s => s.details || '')
            }
          };
        }
        return updated;
      });
    }
    
    // Clean up state
    setTimeout(() => {
      setShowAIIndicator(false);
      setAiState(null);
      setCurrentTool(null);
      setThinkingMessageIndex(null);
    }, 500);
  }, [thinkingMessageIndex, processSteps, agent?.id, user?.id]);

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
          .select('*, agent_datastores(datastore_id)')
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
            userId: msg.sender_agent_id ? user.id : msg.sender_user_id, // For assistant messages, use current user's ID
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
    // Immediate scroll for better UX
    requestAnimationFrame(() => {
      scrollToBottom();
    });

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

      // Complete AI processing and convert thinking message to assistant response
      completeAIProcessingWithResponse(assistantReply);

      // Scroll after updating message
      if (isMounted.current) {
        requestAnimationFrame(scrollToBottom);
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
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-card shadow-sm">
                  <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/agents')}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="flex items-center space-x-3">
              {agent?.avatar_url ? (
                <img 
                  src={agent.avatar_url} 
                  alt={agent.name || 'Agent'}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {agent?.name?.charAt(0)?.toUpperCase() || 'A'}
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-lg font-semibold text-foreground">{agent?.name || 'Agent'}</h1>
                <DiscreetAIStatusIndicator 
                  aiState={aiState}
                  currentTool={currentTool}
                  agentName={agent?.name || 'Agent'}
                  isExecuting={aiState === 'executing_tool'}
                />
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
                  onClick={() => setShowAboutMeModal(true)}
                  className="cursor-pointer"
                >
                  <User className="h-4 w-4 mr-2 text-blue-500" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowHowIThinkModal(true)}
                  className="cursor-pointer"
                >
                  <Brain className="h-4 w-4 mr-2 text-purple-500" />
                  Behavior  
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowWhatIKnowModal(true)}
                  className="cursor-pointer"
                >
                  <BookOpen className="h-4 w-4 mr-2 text-orange-500" />
                  Knowledge
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowToolsModal(true)}
                  className="cursor-pointer"
                >
                  <Wrench className="h-4 w-4 mr-2 text-cyan-500" />
                  Tools
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowChannelsModal(true)}
                  className="cursor-pointer"
                >
                  <MessageSquare className="h-4 w-4 mr-2 text-green-500" />
                  Channels
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowTasksModal(true)}
                  className="cursor-pointer"
                >
                  <Target className="h-4 w-4 mr-2 text-red-500" />
                  Schedule
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowTeamAssignmentModal(true)}
                  className="cursor-pointer"
                >
                  <UserPlus className="h-4 w-4 mr-2 text-indigo-500" />
                  Add to Team
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
      </div>

      {/* Messages Container */}
      <div className="relative flex-1 overflow-y-auto">
        {/* Gradient fade effect at top of messages */}
        {messages.length > 0 && (
          <div className="absolute top-0 left-0 right-0 h-20 chat-gradient-fade-top pointer-events-none z-10" />
        )}
        {isHistoryLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md mx-auto px-6 animate-fade-in">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <span className="text-white text-xl font-medium">
                    {agent?.name?.charAt(0)?.toUpperCase() || 'A'}
                  </span>
                </div>
                <h3 className="text-2xl font-semibold text-foreground mb-3">
                  Chat with {agent?.name || 'Agent'}
                </h3>
                <p className="text-muted-foreground mb-8 leading-relaxed">
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
            <div className="max-w-4xl mx-auto px-4 py-6 pb-8">
              <div className="space-y-6">
                {messages.map((message, index) => {
                  // Handle thinking messages with inline indicator
                  if (message.role === 'thinking') {
                    return (
                      <InlineThinkingIndicator
                        key={`${message.role}-${index}-${message.timestamp.toISOString()}`}
                        isVisible={true}
                        currentState={message.metadata?.isCompleted ? 'completed' : aiState}
                        currentTool={currentTool}
                        processSteps={message.aiProcessDetails?.steps || processSteps.map(step => ({
                          state: step.state,
                          label: step.label,
                          duration: step.duration,
                          details: step.details,
                          completed: step.completed
                        }))}
                        agentName={agent?.name || 'Agent'}
                        agentAvatarUrl={agent?.avatar_url}
                        isCompleted={message.metadata?.isCompleted || false}
                        className="mb-4"
                      />
                    );
                  }
                  
                  // Handle assistant messages with thinking details
                  if (message.role === 'assistant' && message.aiProcessDetails?.steps?.length) {
                    return (
                      <div key={`${message.role}-${index}-${message.timestamp.toISOString()}`} className="space-y-4">
                        {/* Regular assistant message */}
                        <div className="flex items-start space-x-4 animate-fade-in">
                          {/* Avatar */}
                          <div className="flex-shrink-0">
                            {agent?.avatar_url ? (
                              <img 
                                src={agent.avatar_url} 
                                alt={agent.name || 'Agent'}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm font-medium">
                                  {agent?.name?.charAt(0)?.toUpperCase() || 'A'}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* Message Content */}
                          <div className="flex-1 min-w-0 max-w-[70%] text-left">
                            <div className="mb-1 text-left">
                              <span className="text-sm font-medium text-foreground">
                                {agent?.name || 'Assistant'}
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {message.timestamp.toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </span>
                            </div>
                            <div className="inline-block p-3 rounded-2xl shadow-sm bg-card text-card-foreground border border-border">
                              <div className="text-sm leading-relaxed">
                                {message.content}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Thoughts section */}
                        <InlineThinkingIndicator
                          key={`thoughts-${index}`}
                          isVisible={false}
                          processSteps={message.aiProcessDetails.steps}
                          agentName={agent?.name || 'Agent'}
                          agentAvatarUrl={agent?.avatar_url}
                          isCompleted={true}
                          className="ml-12"
                        />
                      </div>
                    );
                  }
                  
                  // Handle regular messages
                  return (
                    <div
                      key={`${message.role}-${index}-${message.timestamp.toISOString()}`}
                      className={`flex items-start space-x-4 animate-fade-in ${
                        message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                      }`}
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
                          agent?.avatar_url ? (
                            <img 
                              src={agent.avatar_url} 
                              alt={agent.name || 'Agent'}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm font-medium">
                                {agent?.name?.charAt(0)?.toUpperCase() || 'A'}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                      
                      {/* Message Content */}
                      <div className={`flex-1 min-w-0 max-w-[70%] ${
                        message.role === 'user' ? 'text-right' : 'text-left'
                      }`}>
                        <div className={`mb-1 ${
                          message.role === 'user' ? 'text-right' : 'text-left'
                        }`}>
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
                        <div className={`inline-block p-3 rounded-2xl shadow-sm ${
                          message.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-card text-card-foreground border border-border'
                        }`}>
                          <div className="text-sm leading-relaxed">
                            {message.content}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Note: Typing indicator now handled by InlineThinkingIndicator */}

                {/* Removed prominent AI indicators - now using discreet header indicator */}
              </div>
              <div ref={messagesEndRef} />
            </div>
          )}
          

      </div>

      {/* Clean Input Area - Claude Style (Tools Outside Text Area) */}
      <div className="bg-background border-t border-border/20">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <form onSubmit={handleSubmit} className="relative">
            {/* Text input container - Clean text area only */}
            <div className="relative bg-card border border-border/40 rounded-3xl shadow-sm hover:shadow-md transition-all duration-200 focus-within:border-ring/50 focus-within:shadow-md">
              <div className="px-5 py-4">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${agent?.name || 'Agent'}...`}
                  className="w-full resize-none bg-transparent text-foreground placeholder-muted-foreground/70 border-0 outline-0 text-[15px] leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed placeholder-center"
                  disabled={sending || !agent}
                  rows={1}
                  style={{ minHeight: '28px', maxHeight: '200px' }}
                />
              </div>
            </div>

            {/* Bottom controls - Outside the text area like Claude */}
            <div className="flex items-center justify-between mt-3 px-2">
              {/* Left side - Tools */}
              <div className="flex items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                      disabled={sending || !agent}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem className="cursor-pointer">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      Attach file
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Upload image
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Voice input button (like Claude) */}
                <button
                  type="button"
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors ml-1"
                  disabled={sending || !agent}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19v4" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 23h8" />
                  </svg>
                </button>
              </div>

              {/* Right side - Send button */}
              <div className="flex items-center">
                <button
                  type="submit"
                  disabled={sending || !agent || !input.trim()}
                  className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center min-w-[40px] min-h-[40px] shadow-sm hover:scale-105 disabled:hover:scale-100"
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
          
          {/* Discreet help text */}
          <div className="text-xs text-muted-foreground/70 text-center mt-3 opacity-0 hover:opacity-100 transition-opacity duration-300">
            Press <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">↵</kbd> to send, <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">⇧</kbd>+<kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">↵</kbd> for new line
          </div>
        </div>
      </div>

      {/* Team Assignment Modal */}
      <TeamAssignmentModal
        isOpen={showTeamAssignmentModal}
        onClose={() => setShowTeamAssignmentModal(false)}
        agentId={agentId || ''}
        agentName={agent?.name || 'Agent'}
        onTeamAssigned={(teamId, teamName) => {
          console.log(`Agent ${agent?.name} assigned to team ${teamName}`);
          // You could show a success toast here
        }}
      />

      {/* About Me Modal */}
      <AboutMeModal
        isOpen={showAboutMeModal}
        onClose={() => setShowAboutMeModal(false)}
        agentId={agentId || ''}
        agentData={{
          name: agent?.name,
          description: agent?.description,
          personality: agent?.personality,
          avatar_url: agent?.avatar_url
        }}
        onAgentUpdated={async (updatedAgent) => {
          setAgent(updatedAgent);
          // Also update the agents hook state so sidebar gets updated
          if (agentId) {
            await updateAgent(agentId, updatedAgent);
          }
          console.log('Agent updated:', updatedAgent);
        }}
      />

      {/* How I Think Modal */}
      <HowIThinkModal
        isOpen={showHowIThinkModal}
        onClose={() => setShowHowIThinkModal(false)}
        agentId={agentId || ''}
        agentData={{
          system_instructions: agent?.system_instructions,
          assistant_instructions: agent?.assistant_instructions,
          name: agent?.name
        }}
        onAgentUpdated={(updatedAgent) => {
          setAgent(updatedAgent);
          console.log('Agent thinking updated:', updatedAgent);
        }}
      />

      {/* What I Know Modal */}
      <WhatIKnowModal
        isOpen={showWhatIKnowModal}
        onClose={() => setShowWhatIKnowModal(false)}
        agentId={agentId || ''}
        agentData={{
          name: agent?.name,
          agent_datastores: agent?.agent_datastores || []
        }}
        onAgentUpdated={(updatedAgent) => {
          setAgent(updatedAgent);
          console.log('Agent knowledge updated:', updatedAgent);
        }}
      />

      {/* Enhanced Tools Modal */}
      <EnhancedToolsModal
        isOpen={showToolsModal}
        onClose={() => setShowToolsModal(false)}
        agentId={agentId || ''}
        agentData={{
          name: agent?.name
        }}
        onAgentUpdated={(updatedAgent) => {
          setAgent(updatedAgent);
          console.log('Agent tools updated:', updatedAgent);
        }}
      />

      {/* Enhanced Channels Modal */}
      <EnhancedChannelsModal
        isOpen={showChannelsModal}
        onClose={() => setShowChannelsModal(false)}
        agentId={agentId || ''}
        agentData={{
          name: agent?.name
        }}
        onAgentUpdated={(updatedAgent) => {
          setAgent(updatedAgent);
          console.log('Agent channels updated:', updatedAgent);
        }}
      />

      {/* Tasks Modal */}
      <TasksModal
        isOpen={showTasksModal}
        onClose={() => setShowTasksModal(false)}
        agentId={agentId || ''}
        agentData={{
          name: agent?.name
        }}
        onAgentUpdated={(updatedAgent) => {
          setAgent(updatedAgent);
          console.log('Agent tasks updated:', updatedAgent);
        }}
      />

      {/* History Modal */}
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        agentId={agentId || ''}
        agentData={{
          name: agent?.name
        }}
        onAgentUpdated={(updatedAgent) => {
          setAgent(updatedAgent);
          console.log('Agent history updated:', updatedAgent);
        }}
      />
    </div>
  );
}