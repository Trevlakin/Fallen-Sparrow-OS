import { and, asc, eq, ilike, isNull } from "drizzle-orm";
import { teamMembers } from "@fallen-sparrow/shared/schema";
import type { TeamMemberRole } from "@fallen-sparrow/shared/constants";
import { db } from "../config/database.js";

export type TeamMemberPublic = {
  id: string;
  name: string;
  displayName: string;
  role: TeamMemberRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type TeamMemberAdmin = TeamMemberPublic & {
  pinPlaintext: string | null;
};

function toPublic(row: typeof teamMembers.$inferSelect): TeamMemberPublic {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    role: row.role as TeamMemberRole,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAdmin(row: typeof teamMembers.$inferSelect): TeamMemberAdmin {
  return {
    ...toPublic(row),
    pinPlaintext: row.pinPlaintext ?? null,
  };
}

export async function listActiveTeamMembers(): Promise<TeamMemberPublic[]> {
  const rows = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.isActive, true))
    .orderBy(asc(teamMembers.displayName));
  return rows.map(toPublic);
}

export async function listAllTeamMembers(
  includeInactive = false,
): Promise<TeamMemberPublic[]> {
  const rows = includeInactive
    ? await db.select().from(teamMembers).orderBy(asc(teamMembers.displayName))
    : await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.isActive, true))
        .orderBy(asc(teamMembers.displayName));
  return rows.map(toPublic);
}

export async function listAllTeamMembersForAdmin(
  includeInactive = false,
): Promise<TeamMemberAdmin[]> {
  const rows = includeInactive
    ? await db.select().from(teamMembers).orderBy(asc(teamMembers.displayName))
    : await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.isActive, true))
        .orderBy(asc(teamMembers.displayName));
  return rows.map(toAdmin);
}

export async function listTeamMembersMissingPinPlaintext(): Promise<
  (typeof teamMembers.$inferSelect)[]
> {
  return db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.isActive, true), isNull(teamMembers.pinPlaintext)));
}

const teamMemberAuthColumns = {
  id: teamMembers.id,
  name: teamMembers.name,
  displayName: teamMembers.displayName,
  role: teamMembers.role,
  pin: teamMembers.pin,
  pinPlaintext: teamMembers.pinPlaintext,
  isActive: teamMembers.isActive,
  createdAt: teamMembers.createdAt,
  updatedAt: teamMembers.updatedAt,
};

export async function findTeamMemberById(
  id: string,
): Promise<(typeof teamMembers.$inferSelect) | null> {
  const [row] = await db
    .select(teamMemberAuthColumns)
    .from(teamMembers)
    .where(eq(teamMembers.id, id))
    .limit(1);
  return row ?? null;
}

export async function findActiveByFirstNamePrefix(
  firstName: string,
): Promise<TeamMemberPublic[]> {
  const rows = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        ilike(teamMembers.name, `${firstName}%`),
        eq(teamMembers.isActive, true),
      ),
    );
  return rows.map(toPublic);
}

export async function findActiveByDisplayNamePrefix(
  prefix: string,
): Promise<TeamMemberPublic[]> {
  const rows = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        ilike(teamMembers.displayName, `${prefix}%`),
        eq(teamMembers.isActive, true),
      ),
    )
    .orderBy(asc(teamMembers.displayName));
  return rows.map(toPublic);
}

export async function insertTeamMember(input: {
  name: string;
  displayName: string;
  role: TeamMemberRole;
  pinHash: string;
  pinPlaintext: string;
}): Promise<TeamMemberPublic> {
  const [row] = await db
    .insert(teamMembers)
    .values({
      name: input.name,
      displayName: input.displayName,
      role: input.role,
      pin: input.pinHash,
      pinPlaintext: input.pinPlaintext,
      isActive: true,
    })
    .returning();
  if (!row) {
    throw new Error("Failed to create team member");
  }
  return toPublic(row);
}

export async function updateTeamMember(
  id: string,
  input: Partial<{
    name: string;
    displayName: string;
    role: TeamMemberRole;
    isActive: boolean;
  }>,
): Promise<TeamMemberPublic | null> {
  const [row] = await db
    .update(teamMembers)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(teamMembers.id, id))
    .returning();
  return row ? toPublic(row) : null;
}

export async function updateTeamMemberPin(
  id: string,
  pinHash: string,
  pinPlaintext: string,
): Promise<boolean> {
  const [row] = await db
    .update(teamMembers)
    .set({ pin: pinHash, pinPlaintext, updatedAt: new Date() })
    .where(eq(teamMembers.id, id))
    .returning({ id: teamMembers.id });
  return Boolean(row);
}

export async function updateTeamMemberPinPlaintext(
  id: string,
  pinPlaintext: string,
): Promise<boolean> {
  const [row] = await db
    .update(teamMembers)
    .set({ pinPlaintext, updatedAt: new Date() })
    .where(eq(teamMembers.id, id))
    .returning({ id: teamMembers.id });
  return Boolean(row);
}

export async function deactivateTeamMember(id: string): Promise<boolean> {
  const [row] = await db
    .update(teamMembers)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(teamMembers.id, id))
    .returning({ id: teamMembers.id });
  return Boolean(row);
}

/** Sprint 9B: active members with PIN hashes for PIN-only login lookup. */
export async function listActiveTeamMembersWithPinHash(): Promise<
  (typeof teamMembers.$inferSelect)[]
> {
  return db
    .select(teamMemberAuthColumns)
    .from(teamMembers)
    .where(eq(teamMembers.isActive, true))
    .orderBy(asc(teamMembers.displayName));
}
