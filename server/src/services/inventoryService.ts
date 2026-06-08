/**
 * Inventory business logic (Sprint 8K).
 */
import { taskQueue } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";
import { monthBoundsForYearMonth } from "../lib/timezone.js";
import * as expenseRepo from "../repos/expenseRepo.js";
import * as inventoryRepo from "../repos/inventoryRepo.js";
import type { InventoryItem } from "../repos/inventoryRepo.js";
import { AppError } from "../utils/errors.js";

export type StockStatus = "ok" | "low" | "out";

export interface InventorySnapshot {
  totalItems: number;
  outCount: number;
  lowCount: number;
  okCount: number;
  criticalCount: number;
  outItems: InventoryItem[];
  lowItems: InventoryItem[];
}

export interface JarvisInventoryUpdate {
  itemName: string;
  action: "restock" | "depleted" | "low_alert";
  quantity?: number;
  confidence: number;
}

export function getStockStatus(item: InventoryItem): StockStatus {
  if (item.currentStock === 0) {
    return "out";
  }
  if (
    item.reorderThreshold != null &&
    item.currentStock > 0 &&
    item.currentStock <= item.reorderThreshold
  ) {
    return "low";
  }
  return "ok";
}

export async function getInventorySnapshot(): Promise<InventorySnapshot> {
  const items = await inventoryRepo.listInventoryItems(true);
  const outItems = items.filter((i) => getStockStatus(i) === "out");
  const lowItems = items.filter((i) => getStockStatus(i) === "low");
  const okCount = items.filter((i) => getStockStatus(i) === "ok").length;

  return {
    totalItems: items.length,
    outCount: outItems.length,
    lowCount: lowItems.length,
    okCount,
    criticalCount: outItems.length + lowItems.length,
    outItems,
    lowItems,
  };
}

export async function checkAndCreateReorderTask(itemId: string): Promise<void> {
  const item = await inventoryRepo.getInventoryItem(itemId);
  if (!item) return;
  await maybeCreateReorderTask(item);
}

async function maybeCreateReorderTask(item: InventoryItem): Promise<void> {
  if (item.reorderThreshold == null) return;
  if (item.currentStock > item.reorderThreshold) return;

  await db.insert(taskQueue).values({
    type: "admin",
    title: `Order ${item.name}`,
    description: `Order ${item.name}: ${item.currentStock} ${item.unit}s left`,
    status: "open",
  });
}

export async function processJarvisInventoryUpdate(
  updates: JarvisInventoryUpdate[],
  createdBy?: string,
): Promise<{ processed: number; unresolved: string[] }> {
  const unresolved: string[] = [];
  let processed = 0;

  for (const update of updates) {
    const item = await inventoryRepo.findItemByName(update.itemName);
    if (!item) {
      unresolved.push(update.itemName);
      continue;
    }

    if (update.action === "restock") {
      const qty = update.quantity ?? 1;
      const { newStock } = await inventoryRepo.adjustStock({
        itemId: item.id,
        quantity: qty,
        type: "jarvis",
        notes: `JARVIS restock: ${update.itemName}`,
        createdBy,
      });
      const refreshed = { ...item, currentStock: newStock };
      await maybeCreateReorderTask(refreshed);
      processed += 1;
      continue;
    }

    if (update.action === "depleted") {
      const delta = -item.currentStock;
      if (delta !== 0) {
        await inventoryRepo.adjustStock({
          itemId: item.id,
          quantity: delta,
          type: "jarvis",
          notes: `JARVIS depleted: ${update.itemName}`,
          createdBy,
        });
      }
      const refreshed = { ...item, currentStock: 0 };
      await maybeCreateReorderTask(refreshed);
      processed += 1;
      continue;
    }

    if (update.action === "low_alert") {
      const note =
        update.quantity != null
          ? `Low alert: ${update.itemName} (${update.quantity} ${item.unit}s reported)`
          : `Low alert: ${update.itemName}`;
      await inventoryRepo.adjustStock({
        itemId: item.id,
        quantity: 0,
        type: "jarvis",
        notes: note,
        createdBy,
      });
      await maybeCreateReorderTask(item);
      processed += 1;
    }
  }

  return { processed, unresolved };
}

