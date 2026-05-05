import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

interface Llm7Response {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Array<{
		index: number;
		message: {
			role: string;
			content: string;
		};
		finish_reason: string;
	}>;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

export class Llm7Chat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'LLM7 Chat',
		name: 'llm7Chat',
		icon: { light: 'file:llm7.svg', dark: 'file:llm7.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["model"] }}',
		description: 'Send chat completions to llm7.io or any OpenAI-compatible API. Direct HTTP, no LangChain.',
		defaults: {
			name: 'LLM7 Chat',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Base URL',
				name: 'baseUrl',
				type: 'string',
				default: 'https://api.llm7.io/v1',
				required: true,
				description: 'The OpenAI-compatible API endpoint',
				placeholder: 'https://api.llm7.io/v1',
			},
			{
				displayName: 'API Key',
				name: 'apiKey',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'API key (leave empty or type "unused" for llm7.io free tier)',
				placeholder: 'unused',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: 'default',
				required: true,
				description: 'Model identifier. For llm7.io: default, fast, pro, gpt-4o-mini',
				placeholder: 'default',
			},
			{
				displayName: 'Messages',
				name: 'messages',
				type: 'fixedCollection',
				typeOptions: { sortable: true, multipleValues: true },
				placeholder: 'Add Message',
				default: { values: [{ role: 'user', content: '' }] },
				options: [
					{
						name: 'values',
						displayName: 'Message',
						values: [
							{
								displayName: 'Role',
								name: 'role',
								type: 'options',
								options: [
									{ name: 'System', value: 'system' },
									{ name: 'User', value: 'user' },
									{ name: 'Assistant', value: 'assistant' },
								],
								default: 'user',
								description: 'The role of the message sender',
							},
							{
								displayName: 'Content',
								name: 'content',
								type: 'string',
								default: '',
								description: 'The message content. Supports expressions.',
								typeOptions: { rows: 4 },
							},
						],
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Temperature',
						name: 'temperature',
						type: 'number',
						typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 1 },
						default: 1,
						description: 'Controls randomness (0 = deterministic, 2 = very random)',
					},
					{
						displayName: 'Max Tokens',
						name: 'maxTokens',
						type: 'number',
						default: 1024,
						description: 'Maximum tokens in the response',
						typeOptions: { minValue: 1 },
					},
					{
						displayName: 'Top P',
						name: 'topP',
						type: 'number',
						typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
						default: 1,
						description: 'Nucleus sampling threshold',
					},
					{
						displayName: 'Frequency Penalty',
						name: 'frequencyPenalty',
						type: 'number',
						typeOptions: { minValue: -2, maxValue: 2, numberPrecision: 1 },
						default: 0,
					},
					{
						displayName: 'Presence Penalty',
						name: 'presencePenalty',
						type: 'number',
						typeOptions: { minValue: -2, maxValue: 2, numberPrecision: 1 },
						default: 0,
					},
					{
						displayName: 'Timeout (Seconds)',
						name: 'timeout',
						type: 'number',
						default: 120,
						description: 'Request timeout in seconds',
						typeOptions: { minValue: 5, maxValue: 600 },
					},
					{
						displayName: 'Response Format',
						name: 'responseFormat',
						type: 'options',
						options: [
							{ name: 'Text', value: 'text' },
							{ name: 'JSON Object', value: 'json_object' },
						],
						default: 'text',
						description: 'Force the model to respond in a specific format',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const baseUrl = (this.getNodeParameter('baseUrl', itemIndex) as string).replace(/\/+$/, '');
				const rawApiKey = this.getNodeParameter('apiKey', itemIndex) as string;
				const apiKey = rawApiKey && rawApiKey.trim() ? rawApiKey.trim() : 'unused';
				const model = this.getNodeParameter('model', itemIndex) as string;
				const messagesCollection = this.getNodeParameter('messages', itemIndex, {
					values: [{ role: 'user', content: '' }],
				}) as { values: ChatMessage[] };
				const options = this.getNodeParameter('options', itemIndex, {}) as {
					temperature?: number;
					maxTokens?: number;
					topP?: number;
					frequencyPenalty?: number;
					presencePenalty?: number;
					timeout?: number;
					responseFormat?: string;
				};

				const messages: ChatMessage[] = messagesCollection.values || [];

				if (messages.length === 0) {
					throw new NodeOperationError(this.getNode(), 'At least one message is required', { itemIndex });
				}

				// Build request body
				const body: Record<string, unknown> = {
					model,
					messages,
				};

				if (options.temperature !== undefined) body.temperature = options.temperature;
				if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
				if (options.topP !== undefined) body.top_p = options.topP;
				if (options.frequencyPenalty !== undefined) body.frequency_penalty = options.frequencyPenalty;
				if (options.presencePenalty !== undefined) body.presence_penalty = options.presencePenalty;
				if (options.responseFormat === 'json_object') {
					body.response_format = { type: 'json_object' };
				}

				const timeout = (options.timeout ?? 120) * 1000;

				// Direct HTTP POST to /v1/chat/completions
				const response = await this.helpers.httpRequest({
					method: 'POST',
					url: `${baseUrl}/chat/completions`,
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${apiKey}`,
					},
					body,
					timeout,
					returnFullResponse: false,
				}) as Llm7Response;

				if (!response || !response.choices || response.choices.length === 0) {
					throw new NodeOperationError(this.getNode(), 'Empty response from LLM API', { itemIndex });
				}

				const choice = response.choices[0];
				const content = choice.message?.content ?? '';

				returnData.push({
					json: {
						content,
						role: choice.message?.role ?? 'assistant',
						finishReason: choice.finish_reason,
						model: response.model,
						usage: response.usage ?? null,
						raw: response as unknown as IDataObject,
					},
					pairedItem: itemIndex,
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: itemIndex,
					});
					continue;
				}
				if (error instanceof NodeOperationError) throw error;
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}
