import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  checklistAccess,
  sopChecklistItems,
  sopCompletions,
  sopRoleAssignments,
  sops,
} from "@fallen-sparrow/shared/schema";
import type { TeamMemberRole, UserRole } from "@fallen-sparrow/shared/constants";
import { db } from "../config/database.js";

export interface SopWithItems {
  id: string;
  title: string;
  role: UserRole | null;
  roles: TeamMemberRole[];
  frequency: string | null;
  sortOrder: number;
  isActive: boolean | null;
  items: {
    id: string;
    label: string;
    sortOrder: number | null;
    isActive: boolean | null;
  }[];
}

export interface CompletionRow {
  itemId: string;
  label: string;
  completed: boolean;
  completedAt: Date | null;
  completedByLabel: string | null;
}

export interface AccessRow {
  id: string;
  label: string;
  accessToken: string;
  pin: string | null;
  sopId: string;
  sopTitle: string;
  isActive: boolean | null;
  lastUsedAt: Date | null;
  createdAt: Date | null;
}

async function loadRoleAssignments(
  sopIds: string[],
): Promise<Map<string, TeamMemberRole[]>> {
  if (sopIds.length === 0) return new Map();
  const rows = await db
    .select({
      sopId: sopRoleAssignments.sopId,
      role: sopRoleAssignments.role,
    })
    .from(sopRoleAssignments)
    .where(inArray(sopRoleAssignments.sopId, sopIds));
  const map = new Map<string, TeamMemberRole[]>();
  for (const row of rows) {
    const list = map.get(row.sopId) ?? [];
    list.push(row.role as TeamMemberRole);
    map.set(row.sopId, list);
  }
  return map;
}

function primaryUserRole(roles: TeamMemberRole[]): UserRole | null {
  const match = roles.find(
    (r): r is UserRole => r !== "CLEANER",
  );
  return match ?? null;
}

async function attachRoles(sopRows: (typeof sops.$inferSelect)[]): Promise<SopWithItems[]> {
  if (sopRows.length === 0) return [];
  const sopIds = sopRows.map((s) => s.id);
  const rolesBySop = await loadRoleAssignments(sopIds);
  const itemRows = await db
    .select()
    .from(sopChecklistItems)
    .where(inArray(sopChecklistItems.sopId, sopIds))
    .orderBy(asc(sopChecklistItems.sortOrder), asc(sopChecklistItems.label));

  const itemsBySop = new Map<string, SopWithItems["items"]>();
  for (const item of itemRows) {
    const list = itemsBySop.get(item.sopId) ?? [];
    list.push({
      id: item.id,
      label: item.label,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    });
    itemsBySop.set(item.sopId, list);
  }

  return sopRows.map((s) => {
    const roles = rolesBySop.get(s.id) ?? (s.role ? [s.role as TeamMemberRole] : []);
    return {
      id: s.id,
      title: s.title,
      role: primaryUserRole(roles),
      roles,
      frequency: s.frequency,
      sortOrder: s.sortOrder ?? 0,
      isActive: s.isActive,
      items: itemsBySop.get(s.id) ?? [],
    };
  });
}

export async function setSopRoles(
  sopId: string,
  roles: TeamMemberRole[],
): Promise<void> {
  await db.delete(sopRoleAssignments).where(eq(sopRoleAssignments.sopId, sopId));
  if (roles.length === 0) return;
  await db.insert(sopRoleAssignments).values(
    roles.map((role) => ({ sopId, role })),
  );
  const userRole = primaryUserRole(roles);
  await db.update(sops).set({ role: userRole, updatedAt: new Date() }).where(eq(sops.id, sopId));
}

export async function listActiveSopsWithItems(): Promise<SopWithItems[]> {
  const sopRows = await db
    .select()
    .from(sops)
    .where(eq(sops.isActive, true))
    .orderBy(asc(sops.sortOrder), asc(sops.title));
  return attachRoles(sopRows);
}

export async function listAllSopsWithItems(): Promise<SopWithItems[]> {
  const sopRows = await db.select().from(sops).orderBy(asc(sops.sortOrder), asc(sops.title));
  return attachRoles(sopRows);
}

