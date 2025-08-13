import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, AlertCircle, Loader2, ArrowLeft, MoreVertical, RefreshCw, UserPlus, User, Brain, BookOpen, Wrench, MessageSquare, Target, ChevronRight, BarChart3 } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { getModelsByProvider } from '../lib/llm/modelRegistry';
import { AboutMeModal } from '../components/modals/AboutMeModal';
import { HowIThinkModal } from '../components/modals/HowIThinkModal';
import { WhatIKnowModal } from '../components/modals/WhatIKnowModal';
import { EnhancedChannelsModal } from '../components/modals/EnhancedChannelsModal';
import { EnhancedToolsModal } from '../components/modals/EnhancedToolsModal';
import { TasksModal } from '../components/modals/TasksModal';
import { HistoryModal } from '../components/modals/HistoryModal';
import { ProcessModal } from '../components/modals/ProcessModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [currentProcessingDetails, setCurrentProcessingDetails] = useState<any>(null);
  // LLM Model selection state (per agent; persisted to agent_llm_preferences)
  const [modelSaving, setModelSaving] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini');
  
  // AI State tracking
  const [aiState, setAiState] = useState<AIState | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolExecutionStatus | null>(null);
  const [showAIIndicator, setShowAIIndicator] = useState(false);
  const [processSteps, setProcessSteps] = useState<Array<{
    state: AIState;
    label: string;
    duration?: number;
    details?: string;
    response?: string;
    toolCall?: string;
    toolResult?: any;
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

  // Normalize Markdown for consistent initial rendering
  const formatMarkdown = useCallback((text: string): string => {
    if (!text) return '';
    const lines = text.split('\n');
    const out: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const isList = /^([-*+]\s|\d+\.\s)/.test(trimmed);
      const isHeader = /^#{1,6}\s/.test(trimmed);
      // Ensure a blank line before lists and headers when missing
      if ((isList || isHeader) && out.length > 0 && out[out.length - 1].trim() !== '') {
        out.push('');
      }
      out.push(line);
    }
    return out.join('\n');
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

  // Auto-scroll to bottom when messages change - more controlled
  useEffect(() => {
    if (!isHistoryLoading && messages.length > 0 && messagesEndRef.current) {
      const container = messagesEndRef.current.closest('.overflow-y-auto');
      if (container) {
        // Only auto-scroll if user is near the bottom (within 100px)
        const isNearBottom = container.scrollTop >= container.scrollHeight - container.clientHeight - 100;
        
        if (isNearBottom) {
          requestAnimationFrame(() => {
            if (messagesEndRef.current) {
              messagesEndRef.current.scrollIntoView({ 
                behavior: 'smooth',
                block: 'end' 
              });
            }
          });
        }
      }
    }
  }, [messages, isHistoryLoading]);

  // Initial scroll when history loading completes - instant
  useEffect(() => {
    if (!isHistoryLoading && messages.length > 0) {
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ 
            behavior: 'auto', // Instant scroll for initial load
            block: 'end' 
          });
        }
      }, 100);
    }
  }, [isHistoryLoading]);

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
      'generating_response': 'Generating response',
      'completed': 'Response ready',
      'failed': 'Processing failed'
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

  // Function to add response data to current step
  const addStepResponse = useCallback((state: AIState, response: string) => {
    setProcessSteps(prev => {
      const updated = [...prev];
      let stepIndex = -1;
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].state === state) {
          stepIndex = i;
          break;
        }
      }
      if (stepIndex >= 0) {
        updated[stepIndex] = { ...updated[stepIndex], response };
      }
      return updated;
    });
  }, []);

  // Function to add tool call data to current step
  const addStepToolCall = useCallback((state: AIState, toolCall: string, toolResult?: any) => {
    setProcessSteps(prev => {
      const updated = [...prev];
      let stepIndex = -1;
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].state === state) {
          stepIndex = i;
          break;
        }
      }
      if (stepIndex >= 0) {
        updated[stepIndex] = { 
          ...updated[stepIndex], 
          toolCall,
          ...(toolResult && { toolResult })
        };
      }
      return updated;
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

  const completeAIProcessingWithResponse = useCallback(async (responseContent: string) => {
    setAiState('completed');
    
    // Mark all steps as completed
    const completedSteps = await new Promise<typeof processSteps>((resolve) => {
      setProcessSteps(prevSteps => {
        const done = prevSteps.map(step => ({ ...step, completed: true }));

        // Find and convert the thinking message to assistant response
        setMessages(prev => {
          const updated = [...prev];
          // Find the most recent thinking message
          let thinkingIndex = -1;
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === 'thinking' && !updated[i].metadata?.isCompleted) {
              thinkingIndex = i;
              break;
            }
          }
          
          if (thinkingIndex !== -1) {
            // Convert to assistant message with thinking details
            updated[thinkingIndex] = {
              role: 'assistant',
              content: responseContent,
              timestamp: new Date(),
              agentId: agent?.id,
              userId: user?.id,
              metadata: { isCompleted: true },
              aiProcessDetails: {
                steps: done,
                totalDuration: Date.now() - (done[0]?.startTime?.getTime() || Date.now()),
                toolsUsed: done.filter(s => s.details).map(s => s.details || '')
              }
            };
          } else {
            // Fallback: Add new assistant message if no thinking message found
            updated.push({
              role: 'assistant',
              content: responseContent,
              timestamp: new Date(),
              agentId: agent?.id,
              userId: user?.id,
              metadata: { isCompleted: true },
              aiProcessDetails: {
                steps: done,
                totalDuration: Date.now() - (done[0]?.startTime?.getTime() || Date.now()),
                toolsUsed: done.filter(s => s.details).map(s => s.details || '')
              }
            });
          }
          return updated;
        });
        
        return done;
      });
      // Resolve in next tick to ensure setState above applied
      requestAnimationFrame(() => resolve(processSteps));
    });

    // Note: Do not persist here. The backend chat function persists the assistant
    // response. Writing here would duplicate rows and cause repeated messages.
    
    // Clean up state
    setTimeout(() => {
      setShowAIIndicator(false);
      setAiState(null);
      setCurrentTool(null);
      setThinkingMessageIndex(null);
    }, 500);
  }, [agent?.id, user?.id]);

  // Simulate AI processing phases
  const simulateAIProcessing = useCallback(async () => {
    // Phase 1: Thinking
    updateAIState('thinking');
    await new Promise(resolve => setTimeout(resolve, 800));
    // Capture thinking response
    addStepResponse('thinking', `User asked: "${input}"\nI need to understand what they're asking for and determine the best way to help them. Let me analyze this message and see if I need to use any tools or if I can respond directly.`);

    // Phase 2: Analyzing tools
    updateAIState('analyzing_tools');
    await new Promise(resolve => setTimeout(resolve, 600));
    // Capture tool analysis response
    const toolAnalysis = input.toLowerCase().includes('send') || 
                        input.toLowerCase().includes('email') ||
                        input.toLowerCase().includes('gmail') ||
                        input.toLowerCase().includes('read') ||
                        input.toLowerCase().includes('check');
    
    addStepResponse('analyzing_tools', `Checking available tools for this request...\nEmail-related keywords detected: ${toolAnalysis}\nAvailable tools: Gmail integration, Web search, File operations\nDecision: ${toolAnalysis ? 'Will use Gmail tool' : 'No tools needed for this request'}`);

    // Phase 3: Check if we might execute a tool (simulate tool detection)
    const mightUseTool = toolAnalysis;

    if (mightUseTool) {
      // Phase 4: Tool execution
      updateAIState('executing_tool', {
        toolName: 'send_email',
        provider: 'gmail',
        status: 'executing',
        startTime: new Date(),
      });
      
      // Capture tool call
      addStepToolCall('executing_tool', 
        `gmail.send_email({
  to: "user@example.com",
  subject: "Response to your inquiry",
  body: "Thank you for your message..."
})`,
        {
          success: true,
          message_id: "msg_abc123",
          sent_at: new Date().toISOString(),
          recipients: ["user@example.com"]
        }
      );
      
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Phase 5: Processing results
      updateAIState('processing_results', {
        status: 'completed',
        endTime: new Date(),
      });
      
      addStepResponse('processing_results', `Tool execution completed successfully!\nEmail sent with ID: msg_abc123\nProcessing the result to formulate a response to the user.`);
      
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Phase 6: Generating response
    updateAIState('generating_response');
    addStepResponse('generating_response', `Generating final response based on:\n- User's original request: "${input}"\n- Tool results: ${mightUseTool ? 'Email sent successfully' : 'No tools used'}\n- Context: Friendly conversation\n\nFormulating helpful and conversational response...`);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, [input, updateAIState, addStepResponse, addStepToolCall]);

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

        // Load agent LLM preferences to preselect model
        try {
          const { data: prefs } = await supabase
            .from('agent_llm_preferences')
            .select('provider, model')
            .eq('agent_id', data.id)
            .maybeSingle();
          if (prefs?.model) setSelectedModel(prefs.model);
        } catch (_) {}
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

  // Fetch chat history (scoped to this agent)
  useEffect(() => {
    const fetchHistory = async () => {
      if (!agentId || !user?.id) return;

      setIsHistoryLoading(true);
      try {
        // Assistant messages from this agent (v2)
        const { data: assistantData, error: assistantErr } = await supabase
          .from('chat_messages_v2')
          .select('*')
          .eq('sender_agent_id', agentId)
          .order('created_at', { ascending: true });
        if (assistantErr) throw assistantErr;

        // User messages to this agent (tracked via metadata.target_agent_id)
        const { data: userDataTagged, error: userErr } = await supabase
          .from('chat_messages_v2')
          .select('*')
          .eq('sender_user_id', user.id)
          .contains('metadata', { target_agent_id: agentId })
          .order('created_at', { ascending: true });
        if (userErr) throw userErr;

        // Legacy user messages without tag (fallback)
        const { data: userDataAll, error: userAllErr } = await supabase
          .from('chat_messages_v2')
          .select('*')
          .eq('sender_user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(500);
        if (userAllErr) throw userAllErr;

        // Heuristic: include untagged user messages that are within 15 minutes of any assistant message from this agent
        const assistantTimes = new Set((assistantData || []).map((a: any) => new Date(a.created_at).getTime()));
        const assistantArr = (assistantData || []).map((a: any) => new Date(a.created_at).getTime());
        const fifteenMin = 15 * 60 * 1000;
        const userUntagged = (userDataAll || []).filter((u: any) => {
          const tagged = u?.metadata && u.metadata.target_agent_id === agentId;
          if (tagged) return false; // already handled in tagged set
          const t = new Date(u.created_at).getTime();
          return assistantArr.some(at => Math.abs(at - t) <= fifteenMin);
        });

        const rows = [...(assistantData || []), ...(userDataTagged || []), ...userUntagged].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        const formatted: Message[] = rows.map((msg: any) => ({
          role: (msg.role === 'assistant' || msg.sender_agent_id) ? 'assistant' : 'user',
          content: typeof msg.content === 'string' ? msg.content : (msg.content?.text ?? ''),
          timestamp: new Date(msg.created_at),
          agentId: msg.sender_agent_id,
          userId: msg.sender_agent_id ? user.id : msg.sender_user_id,
        }));

        setMessages(prevMessages => {
          const merged = [...formatted];
          // Preserve assistant messages with Thoughts UI details
          const thoughts = prevMessages.filter(m => m.role === 'assistant' && m.aiProcessDetails);
          thoughts.forEach(th => {
            const idx = merged.findIndex(m => m.role === 'assistant' && m.content === th.content && Math.abs(m.timestamp.getTime() - th.timestamp.getTime()) < 60000);
            if (idx !== -1) merged[idx] = th; else merged.push(th);
          });

          // Preserve any recent user messages already in UI that may not yet be tagged in DB
          const recentUserMsgs = prevMessages.filter(m => m.role === 'user' && m.userId === user.id);
          recentUserMsgs.forEach(um => {
            const exists = merged.find(m => m.role === 'user' && m.content === um.content && Math.abs(m.timestamp.getTime() - um.timestamp.getTime()) < 60000);
            if (!exists) merged.push(um);
          });

          return merged.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        });
      } catch (err) {
        console.error('Failed to fetch chat history:', err);
        setError('Could not load chat history.');
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
      
      // Save user message to database (v2 schema)
      const convId = localStorage.getItem(`agent_${agent.id}_conversation_id`) || crypto.randomUUID();
      const sessId = localStorage.getItem(`agent_${agent.id}_session_id`) || crypto.randomUUID();
      localStorage.setItem(`agent_${agent.id}_conversation_id`, convId);
      localStorage.setItem(`agent_${agent.id}_session_id`, sessId);

      const { error: saveError } = await supabase
        .from('chat_messages_v2')
        .insert({
          conversation_id: convId,
          session_id: sessId,
          channel_id: null,
          role: 'user',
          content: { type: 'text', text: messageText },
          sender_user_id: user.id,
          sender_agent_id: null,
          metadata: { target_agent_id: agent.id },
          context: { agent_id: agent.id, user_id: user.id }
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

      // Get the stored context size preference for this agent
      const contextSize = parseInt(
        localStorage.getItem(`agent_${agent.id}_context_size`) || '25'
      );

      // Provide minimal v2 context with conversation/session IDs
      const conversationId = localStorage.getItem(`agent_${agent.id}_conversation_id`) || crypto.randomUUID();
      const sessionId = localStorage.getItem(`agent_${agent.id}_session_id`) || crypto.randomUUID();
      localStorage.setItem(`agent_${agent.id}_conversation_id`, conversationId);
      localStorage.setItem(`agent_${agent.id}_session_id`, sessionId);

      const requestBody: any = {
        version: '2.0.0',
        context: {
          agent_id: agent.id,
          user_id: user.id,
          conversation_id: conversationId,
          session_id: sessionId,
          // Omit channel_id if not present; null fails v2 schema (expects string if provided)
        },
        message: {
          role: 'user',
          content: { type: 'text', text: messageText }
        },
        options: { context: { max_messages: contextSize } }
      };
      // Ensure we do not send nulls for optional string fields
      if (!agent?.id) delete requestBody.context.agent_id;
      if (!user?.id) delete requestBody.context.user_id;
      // Only include channel_id if we have a real channel to target
      // (Agent chat is not scoped to a channel)

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
      
      // Store processing details for debugging modal (supports V2 and V1)
      const v2Processing = responseData.processing_details || responseData.data?.processing_details;
      if (v2Processing) {
        setCurrentProcessingDetails(v2Processing);
      }
      
      // Support both V2 and V1 response shapes
      const v2Text = responseData?.data?.message?.content?.text;
      const v1Text = responseData?.message;
      const assistantReply = typeof v2Text === 'string' ? v2Text : v1Text;

      if (typeof assistantReply !== 'string') {
          console.error('Invalid response format from chat API:', responseData);
          throw new Error('Received an invalid response format from the chat service.');
      }

      // Complete AI processing and convert thinking message to assistant response
      await completeAIProcessingWithResponse(assistantReply);

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
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-2.5 pb-0.5 bg-card">
                  <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/agents')}
              className="p-1.5 hover:bg-accent rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="flex items-center space-x-3">
              {agent?.avatar_url ? (
                <img 
                  src={agent.avatar_url} 
                  alt={agent.name || 'Agent'}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-medium">
                    {agent?.name?.charAt(0)?.toUpperCase() || 'A'}
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-sm font-semibold text-foreground">{agent?.name || 'Agent'}</h1>
                <DiscreetAIStatusIndicator 
                  aiState={aiState}
                  currentTool={currentTool}
                  agentName={agent?.name || 'Agent'}
                  isExecuting={aiState === 'executing_tool'}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button className="p-1.5 hover:bg-accent rounded-lg transition-colors">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 hover:bg-accent rounded-lg transition-colors">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
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
                {/* Inline model selector under Profile */}
                <div className="px-3 py-2">
                  <div className="text-[11px] text-muted-foreground mb-1">Model</div>
                  <Select
                    value={selectedModel}
                    onValueChange={async (val) => {
                      setSelectedModel(val);
                      if (!agent?.id || !user?.id) return;
                      try {
                        setModelSaving(true);
                        // Upsert agent_llm_preferences
                        const { error } = await supabase
                          .from('agent_llm_preferences')
                          .upsert({ agent_id: agent.id, provider: 'openai', model: val }, { onConflict: 'agent_id' });
                        if (error) throw error;
                      } catch (e) {
                        console.error('Failed to save model preference', e);
                      } finally {
                        setModelSaving(false);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {getModelsByProvider('openai').map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          {m.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {modelSaving && (
                    <div className="mt-1 text-[10px] text-muted-foreground">Saving…</div>
                  )}
                </div>
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

      {/* Messages Container - Hidden scrollbar */}
      <div className="flex-1 overflow-y-auto hide-scrollbar min-h-0 relative">
        {/* Gradient fade effect at top of messages - Fixed positioning to prevent shifts */}
        <div className="absolute top-0 left-0 right-0 h-20 chat-gradient-fade-top pointer-events-none z-10 opacity-0 transition-opacity duration-300" 
             style={{ opacity: messages.length > 0 ? 1 : 0 }} />
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
            <div className="max-w-4xl mx-auto px-4 py-6 pb-8 min-h-full">
              <div className="space-y-6">
                {messages.map((message, index) => {
                  // Handle thinking messages with inline indicator
                  if (message.role === 'thinking') {
                    const isCurrentThinking = index === thinkingMessageIndex && !message.metadata?.isCompleted;
                    if (!isCurrentThinking) {
                      return null; // hide previous/completed thinking indicators
                    }
                    return (
                      <InlineThinkingIndicator
                        key={`${message.role}-${index}-${message.timestamp.toISOString()}`}
                        isVisible={true}
                        currentState={aiState}
                        currentTool={currentTool}
                        processSteps={processSteps.map(step => ({
                          state: step.state,
                          label: step.label,
                          duration: step.duration,
                          details: step.details,
                          completed: step.completed
                        }))}
                        agentName={agent?.name || 'Agent'}
                        agentAvatarUrl={agent?.avatar_url}
                        isCompleted={false}
                        className="mb-4"
                      />
                    );
                  }
                  
                  // Handle assistant messages with thinking details
                  if (message.role === 'assistant' && message.aiProcessDetails?.steps?.length) {
                    return (
                      <div key={`${message.role}-${index}-${message.timestamp.toISOString()}`} className="flex items-start space-x-4 animate-fade-in">
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
                        
                        {/* Message Content with integrated Thoughts */}
                        <div className="flex-1 min-w-0 max-w-[70%] text-left space-y-3">
                          {/* Header with Agent Name and Thoughts */}
                          <div className="flex items-center space-x-2 mb-1 text-left">
                            <span className="text-sm font-medium text-foreground">
                              {agent?.name || 'Assistant'}
                            </span>
                            
                            {/* Thoughts Section next to name */}
                            <div className="flex items-center space-x-2">
                              <details className="group">
                                <summary className="flex items-center space-x-1 cursor-pointer hover:bg-muted/50 rounded-md px-1.5 py-0.5 transition-colors">
                                  <Brain className="h-3 w-3 text-muted-foreground group-open:text-purple-500" />
                                  <span className="text-xs text-muted-foreground group-open:text-foreground">
                                    Thoughts
                                  </span>
                                  <span className="text-xs text-muted-foreground/60">
                                    {message.aiProcessDetails.steps.length} steps
                                  </span>
                                  <ChevronRight className="h-2.5 w-2.5 text-muted-foreground transition-transform group-open:rotate-90" />
                                </summary>
                              <div className="absolute z-50 mt-1 p-3 bg-popover border border-border rounded-lg shadow-lg min-w-80 max-w-96">
                                <div className="space-y-3">
                                  {message.aiProcessDetails.steps.map((step, stepIndex) => (
                                    <div key={stepIndex} className="border border-border/30 rounded-md">
                                      <details className="group">
                                        <summary className="flex items-start space-x-2 text-xs p-2 cursor-pointer hover:bg-muted/30 rounded-md">
                                          <div className="flex-shrink-0 mt-0.5">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                          </div>
                                          <div className="flex-1">
                                            <div className="font-medium text-foreground">{step.label}</div>
                                            {step.details && (
                                              <div className="text-muted-foreground mt-0.5">{step.details}</div>
                                            )}
                                            <div className="flex items-center space-x-2 mt-1">
                                              {step.duration && (
                                                <span className="text-muted-foreground/60">
                                                  {step.duration}ms
                                                </span>
                                              )}
                                              <ChevronRight className="h-2.5 w-2.5 text-muted-foreground transition-transform group-open:rotate-90" />
                                            </div>
                                          </div>
                                        </summary>
                                        
                                        <div className="px-4 pb-2 space-y-2 border-t border-border/20 mt-1">
                                          {/* AI Response */}
                                          {step.response && (
                                            <div className="bg-muted/20 rounded p-2">
                                              <div className="text-xs font-medium text-foreground mb-1">AI Response:</div>
                                              <div className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                                                {step.response}
                                              </div>
                                            </div>
                                          )}
                                          
                                          {/* Tool Call */}
                                          {step.toolCall && (
                                            <div className="bg-blue-50 dark:bg-blue-950/20 rounded p-2">
                                              <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Tool Call:</div>
                                              <div className="text-xs text-blue-600 dark:text-blue-400 whitespace-pre-wrap font-mono">
                                                {step.toolCall}
                                              </div>
                                            </div>
                                          )}
                                          
                                          {/* Tool Result */}
                                          {step.toolResult && (
                                            <div className="bg-green-50 dark:bg-green-950/20 rounded p-2">
                                              <div className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Tool Result:</div>
                                              <div className="text-xs text-green-600 dark:text-green-400 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                                                {typeof step.toolResult === 'string' 
                                                  ? step.toolResult 
                                                  : JSON.stringify(step.toolResult, null, 2)
                                                }
                                              </div>
                                            </div>
                                          )}
                                          
                                          {/* Show message if no detailed data available */}
                                          {!step.response && !step.toolCall && !step.toolResult && (
                                            <div className="text-xs text-muted-foreground/60 italic p-2">
                                              No detailed response data captured for this step.
                                            </div>
                                          )}
                                        </div>
                                      </details>
                                    </div>
                                  ))}
                                </div>
                                {message.aiProcessDetails.totalDuration && (
                                  <div className="mt-3 pt-2 border-t border-border/30 text-xs text-muted-foreground">
                                    Total processing time: {message.aiProcessDetails.totalDuration}ms
                                  </div>
                                )}
                              </div>
                              </details>
                              
                              {/* Process Button */}
                              {currentProcessingDetails && (
                                <button
                                  onClick={() => setShowProcessModal(true)}
                                  className="flex items-center space-x-1 cursor-pointer hover:bg-muted/50 rounded-md px-1.5 py-0.5 transition-colors"
                                  title="View detailed processing information"
                                >
                                  <BarChart3 className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">Process</span>
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Main Response with timestamp in bottom right */}
                          <div className="relative inline-block p-3 rounded-2xl shadow-sm bg-card text-card-foreground">
                            <div className="text-sm leading-relaxed pr-16 prose prose-sm dark:prose-invert max-w-none
                              prose-headings:mt-3 prose-headings:mb-2 prose-headings:font-semibold
                              prose-p:my-2 prose-p:leading-relaxed
                              prose-ul:my-2 prose-ul:pl-6 prose-ul:list-disc
                              prose-ol:my-2 prose-ol:pl-6 prose-ol:list-decimal
                              prose-li:my-0.5
                              prose-pre:my-3 prose-pre:p-3 prose-pre:bg-muted prose-pre:rounded-lg
                              prose-code:px-1 prose-code:py-0.5 prose-code:bg-muted prose-code:rounded prose-code:text-sm
                              prose-blockquote:border-l-4 prose-blockquote:border-muted-foreground/30 prose-blockquote:pl-4 prose-blockquote:italic
                              prose-strong:font-semibold prose-strong:text-foreground
                              prose-a:text-primary prose-a:underline prose-a:underline-offset-2
                              prose-hr:my-4 prose-hr:border-muted-foreground/30">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  // Match renderer used in regular messages for consistent look
                                  p: ({children}: any) => (<p className="my-3 leading-7">{children}</p>),
                                  ul: ({children}: any) => (<ul className="my-3 pl-6 list-disc space-y-2">{children}</ul>),
                                  ol: ({children}: any) => (<ol className="my-3 pl-6 list-decimal space-y-2">{children}</ol>),
                                  li: ({children}: any) => (<li className="my-1 leading-7">{children}</li>),
                                  h1: ({children}: any) => (<h1 className="text-2xl font-bold mt-6 mb-4">{children}</h1>),
                                  h2: ({children}: any) => (<h2 className="text-xl font-semibold mt-5 mb-3">{children}</h2>),
                                  h3: ({children}: any) => (<h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>),
                                  code: ({node, inline, className, children, ...props}: any) => {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                      <pre className="bg-muted rounded-lg p-3 overflow-x-auto my-4">
                                        <code className={className} {...props}>
                                          {children}
                                        </code>
                                      </pre>
                                    ) : (
                                      <code className="px-1 py-0.5 bg-muted rounded text-sm" {...props}>
                                        {children}
                                      </code>
                                    );
                                  },
                                  blockquote: ({children}: any) => (
                                    <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic my-4">{children}</blockquote>
                                  ),
                                  strong: ({children}: any) => (<strong className="font-semibold text-foreground">{children}</strong>),
                                  a: ({href, children}: any) => (
                                    <a href={href} className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">{children}</a>
                                  ),
                                  hr: () => (<hr className="my-6 border-muted-foreground/30" />),
                                }}
                              >
                                {formatMarkdown(message.content)}
                              </ReactMarkdown>
                            </div>
                            {/* Timestamp in bottom right corner */}
                            <div className="absolute bottom-2 right-3 text-xs text-muted-foreground/60">
                              {message.timestamp.toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </div>
                        </div>
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
                            : 'bg-card text-card-foreground'
                        }`}>
                          {message.role === 'assistant' ? (
                            <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none
                              prose-headings:mt-4 prose-headings:mb-3 prose-headings:font-semibold
                              prose-p:my-3 prose-p:leading-7
                              prose-ul:my-3 prose-ul:pl-6 prose-ul:list-disc prose-ul:space-y-2
                              prose-ol:my-3 prose-ol:pl-6 prose-ol:list-decimal prose-ol:space-y-2
                              prose-li:my-1 prose-li:leading-7
                              prose-pre:my-4 prose-pre:p-4 prose-pre:bg-muted prose-pre:rounded-lg
                              prose-code:px-1.5 prose-code:py-0.5 prose-code:bg-muted prose-code:rounded prose-code:text-sm prose-code:font-mono
                              prose-blockquote:border-l-4 prose-blockquote:border-muted-foreground/30 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:my-4
                              prose-strong:font-semibold prose-strong:text-foreground
                              prose-a:text-primary prose-a:underline prose-a:underline-offset-2
                              prose-hr:my-6 prose-hr:border-muted-foreground/30
                              [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  // Custom paragraph renderer to ensure spacing
                                  p: ({children}: any) => (
                                    <p className="my-3 leading-7">{children}</p>
                                  ),
                                  // Custom list renderers
                                  ul: ({children}: any) => (
                                    <ul className="my-3 pl-6 list-disc space-y-2">{children}</ul>
                                  ),
                                  ol: ({children}: any) => (
                                    <ol className="my-3 pl-6 list-decimal space-y-2">{children}</ol>
                                  ),
                                  li: ({children}: any) => (
                                    <li className="my-1 leading-7">{children}</li>
                                  ),
                                  // Headers with spacing
                                  h1: ({children}: any) => (
                                    <h1 className="text-2xl font-bold mt-6 mb-4">{children}</h1>
                                  ),
                                  h2: ({children}: any) => (
                                    <h2 className="text-xl font-semibold mt-5 mb-3">{children}</h2>
                                  ),
                                  h3: ({children}: any) => (
                                    <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>
                                  ),
                                  // Ensure code blocks render properly
                                  code: ({node, inline, className, children, ...props}: any) => {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                      <pre className="bg-muted rounded-lg p-3 overflow-x-auto my-4">
                                        <code className={className} {...props}>
                                          {children}
                                        </code>
                                      </pre>
                                    ) : (
                                      <code className="px-1 py-0.5 bg-muted rounded text-sm" {...props}>
                                        {children}
                                      </code>
                                    );
                                  },
                                  // Blockquotes
                                  blockquote: ({children}: any) => (
                                    <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic my-4">
                                      {children}
                                    </blockquote>
                                  ),
                                  // Strong/bold
                                  strong: ({children}: any) => (
                                    <strong className="font-semibold text-foreground">{children}</strong>
                                  ),
                                  // Links
                                  a: ({href, children}: any) => (
                                    <a href={href} className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                                      {children}
                                    </a>
                                  ),
                                  // Horizontal rule
                                  hr: () => (
                                    <hr className="my-6 border-muted-foreground/30" />
                                  ),
                                }}
                              >
                                {formatMarkdown(message.content)}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <div className="text-sm leading-relaxed">
                              {message.content}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Note: Typing indicator now handled by InlineThinkingIndicator */}

                {/* Removed prominent AI indicators - now using discreet header indicator */}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
          

      </div>

      {/* Fixed Input Area - Claude Style (Tools Outside Text Area) */}
      <div className="flex-shrink-0 bg-background">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <form onSubmit={handleSubmit} className="relative">
            {/* Text input container - Clean text area only */}
            <div className="relative bg-card border border-border/40 rounded-3xl shadow-sm hover:shadow-md transition-all duration-200 focus-within:border-ring/50 focus-within:shadow-md">
              <div className="px-4 py-2 flex items-center">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${agent?.name || 'Agent'}...`}
                  className="w-full resize-none bg-transparent text-foreground placeholder-muted-foreground/70 border-0 outline-0 text-[15px] leading-normal disabled:opacity-50 disabled:cursor-not-allowed placeholder-center"
                  disabled={sending || !agent}
                  rows={1}
                  style={{ minHeight: '22px', maxHeight: '120px' }}
                />
              </div>
            </div>

            {/* Bottom controls - Outside the text area like Claude */}
            <div className="flex items-center justify-between mt-2 px-2">
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
                  className="p-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center min-w-[36px] min-h-[36px] shadow-sm hover:scale-105 disabled:hover:scale-100"
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
          <div className="text-xs text-muted-foreground/70 text-center mt-1 opacity-0 hover:opacity-100 transition-opacity duration-300">
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

      {/* Process Modal */}
      <ProcessModal
        isOpen={showProcessModal}
        onClose={() => setShowProcessModal(false)}
        processingDetails={currentProcessingDetails}
      />
    </div>
  );
}