import { Router, type IRouter } from "express";
import * as artistController from "../controllers/artistController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";
import { requireManager } from "../middleware/rbac.js";

export const artistsRouter: IRouter = Router();

artistsRouter.get(
  "/performance",
  requireAuth,
  enforceTenant,
  artistController.getAllPerformance,
);

artistsRouter.get(
  "/:id/performance",
  requireAuth,
  enforceTenant,
  requireManager,
  artistController.getArtistPerformance,
);

artistsRouter.get(
  "/:id/recent",
  requireAuth,
  enforceTenant,
  requireManager,
  artistController.getArtistRecent,
);
