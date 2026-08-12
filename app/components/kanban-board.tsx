"use client";

import { useEffect, useState, type DragEvent } from "react";

import { boardColumns, type BoardColumn } from "../dashboard-data";
import { moveCard, reorderCard } from "../../lib/kanban-state";
import { TaskCard } from "./task-card";

const colorClasses: Record<string, string> = { slate: "column-slate", blue: "column-blue", amber: "column-amber", green: "column-green" };
type DropTarget = { column: string; index: number } | null;

function initialBoard(): BoardColumn[] {
  return boardColumns.map((column) => ({ ...column, cards: [], count: 0 }));
}

function applyRows(rows: Record<string, unknown>[]): BoardColumn[] {
  const next = initialBoard();
  for (const row of rows) {
    const status = row.kanbanStatus === "in_progress" ? "In progress" : row.kanbanStatus === "review" ? "Review" : row.kanbanStatus === "done" ? "Done" : "Backlog";
    const column = next.find((candidate) => candidate.title === status);
    if (!column) continue;
    column.cards.push({
      id: String(row.id),
      title: String(row.title),
      summary: row.summary ? String(row.summary) : null,
      source: String(row.primarySource),
      priority: row.priority === "high" ? "high" : row.priority === "low" ? "low" : "medium",
      due: row.dueAt ? new Date(String(row.dueAt)).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "No due date",
      tag: "Assignment",
      owner: "",
      avatar: "",
      avatarColor: "#eeeae5",
      position: Number(row.position ?? 0),
      sourceUrl: row.sourceUrl ? String(row.sourceUrl) : null,
      enrichmentStatus: String(row.enrichmentStatus ?? "pending"),
      itemCount: Number(row.itemCount ?? 1),
    });
  }
  for (const column of next) { column.cards.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)); column.count = column.cards.length; }
  return next;
}

export function KanbanBoard() {
  const [columns, setColumns] = useState(initialBoard);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cards").then(async (response) => { if (!response.ok) throw new Error("Cards are unavailable"); return response.json() as Promise<{ items: Record<string, unknown>[] }>; }).then((response) => { if (!cancelled) setColumns(applyRows(response.items)); }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Cards are unavailable"); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const persistBoard = async (next: BoardColumn[]) => {
    const statusByTitle: Record<string, string> = { Backlog: "backlog", "In progress": "in_progress", Review: "review", Done: "done" };
    const responses = await Promise.all(next.flatMap((column) => column.cards.map((card, position) => fetch(`/api/cards/${card.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kanban_status: statusByTitle[column.title], position }) }))));
    if (responses.some((response) => !response.ok)) throw new Error("Could not save board changes");
  };

  const handleDragStart = (event: DragEvent<HTMLElement>, cardId: string) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", cardId); setDraggedCardId(cardId); };
  const handleDragOverColumn = (event: DragEvent<HTMLDivElement>, column: BoardColumn) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget({ column: column.title, index: column.cards.length }); };
  const handleDragOverCard = (event: DragEvent<HTMLElement>, column: BoardColumn, index: number) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; setDropTarget({ column: column.title, index }); };
  const handleDrop = (event: DragEvent<HTMLElement>, destinationTitle: string, destinationIndex?: number) => {
    event.preventDefault(); event.stopPropagation();
    const cardId = event.dataTransfer.getData("text/plain") || draggedCardId;
    if (!cardId) return;
    const destination = columns.find((column) => column.title === destinationTitle);
    const source = columns.find((column) => column.cards.some((card) => card.id === cardId));
    if (!destination || !source) return;
    const previous = columns;
    let next: BoardColumn[];
    if (source.title === destination.title) {
      const sourceIndex = source.cards.findIndex((card) => card.id === cardId);
      const targetIndex = destinationIndex ?? destination.cards.length;
      next = reorderCard(columns, cardId, destinationTitle, sourceIndex < targetIndex ? targetIndex - 1 : targetIndex);
    } else if (destinationIndex === undefined) next = moveCard(columns, cardId, destinationTitle);
    else next = reorderCard(moveCard(columns, cardId, destinationTitle), cardId, destinationTitle, destinationIndex);
    setColumns(next); setError(null); void persistBoard(next).catch((reason: unknown) => { setColumns(previous); setError(reason instanceof Error ? reason.message : "Could not save board changes"); }); setDraggedCardId(null); setDropTarget(null);
  };
  const handleDragEnd = () => { setDraggedCardId(null); setDropTarget(null); };
  const activeCardCount = columns.filter((column) => column.title !== "Done").reduce((total, column) => total + column.cards.length, 0);

  return <section className="board-section" id="board" aria-labelledby="board-title"><div className="section-title-row board-title-row"><div><p className="eyebrow">The days ahead</p><h2 id="board-title">Your board</h2></div><span className="board-count">{activeCardCount} active tasks</span></div>{loading ? <p className="board-message">Loading your tasks…</p> : error ? <p className="board-message board-error">{error}</p> : <div className="kanban-board">{columns.map((column) => <div className={`kanban-column${dropTarget?.column === column.title ? " column-drop-target" : ""}`} key={column.title} onDragOver={(event) => handleDragOverColumn(event, column)} onDrop={(event) => handleDrop(event, column.title)}><div className="column-heading"><div className={`column-indicator ${colorClasses[column.color]}`} /><h3>{column.title}</h3><span className="column-count">{column.count}</span></div><div className="task-list">{column.cards.map((card, index) => <TaskCard key={card.id} card={card} complete={column.title === "Done"} isDragging={draggedCardId === card.id} isDropTarget={dropTarget?.column === column.title && dropTarget.index === index} draggable onDragStart={(event) => handleDragStart(event, card.id)} onDragEnd={handleDragEnd} onDragOver={(event) => handleDragOverCard(event, column, index)} onDrop={(event) => handleDrop(event, column.title, index)} />)}<button className="add-card-button">+ Add a task</button></div></div>)}</div>}</section>;
}
