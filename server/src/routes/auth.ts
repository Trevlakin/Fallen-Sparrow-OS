import { Router, type IRouter } from "express";
import * as authController from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { enforceTenant } from "../middleware/tenantEnforcement.js";

export const authRouter: IRouter = Router();

authRouter.post("/login", authController.login);
authRouter.post("/pin-login", authController.pinLogin);
authRouter.get("/me", requireAuth, enforceTenant, authController.me);
authRouter.post(
  "/change-password",
  requireAuth,
  enforceTenant,
  authController.changePassword,
);
authRouter.post(
  "/change-email",
  requireAuth,
  enforceTenant,
  authController.changeEmail,
);