export function filterItemsByStatus(
  items: InventoryItem[],
  status: "out" | "low" | "ok" | "all",
): InventoryItem[] {
  if (status === "all") return items;
  return items.filter((item) => getStockStatus(item) === status);
}

export function filterItemsByCategory(
  items: InventoryItem[],
  category: string | undefined,
): InventoryItem[] {
  if (!category || category === "all") return items;
  return items.filter((item) => item.category === category);
}

export function withStatusField(
  items: InventoryItem[],
): Array<InventoryItem & { status: StockStatus }> {
  return items.map((item) => ({
    ...item,
    status: getStockStatus(item),
  }));
}

export type MonthlyItemStatus = "ran_out" | "ended_low" | "ok";

export interface MonthlyItemSnapshot {
  id: string;
  name: string;
  unit: string;
  openingStock: number;
  used: number;
  restocked: number;
  closingStock: number;
  status: MonthlyItemStatus;
}

export interface MonthlyInventoryHistory {
  month: string;
  restockEventCount: number;
  itemsRanOutCount: number;
  supplySpend: number;
  items: MonthlyItemSnapshot[];
}

function monthlyItemStatus(
  hitZero: boolean,
  closingStock: number,
  reorderThreshold: number | null,
): MonthlyItemStatus {
  if (hitZero) {
    return "ran_out";
  }
  if (
    closingStock > 0 &&
    reorderThreshold != null &&
    closingStock <= reorderThreshold
  ) {
    return "ended_low";
  }
  return "ok";
}

function monthlyStatusPriority(status: MonthlyItemStatus): number {
  if (status === "ran_out") return 0;
  if (status === "ended_low") return 1;
  return 2;
}

export async function getMonthlyHistory(
  year: number,
  month: number,
): Promise<MonthlyInventoryHistory> {
  if (month < 1 || month > 12) {
    throw new AppError("Month must be between 1 and 12", 400);
  }

  const { monthKey, from, to } = monthBoundsForYearMonth(year, month);

  const [items, monthAggregates, postMonthDeltas, restockEventCount, categoryTotals] =
    await Promise.all([
      inventoryRepo.listInventoryItems(true),
      inventoryRepo.getMonthlyTransactionAggregatesByItem(from, to),
      inventoryRepo.getPostMonthQuantitySumByItem(to),
      inventoryRepo.countRestockEventsInPeriod(from, to),
      expenseRepo.sumExpensesByCategory("", from, to),
    ]);

  const supplySpend =
    categoryTotals.find((row) => row.category === "SUPPLIES")?.total ?? 0;

  const snapshots: MonthlyItemSnapshot[] = items.map((item) => {
    const agg = monthAggregates.get(item.id) ?? {
      used: 0,
      restocked: 0,
      hitZero: false,
    };
    const postMonthDelta = postMonthDeltas.get(item.id) ?? 0;
    const openingStock = item.currentStock - postMonthDelta;
    const closingStock = openingStock + agg.restocked - agg.used;
    const status = monthlyItemStatus(
      agg.hitZero,
      closingStock,
      item.reorderThreshold,
    );

    return {
      id: item.id,
      name: item.name,
      unit: item.unit,
      openingStock,
      used: agg.used,
      restocked: agg.restocked,
      closingStock,
      status,
    };
  });

  snapshots.sort((a, b) => {
    const pd = monthlyStatusPriority(a.status) - monthlyStatusPriority(b.status);
    if (pd !== 0) return pd;
    return a.name.localeCompare(b.name);
  });

  const itemsRanOutCount = snapshots.filter((row) => row.status === "ran_out").length;

  return {
    month: monthKey,
    restockEventCount,
    itemsRanOutCount,
    supplySpend,
    items: snapshots,
  };
}
