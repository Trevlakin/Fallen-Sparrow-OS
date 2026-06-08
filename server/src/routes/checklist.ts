import { Router, type IRouter } from "express";
import * as checklistController from "../controllers/checklistController.js";
import { checklistAuth } from "../middleware/checklistAuth.js";
import { requireChecklistSession } from "../middleware/checklistSession.js";
import { requireAuth } from "../middleware/auth.js";

export const checklistRouter: IRouter = Router();

checklistRouter.get("/employees", checklistController.listEmployees);

checklistRouter.post("/login", checklistController.pinLogin);

checklistRouter.get("/today", checklistAuth, checklistController.getTodayChecklist);

checklistRouter.post(
  "/session/start",
  checklistAuth,
  checklistController.startSession,
);

checklistRouter.get(
  "/admin/summary",
  requireAuth,
  checklistController.adminSummary,
);

checklistRouter.post(
  "/complete/:itemId",
  checklistAuth,
  checklistController.completeChecklistItem,
);

checklistRouter.delete(
  "/complete/:itemId",
  checklistAuth,
  checklistController.uncompleteChecklistItem,
);

/** Legacy checklist_access token flow */
checklistRouter.post("/verify", checklistController.verifyAccess);

checklistRouter.get(
  "/items",
  requireChecklistSession,
  checklistController.getItems,
);

checklistRouter.post(
  "/items/:itemId/complete",
  requireChecklistSession,
  checklistController.completeItem,
);

checklistRouter.delete(
  "/items/:itemId/complete",
  requireChecklistSession,
  checklistController.uncompleteItem,
);
