import jwt from "jsonwebtoken";
import type { TeamMemberRole } from "@fallen-sparrow/shared/constants";
import { getStudioDateFromTimestamp } from "@fallen-sparrow/shared";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";
import * as sopCompletionRepo from "../repos/sopCompletionRepo.js";
import * as sopRepo from "../repos/sopRepo.js";
import * as teamMemberService from "./teamMemberService.js";

export interface ChecklistAuthPayload {
  teamMemberId: string;
  role: TeamMemberRole;
  type: "checklist";
}

export function signChecklistToken(payload: {
  teamMemberId: string;
  role: TeamMemberRole;
}): string {
  const full: ChecklistAuthPayload = {
    ...payload,
    type: "checklist",
  };
  return jwt.sign(full, env.JWT_SECRET, { expiresIn: "12h" });
}

export function verifyChecklistToken(token: string): ChecklistAuthPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded !== "object" || decoded === null) {
      throw new AppError("Invalid session token", 401);
    }
    const type = "type" in decoded ? decoded["type"] : undefined;
    const teamMemberId =
      "teamMemberId" in decoded ? decoded["teamMemberId"] : undefined;
    const role = "role" in decoded ? decoded["role"] : undefined;
    if (
      type !== "checklist" ||
      typeof teamMemberId !== "string" ||
      typeof role !== "string"
    ) {
      throw new AppError("Invalid session token payload", 401);
    }
    return {
      type: "checklist",
      teamMemberId,
      role: role as TeamMemberRole,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Invalid or expired session token", 401);
  }
}

export async function pinLogin(teamMemberId: string, pin: string) {
  const member = await teamMemberService.authenticateTeamMemberPin(
    teamMemberId,
    pin,
  );
  const sessionToken = signChecklistToken({
    teamMemberId: member.id,
    role: member.role,
  });
  return { sessionToken, teamMember: member };
}

export async function getTodayChecklist(
  teamMemberId: string,
  role: TeamMemberRole,
  sessionDate: string,
) {
  const row = await import("../repos/teamMemberRepo.js").then((m) =>
    m.findTeamMemberById(teamMemberId),
  );
  if (!row || !row.isActive) {
    throw new AppError("Team member not found", 404);
  }
  const teamMember = {
    id: row.id,
    displayName: row.displayName,
    role: row.role as TeamMemberRole,
  };

  const activeSops = await sopRepo.listActiveSopsForRole(role);
  const sopsWithItems = await Promise.all(
    activeSops.map(async (sop) => {
      const activeItems = sop.items.filter((i) => i.isActive !== false);
      const items = await Promise.all(
        activeItems.map(async (item) => {
          const completion = await sopCompletionRepo.findTeamMemberCompletion(
            item.id,
            teamMemberId,
            sessionDate,
          );
          const isValidCompletion =
            completion !== null &&
            completion.completedAt !== null &&
            getStudioDateFromTimestamp(
              completion.completedAt,
              env.DEFAULT_TIMEZONE,
            ) === sessionDate;
          return {
            id: item.id,
            text: item.label,
            sortOrder: item.sortOrder ?? 0,
            completed: isValidCompletion,
            completedAt: isValidCompletion ? completion.completedAt : null,
          };
        }),
      );
      const completedCount = items.filter((i) => i.completed).length;
      return {
        id: sop.id,
        title: sop.title,
        items,
        completedCount,
        totalCount: items.length,
      };
    }),
  );

  const completed = sopsWithItems.reduce((sum, s) => sum + s.completedCount, 0);
  const total = sopsWithItems.reduce((sum, s) => sum + s.totalCount, 0);

  return {
    teamMember: {
      id: teamMember.id,
      displayName: teamMember.displayName,
      role: teamMember.role,
    },
    sops: sopsWithItems,
    overallProgress: { completed, total },
  };
}

export async function completeChecklistItem(
  teamMemberId: string,
  itemId: string,
  sessionDate: string,
  role: TeamMemberRole,
): Promise<void> {
  await assertItemAccessibleByRole(itemId, role);
  const existing = await sopCompletionRepo.findTeamMemberCompletion(
    itemId,
    teamMemberId,
    sessionDate,
  );
  if (existing) {
    // Row exists for this session but may carry a stale timestamp that fails
    // the studio-day display check; re-stamp it so the item reads as done.
    await sopCompletionRepo.touchTeamMemberCompletion(existing.id);
    return;
  }
  await sopCompletionRepo.insertTeamMemberCompletion({
    itemId,
    teamMemberId,
    sessionDate,
  });
}

export async function uncompleteChecklistItem(
  teamMemberId: string,
  itemId: string,
  sessionDate: string,
  role: TeamMemberRole,
): Promise<void> {
  await assertItemAccessibleByRole(itemId, role);
  await sopCompletionRepo.deleteTeamMemberCompletion(
    itemId,
    teamMemberId,
    sessionDate,
  );
}

async function assertItemAccessibleByRole(
  itemId: string,
  role: TeamMemberRole,
): Promise<void> {
  const row = await sopRepo.findChecklistItemWithRoles(itemId);
  if (!row || !row.isActive) {
    throw new AppError("Checklist item not found", 404);
  }
  if (!row.roles.includes(role)) {
    throw new AppError("Checklist item not found", 404);
  }
}

export function formatYesterdaySopSummary(
  lines: Awaited<
    ReturnType<typeof sopCompletionRepo.getYesterdayCompletionSummary>
  >,
): string {
  if (lines.length === 0) {
    return "No SOP checklists configured.";
  }

  return lines
    .map((line) => {
      const rolePrefix = `${line.roleLabel}: ${line.sopTitle}`;
      if (!line.memberDisplayName) {
        return `${rolePrefix}: not completed`;
      }
      if (line.totalCount === 0) {
        return `${rolePrefix}: no checklist items configured`;
      }
      const time =
        line.lastCompletedAt && line.completedCount === line.totalCount
          ? ` at ${line.lastCompletedAt.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}`
          : "";
      if (line.completedCount === line.totalCount) {
        return `${rolePrefix}: ${line.memberDisplayName} ✓ (${line.completedCount}/${line.totalCount}${time})`;
      }
      const missed =
        line.missedItemLabels.length > 0
          ? ` (missed: ${line.missedItemLabels.map((m) => `"${m}"`).join(", ")})`
          : "";
      return `${rolePrefix}: ${line.memberDisplayName} (${line.completedCount}/${line.totalCount}${missed})`;
    })
    .join("\n");
}

export async function getYesterdaySopSummaryText(
  sessionDate: string,
): Promise<string> {
  const lines = await sopCompletionRepo.getYesterdayCompletionSummary(sessionDate);
  return formatYesterdaySopSummary(lines);
}
