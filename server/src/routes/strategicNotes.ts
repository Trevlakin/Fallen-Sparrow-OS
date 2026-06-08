import { Router, type IRouter } from "express";
import * as strategicNotesController from "../controllers/strategicNotesController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireRoles } from "../middleware/rbac.js";

export const strategicNotesRouter: IRouter = Router();

strategicNotesRouter.get(
  "/",
  requireAuth,
  enforceTenant,
  requireRoles("OWNER", "MANAGER"),
  strategicNotesController.list,
);
strategicNotesRouter.delete(
  "/:id",
  requireAuth,
  enforceTenant,
  requireRoles("OWNER", "MANAGER"),
  strategicNotesController.remove,
);

strategicNotesRouter.post(
  "/:id/expand",
  requireAuth,
  enforceTenant,
  requireRoles("OWNER", "MANAGER"),
  strategicNotesController.expand,
);
