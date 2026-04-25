import { MCPTool } from './gmail-tools.types';

export const GMAIL_MCP_TOOLS: Record<string, MCPTool> = {
  send_email: {
    name: 'send_email',
    description: 'Send emails with optional attachments via Gmail',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Email body content (plain text)' },
        html: {
          type: 'string',
          description: 'Email body content (HTML format)',
          required: false,
        },
        attachments: {
          type: 'array',
          description: 'Email attachments',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              content: { type: 'string', description: 'Base64 encoded content' },
              contentType: { type: 'string' },
            },
          },
          required: false,
        },
      },
      required: ['to', 'subject', 'body'],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.send'],
  },
  read_emails: {
    name: 'read_emails',
    description: 'Read and list emails from Gmail inbox with filtering options',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Gmail search query (e.g., "is:unread", "from:example@gmail.com")',
          required: false,
        },
        max_results: {
          type: 'integer',
          description: 'Maximum number of emails to return (default: 50)',
          default: 50,
          minimum: 1,
          maximum: 500,
        },
        label_ids: {
          type: 'array',
          description: 'Array of label IDs to filter by',
          items: { type: 'string' },
          required: false,
        },
        include_body: {
          type: 'boolean',
          description: 'Whether to include email body content',
          default: false,
        },
      },
      required: [],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  },
  search_emails: {
    name: 'search_emails',
    description: 'Search emails with advanced Gmail search filters',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Advanced Gmail search query (e.g., "from:example@gmail.com has:attachment")',
        },
        labels: {
          type: 'array',
          description: 'Array of label names to filter by',
          items: { type: 'string' },
          required: false,
        },
        max_results: {
          type: 'integer',
          description: 'Maximum number of search results (default: 100)',
          default: 100,
          minimum: 1,
          maximum: 500,
        },
        date_range: {
          type: 'object',
          description: 'Date range filter',
          properties: {
            after: { type: 'string', description: 'Search after this date (YYYY-MM-DD)' },
            before: { type: 'string', description: 'Search before this date (YYYY-MM-DD)' },
          },
          required: false,
        },
      },
      required: ['query'],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  },
  manage_labels: {
    name: 'manage_labels',
    description: 'Create, modify, and delete Gmail labels',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'modify', 'delete', 'list'],
          description: 'Action to perform on labels',
        },
        label_name: {
          type: 'string',
          description: 'Name of the label to create/modify/delete',
        },
        new_label_name: {
          type: 'string',
          description: 'New name for label (modify action only)',
          required: false,
        },
        color: {
          type: 'string',
          description: 'Label color (hex code or predefined color)',
          required: false,
        },
        label_list_visibility: {
          type: 'string',
          enum: ['labelShow', 'labelHide'],
          description: 'Whether label appears in label list',
          required: false,
        },
        message_list_visibility: {
          type: 'string',
          enum: ['show', 'hide'],
          description: 'Whether label appears in message list',
          required: false,
        },
      },
      required: ['action'],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.labels'],
  },
  email_actions: {
    name: 'email_actions',
    description: 'Perform actions on Gmail emails (mark as read, archive, delete, etc.)',
    parameters: {
      type: 'object',
      properties: {
        message_ids: {
          type: 'array',
          description: 'Array of Gmail message IDs to act upon',
          items: { type: 'string' },
        },
        action: {
          type: 'string',
          enum: ['mark_read', 'mark_unread', 'archive', 'unarchive', 'delete', 'star', 'unstar'],
          description: 'Action to perform on the messages',
        },
        labels_to_add: {
          type: 'array',
          description: 'Array of label IDs to add to messages',
          items: { type: 'string' },
          required: false,
        },
        labels_to_remove: {
          type: 'array',
          description: 'Array of label IDs to remove from messages',
          items: { type: 'string' },
          required: false,
        },
      },
      required: ['message_ids', 'action'],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.modify'],
  },
};
