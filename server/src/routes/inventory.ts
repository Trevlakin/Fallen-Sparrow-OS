import { Router, type IRouter } from "express";
import * as inventoryController from "../controllers/inventoryController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager, requireOwner } from "../middleware/rbac.js";

export const inventoryRouter: IRouter = Router();

inventoryRouter.get(
  "/snapshot",
  requireAuth,
  enforceTenant,
  inventoryController.snapshot,
);

inventoryRouter.get(
  "/",
  requireAuth,
  enforceTenant,
  inventoryController.list,
);

inventoryRouter.post(
  "/",
  requireAuth,
  enforceTenant,
  requireManager,
  inventoryController.create,
);

inventoryRouter.put(
  "/:id",
  requireAuth,
  enforceTenant,
  requireManager,
  inventoryController.update,
);

inventoryRouter.delete(
  "/:id",
  requireAuth,
  enforceTenant,
  requireOwner,
  inventoryController.remove,
);

inventoryRouter.post(
  "/:id/adjust",
  requireAuth,
  enforceTenant,
  inventoryController.adjust,
);

inventoryRouter.get(
  "/history",
  requireAuth,
  enforceTenant,
  requireManager,
  inventoryController.monthlyHistory,
);

inventoryRouter.get(
  "/:id/history",
  requireAuth,
  enforceTenant,
  requireManager,
  inventoryController.history,
);
