# Tool Calling Normalization

Goal: map provider‑specific tool/function calling to a unified internal schema.

Internal Types
```ts
export interface LLMTool { name: string; description: string; parameters: any }
export interface LLMToolCall { id: string; name: string; arguments: string }
```

Mappings
- OpenAI: tools [{type:'function', function:{name, description, parameters}}] → LLMTool; response message.tool_calls[] → LLMToolCall
- Anthropic: tools [{name, description, input_schema}] → LLMTool; content parts tool_use → LLMToolCall
- Gemini: tools.functionDeclarations[] → LLMTool; functionCall parts → LLMToolCall

Execution Contract
- Return tool results as role `tool` with `tool_call_id` before the follow‑up assistant message.
- Preserve parallel calls; execute with small concurrency caps; merge results deterministically.

Edge Cases
- Large arguments → validate and cap; truncate with note
- Tool errors → standardized error tool result with diagnostics
- Provider quirks → adapter absorbs format differences
