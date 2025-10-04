import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAgents } from '../hooks/useAgents';
import { useConnections } from '@/integrations/_shared';
import { AIState, ToolExecutionStatus } from '../components/AIThinkingIndicator';
import type { Message } from '../types';
import type { Database } from '../types/database.types';
import { ToolCategorizer } from '../lib/toolCategorization';
import { toast } from 'react-hot-toast';
import { refreshAgentAvatarUrl } from '../lib/avatarUtils';

// Import extracted components
import { ConversationSelector, SidebarConversations } from '../components/chat/ConversationComponents';
import { MessageList, ChatStarterScreen } from '../components/chat/MessageComponents';
import { ChatInput } from '../components/chat/ChatInput';
import { ChatHeader } from '../components/chat/ChatHeader';
import { ChatModals } from '../components/chat/ChatModals';



type Agent = Database['public']['Tables']['agents']['Row'];

export function AgentChatPage() {
  const { user } = useAuth();
  const { agentId } = useParams<{ agentId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { updateAgent } = useAgents();
  const { connections } = useConnections({ includeRevoked: false });
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
  const [showAgentSettingsModal, setShowAgentSettingsModal] = useState(false);
  const [agentSettingsInitialTab, setAgentSettingsInitialTab] = useState<'general' | 'schedule' | 'identity' | 'behavior' | 'memory' | 'media' | 'tools' | 'channels' | 'sources' | 'team' | 'contacts' | 'workflows' | 'automations' | 'zapier-mcp'>('general');
  
  // Real-time message subscription
  const [messageSubscription, setMessageSubscription] = useState<RealtimeChannel | null>(null);
  
  // File upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [attachedDocuments, setAttachedDocuments] = useState<Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    uploadStatus: 'uploading' | 'completed' | 'error';
  }>>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(() => {
    // Check if we have a conversation ID in the URL first
    const params = new URLSearchParams(location.search);
    const urlConvId = params.get('conv');
    if (urlConvId) {
      console.log('[AgentChatPage] Initial conversation ID from URL:', urlConvId);
      return urlConvId;
    }
    
    // If no URL conversation, return null initially
    // We'll generate the temporary ID in useEffect to properly update the URL
    console.log('[AgentChatPage] No initial conversation ID, will generate in useEffect');
    return null;
  });
  
  // Track if we're creating a new conversation to prevent race conditions
  const [isCreatingNewConversation, setIsCreatingNewConversation] = useState(false);
  // Track if this is a temporary conversation (not yet persisted to database)
  const [isTemporaryConversation, setIsTemporaryConversation] = useState(() => {
    const params = new URLSearchParams(location.search);
    const urlConvId = params.get('conv');
    // If no conversation in URL, we'll need to create a temporary one
    return !urlConvId;
  });
  // Refresh key to force conversation reload when clicking the same conversation
  const [conversationRefreshKey, setConversationRefreshKey] = useState(0);
  // Reasoning toggle (persist per agent in localStorage)
  const [reasoningEnabled, setReasoningEnabled] = useState<boolean>(() => {
    const key = `agent_${agentId}_reasoning_enabled`;
    const v = localStorage.getItem(key);
    return v === null ? true : v === 'true';
  });
  
  // Web search toggle (persist per agent in localStorage)
  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(() => {
    const key = `agent_${agentId}_web_search_enabled`;
    const v = localStorage.getItem(key);
    return v === null ? false : v === 'true';
  });
  
  // Check if user has web search credentials available
  const hasWebSearchCredentials = connections.some(c => 
    ['serper_api', 'serpapi', 'brave_search'].includes(c.provider_name) && 
    c.connection_status === 'active'
  );
  
  // Function to update agent's web search setting in metadata
  const updateAgentWebSearchSetting = useCallback(async (enabled: boolean) => {
    if (!agentId || !agent) return;
    
    try {
      const currentMetadata = agent.metadata || {};
      const currentSettings = currentMetadata.settings || {};
      
      const updatedMetadata = {
        ...currentMetadata,
        settings: {
          ...currentSettings,
          web_search_enabled: enabled
        }
      };
      
      const { error } = await supabase
        .from('agents')
        .update({ metadata: updatedMetadata })
        .eq('id', agentId);
        
      if (error) {
        console.error('Error updating agent web search setting:', error);
      } else {
        console.log(`[AgentChat] Web search ${enabled ? 'enabled' : 'disabled'} for agent ${agentId}`);
        setAgent(prev => prev ? { ...prev, metadata: updatedMetadata } : null);
      }
    } catch (error) {
      console.error('Error updating agent web search setting:', error);
    }
  }, [agentId, agent]);
  
  // Sync webSearchEnabled state with agent metadata when agent loads
  useEffect(() => {
    if (agent && agentId) {
      const settingFromDB = agent.metadata?.settings?.web_search_enabled;
      if (settingFromDB !== undefined) {
        setWebSearchEnabled(settingFromDB);
        localStorage.setItem(`agent_${agentId}_web_search_enabled`, String(settingFromDB));
      }
    }
  }, [agent, agentId]);
  
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
  // Sync selected conversation with URL ?conv= param and localStorage
  useEffect(() => {
    // Listen for task modal activating a conversation
    const handler = (e: any) => {
      const detail = e?.detail;
      if (!detail) return;
      if (detail.agentId === agentId && detail.conversationId) {
        setSelectedConversationId(detail.conversationId);
        try { localStorage.setItem(`agent_${agentId}_conversation_id`, detail.conversationId); } catch {}
        // Force a quick refresh of history
        setMessages([]);
        // Ensure sidebar list refreshes by touching last_active
        try {
          supabase.from('conversation_sessions')
            .upsert({ conversation_id: detail.conversationId, agent_id: agentId, user_id: user?.id || null, last_active: new Date().toISOString(), status: 'active' });
        } catch {}
      }
    };
    window.addEventListener('agentopia:conversation:activated', handler as EventListener);
    return () => window.removeEventListener('agentopia:conversation:activated', handler as EventListener);
  }, [agentId]);

  // Generate temporary conversation ID and update URL when needed
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const conv = params.get('conv');
    
    if (conv) {
      // URL has a conversation ID, use it
      // Always update even if it's the same to force a refresh when clicking the same conversation
      if (conv !== selectedConversationId) {
        console.log('[AgentChatPage] Setting conversation ID from URL:', conv, 'previous:', selectedConversationId);
        setSelectedConversationId(conv);
        setIsTemporaryConversation(false); // URL conversations are not temporary
        if (agentId) localStorage.setItem(`agent_${agentId}_conversation_id`, conv);
      } else {
        // Force a reload by incrementing the refresh key
        console.log('[AgentChatPage] Same conversation clicked, forcing reload:', conv);
        setConversationRefreshKey(prev => prev + 1);
      }
    } else if (!conv && !selectedConversationId && agentId) {
      // No conversation ID in URL or state - generate temporary one and update URL
      const tempConvId = crypto.randomUUID();
      console.log('[AgentChatPage] Generating new temporary conversation ID:', tempConvId);
      setSelectedConversationId(tempConvId);
      setIsTemporaryConversation(true);
      setMessages([]);
      // Update URL to include the temporary conversation ID
      navigate(`/agents/${agentId}/chat?conv=${tempConvId}`, { replace: true });
      if (agentId) {
        try { 
          localStorage.removeItem(`agent_${agentId}_conversation_id`);
          localStorage.removeItem(`agent_${agentId}_session_id`);
        } catch {}
      }
    } else if (!conv && selectedConversationId) {
      // URL has no conversation ID but we have one in state
      // Generate a new temporary conversation for better UX
      const tempConvId = crypto.randomUUID();
      console.log('[AgentChatPage] URL cleared but state has conversation, generating new:', tempConvId, 'previous:', selectedConversationId);
      setSelectedConversationId(tempConvId);
      setIsTemporaryConversation(true);
      setMessages([]);
      // Update URL to include the new temporary conversation ID
      navigate(`/agents/${agentId}/chat?conv=${tempConvId}`, { replace: true });
      if (agentId) {
        try { 
          localStorage.removeItem(`agent_${agentId}_conversation_id`);
          localStorage.removeItem(`agent_${agentId}_session_id`);
        } catch {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, agentId]);

  // Reset messages when switching agent or conversation
  useEffect(() => {
    setMessages([]);
    setIsHistoryLoading(true);
  }, [agentId, selectedConversationId]);
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // Max height in pixels
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, []);

  // Conversation actions: rename, archive, share
  const handleRenameConversation = useCallback(async () => {
    if (!selectedConversationId || !agentId || !user?.id) return;
    const currentTitle = '';
    const next = prompt('Rename conversation', currentTitle);
    if (next === null) return;
    const title = next.trim();
    try {
      await supabase
        .from('conversation_sessions')
        .upsert({ conversation_id: selectedConversationId, agent_id: agentId, user_id: user.id, title }, { onConflict: 'conversation_id' });
    } catch {}
  }, [selectedConversationId, agentId, user?.id]);

  const handleArchiveConversation = useCallback(async () => {
    if (!selectedConversationId || !agentId) return;
    try {
      await supabase
        .from('conversation_sessions')
        .update({ status: 'abandoned', ended_at: new Date().toISOString() })
        .eq('conversation_id', selectedConversationId)
        .eq('agent_id', agentId);
    } catch {}
    setSelectedConversationId(null);
    try { localStorage.removeItem(`agent_${agentId}_conversation_id`); } catch {}
    navigate(`/agents/${agentId}/chat`, { replace: true });
    setMessages([]);
  }, [selectedConversationId, agentId, navigate]);

  const handleShareConversation = useCallback(async () => {
    if (!agentId || !selectedConversationId) return;
    const link = `${window.location.origin}/agents/${agentId}/chat?conv=${selectedConversationId}`;
    try {
      await navigator.clipboard.writeText(link);
      alert('Shareable link copied to clipboard');
    } catch {
      prompt('Copy link to share:', link);
    }
  }, [agentId, selectedConversationId]);

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
    // Capture tool analysis response using smart categorization
    const detectedCategories = ToolCategorizer.categorizeByContent(input);
    const toolAnalysis = detectedCategories.length > 0;
    const categoryLabels = detectedCategories.map(cat => cat.label).join(', ');
    
    addStepResponse('analyzing_tools', `Checking available tools for this request...\nTool categories detected: ${categoryLabels || 'None'}\nAvailable tools: Email integration, Web search, File operations\nDecision: ${toolAnalysis ? `Will use ${categoryLabels} tools` : 'No tools needed for this request'}`);

    // Phase 3: Check if we might execute a tool (simulate tool detection)
    const mightUseTool = toolAnalysis;

    if (mightUseTool) {
      // Phase 4: Tool execution
      const primaryCategory = ToolCategorizer.getPrimaryCategory(detectedCategories);
      const toolProvider = primaryCategory?.id === 'email' ? 'email_service' : primaryCategory?.id || 'tool';
      
      updateAIState('executing_tool', {
        toolName: `${toolProvider}_action`,
        provider: toolProvider,
        status: 'executing',
        startTime: new Date(),
      });
      
      // Capture tool call with dynamic categorization
      const toolAction = primaryCategory?.id === 'email' ? 'send_email' : 
                        primaryCategory?.id === 'web' ? 'web_search' :
                        primaryCategory?.id === 'docs' ? 'create_document' :
                        'execute_action';
      
      addStepToolCall('executing_tool', 
        `${toolProvider}.${toolAction}({
  ${primaryCategory?.id === 'email' ? 
    `to: "user@example.com",
  subject: "Response to your inquiry",
  body: "Thank you for your message..."` :
  primaryCategory?.id === 'web' ? 
    `query: "search terms from user message",
  type: "comprehensive"` :
    `action: "process_request"`}
})`,
        {
          success: true,
          [primaryCategory?.id === 'email' ? 'message_id' : 
           primaryCategory?.id === 'web' ? 'results_count' : 
           'operation_id']: primaryCategory?.id === 'email' ? "msg_abc123" : 
                           primaryCategory?.id === 'web' ? 5 : "op_xyz789",
          executed_at: new Date().toISOString(),
          category: primaryCategory?.label || 'General'
        }
      );
      
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Phase 5: Processing results
      updateAIState('processing_results', {
        status: 'completed',
        endTime: new Date(),
      });
      
      const resultMessage = primaryCategory?.id === 'email' ? 'Email sent successfully!' :
                           primaryCategory?.id === 'web' ? 'Web search completed!' :
                           primaryCategory?.id === 'docs' ? 'Document created!' :
                           'Operation completed successfully!';
      
      addStepResponse('processing_results', `Tool execution completed successfully!\n${resultMessage}\nProcessing the result to formulate a response to the user.`);
      
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Phase 6: Generating response
    updateAIState('generating_response');
    const toolResults = mightUseTool ? 
      `${ToolCategorizer.getPrimaryCategory(detectedCategories)?.label || 'Tool'} operation completed successfully` : 
      'No tools used';
      
    addStepResponse('generating_response', `Generating final response based on:\n- User's original request: "${input}"\n- Tool results: ${toolResults}\n- Context: Friendly conversation\n\nFormulating helpful and conversational response...`);
    
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
        // Clear previous agent state immediately to prevent showing wrong agent info
        setAgent(null);
        
        const controller = new AbortController();
        abortControllerRef.current = controller;
        
        // Fetch agent - allow access to system agents or user's own agents
        const { data, error } = await supabase
          .from('agents')
          .select('*')
          .eq('id', agentId)
          .single();
        
        if (error) {
          if (error.code === 'PGRST116') {
            throw new Error('Agent not found or you do not have permission to access it.');
          }
          throw error;
        }
        
        // Check if user has permission to access this agent
        // Allow if: 1) User owns the agent, OR 2) It's a system agent
        const isSystemAgent = data.metadata?.is_system_agent === true;
        const isOwner = data.user_id === user.id;
        
        if (!isOwner && !isSystemAgent) {
          throw new Error('You do not have permission to access this agent.');
        }
        
        if (!isMounted.current) {
          console.log('[fetchAgent] Unmounted after Supabase query returned.');
          return;
        }
        
        // Refresh avatar URL if needed
        console.log('Agent loaded with avatar URL:', data.avatar_url);
        const refreshedAvatarUrl = await refreshAgentAvatarUrl(supabase, agentId, data.avatar_url);
        if (refreshedAvatarUrl && refreshedAvatarUrl !== data.avatar_url) {
          console.log('Avatar URL refreshed:', refreshedAvatarUrl);
          data.avatar_url = refreshedAvatarUrl;
        } else if (refreshedAvatarUrl) {
          console.log('Avatar URL is still valid:', refreshedAvatarUrl);
        } else {
          console.log('No avatar URL available for agent:', agentId);
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

	// Fetch chat history (strictly scoped to selected conversation)
	useEffect(() => {
		const fetchHistory = async () => {
			if (!agentId || !user?.id) return;
			
			// Skip fetching if we're in the process of creating a new conversation
			if (isCreatingNewConversation) return;
			
			setIsHistoryLoading(true);
			try {
				// If no conversation is selected, show a clean slate
				if (!selectedConversationId) {
					setMessages([]);
					return;
				}

				// Skip database validation for temporary conversations
				if (isTemporaryConversation) {
					setMessages([]);
					return;
				}

				// Removed the early return logic that prevented reloading when switching conversations
				// The conversationRefreshKey dependency will trigger proper reloads when needed

				// Validate conversation is active; if archived or missing, clear selection and redirect
				try {
					const { data: sessionRow } = await supabase
						.from('conversation_sessions')
						.select('status')
						.eq('conversation_id', selectedConversationId)
						.eq('agent_id', agentId)
						.eq('user_id', user.id)
						.maybeSingle();
					if (!sessionRow || sessionRow.status !== 'active') {
						setSelectedConversationId(null);
						setIsTemporaryConversation(true);
						try { localStorage.removeItem(`agent_${agentId}_conversation_id`); } catch {}
						setMessages([]);
						return;
					}
				} catch { /* non-fatal; proceed */ }

				const { data: assistantData, error: assistantErr } = await supabase
					.from('chat_messages_v2')
					.select('*')
					.eq('sender_agent_id', agentId)
					.eq('conversation_id', selectedConversationId as string)
					.order('created_at', { ascending: true });
				if (assistantErr) throw assistantErr;

				const { data: userData, error: userErr } = await supabase
					.from('chat_messages_v2')
					.select('*')
					.eq('sender_user_id', user.id)
					.eq('conversation_id', selectedConversationId as string)
					.order('created_at', { ascending: true });
				if (userErr) throw userErr;

				const rows = [...(assistantData || []), ...(userData || [])].sort(
					(a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
				);

				const formatted: Message[] = rows.map((msg: any) => ({
					role: (msg.role === 'assistant' || msg.sender_agent_id) ? 'assistant' : 'user',
					content: typeof msg.content === 'string' ? msg.content : (msg.content?.text ?? ''),
					timestamp: new Date(msg.created_at),
					agentId: msg.sender_agent_id,
					userId: msg.sender_agent_id ? user.id : msg.sender_user_id,
				}));

				setMessages(formatted);
			} catch (err) {
				console.error('Failed to fetch chat history:', err);
				setError('Could not load chat history.');
			} finally {
				setIsHistoryLoading(false);
			}
		};

		fetchHistory();
	}, [agentId, user?.id, selectedConversationId, isCreatingNewConversation, isTemporaryConversation, conversationRefreshKey]);

  // Set up real-time message subscription
  useEffect(() => {
    if (!selectedConversationId || !agentId) {
      // Clean up existing subscription
      if (messageSubscription) {
        console.log('Cleaning up message subscription');
        supabase.removeChannel(messageSubscription);
        setMessageSubscription(null);
      }
      return;
    }

    // Set up new subscription for this conversation
    console.log(`Setting up real-time subscription for conversation: ${selectedConversationId}`);
    
    const channel = supabase
      .channel(`chat-messages-${selectedConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages_v2',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        (payload) => {
          console.log('New message received via realtime:', payload);
          const newMessage = payload.new as any;
          
          // If this is an assistant message, hide any thinking indicator
          if (newMessage.role === 'assistant') {
            setThinkingMessageIndex(null);
            setShowAIIndicator(false);
            setAiState('completed');
          }
          
          // Convert database message to frontend Message format
          const message: Message = {
            role: newMessage.role,
            content: typeof newMessage.content === 'string' ? newMessage.content : newMessage.content?.text || '',
            timestamp: new Date(newMessage.created_at),
            userId: newMessage.sender_user_id,
            agentId: newMessage.sender_agent_id,
            id: newMessage.id,
          };
          
          // Add to messages if not already present (avoid duplicates)
          setMessages(prev => {
            const exists = prev.some(msg => msg.id === message.id);
            if (exists) return prev;
            return [...prev, message].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          // Only log successful subscription in development
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Connected to messages for conversation ${selectedConversationId}`);
          }
        } else if (status === 'CHANNEL_ERROR') {
          // Less noisy error logging - connection drops are normal
          if (process.env.NODE_ENV === 'development') {
            console.warn('🔄 Message connection interrupted, auto-reconnecting...');
          }
        } else if (status === 'CLOSED') {
          if (process.env.NODE_ENV === 'development') {
            console.info('📪 Message subscription closed');
          }
        } else if (status === 'TIMED_OUT') {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⏱️ Message subscription timed out, reconnecting...');
          }
        }
      });

    setMessageSubscription(channel);

    return () => {
      if (channel) {
        console.log(`Unsubscribing from messages for conversation ${selectedConversationId}`);
        supabase.removeChannel(channel);
      }
    };
  }, [selectedConversationId, agentId]);

  // Check for active task executions when conversation is opened
  useEffect(() => {
    if (!selectedConversationId || !agent?.id) return;

    const checkActiveExecution = async () => {
      try {
        // Check if there's an active task execution for this conversation
        const { data: executions, error } = await supabase
          .from('agent_task_executions')
          .select('*')
          .eq('agent_id', agent.id)
          .eq('conversation_id', selectedConversationId)
          .in('status', ['running', 'pending'])
          .order('started_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error checking active executions:', error);
          return;
        }

        if (executions && executions.length > 0) {
          console.log('Found active task execution, showing thinking indicator');
          
          // Show thinking indicator for active execution
          const thinkingMessage: Message = {
            role: 'thinking',
            content: 'Processing your request...',
            timestamp: new Date(),
            agentId: agent.id,
            userId: user?.id,
            metadata: { isCompleted: false },
            id: `thinking-${Date.now()}`,
          };
          
          setMessages(prev => {
            // Don't add if already exists
            const hasThinking = prev.some(msg => msg.role === 'thinking' && !msg.metadata?.isCompleted);
            if (hasThinking) return prev;
            
            const newMessages = [...prev, thinkingMessage];
            setThinkingMessageIndex(newMessages.length - 1);
            return newMessages;
          });
          
          setShowAIIndicator(true);
          setAiState('generating_response');
        }
      } catch (error) {
        console.error('Error checking active executions:', error);
      }
    };

    // Check immediately when conversation opens
    checkActiveExecution();
  }, [selectedConversationId, agent?.id, user?.id]);

  // Submit Message Handler - Enhanced with AI state tracking
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !agent || sending || !user?.id) return;

    const messageText = input.trim();
    setInput('');
    // Clear attached documents after sending
    setAttachedDocuments([]);
    setSending(true);

    // Establish conversation ID FIRST (before adding messages or starting AI processing)
    // This ensures the UI switches to chat history view immediately
    let convId = selectedConversationId;
    let sessId = localStorage.getItem(`agent_${agent.id}_session_id`) || crypto.randomUUID();
    
    if (isTemporaryConversation) {
      // Set flag to prevent fetchHistory from clearing our messages
      setIsCreatingNewConversation(true);
      
      // Use the existing temporary conversation ID or create a new one
      // Defensive: preserve existing convId if selectedConversationId was reset unexpectedly
      console.log('[AgentChatPage] handleSubmit - selectedConversationId:', selectedConversationId, 'convId before:', convId);
      convId = selectedConversationId || convId || crypto.randomUUID();
      console.log('[AgentChatPage] handleSubmit - convId after:', convId);
      sessId = crypto.randomUUID();
      
      // Mark as no longer temporary since we're persisting it
      setIsTemporaryConversation(false);
      setSelectedConversationId(convId);
      
      // Reflect in URL for consistency
      navigate(`/agents/${agentId}/chat?conv=${convId}`, { replace: true });
      localStorage.setItem(`agent_${agent.id}_conversation_id`, convId);
      localStorage.setItem(`agent_${agent.id}_session_id`, sessId);
    }

    // Get attached document IDs for metadata
    const completedAttachments = attachedDocuments.filter(doc => doc.uploadStatus === 'completed');
    
    // Add user message after conversation context is established
    const userMessage: Message = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      userId: user.id,
      metadata: completedAttachments.length > 0 ? {
        attachments: completedAttachments.map(doc => ({
          id: doc.id,
          name: doc.name,
          size: doc.size,
          type: doc.type
        }))
      } : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Start AI processing indicator
    startAIProcessing();
    
    // Immediate scroll for better UX
    requestAnimationFrame(() => {
      scrollToBottom();
    });

    try {
      setSending(true);
      setError(null);

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

      // Frontend fallback: ensure a session row exists with a reasonable title so the sidebar updates immediately
      try {
        const fallbackTitle = (() => {
          const words = messageText.trim().split(/\s+/).slice(0, 6);
          const titleCase = words
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          return titleCase || 'New Conversation';
        })();

        // Check existing title first to avoid overwriting a good one
        const { data: existing } = await supabase
          .from('conversation_sessions')
          .select('conversation_id, title')
          .eq('conversation_id', convId)
          .maybeSingle();

        const needsTitle = !existing || !existing.title || existing.title.toLowerCase() === 'new conversation';
        if (needsTitle) {
          // Avoid ON CONFLICT since conversation_id is not unique-indexed
          const base: any = {
            agent_id: agent.id,
            user_id: user.id,
            title: fallbackTitle,
            status: 'active',
            last_active: new Date().toISOString(),
          };
          const upd = await supabase
            .from('conversation_sessions')
            .update(base)
            .eq('conversation_id', convId)
            .select('conversation_id');
          if (!upd || !upd.data || upd.data.length === 0) {
            await supabase
              .from('conversation_sessions')
              .insert({ conversation_id: convId, ...base });
          }
        }
      } catch { /* non-fatal */ }
      
      // Clear the flag now that the conversation is saved
      setIsCreatingNewConversation(false);

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

      // Use the conversation and session IDs established earlier
      const conversationId = convId;
      const sessionId = sessId;

      // Include attached documents in the message context
      // Re-use completedAttachments from earlier or redefine if needed
      const attachedDocumentIds = completedAttachments.map(doc => doc.id);
      
      // If there are attached documents, add context about them to the message
      let enhancedMessageText = messageText;
      if (attachedDocumentIds.length > 0) {
        const docNames = completedAttachments.map(doc => doc.name).join(', ');
        const docIds = attachedDocumentIds.join(', ');
        
        // Add context about attached documents with their IDs
        enhancedMessageText = `${messageText}\n\n[Context: The user has attached the following document(s): ${docNames}. The document IDs are: ${docIds}. Use get_document_content with these exact IDs to access their content.]`;
      }

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
          content: { type: 'text', text: enhancedMessageText },
          // Include document IDs in metadata
          metadata: attachedDocumentIds.length > 0 ? {
            attached_documents: attachedDocumentIds,
            document_names: completedAttachments.map(doc => ({ id: doc.id, name: doc.name }))
          } : undefined
        },
        options: { 
          context: { max_messages: contextSize },
          reasoning: { enabled: reasoningEnabled, threshold: 0.3 }
        }
      };
      // Ensure we do not send nulls for optional string fields
      // Only delete if the value is actually null/undefined, not if the object doesn't exist
      if (requestBody.context.agent_id === null || requestBody.context.agent_id === undefined) {
        delete requestBody.context.agent_id;
      }
      if (requestBody.context.user_id === null || requestBody.context.user_id === undefined) {
        delete requestBody.context.user_id;
      }
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
        
        // Handle 413 (context window exceeded) errors specially
        if (response.status === 413) {
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: 'Document too large for context window' };
          }
          
          // Add a helpful system message explaining the issue
          const contextErrorMessage: Message = {
            id: `context_error_${Date.now()}`,
            role: 'assistant' as const,
            content: errorData.message || 'I apologize, but the document you\'re asking about is too large to process in our current conversation context. The document contains a lot of content that would exceed my context window limits.\n\nHere are some ways I can help:\n\n• **Ask specific questions** about particular topics in the document\n• **Search for specific information** within the document\n• **Start a new conversation** to discuss this document with a fresh context\n• **Break your question** into smaller, more focused parts\n\nWhat specific information from the document would you like me to help you with?',
            timestamp: new Date(),
            metadata: { isContextError: true }
          };
          
          setMessages(prev => [...prev, contextErrorMessage]);
          scrollToBottom();
          return; // Don't throw an error, just show the helpful message
        }
        
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
      setIsCreatingNewConversation(false); // Ensure flag is cleared
    }
  }, [input, agent, sending, user?.id, scrollToBottom, startAIProcessing, simulateAIProcessing, completeAIProcessing]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  // Remove attachment handler
  const handleRemoveAttachment = useCallback((documentId: string) => {
    setAttachedDocuments(prev => prev.filter(doc => doc.id !== documentId));
  }, []);

  // File upload handler
  const handleFileUpload = useCallback(async (files: FileList, uploadType: 'document' | 'image') => {
    if (!user || !agent || files.length === 0) return;

    setUploading(true);
    const uploadedFiles: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));

        // Validate file type and size
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
          toast.error(`File ${file.name} exceeds 50MB limit`);
          continue;
        }

        // Validate file type based on upload type
        const allowedTypes = uploadType === 'image' 
          ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
          : ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
             'application/msword', 'text/plain', 'application/vnd.ms-powerpoint', 
             'application/vnd.openxmlformats-officedocument.presentationml.presentation'];

        if (!allowedTypes.includes(file.type)) {
          toast.error(`File type ${file.type} not supported for ${uploadType} upload`);
          continue;
        }

        // Add to attached documents with uploading status (use temp ID for now)
        const documentAttachment = {
          id: fileId, // This will be updated with actual media_id after upload
          name: file.name,
          size: file.size,
          type: file.type,
          uploadStatus: 'uploading' as const,
          tempId: fileId // Keep track of temp ID for updates
        };
        setAttachedDocuments(prev => [...prev, documentAttachment]);

        try {
          // Upload to Media Library via MCP (self-contained)
          const authToken = (await supabase.auth.getSession()).data.session?.access_token;
          
          setUploadProgress(prev => ({ ...prev, [fileId]: 25 }));

          // Step 1: Upload document metadata
          const requestBody = {
            action: 'upload_document',
            agent_id: agent.id,
            user_id: user.id,
            params: {
              file_name: file.name,
              file_type: file.type,
              file_size: file.size,
              category: uploadType === 'image' ? 'images' : 'documents',
              description: `Uploaded via chat on ${new Date().toLocaleDateString()}`
            }
          };
          
          console.log('[AgentChatPage] Sending upload request:', requestBody);
          
          const uploadResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-mcp`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Upload failed: ${errorText}`);
          }

          const uploadData = await uploadResponse.json();
          
          if (!uploadData.success) {
            throw new Error(uploadData.error || 'Upload failed');
          }

          setUploadProgress(prev => ({ ...prev, [fileId]: 40 }));

          // Step 2: Upload actual file to storage
          const { error: storageError } = await supabase.storage
            .from('media-library')
            .upload(uploadData.data.storage_path, file, {
              contentType: file.type,
              duplex: 'half'
            });

          if (storageError) {
            throw new Error(`File storage failed: ${storageError.message}`);
          }

          setUploadProgress(prev => ({ ...prev, [fileId]: 60 }));

          // Step 3: Process document (extract text)
          const processResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-mcp`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'process_document',
              agent_id: agent.id,
              user_id: user.id,
              params: {
                document_id: uploadData.data.media_id
              }
            })
          });

          setUploadProgress(prev => ({ ...prev, [fileId]: 80 }));

          if (!processResponse.ok) {
            throw new Error(`Document processing failed: ${await processResponse.text()}`);
          }

          const processData = await processResponse.json();
          
          if (!processData.success) {
            throw new Error(processData.error || 'Document processing failed');
          }

          // Step 4: Assign to agent
          const assignResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-mcp`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'assign_to_agent',
              agent_id: agent.id,
              user_id: user.id,
              params: {
                document_id: uploadData.data.media_id,
                assignment_type: 'reference',
                include_in_vector_search: true,
                include_in_knowledge_graph: false,
                priority_level: 1
              }
            })
          });

          setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));

          if (!assignResponse.ok) {
            console.error('[AgentChat] Failed to assign document to agent:', await assignResponse.text());
            toast.warn(`${file.name} processed but assignment failed`);
          } else {
            const assignData = await assignResponse.json();
            if (!assignData.success) {
              console.error('[AgentChat] Document assignment failed:', assignData.error);
              toast.warn(`${file.name} processed but assignment failed`);
            }
          }

          uploadedFiles.push(file.name);
          toast.success(`${file.name} uploaded, processed, and assigned to ${agent.name}`);
          
          // Update attachment with real media_id and status to completed
          setAttachedDocuments(prev => 
            prev.map(doc => 
              doc.tempId === fileId || doc.id === fileId
                ? { ...doc, id: uploadData.data.media_id, uploadStatus: 'completed' as const }
                : doc
            )
          );

        } catch (error: any) {
          console.error('File upload error:', error);
          toast.error(`Failed to upload ${file.name}: ${error.message}`);
          // Update attachment status to error
          setAttachedDocuments(prev => 
            prev.map(doc => 
              doc.tempId === fileId || doc.id === fileId 
                ? { ...doc, uploadStatus: 'error' as const }
                : doc
            )
          );
        } finally {
          // Clean up progress tracking
          setTimeout(() => {
            setUploadProgress(prev => {
              const newProgress = { ...prev };
              delete newProgress[fileId];
              return newProgress;
            });
          }, 2000);
        }
      }

      if (uploadedFiles.length > 0) {
        // Add a system message to chat indicating files were uploaded
        const systemMessage: Message = {
          id: `upload_${Date.now()}`,
          role: 'assistant' as const,  // Use 'assistant' role for system messages
          content: `📎 Uploaded ${uploadedFiles.length} ${uploadType}${uploadedFiles.length !== 1 ? 's' : ''}: ${uploadedFiles.join(', ')}. ${uploadedFiles.length === 1 ? 'It has' : 'They have'} been added to the Media Library and assigned to ${agent.name} for training.`,
          timestamp: new Date(),
          conversation_id: selectedConversationId,
          agent_id: agent.id,
          user_id: user.id,
          metadata: { isSystemMessage: true }  // Mark as system message in metadata
        };

        // Don't add system message or trigger automatic response
        // Documents should be uploaded silently in the background
        // The user can then chat about them when they send a message
      }

    } catch (error: any) {
      console.error('Upload process error:', error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }, [user, agent, supabase, selectedConversationId, scrollToBottom]);

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
    <div className="flex h-full bg-background overflow-hidden">
      {/* Main Column */}
      <div className="flex flex-col flex-1 min-w-0">
      {/* Chat Header */}
      <ChatHeader
        agent={agent}
        agentId={agentId || ''}
        onShowTeamAssignment={() => setShowTeamAssignmentModal(true)}
        onShowAboutMe={() => setShowAboutMeModal(true)}
        onShowHowIThink={() => setShowHowIThinkModal(true)}
        onShowWhatIKnow={() => setShowWhatIKnowModal(true)}
        onShowTools={() => setShowToolsModal(true)}
        onShowChannels={() => setShowChannelsModal(true)}
        onShowTasks={() => setShowTasksModal(true)}
        onShowHistory={() => setShowHistoryModal(true)}
        onShowAgentSettings={() => setShowAgentSettingsModal(true)}
      />

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
            <ChatStarterScreen agent={agent} />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 pb-8 min-h-full">
              <MessageList 
                messages={messages}
                agent={agent}
                user={user}
                thinkingMessageIndex={thinkingMessageIndex}
                formatMarkdown={formatMarkdown}
                currentProcessingDetails={currentProcessingDetails}
                onShowProcessModal={() => setShowProcessModal(true)}
                aiState={aiState}
                        currentTool={currentTool}
                processSteps={processSteps}
              />
                            </div>
                          )}
          

                                          </div>

      {/* Chat Input */}
      <ChatInput
        input={input}
        setInput={setInput}
        agent={agent}
        sending={sending}
        uploading={uploading}
        uploadProgress={uploadProgress}
        attachedDocuments={attachedDocuments}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        onFileUpload={handleFileUpload}
        onRemoveAttachment={handleRemoveAttachment}
        adjustTextareaHeight={adjustTextareaHeight}
        onShowAgentSettings={() => setShowAgentSettingsModal(true)}
      />

              </div>

      {/* Chat Modals */}
      <ChatModals
        showTeamAssignmentModal={showTeamAssignmentModal}
        showAboutMeModal={showAboutMeModal}
        showHowIThinkModal={showHowIThinkModal}
        showWhatIKnowModal={showWhatIKnowModal}
        showToolsModal={showToolsModal}
        showChannelsModal={showChannelsModal}
        showTasksModal={showTasksModal}
        showHistoryModal={showHistoryModal}
        showProcessModal={showProcessModal}
        showAgentSettingsModal={showAgentSettingsModal}
        setShowTeamAssignmentModal={setShowTeamAssignmentModal}
        setShowAboutMeModal={setShowAboutMeModal}
        setShowHowIThinkModal={setShowHowIThinkModal}
        setShowWhatIKnowModal={setShowWhatIKnowModal}
        setShowToolsModal={setShowToolsModal}
        setShowChannelsModal={setShowChannelsModal}
        setShowTasksModal={setShowTasksModal}
        setShowHistoryModal={setShowHistoryModal}
        setShowProcessModal={setShowProcessModal}
        setShowAgentSettingsModal={setShowAgentSettingsModal}
        agentId={agentId || ''}
        agent={agent}
        currentProcessingDetails={currentProcessingDetails}
        agentSettingsInitialTab={agentSettingsInitialTab}
        onAgentUpdated={(updatedData) => {
          // Merge the updated data with existing agent data to prevent losing fields
          setAgent(prev => prev ? { ...prev, ...updatedData } : updatedData as Agent);
        }}
        updateAgent={updateAgent}
      />
    </div>
  );
}
