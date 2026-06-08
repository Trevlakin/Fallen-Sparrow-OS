import { Router, type IRouter } from "express";

export const healthRouter: IRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "fallen-sparrow-api",
    timestamp: new Date().toISOString(),
  });
});
