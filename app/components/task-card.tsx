import type { DragEvent } from "react";

import type { Card } from "../dashboard-data";

type TaskCardProps = {
  card: Card;
  complete?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLElement>) => void;
  onDragEnd?: () => void;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
};

export function TaskCard({ card, complete = false, isDragging = false, isDropTarget = false, ...dragProps }: TaskCardProps) {
  return <article className={`task-card${complete ? " task-complete" : ""}${isDragging ? " task-dragging" : ""}${isDropTarget ? " task-drop-target" : ""}${card.enrichmentStatus === "fallback" ? " task-unenriched" : ""}`} {...dragProps}><div className="task-card-top"><span className={`source-pill source-${card.source.toLowerCase()}`}>{card.source}</span><button className="more-button" aria-label={`More options for ${card.title}`}>···</button></div><h3>{card.title}</h3>{card.summary ? <p className="card-summary">{card.summary}</p> : null}<div className="task-meta"><span className={`priority priority-${card.priority.toLowerCase()}`}><i />{card.priority === "high" ? "High" : card.priority === "low" ? "Low" : "Medium"}</span><span className="task-tag">{card.tag}</span></div><div className="task-footer"><span className="due-date">{complete ? "✓ " : "○ "}{card.due}</span><div className="task-footer-right">{card.itemCount > 1 ? <span className="item-count">{card.itemCount} items</span> : null}{card.sourceUrl ? <a href={card.sourceUrl} className="source-link" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>↗</a> : null}{card.avatar ? <span className="task-avatar" style={{ backgroundColor: card.avatarColor }}>{card.avatar}</span> : <span className="task-avatar unassigned">+</span>}</div></div></article>;
}
