import type { Snapshot } from "../pks-api.ts";

export type AssignmentTaskInput = {
  source: string;
  sourceEntityType: "assignment";
  sourceExternalId: string;
  connectorId: string;
  title: string;
  description: string | null;
  courseName: string | null;
  sourceUrl: string | null;
  dueAt: Date | null;
  upstreamStatus: string | null;
  rawData: Record<string, unknown>;
  sourceUpdatedAt: Date | null;
};

function optionalString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalDate(data: Record<string, unknown>, key: string): Date | null {
  const value = optionalString(data, key);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function mapAssignmentSnapshot(snapshot: Snapshot, source: string): AssignmentTaskInput {
  if (snapshot.entity_type !== "assignment") throw new Error("Only assignment snapshots can become tasks");

  const data = snapshot.data as Record<string, unknown>;
  return {
    source,
    sourceEntityType: "assignment",
    sourceExternalId: snapshot.external_id,
    connectorId: snapshot.connector_id,
    title: optionalString(data, "title") ?? snapshot.external_id,
    description: optionalString(data, "description"),
    courseName: optionalString(data, "course_name"),
    sourceUrl: optionalString(data, "url"),
    dueAt: optionalDate(data, "due_date"),
    upstreamStatus: optionalString(data, "status"),
    rawData: data,
    sourceUpdatedAt: snapshot.updated_at ? new Date(snapshot.updated_at) : null,
  };
}
