import winston from "winston";
import { env } from "../config/env.js";

export const logger = winston.createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: "fallen-sparrow-api" },
  transports: [new winston.transports.Console()],
});
