import OpenAI from 'npm:openai@6.1.0';
import type { LLMProvider, LLMMessage, LLMChatOptions, LLMChatResponse, LLMTool, LLMToolCall } from './interfaces.ts';

export class OpenAIProvider implements LLMProvider {
	private apiKey: string;
	private baseURL: string = 'https://api.openai.com/v1';

	constructor(private client: OpenAI, private defaults: { model: string } = { model: 'gpt-4o-mini' }) {
		// Extract API key from client for direct API calls
		this.apiKey = (client as any).apiKey || '';
	}

	private toResponsesTools(tools: LLMTool[] = []) {
		// Responses API uses internally-tagged format (no nested 'function' object)
		return tools.map(t => {
			// Ensure parameters meet strict mode requirements
			const parameters = { ...t.parameters };
			
			// Add additionalProperties: false if not present
			if (!parameters.hasOwnProperty('additionalProperties')) {
				parameters.additionalProperties = false;
			}
			
			// Ensure required array includes all properties when in strict mode
			if (parameters.properties && typeof parameters.properties === 'object') {
				const allPropertyKeys = Object.keys(parameters.properties);
				if (!parameters.required || !Array.isArray(parameters.required)) {
					// If no required array, make all properties required for strict mode
					parameters.required = allPropertyKeys;
				} else {
					// Ensure required includes all properties
					parameters.required = allPropertyKeys;
				}
			}
			
			return {
				type: 'function', 
				name: t.name, 
				description: t.description, 
				parameters: parameters,
				strict: true // Functions are strict by default in Responses API
			};
		});
	}

	private prepareInput(messages: LLMMessage[]): { instructions?: string; input: any } {
		// Separate system messages (instructions) from user/assistant messages
		const systemMessages = messages.filter(m => m.role === 'system');
		const otherMessages = messages.filter(m => m.role !== 'system');

		// Combine system messages into instructions
		const instructions = systemMessages.length > 0 
			? systemMessages.map(m => m.content).join('\n') 
			: undefined;

		// If only one user message and no conversation history, use string input
		if (otherMessages.length === 1 && otherMessages[0].role === 'user') {
			return { instructions, input: otherMessages[0].content };
		}

		// Otherwise use array of items
		return { instructions, input: otherMessages };
	}

	async chat(messages: LLMMessage[], options: LLMChatOptions = {}): Promise<LLMChatResponse> {
		const { instructions, input } = this.prepareInput(messages);
		const model = options.model || this.defaults.model;
		
		// Build Responses API request
		const requestBody: any = {
			model,
			input,
			store: false, // Disable storage for privacy
		};

		if (instructions) {
			requestBody.instructions = instructions;
		}

		// Temperature is not supported for reasoning models (GPT-5, GPT-4.1, etc.)
		// Only add temperature for non-reasoning models
		const isReasoningModel = model.startsWith('gpt-5') || model.startsWith('gpt-4.1');
		if (options.temperature !== undefined && !isReasoningModel) {
			requestBody.temperature = options.temperature;
		}

		if (options.maxTokens) {
			requestBody.max_output_tokens = options.maxTokens;
		}

		if (options.tools && options.tools.length > 0) {
			requestBody.tools = this.toResponsesTools(options.tools);
		}

		if (options.previousResponseId) {
			requestBody.previous_response_id = options.previousResponseId;
		}

		// Call Responses API directly via fetch (responses.create may not be available in all SDK versions)
		const response = await fetch(`${this.baseURL}/responses`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const errorBody = await response.text();
			console.error('[OpenAI Responses API Error]', { status: response.status, body: errorBody });
			throw new Error(`OpenAI Responses API error: ${response.status} - ${errorBody}`);
		}

		const res = await response.json();

		// Parse output items
		let text: string | undefined;
		const toolCalls: LLMToolCall[] = [];

		for (const item of res.output || []) {
			if (item.type === 'message') {
				// Extract text from message content
				for (const contentBlock of item.content || []) {
					if (contentBlock.type === 'output_text') {
						text = contentBlock.text;
					}
				}
			} else if (item.type === 'function_call') {
				// Extract function calls
				toolCalls.push({
					id: item.call_id,
					name: item.name,
					arguments: JSON.stringify(item.arguments),
				});
			}
		}

		// Build response
		return {
			text: text || undefined,
			toolCalls: toolCalls.length ? toolCalls : undefined,
			usage: res.usage ? { 
				prompt: res.usage.input_tokens || 0, 
				completion: res.usage.output_tokens || 0, 
				total: (res.usage.input_tokens || 0) + (res.usage.output_tokens || 0) 
			} : undefined,
			responseId: res.id, // Store response ID for multi-turn conversations
		};
	}

	stream(messages: LLMMessage[], options: LLMChatOptions = {}) {
		// Delegate to SDK stream() when available; otherwise return undefined to use non-stream pathway
		// For now, we rely on existing SSE infra in the chat function; this can be filled later as needed.
		return undefined as any;
	}

	async embed(inputs: string[], modelHint?: string): Promise<number[][]> {
		const mdl = modelHint || 'text-embedding-3-small';
		const resp = await this.client.embeddings.create({ model: mdl as any, input: inputs as any });
		return (resp.data || []).map((d: any) => d.embedding as number[]);
	}

	async countTokens(): Promise<number> { return 0; }

	modelInfo(model: string) { 
		// GPT-5 models have 200k context
		if (model.startsWith('gpt-5')) {
			return { maxContext: 200000, supportsTools: true };
		}
		// GPT-4.1 and GPT-4o models have 128k context
		if (model.startsWith('gpt-4')) {
			return { maxContext: 128000, supportsTools: true };
		}
		// GPT-3.5 has 16k context
		if (model.startsWith('gpt-3.5')) {
			return { maxContext: 16385, supportsTools: true };
		}
		// Default fallback
		return { maxContext: 8192, supportsTools: true };
	}
}


