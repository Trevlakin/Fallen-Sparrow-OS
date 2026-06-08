import { randomInt, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { UserRole, TeamMemberRole } from "@fallen-sparrow/shared/constants";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";
import { formatDateInTimezone } from "../lib/timezone.js";
import * as sopRepo from "../repos/sopRepo.js";

export interface RoleCompletionStatus {
  sopId: string;
  sopTitle: string;
  role: UserRole | null;
  roleLabel: string;
  totalItems: number;
  completedToday: number;
  pct: number;
  lastActivity: Date | null;
}

export interface ChecklistSessionPayload {
  accessId: string;
  sopId: string;
  label: string;
  type: "checklist_session";
}

export function generateAccessToken(): string {
  return randomUUID();
}

function generatePin(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

function roleLabel(role: UserRole | null, roles: TeamMemberRole[]): string {
  if (roles.length > 0) {
    return roles[0]!.replace(/_/g, " ");
  }
  if (!role) return "CLEANER";
  return role.replace(/_/g, " ");
}

function formatDateISO(date: Date, timezone: string): string {
  return formatDateInTimezone(date, timezone);
}

function addDaysISO(dateISO: string, delta: number): string {
  const d = new Date(`${dateISO}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export async function getTodayCompletions(
  sopId: string,
  sessionDate: string,
): Promise<
  {
    itemId: string;
    label: string;
    completed: boolean;
    completedAt: Date | null;
    completedByLabel: string | null;
  }[]
> {
  return sopRepo.getCompletionsForSopAndDate(sopId, sessionDate);
}

export async function completeItem(
  itemId: string,
  sessionDate: string,
  params: { userId?: string; accessLabel?: string },
): Promise<void> {
  const existing = await sopRepo.findCompletion(itemId, sessionDate);
  if (existing) {
    return;
  }
  await sopRepo.insertCompletion({
    itemId,
    sessionDate,
    userId: params.userId,
    accessLabel: params.accessLabel,
  });
}

export async function uncompleteItem(
  itemId: string,
  sessionDate: string,
): Promise<void> {
  await sopRepo.deleteCompletion(itemId, sessionDate);
}

export async function getTodayStatusAllRoles(
  sessionDate?: string,
  timezone = env.DEFAULT_TIMEZONE,
): Promise<RoleCompletionStatus[]> {
  const date = sessionDate ?? formatDateISO(new Date(), timezone);
  const activeSops = await sopRepo.listActiveSopsWithItems();

  const results: RoleCompletionStatus[] = [];
  for (const sop of activeSops) {
    const { completed, total, lastActivity } =
      await sopRepo.countCompletionsForSopOnDate(sop.id, date);
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    results.push({
      sopId: sop.id,
      sopTitle: sop.title,
      role: sop.role,
      roleLabel: roleLabel(sop.role, sop.roles),
      totalItems: total,
      completedToday: completed,
      pct,
      lastActivity,
    });
  }

  return results;
}

export async function getCompletionHistory(
  sopId: string,
  days: number,
  timezone = env.DEFAULT_TIMEZONE,
): Promise<{ date: string; completedCount: number; totalItems: number; pct: number }[]> {
  const sop = await sopRepo.findSopById(sopId);
  if (!sop) {
    throw new AppError("SOP not found", 404);
  }

  const totalItems = sop.items.length;
  const today = formatDateISO(new Date(), timezone);
  const fromDate = addDaysISO(today, -(days - 1));
  const counts = await sopRepo.getCompletionCountsByDate(sopId, fromDate, today);

  const history: { date: string; completedCount: number; totalItems: number; pct: number }[] =
    [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDaysISO(today, -i);
    const completedCount = counts.get(date) ?? 0;
    const pct =
      totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
    history.push({ date, completedCount, totalItems, pct });
  }

  return history;
}

export async function listAllSops() {
  return sopRepo.listAllSopsWithItems();
}

export async function createSop(input: {
  title: string;
  roles: TeamMemberRole[];
  sortOrder?: number;
  items?: { label: string; sortOrder: number }[];
}) {
  return sopRepo.createSopWithItems({
    title: input.title,
    roles: input.roles,
    sortOrder: input.sortOrder,
    items: input.items,
  });
}

export async function updateSopAdmin(
  sopId: string,
  input: {
    title?: string;
    roles?: TeamMemberRole[];
    isActive?: boolean;
    sortOrder?: number;
  },
) {
  const updated = await sopRepo.updateSopMeta(sopId, input);
  if (!updated) {
    throw new AppError("SOP not found", 404);
  }
  return updated;
}

export async function addSopChecklistItem(
  sopId: string,
  input: { text: string; sortOrder?: number },
) {
  const sop = await sopRepo.findSopById(sopId);
  if (!sop) {
    throw new AppError("SOP not found", 404);
  }
  const sortOrder =
    input.sortOrder ??
    sop.items.filter((i) => i.isActive !== false).length;
  const row = await sopRepo.addChecklistItem(sopId, {
    label: input.text,
    sortOrder,
  });
  if (!row) {
    throw new AppError("Failed to add checklist item", 500);
  }
  return row;
}

export async function updateSopChecklistItem(
  sopId: string,
  itemId: string,
  input: { text?: string; sortOrder?: number; isActive?: boolean },
) {
  const row = await sopRepo.updateChecklistItem(sopId, itemId, {
    ...(input.text !== undefined ? { label: input.text } : {}),
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  });
  if (!row) {
    throw new AppError("Checklist item not found", 404);
  }
  return row;
}

export async function removeSopChecklistItem(
  sopId: string,
  itemId: string,
): Promise<void> {
  const ok = await sopRepo.softDeleteChecklistItem(sopId, itemId);
  if (!ok) {
    throw new AppError("Checklist item not found", 404);
  }
}

export async function listSopsGroupedByRole() {
  const sops = await sopRepo.listAllSopsWithItems();
  const grouped: Record<string, typeof sops> = {};
  for (const sop of sops) {
    const roles =
      sop.roles.length > 0
        ? sop.roles
        : sop.role
          ? [sop.role as TeamMemberRole]
          : (["CLEANER"] as TeamMemberRole[]);
    for (const role of roles) {
      grouped[role] = grouped[role] ?? [];
      grouped[role].push(sop);
    }
  }
  return grouped;
}

export async function createSopLegacy(input: {
  title: string;
  role: UserRole | null;
  frequency: string;
  items: { label: string; sortOrder: number }[];
}) {
  const roles: TeamMemberRole[] = input.role ? [input.role] : ["CLEANER"];
  return sopRepo.createSopWithItems({
    title: input.title,
    roles,
    frequency: input.frequency,
    items: input.items,
  });
}

export async function updateSop(
  sopId: string,
  input: {
    title: string;
    role: UserRole | null;
    frequency: string;
    items: { label: string; sortOrder: number }[];
  },
) {
  const roles: TeamMemberRole[] = input.role ? [input.role] : ["CLEANER"];
  const updated = await sopRepo.updateSopWithItems(sopId, {
    ...input,
    roles,
  });
  if (!updated) {
    throw new AppError("SOP not found", 404);
  }
  return updated;
}

export async function deleteSop(sopId: string): Promise<void> {
  const ok = await sopRepo.softDeleteSop(sopId);
  if (!ok) {
    throw new AppError("SOP not found", 404);
  }
}

export async function getMyChecklist(role: UserRole, sessionDate: string) {
  const sop = await sopRepo.findActiveSopByRole(role);
  if (!sop) {
    return null;
  }
  const items = await getTodayCompletions(sop.id, sessionDate);
  return { sop, items };
}

export async function listAccessCodes() {
  return sopRepo.listAccessCodes();
}

export async function createAccessCode(input: { label: string; sopId: string }) {
  const sop = await sopRepo.findSopById(input.sopId);
  if (!sop || !sop.isActive) {
    throw new AppError("SOP not found", 404);
  }

  const accessToken = generateAccessToken();
  const pin = generatePin();
  const row = await sopRepo.createAccessCode({
    label: input.label,
    sopId: input.sopId,
    accessToken,
    pin,
  });

  return {
    id: row.id,
    accessToken: row.accessToken,
    pin: row.pin ?? pin,
    qrUrl: `/checklist?token=${row.accessToken}`,
  };
}

export async function revokeAccessCode(accessId: string): Promise<void> {
  const ok = await sopRepo.deactivateAccessCode(accessId);
  if (!ok) {
    throw new AppError("Access code not found", 404);
  }
}

export function signChecklistSession(payload: {
  accessId: string;
  sopId: string;
  label: string;
}): string {
  const full: ChecklistSessionPayload = {
    ...payload,
    type: "checklist_session",
  };
  return jwt.sign(full, env.JWT_SECRET, { expiresIn: "8h" });
}

export function verifyChecklistSession(token: string): ChecklistSessionPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded !== "object" || decoded === null) {
      throw new AppError("Invalid session token", 401);
    }
    const type = "type" in decoded ? decoded["type"] : undefined;
    const accessId = "accessId" in decoded ? decoded["accessId"] : undefined;
    const sopId = "sopId" in decoded ? decoded["sopId"] : undefined;
    const label = "label" in decoded ? decoded["label"] : undefined;
    if (
      type !== "checklist_session" ||
      typeof accessId !== "string" ||
      typeof sopId !== "string" ||
      typeof label !== "string"
    ) {
      throw new AppError("Invalid session token payload", 401);
    }
    return { type: "checklist_session", accessId, sopId, label };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Invalid or expired session token", 401);
  }
}

export async function verifyChecklistAccess(input: {
  token?: string;
  pin?: string;
}): Promise<{
  accessId: string;
  sopId: string;
  label: string;
  sessionToken: string;
}> {
  let access: Awaited<ReturnType<typeof sopRepo.findAccessByToken>> = null;

  if (input.token) {
    access = await sopRepo.findAccessByToken(input.token);
  } else if (input.pin) {
    access = await sopRepo.findAccessByPin(input.pin);
  } else {
    throw new AppError("Token or PIN required", 400);
  }

  if (!access || !access.isActive) {
    throw new AppError("Invalid or inactive access code", 401);
  }

  await sopRepo.touchAccessLastUsed(access.id);

  const sessionToken = signChecklistSession({
    accessId: access.id,
    sopId: access.sopId,
    label: access.label,
  });

  return {
    accessId: access.id,
    sopId: access.sopId,
    label: access.label,
    sessionToken,
  };
}

export async function getChecklistForSession(
  session: ChecklistSessionPayload,
  sessionDate: string,
) {
  const access = await sopRepo.findAccessById(session.accessId);
  if (!access || !access.isActive) {
    throw new AppError("Access code revoked", 401);
  }

  const sop = await sopRepo.findSopById(session.sopId);
  if (!sop || !sop.isActive) {
    throw new AppError("Checklist not available", 404);
  }

  const items = await getTodayCompletions(sop.id, sessionDate);
  return {
    label: session.label,
    sop: {
      id: sop.id,
      title: sop.title,
      frequency: sop.frequency,
    },
    items,
  };
}

export async function assertItemBelongsToSop(
  itemId: string,
  sopId: string,
): Promise<void> {
  const row = await sopRepo.findChecklistItemSopId(itemId);
  if (!row || row.sopId !== sopId) {
    throw new AppError("Checklist item not found", 404);
  }
}

export function summarizeChecklistStatus(
  statuses: RoleCompletionStatus[],
): string {
  if (statuses.length === 0) {
    return "No checklists configured.";
  }

  const withItems = statuses.filter((s) => s.totalItems > 0);
  if (withItems.length === 0) {
    return "No checklists configured.";
  }

  const allComplete = withItems.every((s) => s.pct === 100);
  if (allComplete) {
    return "All checklists complete today.";
  }

  const noneStarted = withItems.every((s) => s.completedToday === 0);
  if (noneStarted) {
    return "No checklists completed today.";
  }

  const incomplete = withItems
    .filter((s) => s.pct < 100)
    .map(
      (s) =>
        `${s.sopTitle} (${s.completedToday}/${s.totalItems} items done)`,
    );
  return `Incomplete: ${incomplete.join("; ")}.`;
}
