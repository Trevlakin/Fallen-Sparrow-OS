import { Router, type IRouter } from "express";
import * as extraTaskController from "../controllers/extraTaskController.js";
import { checklistAuth } from "../middleware/checklistAuth.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager } from "../middleware/rbac.js";

export const extraTasksRouter: IRouter = Router();

extraTasksRouter.get(
  "/today",
  checklistAuth,
  extraTaskController.listTodayExtraTasks,
);

extraTasksRouter.get(
  "/open",
  requireAuth,
  enforceTenant,
  requireManager,
  extraTaskController.listOpenExtraTasks,
);

extraTasksRouter.post("/", checklistAuth, extraTaskController.createExtraTask);

extraTasksRouter.patch(
  "/:taskId/status",
  checklistAuth,
  extraTaskController.updateExtraTaskStatus,
);
