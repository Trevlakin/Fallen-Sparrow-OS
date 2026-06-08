import { Router, type IRouter } from "express";
import * as tasksController from "../controllers/tasksController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager } from "../middleware/rbac.js";

export const tasksRouter: IRouter = Router();

tasksRouter.get("/", requireAuth, enforceTenant, requireManager, tasksController.list);
tasksRouter.patch(
  "/:id/complete",
  requireAuth,
  enforceTenant,
  requireManager,
  tasksController.complete,
);
tasksRouter.patch(
  "/:id/reopen",
  requireAuth,
  enforceTenant,
  requireManager,
  tasksController.reopen,
);
tasksRouter.delete(
  "/:id",
  requireAuth,
  enforceTenant,
  requireManager,
  tasksController.remove,
);
