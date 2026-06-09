import type { User } from "@fallen-sparrow/shared/schema";
import type { ChecklistAuthPayload } from "../services/checklistService.js";
import type { VerifiedAuthPayload } from "../services/authService.js";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      authPayload?: VerifiedAuthPayload;
      /** Single-studio deployment; reserved for multi-location (studioId) later. */
      studioContext?: { studioId: string };
      /** Set by rawBodyCapture middleware (webhooks only). */
      rawBody?: Buffer;
      /** Sprint 8L employee checklist JWT (12h). */
      checklistAuth?: ChecklistAuthPayload;
      /** Legacy short-lived PIN/QR checklist session (8h JWT). */
      checklistSession?: {
        accessId: string;
        sopId: string;
        label: string;
        type: "checklist_session";
      };
    }
  }
}

export {};
