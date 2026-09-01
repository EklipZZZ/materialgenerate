import { getServerEnv } from "./config.ts";
import { buildProviderRequest, type Provider, type ProviderMessage, type ThinkingMode } from "./models.ts";
import { setTimeout as delay } from "node:timers/promises";

export type ChatMessage = ProviderMessage;

export type LlmFailureKind =
  | "credentials"
  | "billing"
  | "rate_limit"
  | "bad_request"
  | "server"
  | "timeout"
  | "network"
  | "resource"
  | "empty_response"
  | "upstream"
  | "unknown";

export interface LlmFailureInfo {
  kind: LlmFailureKind;
  provider: Provider;
  model: string;
  operation?: string;
  status?: number;
  code?: string;
  requestId?: string;
  retryable: boolean;
  userMessage: string;
}

export class LlmError extends Error {
  public readonly info: LlmFailureInfo;

  constructor(info: LlmFailureInfo) {
    super(info.userMessage);
    this.info = info;
    this.name = "LlmError";
  }
}

export interface LlmInput {
  provider: Provider;
  model: string;
  apiKey: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  thinking?: ThinkingMode;
  operation?: string;
  signal?: AbortSignal;
  onRetry?: (event: { attempt: number; maxRetries: number; kind: LlmFailureKind; operation?: string }) => void | Promise<void>;
}

function requestSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(getServerEnv().llmTimeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function isCallerAbort(error: unknown): boolean {
  return error instanceof Error && (
    error.name === "AbortError" ||
    error.message.includes("aborted")
  );
}

function isTimeoutLike(error: unknown): boolean {
  return error instanceof Error && (
    error.name === "TimeoutError" ||
    error.message.toLowerCase().includes("timeout") ||
    error.message.toLowerCase().includes("timed out")
  );
}

function safeCode(value: unknown): string | undefined {
  const candidate = typeof value === "string" || typeof value === "number" ? String(value) : "";
  return /^[A-Za-z0-9_.:-]{1,80}$/.test(candidate) ? candidate : undefined;
}

function requestId(response: Response): string | undefined {
  const value = response.headers.get("x-request-id") || response.headers.get("request-id");
  return value && /^[A-Za-z0-9_.:-]{1,120}$/.test(value) ? value : undefined;
}

function errorCodeFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const root = body as Record<string, unknown>;
  const error = root.error && typeof root.error === "object" ? root.error as Record<string, unknown> : root;
  return safeCode(error.code) || safeCode(error.type);
}

function kindForFailure(status?: number, code?: string, finishReason?: string): LlmFailureKind {
  const normalized = String(code || finishReason || "").toLowerCase();
  if (status === 401 || status === 403 || /invalid.*key|unauthori|forbidden|authentication/.test(normalized)) return "credentials";
  if (status === 402 || /balance|billing|payment|quota_exceeded/.test(normalized)) return "billing";
  if (status === 408 || status === 504 || /timeout|timed_out/.test(normalized)) return "timeout";
  if (status === 429 || /rate.?limit|too_many_requests/.test(normalized)) return "rate_limit";
  if (/insufficient_system_resource|resource_exhausted|overloaded/.test(normalized)) return "resource";
  if (status === 400 || /invalid_request|bad_request/.test(normalized)) return "bad_request";
  if (status !== undefined && status >= 500) return "server";
  return "upstream";
}

function retryableForKind(kind: LlmFailureKind): boolean {
  return ["billing", "rate_limit", "server", "timeout", "network", "resource"].includes(kind);
}

function messageForKind(kind: LlmFailureKind, status?: number, finishReason?: string): string {
  const http = status ? `（HTTP ${status}）` : "";
  switch (kind) {
    case "credentials": return `模型 API Key 无效或没有权限${http}`;
    case "billing": return `模型账户余额不足或额度不可用${http}`;
    case "rate_limit": return `模型请求过于频繁或达到限流${http}`;
    case "bad_request": return `模型请求参数不被供应商接受${http}`;
    case "server": return `模型服务暂时不可用${http}`;
    case "timeout": return "模型请求超时，请稍后重试";
    case "network": return "无法连接模型服务，请检查网络或稍后重试";
    case "resource": return finishReason === "insufficient_system_resource"
      ? "模型服务因资源不足中断了本次生成，请降低生成规模或稍后重试"
      : "模型服务资源不足，暂时无法完成本次生成";
    case "empty_response": return "模型返回了空内容";
    case "upstream": return `模型服务返回异常${http}`;
    default: return "模型请求发生未知错误";
  }
}

function failureInfo(input: Pick<LlmInput, "provider" | "model" | "operation"> & {
  kind: LlmFailureKind;
  status?: number;
  code?: string;
  requestId?: string;
  finishReason?: string;
}): LlmFailureInfo {
  return {
    kind: input.kind,
    provider: input.provider,
    model: input.model,
    operation: input.operation,
    status: input.status,
    code: input.code,
    requestId: input.requestId,
    retryable: retryableForKind(input.kind),
    userMessage: messageForKind(input.kind, input.status, input.finishReason),
  };
}

