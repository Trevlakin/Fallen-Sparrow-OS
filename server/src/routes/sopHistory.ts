import { Router, type IRouter } from "express";
import * as sopHistoryController from "../controllers/sopHistoryController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager } from "../middleware/rbac.js";

export const sopHistoryRouter: IRouter = Router();

sopHistoryRouter.get(
  "/by-role/:role",
  requireAuth,
  enforceTenant,
  requireManager,
  sopHistoryController.getHistoryByRole,
);
