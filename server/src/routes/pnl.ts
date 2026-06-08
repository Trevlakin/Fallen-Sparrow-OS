import { Router, type IRouter } from "express";
import * as pnlController from "../controllers/pnlController.js";
import * as pnlImportHistoryController from "../controllers/pnlImportHistoryController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager } from "../middleware/rbac.js";

export const pnlRouter: IRouter = Router();

pnlRouter.get(
  "/monthly",
  requireAuth,
  enforceTenant,
  requireManager,
  pnlController.getMonthly,
);

pnlRouter.get(
  "/range",
  requireAuth,
  enforceTenant,
  requireManager,
  pnlController.getRange,
);

pnlRouter.get(
  "/imports",
  requireAuth,
  enforceTenant,
  requireManager,
  pnlImportHistoryController.listImports,
);

pnlRouter.delete(
  "/imports/:id",
  requireAuth,
  enforceTenant,
  requireManager,
  pnlImportHistoryController.deleteImport,
);

pnlRouter.get(
  "/artists/:artistId/sessions",
  requireAuth,
  enforceTenant,
  requireManager,
  pnlController.getArtistSessions,
);

pnlRouter.patch(
  "/artists/:artistId/sessions/:paymentId/paid",
  requireAuth,
  enforceTenant,
  requireManager,
  pnlController.patchArtistSessionPaid,
);
