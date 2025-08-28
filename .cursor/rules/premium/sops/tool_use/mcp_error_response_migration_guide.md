# MCP-Style Error Response Migration Guide

## Overview

This guide helps developers migrate existing tool integrations to use Agentopia's **LLM-Friendly Error Response System**. This system converts technical errors into interactive questions that enable automatic retry and improved user experience.

## Migration Priority

### 🚨 High Priority: User-Facing Tools
- Email tools (Gmail, SMTP, SendGrid, Mailgun)  
- Search tools (Web search, news, scraping)
- Communication tools (Slack, Discord)
- Document tools (Google Docs, file operations)

### 🟡 Medium Priority: Developer Tools  
- Code repositories (GitHub, GitLab)
- Deployment tools (DigitalOcean, AWS)
- Monitoring tools (analytics, logging)

### 🟢 Low Priority: Internal Tools
- System diagnostics
- Administrative functions
- Debug utilities

## Before vs After Examples

### Email Tool Migration

#### ❌ Before (Technical Errors)
```typescript
// OLD: Technical error messages
if (!params.to) {
  throw new Error('Missing required parameter: to');
}

if (!params.subject) {
  throw new Error('Subject parameter is required');  
}

if (authError) {
  throw new Error('Authentication failed: ' + authError.message);
}

if (response.status === 400) {
  throw new Error('HTTP 400: Bad Request');
}
```

#### ✅ After (LLM-Friendly Errors)
```typescript
// NEW: Interactive questions that guide the LLM
if (!params.to) {
  throw new Error('Question: Who should I send this email to? Please provide the recipient email address.');
}

if (!params.subject) {
  throw new Error('Question: What should be the subject line of this email?');
}

if (authError) {
  throw new Error('Question: Your email service needs to be set up. Please ensure your email integration is properly configured with valid credentials.');
}

if (response.status === 400) {
  const errorDetails = await response.json();
  throw new Error(`Question: There seems to be an issue with the email parameters. Please check that the recipient email address is valid and all required fields are provided. Details: ${errorDetails.message || 'Invalid request format'}`);
}
```

### Search Tool Migration

#### ❌ Before (Technical Errors)
```typescript
// OLD: Unhelpful technical messages
if (!query) {
  throw new Error('Query parameter is required');
}

if (!apiKey) {
  throw new Error('API key not found');
}

if (response.status === 401) {
  throw new Error('Unauthorized');
}
```

#### ✅ After (LLM-Friendly Errors)
```typescript
// NEW: Interactive questions with context
if (!query || query.trim() === '') {
  throw new Error('Question: What would you like me to search for? Please provide a search query or topic.');
}

if (!apiKey) {
  if (wasEncryptedButCorrupt) {
    throw new Error('Question: Your search API key appears to be corrupted. Please delete and re-add your search credentials in the integration settings.');
  } else {
    throw new Error('Question: No search API key found. Please add your web search API key in the integration settings before I can perform searches.');
  }
}

if (response.status === 401) {
  throw new Error('Question: Your search API key seems to be invalid. Please check your search integration settings and update your API key if needed.');
}
```

## Migration Steps

### Step 1: Identify Error Points

Scan your integration for these common error patterns:

```bash
# Search for technical error patterns in your code
grep -r "throw new Error" your-integration/
grep -r "Missing.*parameter" your-integration/
grep -r "HTTP [0-9]" your-integration/
grep -r "required.*parameter" your-integration/
grep -r "Authentication.*failed" your-integration/
```

### Step 2: Categorize Errors

Group errors into categories:

1. **Missing Parameters**: Required data not provided
2. **Authentication Issues**: API keys, tokens, credentials problems
3. **Invalid Data**: Malformed inputs, constraint violations
4. **Service Configuration**: Setup, connection, configuration issues
5. **External API Errors**: Third-party service failures

### Step 3: Apply Error Templates

Use these templates for each category:

#### Missing Parameters Template
```typescript
// Template: "Question: What [parameter] should I [action]? Please provide [specific requirement]."

if (!requiredParam) {
  throw new Error('Question: What [parameter description] should I use? Please provide [specific format/requirements].');
}
```

#### Authentication Template  
```typescript
// Template: "Question: Your [service] needs to be set up. Please [specific action]."

if (!authValid) {
  throw new Error('Question: Your [service name] needs to be set up. Please [specific setup instructions].');
}
```

#### Invalid Data Template
```typescript
// Template: "Question: There seems to be an issue with [parameter]. Please [corrective action]."

if (!validFormat) {
  throw new Error('Question: There seems to be an issue with the [parameter name]. Please [format requirements].');
}
```

#### Service Configuration Template
```typescript
// Template: "Question: The [service] service needs to be configured. Please [setup instructions]."

if (!serviceConfigured) {
  throw new Error('Question: The [service name] service needs to be configured. Please [configuration steps].');
}
```

### Step 4: Test Retry Behavior

Verify your errors trigger the retry mechanism:

1. **Interactive Pattern Check**: Errors should contain "Question:", "What", "Please provide", or "Missing"
2. **Retry Test**: Simulate missing parameters to verify retry attempts
3. **Success Test**: Confirm retry succeeds when LLM provides correct parameters

```typescript
// Test that your error triggers retry
const testError = "Question: What email address should I use?";
const triggersRetry = testError.toLowerCase().includes('question:');
console.log('Triggers retry:', triggersRetry); // Should be true
```

### Step 5: Update Edge Function

Apply changes to your edge function:

