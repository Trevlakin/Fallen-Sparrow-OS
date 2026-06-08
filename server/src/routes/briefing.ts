import { Router, type IRouter } from "express";
import * as briefingController from "../controllers/briefingController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager, requireOwner } from "../middleware/rbac.js";

export const briefingRouter: IRouter = Router();

briefingRouter.post(
  "/generate",
  requireAuth,
  enforceTenant,
  requireOwner,
  briefingController.generate,
);

briefingRouter.get(
  "/latest",
  requireAuth,
  enforceTenant,
  requireManager,
  briefingController.getLatest,
);

briefingRouter.get(
  "/history",
  requireAuth,
  enforceTenant,
  requireManager,
  briefingController.getHistory,
);
