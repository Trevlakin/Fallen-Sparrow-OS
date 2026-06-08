import { Router, type IRouter } from "express";
import * as settingsController from "../controllers/settingsController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager, requireOwner } from "../middleware/rbac.js";

export const settingsRouter: IRouter = Router();

settingsRouter.get(
  "/",
  requireAuth,
  enforceTenant,
  requireManager,
  settingsController.getSettings,
);

settingsRouter.patch(
  "/",
  requireAuth,
  enforceTenant,
  requireOwner,
  settingsController.patchSettings,
);
