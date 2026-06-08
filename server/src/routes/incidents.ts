import { Router, type IRouter } from "express";
import * as incidentsController from "../controllers/incidentsController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager } from "../middleware/rbac.js";

export const incidentsRouter: IRouter = Router();

incidentsRouter.get(
  "/",
  requireAuth,
  enforceTenant,
  requireManager,
  incidentsController.list,
);
incidentsRouter.patch(
  "/:id/resolve",
  requireAuth,
  enforceTenant,
  requireManager,
  incidentsController.resolve,
);
incidentsRouter.patch(
  "/:id/reopen",
  requireAuth,
  enforceTenant,
  requireManager,
  incidentsController.reopen,
);
incidentsRouter.delete(
  "/:id",
  requireAuth,
  enforceTenant,
  requireManager,
  incidentsController.remove,
);
