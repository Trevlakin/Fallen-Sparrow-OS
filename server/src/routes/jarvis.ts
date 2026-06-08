import { Router, type IRouter } from "express";
import * as jarvisController from "../controllers/jarvisController.js";
import * as receiptController from "../controllers/receiptController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireRoles } from "../middleware/rbac.js";

export const jarvisRouter: IRouter = Router();

jarvisRouter.post(
  "/",
  requireAuth,
  enforceTenant,
  jarvisController.parseInput,
);

jarvisRouter.post(
  "/preview",
  requireAuth,
  enforceTenant,
  jarvisController.preview,
);

jarvisRouter.get(
  "/history",
  requireAuth,
  enforceTenant,
  jarvisController.listHistory,
);

jarvisRouter.delete(
  "/history",
  requireAuth,
  enforceTenant,
  jarvisController.clearHistory,
);

jarvisRouter.delete(
  "/history/:id",
  requireAuth,
  enforceTenant,
  jarvisController.deleteHistoryItem,
);

jarvisRouter.post(
  "/approve",
  requireAuth,
  enforceTenant,
  jarvisController.approve,
);

jarvisRouter.post(
  "/payout/confirm",
  requireAuth,
  enforceTenant,
  requireRoles("OWNER", "MANAGER"),
  jarvisController.confirmArtistPayout,
);

jarvisRouter.post(
  "/receipt",
  requireAuth,
  enforceTenant,
  receiptController.uploadExpenseReceipt,
);

jarvisRouter.get(
  "/suggestions",
  requireAuth,
  enforceTenant,
  requireRoles("OWNER", "MANAGER"),
  jarvisController.listSuggestions,
);

jarvisRouter.post(
  "/suggestions/:id/promote",
  requireAuth,
  enforceTenant,
  requireRoles("OWNER", "MANAGER"),
  jarvisController.promoteSuggestion,
);

jarvisRouter.delete(
  "/suggestions/:id",
  requireAuth,
  enforceTenant,
  requireRoles("OWNER", "MANAGER"),
  jarvisController.dismissSuggestion,
);
