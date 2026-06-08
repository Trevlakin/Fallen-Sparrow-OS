import { Router, type IRouter } from "express";
import * as sopController from "../controllers/sopController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager, requireOwner } from "../middleware/rbac.js";

export const sopsRouter: IRouter = Router();

sopsRouter.get(
  "/my",
  requireAuth,
  enforceTenant,
  sopController.getMyChecklist,
);

sopsRouter.get(
  "/status/today",
  requireAuth,
  enforceTenant,
  requireManager,
  sopController.getTodayStatus,
);

sopsRouter.get(
  "/access",
  requireAuth,
  enforceTenant,
  requireOwner,
  sopController.listAccessCodes,
);

sopsRouter.post(
  "/access",
  requireAuth,
  enforceTenant,
  requireOwner,
  sopController.createAccessCode,
);

sopsRouter.delete(
  "/access/:id",
  requireAuth,
  enforceTenant,
  requireOwner,
  sopController.revokeAccessCode,
);

sopsRouter.get(
  "/history/:sopId",
  requireAuth,
  enforceTenant,
  requireManager,
  sopController.getHistory,
);

sopsRouter.get(
  "/:sopId/detail",
  requireAuth,
  enforceTenant,
  requireManager,
  sopController.getSopDetailForDate,
);

sopsRouter.post(
  "/items/:itemId/complete",
  requireAuth,
  enforceTenant,
  sopController.completeItem,
);

sopsRouter.delete(
  "/items/:itemId/complete",
  requireAuth,
  enforceTenant,
  sopController.uncompleteItem,
);

sopsRouter.get(
  "/",
  requireAuth,
  enforceTenant,
  requireManager,
  sopController.listSops,
);

sopsRouter.post(
  "/",
  requireAuth,
  enforceTenant,
  requireManager,
  sopController.createSop,
);

sopsRouter.patch(
  "/:id",
  requireAuth,
  enforceTenant,
  requireManager,
  sopController.updateSop,
);

sopsRouter.put(
  "/:id",
  requireAuth,
  enforceTenant,
  requireManager,
  sopController.updateSop,
);

sopsRouter.delete(
  "/:id",
  requireAuth,
  enforceTenant,
  requireManager,
  sopController.deleteSop,
);

sopsRouter.post(
  "/:id/items",
  requireAuth,
  enforceTenant,
  requireManager,
  sopController.addChecklistItem,
);

sopsRouter.patch(
  "/:id/items/:itemId",
  requireAuth,
  enforceTenant,
  requireManager,
  sopController.updateChecklistItem,
);

sopsRouter.delete(
  "/:id/items/:itemId",
  requireAuth,
  enforceTenant,
  requireManager,
  sopController.removeChecklistItem,
);
