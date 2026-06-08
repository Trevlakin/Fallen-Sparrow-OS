/**
 * Captures raw request body for webhook signature verification.
 * Mount ONLY on routes that need it (e.g. Resend inbound).
 */
import type { Request, Response, NextFunction } from "express";

export function rawBodyCapture(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const chunks: Buffer[] = [];

  req.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on("end", () => {
    req.rawBody = Buffer.concat(chunks);
    next();
  });

  req.on("error", (err) => {
    next(err);
  });
}
