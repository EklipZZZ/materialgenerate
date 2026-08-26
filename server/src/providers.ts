import { isAllowedModel } from "./models.js";

export interface LlmInput {
  provider: "openai" | "deepseek";
  model: string;
  apiKey: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  signal?: AbortSignal;
}

const upstreams = {
  openai: "https://api.openai.com/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
} as const;

export function providerRequest(input: Omit<LlmInput, "apiKey" | "signal">) {
  if (!isAllowedModel(input.provider, input.model)) throw new Error("不支持的模型");

  if (input.provider === "openai") {
    return {
      url: upstreams.openai,
      body: {
        model: input.model,
        messages: input.messages.map((message) => ({
          ...message,
          role: message.role === "system" ? "developer" : message.role,
        })),
        stream: Boolean(input.stream),
        max_completion_tokens: input.max_tokens,
      },
    };
  }

  return {
    url: upstreams.deepseek,
    body: {
      model: input.model,
      messages: input.messages,
      stream: Boolean(input.stream),
      temperature: input.temperature,
      top_p: input.top_p,
      max_tokens: input.max_tokens,
    },
  };
}
