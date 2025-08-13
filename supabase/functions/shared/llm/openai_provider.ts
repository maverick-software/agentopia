import OpenAI from 'npm:openai@4.28.0';
import type { LLMProvider, LLMMessage, LLMChatOptions, LLMChatResponse, LLMTool, LLMToolCall } from './interfaces.ts';

export class OpenAIProvider implements LLMProvider {
	constructor(private client: OpenAI, private defaults: { model: string } = { model: 'gpt-4o-mini' }) {}

	private toOpenAITools(tools: LLMTool[] = []) {
		return tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
	}

	async chat(messages: LLMMessage[], options: LLMChatOptions = {}): Promise<LLMChatResponse> {
		const res = await this.client.chat.completions.create({
			model: options.model || this.defaults.model,
			messages: messages as any,
			temperature: options.temperature,
			max_tokens: options.maxTokens,
			tools: this.toOpenAITools(options.tools),
			tool_choice: options.tools?.length ? 'auto' : undefined,
		});
		const choice = res.choices?.[0];
		const toolCalls = (choice?.message as any)?.tool_calls || [];
		const mappedCalls: LLMToolCall[] = toolCalls.map((tc: any) => ({ id: tc.id, name: tc.function?.name, arguments: tc.function?.arguments }));
		return {
			text: choice?.message?.content || undefined,
			toolCalls: mappedCalls.length ? mappedCalls : undefined,
			usage: res.usage ? { prompt: res.usage.prompt_tokens || 0, completion: res.usage.completion_tokens || 0, total: res.usage.total_tokens || 0 } : undefined,
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

	modelInfo(model: string) { return { maxContext: /o|128k/i.test(model) ? 128000 : 8192, supportsTools: true }; }
}


