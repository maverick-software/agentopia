// Message Format Adapter for Backward Compatibility
// Converts between V1 (legacy) and V2 (advanced) message formats

import { 
  AdvancedChatMessage, 
  MessageContent, 
  MessageRole,
  MessageMetadata,
  MessageContext 
} from '../types/message.types.ts';
import { ChatMessage } from '../context_builder.ts';
import { generateMessageId, generateConversationId, generateTimestamp } from '../types/utils.ts';

/**
 * Adapter for converting between message format versions
 */
export class MessageFormatAdapter {
  /**
   * Convert legacy V1 message to advanced V2 format
   */
  static toV2(
    oldMessage: ChatMessage, 
    context?: Partial<MessageContext>
  ): Partial<AdvancedChatMessage> {
    // Extract any existing metadata from the content
    let metadata: MessageMetadata = {};
    let textContent = oldMessage.content;
    
    // Check if content has embedded metadata (some V1 messages might)
    if (oldMessage.content.includes('[METADATA:') && oldMessage.content.includes(']')) {
      const metadataMatch = oldMessage.content.match(/\[METADATA:(.*?)\]/);
      if (metadataMatch) {
        try {
          metadata = JSON.parse(metadataMatch[1]);
          textContent = oldMessage.content.replace(metadataMatch[0], '').trim();
        } catch (e) {
          console.warn('Failed to parse embedded metadata:', e);
        }
      }
    }
    
    // Create V2 message structure
    const v2Message: Partial<AdvancedChatMessage> = {
      id: generateMessageId(),
      version: '2.0.0',
      role: oldMessage.role as MessageRole,
      content: {
        type: 'text',
        text: textContent,
        tokens: Math.ceil(textContent.length / 4), // Simple estimation
      },
      timestamp: oldMessage.timestamp || generateTimestamp(),
      created_at: oldMessage.timestamp || generateTimestamp(),
      metadata: {
        ...metadata,
        migrated_from_v1: true,
        migration_timestamp: generateTimestamp(),
      },
      context: {
        conversation_id: context?.conversation_id || generateConversationId(),
        session_id: context?.session_id || generateConversationId(),
        ...context,
        agent_id: oldMessage.agentName ? context?.agent_id : undefined,
      },
    };
    
    // Add agent context if available
    if (oldMessage.agentName) {
      v2Message.metadata!.original_agent_name = oldMessage.agentName;
    }
    
    return v2Message;
  }
  
  /**
   * Convert advanced V2 message to legacy V1 format
   * Used for backward compatibility with existing clients
   */
  static toV1(newMessage: AdvancedChatMessage): ChatMessage {
    // Extract text content
    let content = '';
    
    switch (newMessage.content.type) {
      case 'text':
        content = newMessage.content.text;
        break;
      case 'structured':
        // Convert structured content to string representation
        content = JSON.stringify(newMessage.content.data, null, 2);
        break;
      case 'multimodal':
        // Extract text from multimodal content
        const textPart = newMessage.content.parts.find(p => p.type === 'text');
        content = textPart?.content || '[Multimodal content - text not available]';
        break;
      case 'tool_result':
        // Format tool result for display
        content = `Tool: ${newMessage.content.tool_name}\nResult: ${
          typeof newMessage.content.result === 'string' 
            ? newMessage.content.result 
            : JSON.stringify(newMessage.content.result, null, 2)
        }`;
        break;
      default:
        content = '[Unsupported content type]';
    }
    
    // Add metadata as embedded string if it contains important info
    if (newMessage.metadata && Object.keys(newMessage.metadata).length > 0) {
      const importantMetadata = {
        tokens: newMessage.metadata.tokens,
        processing_time_ms: newMessage.metadata.processing_time_ms,
        confidence_score: newMessage.metadata.confidence_score,
      };
      
      // Only add if there's actual data
      const hasImportantData = Object.values(importantMetadata).some(v => v !== undefined);
      if (hasImportantData) {
        content += `\n[METADATA:${JSON.stringify(importantMetadata)}]`;
      }
    }
    
    return {
      role: newMessage.role as 'user' | 'assistant' | 'system',
      content: content,
      timestamp: newMessage.timestamp,
      agentName: newMessage.context.agent_id ? 
        newMessage.metadata?.original_agent_name || 'Agent' : 
        undefined,
    };
  }
  
  /**
   * Validate if a message is V1 format
   */
  static isV1Message(message: any): message is ChatMessage {
    return (
      message &&
      typeof message === 'object' &&
      'role' in message &&
      'content' in message &&
      typeof message.content === 'string' &&
      ['user', 'assistant', 'system'].includes(message.role)
    );
  }
  
  /**
   * Validate if a message is V2 format
   */
  static isV2Message(message: any): message is AdvancedChatMessage {
    return (
      message &&
      typeof message === 'object' &&
      'version' in message &&
      message.version.startsWith('2.') &&
      'content' in message &&
      typeof message.content === 'object' &&
      'type' in message.content
    );
  }
  
  /**
   * Convert an array of messages, detecting format automatically
   */
  static convertMessages(
    messages: any[], 
    targetVersion: '1' | '2',
    context?: Partial<MessageContext>
  ): any[] {
    return messages.map(msg => {
      if (targetVersion === '2') {
        if (this.isV2Message(msg)) return msg;
        if (this.isV1Message(msg)) return this.toV2(msg, context);
        console.warn('Unknown message format, skipping:', msg);
        return null;
      } else {
        if (this.isV1Message(msg)) return msg;
        if (this.isV2Message(msg)) return this.toV1(msg);
        console.warn('Unknown message format, skipping:', msg);
        return null;
      }
    }).filter(Boolean);
  }
  
