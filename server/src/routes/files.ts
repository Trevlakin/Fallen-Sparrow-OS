import { Router, type IRouter } from "express";
import * as receiptController from "../controllers/receiptController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";

export const filesRouter: IRouter = Router();

filesRouter.get(
  "/receipts/:studioId/:filename",
  requireAuth,
  enforceTenant,
  receiptController.serveLocalReceipt,
);
