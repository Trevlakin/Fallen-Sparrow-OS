import { randomInt } from "node:crypto";
import bcrypt from "bcrypt";
import type { TeamMemberRole } from "@fallen-sparrow/shared/constants";
import { AppError } from "../utils/errors.js";
import * as teamMemberRepo from "../repos/teamMemberRepo.js";
import * as pinChangeHistoryRepo from "../repos/pinChangeHistoryRepo.js";

const PIN_SALT_ROUNDS = 10;

export function generatePin(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, PIN_SALT_ROUNDS);
}

export async function verifyPinHash(
  pin: string,
  pinHash: string,
): Promise<boolean> {
  return bcrypt.compare(pin, pinHash);
}

export async function generateDisplayName(fullName: string): Promise<string> {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? fullName.trim();
  const lastInitial =
    parts.length > 1 ? parts[parts.length - 1]!.charAt(0).toUpperCase() : null;

  const existing = await teamMemberRepo.findActiveByFirstNamePrefix(firstName);

  if (existing.length > 0 && lastInitial) {
    return `${firstName} ${lastInitial}`;
  }
  return firstName;
}

export async function listTeamMembersForAdmin() {
  const members = await teamMemberRepo.listAllTeamMembers();
  return members.map((member) => ({
    ...member,
    pinVisible: false,
  }));
}

export async function listTeamMembersForChecklist() {
  return teamMemberRepo.listActiveTeamMembers();
}

export async function createTeamMember(input: {
  name: string;
  role: TeamMemberRole;
  pin?: string;
}) {
  const pin = input.pin ?? generatePin();
  const displayName = await generateDisplayName(input.name);
  const pinHash = await hashPin(pin);
  const member = await teamMemberRepo.insertTeamMember({
    name: input.name.trim(),
    displayName,
    role: input.role,
    pinHash,
  });
  return { member, pin };
}

export async function updateTeamMember(
  id: string,
  input: Partial<{ name: string; role: TeamMemberRole; isActive: boolean }>,
) {
  let displayName: string | undefined;
  if (input.name) {
    displayName = await generateDisplayName(input.name);
  }
  const updated = await teamMemberRepo.updateTeamMember(id, {
    ...input,
    ...(displayName ? { displayName } : {}),
  });
  if (!updated) {
    throw new AppError("Team member not found", 404);
  }
  return updated;
}

export async function changeTeamMemberPin(
  id: string,
  pin: string,
  changedByUserId?: string,
) {
  const member = await teamMemberRepo.findTeamMemberById(id);
  if (!member || !member.isActive) {
    throw new AppError("Team member not found", 404);
  }
  const pinHash = await hashPin(pin);
  const ok = await teamMemberRepo.updateTeamMemberPin(id, pinHash);
  if (!ok) {
    throw new AppError("Team member not found", 404);
  }
  if (changedByUserId) {
    await pinChangeHistoryRepo.insertPinChangeRecord({
      teamMemberId: id,
      changedByUserId,
      changeReason: "Manual PIN reset by manager",
    });
  }
}

export async function deactivateTeamMember(id: string) {
  const ok = await teamMemberRepo.deactivateTeamMember(id);
  if (!ok) {
    throw new AppError("Team member not found", 404);
  }
}

export async function authenticateTeamMemberPin(
  teamMemberId: string,
  pin: string,
) {
  const member = await teamMemberRepo.findTeamMemberById(teamMemberId);
  if (!member || !member.isActive) {
    throw new AppError("Incorrect PIN, try again", 401);
  }
  const valid = await verifyPinHash(pin, member.pin);
  if (!valid) {
    throw new AppError("Incorrect PIN, try again", 401);
  }
  return {
    id: member.id,
    displayName: member.displayName,
    role: member.role as TeamMemberRole,
  };
}
