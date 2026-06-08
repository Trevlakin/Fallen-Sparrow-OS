import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../src/app.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { pool } from "../../src/config/database.js";
import * as authService from "../../src/services/authService.js";
import * as userRepo from "../../src/repos/userRepo.js";

function buildTestApp(): Express {
  const app = createApp();
  app.use(errorHandler);
  return app;
}

describe("Metrics API integration", () => {
  const app = buildTestApp();
  let ownerToken = "";
  let frontDeskToken = "";

  beforeAll(async () => {
    const owner = await userRepo.findUserByEmail("owner@fallensparrow.local");
    const frontDesk = await userRepo.findUserByEmail("frontdesk@fallensparrow.local");

    if (!owner || !frontDesk) {
      throw new Error(
        "Seed users required. Run pnpm db:seed before integration tests.",
      );
    }

    ownerToken = authService.signToken(owner);
    frontDeskToken = authService.signToken(frontDesk);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("GET /api/metrics/daily", () => {
    it("returns 401 when unauthenticated", async () => {
      const res = await request(app).get("/api/metrics/daily?date=2025-05-01");
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it("returns 200 and daily summary for authenticated user", async () => {
      const res = await request(app)
        .get("/api/metrics/daily?date=2025-05-01")
        .set("Authorization", `Bearer ${frontDeskToken}`);

      expect(res.status).toBe(200);
      expect(res.body.date).toBe("2025-05-01");
      expect(res.body).toHaveProperty("byArtist");
      expect(res.body).toHaveProperty("byService");
      expect(res.body).toHaveProperty("totalRevenue");
      expect(res.body).toHaveProperty("appointmentCount");
    });

    it("returns 400 when date query param is missing", async () => {
      const res = await request(app)
        .get("/api/metrics/daily")
        .set("Authorization", `Bearer ${frontDeskToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/metrics/weekly", () => {
    it("returns 401 when unauthenticated", async () => {
      const res = await request(app).get(
        "/api/metrics/weekly?start=2025-05-01&end=2025-05-07",
      );
      expect(res.status).toBe(401);
    });

    it("returns 200 and weekly summary for authenticated user", async () => {
      const res = await request(app)
        .get("/api/metrics/weekly?start=2025-05-01&end=2025-05-07")
        .set("Authorization", `Bearer ${frontDeskToken}`);

      expect(res.status).toBe(200);
      expect(res.body.start).toBe("2025-05-01");
      expect(res.body.end).toBe("2025-05-07");
      expect(res.body).toHaveProperty("totalRevenue");
      expect(res.body).toHaveProperty("byArtist");
    });

    it("returns 400 when start or end is missing", async () => {
      const res = await request(app)
        .get("/api/metrics/weekly?start=2025-05-01")
        .set("Authorization", `Bearer ${frontDeskToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/metrics/monthly", () => {
    it("returns 401 when unauthenticated", async () => {
      const res = await request(app).get("/api/metrics/monthly?year=2025&month=5");
      expect(res.status).toBe(401);
    });

    it("returns 403 for FRONT_DESK role", async () => {
      const res = await request(app)
        .get("/api/metrics/monthly?year=2025&month=5")
        .set("Authorization", `Bearer ${frontDeskToken}`);

      expect(res.status).toBe(403);
    });

    it("returns 200 and monthly summary for OWNER role", async () => {
      const res = await request(app)
        .get("/api/metrics/monthly?year=2025&month=5")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.month).toBe("2025-05");
      expect(res.body).toHaveProperty("totalRevenue");
      expect(res.body).toHaveProperty("totalCosts");
      expect(res.body).toHaveProperty("netProfit");
      expect(res.body).toHaveProperty("byArtist");
      expect(res.body).toHaveProperty("byService");
    });

    it("returns 400 when year or month is invalid", async () => {
      const res = await request(app)
        .get("/api/metrics/monthly?year=2025&month=13")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
    });
  });
});
