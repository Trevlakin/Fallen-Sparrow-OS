import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import {
  sopChecklistItems,
  sopCompletions,
  sopRoleAssignments,
  sops,
  teamMembers,
} from "@fallen-sparrow/shared/schema";
import type { TeamMemberRole } from "@fallen-sparrow/shared/constants";
import { db } from "../config/database.js";

export interface RoleHistoryRow {
  sessionDate: string;
  employee: string;
  teamMemberId: string;
  sopId: string;
  sopName: string;
  completedCount: number;
  totalCount: number;
  lastCompletedAt: Date | null;
  missedItemLabels: string[];
}

function addDaysISO(dateISO: string, delta: number): string {
  const d = new Date(`${dateISO}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export async function getHistoryByRole(
  role: TeamMemberRole,
  daysBack: number,
  todayISO: string,
): Promise<RoleHistoryRow[]> {
  const fromDate = addDaysISO(todayISO, -(daysBack - 1));

  const roleSops = await db
    .select({
      sopId: sops.id,
      sopTitle: sops.title,
    })
    .from(sops)
    .innerJoin(sopRoleAssignments, eq(sopRoleAssignments.sopId, sops.id))
    .where(and(eq(sops.isActive, true), eq(sopRoleAssignments.role, role)))
    .orderBy(asc(sops.sortOrder), asc(sops.title));

  if (roleSops.length === 0) return [];

  const sopIds = roleSops.map((s) => s.sopId);
  const items = await db
    .select({
      id: sopChecklistItems.id,
      sopId: sopChecklistItems.sopId,
      label: sopChecklistItems.label,
    })
    .from(sopChecklistItems)
    .where(
      and(
        inArray(sopChecklistItems.sopId, sopIds),
        eq(sopChecklistItems.isActive, true),
      ),
    );

  const itemsBySop = new Map<string, { id: string; label: string }[]>();
  for (const item of items) {
    const list = itemsBySop.get(item.sopId) ?? [];
    list.push({ id: item.id, label: item.label });
    itemsBySop.set(item.sopId, list);
  }

  const itemIds = items.map((i) => i.id);
  if (itemIds.length === 0) return [];

  const roleMembers = await db
    .select({
      id: teamMembers.id,
      displayName: teamMembers.displayName,
    })
    .from(teamMembers)
    .where(and(eq(teamMembers.role, role), eq(teamMembers.isActive, true)));

  const memberIds = roleMembers.map((m) => m.id);
  if (memberIds.length === 0) return [];

  const completions = await db
    .select({
      itemId: sopCompletions.itemId,
      teamMemberId: sopCompletions.teamMemberId,
      sessionDate: sopCompletions.sessionDate,
      completedAt: sopCompletions.completedAt,
      displayName: teamMembers.displayName,
    })
    .from(sopCompletions)
    .innerJoin(teamMembers, eq(teamMembers.id, sopCompletions.teamMemberId))
    .where(
      and(
        inArray(sopCompletions.itemId, itemIds),
        inArray(sopCompletions.teamMemberId, memberIds),
        gte(sopCompletions.sessionDate, fromDate),
      ),
    )
    .orderBy(desc(sopCompletions.sessionDate), asc(teamMembers.displayName));

  const rows: RoleHistoryRow[] = [];
  const seen = new Set<string>();

  for (const row of completions) {
    if (!row.teamMemberId) continue;
    const sopItem = items.find((i) => i.id === row.itemId);
    if (!sopItem) continue;
    const key = `${row.sessionDate}:${row.teamMemberId}:${sopItem.sopId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const sopMeta = roleSops.find((s) => s.sopId === sopItem.sopId);
    if (!sopMeta) continue;

    const sopItems = itemsBySop.get(sopItem.sopId) ?? [];
    const memberCompletions = completions.filter(
      (c) =>
        c.teamMemberId === row.teamMemberId &&
        c.sessionDate === row.sessionDate &&
        sopItems.some((si) => si.id === c.itemId),
    );
    const completedItemIds = new Set(memberCompletions.map((c) => c.itemId));
    const lastCompletedAt = memberCompletions.reduce<Date | null>((latest, c) => {
      if (!c.completedAt) return latest;
      if (!latest || c.completedAt > latest) return c.completedAt;
      return latest;
    }, null);

    rows.push({
      sessionDate: row.sessionDate,
      employee: row.displayName,
      teamMemberId: row.teamMemberId,
      sopId: sopItem.sopId,
      sopName: sopMeta.sopTitle,
      completedCount: completedItemIds.size,
      totalCount: sopItems.length,
      lastCompletedAt,
      missedItemLabels: sopItems
        .filter((i) => !completedItemIds.has(i.id))
        .map((i) => i.label),
    });
  }

  return rows.sort((a, b) => {
    if (a.sessionDate !== b.sessionDate) {
      return b.sessionDate.localeCompare(a.sessionDate);
    }
    if (a.employee !== b.employee) {
      return a.employee.localeCompare(b.employee);
    }
    return a.sopName.localeCompare(b.sopName);
  });
}
