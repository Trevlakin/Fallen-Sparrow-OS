import { desc, eq } from "drizzle-orm";
import { incidents } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";
import { AppError } from "../utils/errors.js";

export interface OpenIncidentRow {
  description: string;
  priority: string | null;
  occurredDate: Date | null;
  createdAt: Date | null;
}

export type IncidentStatus = "open" | "in_progress" | "completed";

export interface IncidentRow {
  id: string;
  incidentType: string;
  description: string;
  priority: string | null;
  status: IncidentStatus;
  resolution: string | null;
  occurredDate: string | null;
  resolvedDate: string | null;
  createdAt: string;
}

function mapIncidentRow(row: {
  id: string;
  incidentType: string;
  description: string;
  priority: string | null;
  status: IncidentStatus | null;
  resolution: string | null;
  occurredDate: Date | null;
  resolvedDate: Date | null;
  createdAt: Date | null;
}): IncidentRow {
  return {
    id: row.id,
    incidentType: row.incidentType,
    description: row.description,
    priority: row.priority,
    status: row.status ?? "open",
    resolution: row.resolution,
    occurredDate: row.occurredDate?.toISOString() ?? null,
    resolvedDate: row.resolvedDate?.toISOString() ?? null,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

export async function listOpenIncidents(limit = 20): Promise<
  { description: string }[]
> {
  const rows = await listOpenIncidentsDetailed(limit);
  return rows.map((row) => ({ description: row.description }));
}

export async function listOpenIncidentsDetailed(
  limit = 3,
): Promise<OpenIncidentRow[]> {
  const rows = await db
    .select({
      description: incidents.description,
      priority: incidents.priority,
      occurredDate: incidents.occurredDate,
      createdAt: incidents.createdAt,
    })
    .from(incidents)
    .where(eq(incidents.status, "open"))
    .orderBy(desc(incidents.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    description: row.description,
    priority: row.priority,
    occurredDate: row.occurredDate,
    createdAt: row.createdAt,
  }));
}

export async function listIncidents(options?: {
  status?: IncidentStatus | "all";
  limit?: number;
}): Promise<IncidentRow[]> {
  const limit = options?.limit ?? 100;
  const status = options?.status ?? "all";

  const query = db
    .select({
      id: incidents.id,
      incidentType: incidents.incidentType,
      description: incidents.description,
      priority: incidents.priority,
      status: incidents.status,
      resolution: incidents.resolution,
      occurredDate: incidents.occurredDate,
      resolvedDate: incidents.resolvedDate,
      createdAt: incidents.createdAt,
    })
    .from(incidents)
    .orderBy(desc(incidents.createdAt))
    .limit(limit);

  const rows =
    status === "all" ? await query : await query.where(eq(incidents.status, status));

  return rows.map(mapIncidentRow);
}

export async function resolveIncident(
  id: string,
  resolution?: string,
): Promise<IncidentRow> {
  const [row] = await db
    .update(incidents)
    .set({
      status: "completed",
      resolution: resolution?.trim() || null,
      resolvedDate: new Date(),
    })
    .where(eq(incidents.id, id))
    .returning({
      id: incidents.id,
      incidentType: incidents.incidentType,
      description: incidents.description,
      priority: incidents.priority,
      status: incidents.status,
      resolution: incidents.resolution,
      occurredDate: incidents.occurredDate,
      resolvedDate: incidents.resolvedDate,
      createdAt: incidents.createdAt,
    });

  if (!row) {
    throw new AppError("Incident not found", 404);
  }
  return mapIncidentRow(row);
}

export async function reopenIncident(id: string): Promise<IncidentRow> {
  const [row] = await db
    .update(incidents)
    .set({
      status: "open",
      resolution: null,
      resolvedDate: null,
    })
    .where(eq(incidents.id, id))
    .returning({
      id: incidents.id,
      incidentType: incidents.incidentType,
      description: incidents.description,
      priority: incidents.priority,
      status: incidents.status,
      resolution: incidents.resolution,
      occurredDate: incidents.occurredDate,
      resolvedDate: incidents.resolvedDate,
      createdAt: incidents.createdAt,
    });

  if (!row) {
    throw new AppError("Incident not found", 404);
  }
  return mapIncidentRow(row);
}

export async function deleteIncident(id: string): Promise<void> {
  const deleted = await db
    .delete(incidents)
    .where(eq(incidents.id, id))
    .returning({ id: incidents.id });
  if (deleted.length === 0) {
    throw new AppError("Incident not found", 404);
  }
}
