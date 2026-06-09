import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { User } from "@fallen-sparrow/shared/schema";
import type { TeamMemberRole, UserRole } from "@fallen-sparrow/shared/constants";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";
import * as userRepo from "../repos/userRepo.js";
import * as teamMemberRepo from "../repos/teamMemberRepo.js";
import * as teamMemberService from "./teamMemberService.js";

const PIN_SESSION_EXPIRES_IN = "8h";

export interface UserAuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface PinAuthTokenPayload {
  sub: string;
  email: string;
  role: TeamMemberRole;
  authType: "pin";
  displayName: string;
}

export type VerifiedAuthPayload = UserAuthTokenPayload | PinAuthTokenPayload;

export interface LoginResult {
  token: string;
  user: Omit<User, "passwordHash">;
}

export interface PinLoginResult {
  token: string;
  employeeId: string;
  name: string;
  role: TeamMemberRole;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(user: User): string {
  const payload: UserAuthTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role as UserRole,
  };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function signPinToken(member: {
  id: string;
  displayName: string;
  role: TeamMemberRole;
}): string {
  const payload: PinAuthTokenPayload = {
    sub: member.id,
    email: pinStaffEmail(member.id),
    role: member.role,
    authType: "pin",
    displayName: member.displayName,
  };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: PIN_SESSION_EXPIRES_IN,
  } as jwt.SignOptions);
}

function pinStaffEmail(teamMemberId: string): string {
  return `pin-${teamMemberId}@staff.internal`;
}

export function verifyToken(token: string): VerifiedAuthPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded !== "object" || decoded === null) {
      throw new AppError("Invalid token", 401);
    }
    const sub = "sub" in decoded ? decoded["sub"] : undefined;
    const email = "email" in decoded ? decoded["email"] : undefined;
    const role = "role" in decoded ? decoded["role"] : undefined;
    const authType = "authType" in decoded ? decoded["authType"] : undefined;
    const displayName =
      "displayName" in decoded ? decoded["displayName"] : undefined;

    if (
      typeof sub !== "string" ||
      typeof email !== "string" ||
      typeof role !== "string"
    ) {
      throw new AppError("Invalid token payload", 401);
    }

    if (authType === "pin") {
      if (typeof displayName !== "string") {
        throw new AppError("Invalid token payload", 401);
      }
      return {
        sub,
        email,
        role: role as TeamMemberRole,
        authType: "pin",
        displayName,
      };
    }

    return { sub, email, role: role as UserRole };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Invalid or expired token", 401);
  }
}

export function isPinAuthPayload(
  payload: VerifiedAuthPayload,
): payload is PinAuthTokenPayload {
  return "authType" in payload && payload.authType === "pin";
}

/** User-table FK columns: PIN sessions use team member ids, not users.id. */
export function resolveAuditUserId(
  payload: VerifiedAuthPayload | undefined,
): string | undefined {
  if (!payload || isPinAuthPayload(payload)) {
    return undefined;
  }
  return payload.sub;
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  const user = await userRepo.findUserByEmail(email);
  if (!user || !user.isActive) {
    throw new AppError("Invalid email or password", 401);
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new AppError("Invalid email or password", 401);
  }
  const token = signToken(user);
  const { passwordHash: _removed, ...safeUser } = user;
  return { token, user: safeUser };
}

export async function pinLogin(pin: string): Promise<PinLoginResult> {
  const member = await teamMemberService.findTeamMemberByPin(pin);
  if (!member) {
    throw new AppError("Invalid PIN", 401);
  }
  const token = signPinToken(member);
  return {
    token,
    employeeId: member.id,
    name: member.displayName,
    role: member.role,
  };
}

function teamMemberRoleToUserRole(role: TeamMemberRole): UserRole {
  if (
    role === "OWNER" ||
    role === "MANAGER" ||
    role === "FRONT_DESK" ||
    role === "ARTIST"
  ) {
    return role;
  }
  return "FRONT_DESK";
}

function teamMemberToSyntheticUser(
  member: NonNullable<Awaited<ReturnType<typeof teamMemberRepo.findTeamMemberById>>>,
  displayName: string,
): User {
  const nameParts = member.name.trim().split(/\s+/);
  return {
    id: member.id,
    email: pinStaffEmail(member.id),
    passwordHash: "",
    firstName: nameParts[0] ?? displayName,
    lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : "",
    role: teamMemberRoleToUserRole(member.role as TeamMemberRole),
    phone: null,
    isActive: member.isActive,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

export async function getUserFromPayload(
  payload: VerifiedAuthPayload,
): Promise<User> {
  if (isPinAuthPayload(payload)) {
    const member = await teamMemberRepo.findTeamMemberById(payload.sub);
    if (!member || !member.isActive) {
      throw new AppError("Team member not found or inactive", 401);
    }
    return teamMemberToSyntheticUser(member, payload.displayName);
  }

  const user = await userRepo.findUserById(payload.sub);
  if (!user || !user.isActive) {
    throw new AppError("User not found or inactive", 401);
  }
  return user;
}

export function getAuthRole(payload: VerifiedAuthPayload): string {
  return payload.role;
}

export function sanitizeUser(user: User): Omit<User, "passwordHash"> {
  const { passwordHash: _removed, ...safe } = user;
  return safe;
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await userRepo.findUserById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AppError("Current password is incorrect", 401);
  }
  if (newPassword.length < 8) {
    throw new AppError("New password must be at least 8 characters", 400);
  }
  const passwordHash = await hashPassword(newPassword);
  await userRepo.updatePasswordHash(userId, passwordHash);
}
