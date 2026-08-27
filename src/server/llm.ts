import { getServerEnv } from "./config";
import { buildProviderRequest, type Provider, type ProviderMessage } from "./models";

export type ChatMessage = ProviderMessage;

export interface LlmInput {
  provider: Provider;
  model: string;
  apiKey: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

function requestSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(getServerEnv().llmTimeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function callUpstream(input: LlmInput): Promise<Response> {
  if (!input.apiKey || input.apiKey.length > 500) throw new Error("模型凭据无效");
  const request = buildProviderRequest(input);
  const response = await fetch(request.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + input.apiKey,
    },
    body: JSON.stringify(request.body),
    signal: requestSignal(input.signal),
  });
  if (!response.ok) throw new Error("模型服务调用失败（HTTP " + response.status + "）");
  return response;
}

export async function callLlm(input: LlmInput): Promise<string> {
  const response = await callUpstream({ ...input, stream: false });
  const body = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>;
  } | null;
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("模型服务返回了空内容");
  return content;
}

export async function streamLlm(
  input: LlmInput,
  onChunk: (chunk: string) => void | Promise<void>,
): Promise<string> {
  const response = await callUpstream({ ...input, stream: true });
  if (!response.body) throw new Error("模型服务没有返回流");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let done = false;
  while (!done) {
    const next = await reader.read();
    if (next.done) break;
    buffer += decoder.decode(next.value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const value = line.slice(5).trim();
      if (!value) continue;
      if (value === "[DONE]") {
        done = true;
        break;
      }
      try {
        const parsed = JSON.parse(value) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const chunk = parsed.choices?.[0]?.delta?.content;
        if (typeof chunk === "string" && chunk) {
          content += chunk;
          await onChunk(chunk);
        }
      } catch {
        // Ignore non-JSON keep-alive lines from an upstream SSE stream.
      }
    }
  }
  if (!content.trim()) throw new Error("模型服务返回了空内容");
  return content;
}

export async function testLlm(input: Pick<LlmInput, "provider" | "model" | "apiKey">): Promise<void> {
  await callLlm({
    ...input,
    messages: [{ role: "user", content: "请只回复：连接正常" }],
    maxTokens: 16,
    temperature: 0,
  });
}
