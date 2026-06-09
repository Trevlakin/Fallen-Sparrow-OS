import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  sopChecklistItems,
  sopCompletions,
  sopRoleAssignments,
  sops,
  teamMembers,
} from "@fallen-sparrow/shared/schema";
import type { TeamMemberRole } from "@fallen-sparrow/shared/constants";
import { db } from "../config/database.js";

export interface YesterdaySopCompletionLine {
  role: TeamMemberRole;
  roleLabel: string;
  sopId: string;
  sopTitle: string;
  memberDisplayName: string | null;
  completedCount: number;
  totalCount: number;
  lastCompletedAt: Date | null;
  missedItemLabels: string[];
}

export async function findTeamMemberCompletion(
  itemId: string,
  teamMemberId: string,
  sessionDate: string,
): Promise<typeof sopCompletions.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(sopCompletions)
    .where(
      and(
        eq(sopCompletions.itemId, itemId),
        eq(sopCompletions.teamMemberId, teamMemberId),
        eq(sopCompletions.sessionDate, sessionDate),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function insertTeamMemberCompletion(input: {
  itemId: string;
  teamMemberId: string;
  sessionDate: string;
}): Promise<void> {
  await db.insert(sopCompletions).values({
    itemId: input.itemId,
    teamMemberId: input.teamMemberId,
    sessionDate: input.sessionDate,
  });
}

/** Re-stamp an existing completion row to "now" (heals rows blocked by the unique index). */
export async function touchTeamMemberCompletion(id: string): Promise<void> {
  await db
    .update(sopCompletions)
    .set({ completedAt: new Date() })
    .where(eq(sopCompletions.id, id));
}

export async function deleteTeamMemberCompletion(
  itemId: string,
  teamMemberId: string,
  sessionDate: string,
): Promise<void> {
  await db
    .delete(sopCompletions)
    .where(
      and(
        eq(sopCompletions.itemId, itemId),
        eq(sopCompletions.teamMemberId, teamMemberId),
        eq(sopCompletions.sessionDate, sessionDate),
      ),
    );
}

export async function getYesterdayCompletionSummary(
  sessionDate: string,
): Promise<YesterdaySopCompletionLine[]> {
  const activeSops = await db
    .select({
      sopId: sops.id,
      sopTitle: sops.title,
      role: sopRoleAssignments.role,
    })
    .from(sops)
    .innerJoin(sopRoleAssignments, eq(sopRoleAssignments.sopId, sops.id))
    .where(eq(sops.isActive, true))
    .orderBy(asc(sopRoleAssignments.role), asc(sops.sortOrder), asc(sops.title));

  if (activeSops.length === 0) return [];

  const sopIds = [...new Set(activeSops.map((s) => s.sopId))];
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
  const completions =
    itemIds.length === 0
      ? []
      : await db
          .select({
            itemId: sopCompletions.itemId,
            teamMemberId: sopCompletions.teamMemberId,
            completedAt: sopCompletions.completedAt,
            displayName: teamMembers.displayName,
          })
          .from(sopCompletions)
          .leftJoin(teamMembers, eq(teamMembers.id, sopCompletions.teamMemberId))
          .where(
            and(
              inArray(sopCompletions.itemId, itemIds),
              eq(sopCompletions.sessionDate, sessionDate),
            ),
          );

  const completionsBySopMember = new Map<
    string,
    {
      displayName: string;
      completedItemIds: Set<string>;
      lastCompletedAt: Date | null;
    }
  >();

  for (const row of completions) {
    if (!row.teamMemberId) continue;
    const sopItem = items.find((i) => i.id === row.itemId);
    if (!sopItem) continue;
    const key = `${sopItem.sopId}:${row.teamMemberId}`;
    const existing = completionsBySopMember.get(key) ?? {
      displayName: row.displayName ?? "Unknown",
      completedItemIds: new Set<string>(),
      lastCompletedAt: null,
    };
    existing.completedItemIds.add(row.itemId);
    if (
      row.completedAt &&
      (!existing.lastCompletedAt || row.completedAt > existing.lastCompletedAt)
    ) {
      existing.lastCompletedAt = row.completedAt;
    }
    completionsBySopMember.set(key, existing);
  }

  const lines: YesterdaySopCompletionLine[] = [];

  for (const sop of activeSops) {
    const sopItems = itemsBySop.get(sop.sopId) ?? [];
    const totalCount = sopItems.length;
    const role = sop.role as TeamMemberRole;

    const memberEntries = [...completionsBySopMember.entries()].filter(([key]) =>
      key.startsWith(`${sop.sopId}:`),
    );

    if (memberEntries.length === 0) {
      lines.push({
        role,
        roleLabel: role.replace(/_/g, " "),
        sopId: sop.sopId,
        sopTitle: sop.sopTitle,
        memberDisplayName: null,
        completedCount: 0,
        totalCount,
        lastCompletedAt: null,
        missedItemLabels:
          totalCount > 0 ? sopItems.map((i) => i.label) : [],
      });
      continue;
    }

    for (const [, memberData] of memberEntries) {
      const completedCount = memberData.completedItemIds.size;
      const missedItemLabels = sopItems
        .filter((i) => !memberData.completedItemIds.has(i.id))
        .map((i) => i.label);

      lines.push({
        role,
        roleLabel: role.replace(/_/g, " "),
        sopId: sop.sopId,
        sopTitle: sop.sopTitle,
        memberDisplayName: memberData.displayName,
        completedCount,
        totalCount,
        lastCompletedAt: memberData.lastCompletedAt,
        missedItemLabels,
      });
    }
  }

  return lines;
}

export async function countDistinctMembersCompletedOnDate(
  sessionDate: string,
): Promise<number> {
  const [row] = await db
    .select({
      count: sql<number>`count(distinct ${sopCompletions.teamMemberId})::int`,
    })
    .from(sopCompletions)
    .where(
      and(
        eq(sopCompletions.sessionDate, sessionDate),
        sql`${sopCompletions.teamMemberId} IS NOT NULL`,
      ),
    );
  return row?.count ?? 0;
}
