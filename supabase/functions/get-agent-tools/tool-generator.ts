/**
 * Tool parameter generation utilities for different tool types
 */

/**
 * Generates JSON schema parameters for different tool capabilities
 */
export function generateParametersForCapability(toolName: string) {
  const baseSchema = {
    type: 'object' as const,
    properties: {} as Record<string, any>,
    required: [] as string[]
  };

  // Handle email sending tools (smtp_send_email, sendgrid_send_email, mailgun_send_email)
  if (toolName.includes('_send_email')) {
      return {
        ...baseSchema,
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body content' },
          from_name: { type: 'string', description: 'Sender name (optional)' },
          cc: { type: 'string', description: 'CC recipients (optional)' },
          bcc: { type: 'string', description: 'BCC recipients (optional)' }
        },
        required: ['to', 'subject', 'body']
      };
  }

  // Handle email template tools
  if (toolName.includes('_email_templates')) {
    return {
      ...baseSchema,
      properties: {
        template_name: { type: 'string', description: 'Template identifier' },
        to: { type: 'string', description: 'Recipient email' },
        variables: { type: 'object', description: 'Template variables' }
      },
      required: ['template_name', 'to']
    };
  }

  // Handle email stats tools
  if (toolName.includes('_email_stats')) {
    return {
      ...baseSchema,
      properties: {
        date_range: { type: 'string', description: 'Date range for statistics (e.g., "7d", "30d")' },
        metric_type: { type: 'string', description: 'Type of metrics to retrieve' }
      },
      required: []
    };
  }

  // Handle web search tools
  if (toolName.includes('web_search')) {
    return {
      ...baseSchema,
      properties: {
        query: { type: 'string', description: 'Search query' },
        num_results: { type: 'number', description: 'Number of results to return', default: 10 }
      },
      required: ['query']
    };
  }

  // Handle news search tools
  if (toolName.includes('news_search')) {
    return {
      ...baseSchema,
      properties: {
        query: { type: 'string', description: 'News search query' },
        num_results: { type: 'number', description: 'Number of results to return', default: 10 }
      },
      required: ['query']
    };
  }

  // Handle image search tools
  if (toolName.includes('image_search')) {
    return {
      ...baseSchema,
      properties: {
        query: { type: 'string', description: 'Image search query' },
        num_results: { type: 'number', description: 'Number of results to return', default: 10 }
      },
      required: ['query']
    };
  }

  // Handle OneDrive file operations
  if (toolName.includes('list_files') || toolName.includes('search_files')) {
    return {
      ...baseSchema,
      properties: {
        path: { type: 'string', description: 'Folder path to search in (optional)' },
        query: { type: 'string', description: 'Search query for files (optional)' },
        limit: { type: 'number', description: 'Maximum number of files to return', default: 50 }
      },
      required: []
    };
  }

  if (toolName.includes('download_file')) {
    return {
      ...baseSchema,
      properties: {
        file_id: { type: 'string', description: 'OneDrive file ID' },
        file_path: { type: 'string', description: 'File path in OneDrive' }
      },
      required: ['file_id']
    };
  }

  if (toolName.includes('upload_file')) {
    return {
      ...baseSchema,
      properties: {
        file_name: { type: 'string', description: 'Name of the file to upload' },
        file_content: { type: 'string', description: 'Base64 encoded file content' },
        folder_path: { type: 'string', description: 'Destination folder path (optional)' }
      },
      required: ['file_name', 'file_content']
    };
  }

  if (toolName.includes('share_file')) {
    return {
      ...baseSchema,
      properties: {
        file_id: { type: 'string', description: 'OneDrive file ID' },
        permission_type: { type: 'string', enum: ['view', 'edit'], description: 'Permission level' },
        recipient_email: { type: 'string', description: 'Email of the person to share with (optional)' }
      },
      required: ['file_id', 'permission_type']
    };
  }

  // Handle Gmail-specific capabilities
  if (toolName.includes('gmail') || toolName.includes('https://www.googleapis.com/auth/gmail')) {
    if (toolName.includes('readonly') || toolName.includes('read') || toolName.includes('search')) {
      return {
        ...baseSchema,
        properties: {
          query: { type: 'string', description: 'Search query for emails' },
          max_results: { type: 'number', description: 'Maximum number of emails to return', default: 10 }
        },
        required: ['query']
      };
    }
    
    if (toolName.includes('send')) {
      return {
        ...baseSchema,
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body content' },
          cc: { type: 'string', description: 'CC recipients (optional)' },
          bcc: { type: 'string', description: 'BCC recipients (optional)' }
        },
        required: ['to', 'subject', 'body']
      };
    }
    
    // Default Gmail tool parameters
    return {
      ...baseSchema,
      properties: {
        input: { type: 'string', description: `Gmail tool: ${toolName}` }
      },
      required: []
    };
  }

  // Handle reasoning tools
  if (toolName.startsWith('reasoning_')) {
    if (toolName === 'reasoning_execute_chain') {
      return {
        ...baseSchema,
        properties: {
          query: { type: 'string', description: 'The question or problem to analyze' },
          reasoning_style: { 
            type: 'string', 
            enum: ['inductive', 'deductive', 'abductive', 'analogical', 'causal', 'probabilistic'],
            description: 'Type of reasoning to apply' 
          },
          max_iterations: { type: 'number', description: 'Maximum reasoning iterations (default: 6)', minimum: 1, maximum: 10 },
          confidence_threshold: { type: 'number', description: 'Confidence threshold to stop reasoning (default: 0.85)', minimum: 0.1, maximum: 1.0 }
        },
        required: ['query']
      };
    } else if (toolName.includes('_inductive') || toolName.includes('_deductive') || toolName.includes('_abductive')) {
      return {
        ...baseSchema,
        properties: {
          query: { type: 'string', description: 'The question or problem to analyze' },
          context: { type: 'string', description: 'Additional context for reasoning (optional)' },
          max_steps: { type: 'number', description: 'Maximum reasoning steps (default: 4)', minimum: 1, maximum: 8 }
        },
        required: ['query']
      };
    }
  }

  // Handle Media Library tools
  if (toolName.includes('search_documents') || toolName.includes('find_related_documents')) {
    return {
      ...baseSchema,
      properties: {
        query: { type: 'string', description: 'Search query for documents' },
        limit: { type: 'number', description: 'Maximum number of documents to return', default: 10 }
      },
      required: ['query']
    };
  }

  if (toolName.includes('get_document_content')) {
    return {
      ...baseSchema,
      properties: {
        document_id: { type: 'string', description: 'Document ID to retrieve content for' }
      },
      required: ['document_id']
    };
  }

  if (toolName.includes('get_document_summary')) {
    return {
      ...baseSchema,
      properties: {
        document_id: { type: 'string', description: 'Document ID to summarize' },
        summary_length: { type: 'string', enum: ['short', 'medium', 'long'], description: 'Length of summary', default: 'medium' }
      },
      required: ['document_id']
    };
  }

  if (toolName.includes('list_assigned_documents')) {
    return {
      ...baseSchema,
      properties: {
        limit: { type: 'number', description: 'Maximum number of documents to return', default: 50 }
      },
      required: []
    };
  }

  if (toolName.includes('reprocess_document')) {
    return {
      ...baseSchema,
      properties: {
        document_id: { type: 'string', description: 'UUID of the document to reprocess (use the "id" field from list_assigned_documents)' },
        document_name: { type: 'string', description: 'Name of the document to reprocess (alternative to document_id)' },
        force_ocr: { type: 'boolean', description: 'Force OCR processing even if document appears to have good content', default: false }
      },
      required: []
    };
  }

  // Temporary Chat Links tools
  if (toolName === 'create_temporary_chat_link') {
    return {
      ...baseSchema,
      properties: {
        title: { type: 'string', description: 'Title for the temporary chat link (optional - will auto-generate if not provided)' },
        description: { type: 'string', description: 'Description of the chat purpose (optional)' },
        welcome_message: { type: 'string', description: 'Welcome message for users (optional)' },
        expires_in_hours: { type: 'number', description: 'How many hours until the link expires (default: 1 hour)', default: 1 },
        max_sessions: { type: 'number', description: 'Maximum number of chat sessions allowed (default: 1)', default: 1 },
        max_messages_per_session: { type: 'number', description: 'Maximum messages per session (default: 100)', default: 100 },
        session_timeout_minutes: { type: 'number', description: 'Session timeout in minutes (default: 60)', default: 60 },
        rate_limit_per_minute: { type: 'number', description: 'Rate limit per minute (default: 10)', default: 10 },
        allowed_domains: { type: 'array', items: { type: 'string' }, description: 'Allowed domains (optional)' },
        ui_customization: { type: 'object', description: 'UI customization options (optional)' }
      },
      required: []
    };
  }

  if (toolName === 'list_temporary_chat_links') {
    return {
      ...baseSchema,
      properties: {
        include_inactive: { type: 'boolean', description: 'Include inactive links', default: false },
        limit: { type: 'number', description: 'Maximum number of links to return', default: 20 },
        offset: { type: 'number', description: 'Number of links to skip', default: 0 }
      },
      required: []
    };
  }

  if (toolName === 'update_temporary_chat_link') {
    return {
      ...baseSchema,
      properties: {
        link_id: { type: 'string', description: 'ID of the link to update' },
        title: { type: 'string', description: 'New title (optional)' },
        description: { type: 'string', description: 'New description (optional)' },
        is_active: { type: 'boolean', description: 'Set active status (optional)' },
        max_sessions: { type: 'number', description: 'Update max sessions (optional)' }
      },
      required: ['link_id']
    };
  }

  if (toolName === 'delete_temporary_chat_link') {
    return {
      ...baseSchema,
      properties: {
        link_id: { type: 'string', description: 'ID of the link to delete' }
      },
      required: ['link_id']
    };
  }

  if (toolName === 'get_temporary_chat_analytics') {
    return {
      ...baseSchema,
      properties: {
        days_back: { type: 'number', description: 'Number of days to look back', default: 30 },
        include_session_details: { type: 'boolean', description: 'Include detailed session info', default: false }
      },
      required: []
    };
  }

  if (toolName === 'manage_temporary_chat_session') {
    return {
      ...baseSchema,
      properties: {
        session_id: { type: 'string', description: 'ID of the session to manage' },
        action: { type: 'string', enum: ['end', 'extend', 'get_status'], description: 'Action to perform' },
        extend_minutes: { type: 'number', description: 'Minutes to extend session (for extend action)' }
      },
      required: ['session_id', 'action']
    };
  }

    // Handle Contact Management tools
    if (toolName === 'search_contacts') {
      return {
        ...baseSchema,
        properties: {
          query: { 
            type: 'string', 
            description: 'Natural language search query. Examples: "list all contacts", "find contacts with numbers that start with 661", "show customers at Microsoft", "contacts with WhatsApp", "internal employees named John"' 
          },
          contact_type: { 
            type: 'string', 
            enum: ['internal', 'external', 'customer', 'vendor', 'partner', 'prospect'],
            description: 'Filter by specific contact type (optional)' 
          },
          channel_type: {
            type: 'string',
            enum: ['phone', 'mobile', 'email', 'whatsapp', 'telegram', 'slack', 'discord', 'sms'],
            description: 'Filter contacts that have a specific communication channel (optional)'
          },
          phone_pattern: {
            type: 'string',
            description: 'Search for phone numbers matching a pattern (e.g., "661" for numbers starting with 661)'
          },
          email_pattern: {
            type: 'string',
            description: 'Search for email addresses containing specific text or domain'
          },
          organization_filter: {
            type: 'string',
            description: 'Filter by organization/company name'
          },
          job_title_filter: {
            type: 'string',
            description: 'Filter by job title or role'
          },
          tags: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Filter by contact tags (optional)' 
          },
          limit: { type: 'number', description: 'Maximum number of contacts to return', default: 20 },
          offset: { type: 'number', description: 'Number of results to skip for pagination', default: 0 }
        },
        required: []
      };
    }

  if (toolName === 'get_contact_details') {
    return {
      ...baseSchema,
      properties: {
        contact_id: { type: 'string', description: 'Contact ID to retrieve details for' }
      },
      required: ['contact_id']
    };
  }

  // Default fallback for any unrecognized tool
  return {
    ...baseSchema,
    properties: {
      input: { type: 'string', description: `Input for ${toolName}` }
    },
    required: []
  };
}
