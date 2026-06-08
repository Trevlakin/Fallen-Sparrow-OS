import { desc, eq } from "drizzle-orm";
import { pinChangeHistory, teamMembers, users } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";

export async function insertPinChangeRecord(input: {
  teamMemberId: string;
  changedByUserId: string;
  changeReason?: string;
}): Promise<void> {
  await db.insert(pinChangeHistory).values({
    teamMemberId: input.teamMemberId,
    changedByUserId: input.changedByUserId,
    changeReason: input.changeReason ?? "Manual PIN reset by manager",
  });
}

export async function listPinChangeHistory(limit = 50) {
  return db
    .select({
      id: pinChangeHistory.id,
      teamMemberId: pinChangeHistory.teamMemberId,
      memberDisplayName: teamMembers.displayName,
      changedByUserId: pinChangeHistory.changedByUserId,
      changedByEmail: users.email,
      changedAt: pinChangeHistory.changedAt,
      changeReason: pinChangeHistory.changeReason,
    })
    .from(pinChangeHistory)
    .innerJoin(teamMembers, eq(pinChangeHistory.teamMemberId, teamMembers.id))
    .innerJoin(users, eq(pinChangeHistory.changedByUserId, users.id))
    .orderBy(desc(pinChangeHistory.changedAt))
    .limit(limit);
}
