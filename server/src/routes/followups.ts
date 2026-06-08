import { Router, type IRouter } from "express";
import * as followupController from "../controllers/followupController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager } from "../middleware/rbac.js";

export const followupsRouter: IRouter = Router();

followupsRouter.get(
  "/due-today",
  requireAuth,
  enforceTenant,
  requireManager,
  followupController.getDueToday,
);

followupsRouter.get(
  "/upcoming",
  requireAuth,
  enforceTenant,
  requireManager,
  followupController.getUpcoming,
);

followupsRouter.post(
  "/:id/contact",
  requireAuth,
  enforceTenant,
  requireManager,
  followupController.logContact,
);

followupsRouter.post(
  "/:id/close",
  requireAuth,
  enforceTenant,
  requireManager,
  followupController.closeFollowup,
);
