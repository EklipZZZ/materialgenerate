import { z } from "zod";

export const providerModels = {
  openai: ["gpt-5-mini", "gpt-5.1"],
  deepseek: ["deepseek-v4-flash", "deepseek-v4-pro"],
} as const;

export const providerSchema = z.enum(["openai", "deepseek"]);
export const llmConfigSchema = z.object({
  name: z.string().trim().min(1).max(80),
  provider: providerSchema,
  model: z.string(),
  apiKey: z.string().trim().min(10).max(500),
});

export function isAllowedModel(provider: string, model: string): boolean {
  if (!(provider in providerModels)) return false;
  return (providerModels[provider as keyof typeof providerModels] as readonly string[]).includes(model);
}

export const chatSchema = z.object({
  provider: providerSchema,
  model: z.string(),
  apiKey: z.string().min(1),
  messages: z.array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string() })),
  stream: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_tokens: z.number().int().positive().max(20000).optional(),
});
