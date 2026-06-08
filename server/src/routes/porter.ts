import { Router, type IRouter } from "express";
import * as porterController from "../controllers/porterController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireRoles } from "../middleware/rbac.js";
import { rawBodyCapture } from "../middleware/rawBody.js";

export const porterRouter: IRouter = Router();

porterRouter.post(
  "/ingest/csv",
  requireAuth,
  enforceTenant,
  requireRoles("OWNER", "MANAGER"),
  porterController.ingestCsv,
);

/** Public Resend inbound webhook — mount before express.json() in app.ts */
export const porterWebhookRouter: IRouter = Router();
porterWebhookRouter.post(
  "/ingest/webhook",
  rawBodyCapture,
  porterController.ingestWebhook,
);