export async function listActiveSopsForRole(
  role: TeamMemberRole,
): Promise<SopWithItems[]> {
  const assignmentRows = await db
    .select({ sopId: sopRoleAssignments.sopId })
    .from(sopRoleAssignments)
    .where(eq(sopRoleAssignments.role, role));
  const sopIds = assignmentRows.map((r) => r.sopId);
  if (sopIds.length === 0) {
    if (role === "CLEANER") return [];
    const legacy = await findActiveSopByRole(role as UserRole);
    return legacy ? [legacy] : [];
  }
  const sopRows = await db
    .select()
    .from(sops)
    .where(and(eq(sops.isActive, true), inArray(sops.id, sopIds)))
    .orderBy(asc(sops.sortOrder), asc(sops.title));
  return attachRoles(sopRows);
}

export async function findActiveSopByRole(
  role: UserRole,
): Promise<SopWithItems | null> {
  const [sopRow] = await db
    .select()
    .from(sops)
    .where(and(eq(sops.isActive, true), eq(sops.role, role)))
    .limit(1);

  if (!sopRow) return null;

  const items = await db
    .select()
    .from(sopChecklistItems)
    .where(
      and(
        eq(sopChecklistItems.sopId, sopRow.id),
        eq(sopChecklistItems.isActive, true),
      ),
    )
    .orderBy(asc(sopChecklistItems.sortOrder), asc(sopChecklistItems.label));

  const [attached] = await attachRoles([sopRow]);
  if (!attached) return null;

  return {
    ...attached,
    items: items.map((i) => ({
      id: i.id,
      label: i.label,
      sortOrder: i.sortOrder,
      isActive: i.isActive,
    })),
  };
}

export async function findSopById(sopId: string): Promise<SopWithItems | null> {
  const [sopRow] = await db.select().from(sops).where(eq(sops.id, sopId)).limit(1);
  if (!sopRow) return null;
  const [attached] = await attachRoles([sopRow]);
  return attached ?? null;
}

export async function createSopWithItems(input: {
  title: string;
  roles: TeamMemberRole[];
  frequency?: string;
  sortOrder?: number;
  items?: { label: string; sortOrder: number }[];
}): Promise<SopWithItems> {
  const [sopRow] = await db
    .insert(sops)
    .values({
      title: input.title,
      role: primaryUserRole(input.roles),
      frequency: input.frequency ?? "daily",
      sortOrder: input.sortOrder ?? 0,
      isActive: true,
    })
    .returning();

  if (!sopRow) {
    throw new Error("Failed to create SOP");
  }

  await setSopRoles(sopRow.id, input.roles);

  if (input.items && input.items.length > 0) {
    await db.insert(sopChecklistItems).values(
      input.items.map((item) => ({
        sopId: sopRow.id,
        label: item.label,
        sortOrder: item.sortOrder,
        isActive: true,
      })),
    );
  }

  const created = await findSopById(sopRow.id);
  if (!created) {
    throw new Error("Failed to load created SOP");
  }
  return created;
}

export async function updateSopMeta(
  sopId: string,
  input: {
    title?: string;
    roles?: TeamMemberRole[];
    isActive?: boolean;
    sortOrder?: number;
    frequency?: string;
  },
): Promise<SopWithItems | null> {
  const patch: Partial<typeof sops.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
  if (input.frequency !== undefined) patch.frequency = input.frequency;
  if (input.roles !== undefined) patch.role = primaryUserRole(input.roles);

  const [updated] = await db.update(sops).set(patch).where(eq(sops.id, sopId)).returning();
  if (!updated) return null;
  if (input.roles) {
    await setSopRoles(sopId, input.roles);
  }
  return findSopById(sopId);
}

export async function updateSopWithItems(
  sopId: string,
  input: {
    title: string;
    role: UserRole | null;
    roles?: TeamMemberRole[];
    frequency: string;
    items: { label: string; sortOrder: number }[];
  },
): Promise<SopWithItems | null> {
  const roles =
    input.roles ??
    (input.role ? [input.role as TeamMemberRole] : (["CLEANER"] as TeamMemberRole[]));
  const [updated] = await db
    .update(sops)
    .set({
      title: input.title,
      role: input.role,
      frequency: input.frequency,
      updatedAt: new Date(),
    })
    .where(eq(sops.id, sopId))
    .returning();

  if (!updated) return null;
  await setSopRoles(sopId, roles);

  await db.delete(sopChecklistItems).where(eq(sopChecklistItems.sopId, sopId));

  if (input.items.length > 0) {
    await db.insert(sopChecklistItems).values(
      input.items.map((item) => ({
        sopId,
        label: item.label,
        sortOrder: item.sortOrder,
        isActive: true,
      })),
    );
  }

  return findSopById(sopId);
}

