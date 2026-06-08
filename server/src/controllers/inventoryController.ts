import type { Request, Response, NextFunction } from "express";
import { INVENTORY_CATEGORY_KEYS } from "@fallen-sparrow/shared/constants";
import { z } from "zod";
import * as inventoryRepo from "../repos/inventoryRepo.js";
import * as inventoryService from "../services/inventoryService.js";
import { AppError } from "../utils/errors.js";

const categorySchema = z.enum(INVENTORY_CATEGORY_KEYS);

const inventoryItemBodySchema = z.object({
  name: z.string().min(1),
  category: categorySchema,
  unit: z.string().min(1),
  currentStock: z.number().int().min(0),
  reorderThreshold: z.number().int().min(0).nullish(),
  idealStock: z.number().int().min(0).nullish(),
  notes: z.string().nullish(),
});

const adjustBodySchema = z.object({
  quantity: z.number().int(),
  type: z.enum(["restock", "use", "adjustment", "jarvis"]),
  notes: z.string().optional(),
});

const statusQuerySchema = z.enum(["out", "low", "ok", "all"]).optional();

const monthlyHistoryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const statusParsed = statusQuerySchema.safeParse(req.query["status"]);
    const status = statusParsed.success ? statusParsed.data : "all";
    const categoryRaw = req.query["category"];
    const category =
      typeof categoryRaw === "string" && categoryRaw !== "all" ? categoryRaw : undefined;

    let items = await inventoryRepo.listInventoryItems(true);
    items = inventoryService.filterItemsByCategory(items, category);
    items = inventoryService.filterItemsByStatus(items, status ?? "all");

    res.json({ items: inventoryService.withStatusField(items) });
  } catch (err) {
    next(err);
  }
}

export async function snapshot(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const snap = await inventoryService.getInventorySnapshot();
    res.json(snap);
  } catch (err) {
    next(err);
  }
}

export async function create(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = inventoryItemBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid inventory item payload", 400);
    }
    const id = await inventoryRepo.upsertInventoryItem(parsed.data);
    const item = await inventoryRepo.getInventoryItem(id);
    if (!item) {
      throw new AppError("Failed to load created item", 500);
    }
    res.status(201).json({
      item: { ...item, status: inventoryService.getStockStatus(item) },
    });
  } catch (err) {
    next(err);
  }
}

export async function update(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      throw new AppError("Item id required", 400);
    }
    const parsed = inventoryItemBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid inventory item payload", 400);
    }
    await inventoryRepo.upsertInventoryItem({ ...parsed.data, id });
    const item = await inventoryRepo.getInventoryItem(id);
    if (!item) {
      throw new AppError("Inventory item not found", 404);
    }
    res.json({
      item: { ...item, status: inventoryService.getStockStatus(item) },
    });
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
      throw new AppError("Item id required", 400);
    }
    await inventoryRepo.softDeleteInventoryItem(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function adjust(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      throw new AppError("Item id required", 400);
    }
    const parsed = adjustBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid adjust payload", 400);
    }

    const { newStock } = await inventoryRepo.adjustStock({
      itemId: id,
      quantity: parsed.data.quantity,
      type: parsed.data.type,
      notes: parsed.data.notes,
      createdBy: req.user?.id,
    });

    const item = await inventoryRepo.getInventoryItem(id);
    if (!item) {
      throw new AppError("Inventory item not found", 404);
    }

    const refreshed = { ...item, currentStock: newStock };
    await inventoryService.checkAndCreateReorderTask(id);

    res.json({
      itemId: id,
      newStock,
      status: inventoryService.getStockStatus(refreshed),
    });
  } catch (err) {
    next(err);
  }
}

export async function monthlyHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = monthlyHistoryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("year and month query params required", 400);
    }
    const result = await inventoryService.getMonthlyHistory(
      parsed.data.year,
      parsed.data.month,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function history(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      throw new AppError("Item id required", 400);
    }
    const rows = await inventoryRepo.getItemTransactionHistory(id, 20);
    res.json({ transactions: rows });
  } catch (err) {
    next(err);
  }
}
