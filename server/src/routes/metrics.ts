import { Router, type IRouter } from "express";
import * as metricsController from "../controllers/metricsController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireRoles } from "../middleware/rbac.js";

export const metricsRouter: IRouter = Router();

metricsRouter.get(
  "/daily",
  requireAuth,
  enforceTenant,
  metricsController.getDaily,
);

metricsRouter.get(
  "/weekly",
  requireAuth,
  enforceTenant,
  metricsController.getWeekly,
);

metricsRouter.get(
  "/monthly",
  requireAuth,
  enforceTenant,
  requireRoles("OWNER", "MANAGER"),
  metricsController.getMonthly,
);

metricsRouter.get(
  "/ytd",
  requireAuth,
  enforceTenant,
  requireRoles("OWNER", "MANAGER"),
  metricsController.getYtd,
);
