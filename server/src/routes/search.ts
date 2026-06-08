import { Router, type IRouter } from "express";
import * as searchController from "../controllers/searchController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireRoles } from "../middleware/rbac.js";

export const searchRouter: IRouter = Router();

searchRouter.get(
  "/",
  requireAuth,
  enforceTenant,
  requireRoles("OWNER", "MANAGER", "FRONT_DESK"),
  searchController.search,
);
