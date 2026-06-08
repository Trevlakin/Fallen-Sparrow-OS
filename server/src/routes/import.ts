import { Router, type IRouter } from "express";
import * as importController from "../controllers/importController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager } from "../middleware/rbac.js";

export const importRouter: IRouter = Router();

importRouter.post(
  "/csv",
  requireAuth,
  enforceTenant,
  requireManager,
  importController.importCsv,
);

importRouter.post(
  "/csv/preview",
  requireAuth,
  enforceTenant,
  requireManager,
  importController.previewCsvHeaders,
);
