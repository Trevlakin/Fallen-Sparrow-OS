import type { TeamMemberRole } from "@fallen-sparrow/shared/constants";
import { TEAM_MEMBER_ROLES } from "@fallen-sparrow/shared/constants";
import { AppError } from "../utils/errors.js";
import * as teamMemberRepo from "../repos/teamMemberRepo.js";
import * as teamMemberService from "./teamMemberService.js";

export interface TeamCommandResult {
  action: "add_team_member" | "change_pin" | "deactivate_team_member";
  message: string;
  pin?: string;
}

const ROLE_PHRASES: Record<string, TeamMemberRole> = {
  "front desk": "FRONT_DESK",
  "frontdesk": "FRONT_DESK",
  artist: "ARTIST",
  artists: "ARTIST",
  cleaner: "CLEANER",
  cleaners: "CLEANER",
  manager: "MANAGER",
  owner: "OWNER",
};

function normalizeCommand(text: string): string {
  return text.trim().toLowerCase();
}

function parseRolePhrase(raw: string): TeamMemberRole | null {
  const key = raw.trim().toLowerCase();
  return ROLE_PHRASES[key] ?? null;
}

function parseAddMemberCommand(text: string): { name: string; role: TeamMemberRole } | null {
  const match = text.match(
    /^add\s+([a-z][a-z\s'-]{0,40}?)\s+to\s+(?:the\s+)?(front desk|frontdesk|artist|artists|cleaner|cleaners|manager|owner)s?\.?$/i,
  );
  if (!match) return null;
  const name = match[1]!.trim();
  const role = parseRolePhrase(match[2]!);
  if (!name || !role) return null;
  return { name, role };
}

function parseChangePinCommand(
  text: string,
): { name: string; pin: string } | null {
  const match = text.match(
    /^change\s+([a-z][a-z\s'-]{0,40}?)'?s?\s+pin\s+to\s+(\d{4})\.?$/i,
  );
  if (!match) return null;
  return { name: match[1]!.trim(), pin: match[2]! };
}

function parseDeactivateCommand(text: string): { name: string } | null {
  const match = text.match(/^deactivate\s+([a-z][a-z\s'-]{0,40}?)\.?$/i);
  if (!match) return null;
  return { name: match[1]!.trim() };
}

async function findMemberByNamePrefix(name: string) {
  const first = name.split(/\s+/)[0] ?? name;
  const matches = await teamMemberRepo.findActiveByDisplayNamePrefix(first);
  if (matches.length === 0) {
    return null;
  }
  const exact = matches.find(
    (m) => m.displayName.toLowerCase() === name.toLowerCase(),
  );
  if (exact) return exact;
  const byName = matches.find((m) =>
    m.name.toLowerCase().startsWith(name.toLowerCase()),
  );
  if (byName) return byName;
  if (matches.length === 1) return matches[0]!;
  return (
    matches.find((m) =>
      m.displayName.toLowerCase().startsWith(name.toLowerCase()),
    ) ?? null
  );
}

export async function tryExecuteTeamCommand(
  rawText: string,
  changedByUserId?: string,
): Promise<TeamCommandResult | null> {
  const text = normalizeCommand(rawText);
  if (!text) return null;

  const add = parseAddMemberCommand(text);
  if (add) {
    if (!TEAM_MEMBER_ROLES.includes(add.role)) {
      throw new AppError(`Unsupported role for team member: ${add.role}`, 400);
    }
    const { member, pin } = await teamMemberService.createTeamMember({
      name: add.name,
      role: add.role,
    });
    return {
      action: "add_team_member",
      message: `Added ${member.displayName} to ${add.role.replace(/_/g, " ")}. PIN is ${pin}. Write this down.`,
      pin,
    };
  }

  const pinChange = parseChangePinCommand(text);
  if (pinChange) {
    const member = await findMemberByNamePrefix(pinChange.name);
    if (!member) {
      throw new AppError(`No active team member found matching "${pinChange.name}"`, 404);
    }
    await teamMemberService.changeTeamMemberPin(
      member.id,
      pinChange.pin,
      changedByUserId,
    );
    return {
      action: "change_pin",
      message: `${member.displayName}'s PIN changed to ${pinChange.pin}`,
    };
  }

  const deactivate = parseDeactivateCommand(text);
  if (deactivate) {
    const member = await findMemberByNamePrefix(deactivate.name);
    if (!member) {
      throw new AppError(`No active team member found matching "${deactivate.name}"`, 404);
    }
    await teamMemberService.deactivateTeamMember(member.id);
    return {
      action: "deactivate_team_member",
      message: `${member.displayName} has been deactivated`,
    };
  }

  return null;
}

export const JARVIS_TEAM_COMMAND_HINTS = [
  "Add Sarah to front desk",
  "Add Carlos to artists",
  "Change Courtney's PIN to 5555",
  "Deactivate Sarah",
] as const;
