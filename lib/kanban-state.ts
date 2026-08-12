import type { BoardColumn } from "../app/dashboard-data.ts";

function cloneColumns(columns: BoardColumn[]): BoardColumn[] {
  return columns.map((column) => ({
    ...column,
    cards: [...column.cards],
    count: column.cards.length,
  }));
}

function refreshCounts(columns: BoardColumn[]): BoardColumn[] {
  return columns.map((column) => ({ ...column, count: column.cards.length }));
}

export function moveCard(columns: BoardColumn[], cardId: string, destinationTitle: string): BoardColumn[] {
  const next = cloneColumns(columns);
  const destination = next.find((column) => column.title === destinationTitle);
  const source = next.find((column) => column.cards.some((card) => card.id === cardId));

  if (!source || !destination) return columns;

  const cardIndex = source.cards.findIndex((card) => card.id === cardId);
  const [card] = source.cards.splice(cardIndex, 1);
  if (!card) return columns;

  destination.cards.push(card);
  return refreshCounts(next);
}

export function reorderCard(
  columns: BoardColumn[],
  cardId: string,
  destinationTitle: string,
  destinationIndex: number,
): BoardColumn[] {
  const next = cloneColumns(columns);
  const destination = next.find((column) => column.title === destinationTitle);
  const source = next.find((column) => column.cards.some((card) => card.id === cardId));

  if (!source || !destination) return columns;

  const sourceIndex = source.cards.findIndex((card) => card.id === cardId);
  const [card] = source.cards.splice(sourceIndex, 1);
  if (!card) return columns;

  const index = Math.max(0, Math.min(destinationIndex, destination.cards.length));
  destination.cards.splice(index, 0, card);
  return refreshCounts(next);
}
