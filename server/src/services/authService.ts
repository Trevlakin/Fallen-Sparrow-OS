import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { User } from "@fallen-sparrow/shared/schema";
import type { UserRole } from "@fallen-sparrow/shared/constants";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";
import * as userRepo from "../repos/userRepo.js";

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface LoginResult {
  token: string;
  user: Omit<User, "passwordHash">;
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
  const payload: AuthTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role as UserRole,
  };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): AuthTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded !== "object" || decoded === null) {
      throw new AppError("Invalid token", 401);
    }
    const sub = "sub" in decoded ? decoded["sub"] : undefined;
    const email = "email" in decoded ? decoded["email"] : undefined;
    const role = "role" in decoded ? decoded["role"] : undefined;
    if (
      typeof sub !== "string" ||
      typeof email !== "string" ||
      typeof role !== "string"
    ) {
      throw new AppError("Invalid token payload", 401);
    }
    return { sub, email, role: role as UserRole };
  } catch {
    throw new AppError("Invalid or expired token", 401);
  }
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

export async function getUserFromPayload(
  payload: AuthTokenPayload,
): Promise<User> {
  const user = await userRepo.findUserById(payload.sub);
  if (!user || !user.isActive) {
    throw new AppError("User not found or inactive", 401);
  }
  return user;
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
