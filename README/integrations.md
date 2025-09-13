# Integrations & External Services

Agentopia provides comprehensive integration capabilities allowing agents to connect with external services, APIs, and tools through secure, standardized protocols.

## 📧 Email Integrations

### Gmail Integration
Complete OAuth-based Gmail integration with enterprise-grade security:

- **OAuth 2.0 with PKCE**: Secure authentication flow with Google
- **Comprehensive Scopes**: Send, read, search, modify emails with full API access
- **Vault Security**: All tokens encrypted in Supabase Vault
- **Agent Tools**: `gmail_send_email`, `gmail_read_emails`, `gmail_search_emails`

**Setup Process:**
1. Navigate to Integrations page
2. Select Gmail provider
3. Complete OAuth flow with Google
4. Assign permissions to agents via Channels modal

### Microsoft Outlook Integration
Complete Microsoft 365 integration through Microsoft Graph API:

- **Email Operations**: Send, read, search emails with attachments
- **Calendar Management**: Create events, schedule meetings, manage appointments
- **Contact Access**: Search and retrieve contacts from address books
- **Agent Tools**: `outlook_send_email`, `outlook_create_event`, `outlook_get_contacts`

### SMTP Integration
Universal SMTP server support for any email provider:

- **Provider Presets**: SMTP.com, Gmail, Outlook, Yahoo with correct settings
- **Custom Configuration**: Manual SMTP server setup for any provider
- **Secure Storage**: Passwords encrypted in Supabase Vault
- **Connection Validation**: Test SMTP settings before saving

### SendGrid Integration
API-based SendGrid integration with advanced features:

- **Email Sending**: Transactional and marketing emails
- **Template Support**: Dynamic templates with personalization
- **Analytics**: Open rates, click tracking, delivery statistics
- **Agent Inboxes**: Smart routing and auto-reply capabilities

### Mailgun Integration
Comprehensive Mailgun API integration:

- **Email Validation**: Real-time email address validation
- **Analytics**: Detailed delivery and engagement metrics
- **Inbound Routing**: Process incoming emails with smart routing
- **Agent Authorization**: Granular permission management

## 🔍 Web Research Capabilities

### Supported Providers
- **Serper API**: Fast Google search results with high accuracy
- **SerpAPI**: Comprehensive search engine results API
- **Brave Search API**: Privacy-focused search with good coverage

### Features
- **Web Search**: Query multiple search engines for relevant results
- **Page Scraping**: Extract content from web pages for analysis
- **Content Summarization**: AI-powered summarization of web content
- **Multi-Provider Support**: Seamless switching between search providers

### Setup
1. Add API keys through integrations interface
2. Keys securely stored using VaultService
3. Grant web research permissions to agents
4. Agents can search web during conversations

## 🏢 Microsoft 365 Suite

### Microsoft Teams Integration
- **Chat Integration**: Send messages to Teams channels and direct chats
- **Meeting Management**: Create and manage online meetings
- **Team Information**: Access team structures and member information
- **Real-time Collaboration**: Enable agents in team workflows

### Microsoft OneDrive Integration
- **File Operations**: Upload, download, and manage files
- **Document Sharing**: Create and manage shared links with permissions
- **Folder Management**: Organize files in structured hierarchies
- **Search Capabilities**: Find files by name, content, and metadata

## 🛠️ Universal Tool Connectivity

### Zapier MCP Integration
Access to 8,000+ applications through Zapier's Model Context Protocol:

- **Universal Connectivity**: Connect to virtually any business application
- **Per-Agent Configuration**: Each agent can have unique tool connections
- **Dynamic Tool Discovery**: Automatically discover available tools
- **Seamless Integration**: Tools work transparently with existing function calling

### MCP Protocol Support
- **JSON-RPC 2.0**: Standard protocol over Streamable HTTP transport
- **Tool Schema Conversion**: Automatic MCP → OpenAI schema transformation
- **Metadata-based Routing**: Clean function schemas with intelligent routing
- **Connection Management**: Intuitive UI for managing MCP connections

## 🔐 Security Architecture

### Credential Management
All integrations use the centralized security system:

- **Supabase Vault**: All sensitive data encrypted with AES
- **Zero Plain-Text**: No credentials stored in plain text anywhere
- **Service Role Access**: Decryption restricted to server-side functions
- **Audit Trails**: Complete logging of all credential operations

