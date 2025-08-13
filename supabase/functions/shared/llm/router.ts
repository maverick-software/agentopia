import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import OpenAI from 'npm:openai@4.28.0';
import type { LLMRouter as IRouter, LLMMessage, LLMChatOptions, LLMChatResponse, AgentLLMPreferences } from './interfaces.ts';
import { OpenAIProvider } from './openai_provider.ts';

export class LLMRouter implements IRouter {
	private supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

	async resolveAgent(agentId: string): Promise<{ provider: any; prefs: AgentLLMPreferences }> {
		// Load per-agent preferences; fallback to OpenAI defaults
		const { data } = await this.supabase.from('agent_llm_preferences').select('*').eq('agent_id', agentId).maybeSingle();
		const prefs: AgentLLMPreferences = data || { provider: 'openai', model: 'gpt-4o-mini', params: {}, embedding_model: 'text-embedding-3-small' };
		if (prefs.provider === 'openai') {
			const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });
			return { provider: new OpenAIProvider(openai, { model: prefs.model }), prefs };
		}
		// Future: add other providers
		const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });
		return { provider: new OpenAIProvider(openai, { model: 'gpt-4o-mini' }), prefs };
	}

	async chat(agentId: string, messages: LLMMessage[], options: LLMChatOptions = {}): Promise<LLMChatResponse> {
		const { provider, prefs } = await this.resolveAgent(agentId);
		const merged: LLMChatOptions = { ...prefs.params, ...options, model: options.model || prefs.model } as any;
		return provider.chat(messages, merged);
	}

	stream(agentId: string, messages: LLMMessage[], options: LLMChatOptions = {}): ReadableStream<Uint8Array> {
		return undefined as any;
	}

	async embed(agentId: string, inputs: string[], modelHint?: string): Promise<number[][]> {
		const { provider, prefs } = await this.resolveAgent(agentId);
		return provider.embed(inputs, modelHint || prefs.embedding_model);
	}
}


