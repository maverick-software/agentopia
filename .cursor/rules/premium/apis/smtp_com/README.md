# SMTP.com API Documentation for Agentopia

This directory contains comprehensive documentation for integrating SMTP.com into the Agentopia platform.

## Documentation Structure

### 📚 Core Documentation

#### [smtp_com_api_documentation.mdc](./smtp_com_api_documentation.mdc)
**Complete API reference and integration guide**
- SMTP.com API v4 specifications
- Authentication methods and security
- Error handling and best practices
- Rate limiting and monitoring
- Webhook integration details

#### [agentopia_integration_guide.mdc](./agentopia_integration_guide.mdc)
**Platform-specific integration roadmap**
- Current SMTP relay implementation
- Future REST API integration plans
- Database schema extensions
- Migration strategies
- Feature comparison matrix

#### [quick_reference.mdc](./quick_reference.mdc)
**Developer quick reference**
- API endpoints and authentication
- Common request/response patterns
- Error codes and troubleshooting
- Testing and validation approaches

#### [implementation_examples.mdc](./implementation_examples.mdc)
**Practical code examples**
- Complete TypeScript implementations
- Supabase Edge Function integration
- Frontend configuration components
- Database migrations and security functions

## Current Implementation Status

### ✅ Completed Features
- **SMTP Relay Integration**: SMTP.com added to provider presets
- **Quick Setup**: Available in SMTP configuration modal
- **Standard Authentication**: Username/password support
- **Multi-port Support**: Ports 2525, 587, 8025, 25

### 🚧 Future Enhancements
- **REST API Integration**: Enhanced features and tracking
- **Webhook Support**: Real-time delivery notifications
- **Advanced Analytics**: Open/click tracking
- **Dual Mode Support**: Choice between SMTP relay and REST API

## Integration Overview

SMTP.com provides two integration methods:

### 1. SMTP Relay (Current)
```typescript
{
  name: 'smtpcom',
  displayName: 'SMTP.com',
  host: 'smtp.smtp.com',
  port: 2525,
  secure: false,
  description: 'SMTP.com Professional Email Service',
  authType: 'password',
  setupInstructions: 'Use your SMTP.com username and password. Alternative ports: 587, 8025, 25'
}
```

### 2. REST API (Planned)
```typescript
// Enhanced configuration with API support
interface SMTPComConfiguration {
  use_api: boolean;
  api_key_vault_id?: string;
  api_endpoint: string;
  tracking_enabled: boolean;
  webhook_url?: string;
}
```

## Key Features

### 🔐 Security
- **Secure Credential Storage**: Supabase Vault integration
- **Multiple Authentication**: Username/password and API key support
- **RLS Policies**: Row-level security for configurations
- **Audit Logging**: Complete operation tracking

### 📊 Monitoring
- **Delivery Tracking**: Success/failure monitoring
- **Rate Limit Handling**: Automatic backoff strategies
- **Error Categorization**: Detailed error analysis
- **Performance Metrics**: Response time tracking

### 🛠 Developer Experience
- **Type Safety**: Complete TypeScript definitions
- **Error Handling**: Comprehensive error management
- **Testing Tools**: Connection validation utilities
- **Documentation**: Extensive code examples

## Getting Started

### For Users
1. Navigate to **Integrations** page
2. Find **SMTP** in the integration list
3. Click **Add Credentials**
4. Select **SMTP.com** from the provider dropdown
5. Enter your SMTP.com credentials
6. Test and save the configuration

### For Developers
1. Review the [API Documentation](./smtp_com_api_documentation.mdc)
2. Check [Implementation Examples](./implementation_examples.mdc)
3. Follow the [Integration Guide](./agentopia_integration_guide.mdc)
4. Use the [Quick Reference](./quick_reference.mdc) during development

## API Reference Links

- **Official SMTP.com API**: [https://www.smtp.com/resources/api-documentation/](https://www.smtp.com/resources/api-documentation/)
- **JSend Specification**: [https://github.com/omniti-labs/jsend](https://github.com/omniti-labs/jsend)
- **SMTP.com Support**: Available through customer portal

## Configuration Examples

### Basic SMTP Setup
```typescript
const smtpConfig = {
  connection_name: 'Production SMTP.com',
  host: 'smtp.smtp.com',
  port: 2525,
  secure: false,
  username: 'your-username',
  password: 'your-password',
  from_email: 'noreply@yourdomain.com',
  from_name: 'Your App Name'
};
```

### API Integration (Future)
```typescript
const apiConfig = {
  connection_name: 'SMTP.com API',
  use_api: true,
  api_endpoint: 'https://api.smtp.com/v4',
  api_key: 'your-api-key', // Stored in Vault
  tracking_enabled: true,
  webhook_url: 'https://yourapp.com/webhooks/smtp-com'
};
```

## Testing

### Connection Testing
```bash
# Test SMTP connection
curl -X POST https://your-app.com/api/smtp/test \
  -H "Content-Type: application/json" \
  -d '{"provider": "smtp_com", "config_id": "uuid"}'

# Test API connection (future)
curl -X GET https://api.smtp.com/v4/account \
  -H "X-SMTPCOM-API: your-api-key"
```

### Email Sending Test
```typescript
// Send test email
const result = await sendEmail({
  smtp_config_id: 'your-config-id',
  to: 'test@example.com',
  subject: 'Test Email',
  text_body: 'This is a test email from SMTP.com integration'
});
```

## Support

### Documentation Issues
- Create issues in the Agentopia repository
- Reference specific documentation files
- Include code examples when relevant

### SMTP.com Issues
- Contact SMTP.com support directly
- Check their status page for service issues
- Review their official documentation

### Integration Questions
- Review the implementation examples
- Check the troubleshooting sections
- Consult the quick reference guide

---

**Last Updated**: January 2025  
**API Version**: SMTP.com API v4  
**Agentopia Version**: Current  

*This documentation is maintained as part of the Agentopia platform's integration system.*
