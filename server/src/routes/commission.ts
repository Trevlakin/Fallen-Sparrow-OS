import { Router, type IRouter } from "express";
import * as commissionController from "../controllers/commissionController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager, requireOwner } from "../middleware/rbac.js";

export const commissionRouter: IRouter = Router();

commissionRouter.get(
  "/summary",
  requireAuth,
  enforceTenant,
  requireManager,
  commissionController.getSummary,
);

commissionRouter.get(
  "/artist/:id",
  requireAuth,
  enforceTenant,
  requireManager,
  commissionController.getArtist,
);

commissionRouter.post(
  "/override",
  requireAuth,
  enforceTenant,
  requireOwner,
  commissionController.postOverride,
);