export async function addChecklistItem(
  sopId: string,
  input: { label: string; sortOrder: number },
): Promise<(typeof sopChecklistItems.$inferSelect) | null> {
  const sop = await findSopById(sopId);
  if (!sop) return null;
  const [row] = await db
    .insert(sopChecklistItems)
    .values({
      sopId,
      label: input.label,
      sortOrder: input.sortOrder,
      isActive: true,
    })
    .returning();
  return row ?? null;
}

export async function updateChecklistItem(
  sopId: string,
  itemId: string,
  input: Partial<{ label: string; sortOrder: number; isActive: boolean }>,
): Promise<(typeof sopChecklistItems.$inferSelect) | null> {
  const [row] = await db
    .update(sopChecklistItems)
    .set(input)
    .where(and(eq(sopChecklistItems.id, itemId), eq(sopChecklistItems.sopId, sopId)))
    .returning();
  return row ?? null;
}

export async function softDeleteChecklistItem(
  sopId: string,
  itemId: string,
): Promise<boolean> {
  const [row] = await db
    .update(sopChecklistItems)
    .set({ isActive: false })
    .where(and(eq(sopChecklistItems.id, itemId), eq(sopChecklistItems.sopId, sopId)))
    .returning({ id: sopChecklistItems.id });
  return Boolean(row);
}

export async function findChecklistItemWithRoles(itemId: string): Promise<{
  sopId: string;
  isActive: boolean;
  roles: TeamMemberRole[];
} | null> {
  const [item] = await db
    .select({
      sopId: sopChecklistItems.sopId,
      isActive: sopChecklistItems.isActive,
    })
    .from(sopChecklistItems)
    .where(eq(sopChecklistItems.id, itemId))
    .limit(1);
  if (!item) return null;
  const roles = await db
    .select({ role: sopRoleAssignments.role })
    .from(sopRoleAssignments)
    .where(eq(sopRoleAssignments.sopId, item.sopId));
  return {
    sopId: item.sopId,
    isActive: item.isActive ?? true,
    roles: roles.map((r) => r.role as TeamMemberRole),
  };
}

export async function softDeleteSop(sopId: string): Promise<boolean> {
  const [row] = await db
    .update(sops)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(sops.id, sopId))
    .returning({ id: sops.id });
  return Boolean(row);
}

export async function getCompletionsForSopAndDate(
  sopId: string,
  sessionDate: string,
): Promise<CompletionRow[]> {
  const items = await db
    .select()
    .from(sopChecklistItems)
    .where(
      and(
        eq(sopChecklistItems.sopId, sopId),
        eq(sopChecklistItems.isActive, true),
      ),
    )
    .orderBy(asc(sopChecklistItems.sortOrder), asc(sopChecklistItems.label));

  if (items.length === 0) return [];

  const itemIds = items.map((i) => i.id);
  const completions = await db
    .select()
    .from(sopCompletions)
    .where(
      and(
        inArray(sopCompletions.itemId, itemIds),
        eq(sopCompletions.sessionDate, sessionDate),
      ),
    );

  const completionByItem = new Map(
    completions.map((c) => [c.itemId, c]),
  );

  return items.map((item) => {
    const completion = completionByItem.get(item.id);
    return {
      itemId: item.id,
      label: item.label,
      completed: Boolean(completion),
      completedAt: completion?.completedAt ?? null,
      completedByLabel: completion?.completedByLabel ?? null,
    };
  });
}

