import { z } from "zod";

export const providerModels = {
  openai: ["gpt-5-mini", "gpt-5.1"],
  deepseek: ["deepseek-v4-flash", "deepseek-v4-pro"],
} as const;

export type Provider = keyof typeof providerModels;

export type ProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface ProviderRequestInput {
  provider: Provider;
  model: string;
  messages: ProviderMessage[];
  stream?: boolean;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

const providerEndpoints: Record<Provider, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
};

export const providerSchema = z.enum(["openai", "deepseek"]);

export const byokSchema = z.object({
  provider: providerSchema,
  model: z.string().trim().min(1).max(100),
  apiKey: z.string().trim().min(10).max(500),
}).superRefine((value, context) => {
  if (!isAllowedModel(value.provider, value.model)) {
    context.addIssue({ code: "custom", path: ["model"], message: "不支持的模型" });
  }
});

export type ByokInput = z.infer<typeof byokSchema>;

export function isAllowedModel(provider: string, model: string): boolean {
  if (!(provider in providerModels)) return false;
  return (providerModels[provider as Provider] as readonly string[]).includes(model);
}

export function buildProviderRequest(input: ProviderRequestInput) {
  if (!isAllowedModel(input.provider, input.model)) throw new Error("不支持的模型");
  const messages = input.provider === "openai"
    ? input.messages.map((message) => ({
      ...message,
      role: message.role === "system" ? "developer" : message.role,
    }))
    : input.messages;
  const body = input.provider === "openai"
    ? {
      model: input.model,
      messages,
      stream: Boolean(input.stream),
      max_completion_tokens: input.maxTokens,
    }
    : {
      model: input.model,
      messages,
      stream: Boolean(input.stream),
      temperature: input.temperature,
      top_p: input.topP,
      max_tokens: input.maxTokens,
    };
  return { url: providerEndpoints[input.provider], body };
}
