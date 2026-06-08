import type { Request, Response, NextFunction } from "express";
import * as strategicNoteService from "../services/strategicNoteService.js";
import { expandStrategicNote } from "../services/jarvisService.js";
import { AppError } from "../utils/errors.js";

export async function list(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const notes = await strategicNoteService.listStrategicNotes();
    res.json({ notes });
  } catch (err) {
    next(err);
  }
}

export async function remove(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      throw new AppError("Note id required", 400);
    }
    await strategicNoteService.deleteStrategicNote(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function expand(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      throw new AppError("Note id required", 400);
    }
    const expansion = await expandStrategicNote(id);
    res.json({ expansion });
  } catch (err) {
    next(err);
  }
}
