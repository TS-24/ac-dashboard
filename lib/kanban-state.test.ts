import assert from "node:assert/strict";
import { test } from "node:test";

import { boardColumns, type BoardColumn, type Card } from "../app/dashboard-data.ts";
import { columnForStatus, moveCard, reorderCard, statusForColumn } from "./kanban-state.ts";

const sampleCard = (id: string, title: string): Card => ({
  id, title, summary: null, source: "Coursework", priority: "medium",
  due: "Today", tag: "Reading", owner: "", avatar: "", avatarColor: "#eeeae5",
  position: 0, sourceUrl: null, enrichmentStatus: "enriched", itemCount: 1,
});

const columns = (): BoardColumn[] => structuredClone(boardColumns.map((col, ci) => ({
  ...col,
  cards: ci === 0 ? [sampleCard("task-1", "Review lecture notes"), sampleCard("task-2", "Plan weekend schedule"), sampleCard("task-3", "Reply to feedback")]
    : ci === 1 ? [sampleCard("task-4", "Finish research summary"), sampleCard("task-5", "Prepare slides")]
    : ci === 3 ? [sampleCard("task-8", "Submit reading response"), sampleCard("task-9", "Book study room")]
    : [],
  count: ci === 0 ? 3 : ci === 1 ? 2 : ci === 3 ? 2 : 0,
})));

test("moves a card between columns without mutating the source", () => {
  const original = columns();
  const result = moveCard(original, "task-1", "In progress");

  assert.equal(result.find((column) => column.title === "Backlog")?.cards.some((card) => card.id === "task-1"), false);
  assert.equal(result.find((column) => column.title === "In progress")?.cards.at(-1)?.id, "task-1");
  assert.equal(original[0].cards[0].id, "task-1");
});

test("reorders a card within a column", () => {
  const result = reorderCard(columns(), "task-2", "Backlog", 0);

  assert.deepEqual(result[0].cards.map((card) => card.id), ["task-2", "task-1", "task-3"]);
});

test("moves a card into an empty destination column", () => {
  const source = columns();
  source[2].cards = [];

  const result = moveCard(source, "task-1", "Review");

  assert.deepEqual(result[2].cards.map((card) => card.id), ["task-1"]);
});

test("ignores invalid card and destination identifiers", () => {
  const original = columns();

  assert.deepEqual(moveCard(original, "missing", "Done"), original);
  assert.deepEqual(moveCard(original, "task-1", "Missing"), original);
});

test("maps every board column to a kanban status and back", () => {
  for (const column of boardColumns) {
    assert.equal(columnForStatus(statusForColumn(column.title)), column.title);
  }
});

test("unknown column titles and statuses fall back to backlog", () => {
  assert.equal(statusForColumn("Nonexistent"), "backlog");
  assert.equal(columnForStatus("nonexistent"), "Backlog");
});