async function upstreamFailure(
  input: Pick<LlmInput, "provider" | "model" | "operation">,
  response: Response,
): Promise<LlmError> {
  const bodyText = await response.text().catch(() => "");
  let body: unknown = null;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    // Keep only the HTTP status when the provider did not return JSON.
  }
  const code = errorCodeFromBody(body);
  const kind = kindForFailure(response.status, code);
  return new LlmError(failureInfo({
    ...input,
    kind,
    status: response.status,
    code,
    requestId: requestId(response),
  }));
}

async function callUpstream(input: LlmInput): Promise<Response> {
  if (!input.apiKey || input.apiKey.length > 500) {
    throw new LlmError(failureInfo({ ...input, kind: "credentials" }));
  }
  const request = buildProviderRequest(input);
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let failure: LlmError;
    try {
      const response = await fetch(request.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + input.apiKey,
        },
        body: JSON.stringify(request.body),
        signal: requestSignal(input.signal),
      });
      if (response.ok) return response;
      failure = await upstreamFailure(input, response);
    } catch (error) {
      if (input.signal?.aborted || (isCallerAbort(error) && !isTimeoutLike(error))) throw error;
      failure = error instanceof LlmError
        ? error
        : new LlmError(failureInfo({ ...input, kind: isTimeoutLike(error) ? "timeout" : "network" }));
    }
    const automaticallyRetryable = ["network", "timeout", "rate_limit", "server"].includes(failure.info.kind);
    if (!automaticallyRetryable || attempt >= maxRetries) throw failure;
    await input.onRetry?.({
      attempt: attempt + 1,
      maxRetries,
      kind: failure.info.kind,
      operation: input.operation,
    });
    await delay(500 * (2 ** attempt), undefined, input.signal ? { signal: input.signal } : undefined);
  }
  throw new LlmError(failureInfo({ ...input, kind: "unknown" }));
}

export async function callLlm(input: LlmInput): Promise<string> {
  const response = await callUpstream({ ...input, stream: false });
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: unknown; type?: unknown };
    choices?: Array<{ message?: { content?: string } }>;
  } | null;
  if (body?.error) {
    const code = errorCodeFromBody(body);
    const kind = kindForFailure(200, code);
    throw new LlmError(failureInfo({ ...input, kind, status: 200, code, requestId: requestId(response) }));
  }
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new LlmError(failureInfo({ ...input, kind: "empty_response", requestId: requestId(response) }));
  }
  return content;
}

export async function streamLlm(
  input: LlmInput,
  onChunk: (chunk: string) => void | Promise<void>,
): Promise<string> {
  const response = await callUpstream({ ...input, stream: true });
  if (!response.body) {
    throw new LlmError(failureInfo({ ...input, kind: "empty_response", requestId: requestId(response) }));
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let done = false;
  let finishReason: string | undefined;
  let streamFailure: LlmError | null = null;

  const processLine = async (line: string) => {
    if (streamFailure || !line.startsWith("data:")) return;
    const value = line.slice(5).trim();
    if (!value) return;
    if (value === "[DONE]") {
      done = true;
      return;
    }
    let parsed: {
      error?: { code?: unknown; type?: unknown };
      choices?: Array<{ finish_reason?: string | null; delta?: { content?: string } }>;
    };
    try {
      parsed = JSON.parse(value) as typeof parsed;
    } catch {
      // Ignore non-JSON keep-alive lines from an upstream SSE stream.
      return;
    }
    if (parsed.error) {
      const code = errorCodeFromBody(parsed);
      const kind = kindForFailure(200, code);
      streamFailure = new LlmError(failureInfo({
        ...input,
        kind,
        status: 200,
        code,
        requestId: requestId(response),
        finishReason: code,
      }));
      return;
    }
    const choice = parsed.choices?.[0];
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    const chunk = choice?.delta?.content;
    if (typeof chunk === "string" && chunk) {
      content += chunk;
      await onChunk(chunk);
    }
  };

  try {
    while (!done && !streamFailure) {
      const next = await reader.read();
      if (next.done) break;
      buffer += decoder.decode(next.value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        await processLine(line);
        if (done || streamFailure) break;
      }
    }
    buffer += decoder.decode();
    if (!done && !streamFailure && buffer) await processLine(buffer);
  } finally {
    if (streamFailure) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }

  if (streamFailure) throw streamFailure;
  if (finishReason === "insufficient_system_resource") {
    throw new LlmError(failureInfo({
      ...input,
      kind: "resource",
      status: 200,
      code: finishReason,
      requestId: requestId(response),
      finishReason,
    }));
  }
  if (!content.trim()) {
    throw new LlmError(failureInfo({
      ...input,
      kind: "empty_response",
      status: 200,
      code: finishReason,
      requestId: requestId(response),
    }));
  }
  return content;
}

export async function testLlm(input: Pick<LlmInput, "provider" | "model" | "apiKey">): Promise<void> {
  await callLlm({
    ...input,
    messages: [{ role: "user", content: "请只回复：连接正常" }],
    maxTokens: 16,
    temperature: 0,
    thinking: "disabled",
  });
}

export function getLlmFailureInfo(error: unknown): LlmFailureInfo | null {
  return error instanceof LlmError ? error.info : null;
}
