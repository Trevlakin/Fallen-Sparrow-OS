import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as authService from "../services/authService.js";
import { AppError } from "../utils/errors.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid login payload", 400);
    }
    const result = await authService.login(
      parsed.data.email,
      parsed.data.password,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function me(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }
    res.json({ user: authService.sanitizeUser(req.user) });
  } catch (err) {
    next(err);
  }
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid password payload", 400);
    }
    await authService.changePassword(
      req.user.id,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
