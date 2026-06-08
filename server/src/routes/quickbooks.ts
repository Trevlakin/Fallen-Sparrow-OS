import { Router, type IRouter } from "express";
import * as quickbooksController from "../controllers/quickbooksController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireOwner } from "../middleware/rbac.js";

export const quickbooksRouter: IRouter = Router();

quickbooksRouter.get(
  "/callback",
  quickbooksController.handleCallback,
);

quickbooksRouter.get(
  "/auth-url",
  requireAuth,
  enforceTenant,
  requireOwner,
  quickbooksController.getAuthUrl,
);

quickbooksRouter.get(
  "/status",
  requireAuth,
  enforceTenant,
  quickbooksController.getStatus,
);

quickbooksRouter.post(
  "/sync",
  requireAuth,
  enforceTenant,
  requireOwner,
  quickbooksController.postSync,
);

quickbooksRouter.get(
  "/pl-report",
  requireAuth,
  enforceTenant,
  requireOwner,
  quickbooksController.getPlReport,
);

quickbooksRouter.delete(
  "/disconnect",
  requireAuth,
  enforceTenant,
  requireOwner,
  quickbooksController.deleteConnection,
);