```typescript
// Example migration for a generic tool
export default async function handler(req: Request) {
  try {
    const { action, parameters, agent_id } = await req.json();
    
    // OLD: Technical validation
    // if (!action || !parameters || !agent_id) {
    //   throw new Error('Missing required parameters');
    // }
    
    // NEW: LLM-friendly validation
    if (!action) {
      throw new Error('Question: What action would you like me to perform? Please specify the operation you need.');
    }
    
    if (!agent_id) {
      throw new Error('Missing agent context. Please retry with proper agent identification.');
    }
    
    if (!parameters) {
      throw new Error('Question: What parameters should I use for this operation? Please provide the required information.');
    }
    
    // Tool-specific validation
    if (action === 'create_document') {
      if (!parameters.title) {
        throw new Error('Question: What should be the title of the document?');
      }
      
      if (!parameters.content) {
        throw new Error('Question: What content should I include in the document? Please provide the text you want me to write.');
      }
    }
    
    // API call with enhanced error handling
    const response = await fetch(externalAPI, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(parameters)
    });
    
    if (!response.ok) {
      // OLD: Generic HTTP error
      // throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
      // NEW: Context-aware error handling
      if (response.status === 401) {
        throw new Error('Question: Your API authentication seems to be invalid. Please check your integration settings and update your API key if needed.');
      } else if (response.status === 400) {
        const errorDetails = await response.json();
        throw new Error(`Question: There seems to be an issue with the request parameters. Please check that all required information is provided correctly. Details: ${errorDetails.message || 'Invalid request format'}`);
      } else if (response.status === 403) {
        throw new Error('Question: You don\'t have permission to perform this action. Please check your account permissions and integration settings.');
      } else {
        throw new Error(`Question: The ${serviceName} service is currently having issues. Please try again in a few minutes, or check if the service is operational.`);
      }
    }
    
    const result = await response.json();
    
    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[Tool] Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'An unexpected error occurred'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

## Quality Assurance Checklist

### ✅ Error Message Quality
- [ ] Starts with "Question:" for parameter issues
- [ ] Uses natural language, not technical jargon
- [ ] Provides specific guidance on what to provide
- [ ] Includes context about why information is needed
- [ ] Offers actionable steps for resolution

### ✅ Retry Compatibility  
- [ ] Errors trigger retry mechanism (test with debug logs)
- [ ] LLM can provide correct parameters based on error guidance
- [ ] Retries succeed when parameters are complete
- [ ] No infinite retry loops

### ✅ User Experience
- [ ] Errors feel conversational, not technical
- [ ] Users get helpful guidance, not cryptic messages  
- [ ] Success rate improves with retries
- [ ] Failed attempts provide clear next steps

### ✅ Technical Implementation
- [ ] Error messages are consistent with service type
- [ ] Authentication errors guide to integration settings
- [ ] Parameter errors specify exact requirements
- [ ] API errors provide meaningful context

## Integration-Specific Guidelines

### Email Integrations (Gmail, SMTP, SendGrid)
```typescript
// Focus on: recipient, subject, content, authentication
if (!recipient) {
  throw new Error('Question: Who should I send this email to? Please provide the recipient email address.');
}
```

### Search Integrations (Web Search, News, Scraping)  
```typescript
// Focus on: query, URLs, API keys, search parameters
if (!searchQuery) {
  throw new Error('Question: What would you like me to search for? Please provide a search query or topic.');
}
```

### Document Integrations (Google Docs, File Operations)
```typescript  
// Focus on: file content, file paths, permissions, formatting
if (!documentContent) {
  throw new Error('Question: What content should I include in the document? Please provide the text you want me to write.');
}
```

### Communication Integrations (Slack, Discord)
```typescript
// Focus on: channels, messages, recipients, permissions
if (!channelId && !channelName) {
  throw new Error('Question: Which channel should I send this message to? Please specify the channel name or ID.');
}
```

## Testing Your Migration

### 1. Manual Testing
```bash
# Test missing parameters
curl -X POST your-function-url \
  -H "Content-Type: application/json" \
  -d '{"action": "send_email", "agent_id": "test"}'
  
# Expected: "Question: What email details..." error that triggers retry
```

### 2. Integration Testing
- Deploy your updated function
- Test through the chat interface
- Verify retry attempts happen automatically
- Confirm success on retry with correct parameters

### 3. Performance Testing  
- Monitor retry success rates
- Track user satisfaction with error messages
- Measure time to resolution for common issues

## Common Pitfalls

### ❌ Don't Do This
```typescript
// Too technical
throw new Error('ValidationError: email.to is undefined');

// Too generic  
throw new Error('Something went wrong');

// No guidance
throw new Error('Invalid input');

// HTTP status codes
throw new Error('HTTP 400: Bad Request');
```

### ✅ Do This Instead
```typescript  
// Interactive and helpful
throw new Error('Question: Who should I send this email to? Please provide the recipient email address.');

// Specific and actionable  
throw new Error('Question: Your Gmail authentication has expired. Please reconnect your Gmail account in the integration settings.');

// Contextual guidance
throw new Error('Question: There seems to be an issue with the email address format. Please check that the recipient email address is valid and follows the format user@domain.com.');
```

## Success Metrics

Track these metrics to measure migration success:

1. **Retry Success Rate**: >60% of retries should succeed
2. **User Error Resolution**: >80% fewer support tickets for parameter issues
3. **Interactive Error Rate**: >80% of errors should use question format
4. **Time to Success**: Reduced time from error to successful completion

## Getting Help

If you need assistance with migration:

1. **Review Examples**: Check `gmail-api` and `web-search-api` functions for reference implementations
2. **Test Retry Logic**: Use chat interface to verify retry behavior  
3. **Check Logs**: Monitor edge function logs for error patterns
4. **Validate Templates**: Ensure errors match the recommended templates

The goal is to make every tool failure feel like a natural part of the conversation, not a technical breakdown. When done correctly, users shouldn't even realize retries are happening - they'll just experience tools that "understand" what they need and ask the right questions to get there.
