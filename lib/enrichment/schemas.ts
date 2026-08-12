import type { LanguageModel } from "ai";
import { generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";

function repairText(text: string): string {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const braceStart = cleaned.indexOf("{");
  const braceEnd = cleaned.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    cleaned = cleaned.slice(braceStart, braceEnd + 1);
  }
  return cleaned;
}

function tryObjectFromError(err: unknown): unknown {
  const text = err instanceof NoObjectGeneratedError ? (err as { text?: string }).text : undefined;
  if (!text) return undefined;
  try {
    return JSON.parse(repairText(text));
  } catch {
    return undefined;
  }
}

const triageDecisionSchema = z.object({
  ref: z.string(),
  keep: z.boolean(),
  reason: z.string().max(120),
});

export const triageSchema = z.object({
  decisions: z.array(triageDecisionSchema),
});

const mergeGroupSchema = z.object({
  refs: z.array(z.string()).min(1),
});

export const mergeSchema = z.object({
  groups: z.array(mergeGroupSchema),
});

export const phraseSchema = z.object({
  cards: z.array(z.object({
    ref: z.string(),
    title: z.string().min(3).max(80),
    summary: z.string().max(140),
  })),
});

export async function generateOrFallback<T>(opts: {
  model: LanguageModel;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  fallback: T;
  label: string;
}): Promise<{ value: T; ok: boolean }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await generateObject({
        model: opts.model,
        schema: opts.schema,
        system: opts.system,
        prompt: opts.prompt,
        temperature: 0.1,
        maxRetries: 0,
      });
      if (!result.object) continue;
      const parsed = opts.schema.parse(result.object);
      return { value: parsed, ok: true };
    } catch (err) {
      if (attempt < 2) {
        if (err instanceof z.ZodError) continue;
        const repairedValue = tryObjectFromError(err);
        if (repairedValue) {
          try {
            return { value: opts.schema.parse(repairedValue), ok: true };
          } catch {
            continue;
          }
        }
      } else {
        const repairedValue = tryObjectFromError(err);
        if (repairedValue) {
          try {
            return { value: opts.schema.parse(repairedValue), ok: true };
          } catch {
            // fall through to fallback
          }
        }
      }
    }
  }
  return { value: opts.fallback, ok: false };
}
