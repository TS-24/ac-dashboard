import type { TaskRow } from "../db/schema.ts";

const MAX_CLUSTER_SIZE = 5;

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

/**
 * Members already attached to a card are passed in so an incoming item can join
 * the card it belongs to instead of spawning a duplicate. Clusters made up
 * entirely of those members are dropped, since there is nothing new to enrich.
 */
export function candidateClusters(items: TaskRow[], existingMembers: TaskRow[] = []): TaskRow[][] {
  const pool = [...items, ...existingMembers];
  const isIncoming = pool.map((_, index) => index < items.length);
  const blockOf = pool.map((item) => normalizeCourseName(item.courseName) || "__uncoursed__");
  const tokensOf = pool.map((item) => tokenize(item.title));

  const parent = pool.map((_, index) => index);
  const size = pool.map(() => 1);

  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    for (let cursor = index; parent[cursor] !== root; ) {
      const next = parent[cursor];
      parent[cursor] = root;
      cursor = next;
    }
    return root;
  };

  // Refusing the union keeps the overflow in its own cluster rather than
  // truncating a cluster and silently dropping the items past the cap.
  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;
    if (size[rootA] + size[rootB] > MAX_CLUSTER_SIZE) return;
    parent[rootA] = rootB;
    size[rootB] += size[rootA];
  };

  const blocks = new Map<string, number[]>();
  for (let index = 0; index < pool.length; index++) {
    const block = blocks.get(blockOf[index]);
    if (block) block.push(index);
    else blocks.set(blockOf[index], [index]);
  }

  for (const indices of blocks.values()) {
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const a = indices[i];
        const b = indices[j];
        if (within48h(pool[a].dueAt, pool[b].dueAt) && jaccardSimilarity(tokensOf[a], tokensOf[b]) >= 0.3) {
          union(a, b);
        }
      }
    }
  }

  const clusters = new Map<number, number[]>();
  for (let index = 0; index < pool.length; index++) {
    const root = find(index);
    const cluster = clusters.get(root);
    if (cluster) cluster.push(index);
    else clusters.set(root, [index]);
  }

  const result: TaskRow[][] = [];
  for (const indices of clusters.values()) {
    if (!indices.some((index) => isIncoming[index])) continue;
    result.push(indices.map((index) => pool[index]));
  }

  return result;
}
