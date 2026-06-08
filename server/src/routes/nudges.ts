import { Router, type IRouter } from "express";
import * as nudgeController from "../controllers/nudgeController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager, requireRoles } from "../middleware/rbac.js";

export const nudgesRouter: IRouter = Router();

nudgesRouter.get(
  "/candidates",
  requireAuth,
  enforceTenant,
  requireRoles("OWNER", "MANAGER", "FRONT_DESK"),
  nudgeController.getCandidates,
);

nudgesRouter.post(
  "/:customerId/send",
  requireAuth,
  enforceTenant,
  requireManager,
  nudgeController.sendNudge,
);

nudgesRouter.patch(
  "/:nudgeId/resonated",
  requireAuth,
  enforceTenant,
  requireManager,
  nudgeController.markResonated,
);
