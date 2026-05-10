# n8n-nodes-llm7

An n8n community node for [llm7.io](https://llm7.io) and any OpenAI-compatible API — direct HTTP chat completions, no LangChain dependency.

## Features

- **Two Node Types** — Regular chat node and AI Agent-compatible chat model node
- **Free Tier Ready** — llm7.io free tier works with no API key required
- **OpenAI-Compatible** — Use any provider with the same API shape (OpenAI, Groq, Together, etc.)
- **Configurable Parameters** — Temperature, max tokens, top P, frequency/presence penalties
- **Response Format** — Force text or JSON object output
- **Multi-Turn Conversations** — System, user, and assistant message roles
- **Custom Base URL** — Point at any compatible endpoint

## Installation

In n8n, go to **Settings → Community Nodes** and install:

```
n8n-nodes-llm7
```

Or install via npm:

```bash
npm install n8n-nodes-llm7
```

## Usage

### LLM7 Chat Node

The regular chat node for direct completions in workflows.

1. Add the **LLM7 Chat** node to your workflow
2. Configure the Base URL (defaults to `https://api.llm7.io/v1`)
3. Enter an API key, or leave empty / type `unused` for llm7.io free tier
4. Choose a model: `default`, `fast`, `pro`, `gpt-4o-mini`
5. Add messages with system, user, or assistant roles
6. Optionally configure temperature, max tokens, and other parameters

### LLM7 Chat Model Node

Use llm7.io as the model for n8n AI Agents.

1. Add the **LLM7 Chat Model** node
2. Configure Base URL, API key, and model
3. Connect to an **AI Agent** node as the language model provider

## Options

| Option | Default | Description |
|--------|---------|-------------|
| Temperature | 1 | Controls randomness (0 = deterministic, 2 = very random) |
| Max Tokens | 1024 | Maximum tokens in the response |
| Top P | 1 | Nucleus sampling threshold |
| Frequency Penalty | 0 | Reduces repetition of token sequences |
| Presence Penalty | 0 | Encourages new topics |
| Timeout | 120s | Request timeout in seconds |
| Response Format | Text | Force JSON object output when needed |

## Output Schema

```json
{
  "content": "The model's response text",
  "role": "assistant",
  "finishReason": "stop",
  "model": "default",
  "usage": {
    "prompt_tokens": 42,
    "completion_tokens": 128,
    "total_tokens": 170
  }
}
```

## Example Workflows

### Simple Q&A with free llm7.io

```
[Manual Trigger] → [LLM7 Chat] → [Output]
  API Key: unused
  Model: default
  Messages: [{ role: "user", content: "What is n8n?" }]
```

### AI Agent with llm7.io

```
[Chat Trigger] → [AI Agent] → [Respond to Webhook]
                   model: LLM7 Chat Model
                   tools: [Calculator, HTTP Request, ...]
```

### Use with OpenAI or Groq

```
[LLM7 Chat]
  Base URL: https://api.openai.com/v1
  API Key: sk-...
  Model: gpt-4o
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development with hot reload
npm run dev

# Lint
npm run lint
```

## License

MIT
