import {
	NodeConnectionTypes,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';
import { RawHttpChatModel } from './RawHttpChatModel';

export class Llm7ChatModel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'LLM7 Chat Model',
		name: 'llm7ChatModel',
		icon: { light: 'file:llm7.svg', dark: 'file:llm7.dark.svg' },
		group: ['transform'],
		version: 1,
		description: 'Use llm7.io or any OpenAI-compatible API as a chat model. Direct HTTP, no ChatOpenAI.',
		defaults: { name: 'LLM7 Chat Model' },
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models'],
				'Language Models': ['Chat Models (Recommended)'],
			},
		},
		inputs: [],
		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],
		properties: [
			{
				displayName: 'Base URL',
				name: 'baseUrl',
				type: 'string',
				default: 'https://api.llm7.io/v1',
				required: true,
				description: 'The OpenAI-compatible API endpoint',
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
					},
					{
						displayName: 'Max Tokens',
						name: 'maxTokens',
						type: 'number',
						default: 1024,
						typeOptions: { minValue: 1 },
					},
					{
						displayName: 'Timeout (Seconds)',
						name: 'timeout',
						type: 'number',
						default: 120,
						typeOptions: { minValue: 5, maxValue: 600 },
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const baseUrl = this.getNodeParameter('baseUrl', itemIndex) as string;
		const rawApiKey = this.getNodeParameter('apiKey', itemIndex) as string;
		const apiKey = rawApiKey && rawApiKey.trim() ? rawApiKey.trim() : 'unused';
		const model = this.getNodeParameter('model', itemIndex) as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as {
			temperature?: number;
			maxTokens?: number;
			timeout?: number;
		};

		const chatModel = new RawHttpChatModel({
			baseUrl,
			apiKey,
			model,
			temperature: options.temperature,
			maxTokens: options.maxTokens,
			timeout: options.timeout ? options.timeout * 1000 : undefined,
		});

		return { response: chatModel };
	}
}