  /**
   * Merge V1 and V2 messages into a unified format
   * Useful during migration period
   */
  static mergeMessageHistories(
    v1Messages: ChatMessage[],
    v2Messages: AdvancedChatMessage[],
    preferVersion: '1' | '2' = '2'
  ): any[] {
    // Create a map of messages by timestamp
    const messageMap = new Map<string, any>();
    
    // Add V1 messages
    v1Messages.forEach(msg => {
      const timestamp = msg.timestamp || '';
      if (preferVersion === '2') {
        messageMap.set(timestamp, this.toV2(msg));
      } else {
        messageMap.set(timestamp, msg);
      }
    });
    
    // Add/override with V2 messages
    v2Messages.forEach(msg => {
      const timestamp = msg.timestamp;
      if (preferVersion === '1') {
        messageMap.set(timestamp, this.toV1(msg));
      } else {
        messageMap.set(timestamp, msg);
      }
    });
    
    // Sort by timestamp and return
    return Array.from(messageMap.values()).sort((a, b) => {
      const timeA = a.timestamp || a.created_at || '';
      const timeB = b.timestamp || b.created_at || '';
      return timeA.localeCompare(timeB);
    });
  }
}

/**
 * Simple adapter wrapper for easier instance-based usage
 */
export class MessageAdapter {
  /**
   * Convert V1 request to V2 format
   */
  v1ToV2(v1Request: any): any {
    // Support both camelCase (agentId) and snake_case (agent_id) for backward compatibility
    const agentId = v1Request.agentId || v1Request.agent_id;
    const userId = v1Request.userId || v1Request.user_id;
    const conversationId = v1Request.conversationId || v1Request.conversation_id;
    const sessionId = v1Request.sessionId || v1Request.session_id;
    const channelId = v1Request.channelId || v1Request.channel_id;
    
    // Get the last message from V1 request (the actual user message)
    const messages = v1Request.messages || [];
    const lastMessage = messages[messages.length - 1];
    
    // Create a proper V2 message
    const v2Message = lastMessage ? MessageFormatAdapter.toV2(lastMessage, {
      conversation_id: conversationId || generateConversationId(),
      session_id: sessionId || generateConversationId(),
      user_id: userId || undefined,
      agent_id: agentId || undefined,
    }) : {
      id: generateMessageId(),
      version: '2.0.0',
      role: 'user',
      content: {
        type: 'text',
        text: v1Request.message || '',
        tokens: 0,
      },
      timestamp: generateTimestamp(),
      context: {
        conversation_id: conversationId || generateConversationId(),
        session_id: sessionId || generateConversationId(),
        user_id: userId || undefined,
        agent_id: agentId || undefined,
      },
      metadata: {},
    };
    
    // Build context object, omitting null/undefined values
    const context: any = {
      agent_id: agentId || undefined,
      user_id: userId || undefined,
      conversation_id: conversationId || generateConversationId(),
      session_id: sessionId || generateConversationId(),
    };
    
    // Only include channel_id if it's not null/undefined
    if (v1Request.channelId) {
      context.channel_id = v1Request.channelId;
    }
    
    return {
      version: '2.0.0',
      message: v2Message,
      context,
      options: {
        response: {
          stream: v1Request.stream || false,
          include_metadata: true,
          include_metrics: true,
          max_tokens: v1Request.max_tokens,
        },
        memory: {
          enabled: true,
          types: ['episodic', 'semantic'],
          max_results: 10,
          min_relevance: 0.3,
        },
        state: {
          save_checkpoint: false,
          include_shared: true,
        },
        tools: {
          enabled: true,
          parallel_execution: true,
          timeout_ms: 30000,
        },
        context: {
          max_messages: v1Request.options?.context?.max_messages || 20,
          token_limit: 4000,
        },
        reasoning: {
          enabled: true,
          mode: 'summary',
          threshold: 0.6,
          max_steps: 6,
          max_tool_calls: 3,
        },
      },
    };
  }
  
  /**
   * Convert V2 response to V1 format
   */
  v2ToV1Response(v2Response: any): any {
    // Extract the actual message content for V1 compatibility
    let messageContent = '';
    
    if (v2Response.data?.message?.content) {
      const content = v2Response.data.message.content;
      if (content.type === 'text') {
        messageContent = content.text;
      } else if (typeof content === 'string') {
        messageContent = content;
      }
    } else if (v2Response.message?.content) {
      const content = v2Response.message.content;
      if (content.type === 'text') {
        messageContent = content.text;
      } else if (typeof content === 'string') {
        messageContent = content;
      }
    } else if (typeof v2Response.message === 'string') {
      messageContent = v2Response.message;
    }
    
    return {
      message: messageContent,
      agent: {
        id: v2Response.data?.message?.context?.agent_id || v2Response.message?.context?.agent_id,
        name: 'AI Assistant',
      },
      conversationId: v2Response.data?.conversation?.id || v2Response.message?.context?.conversation_id,
      sessionId: v2Response.data?.session?.id || v2Response.message?.context?.session_id,
      metrics: v2Response.metrics,
      processing_details: v2Response.processing_details, // Pass through detailed processing info
    };
  }
}