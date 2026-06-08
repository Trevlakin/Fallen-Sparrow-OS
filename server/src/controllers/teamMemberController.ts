import type { Request, Response, NextFunction } from "express";
import {
  ChangePinSchema,
  CreateTeamMemberSchema,
  UpdateTeamMemberSchema,
} from "../validators/sopValidators.js";
import * as teamMemberService from "../services/teamMemberService.js";
import { AppError } from "../utils/errors.js";

export async function listTeamMembers(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const teamMembers = await teamMemberService.listTeamMembersForAdmin();
    res.json({ teamMembers });
  } catch (err) {
    next(err);
  }
}

export async function createTeamMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = CreateTeamMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid team member payload", 400);
    }
    const { member, pin } = await teamMemberService.createTeamMember({
      name: parsed.data.name,
      role: parsed.data.role,
      pin: parsed.data.pin,
    });
    res.status(201).json({ teamMember: member, pin });
  } catch (err) {
    next(err);
  }
}

export async function updateTeamMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params["id"] ?? "");
    const parsed = UpdateTeamMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid team member payload", 400);
    }
    const teamMember = await teamMemberService.updateTeamMember(id, {
      name: parsed.data.name,
      role: parsed.data.role,
      isActive: parsed.data.isActive,
    });
    res.json({ teamMember });
  } catch (err) {
    next(err);
  }
}

export async function changePin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }
    const id = String(req.params["id"] ?? "");
    const parsed = ChangePinSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("PIN must be exactly 4 digits", 400);
    }
    await teamMemberService.changeTeamMemberPin(id, parsed.data.pin, req.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function deactivateTeamMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params["id"] ?? "");
    await teamMemberService.deactivateTeamMember(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
