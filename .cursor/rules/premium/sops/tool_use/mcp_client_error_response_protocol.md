# MCP Client Error Response Protocol

## Overview

This document defines the **Model Context Protocol (MCP) Error Response Standard** used by Agentopia to enable intelligent retry mechanisms. This protocol ensures that MCP clients (like Agentopia's chat system) can automatically recover from tool failures through conversational error messages.

## Protocol Specification

### Error Response Format

MCP servers should return structured error responses that trigger intelligent retry behavior in MCP clients:

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "error": {
    "code": -32603,
    "message": "Question: Who should I send this email to? Please provide the recipient email address.",
    "data": {
      "retry_capable": true,
      "error_category": "missing_parameter",
      "required_parameter": "to",
      "tool_name": "send_email"
    }
  }
}
```

### Interactive Error Message Patterns

#### **🎯 Core Pattern: Question-Response Flow**

MCP servers should return error messages that feel like natural conversation rather than technical exceptions:

**✅ Recommended Patterns:**
- `"Question: [What/Who/Which/Where/How] [specific need]? Please provide [exact requirement]."`
- `"Please provide [missing information] so I can [action]."`  
- `"What [parameter] would you like me to use for [action]?"`

**❌ Avoid These Patterns:**
- Technical error codes without context
- Generic "invalid parameter" messages  
- HTTP status codes as user-facing errors
- Internal system exceptions

### Error Categories

#### **1. Missing Parameters (`missing_parameter`)**

**Purpose**: Request specific required parameters from the user

**Format**: `"Question: What [parameter description] should I [action]? Please provide [specific requirements]."`

**Examples**:
```json
{
  "message": "Question: Who should I send this email to? Please provide the recipient email address.",
  "data": {
    "error_category": "missing_parameter",
    "required_parameter": "to",
    "parameter_type": "email_address"
  }
}

{
  "message": "Question: What should be the subject line of this email?",
  "data": {
    "error_category": "missing_parameter", 
    "required_parameter": "subject",
    "parameter_type": "string"
  }
}

{
  "message": "Question: What message content should I include in the email body?",
  "data": {
    "error_category": "missing_parameter",
    "required_parameter": "body", 
    "parameter_type": "text"
  }
}
```

#### **2. Authentication Issues (`authentication_required`)**

**Purpose**: Guide user to resolve authentication/credential problems

**Format**: `"Question: Your [service] needs to be set up. Please [specific setup action]."`

**Examples**:
```json
{
  "message": "Question: Your Gmail service needs to be set up. Please ensure your Gmail integration is properly configured with valid credentials.",
  "data": {
    "error_category": "authentication_required",
    "service": "gmail",
    "setup_url": "/integrations/gmail"
  }
}

{
  "message": "Question: Your search API key appears to be corrupted. Please delete and re-add your search credentials in the integration settings.",
  "data": {
    "error_category": "authentication_required",
    "service": "web_search", 
    "action_required": "reconfigure_credentials"
  }
}
```

#### **3. Invalid Data (`invalid_parameter`)**

**Purpose**: Request correctly formatted data when validation fails

**Format**: `"Question: There seems to be an issue with [parameter]. Please [corrective action]."`

**Examples**:
```json
{
  "message": "Question: There seems to be an issue with the email address format. Please check that the recipient email address is valid and follows the format user@domain.com.",
  "data": {
    "error_category": "invalid_parameter",
    "parameter": "email_address",
    "expected_format": "user@domain.com",
    "provided_value": "[REDACTED]"
  }
}

