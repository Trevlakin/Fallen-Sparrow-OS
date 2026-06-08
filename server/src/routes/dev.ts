import { Router, type IRouter } from "express";
import * as devController from "../controllers/devController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";

export const devRouter: IRouter = Router();

devRouter.post(
  "/reset-dashboard",
  requireAuth,
  requireRoles("OWNER"),
  devController.resetDashboard,
);

devRouter.post(
  "/cleanup-duplicate-tasks",
  requireAuth,
  requireRoles("OWNER"),
  devController.cleanupDuplicateTasks,
);
