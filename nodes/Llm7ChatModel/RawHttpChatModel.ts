import * as https from 'https';
import * as http from 'http';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseChatModelParams } from '@langchain/core/language_models/chat_models';
import type { BaseMessage } from '@langchain/core/messages';
import { AIMessage, HumanMessage, SystemMessage, ChatMessage, ToolMessage } from '@langchain/core/messages';
import type { ChatResult, ChatGeneration } from '@langchain/core/outputs';
import type { BindToolsInput } from '@langchain/core/language_models/chat_models';

interface RawHttpChatModelFields extends BaseChatModelParams {
	baseUrl: string;
	apiKey: string;
	model: string;
	temperature?: number;
	maxTokens?: number;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	timeout?: number;
}

interface Llm7ToolCall {
	id: string;
	type: 'function';
	function: { name: string; arguments: string };
}

interface Llm7Choice {
	index: number;
	message: {
		role: string;
		content: string | null;
		tool_calls?: Llm7ToolCall[];
	};
	finish_reason: string;
}

interface Llm7ApiResponse {
	id: string;
	model: string;
	choices: Llm7Choice[];
	usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface ToolDefinition {
	type: 'function';
	function: { name: string; description: string; parameters: Record<string, unknown> };
}

function messageToApi(msg: BaseMessage): Record<string, unknown> {
	if (msg instanceof SystemMessage) return { role: 'system', content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) };
	if (msg instanceof HumanMessage) return { role: 'user', content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) };
	if (msg instanceof ToolMessage) return { role: 'tool', content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content), tool_call_id: (msg as ToolMessage).tool_call_id };
	if (msg instanceof AIMessage) {
		const aiMsg: Record<string, unknown> = { role: 'assistant', content: typeof msg.content === 'string' ? msg.content : (msg.content || null) };
		if (msg.tool_calls && msg.tool_calls.length > 0) {
			aiMsg.tool_calls = msg.tool_calls.map((tc) => ({
				id: tc.id,
				type: 'function',
				function: { name: tc.name, arguments: JSON.stringify(tc.args) },
			}));
		}
		return aiMsg;
	}
	if (msg instanceof ChatMessage) return { role: (msg as ChatMessage).role || 'user', content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) };
	return { role: 'user', content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) };
}

function convertTools(tools: BindToolsInput[]): ToolDefinition[] {
	return tools.map((tool) => {
		const t = tool as Record<string, unknown>;
		if (typeof t.toJSON === 'function') {
			const json = t.toJSON() as Record<string, unknown>;
			if (json.type === 'function') return json as unknown as ToolDefinition;
		}
		const schema = (t.schema ?? t.parameters ?? { type: 'object', properties: {} }) as Record<string, unknown>;
		const name = (t.name as string) ?? ((t.function as Record<string, unknown>)?.name as string) ?? 'unknown';
		const description = (t.description as string) ?? ((t.function as Record<string, unknown>)?.description as string) ?? '';
		return {
			type: 'function',
			function: {
				name,
				description,
				parameters: schema,
			},
		};
	});
}

function httpRequest(url: string, body: string, apiKey: string, timeout: number): Promise<Llm7ApiResponse> {
	return new Promise((resolve, reject) => {
		const parsed = new URL(url);
		const isHttps = parsed.protocol === 'https:';
		const client = isHttps ? https : http;

		const req = client.request(
			{
				hostname: parsed.hostname,
				port: parsed.port || (isHttps ? 443 : 80),
				path: parsed.pathname + parsed.search,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`,
					'Content-Length': Buffer.byteLength(body),
				},
				timeout,
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on('data', (chunk: Buffer) => chunks.push(chunk));
				res.on('end', () => {
					const rawBody = Buffer.concat(chunks).toString('utf-8');
					if (res.statusCode && res.statusCode >= 400) {
						reject(new Error(`LLM7 API error: ${res.statusCode} ${res.statusMessage} — ${rawBody}`));
						return;
					}
					try {
						resolve(JSON.parse(rawBody) as Llm7ApiResponse);
					} catch {
						reject(new Error(`LLM7 API: invalid JSON — ${rawBody.slice(0, 200)}`));
					}
				});
			},
		);

		req.on('error', reject);
		req.on('timeout', () => { req.destroy(); reject(new Error(`LLM7 API timed out after ${timeout}ms`)); });
		req.write(body);
		req.end();
	});
}

export class RawHttpChatModel extends BaseChatModel {
	baseUrl: string;
	apiKey: string;
	model: string;
	temperature: number;
	maxTokens: number;
	topP: number;
	frequencyPenalty: number;
	presencePenalty: number;
	timeout: number;
	private _boundTools?: ToolDefinition[];

	declare lc_kwargs: Record<string, unknown>;

	constructor(fields: RawHttpChatModelFields) {
		super(fields as BaseChatModelParams);
		this.baseUrl = fields.baseUrl.replace(/\/+$/, '');
		this.apiKey = fields.apiKey || 'unused';
		this.model = fields.model;
		this.temperature = fields.temperature ?? 1;
		this.maxTokens = fields.maxTokens ?? 1024;
		this.topP = fields.topP ?? 1;
		this.frequencyPenalty = fields.frequencyPenalty ?? 0;
		this.presencePenalty = fields.presencePenalty ?? 0;
		this.timeout = fields.timeout ?? 120000;
	}

	_llmType(): string {
		return 'llm7-raw-http';
	}

	bindTools(tools: BindToolsInput[]): this {
		const ClonedModel = this.constructor as new (f: RawHttpChatModelFields) => this;
		const cloned = new ClonedModel(this._serializeFields());
		cloned._boundTools = convertTools(tools);
		return cloned;
	}

	private _serializeFields(): RawHttpChatModelFields {
		return {
			baseUrl: this.baseUrl,
			apiKey: this.apiKey,
			model: this.model,
			temperature: this.temperature,
			maxTokens: this.maxTokens,
			topP: this.topP,
			frequencyPenalty: this.frequencyPenalty,
			presencePenalty: this.presencePenalty,
			timeout: this.timeout,
		};
	}

	async _generate(messages: BaseMessage[], _options: unknown, _runManager?: unknown): Promise<ChatResult> {
		const apiMessages = messages.map(messageToApi);

		const body: Record<string, unknown> = {
			model: this.model,
			messages: apiMessages,
			temperature: this.temperature,
			max_tokens: this.maxTokens,
			top_p: this.topP,
			frequency_penalty: this.frequencyPenalty,
			presence_penalty: this.presencePenalty,
		};

		if (this._boundTools && this._boundTools.length > 0) {
			body.tools = this._boundTools;
		}

		const data = await httpRequest(`${this.baseUrl}/chat/completions`, JSON.stringify(body), this.apiKey, this.timeout);

		if (!data.choices || data.choices.length === 0) {
			throw new Error('LLM7 API returned empty choices');
		}

		const choice = data.choices[0];
		const msg = choice.message;

		let aiMessage: AIMessage;
		if (msg.tool_calls && msg.tool_calls.length > 0) {
			aiMessage = new AIMessage({
				content: msg.content ?? '',
				tool_calls: msg.tool_calls.map((tc) => ({
					id: tc.id,
					name: tc.function.name,
					args: JSON.parse(tc.function.arguments),
				})),
			});
		} else {
			aiMessage = new AIMessage({ content: msg.content ?? '' });
		}

		const generation: ChatGeneration = {
			text: msg.content ?? '',
			message: aiMessage,
		};

		return {
			generations: [generation],
			llmOutput: {
				tokenUsage: data.usage,
			},
		};
	}
}