export async function findCompletion(
  itemId: string,
  sessionDate: string,
): Promise<typeof sopCompletions.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(sopCompletions)
    .where(
      and(
        eq(sopCompletions.itemId, itemId),
        eq(sopCompletions.sessionDate, sessionDate),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function insertCompletion(input: {
  itemId: string;
  sessionDate: string;
  userId?: string;
  accessLabel?: string;
}): Promise<void> {
  await db.insert(sopCompletions).values({
    itemId: input.itemId,
    sessionDate: input.sessionDate,
    completedByUserId: input.userId ?? null,
    completedByLabel: input.accessLabel ?? null,
  });
}

export async function deleteCompletion(
  itemId: string,
  sessionDate: string,
): Promise<void> {
  await db
    .delete(sopCompletions)
    .where(
      and(
        eq(sopCompletions.itemId, itemId),
        eq(sopCompletions.sessionDate, sessionDate),
      ),
    );
}

export async function countCompletionsForSopOnDate(
  sopId: string,
  sessionDate: string,
): Promise<{ completed: number; total: number; lastActivity: Date | null }> {
  const items = await db
    .select({ id: sopChecklistItems.id })
    .from(sopChecklistItems)
    .where(eq(sopChecklistItems.sopId, sopId));

  const total = items.length;
  if (total === 0) {
    return { completed: 0, total: 0, lastActivity: null };
  }

  const itemIds = items.map((i) => i.id);
  const completions = await db
    .select({
      completedAt: sopCompletions.completedAt,
    })
    .from(sopCompletions)
    .where(
      and(
        inArray(sopCompletions.itemId, itemIds),
        eq(sopCompletions.sessionDate, sessionDate),
      ),
    )
    .orderBy(desc(sopCompletions.completedAt));

  const lastActivity = completions[0]?.completedAt ?? null;
  return { completed: completions.length, total, lastActivity };
}

export async function getCompletionCountsByDate(
  sopId: string,
  fromDate: string,
  toDate: string,
): Promise<Map<string, number>> {
  const items = await db
    .select({ id: sopChecklistItems.id })
    .from(sopChecklistItems)
    .where(eq(sopChecklistItems.sopId, sopId));

  if (items.length === 0) return new Map();

  const itemIds = items.map((i) => i.id);
  const rows = await db
    .select({
      sessionDate: sopCompletions.sessionDate,
      count: sql<number>`count(*)::int`,
    })
    .from(sopCompletions)
    .where(
      and(
        inArray(sopCompletions.itemId, itemIds),
        gte(sopCompletions.sessionDate, fromDate),
        lte(sopCompletions.sessionDate, toDate),
      ),
    )
    .groupBy(sopCompletions.sessionDate);

  return new Map(rows.map((r) => [String(r.sessionDate), r.count]));
}

export async function findAccessByToken(
  token: string,
): Promise<typeof checklistAccess.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(checklistAccess)
    .where(eq(checklistAccess.accessToken, token))
    .limit(1);
  return row ?? null;
}

export async function findAccessByPin(
  pin: string,
): Promise<typeof checklistAccess.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(checklistAccess)
    .where(and(eq(checklistAccess.pin, pin), eq(checklistAccess.isActive, true)))
    .limit(1);
  return row ?? null;
}

export async function findAccessById(
  accessId: string,
): Promise<typeof checklistAccess.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(checklistAccess)
    .where(eq(checklistAccess.id, accessId))
    .limit(1);
  return row ?? null;
}

export async function listAccessCodes(): Promise<AccessRow[]> {
  const rows = await db
    .select({
      id: checklistAccess.id,
      label: checklistAccess.label,
      accessToken: checklistAccess.accessToken,
      pin: checklistAccess.pin,
      sopId: checklistAccess.sopId,
      sopTitle: sops.title,
      isActive: checklistAccess.isActive,
      lastUsedAt: checklistAccess.lastUsedAt,
      createdAt: checklistAccess.createdAt,
    })
    .from(checklistAccess)
    .innerJoin(sops, eq(checklistAccess.sopId, sops.id))
    .orderBy(desc(checklistAccess.createdAt));

  return rows;
}

export async function createAccessCode(input: {
  label: string;
  sopId: string;
  accessToken: string;
  pin: string;
}): Promise<typeof checklistAccess.$inferSelect> {
  const [row] = await db
    .insert(checklistAccess)
    .values({
      label: input.label,
      sopId: input.sopId,
      accessToken: input.accessToken,
      pin: input.pin,
      isActive: true,
    })
    .returning();
  if (!row) {
    throw new Error("Failed to create access code");
  }
  return row;
}

export async function deactivateAccessCode(accessId: string): Promise<boolean> {
  const [row] = await db
    .update(checklistAccess)
    .set({ isActive: false })
    .where(eq(checklistAccess.id, accessId))
    .returning({ id: checklistAccess.id });
  return Boolean(row);
}

export async function touchAccessLastUsed(accessId: string): Promise<void> {
  await db
    .update(checklistAccess)
    .set({ lastUsedAt: new Date() })
    .where(eq(checklistAccess.id, accessId));
}

export async function findChecklistItemSopId(
  itemId: string,
): Promise<{ sopId: string; itemSopId: string } | null> {
  const [row] = await db
    .select({
      sopId: sopChecklistItems.sopId,
      itemId: sopChecklistItems.id,
    })
    .from(sopChecklistItems)
    .where(eq(sopChecklistItems.id, itemId))
    .limit(1);
  if (!row) return null;
  return { sopId: row.sopId, itemSopId: row.itemId };
}