### OAuth Integration
Standardized OAuth flow for all supported providers:

- **PKCE Support**: Enhanced security for public clients
- **Token Refresh**: Automatic token renewal with re-encryption
- **Scope Management**: Granular permission control per agent
- **Connection Health**: Real-time monitoring of OAuth connections

### API Key Management
Secure handling of API-based integrations:

- **VaultService**: Centralized API for all secret operations
- **Encrypted Storage**: Keys encrypted before database storage
- **Access Control**: User-scoped access with RLS policies
- **Key Rotation**: Support for API key updates and rotation

## 🎯 Agent Permission System

### Permission Architecture
Fine-grained control over which agents can access which tools:

- **Database-Driven**: All permissions stored in `agent_integration_permissions`
- **Scope-Based**: OAuth scopes mapped to specific agent capabilities
- **Real-Time Updates**: Permission changes take effect immediately
- **Audit Trail**: Complete history of permission grants and revocations

### Tool Discovery
Dynamic tool availability based on permissions:

- **Database Queries**: Tools discovered from `integration_capabilities` table
- **Permission Validation**: Only authorized tools shown to agents
- **Namespaced Tools**: Provider-specific tool names prevent conflicts
- **Fallback Handling**: Graceful degradation when tools unavailable

## 🔧 Integration Development

### Adding New Integrations
Standard pattern for implementing new integrations:

1. **Provider Configuration**: Add to `service_providers` table
2. **OAuth/API Setup**: Implement authentication flow
3. **Tool Definition**: Define tools in `integration_capabilities`
4. **Edge Function**: Create provider-specific API handler
5. **UI Components**: Add setup and management interfaces

### Development Guidelines
- **Security First**: All credentials must use VaultService
- **Error Handling**: Implement LLM-friendly error messages
- **Type Safety**: Comprehensive TypeScript interfaces
- **Testing**: Unit and integration tests for all providers

## 📊 Current Integration Status

### ✅ Production-Ready
- **Gmail**: Complete OAuth integration with all major scopes
- **Microsoft Outlook**: Full Graph API integration with email/calendar/contacts
- **SMTP**: Universal SMTP support with secure configuration
- **SendGrid**: Complete API integration with advanced features
- **Mailgun**: Full API integration with validation and analytics
- **Web Search**: Multi-provider support with AI summarization
- **Zapier MCP**: Universal tool connectivity with 8,000+ apps

### 🔧 Technical Achievements
- **Enterprise Security**: Zero plain-text storage with vault encryption
- **Unified Architecture**: Consistent patterns across all integrations
- **Scalable Design**: Easy addition of new providers and tools
- **Performance**: Tool caching and optimized schema conversion
- **User Experience**: Intuitive setup and management interfaces

### 🚀 Future Enhancements
- **Additional Providers**: Slack, GitHub, Linear, Notion
- **Enhanced Analytics**: Integration usage and performance metrics
- **Bulk Operations**: Mass configuration and permission management
- **Advanced Workflows**: Multi-step integrations with dependencies
- **Enterprise Features**: SSO, advanced compliance, audit reporting

## 🔍 Troubleshooting

### Common Issues
1. **OAuth Failures**: Check provider credentials and redirect URLs
2. **API Key Issues**: Verify keys are valid and have required permissions
3. **Permission Errors**: Ensure agents have proper scope assignments
4. **Tool Not Available**: Check integration is active and properly configured

### Debug Tools
- **Edge Function Logs**: Monitor integration execution in Supabase Dashboard
- **Connection Testing**: Built-in tools for testing OAuth and API connections
- **Permission Validation**: Real-time scope checking and validation
- **Performance Metrics**: Execution timing and success rate monitoring

### Support Resources
- **Integration-Specific Guides**: Detailed setup instructions for each provider
- **Error Reference**: Common error codes and resolution steps
- **Best Practices**: Recommended configuration and usage patterns
- **Community Support**: Forums and documentation for troubleshooting

---

For detailed setup instructions and technical implementation details, see the specific integration guides:
- [Email Integrations](email-integrations.md) - Comprehensive email setup guide
- [Tool Infrastructure](tool-infrastructure.md) - Technical architecture details
- [Security Updates](security-updates.md) - Security implementation and compliance
