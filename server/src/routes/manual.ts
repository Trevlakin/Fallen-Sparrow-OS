import { Router, type IRouter } from "express";
import * as manualController from "../controllers/manualController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager } from "../middleware/rbac.js";

export const manualRouter: IRouter = Router();

manualRouter.post(
  "/expense",
  requireAuth,
  enforceTenant,
  requireManager,
  manualController.createManualExpense,
);

manualRouter.post(
  "/sale",
  requireAuth,
  enforceTenant,
  requireManager,
  manualController.createManualSale,
);

manualRouter.get(
  "/artists",
  requireAuth,
  enforceTenant,
  requireManager,
  manualController.listManualSaleArtists,
);
