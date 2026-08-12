import type { TaskRow } from "../db/schema.ts";

function normalizeCourseName(name: string | null): string {
  if (!name) return "";
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const stopwords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "is", "it", "be", "not"]);

function tokenize(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !stopwords.has(t));
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

function within48h(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return true;
  return Math.abs(a.getTime() - b.getTime()) <= 48 * 60 * 60 * 1000;
}

export function candidateClusters(items: TaskRow[], _existingMembers: { taskId: string }[] = []): TaskRow[][] {
  void _existingMembers;

  type BlockedItem = { item: TaskRow; block: string; tokens: string[] };
  const blocked: BlockedItem[] = items.map((item) => ({
    item,
    block: normalizeCourseName(item.courseName),
    tokens: tokenize(item.title),
  }));

  const blocks = new Map<string, BlockedItem[]>();
  for (const b of blocked) {
    const key = b.block || "__uncoursed__";
    if (!blocks.has(key)) blocks.set(key, []);
    blocks.get(key)!.push(b);
  }

  const parent = new Map<number, number>();
  const itemsArr = blocked;
  const find = (i: number): number => {
    if (!parent.has(i)) parent.set(i, i);
    if (parent.get(i) !== i) parent.set(i, find(parent.get(i)!));
    return parent.get(i)!;
  };
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const [, blockItems] of blocks) {
    for (let i = 0; i < blockItems.length; i++) {
      for (let j = i + 1; j < blockItems.length; j++) {
        const a = blockItems[i], b = blockItems[j];
        if (within48h(a.item.dueAt, b.item.dueAt) && jaccardSimilarity(a.tokens, b.tokens) >= 0.3) {
          union(itemsArr.indexOf(a), itemsArr.indexOf(b));
        }
      }
    }
  }

  const clusterMap = new Map<number, TaskRow[]>();
  for (let i = 0; i < itemsArr.length; i++) {
    const root = find(i);
    if (!clusterMap.has(root)) clusterMap.set(root, []);
    clusterMap.get(root)!.push(itemsArr[i].item);
  }

  const result: TaskRow[][] = [];
  for (const [, group] of clusterMap) {
    result.push(group.slice(0, 5));
  }

  return result;
}