{
  "message": "Question: There seems to be an issue with the search parameters. Please provide a clear search query or valid URLs to scrape.",
  "data": {
    "error_category": "invalid_parameter",
    "parameter": "search_query",
    "validation_error": "empty_or_malformed"
  }
}
```

#### **4. Service Configuration (`service_configuration`)**

**Purpose**: Guide user through service setup or configuration issues

**Format**: `"Question: The [service] service needs to be configured. Please [configuration steps]."`

**Examples**:
```json
{
  "message": "Question: The search service needs to be configured. Please add your web search API key in the integration settings.",
  "data": {
    "error_category": "service_configuration",
    "service": "web_search",
    "configuration_required": "api_key",
    "setup_url": "/integrations/search"
  }
}
```

## MCP Client Retry Behavior

### Automatic Retry Detection

MCP clients should detect retry-capable errors using these patterns:

```typescript
// Error message pattern detection
function isRetryCapableError(error: MCPError): boolean {
  const message = error.message?.toLowerCase() || '';
  
  return message.includes('question:') ||
         message.includes('what ') ||
         message.includes('please provide') ||
         message.includes('which ') ||
         message.includes('how ') ||
         message.includes('missing') ||
         error.data?.retry_capable === true;
}
```

### Retry Enhancement Process

When a retry-capable error is detected, MCP clients should:

1. **Add System Context**: Inject guidance about the error
2. **Increase Temperature**: Enhance creativity for parameter generation (0.5 → 0.7)
3. **Provide Error Context**: Include the error message in the retry prompt
4. **Limit Attempts**: Maximum 3 retry attempts to prevent infinite loops

```typescript
// MCP client retry implementation
const MAX_RETRY_ATTEMPTS = 3;
let retryAttempts = 0;

while (toolsNeedingRetry.length > 0 && retryAttempts < MAX_RETRY_ATTEMPTS) {
  retryAttempts++;
  
  // Add system guidance based on error
  messages.push({
    role: 'system',
    content: `The previous tool call needs additional information. Based on the error message, please provide the missing parameters. Error: ${error.message}`
  });
  
  // Retry with enhanced parameters
  const retryResponse = await llmClient.chat({
    messages,
    tools: availableTools,
    temperature: 0.7, // Increased for creativity
    tool_choice: 'auto'
  });
}
```

## Implementation Examples

### MCP Server Response (Zapier Style)

```json
{
  "jsonrpc": "2.0", 
  "id": 123,
  "error": {
    "code": -32603,
    "message": "Question: What document content would you like me to create? Please provide the text content for the new document.",
    "data": {
      "retry_capable": true,
      "error_category": "missing_parameter",
      "tool_name": "create_document",
      "required_parameters": ["content"],
      "optional_parameters": ["title", "format"],
      "guidance": "Document creation requires content. You can also specify a title and format (markdown, plain text, etc.)."
    }
  }
}
```

### Edge Function Response (Agentopia Style)

```json
{
  "success": false,
  "error": "Question: What would you like me to search for? Please provide a search query or topic.", 
  "metadata": {
    "tool_name": "web_search",
    "error_category": "missing_parameter",
    "retry_capable": true,
    "required_parameter": "query"
  }
}
```

### WebSocket MCP Message

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": 42,
  "params": {
    "name": "send_email",
    "arguments": {}
  }
}

// Response
{
  "jsonrpc": "2.0", 
  "id": 42,
  "error": {
    "code": -32602,
    "message": "Question: Who should I send this email to? Please provide the recipient email address.",
    "data": {
      "retry_capable": true,
      "missing_parameters": ["to", "subject", "body"]
    }
  }
}
```

## Best Practices for MCP Server Development

### ✅ DO: Create Conversational Errors

```typescript
// Good: Natural language that guides the user
if (!recipientEmail) {
  return {
    error: {
      code: -32602,
      message: "Question: Who should I send this email to? Please provide the recipient email address.",
      data: {
        retry_capable: true,
        parameter: "to",
        type: "email_address"
      }
    }
  };
}
```

### ❌ DON'T: Return Technical Errors

```typescript
// Bad: Technical errors that don't help the user
if (!recipientEmail) {
  return {
    error: {
      code: -32602,
      message: "Invalid parameters: 'to' is required",
      data: {
        parameter: "to"
      }
    }
  };
}
```

