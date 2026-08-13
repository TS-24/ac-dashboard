export function derivePriority(dueAt: Date | null, now: Date): "high" | "medium" | "low" {
  if (!dueAt) return "low";
  const ms = dueAt.getTime() - now.getTime();
  if (ms <= 24 * 60 * 60 * 1000) return "high";
  if (ms <= 72 * 60 * 60 * 1000) return "medium";
  return "low";
}
