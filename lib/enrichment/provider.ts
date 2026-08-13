import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export function createEnrichmentModel(): LanguageModel {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error("HF_TOKEN is required to create the enrichment model");
  const baseURL = process.env.HF_BASE_URL ?? "https://router.huggingface.co/v1";
  const provider = createOpenAICompatible({
    name: "huggingface",
    baseURL,
    headers: { Authorization: `Bearer ${token}` },
  });
  const modelId = process.env.HF_MODEL ?? "openai/gpt-oss-120b:cheapest";
  return provider.chatModel(modelId);
}

export function enrichmentEnabled(): boolean {
  return process.env.ENRICHMENT_ENABLED === "true";
}
