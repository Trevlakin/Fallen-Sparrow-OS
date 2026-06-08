import { Router, type IRouter } from "express";
import * as teamMemberController from "../controllers/teamMemberController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager } from "../middleware/rbac.js";

export const teamMembersRouter: IRouter = Router();

teamMembersRouter.get(
  "/",
  requireAuth,
  enforceTenant,
  requireManager,
  teamMemberController.listTeamMembers,
);

teamMembersRouter.post(
  "/",
  requireAuth,
  enforceTenant,
  requireManager,
  teamMemberController.createTeamMember,
);

teamMembersRouter.patch(
  "/:id",
  requireAuth,
  enforceTenant,
  requireManager,
  teamMemberController.updateTeamMember,
);

teamMembersRouter.patch(
  "/:id/pin",
  requireAuth,
  enforceTenant,
  requireManager,
  teamMemberController.changePin,
);

teamMembersRouter.delete(
  "/:id",
  requireAuth,
  enforceTenant,
  requireManager,
  teamMemberController.deactivateTeamMember,
);
