import { Router, type IRouter } from "express";
import * as appointmentController from "../controllers/appointmentController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager } from "../middleware/rbac.js";

export const appointmentsRouter: IRouter = Router();

appointmentsRouter.get(
  "/",
  requireAuth,
  enforceTenant,
  requireManager,
  appointmentController.listAppointments,
);