### Error Message Quality Guidelines

1. **Be Conversational**: Write as if talking to a person, not a machine
2. **Be Specific**: Tell exactly what information is needed
3. **Provide Context**: Explain why the information is necessary
4. **Guide Resolution**: Include actionable steps when possible
5. **Use Questions**: Frame missing parameters as questions

### Parameter Validation Template

```typescript
function validateEmailParameters(params: any): MCPError | null {
  // Check for recipient
  if (!params.to || params.to.trim() === '') {
    return {
      code: -32602,
      message: "Question: Who should I send this email to? Please provide the recipient email address.",
      data: {
        retry_capable: true,
        error_category: "missing_parameter",
        required_parameter: "to",
        parameter_type: "email_address"
      }
    };
  }
  
  // Check for subject
  if (!params.subject || params.subject.trim() === '') {
    return {
      code: -32602,
      message: "Question: What should be the subject line of this email?",
      data: {
        retry_capable: true,
        error_category: "missing_parameter", 
        required_parameter: "subject",
        parameter_type: "string"
      }
    };
  }
  
  // Check for body
  if (!params.body || params.body.trim() === '') {
    return {
      code: -32602,
      message: "Question: What message content should I include in the email body?",
      data: {
        retry_capable: true,
        error_category: "missing_parameter",
        required_parameter: "body",
        parameter_type: "text"
      }
    };
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(params.to)) {
    return {
      code: -32602,
      message: "Question: There seems to be an issue with the email address format. Please check that the recipient email address is valid and follows the format user@domain.com.",
      data: {
        retry_capable: true,
        error_category: "invalid_parameter",
        parameter: "to",
        expected_format: "user@domain.com"
      }
    };
  }
  
  return null; // No errors
}
```

## Integration Testing

### Testing Retry Behavior

```bash
# Test 1: Missing parameters should trigger retry
curl -X POST http://mcp-server/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "send_email", "arguments": {}}'

# Expected: Interactive error message with retry_capable: true
```

### Validating Error Responses  

```typescript
// Test that errors trigger retry mechanism
function testErrorTriggersRetry(errorMessage: string): boolean {
  const triggersRetry = errorMessage.toLowerCase().includes('question:') ||
                       errorMessage.toLowerCase().includes('please provide') ||
                       errorMessage.toLowerCase().includes('what ') ||
                       errorMessage.toLowerCase().includes('missing');
                       
  return triggersRetry;
}

// Test cases
console.log(testErrorTriggersRetry("Question: Who should I send this to?")); // true
console.log(testErrorTriggersRetry("ValidationError: missing parameter")); // false
```

## Success Metrics

Track these metrics to ensure effective MCP error responses:

1. **Retry Success Rate**: >60% of retries should succeed on second attempt
2. **Interactive Error Rate**: >80% of errors should use question format  
3. **User Resolution Time**: Faster resolution with guided errors
4. **Support Ticket Reduction**: Fewer manual intervention requests

## Compatibility with MCP Clients

This protocol is designed to be compatible with:

- **Agentopia Chat System**: Native support for retry mechanism
- **Claude MCP Clients**: Questions trigger natural parameter collection  
- **Custom MCP Clients**: Easy to implement retry detection
- **MCP Development Tools**: Standard error format for debugging

## Future Protocol Extensions

Planned enhancements to the error response protocol:

1. **Contextual Learning**: Errors that adapt based on previous failures
2. **Multi-Parameter Guidance**: Single errors that request multiple parameters
3. **Progressive Disclosure**: Errors that reveal information gradually
4. **User Preference Integration**: Customizable error verbosity levels

## Conclusion

The MCP Client Error Response Protocol transforms tool failures from technical breakdowns into conversational opportunities. By following these guidelines, MCP servers can provide the same seamless, intelligent experience that users expect from high-quality AI interactions.

**Key Principle**: Every error should feel like a helpful assistant asking for clarification, not a system reporting a failure.
