# PiAPI.ai - Comprehensive Standard Operating Procedure (SOP)

## Overview

PiAPI is a comprehensive platform offering a wide range of large-scale AI model APIs, designed to help developers easily integrate advanced AI functionalities into their applications. PiAPI provides the most complete and stable unofficial APIs for popular AI models like Midjourney, Kling, Suno, Luma Dream Machine, Flux, and many others.

**Official Documentation**: [https://piapi.ai/docs/overview](https://piapi.ai/docs/overview)

**Base API URL**: `https://api.piapi.ai/api/v1/`

## Key Features

### 1. Unified API Schema
PiAPI uses a unified API architecture with just two main endpoints:
- **Create Task**: `POST /task` - Create any AI generation task
- **Get Task**: `GET /task/{task_id}` - Retrieve task status and results

### 2. Service Options

#### Pay-as-you-go (PPU/PAYG)
- No account ownership required
- Credit-based billing system
- Access to PiAPI's account pools
- Perfect for testing and moderate usage

#### Host-your-account (HYA/BYOA)
- Connect your own AI service accounts
- Monthly seat subscription ($8-$10/month per service)
- Use your own account credits/subscriptions
- Better for high-volume usage and account control

### 3. Available APIs

| Service | Status | Pricing (PAYG) | Documentation |
|---------|--------|---------------|---------------|
| **Midjourney** | ✅ Active | $0.015-$0.10/task | [Midjourney SOP](.cursor/rules/premium/piapi/midjourney.md) |
| **Kling Video** | ✅ Active | $0.16-$1.12/video | [Kling SOP](.cursor/rules/premium/piapi/kling.md) |
| **Flux Image** | ✅ Active | Varies by model | [Flux SOP](.cursor/rules/premium/piapi/flux.md) |
| **Udio Music** | ✅ Active | $0.05/generation | [Udio SOP](.cursor/rules/premium/piapi/udio.md) |
| **Luma Dream Machine** | ✅ Active | Varies | [Luma SOP](.cursor/rules/premium/piapi/luma.md) |
| **Faceswap** | ✅ Active | Varies | [Faceswap SOP](.cursor/rules/premium/piapi/faceswap.md) |
| **LLM (GPT-4o)** | ✅ Active | Varies | [LLM SOP](.cursor/rules/premium/piapi/llm.md) |

## Authentication

All API requests require authentication using an API key in the header:

```bash
curl -H "x-api-key: YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     https://api.piapi.ai/api/v1/task
```

## Universal API Structure

### Create Task Request Format
```json
{
  "model": "service_model",
  "task_type": "operation_type", 
  "input": {
    // Service-specific parameters
  },
  "config": {
    "service_mode": "public|private", // PAYG vs HYA
    "webhook_config": {
      "endpoint": "https://your-webhook.com",
      "secret": "webhook_secret"
    }
  }
}
```

### Universal Response Format
```json
{
  "code": 200,
  "data": {
    "task_id": "uuid",
    "model": "service_model",
    "task_type": "operation_type",
    "status": "pending|processing|completed|failed|staged",
    "input": {},
    "output": {},
    "meta": {
      "created_at": "timestamp",
      "usage": {}
    },
    "logs": [],
    "error": {
      "code": 0,
      "message": ""
    }
  },
  "message": "success"
}
```

## Task Status Monitoring

### Status Types
- **pending**: Task queued for processing
- **processing**: Task currently being processed
- **completed**: Task finished successfully
- **failed**: Task failed with error
- **staged**: Task prepared but not yet processed

### Polling Example
```javascript
async function pollTaskStatus(taskId) {
  const response = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
    headers: { 'x-api-key': 'YOUR_API_KEY' }
  });
  
  const data = await response.json();
  
  if (data.data.status === 'completed') {
    return data.data.output;
  } else if (data.data.status === 'failed') {
    throw new Error(data.data.error.message);
  }
  
  // Still processing, poll again
  await new Promise(resolve => setTimeout(resolve, 5000));
  return pollTaskStatus(taskId);
}
```

## Webhook Configuration

### Setup Webhooks
Enable automatic notifications when tasks complete:

```json
{
  "config": {
    "webhook_config": {
      "endpoint": "https://your-app.com/webhook/piapi",
      "secret": "optional_webhook_secret"
    }
  }
}
```

### Webhook Payload
```json
{
  "task_id": "uuid",
  "status": "completed|failed",
  "model": "service_model",
  "task_type": "operation_type",
  "output": {},
  "error": {}
}
```

## Error Handling

### Common Error Codes
- **1100**: Invalid input parameters
- **1200**: Authentication failed
- **1300**: Insufficient credits
- **1400**: Rate limit exceeded
- **1500**: Service temporarily unavailable

### Error Response Format
```json
{
  "code": 400,
  "data": {
    "error": {
      "code": 1100,
      "message": "Invalid prompt length",
      "detail": "Prompt must be between 1-2500 characters"
    }
  },
  "message": "failed"
}
```

## Best Practices

### 1. Rate Limiting
- Respect concurrent job limits based on subscription plan
- Implement exponential backoff for failed requests
- Use webhooks instead of aggressive polling

### 2. Cost Optimization
- Choose appropriate service modes (PAYG vs HYA)
- Monitor credit usage through account APIs
- Use bulk generation services for large batches

### 3. Error Handling
- Implement retry logic with exponential backoff
- Log all API interactions for debugging
- Handle webhook delivery failures gracefully

### 4. Security
- Store API keys securely (environment variables)
- Validate webhook signatures if using secrets
- Use HTTPS for all webhook endpoints

## Account Management

### Get Account Info
```bash
curl -H "x-api-key: YOUR_API_KEY" \
     https://api.piapi.ai/api/v1/account-info
```

### List Tasks
```bash
curl -H "x-api-key: YOUR_API_KEY" \
     https://api.piapi.ai/api/v1/tasks
```

### Task History
```bash
curl -H "x-api-key: YOUR_API_KEY" \
     https://api.piapi.ai/api/v1/user-history
```

## Pricing Plans

### Free Plan
- Limited concurrent jobs
- Basic features only
- Perfect for testing

### Creator Plan ($8/month)
- Increased concurrent jobs
- Advanced features access
- Priority support

### Pro Plan ($50/month)
- Maximum concurrent jobs
- All premium features
- Bulk generation discounts

## Support Resources

- **Discord Community**: [PiAPI Discord](https://discord.gg/piapi)
- **Documentation**: [https://piapi.ai/docs](https://piapi.ai/docs)
- **Email Support**: contact@piapi.ai
- **Status Page**: Check service availability
- **Changelog**: [https://piapi.ai/docs/changelog](https://piapi.ai/docs/changelog)

## Quick Start Checklist

- [ ] Sign up for PiAPI account
- [ ] Generate API key from workspace
- [ ] Choose service mode (PAYG or HYA)
- [ ] Purchase credits or subscribe to plan
- [ ] Test with simple API call
- [ ] Configure webhooks (optional)
- [ ] Implement error handling
- [ ] Monitor usage and costs

## Integration Examples

### Node.js/JavaScript
```javascript
const axios = require('axios');

const piapi = axios.create({
  baseURL: 'https://api.piapi.ai/api/v1',
  headers: {
    'x-api-key': process.env.PIAPI_KEY,
    'Content-Type': 'application/json'
  }
});

// Create task
const task = await piapi.post('/task', requestData);
console.log('Task ID:', task.data.data.task_id);

// Get result
const result = await piapi.get(`/task/${task.data.data.task_id}`);
```

### Python
```python
import requests
import os

headers = {
    'x-api-key': os.getenv('PIAPI_KEY'),
    'Content-Type': 'application/json'
}

# Create task
response = requests.post(
    'https://api.piapi.ai/api/v1/task',
    headers=headers,
    json=request_data
)

task_id = response.json()['data']['task_id']

# Get result
result = requests.get(
    f'https://api.piapi.ai/api/v1/task/{task_id}',
    headers=headers
)
```

## Notes

- All timestamps are in UTC
- Image URLs must be publicly accessible
- Maximum file size limits vary by service
- Output URLs typically expire after 7 days
- Webhook retries happen with exponential backoff

---

*Last Updated: January 2025*
*Version: 2.0*
*Contact: PiAPI Development Team* 