import { env } from "./env.js";
import { providerRequest, type LlmInput } from "./providers.js";

export type { LlmInput } from "./providers.js";

function requestSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(env.llmTimeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export async function callLlm(input: LlmInput): Promise<Response | string> {
  if (!input.apiKey || input.apiKey.length > 500) throw new Error("模型凭据无效");
  const request = providerRequest(input);
  const response = await fetch(request.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + input.apiKey,
    },
    body: JSON.stringify(request.body),
    signal: requestSignal(input.signal),
  });
  if (!response.ok) {
    // Never include the upstream response body: providers may echo prompts or credentials.
    throw new Error("模型服务调用失败（HTTP " + response.status + "）");
  }
  if (input.stream) return response;
  const body = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>;
  } | null;
  const content = body?.choices?.[0]?.message?.content;
  if (!content) throw new Error("模型服务返回了空内容");
  return content;
}
