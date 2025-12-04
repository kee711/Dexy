# Dexy Agent SDK

Node.js/TypeScript client for Dexy’s agent orchestration layer. It wraps the `/api/search`, `/api/execute/:id`, and `/api/run` endpoints and adds simple streaming support.

## Install

```bash
npm install @dexy-ai/agent-sdk
```

## Quick start

```ts
import { DexyClient } from "@dexy-ai/agent-sdk";

const dexy = new DexyClient({
  apiKey: process.env.DEXY_API_KEY!, // obtain from the /api-keys page in the app
  // baseURL defaults to https://api.dexy.run; override for local dev
  // baseURL: "http://localhost:3000",
  debug: true, // optional: logs run/search/execute steps to console
});

const result = await dexy.run({ prompt: "Explain blockchain like I'm five" });
console.log(result.output);
```

## Streaming

```ts
const streamResult = await dexy.run({ prompt: "Write a haiku", stream: true });
if (!streamResult.stream) throw new Error("stream missing");

for await (const chunk of streamResult.stream) {
  process.stdout.write(chunk);
}
```

You can also stream a specific agent (the SDK calls `/api/execute/:agentId` under the hood). Streaming works if the server responds with `text/event-stream`; otherwise you will get a single chunk with the full response body.

```ts
const exec = await dexy.execute({ agentId: "openai-gpt4", input: "Draft a tweet", stream: true });
for await (const token of exec.stream!) {
  process.stdout.write(token);
}
```

## Search + execute manually

```ts
const search = await dexy.search({ prompt: "Best agent for research" });
const exec = await dexy.execute({ agentId: search.agentId, input: "Summarize the latest LLM papers" });

console.log({
  agentId: search.agentId,
  confidence: search.confidence,
  output: exec.output,
  usage: exec.usage,
});
```

## Error handling

All methods throw `DexyError` for HTTP or API failures.

```ts
import { DexyClient, DexyError } from "@dexy/agent-sdk";

try {
  await dexy.run({ prompt: "" });
} catch (err) {
  if (err instanceof DexyError) {
    console.error(err.code, err.status, err.message);
    console.error("details", err.details);
  }
}
```

## Configuration

- `apiKey` (required): sent as `Authorization: Bearer <API_KEY>`
- `baseURL` (optional): defaults to `https://api.dexy.run`; set `http://localhost:3000` for local Next.js API routes

## API surface

- `client.run({ prompt, meta?, stream? })` → high-level search + execute; returns `{ output, usage, agent?, stream? }`
- `client.search({ prompt, meta? })` → `{ agentId, confidence, raw }`
- `client.execute({ agentId, input, meta?, stream? })` → `{ output, usage, agent?, stream? }`

### Handling JSON outputs
Some agents return JSON (e.g., `{ ok, results, finalReport }`). After `run/execute`, parse and pick the fields you need:

```ts
const result = await dexy.run({ prompt: "research MEV" });
const payload = JSON.parse(result.output);
console.log(payload.results); // or payload.finalReport
```

## Local development

Inside `sdk/`:

```bash
npm install
npm run build
```

The build outputs to `sdk/dist` (ignored by git).
