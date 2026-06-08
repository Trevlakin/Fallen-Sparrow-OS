import { Router, type IRouter } from "express";
import * as customerController from "../controllers/customerController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager } from "../middleware/rbac.js";

export const customersRouter: IRouter = Router();

customersRouter.get(
  "/top-referrers",
  requireAuth,
  enforceTenant,
  requireManager,
  customerController.getTopReferrers,
);

customersRouter.get(
  "/by-spend",
  requireAuth,
  enforceTenant,
  requireManager,
  customerController.getCustomersBySpend,
);

customersRouter.get("/", requireAuth, enforceTenant, customerController.listCustomers);

customersRouter.get("/:id", requireAuth, enforceTenant, customerController.getCustomer);
